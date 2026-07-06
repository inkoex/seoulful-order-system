/**
 * 주문 금액 관련 정책을 관리하는 유틸리티입니다.
 */

// Minimal shape needed to compute totals. See app/models/index.ts for the full
// OrderItem; this intentionally accepts just the pricing-relevant fields.
export interface OrderTotalsItem {
    quantity: number;
    unit_price?: number;
    subtotal?: number;
}

export interface OrderTotals {
    subtotal: number;
    deliveryFee: number;
    total: number;
}

/**
 * 상품 목록을 기반으로 소계, 배송비, 총액을 계산합니다.
 * 배송비 정책: 500루피 미만 주문 시 30루피 부과, 그 이상은 무료.
 */
export function calculateOrderTotals(items: OrderTotalsItem[]): OrderTotals {
    const subtotal = items.reduce((acc, item) => {
        const itemSubtotal = Number(item.subtotal);
        if (!isNaN(itemSubtotal) && itemSubtotal > 0) return acc + itemSubtotal;

        const unitPrice = Number(item.unit_price) || 0;
        const quantity = Number(item.quantity) || 0;
        return acc + (unitPrice * quantity);
    }, 0);

    // 배송비 정책: 0원 초과 500원 미만일 때 30원
    const deliveryFee = (subtotal > 0 && subtotal < 500) ? 30 : 0;
    const total = subtotal + deliveryFee;

    return { subtotal, deliveryFee, total };
}
