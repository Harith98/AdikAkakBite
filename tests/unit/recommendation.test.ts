import { describe, it, expect } from 'vitest'
import { getNextRecommendedTask, getOrderUrgency, isOverdueTask } from '@/lib/services/recommendation'
import { input, order, task } from './helpers'

const prodTask = (id: string, extra = {}) => task({ id, scheduleBlockId: 'b-prod', category: 'production', ...extra })

describe('getNextRecommendedTask — order priority', () => {
  it('recommends an order due within 3 hours over everything else', () => {
    const rec = getNextRecommendedTask(
      input({ time: '13:30', orders: [order({ id: 'o1', requiredTime: '15:00' })], tasks: [prodTask('t1', { status: 'in_progress' })] })
    )
    expect(rec.source).toBe('urgent_order')
    expect(rec.orderId).toBe('o1')
    expect(rec.taskId).toBeNull()
    expect(rec.reason).toContain('Customer orders always come first')
  })

  it('does not treat an order due much later today as urgent', () => {
    const rec = getNextRecommendedTask(
      input({ time: '11:42', orders: [order({ id: 'o1', requiredTime: '19:00' })], tasks: [prodTask('t1', { title: 'Prepare fillings' })] })
    )
    expect(rec.source).toBe('schedule_block')
    expect(rec.title).toBe('Prepare fillings')
  })

  it('treats an order past its due time as urgent and says so', () => {
    const rec = getNextRecommendedTask(input({ time: '16:30', orders: [order({ id: 'o1', requiredTime: '16:00' })] }))
    expect(rec.source).toBe('urgent_order')
    expect(rec.reason).toContain("isn't completed yet")
  })

  it('treats an order from a previous day as overdue', () => {
    const urgency = getOrderUrgency(order({ id: 'o1', requiredDate: '2026-09-27', requiredTime: null }), '2026-09-28', '11:00')
    expect(urgency.isUrgent).toBe(true)
    expect(urgency.isOverdue).toBe(true)
  })

  it('ignores completed and cancelled orders', () => {
    const rec = getNextRecommendedTask(
      input({
        time: '15:30',
        orders: [order({ id: 'o1', status: 'completed' }), order({ id: 'o2', status: 'cancelled' })],
      })
    )
    expect(rec.source).not.toBe('urgent_order')
  })

  it('ignores orders due on a later date and orders with no time today', () => {
    expect(getOrderUrgency(order({ id: 'a', requiredDate: '2026-09-29' }), '2026-09-28', '15:00').isUrgent).toBe(false)
    expect(getOrderUrgency(order({ id: 'b', requiredTime: null }), '2026-09-28', '15:00').isUrgent).toBe(false)
  })

  it('picks the overdue order first, then the earliest due', () => {
    const rec = getNextRecommendedTask(
      input({
        time: '15:00',
        orders: [order({ id: 'later', requiredTime: '16:00' }), order({ id: 'late', requiredTime: '14:00' }), order({ id: 'soon', requiredTime: '15:30' })],
      })
    )
    expect(rec.orderId).toBe('late')
  })

  it('says "Hand over" for a ready order', () => {
    const rec = getNextRecommendedTask(input({ time: '15:00', orders: [order({ id: 'o1', status: 'ready' })] }))
    expect(rec.title).toContain('Hand over')
  })

  it('handles an order with no customer name', () => {
    const rec = getNextRecommendedTask(input({ time: '15:00', orders: [order({ id: 'o1', customerName: null })] }))
    expect(rec.title).toContain('a customer')
  })
})

describe('getNextRecommendedTask — tasks', () => {
  it('recommends an overdue HIGH-priority task over the current block', () => {
    const rec = getNextRecommendedTask(
      input({
        tasks: [
          task({ id: 'old', title: 'Call supplier', priority: 2, category: 'administration', scheduledDate: '2026-09-27' }),
          prodTask('t1'),
        ],
      })
    )
    expect(rec.source).toBe('overdue_task')
    expect(rec.taskId).toBe('old')
  })

  it('does not jump to an overdue task that is only normal priority', () => {
    const rec = getNextRecommendedTask(
      input({ tasks: [task({ id: 'old', priority: 0, scheduledDate: '2026-09-27' }), prodTask('t1')] })
    )
    expect(rec.source).toBe('schedule_block')
    expect(rec.taskId).toBe('t1')
  })

  it('flags a high-priority task whose time today has passed as overdue', () => {
    expect(isOverdueTask(task({ id: 'x', scheduledTime: '11:00' }), '2026-09-28', '11:42')).toBe(true)
    expect(isOverdueTask(task({ id: 'x', scheduledTime: '12:00' }), '2026-09-28', '11:42')).toBe(false)
    expect(isOverdueTask(task({ id: 'x', status: 'completed', scheduledDate: '2026-09-01' }), '2026-09-28', '11:42')).toBe(false)
  })

  it('tells you to finish a task already in progress', () => {
    const rec = getNextRecommendedTask(input({ tasks: [prodTask('t1'), prodTask('t2', { status: 'in_progress', sortOrder: 5 })] }))
    expect(rec.source).toBe('in_progress_task')
    expect(rec.taskId).toBe('t2')
  })

  it('picks the first unfinished task in the current block and explains why', () => {
    const rec = getNextRecommendedTask(
      input({ tasks: [prodTask('a', { title: 'Prepare fillings', sortOrder: 2 }), prodTask('b', { title: 'Prepare ingredients', sortOrder: 1 })] })
    )
    expect(rec.title).toBe('Prepare ingredients')
    expect(rec.reason).toContain('Production')
    expect(rec.reason).toContain('11:30 AM')
  })

  it("prefers today's priority tasks inside the current block", () => {
    const rec = getNextRecommendedTask(
      input({ tasks: [prodTask('a', { sortOrder: 1 }), prodTask('b', { sortOrder: 2, dailyPriorityRank: 1 })] })
    )
    expect(rec.taskId).toBe('b')
    expect(rec.reason).toContain('priority #1')
  })

  it('skips completed and skipped tasks', () => {
    const rec = getNextRecommendedTask(
      input({ tasks: [prodTask('a', { status: 'completed' }), prodTask('b', { status: 'skipped' }), prodTask('c', { sortOrder: 3 })] })
    )
    expect(rec.taskId).toBe('c')
  })

  it('offers paused tasks after not-started ones', () => {
    const rec = getNextRecommendedTask(input({ tasks: [prodTask('p', { status: 'paused', sortOrder: 0 }), prodTask('n', { sortOrder: 5 })] }))
    expect(rec.taskId).toBe('n')
  })

  it('reports an empty block (Break) instead of inventing work', () => {
    const rec = getNextRecommendedTask(
      input({ time: '14:10', inventoryAlerts: [{ id: 'i', name: 'Chocolate', currentQuantity: 1, unit: 'kg', reorderLevel: 2 }] })
    )
    expect(rec.source).toBe('schedule_block')
    expect(rec.title).toBe('Break')
    expect(rec.taskId).toBeNull()
  })
})

describe('getNextRecommendedTask — fall-through rules', () => {
  const allDoneInBlock = [prodTask('a', { status: 'completed' })]

  it("continues an unfinished priority once the block is done", () => {
    const rec = getNextRecommendedTask(
      input({ tasks: [...allDoneInBlock, task({ id: 'p1', title: 'Complete 10 brownie boxes', dailyPriorityRank: 1, category: 'business' })] })
    )
    expect(rec.source).toBe('daily_priority')
    expect(rec.reason).toContain('Production')
  })

  it('recommends a reorder when the block is done and stock is low', () => {
    const rec = getNextRecommendedTask(
      input({ tasks: allDoneInBlock, inventoryAlerts: [{ id: 'i', name: 'Chocolate', currentQuantity: 1, unit: 'kg', reorderLevel: 2 }] })
    )
    expect(rec.source).toBe('inventory_alert')
    expect(rec.title).toBe('Reorder Chocolate')
  })

  it('reorders the item that is furthest below its level first', () => {
    const rec = getNextRecommendedTask(
      input({
        tasks: allDoneInBlock,
        inventoryAlerts: [
          { id: 'a', name: 'Cream', currentQuantity: 2, unit: 'kg', reorderLevel: 3 },
          { id: 'b', name: 'Boxes', currentQuantity: 0, unit: 'pcs', reorderLevel: 30 },
        ],
      })
    )
    expect(rec.title).toBe('Reorder Boxes')
  })

  it('points to the next block when nothing is happening right now', () => {
    const rec = getNextRecommendedTask(input({ time: '10:15' }))
    expect(rec.source).toBe('next_scheduled')
    expect(rec.reason).toContain('11:00 AM')
  })

  it('says the plan is complete after the last block', () => {
    const rec = getNextRecommendedTask(input({ time: '21:00' }))
    expect(rec.source).toBe('all_done')
  })

  it('asks for a schedule when there are no blocks at all', () => {
    const rec = getNextRecommendedTask(input({ blocks: [] }))
    expect(rec.source).toBe('all_done')
    expect(rec.title).toContain('schedule')
  })

  it('works for a brand new business with no data at all', () => {
    expect(() => getNextRecommendedTask(input({ blocks: [], tasks: [], orders: [], inventoryAlerts: [] }))).not.toThrow()
  })

  it('does not mutate its input (normal tasks are never lost)', () => {
    const tasks = [prodTask('a'), prodTask('b')]
    const snapshot = JSON.stringify(tasks)
    getNextRecommendedTask(input({ time: '15:00', tasks, orders: [order({ id: 'o1' })] }))
    expect(JSON.stringify(tasks)).toBe(snapshot)
  })
})
