import { useEffect, useState } from "react";
import { Link, useLoaderData, useSearchParams } from "react-router";
import { Package, ShoppingCart, Users, TrendingUp, FolderOpen, Building, Calendar as CalendarIcon, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth.server";
import { supabaseAdmin } from "@/lib/supabase.server";
import { startOfDay, endOfDay, startOfMonth, endOfMonth, format, parseISO, isValid } from "date-fns";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { PageContainer } from "@/components/ui/container";
import { cn } from "@/lib/utils";
import type { Route } from "./+types/admin.dashboard";

export async function loader({ request }: Route.LoaderArgs) {
    await requireAuth(request);

    const now = new Date();
    const todayStart = startOfDay(now).toISOString();
    const todayEnd = endOfDay(now).toISOString();
    const monthStart = startOfMonth(now).toISOString();
    const monthEnd = endOfMonth(now).toISOString();
    const summaryDateParam = new URL(request.url).searchParams.get("summary_date");
    const parsedSummaryDate = summaryDateParam ? parseISO(summaryDateParam) : null;
    const summaryDate = parsedSummaryDate && isValid(parsedSummaryDate) ? parsedSummaryDate : null;
    const summaryDateKey = summaryDate ? format(summaryDate, "yyyy-MM-dd") : null;

    // 1. Today's Orders
    const todayCountPromise = supabaseAdmin
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayStart)
        .lte('created_at', todayEnd);

    // 2. Monthly Revenue
    const monthlyOrdersPromise = supabaseAdmin
        .from('orders')
        .select('total_amount')
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd)
        .neq('status', 'cancelled');

    // 3. Active Products
    const productCountPromise = supabaseAdmin
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

    // 4. Total Customers (Unique phone numbers)
    const customersPromise = supabaseAdmin
        .from('orders')
        .select('phone');

    // 5. Daily Order Summary (by delivery date)
    let summaryOrdersQuery = supabaseAdmin
        .from('orders')
        .select('status, total_amount');

    if (summaryDateKey) {
        summaryOrdersQuery = summaryOrdersQuery.eq('delivery_date', summaryDateKey);
    }

    let summaryItemsQuery = supabaseAdmin
        .from('order_items')
        .select(`
            quantity,
            product_id,
            orders!inner (
                delivery_date,
                status
            ),
            products (
                name_ko,
                name
            )
        `)
        .neq('orders.status', 'cancelled');

    if (summaryDateKey) {
        summaryItemsQuery = summaryItemsQuery.eq('orders.delivery_date', summaryDateKey);
    }

    const [
        { count: todayCount },
        { data: monthlyOrders },
        { count: productCount },
        { data: customers },
        { data: summaryOrders },
        { data: summaryItems },
    ] = await Promise.all([
        todayCountPromise,
        monthlyOrdersPromise,
        productCountPromise,
        customersPromise,
        summaryOrdersQuery,
        summaryItemsQuery,
    ]);

    const monthlyRevenue = monthlyOrders?.reduce((acc: number, curr: any) => acc + (Number(curr.total_amount) || 0), 0) || 0;
    const uniqueCustomers = new Set(customers?.map((c: any) => c.phone)).size;

    const statusCounts: Record<string, number> = {
        received: 0,
        ready: 0,
        delivered: 0,
        paid: 0,
        cancelled: 0,
    };
    let dailyRevenue = 0;
    (summaryOrders || []).forEach((order: any) => {
        if (typeof statusCounts[order.status] === "number") {
            statusCounts[order.status] += 1;
        } else {
            statusCounts[order.status] = 1;
        }

        if (order.status !== 'cancelled') {
            dailyRevenue += Number(order.total_amount) || 0;
        }
    });

    const productTotalsMap = new Map<string, { name: string; quantity: number }>();
    (summaryItems || []).forEach((item: any) => {
        const name = item.products?.name_ko || item.products?.name || "상품";
        const current = productTotalsMap.get(name) || { name, quantity: 0 };
        productTotalsMap.set(name, { name, quantity: current.quantity + (Number(item.quantity) || 0) });
    });
    const productTotals = Array.from(productTotalsMap.values()).sort((a, b) => b.quantity - a.quantity);

    return {
        stats: {
            todayOrders: todayCount || 0,
            monthlyRevenue,
            activeProducts: productCount || 0,
            totalCustomers: uniqueCustomers
        },
        summary: {
            date: summaryDateKey,
            totalOrders: summaryOrders?.length || 0,
            dailyRevenue,
            statusCounts,
            productTotals,
        }
    };
}

export default function AdminDashboardPage() {
    const { stats, summary } = useLoaderData<typeof loader>();
    const [searchParams, setSearchParams] = useSearchParams();
    const [summaryDateValue, setSummaryDateValue] = useState<string | null>(summary?.date ?? null);
    const summaryDate = summaryDateValue ? parseISO(summaryDateValue) : undefined;
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const [currentTime, setCurrentTime] = useState(() => format(new Date(), "HH:mm:ss"));

    useEffect(() => {
        if ((summary?.date ?? null) !== summaryDateValue) {
            setSummaryDateValue(summary?.date ?? null);
        }
    }, [summary?.date, summaryDateValue]);

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            setCurrentTime(format(new Date(), "HH:mm:ss"));
        }, 1000);

        return () => window.clearInterval(intervalId);
    }, []);

    function handleSummaryDateSelect(date?: Date) {
        const nextParams = new URLSearchParams(searchParams);
        if (!date) {
            nextParams.delete("summary_date");
            setSummaryDateValue(null);
        } else {
            const nextValue = format(date, "yyyy-MM-dd");
            nextParams.set("summary_date", nextValue);
            setSummaryDateValue(nextValue);
        }
        setSearchParams(nextParams);
        setIsDatePickerOpen(false);
    }

    return (
        <PageContainer size="wide">
            <div className="mb-8">
                <h3 className="text-2xl font-bold">대시보드 요약</h3>
                <p className="text-muted-foreground mt-1">실시간 운영 현황</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">오늘 주문</CardTitle>
                        <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.todayOrders} 건</div>
                        <p className="text-xs text-muted-foreground">Today's Orders</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">이번 달 매출</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">₹{stats.monthlyRevenue.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Monthly Revenue</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">판매 상품</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.activeProducts} 종</div>
                        <p className="text-xs text-muted-foreground">Active Products</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">총 고객수</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalCustomers} 명</div>
                        <p className="text-xs text-muted-foreground">Unique Customers</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="mb-8">
                <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between space-y-0">
                    <CardTitle>일별 주문 요약</CardTitle>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <div className="flex items-center gap-2 flex-1">
                            <span className="text-sm text-muted-foreground whitespace-nowrap">배달일</span>
                            <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" className={cn("w-full sm:w-[150px] justify-start text-left font-normal", !summaryDate && "text-muted-foreground")}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {summaryDate ? format(summaryDate, "yyyy-MM-dd") : "전체"}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="end">
                                    <Calendar
                                        mode="single"
                                        selected={summaryDate}
                                        onSelect={handleSummaryDateSelect}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleSummaryDateSelect(undefined)} className="w-full sm:w-auto">
                            전체 보기
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-md border p-4">
                            <p className="text-sm text-muted-foreground">전체 주문</p>
                            <p className="text-2xl font-bold">{summary.totalOrders} 건</p>
                        </div>
                        <div className="rounded-md border p-4">
                            <p className="text-sm text-muted-foreground">매출 합계</p>
                            <p className="text-2xl font-bold">₹{summary.dailyRevenue.toLocaleString()}</p>
                        </div>
                        <div className="rounded-md border p-4">
                            <p className="text-sm text-muted-foreground">접수/생산 완료</p>
                            <p className="text-base font-semibold">
                                {summary.statusCounts.received + summary.statusCounts.ready} 건
                            </p>
                            <p className="text-xs text-muted-foreground">
                                접수 {summary.statusCounts.received} / 생산 {summary.statusCounts.ready}
                            </p>
                        </div>
                        <div className="rounded-md border p-4">
                            <p className="text-sm text-muted-foreground">배달/지불/취소</p>
                            <p className="text-base font-semibold">
                                {summary.statusCounts.delivered + summary.statusCounts.paid + summary.statusCounts.cancelled} 건
                            </p>
                            <p className="text-xs text-muted-foreground">
                                배달 {summary.statusCounts.delivered} / 지불 {summary.statusCounts.paid} / 취소 {summary.statusCounts.cancelled}
                            </p>
                        </div>
                    </div>
                    <div className="mt-6">
                        <p className="text-sm font-medium mb-3">상품별 생산 수량</p>
                        {summary.productTotals.length === 0 ? (
                            <p className="text-sm text-muted-foreground">해당 날짜 주문이 없습니다.</p>
                        ) : (
                            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                                {summary.productTotals.map((item) => (
                                    <div key={item.name} className="flex items-center justify-between rounded-md border p-3 text-sm">
                                        <span className="font-medium">{item.name}</span>
                                        <span>× {item.quantity}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>빠른 이동</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Button asChild className="w-full justify-start" variant="outline">
                            <Link to="/admin/products">
                                <Package className="mr-2 h-4 w-4 text-blue-500" />
                                <span>상품 관리</span>
                                <span className="ml-auto text-xs text-muted-foreground">메뉴 등록/수정</span>
                            </Link>
                        </Button>
                        <Button asChild className="w-full justify-start" variant="outline">
                            <Link to="/admin/categories">
                                <FolderOpen className="mr-2 h-4 w-4 text-purple-500" />
                                <span>카테고리 관리</span>
                                <span className="ml-auto text-xs text-muted-foreground">상품 분류</span>
                            </Link>
                        </Button>
                        <Button asChild className="w-full justify-start" variant="outline">
                            <Link to="/admin/apartments">
                                <Building className="mr-2 h-4 w-4 text-green-500" />
                                <span>아파트 관리</span>
                                <span className="ml-auto text-xs text-muted-foreground">배달 지역</span>
                            </Link>
                        </Button>
                        <Button asChild className="w-full justify-start" variant="outline">
                            <Link to="/admin/orders">
                                <ShoppingCart className="mr-2 h-4 w-4 text-orange-500" />
                                <span>주문 내역</span>
                                <span className="ml-auto text-xs text-muted-foreground">전체 주문 조회</span>
                            </Link>
                        </Button>
                        <Button asChild className="w-full justify-start" variant="outline">
                            <Link to="/admin/notices">
                                <Megaphone className="mr-2 h-4 w-4 text-amber-500" />
                                <span>공지 관리</span>
                                <span className="ml-auto text-xs text-muted-foreground">주문 공지 설정</span>
                            </Link>
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>시스템 정보</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">상태</span>
                                <span className="font-medium text-green-600">Online</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">데이터베이스</span>
                                <span className="font-medium">Supabase (Connected)</span>
                            </div>
                            <div className="flex justify-between border-t pt-2 mt-2">
                                <span className="text-muted-foreground">현재 시각</span>
                                <span className="font-medium">{currentTime}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </PageContainer>
    );
}
