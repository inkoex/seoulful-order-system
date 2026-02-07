import { useEffect, useState } from "react";
import { Link, useLoaderData, useActionData, useSubmit, data, redirect } from "react-router";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { Plus, Filter, CalendarIcon, Settings, Lock, XCircle } from "lucide-react";
import type { ExpandedState } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
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
import { useTableSettings } from "@/hooks/useTableSettings";
import { useOrdersTable } from "@/hooks/useOrdersTable";
import { OrdersDataTable } from "@/components/admin/orders/OrdersDataTable";
import { ColumnSettingsSheet } from "@/components/admin/orders/ColumnSettingsSheet";
import { cn } from "@/lib/utils";
import { STATUS_CONFIG, OrderStatusBadge } from "@/components/admin/orders/OrderStatusBadge";
import type { Route } from "./+types/admin.orders._index";

export async function loader({ request }: Route.LoaderArgs) {
    await requireAuth(request);

    const url = new URL(request.url);
    const statusFilter = url.searchParams.get("status") || "all";
    const deliveryDateFilter = url.searchParams.get("delivery_date");
    const searchQuery = url.searchParams.get("search") || "";

    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const pageSize = parseInt(url.searchParams.get("pageSize") || "50", 10);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

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
            ),
            apartments (
                name,
                name_ko
            )
        `, { count: 'exact' })
        .order('created_at', { ascending: false });

    if (statusFilter !== "all") {
        query = query.eq('status', statusFilter);
    }

    if (deliveryDateFilter) {
        query = query.eq('delivery_date', deliveryDateFilter);
    }

    if (searchQuery) {
        query = query.or(`customer_name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,order_number.ilike.%${searchQuery}%`);
    }

    const { data: orders, error, count } = await query.range(from, to);

    // Get KPI stats using targeted count queries for performance
    const baseKpiQuery = () => {
        let q = supabaseAdmin.from('orders').select('id', { count: 'exact', head: true });
        if (deliveryDateFilter) q = q.eq('delivery_date', deliveryDateFilter);
        if (searchQuery) {
            q = q.or(`customer_name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,order_number.ilike.%${searchQuery}%`);
        }
        return q;
    };

    const [receivedCount, readyCount, lockedCount] = await Promise.all([
        baseKpiQuery().eq('status', 'received'),
        baseKpiQuery().eq('status', 'ready'),
        baseKpiQuery().eq('is_locked', true)
    ]);

    const kpis = {
        total: count || 0,
        received: receivedCount.count || 0,
        ready: readyCount.count || 0,
        locked: lockedCount.count || 0
    };

    if (error) {
        throw new Error('주문 목록을 불러오는데 실패했습니다');
    }

    return data({
        orders: orders || [],
        statusFilter,
        deliveryDateFilter,
        searchQuery,
        page,
        pageSize,
        totalCount: count || 0,
        kpis
    });
}

export async function action({ request }: Route.ActionArgs) {
    await requireAuth(request);

    const formData = await request.formData();
    const intent = formData.get("intent");
    const orderId = formData.get("orderId");

    if (!orderId) {
        return data({ error: "주문 ID가 없습니다" }, { status: 400 });
    }

    try {
        if (intent === "toggle_lock") {
            const { data: order, error: fetchError } = await supabaseAdmin
                .from('orders')
                .select('is_locked')
                .eq('id', orderId)
                .single();

            if (fetchError) throw fetchError;

            if (order) {
                const { error: updateError } = await supabaseAdmin
                    .from('orders')
                    .update({ is_locked: !order.is_locked })
                    .eq('id', orderId);
                if (updateError) throw updateError;
            }
        } else if (intent === "change_status") {
            const newStatus = formData.get("status");
            const { error } = await supabaseAdmin
                .from('orders')
                .update({ status: newStatus })
                .eq('id', orderId);
            if (error) throw error;
        } else if (intent === "cancel") {
            const { error } = await supabaseAdmin
                .from('orders')
                .update({
                    status: 'cancelled',
                    cancelled_at: new Date().toISOString(),
                    cancelled_reason: 'Admin cancelled'
                })
                .eq('id', orderId);
            if (error) throw error;
        } else if (intent === "restore") {
            const { error } = await supabaseAdmin
                .from('orders')
                .update({
                    status: 'received',
                    cancelled_at: null,
                    cancelled_reason: null
                })
                .eq('id', orderId);
            if (error) throw error;
        } else if (intent === "bulk_change_status") {
            const orderIds = JSON.parse(formData.get("orderIds") as string) as string[];
            const newStatus = formData.get("status") as string;
            const { error } = await supabaseAdmin
                .from('orders')
                .update({ status: newStatus })
                .in('id', orderIds);
            if (error) throw error;
        } else if (intent === "bulk_toggle_lock") {
            const orderIds = JSON.parse(formData.get("orderIds") as string) as string[];

            const { data: currentOrders, error: fetchError } = await supabaseAdmin
                .from('orders')
                .select('id, is_locked')
                .in('id', orderIds);

            if (fetchError) throw fetchError;

            if (currentOrders) {
                const toLock = currentOrders.filter(o => !o.is_locked).map(o => o.id);
                const toUnlock = currentOrders.filter(o => o.is_locked).map(o => o.id);

                const updates = [];
                if (toLock.length > 0) {
                    updates.push(supabaseAdmin.from('orders').update({ is_locked: true }).in('id', toLock));
                }
                if (toUnlock.length > 0) {
                    updates.push(supabaseAdmin.from('orders').update({ is_locked: false }).in('id', toUnlock));
                }

                if (updates.length > 0) {
                    const results = await Promise.all(updates);
                    const firstError = results.find(r => r.error)?.error;
                    if (firstError) throw firstError;
                }
            }
        } else if (intent === "bulk_cancel") {
            const orderIds = JSON.parse(formData.get("orderIds") as string) as string[];
            const { error } = await supabaseAdmin
                .from('orders')
                .update({
                    status: 'cancelled',
                    cancelled_at: new Date().toISOString(),
                    cancelled_reason: 'Admin bulk cancelled'
                })
                .in('id', orderIds);

            if (error) throw error;
        }

        return data({
            success: true,
            message: intent === "cancel" || intent === "bulk_cancel" ? "주문이 취소되었습니다." :
                intent === "toggle_lock" || intent === "bulk_toggle_lock" ? "잠금 상태가 변경되었습니다." :
                    intent === "restore" ? "주문이 복구되었습니다." : "상태가 변경되었습니다."
        });
    } catch (error: any) {
        console.error(`Action failed [${intent}]:`, error);
        return data({
            error: error.message || "작업 도중 오류가 발생했습니다."
        }, { status: 500 });
    }
}

export default function AdminOrdersPage() {
    const { orders, statusFilter, deliveryDateFilter, searchQuery, page, pageSize, totalCount, kpis } = useLoaderData<typeof loader>();
    const actionData = useActionData<typeof action>();
    const selectedDate = deliveryDateFilter ? parseISO(deliveryDateFilter) : undefined;

    useEffect(() => {
        if (!actionData) return;

        const data = actionData as { success?: boolean; message?: string; error?: string };

        if (data.success) {
            toast.success(data.message || "성공적으로 처리되었습니다.");
        } else if (data.error) {
            toast.error(data.error);
        }
    }, [actionData]);
    const [searchTerm, setSearchTerm] = useState(searchQuery);
    const [expandedRows, setExpandedRows] = useState<ExpandedState>({});
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const { settings, saveSettings, resetSettings, isLoaded } = useTableSettings();
    const table = useOrdersTable({
        orders,
        settings,
        onSettingsChange: saveSettings,
        expandedRows,
        onExpandedChange: setExpandedRows,
    });

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

    // Search handled by form submit or sync with URL


    // KPIs provided by loader for accuracy

    return (
        <PageContainer size="wide">
            {/* Header Section */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">주문 관리</h1>
                    <p className="text-muted-foreground mt-1">현장의 주문 상황을 실시간으로 확인하고 관리하세요.</p>
                </div>
                <Button asChild className="w-full sm:w-auto shadow-lg shadow-brand-primary/20">
                    <Link to="/admin/orders/new">
                        <Plus className="mr-2 h-4 w-4" />
                        WhatsApp 주문 입력
                    </Link>
                </Button>
            </div>

            {/* KPI Summary Section */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
                <Card className="border-none shadow-sm bg-slate-50/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">전체 건수</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{kpis.total}</div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-amber-50/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-semibold text-amber-600 uppercase tracking-wider">접수 대기</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-700">{kpis.received}</div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-blue-50/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-semibold text-blue-600 uppercase tracking-wider">생산 완료</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-700">{kpis.ready}</div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-slate-50/50">
                    <CardHeader className="pb-2 text-slate-500">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-xs font-semibold uppercase tracking-wider">잠금 상태</CardTitle>
                            <Lock className="h-3 w-3" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{kpis.locked}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Sticky Toolbar Section */}
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-4 mb-4 pt-1">
                <div className="flex flex-col gap-3 md:flex-row md:items-center justify-between p-2 rounded-xl border bg-card shadow-sm">
                    <div className="flex flex-1 items-center gap-3">
                        <div className="relative flex-1 max-w-sm">
                            <Input
                                placeholder="고객명, 전화번호, 주문번호 검색..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        const url = new URL(window.location.href);
                                        if (searchTerm) {
                                            url.searchParams.set("search", searchTerm);
                                        } else {
                                            url.searchParams.delete("search");
                                        }
                                        url.searchParams.set("page", "1"); // Reset to page 1
                                        window.location.href = url.toString();
                                    }
                                }}
                                className="h-9 pr-8 bg-muted/50 border-none"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => {
                                        setSearchTerm("");
                                        const url = new URL(window.location.href);
                                        url.searchParams.delete("search");
                                        window.location.href = url.toString();
                                    }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    <XCircle className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Select value={statusFilter} onValueChange={handleStatusFilter}>
                            <SelectTrigger className="w-[140px] h-9 bg-muted/50 border-none">
                                <SelectValue placeholder="모든 상태" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">모든 상태</SelectItem>
                                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className={cn(
                                        "h-9 bg-muted/50 border-none justify-start text-left font-normal sm:w-[160px]",
                                        !selectedDate && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {selectedDate ? format(selectedDate, "yyyy-MM-dd") : "배달일"}
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

                        {(statusFilter !== "all" || deliveryDateFilter || searchQuery) && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    window.location.href = window.location.pathname;
                                }}
                                className="h-9 px-3 text-brand-primary hover:bg-brand-primary/10"
                            >
                                초기화
                            </Button>
                        )}

                        <div className="h-4 w-[1px] bg-border mx-1 hidden md:block" />

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsSettingsOpen(true)}
                            className="h-9 border-slate-200"
                        >
                            <Settings className="h-4 w-4 md:mr-2" />
                            <span className="hidden md:inline">컬럼 설정</span>
                        </Button>
                    </div>
                </div>
            </div>

            <Card className="border-none shadow-sm">
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg">주문 목록 ({orders.length}개)</CardTitle>
                </CardHeader>
                <CardContent>
                    {!isLoaded ? (
                        <div className="text-center py-8">
                            <p className="text-muted-foreground">로딩 중...</p>
                        </div>
                    ) : orders.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-muted-foreground">주문 내역이 없습니다.</p>
                        </div>
                    ) : (
                        <OrdersDataTable
                            table={table}
                            page={page}
                            pageSize={pageSize}
                            totalCount={totalCount}
                        />
                    )}
                </CardContent>
            </Card>

            <ColumnSettingsSheet
                open={isSettingsOpen}
                onOpenChange={setIsSettingsOpen}
                settings={settings}
                onSettingsChange={saveSettings}
                onReset={resetSettings}
            />
        </PageContainer>
    );
}
