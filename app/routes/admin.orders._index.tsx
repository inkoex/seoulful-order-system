import React, { useState } from "react";
import { Link, useLoaderData, useActionData, useSubmit, data, redirect } from "react-router";
import { format, parseISO } from "date-fns";
import { Eye, Lock, Unlock, XCircle, Plus, Filter, CalendarIcon, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth.server";
import { supabaseAdmin } from "@/lib/supabase.server";
import { PageContainer } from "@/components/ui/container";
import type { Route } from "./+types/admin.orders._index";

export async function loader({ request }: Route.LoaderArgs) {
    await requireAuth(request);

    const url = new URL(request.url);
    const statusFilter = url.searchParams.get("status") || "all";
    const deliveryDateFilter = url.searchParams.get("delivery_date");

    // Build query
    let query = supabaseAdmin
        .from('orders')
        .select(`
            *,
            order_items (
                quantity,
                product_id,
                products (
                    name_ko,
                    name
                )
            )
        `)
        .order('created_at', { ascending: false });

    if (statusFilter !== "all") {
        query = query.eq('status', statusFilter);
    }

    if (deliveryDateFilter) {
        query = query.eq('delivery_date', deliveryDateFilter);
    }

    const { data: orders, error } = await query;

    if (error) {
        throw new Error('주문 목록을 불러오는데 실패했습니다');
    }

    return data({ orders: orders || [], statusFilter, deliveryDateFilter });
}

export async function action({ request }: Route.ActionArgs) {
    await requireAuth(request);

    const formData = await request.formData();
    const intent = formData.get("intent");
    const orderId = formData.get("orderId");

    if (!orderId) {
        return data({ error: "주문 ID가 없습니다" }, { status: 400 });
    }

    if (intent === "toggle_lock") {
        // Toggle lock status
        const { data: order } = await supabaseAdmin
            .from('orders')
            .select('is_locked')
            .eq('id', orderId)
            .single();

        if (order) {
            await supabaseAdmin
                .from('orders')
                .update({ is_locked: !order.is_locked })
                .eq('id', orderId);
        }
    } else if (intent === "change_status") {
        const newStatus = formData.get("status");
        await supabaseAdmin
            .from('orders')
            .update({ status: newStatus })
            .eq('id', orderId);
    } else if (intent === "cancel") {
        await supabaseAdmin
            .from('orders')
            .update({
                status: 'cancelled',
                cancelled_at: new Date().toISOString(),
                cancelled_reason: 'Admin cancelled'
            })
            .eq('id', orderId);
    } else if (intent === "restore") {
        await supabaseAdmin
            .from('orders')
            .update({
                status: 'received',
                cancelled_at: null,
                cancelled_reason: null
            })
            .eq('id', orderId);
    }

    return data({ success: true });
}

export default function AdminOrdersPage() {
    const { orders, statusFilter, deliveryDateFilter } = useLoaderData<typeof loader>();
    const submit = useSubmit();
    const selectedDate = deliveryDateFilter ? parseISO(deliveryDateFilter) : undefined;
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const statusOptions = [
        { value: "received", label: "접수됨" },
        { value: "ready", label: "생산 완료" },
        { value: "delivered", label: "배달 완료" },
        { value: "paid", label: "지불 완료" },
        { value: "cancelled", label: "취소됨" },
    ];
    const statusStyles: Record<string, { label: string; className?: string; variant?: "default" | "secondary" | "outline" }> = {
        received: { label: "접수됨", className: "bg-yellow-600" },
        ready: { label: "생산 완료", className: "bg-blue-600" },
        delivered: { label: "배달 완료", className: "bg-green-600" },
        paid: { label: "지불 완료", className: "bg-emerald-700" },
        cancelled: { label: "취소됨", variant: "secondary" },
    };

    function handleStatusFilter(value: string) {
        const url = new URL(window.location.href);
        if (value === "all") {
            url.searchParams.delete("status");
        } else {
            url.searchParams.set("status", value);
        }
        window.location.href = url.toString();
    }

    function handleDateFilter(date?: Date) {
        const url = new URL(window.location.href);
        if (!date) {
            url.searchParams.delete("delivery_date");
        } else {
            url.searchParams.set("delivery_date", format(date, "yyyy-MM-dd"));
        }
        window.location.href = url.toString();
    }

    function handleAction(intent: string, orderId: string, additionalData?: Record<string, string>) {
        const formData = new FormData();
        formData.append("intent", intent);
        formData.append("orderId", orderId);
        if (additionalData) {
            Object.entries(additionalData).forEach(([key, value]) => {
                formData.append(key, value);
            });
        }
        submit(formData, { method: "post" });
    }

    function toggleRow(orderId: string) {
        setExpandedRows((prev) => {
            const next = new Set(prev);
            if (next.has(orderId)) {
                next.delete(orderId);
            } else {
                next.add(orderId);
            }
            return next;
        });
    }

    function getOrderSummary(order: any) {
        const items = order.order_items || [];
        if (items.length === 0) return "주문 없음";

        const firstItem = items[0];
        const firstName = firstItem.products?.name_ko || firstItem.products?.name || "상품";

        if (items.length === 1) {
            return `${firstName} x ${firstItem.quantity}`;
        }

        return `${firstName} x ${firstItem.quantity} 외 ${items.length - 1}건`;
    }

    function getOrderItemLines(order: any) {
        const items = order.order_items || [];
        if (items.length === 0) {
            return ["주문 없음"];
        }

        return items.map((item: any) => {
            const name = item.products?.name_ko || item.products?.name || "상품";
            return `${name} x ${item.quantity}`;
        });
    }

    return (
        <PageContainer size="wide">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold">주문 관리</h1>
                    <p className="text-muted-foreground mt-1">모든 주문 내역</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                    <Button asChild variant="outline" className="w-full sm:w-auto">
                        <Link to="/admin/dashboard">대시보드로</Link>
                    </Button>
                    <Button asChild className="w-full sm:w-auto">
                        <Link to="/admin/orders/new">
                            <Plus className="mr-2 h-4 w-4" />
                            WhatsApp 주문 입력
                        </Link>
                    </Button>
                </div>
            </div>

            <Card className="mb-6">
                <CardHeader>
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <CardTitle>필터</CardTitle>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <div className="flex items-center gap-2">
                                <Filter className="h-4 w-4 text-muted-foreground" />
                                <Select value={statusFilter} onValueChange={handleStatusFilter}>
                                    <SelectTrigger className="w-full sm:w-[180px]">
                                        <SelectValue placeholder="상태 선택" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">전체</SelectItem>
                                        <SelectItem value="received">접수됨</SelectItem>
                                        <SelectItem value="ready">생산 완료</SelectItem>
                                        <SelectItem value="delivered">배달 완료</SelectItem>
                                        <SelectItem value="paid">지불 완료</SelectItem>
                                        <SelectItem value="cancelled">취소됨</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex flex-1 items-center gap-2">
                                <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="flex-1 sm:w-[200px] justify-start text-left font-normal">
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {selectedDate ? format(selectedDate, "yyyy-MM-dd") : "배달일 선택"}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="end">
                                        <Calendar
                                            mode="single"
                                            selected={selectedDate}
                                            onSelect={(date) => {
                                                handleDateFilter(date || undefined);
                                                setIsDatePickerOpen(false);
                                            }}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                                {deliveryDateFilter && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDateFilter(undefined)}
                                        className="px-2"
                                    >
                                        초기화
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>전체 주문 ({orders.length}개)</CardTitle>
                </CardHeader>
                <CardContent>
                    {orders.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-muted-foreground">주문 내역이 없습니다.</p>
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[40px]"></TableHead>
                                        <TableHead>주문번호</TableHead>
                                        <TableHead>고객명</TableHead>
                                        <TableHead className="hidden md:table-cell">전화번호</TableHead>
                                        <TableHead className="hidden sm:table-cell">주문 내역</TableHead>
                                        <TableHead>배달일</TableHead>
                                        <TableHead className="hidden lg:table-cell">채널</TableHead>
                                        <TableHead className="text-right">총액</TableHead>
                                        <TableHead>상태</TableHead>
                                        <TableHead className="text-right">작업</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {orders.map((order: any) => {
                                        const isExpanded = expandedRows.has(order.id);
                                        return (
                                            <React.Fragment key={order.id}>
                                                <TableRow
                                                    className="cursor-pointer hover:bg-muted/50"
                                                    onClick={() => toggleRow(order.id)}
                                                >
                                                    <TableCell>
                                                        {isExpanded ? (
                                                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                                        ) : (
                                                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="font-mono text-sm">
                                                        {order.order_number}
                                                    </TableCell>
                                                    <TableCell className="font-medium">
                                                        {order.customer_name}
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground hidden md:table-cell">
                                                        {order.phone}
                                                    </TableCell>
                                                    <TableCell className="hidden sm:table-cell">
                                                        <span className="text-sm font-medium">
                                                            {getOrderSummary(order)}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        {new Date(order.delivery_date).toLocaleDateString('ko-KR')}
                                                    </TableCell>
                                                    <TableCell className="hidden lg:table-cell">
                                                        <Badge variant="outline">
                                                            {order.entry_channel === 'admin_whatsapp' ? 'WhatsApp' : '직접'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium">
                                                        ₹{order.total_amount}
                                                    </TableCell>
                                                    <TableCell>
                                                        {(() => {
                                                            const info = statusStyles[order.status] || { label: order.status };
                                                            if (info.variant) {
                                                                return <Badge variant={info.variant}>{info.label}</Badge>;
                                                            }
                                                            return <Badge variant="default" className={info.className}>{info.label}</Badge>;
                                                        })()}
                                                        {order.is_locked && (
                                                            <Badge variant="outline" className="ml-1">
                                                                <Lock className="h-3 w-3" />
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button size="sm" variant="ghost">
                                                                    작업
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-[200px]">
                                                                <DropdownMenuLabel>주문 작업</DropdownMenuLabel>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem asChild>
                                                                    <Link to={`/admin/orders/${order.id}`}>
                                                                        <Eye className="mr-2 h-4 w-4" />
                                                                        상세 보기
                                                                    </Link>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => handleAction("toggle_lock", order.id)}>
                                                                    {order.is_locked ? (
                                                                        <>
                                                                            <Unlock className="mr-2 h-4 w-4" />
                                                                            잠금 해제
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Lock className="mr-2 h-4 w-4" />
                                                                            주문 잠금
                                                                        </>
                                                                    )}
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                {order.status !== 'cancelled' && (
                                                                    <>
                                                                        {statusOptions
                                                                            .filter((option) => option.value !== 'cancelled')
                                                                            .filter((option) => option.value !== order.status)
                                                                            .map((option) => (
                                                                                <DropdownMenuItem
                                                                                    key={`status-${order.id}-${option.value}`}
                                                                                    onClick={() => handleAction("change_status", order.id, { status: option.value })}
                                                                                >
                                                                                    {option.label}로 변경
                                                                                </DropdownMenuItem>
                                                                            ))}
                                                                        <DropdownMenuSeparator />
                                                                    </>
                                                                )}
                                                                {order.status !== 'cancelled' && (
                                                                    <DropdownMenuItem
                                                                        onClick={() => handleAction("cancel", order.id)}
                                                                        className="text-red-600"
                                                                    >
                                                                        <XCircle className="mr-2 h-4 w-4" />
                                                                        주문 취소
                                                                    </DropdownMenuItem>
                                                                )}
                                                                {order.status === 'cancelled' && (
                                                                    <DropdownMenuItem
                                                                        onClick={() => handleAction("restore", order.id)}
                                                                    >
                                                                        <RotateCcw className="mr-2 h-4 w-4" />
                                                                        주문 복원
                                                                    </DropdownMenuItem>
                                                                )}
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </TableCell>
                                                </TableRow>
                                                {isExpanded && (
                                                    <TableRow className="bg-muted/30">
                                                        <TableCell />
                                                        <TableCell colSpan={9}>
                                                            <div className="py-4 px-2">
                                                                <h4 className="text-sm font-semibold mb-2">상세 주문 내역</h4>
                                                                <p className="text-sm text-muted-foreground leading-relaxed">
                                                                    {order.order_items?.map((item: any) => {
                                                                        const name = item.products?.name_ko || item.products?.name;
                                                                        return `${name} x ${item.quantity}`;
                                                                    }).join(", ")}
                                                                </p>
                                                                {order.notes && (
                                                                    <div className="mt-4 p-3 rounded bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-900/50">
                                                                        <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-400 mb-1">고객 메모</p>
                                                                        <p className="text-sm">{order.notes}</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </PageContainer>
    );
}
