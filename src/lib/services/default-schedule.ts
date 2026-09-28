import type { Database } from '@/lib/supabase/database.types'

type ScheduleBlockInsert = Database['public']['Tables']['schedule_blocks']['Insert']

/**
 * The default recurring daily schedule from spec §8. Inserted once for a
 * new business during onboarding; every row is editable afterwards from
 * Settings, and the business can add, remove or reorder blocks freely — this
 * is only a sensible starting point, not a fixed structure.
 */
export function buildDefaultScheduleBlocks(businessId: string): ScheduleBlockInsert[] {
  const blocks: Omit<ScheduleBlockInsert, 'business_id' | 'sort_order'>[] = [
    {
      title: 'Opening & Planning',
      category: 'business',
      start_time: '11:00',
      end_time: '11:30',
      default_tasks: [
        'Clean workspace',
        "Check today's orders",
        'Check ingredients',
        'Check packaging',
        'Review urgent tasks',
        'Choose three priorities',
      ],
    },
    {
      title: 'Production',
      category: 'production',
      start_time: '11:30',
      end_time: '13:00',
      default_tasks: [
        'Prepare ingredients',
        'Prepare fillings',
        'Prepare toppings',
        'Prepare packaging',
        'Prepare stock',
        'Fulfil scheduled orders',
      ],
    },
    {
      title: 'Content Creation',
      category: 'content',
      start_time: '13:00',
      end_time: '14:00',
      default_tasks: [
        'Product photography',
        'Short videos',
        'Behind-the-scenes videos',
        'Editing',
        'Social media posting',
      ],
    },
    {
      title: 'Break',
      category: 'business',
      start_time: '14:00',
      end_time: '14:30',
      default_tasks: [],
    },
    {
      title: 'Marketing',
      category: 'marketing',
      start_time: '14:30',
      end_time: '15:30',
      default_tasks: [
        'Reply to comments',
        'Reply to messages',
        'Research trends',
        'Research competitors',
        'Plan content',
        'Customer follow-ups',
      ],
    },
    {
      title: 'Production / Product Development',
      category: 'product_development',
      start_time: '15:30',
      end_time: '17:00',
      default_tasks: [
        'Continue production',
        'Test recipes',
        'Test flavours',
        'Improve presentation',
        'Improve packaging',
        'Develop products',
      ],
    },
    {
      title: 'Inventory & Operations',
      category: 'inventory',
      start_time: '17:00',
      end_time: '17:30',
      default_tasks: [
        'Check ingredients',
        'Check packaging',
        'Check expiry dates',
        'Check low-stock items',
        'Update inventory',
        'Prepare purchase list',
      ],
    },
    {
      title: 'Sales & Customer Growth',
      category: 'sales',
      start_time: '17:30',
      end_time: '18:30',
      default_tasks: [
        'Follow up previous customers',
        'Prepare promotions',
        'Review potential repeat customers',
        'Prepare offers',
        'Improve customer retention',
      ],
    },
    {
      title: 'Business Improvement',
      category: 'business',
      start_time: '18:30',
      end_time: '19:15',
      default_tasks: [
        "Review today's sales",
        'Review product performance',
        'Review product costs',
        'Review pricing',
        'Identify one improvement',
        'Plan tomorrow',
      ],
    },
    {
      title: 'Closing',
      category: 'business',
      start_time: '19:15',
      end_time: '20:00',
      default_tasks: [
        'Clean workspace',
        'Organize stock',
        'Record sales',
        'Record waste',
        'Review unfinished tasks',
        'Prepare tomorrow',
      ],
    },
  ]

  return blocks.map((block, index) => ({
    ...block,
    business_id: businessId,
    sort_order: index,
  }))
}
