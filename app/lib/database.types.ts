// Generated from the live Supabase schema (project szzhsmodfbnrtcpxgwan).
// Source of truth for DB row/insert/update shapes. Regenerate with the Supabase
// CLI/MCP after schema changes:  supabase gen types typescript
//
// app/models/index.ts holds the app-facing interfaces (with embedded relations);
// keep it consistent with the Row types below.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      apartments: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          name_ko: string
          sort_order: number | null
        }
      }
      categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          name_ko: string
          sort_order: number | null
        }
      }
      notice_limits: {
        Row: {
          created_at: string
          id: string
          max_quantity: number
          notice_id: string
          product_id: string | null
          type: string
        }
      }
      notice_products: {
        Row: {
          notice_id: string
          product_id: string
        }
      }
      notices: {
        Row: {
          created_at: string
          delivery_date: string | null
          end_at: string | null
          id: string
          is_all_products: boolean
          message: string
          start_at: string
          status: string
          title: string
          updated_at: string
        }
      }
      order_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          changed_fields: Json
          id: string
          order_id: string | null
        }
      }
      order_items: {
        Row: {
          id: string
          order_id: string | null
          product_id: string | null
          quantity: number
          subtotal: number
          unit_price: number
        }
      }
      orders: {
        Row: {
          admin_notes: string | null
          apartment: string
          apartment_id: string | null
          cancelled_at: string | null
          cancelled_reason: string | null
          created_at: string
          customer_name: string
          delivery_date: string
          delivery_fee: number | null
          edit_token: string | null
          entry_channel: string | null
          flat_number: string
          id: string
          is_locked: boolean | null
          notes: string | null
          order_number: string
          original_order_id: string | null
          payment_method: string
          phone: string
          status: string | null
          subtotal: number | null
          total_amount: number
          tower: string
          updated_at: string
        }
      }
      products: {
        Row: {
          category: string | null
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          name_ko: string | null
          price: number
          sort_order: number | null
          updated_at: string
        }
      }
      sync_failures: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          order_id: string | null
          resolved: boolean | null
          retried_at: string | null
        }
      }
    }
  }
}

type PublicTables = Database["public"]["Tables"]
export type Row<T extends keyof PublicTables> = PublicTables[T]["Row"]
