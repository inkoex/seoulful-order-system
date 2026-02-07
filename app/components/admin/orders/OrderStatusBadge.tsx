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
    { label: string; className: string; dotColor: string }
> = {
    received: {
        label: "접수됨",
        className: "bg-amber-50/50 text-amber-700 border-amber-200/50 hover:bg-amber-50/80",
        dotColor: "bg-amber-400",
    },
    ready: {
        label: "생산 완료",
        className: "bg-blue-50/50 text-blue-700 border-blue-200/50 hover:bg-blue-50/80",
        dotColor: "bg-blue-400",
    },
    delivered: {
        label: "배달 완료",
        className: "bg-green-50/50 text-green-700 border-green-200/50 hover:bg-green-50/80",
        dotColor: "bg-green-400",
    },
    paid: {
        label: "지불 완료",
        className: "bg-emerald-50/50 text-emerald-800 border-emerald-200/50 hover:bg-emerald-50/80",
        dotColor: "bg-emerald-500",
    },
    cancelled: {
        label: "취소됨",
        className: "bg-slate-50/50 text-slate-500 border-slate-200/50 hover:bg-slate-50/80",
        dotColor: "bg-slate-300",
    },
};

export function OrderStatusBadge({ status, className, isLocked }: OrderStatusBadgeProps) {
    const config = STATUS_CONFIG[status as OrderStatus] || {
        label: status,
        className: "bg-slate-100 text-slate-600",
        iconColor: "text-slate-400",
    };

    return (
        <div className={cn("inline-flex items-center gap-1.5", className)}>
            <Badge
                variant="outline"
                className={cn(
                    "font-bold pl-2.5 pr-4 py-1 rounded-full border shadow-sm text-[10px] uppercase tracking-wider flex items-center justify-center min-w-[80px] transition-all duration-300",
                    config.className
                )}
            >
                <span className={cn("mr-2 h-1.5 w-1.5 rounded-full shrink-0 shadow-sm", config.dotColor)} />
                <span className="leading-none">{config.label}</span>
            </Badge>
            {isLocked && (
                <div className="flex items-center justify-center h-6 w-6 rounded-full border border-amber-200 bg-amber-50 text-amber-600 shadow-sm">
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
                </div>
            )}
        </div>
    );
}
