import { PageHeader } from '@/components/ui/PageHeader'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessContext } from '@/lib/services/current-business'
import { Card } from '@/components/ui/Card'
import { ChangeEmailForm, ChangePasswordForm } from '@/components/settings/AccountSecurityForms'
import { ProfileForm } from '@/components/settings/ProfileForm'
import { AvatarPicker } from '@/components/settings/AvatarPicker'

export default async function AccountPage({ searchParams }: { searchParams: { email?: string } }) {
  const { displayName, avatarUrl, userId } = await getCurrentBusinessContext() // members only, same as the rest of Settings
  // Middleware has already verified this session for the request.
  const {
    data: { session },
  } = await createClient().auth.getSession()
  const email = session?.user.email ?? ''
  const pendingEmail = session?.user.new_email ?? null

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader back={{ href: '/settings', label: 'Settings' }} title="Your account" subtitle="Your photo, name, and how you sign in to the app." />

      <Card>
        <SectionLabel icon="🙂" className="mb-3">Photo &amp; name</SectionLabel>
        <div className="mb-4">
          <AvatarPicker userId={userId} name={displayName ?? email} initialUrl={avatarUrl} />
        </div>
        <ProfileForm displayName={displayName} email={null} />
      </Card>

      {searchParams.email === 'confirmed' && (
        <Card className="border border-sage/40">
          <p className="text-sm text-sage-dark">
            {pendingEmail
              ? 'Link confirmed. If a confirmation was also sent to your other address, click that one too to finish.'
              : `Your email is now ${email}.`}
          </p>
        </Card>
      )}

      <Card>
        <SectionLabel icon="✉️" className="mb-3">Email</SectionLabel>
        <ChangeEmailForm currentEmail={email} pendingEmail={pendingEmail} />
      </Card>

      <Card>
        <SectionLabel icon="🔒" className="mb-3">Password</SectionLabel>
        <ChangePasswordForm email={email} />
      </Card>
    </div>
  )
}
