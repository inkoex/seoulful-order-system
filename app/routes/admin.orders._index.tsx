import { useState } from "react";
import { Link, useLoaderData, useActionData, useSubmit, data, redirect } from "react-router";
import { format, parseISO } from "date-fns";
import { Plus, Filter, CalendarIcon, Settings } from "lucide-react";
import type { ExpandedState } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
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
import { useTableSettings } from "@/hooks/useTableSettings";
import { useOrdersTable } from "@/hooks/useOrdersTable";
import { OrdersDataTable } from "@/components/admin/orders/OrdersDataTable";
import { ColumnSettingsSheet } from "@/components/admin/orders/ColumnSettingsSheet";
import { cn } from "@/lib/utils";
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
            ),
            apartments (
                name,
                name_ko
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
    const selectedDate = deliveryDateFilter ? parseISO(deliveryDateFilter) : undefined;
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


    return (
        <PageContainer size="wide">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold">주문 관리</h1>
                    <p className="text-muted-foreground mt-1">모든 주문 내역</p>
                </div>
                <Button asChild className="w-full sm:w-auto">
                    <Link to="/admin/orders/new">
                        <Plus className="mr-2 h-4 w-4" />
                        WhatsApp 주문 입력
                    </Link>
                </Button>
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
                                        <Button
                                            variant="outline"
                                            className={cn(
                                                "flex-1 sm:w-[200px] justify-start text-left font-normal",
                                                !selectedDate && "text-muted-foreground"
                                            )}
                                        >
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
                    <div className="flex items-center justify-between">
                        <CardTitle>전체 주문 ({orders.length}개)</CardTitle>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsSettingsOpen(true)}
                        >
                            <Settings className="mr-2 h-4 w-4" />
                            컬럼 설정
                        </Button>
                    </div>
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
                        <OrdersDataTable table={table} />
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
