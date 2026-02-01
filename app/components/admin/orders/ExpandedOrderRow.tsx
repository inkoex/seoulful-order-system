import { type Order } from "@/lib/tableUtils";

interface ExpandedOrderRowProps {
  order: Order;
}

/**
 * Component to display expanded order details
 *
 * Shows:
 * - Detailed list of order items (product name x quantity)
 * - Customer notes (if present) in a highlighted box
 */
export function ExpandedOrderRow({ order }: ExpandedOrderRowProps) {
  return (
    <div className="py-4 px-2">
      <h4 className="text-sm font-semibold mb-2">상세 주문 내역</h4>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {order.order_items
          ?.map((item) => {
            const name = item.products?.name_ko || item.products?.name || "상품";
            return `${name} x ${item.quantity}`;
          })
          .join(", ") || "주문 내역 없음"}
      </p>

      {order.notes && (
        <div className="mt-4 p-3 rounded bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-900/50">
          <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-400 mb-1">
            고객 메모
          </p>
          <p className="text-sm">{order.notes}</p>
        </div>
      )}
    </div>
  );
}
