'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getActionContext } from '@/lib/services/action-context'
import { findOrCreateCustomer } from '@/lib/services/customers'
import { getBusinessNow } from '@/lib/time'
import { parseOrderForm } from '@/lib/validation/orders'
import { derivePaymentStatus } from '@/lib/calc/orders'
import { isPaymentMethod } from '@/lib/receipts'
import { getOrder } from '@/lib/services/orders'

export interface SaveOrderState {
  error: string | null
  /** Changes on every successful update so the form can show "Saved". */
  nonce: number
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Create a new order, or update an existing one when `orderId` is present. */
export async function saveOrder(_prev: SaveOrderState, formData: FormData): Promise<SaveOrderState> {
  const parsed = parseOrderForm(formData)
  if (!parsed.ok) return { error: parsed.error, nonce: 0 }
  const order = parsed.value

  const orderIdRaw = String(formData.get('orderId') ?? '')
  if (orderIdRaw && !UUID.test(orderIdRaw)) return { error: 'Invalid order.', nonce: 0 }

  const ctx = await getActionContext()
  if (!ctx.ok) return { error: ctx.error, nonce: 0 }
  const { supabase, businessId, userId, timezone } = ctx

  // ---- find or create the customer: phone first, then name (see customer-identity.ts) ----
  const customer = await findOrCreateCustomer(supabase, businessId, order.customerName, order.customerPhone)
  if (!customer.ok) return { error: customer.error, nonce: 0 }

  const fields = {
    customer_id: customer.customerId,
    required_date: order.requiredDate,
    required_time: order.requiredTime,
    discount: order.discount,
    delivery_fee: order.deliveryFee,
    deposit: order.deposit,
    payment_status: order.paymentStatus,
    notes: order.notes,
  }
  const itemRows = (orderId: string) =>
    order.items.map((i) => ({
      order_id: orderId,
      product_id: i.productId,
      product_name: i.productName,
      quantity: i.quantity,
      unit_price: i.unitPrice,
    }))

  // ---------------------------------------------------------- update
  if (orderIdRaw) {
    const { data: existing, error: existingError } = await supabase.from('orders')
      .select('id')
      .eq('id', orderIdRaw)
      .eq('business_id', businessId)
      .maybeSingle()
    if (existingError) return { error: existingError.message, nonce: 0 }
    if (!existing) return { error: 'That order could not be found.', nonce: 0 }

    const { data: oldItems } = await supabase.from('order_items').select('id').eq('order_id', orderIdRaw)

    // Add the new items FIRST, then remove the old ones, so a failure part-way
    // never leaves the order without items.
    const { data: inserted, error: insertError } = await supabase.from('order_items').insert(itemRows(orderIdRaw)).select('id')
    if (insertError) return { error: insertError.message, nonce: 0 }

    const { error: updateError } = await supabase.from('orders').update(fields).eq('id', orderIdRaw).eq('business_id', businessId)
    if (updateError) {
      await supabase.from('order_items').delete().in('id', (inserted ?? []).map((i: { id: string }) => i.id))
      return { error: updateError.message, nonce: 0 }
    }

    const oldIds = (oldItems ?? []).map((i: { id: string }) => i.id)
    if (oldIds.length > 0) {
      const { error: deleteError } = await supabase.from('order_items').delete().in('id', oldIds)
      if (deleteError) return { error: deleteError.message, nonce: 0 }
    }

    await supabase.from('business_activity_logs').insert({
      business_id: businessId,
      user_id: userId,
      action: 'order_updated',
      entity_type: 'order',
      entity_id: orderIdRaw,
    })
    revalidatePath('/orders', 'layout')
    revalidatePath('/today')
    return { error: null, nonce: Date.now() }
  }

  // ---------------------------------------------------------- create
  const newId = crypto.randomUUID()
  const { error: orderError } = await supabase.from('orders').insert({
    id: newId,
    business_id: businessId,
    order_date: getBusinessNow(timezone).isoDate,
    status: 'confirmed',
    ...fields,
  })
  if (orderError) return { error: orderError.message, nonce: 0 }

  const { error: itemsError } = await supabase.from('order_items').insert(itemRows(newId))
  if (itemsError) {
    await supabase.from('orders').delete().eq('id', newId).eq('business_id', businessId) // no half-created orders
    return { error: itemsError.message, nonce: 0 }
  }

  await supabase.from('business_activity_logs').insert({
    business_id: businessId,
    user_id: userId,
    action: 'order_created',
    entity_type: 'order',
    entity_id: newId,
    metadata: { total: order.totals.total },
  })
  revalidatePath('/orders', 'layout')
  revalidatePath('/today')
  redirect('/orders')
}

export interface IssueReceiptState {
  error: string | null
}

/**
 * Issue a receipt for a completed order: optionally record that the customer
 * has now paid in full, then assign the next receipt number (the database
 * function refuses orders that aren't completed, and never reissues a number).
 */
export async function issueReceipt(orderId: string, _prev: IssueReceiptState, formData: FormData): Promise<IssueReceiptState> {
  if (!UUID.test(orderId)) return { error: 'Invalid order.' }
  const method = String(formData.get('paymentMethod') ?? '')
  if (!isPaymentMethod(method)) return { error: 'Choose how the customer paid.' }
  const paidInFull = formData.get('paidInFull') === 'on'

  const ctx = await getActionContext()
  if (!ctx.ok) return { error: ctx.error }
  const { supabase, businessId, userId } = ctx

  const order = await getOrder(supabase, businessId, orderId)
  if (!order) return { error: 'That order could not be found.' }
  if (order.status !== 'completed') return { error: 'Complete the order before generating its receipt.' }

  if (paidInFull && order.balance > 0) {
    const { error } = await supabase
      .from('orders')
      .update({ deposit: order.total, payment_status: derivePaymentStatus(order.total, order.total) })
      .eq('id', orderId)
      .eq('business_id', businessId)
    if (error) return { error: error.message }
  }

  const { data: receiptNumber, error } = await supabase.rpc('issue_order_receipt', {
    p_order_id: orderId,
    p_payment_method: method,
  })
  if (error) return { error: error.message }

  await supabase.from('business_activity_logs').insert({
    business_id: businessId,
    user_id: userId,
    action: 'receipt_issued',
    entity_type: 'order',
    entity_id: orderId,
    metadata: { receipt_number: receiptNumber, payment_method: method },
  })

  revalidatePath('/orders', 'layout')
  redirect(`/receipt/${orderId}`)
}
