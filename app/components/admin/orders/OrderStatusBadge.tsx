import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type OrderStatus = "received" | "ready" | "delivered" | "paid" | "cancelled";

interface OrderStatusBadgeProps {
    status: OrderStatus | string;
    className?: string;
    isLocked?: boolean;
}

export const STATUS_CONFIG: Record<
    OrderStatus,
    { label: string; className: string; iconColor: string }
> = {
    received: {
        label: "접수됨",
        className: "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100/80",
        iconColor: "text-amber-500",
    },
    ready: {
        label: "생산 완료",
        className: "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100/80",
        iconColor: "text-blue-500",
    },
    delivered: {
        label: "배달 완료",
        className: "bg-green-100 text-green-700 border-green-200 hover:bg-green-100/80",
        iconColor: "text-green-500",
    },
    paid: {
        label: "지불 완료",
        className: "bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100/80",
        iconColor: "text-emerald-600",
    },
    cancelled: {
        label: "취소됨",
        className: "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-100/80",
        iconColor: "text-slate-400",
    },
};

export function OrderStatusBadge({ status, className, isLocked }: OrderStatusBadgeProps) {
    const config = STATUS_CONFIG[status as OrderStatus] || {
        label: status,
        className: "bg-slate-100 text-slate-600",
        iconColor: "text-slate-400",
    };

    return (
        <div className={cn("inline-flex items-center", className)}>
            <Badge
                variant="outline"
                className={cn(
                    "font-semibold pl-2 pr-5 py-0.5 rounded-md border text-[11px] uppercase tracking-wide flex items-center justify-center min-w-[84px]",
                    config.className
                )}
            >
                <span className={cn("mr-1.5 h-1.5 w-1.5 rounded-full fill-current shrink-0", config.iconColor)} />
                <span className="leading-none">{config.label}</span>
            </Badge>
            {isLocked && (
                <Badge variant="outline" className="px-1 py-0.5 border-amber-200 bg-amber-50 text-amber-600">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                </Badge>
            )}
        </div>
    );
}
