import { formatCurrency } from "~/utils/format";

interface OrderPriceSummaryProps {
    subtotal: number;
    deliveryFee: number;
    total: number;
    subtotalLabel?: string;
    totalLabel?: string;
}

export function OrderPriceSummary({
    subtotal,
    deliveryFee,
    total,
    subtotalLabel = "Subtotal (선택 합계)",
    totalLabel = "Estimated total"
}: OrderPriceSummaryProps) {
    return (
        <div className="border-t-2 border-brand-primary/10 pt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
                <span className="text-brand-charcoal/60 font-medium">{subtotalLabel}</span>
                <span className="font-bold text-brand-charcoal">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
                <span className="text-brand-charcoal/60 font-medium">Delivery fee (₹500+ free)</span>
                <span className={deliveryFee ? "font-bold text-brand-charcoal" : "text-brand-charcoal/60 font-medium"}>
                    {deliveryFee ? formatCurrency(deliveryFee) : "Free"}
                </span>
            </div>
            <div className="flex items-center justify-between text-lg font-black text-brand-primary pt-2 border-t border-brand-charcoal/10">
                <span>{totalLabel}</span>
                <span>{formatCurrency(total)}</span>
            </div>
        </div>
    );
}
