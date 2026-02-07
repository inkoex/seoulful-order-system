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

    // 1-5. All Stats (Consolidated into single RPC for high performance)
    const { data: fullStats, error: fullError } = await supabaseAdmin
        .rpc('get_dashboard_full_stats', {
            p_today_start: todayStart,
            p_today_end: todayEnd,
            p_month_start: monthStart,
            p_month_end: monthEnd,
            p_summary_date: summaryDateKey
        });

    if (fullError) {
        console.error("Dashboard Full Stats Error:", fullError);
    }

    const { stats: rpcStats, summary: rpcSummary, product_totals: productTotals } = (fullStats as any) || {};

    return {
        stats: {
            todayOrders: rpcStats?.today_orders || 0,
            monthlyRevenue: Number(rpcStats?.monthly_revenue) || 0,
            activeProducts: rpcStats?.active_products || 0,
            totalCustomers: rpcStats?.total_customers || 0
        },
        summary: {
            date: summaryDateKey,
            totalOrders: rpcSummary?.total_orders || 0,
            dailyRevenue: Number(rpcSummary?.revenue) || 0,
            statusCounts: {
                received: rpcSummary?.received || 0,
                ready: rpcSummary?.ready || 0,
                delivered: rpcSummary?.delivered || 0,
                paid: rpcSummary?.paid || 0,
                cancelled: rpcSummary?.cancelled || 0,
            },
            productTotals: productTotals || [],
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
        <PageContainer size="wide" className="pb-12">
            <div className="mb-10">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">대시보드</h1>
                <p className="mt-1 text-sm font-medium text-slate-500">실시간 운영 현황 및 통계</p>
            </div>

            <div className="mb-10 grid gap-4 md:grid-cols-2 lg:grid-cols-12">
                <Card className="admin-b2b-card border bg-white transition-all duration-200 hover:-translate-y-0.5 lg:col-span-3">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">오늘 주문</CardTitle>
                        <ShoppingCart className="h-4 w-4 text-slate-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-semibold text-slate-900">{stats.todayOrders} <span className="text-sm font-semibold text-slate-400">건</span></div>
                    </CardContent>
                </Card>

                <Card className="admin-b2b-card border bg-white transition-all duration-200 hover:-translate-y-0.5 lg:col-span-5">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">이번 달 매출</CardTitle>
                        <TrendingUp className="h-4 w-4 text-primary/70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-semibold tracking-tight text-slate-950">₹{stats.monthlyRevenue.toLocaleString()}</div>
                    </CardContent>
                </Card>

                <Card className="admin-b2b-card border bg-white transition-all duration-200 hover:-translate-y-0.5 lg:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">판매 상품</CardTitle>
                        <Package className="h-4 w-4 text-slate-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-semibold text-slate-900">{stats.activeProducts} <span className="text-sm font-semibold text-slate-400">종</span></div>
                    </CardContent>
                </Card>

                <Card className="admin-b2b-card border bg-white transition-all duration-200 hover:-translate-y-0.5 lg:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">총 고객수</CardTitle>
                        <Users className="h-4 w-4 text-slate-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-semibold text-slate-900">{stats.totalCustomers} <span className="text-sm font-semibold text-slate-400">명</span></div>
                    </CardContent>
                </Card>
            </div>

            <Card className="admin-b2b-card mb-8 border bg-white">
                <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between space-y-0">
                    <CardTitle className="text-xl font-semibold tracking-tight text-slate-900">일별 주문 요약</CardTitle>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <div className="flex items-center gap-2 flex-1">
                            <span className="text-sm text-slate-500 whitespace-nowrap">배달일</span>
                            <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" className={cn("w-full sm:w-[150px] justify-start border-slate-200 bg-slate-50/80 text-left font-medium", !summaryDate && "text-slate-500")}>
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
                        <Button variant="ghost" size="sm" onClick={() => handleSummaryDateSelect(undefined)} className="w-full text-slate-600 sm:w-auto">
                            전체 보기
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                        <div className="admin-b2b-soft-card rounded-xl p-5">
                            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">전체 주문</p>
                            <p className="text-2xl font-semibold text-slate-900">{summary.totalOrders} <span className="text-xs font-semibold text-slate-400">건</span></p>
                        </div>
                        <div className="admin-b2b-soft-card rounded-xl p-5">
                            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">매출 합계</p>
                            <p className="text-2xl font-semibold text-slate-900">₹{summary.dailyRevenue.toLocaleString()}</p>
                        </div>
                        <div className="rounded-xl border border-amber-300/50 bg-amber-50/75 p-5">
                            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700">진행 중</p>
                            <div className="flex items-baseline gap-2">
                                <p className="text-2xl font-semibold text-amber-700">
                                    {summary.statusCounts.received + summary.statusCounts.ready}
                                </p>
                                <p className="text-[11px] font-medium leading-none text-amber-700/70">
                                    접수: {summary.statusCounts.received} / 완료: {summary.statusCounts.ready}
                                </p>
                            </div>
                        </div>
                        <div className="rounded-xl border border-blue-300/50 bg-blue-50/75 p-5">
                            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-700">완료 / 취소</p>
                            <div className="flex items-baseline gap-2">
                                <p className="text-2xl font-semibold text-blue-700">
                                    {summary.statusCounts.delivered + summary.statusCounts.paid + summary.statusCounts.cancelled}
                                </p>
                                <p className="text-[11px] font-medium leading-none text-blue-700/70">
                                    배달: {summary.statusCounts.delivered} / 지불: {summary.statusCounts.paid} / 취소: {summary.statusCounts.cancelled}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="mt-6">
                        <p className="mb-3 text-sm font-semibold text-slate-700">상품별 생산 수량</p>
                        {summary.productTotals.length === 0 ? (
                            <p className="text-sm text-muted-foreground">해당 날짜 주문이 없습니다.</p>
                        ) : (
                            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                                {summary.productTotals.map((item: { name: string; quantity: number }) => (
                                    <div key={item.name} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-sm">
                                        <span className="font-medium text-slate-700">{item.name}</span>
                                        <span className="font-semibold text-slate-900">× {item.quantity}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="admin-b2b-card border bg-white">
                    <CardHeader>
                        <CardTitle className="text-xl font-semibold tracking-tight text-slate-900">빠른 이동</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Button asChild className="w-full justify-start border-slate-200 bg-slate-50/70 hover:bg-slate-100" variant="outline">
                            <Link to="/admin/products">
                                <Package className="mr-2 h-4 w-4 text-slate-500" />
                                <span>상품 관리</span>
                                <span className="ml-auto text-xs text-muted-foreground">메뉴 등록/수정</span>
                            </Link>
                        </Button>
                        <Button asChild className="w-full justify-start border-slate-200 bg-slate-50/70 hover:bg-slate-100" variant="outline">
                            <Link to="/admin/categories">
                                <FolderOpen className="mr-2 h-4 w-4 text-slate-500" />
                                <span>카테고리 관리</span>
                                <span className="ml-auto text-xs text-muted-foreground">상품 분류</span>
                            </Link>
                        </Button>
                        <Button asChild className="w-full justify-start border-slate-200 bg-slate-50/70 hover:bg-slate-100" variant="outline">
                            <Link to="/admin/apartments">
                                <Building className="mr-2 h-4 w-4 text-slate-500" />
                                <span>아파트 관리</span>
                                <span className="ml-auto text-xs text-muted-foreground">배달 지역</span>
                            </Link>
                        </Button>
                        <Button asChild className="w-full justify-start border-slate-200 bg-slate-50/70 hover:bg-slate-100" variant="outline">
                            <Link to="/admin/orders">
                                <ShoppingCart className="mr-2 h-4 w-4 text-slate-500" />
                                <span>주문 내역</span>
                                <span className="ml-auto text-xs text-muted-foreground">전체 주문 조회</span>
                            </Link>
                        </Button>
                        <Button asChild className="w-full justify-start border-slate-200 bg-slate-50/70 hover:bg-slate-100" variant="outline">
                            <Link to="/admin/notices">
                                <Megaphone className="mr-2 h-4 w-4 text-slate-500" />
                                <span>공지 관리</span>
                                <span className="ml-auto text-xs text-muted-foreground">주문 공지 설정</span>
                            </Link>
                        </Button>
                    </CardContent>
                </Card>

                <Card className="admin-b2b-card border bg-white">
                    <CardHeader>
                        <CardTitle className="text-xl font-semibold tracking-tight text-slate-900">시스템 정보</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-slate-500">상태</span>
                                <span className="font-medium text-green-600">Online</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">데이터베이스</span>
                                <span className="font-medium">Supabase (Connected)</span>
                            </div>
                            <div className="mt-2 flex justify-between border-t border-slate-200 pt-2">
                                <span className="text-slate-500">현재 시각</span>
                                <span className="font-medium">{currentTime}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </PageContainer>
    );
}
