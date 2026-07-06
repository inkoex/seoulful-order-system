// App-facing domain types. Keep consistent with the live DB schema in
// app/lib/database.types.ts (the generated source of truth).

export interface Category {
    id: string;
    name: string;
    name_ko: string;
    is_active?: boolean | null;
    sort_order: number;
    created_at?: string;
}

export interface Product {
    id: string;
    category_id?: string | null;
    category?: string | null; // legacy free-text category, retained for back-compat
    name: string;
    name_ko: string;
    description?: string;
    price: number;
    is_active: boolean;
    image_url?: string;
    sort_order: number;
    created_at?: string;
    updated_at?: string;
    categories?: Partial<Category>;
}

export interface Apartment {
    id: string;
    name: string;
    name_ko: string;
    is_active: boolean;
    sort_order: number;
    created_at?: string;
}

export interface OrderItem {
    id?: string;
    order_id?: string;
    product_id: string;
    quantity: number;
    unit_price?: number;
    subtotal?: number;
    products?: Partial<Product>;
}

export type OrderStatus = 'received' | 'ready' | 'delivered' | 'paid' | 'cancelled';

export interface Order {
    id: string;
    order_number: string;
    customer_name: string;
    phone: string;
    apartment_id?: string | null; // nullable in DB (legacy rows predate the column)
    apartment?: string; // Legacy/Display name
    tower: string;
    flat_number: string;
    delivery_date: string;
    payment_method: 'upi' | 'cash' | 'other';
    notes?: string | null;
    admin_notes?: string | null;
    status: OrderStatus;
    subtotal?: number | null;
    delivery_fee?: number | null;
    total_amount: number;
    is_locked: boolean;
    edit_token: string;
    entry_channel: string;
    original_order_id?: string | null;
    created_at: string;
    updated_at?: string;
    cancelled_at?: string;
    cancelled_reason?: string;
    order_items: OrderItem[];
    apartments?: Partial<Apartment>;
}

export interface OrderTableSettings {
    columnVisibility: Record<string, boolean>;
    columnOrder: string[];
    columnSizing: Record<string, number>;
    sorting: Array<{ id: string; desc: boolean }>;
}
