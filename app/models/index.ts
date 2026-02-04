export interface Category {
    id: string;
    name: string;
    name_ko: string;
    sort_order: number;
    created_at?: string;
}

export interface Product {
    id: string;
    category_id: string;
    name: string;
    name_ko: string;
    description?: string;
    price: number;
    is_active: boolean;
    image_url?: string;
    sort_order: number;
    created_at?: string;
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

export interface Order {
    id: string;
    order_number: string;
    customer_name: string;
    phone: string;
    apartment_id: string;
    apartment?: string; // Legacy/Display name
    tower: string;
    flat_number: string;
    delivery_date: string;
    payment_method: 'upi' | 'cash' | 'other';
    notes?: string;
    status: 'received' | 'ready' | 'delivered' | 'paid' | 'cancelled';
    total_amount: number;
    is_locked: boolean;
    edit_token: string;
    entry_channel: string;
    created_at: string;
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
