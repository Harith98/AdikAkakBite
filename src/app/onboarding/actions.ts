'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { buildDefaultScheduleBlocks } from '@/lib/services/default-schedule'

export interface OnboardingFormState {
  error: string | null
}

/**
 * Creates the new business + its settings + the caller's membership row +
 * the default schedule (spec §8), then marks onboarding complete.
 *
 * This covers onboarding steps 1–4 and 9 from spec §38 (business name,
 * owner name, hours, working days, review schedule). Steps 5–8 (products,
 * prices, inventory, goals) are intentionally skippable in V1 — per spec
 * §38, "the application must be usable even if the owner has only entered
 * basic information" — and are done from their own modules once those are
 * built (Phase 3+). The owner can revisit all of this in Settings.
 */
export async function completeOnboarding(
  _prevState: OnboardingFormState,
  formData: FormData
): Promise<OnboardingFormState> {
  const businessName = String(formData.get('businessName') ?? '').trim()
  const ownerName = String(formData.get('ownerName') ?? '').trim()
  const workingHoursStart = String(formData.get('workingHoursStart') ?? '11:00')
  const workingHoursEnd = String(formData.get('workingHoursEnd') ?? '20:00')
  const workingDays = formData.getAll('workingDays').map((d) => Number(d))

  if (!businessName) {
    return { error: 'Business name is required.' }
  }
  if (workingDays.length === 0) {
    return { error: 'Select at least one working day.' }
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Already belongs to a business (e.g. joined through an invite, or a
  // double-submit): don't create a second one.
  const { data: existingMembership } = await supabase
    .from('business_members')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()
  if (existingMembership) {
    redirect('/today')
  }

  // The id is generated here rather than read back from the insert: the
  // businesses SELECT policy requires membership, which doesn't exist until
  // the next statement, so `.insert().select()` would be blocked by RLS.
  const businessId = crypto.randomUUID()

  const { error: businessError } = await supabase
    .from('businesses')
    .insert({ id: businessId, name: businessName, owner_name: ownerName || null })

  if (businessError) {
    return { error: businessError.message }
  }

  const { error: memberError } = await supabase
    .from('business_members')
    .insert({ business_id: businessId, user_id: user.id, role: 'owner' })

  if (memberError) {
    return { error: memberError.message }
  }

  const { error: settingsError } = await supabase.from('business_settings').insert({
    business_id: businessId,
    working_hours_start: workingHoursStart,
    working_hours_end: workingHoursEnd,
    working_days: workingDays,
    onboarding_completed: true,
    onboarding_step: 10,
  })

  if (settingsError) {
    return { error: settingsError.message }
  }

  const { error: scheduleError } = await supabase
    .from('schedule_blocks')
    .insert(buildDefaultScheduleBlocks(businessId))

  if (scheduleError) {
    return { error: scheduleError.message }
  }

  await supabase.from('business_activity_logs').insert({
    business_id: businessId,
    user_id: user.id,
    action: 'business_onboarded',
    entity_type: 'business',
    entity_id: businessId,
  })

  redirect('/today')
}
