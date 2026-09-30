// This file mirrors supabase/migrations/*.sql by hand for Phase 1.
// Once your Supabase project is live, regenerate it from the real schema with:
//   npm run db:types
// and this file will be overwritten with a generated (and guaranteed
// accurate) version. Keeping a hand-written version in the meantime means
// the rest of the app gets real type-checking from day one.

export type BusinessMemberRole = 'owner' | 'admin' | 'staff'

export type TaskStatus = 'not_started' | 'in_progress' | 'paused' | 'completed' | 'skipped'
export type TaskCategory =
  | 'orders'
  | 'production'
  | 'marketing'
  | 'content'
  | 'sales'
  | 'customers'
  | 'inventory'
  | 'product_development'
  | 'business'
  | 'cleaning'
  | 'administration'
export type TaskSource = 'manual' | 'schedule' | 'system_recommendation'

export type OrderStatus = 'new' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled'
export type PaymentStatus = 'unpaid' | 'deposit_paid' | 'fully_paid'
export type PaymentMethod = 'cash' | 'bank_transfer' | 'duitnow_qr' | 'card' | 'ewallet' | 'other'

export type InventoryStatus = 'ok' | 'low' | 'reorder' | 'out_of_stock'
export type InventoryTransactionType = 'purchase' | 'usage' | 'waste' | 'adjustment'

export type ContentPlatform = 'instagram' | 'tiktok' | 'facebook' | 'whatsapp' | 'other'
export type ContentType =
  | 'product_photo'
  | 'reel'
  | 'tiktok'
  | 'behind_the_scenes'
  | 'customer_review'
  | 'educational'
  | 'promotion'
  | 'story'
export type ContentStatus = 'idea' | 'planned' | 'filming' | 'editing' | 'ready' | 'posted'

export type GoalMetric =
  | 'weekly_revenue'
  | 'monthly_revenue'
  | 'orders'
  | 'new_customers'
  | 'repeat_customers'
  | 'content_posts'
  | 'new_products'
  | 'waste_reduction'
export type GoalStatus = 'on_track' | 'behind' | 'achieved' | 'missed' | 'not_started'

export interface Database {
  public: {
    Tables: {
      businesses: {
        Row: {
          id: string
          name: string
          owner_name: string | null
          phone: string | null
          email: string | null
          address: string | null
          registration_number: string | null
          receipt_footer: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          owner_name?: string | null
          phone?: string | null
          email?: string | null
          address?: string | null
          registration_number?: string | null
          receipt_footer?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['businesses']['Insert']>
        Relationships: []
      }
      business_members: {
        Row: {
          id: string
          business_id: string
          user_id: string
          role: BusinessMemberRole
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          user_id: string
          role?: BusinessMemberRole
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['business_members']['Insert']>
        Relationships: []
      }
      business_settings: {
        Row: {
          business_id: string
          currency: string
          timezone: string
          working_hours_start: string
          working_hours_end: string
          working_days: number[]
          notification_preferences: Record<string, unknown>
          forecast_settings: Record<string, unknown>
          onboarding_completed: boolean
          onboarding_step: number
          created_at: string
          updated_at: string
        }
        Insert: {
          business_id: string
          currency?: string
          timezone?: string
          working_hours_start?: string
          working_hours_end?: string
          working_days?: number[]
          notification_preferences?: Record<string, unknown>
          forecast_settings?: Record<string, unknown>
          onboarding_completed?: boolean
          onboarding_step?: number
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['business_settings']['Insert']>
        Relationships: []
      }
      schedule_blocks: {
        Row: {
          id: string
          business_id: string
          title: string
          category: TaskCategory
          start_time: string
          end_time: string
          default_tasks: string[]
          sort_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          title: string
          category: TaskCategory
          start_time: string
          end_time: string
          default_tasks?: string[]
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['schedule_blocks']['Insert']>
        Relationships: []
      }
      tasks: {
        Row: {
          id: string
          business_id: string
          title: string
          description: string | null
          category: TaskCategory
          priority: number
          estimated_duration_minutes: number | null
          scheduled_date: string | null
          scheduled_time: string | null
          status: TaskStatus
          is_recurring: boolean
          source: TaskSource
          schedule_block_id: string | null
          order_id: string | null
          daily_priority_rank: number | null
          sort_order: number
          notes: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          title: string
          description?: string | null
          category: TaskCategory
          priority?: number
          estimated_duration_minutes?: number | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          status?: TaskStatus
          is_recurring?: boolean
          source?: TaskSource
          schedule_block_id?: string | null
          order_id?: string | null
          daily_priority_rank?: number | null
          sort_order?: number
          notes?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['tasks']['Insert']>
        Relationships: []
      }
      customers: {
        Row: {
          id: string
          business_id: string
          name: string
          phone: string | null
          email: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          name: string
          phone?: string | null
          email?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['customers']['Insert']>
        Relationships: []
      }
      products: {
        Row: {
          id: string
          business_id: string
          name: string
          category: string | null
          description: string | null
          selling_price: number
          image_url: string | null
          is_active: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          name: string
          category?: string | null
          description?: string | null
          selling_price?: number
          image_url?: string | null
          is_active?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['products']['Insert']>
        Relationships: []
      }
      product_costs: {
        Row: {
          id: string
          product_id: string
          ingredient_cost: number
          packaging_cost: number
          other_cost: number
          effective_from: string
          effective_to: string | null
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          ingredient_cost?: number
          packaging_cost?: number
          other_cost?: number
          effective_from?: string
          effective_to?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['product_costs']['Insert']>
        Relationships: []
      }
      orders: {
        Row: {
          id: string
          business_id: string
          customer_id: string | null
          order_date: string
          required_date: string | null
          required_time: string | null
          discount: number
          delivery_fee: number
          deposit: number
          payment_status: PaymentStatus
          status: OrderStatus
          notes: string | null
          receipt_number: number | null
          receipt_issued_at: string | null
          payment_method: PaymentMethod | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          customer_id?: string | null
          order_date?: string
          required_date?: string | null
          required_time?: string | null
          discount?: number
          delivery_fee?: number
          deposit?: number
          payment_status?: PaymentStatus
          status?: OrderStatus
          notes?: string | null
          receipt_number?: number | null
          receipt_issued_at?: string | null
          payment_method?: PaymentMethod | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['orders']['Insert']>
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          unit_price: number
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          product_id?: string | null
          product_name: string
          quantity: number
          unit_price: number
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['order_items']['Insert']>
        Relationships: []
      }
      sales: {
        Row: {
          id: string
          business_id: string
          sale_date: string
          revenue: number
          order_count: number
          discounts: number
          delivery_fees: number
          waste_value: number
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          sale_date: string
          revenue?: number
          order_count?: number
          discounts?: number
          delivery_fees?: number
          waste_value?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['sales']['Insert']>
        Relationships: []
      }
      inventory_items: {
        Row: {
          id: string
          business_id: string
          name: string
          category: string | null
          current_quantity: number
          unit: string
          reorder_level: number
          unit_cost: number
          supplier: string | null
          expiry_date: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          name: string
          category?: string | null
          current_quantity?: number
          unit: string
          reorder_level?: number
          unit_cost?: number
          supplier?: string | null
          expiry_date?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['inventory_items']['Insert']>
        Relationships: []
      }
      inventory_transactions: {
        Row: {
          id: string
          business_id: string
          inventory_item_id: string
          quantity: number
          unit: string
          transaction_type: InventoryTransactionType
          transaction_date: string
          reference: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          inventory_item_id: string
          quantity: number
          unit: string
          transaction_type: InventoryTransactionType
          transaction_date?: string
          reference?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['inventory_transactions']['Insert']>
        Relationships: []
      }
      content_items: {
        Row: {
          id: string
          business_id: string
          content_date: string
          platform: ContentPlatform
          content_type: ContentType
          product_id: string | null
          idea: string | null
          caption: string | null
          status: ContentStatus
          published_url: string | null
          views: number
          likes: number
          comments: number
          shares: number
          saves: number
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          content_date?: string
          platform: ContentPlatform
          content_type: ContentType
          product_id?: string | null
          idea?: string | null
          caption?: string | null
          status?: ContentStatus
          published_url?: string | null
          views?: number
          likes?: number
          comments?: number
          shares?: number
          saves?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['content_items']['Insert']>
        Relationships: []
      }
      goals: {
        Row: {
          id: string
          business_id: string
          name: string
          metric: GoalMetric
          target: number
          start_date: string
          end_date: string
          status: GoalStatus
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          name: string
          metric: GoalMetric
          target: number
          start_date: string
          end_date: string
          status?: GoalStatus
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['goals']['Insert']>
        Relationships: []
      }
      daily_reviews: {
        Row: {
          id: string
          business_id: string
          review_date: string
          revenue: number | null
          orders_count: number | null
          waste_value: number | null
          unfinished_tasks_note: string | null
          tomorrow_prep_note: string | null
          improvement_note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          review_date: string
          revenue?: number | null
          orders_count?: number | null
          waste_value?: number | null
          unfinished_tasks_note?: string | null
          tomorrow_prep_note?: string | null
          improvement_note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['daily_reviews']['Insert']>
        Relationships: []
      }
      business_activity_logs: {
        Row: {
          id: string
          business_id: string
          user_id: string | null
          action: string
          entity_type: string | null
          entity_id: string | null
          metadata: Record<string, unknown>
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          user_id?: string | null
          action: string
          entity_type?: string | null
          entity_id?: string | null
          metadata?: Record<string, unknown>
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['business_activity_logs']['Insert']>
        Relationships: []
      }
      business_invitations: {
        Row: {
          id: string
          business_id: string
          email: string
          role: BusinessMemberRole
          token: string
          invited_by: string | null
          expires_at: string
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          email: string
          role?: BusinessMemberRole
          token?: string
          invited_by?: string | null
          expires_at?: string
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['business_invitations']['Insert']>
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      get_invitation: {
        Args: { p_token: string }
        Returns: {
          business_name: string
          email: string
          role: BusinessMemberRole
          status: 'pending' | 'accepted' | 'expired'
        }[]
      }
      accept_business_invitation: {
        Args: { p_token: string }
        Returns: string
      }
      issue_order_receipt: {
        Args: { p_order_id: string; p_payment_method: PaymentMethod | null }
        Returns: number
      }
      transfer_business_ownership: {
        Args: { p_member_id: string }
        Returns: null
      }
      get_business_members: {
        Args: { p_business_id: string }
        Returns: {
          member_id: string
          user_id: string
          email: string
          role: BusinessMemberRole
          joined_at: string
        }[]
      }
      record_inventory_transaction: {
        Args: {
          p_business_id: string
          p_inventory_item_id: string
          p_quantity: number
          p_unit: string
          p_transaction_type: InventoryTransactionType
          p_transaction_date: string
          p_reference: string | null
          p_notes: string | null
        }
        Returns: Database['public']['Tables']['inventory_items']['Row']
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
