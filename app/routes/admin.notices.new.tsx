import { useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { Link, useActionData, useLoaderData, data, redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from "react-router";
import { ArrowLeft, CalendarIcon, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { requireAuth } from "@/lib/auth.server";
import { supabaseAdmin } from "@/lib/supabase.server";
import { PageContainer } from "@/components/ui/container";
import { invalidateNoticeSnapshot } from "@/lib/notices.server";
import { cn } from "@/lib/utils";

type NoticeLimitRow = {
    id: string;
    productId: string;
    maxQuantity: string;
};

const toNumber = (value: unknown) => {
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return NaN;
        return Number(trimmed);
    }
    return Number(value);
};

const toDateTimeValue = (date?: Date, time?: string) => {
    if (!date || !time) return "";
    const datePart = format(date, "yyyy-MM-dd");
    return `${datePart}T${time}`;
};

const toDateValue = (date?: Date) => {
    if (!date) return "";
    return format(date, "yyyy-MM-dd");
};

export async function loader({ request }: LoaderFunctionArgs) {
    await requireAuth(request);

    const { data: products, error } = await supabaseAdmin
        .from("products")
        .select(`
            id,
            name,
            name_ko,
            categories (
                id,
                name,
                name_ko,
                sort_order
            )
        `)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

    if (error) {
        throw new Error("상품 목록을 불러오는데 실패했습니다");
    }

    return data({ products: products || [] });
}

export async function action({ request }: ActionFunctionArgs) {
    await requireAuth(request);

    const formData = await request.formData();
    const title = formData.get("title");
    const message = formData.get("message");
    const startAtValue = formData.get("start_at");
    const endAtValue = formData.get("end_at");
    const deliveryDateValue = formData.get("delivery_date");
    const isAllProducts = formData.get("is_all_products") === "on";
    const totalLimitValue = formData.get("total_limit");
    const activateNow = formData.get("activate_now") === "on";

    if (typeof title !== "string" || !title.trim()) {
        return data({ error: "공지 제목을 입력해주세요" }, { status: 400 });
    }

    if (typeof message !== "string" || !message.trim()) {
        return data({ error: "공지 내용을 입력해주세요" }, { status: 400 });
    }

    const startAt = startAtValue && typeof startAtValue === "string" && startAtValue.trim()
        ? new Date(startAtValue)
        : new Date();
    if (Number.isNaN(startAt.getTime())) {
        return data({ error: "시작 시간이 올바르지 않습니다" }, { status: 400 });
    }

    const endAt = endAtValue && typeof endAtValue === "string" && endAtValue.trim()
        ? new Date(endAtValue)
        : null;
    if (endAt && Number.isNaN(endAt.getTime())) {
        return data({ error: "종료 시간이 올바르지 않습니다" }, { status: 400 });
    }

    if (endAt && endAt < startAt) {
        return data({ error: "종료 시간이 시작 시간보다 빠를 수 없습니다" }, { status: 400 });
    }

    const deliveryDateString = typeof deliveryDateValue === "string" && deliveryDateValue.trim()
        ? deliveryDateValue.trim()
        : format(addDays(new Date(), 1), "yyyy-MM-dd");
    const deliveryDate = new Date(`${deliveryDateString}T00:00:00`);
    if (Number.isNaN(deliveryDate.getTime())) {
        return data({ error: "배달일이 올바르지 않습니다" }, { status: 400 });
    }

    const totalLimit = toNumber(totalLimitValue);
    if (totalLimitValue && (Number.isNaN(totalLimit) || totalLimit <= 0)) {
        return data({ error: "전체 수량 제한은 1 이상이어야 합니다" }, { status: 400 });
    }

    const productIds = formData.getAll("notice_product_ids").filter((item): item is string => typeof item === "string");
    const limitProductIds = formData.getAll("product_limit_product_id").filter((item): item is string => typeof item === "string");
    const limitQuantities = formData.getAll("product_limit_max_quantity").filter((item): item is string => typeof item === "string");

    if (activateNow) {
        await supabaseAdmin.from("notices").update({ status: "closed" }).eq("status", "active");
    }

    const { data: notice, error } = await supabaseAdmin
        .from("notices")
        .insert({
            title: title.trim(),
            message: message.trim(),
            status: activateNow ? "active" : "closed",
            start_at: startAt.toISOString(),
            end_at: endAt ? endAt.toISOString() : null,
            delivery_date: deliveryDateString,
            is_all_products: isAllProducts,
        })
        .select("id")
        .single();

    if (error || !notice) {
        return data({ error: "공지 생성에 실패했습니다" }, { status: 500 });
    }

    if (!isAllProducts && productIds.length > 0) {
        const noticeProducts = productIds.map((productId) => ({ notice_id: notice.id, product_id: productId }));
        await supabaseAdmin.from("notice_products").insert(noticeProducts);
    }

    const limits: { notice_id: string; type: "total" | "product"; product_id?: string | null; max_quantity: number }[] = [];
    if (!Number.isNaN(totalLimit) && totalLimit > 0) {
        limits.push({ notice_id: notice.id, type: "total", max_quantity: totalLimit, product_id: null });
    }

    limitProductIds.forEach((productId, index) => {
        const qty = toNumber(limitQuantities[index]);
        if (!productId || Number.isNaN(qty) || qty <= 0) return;
        limits.push({ notice_id: notice.id, type: "product", product_id: productId, max_quantity: qty });
    });

    if (limits.length > 0) {
        await supabaseAdmin.from("notice_limits").insert(limits);
    }

    invalidateNoticeSnapshot();
    return redirect("/admin/notices");
}

export default function AdminNoticeNewPage() {
    const { products } = useLoaderData<typeof loader>();
    const actionData = useActionData<typeof action>() as { error?: string } | undefined;
    const [limitRows, setLimitRows] = useState<NoticeLimitRow[]>([]);
    const [startDate, setStartDate] = useState<Date | undefined>(() => new Date());
    const [startTime, setStartTime] = useState<string>(() => format(new Date(), "HH:mm"));
    const [endDate, setEndDate] = useState<Date | undefined>(() => new Date());
    const [endTime, setEndTime] = useState<string>("20:00");
    const [deliveryDate, setDeliveryDate] = useState<Date | undefined>(() => addDays(new Date(), 1));
    const [startOpen, setStartOpen] = useState(false);
    const [endOpen, setEndOpen] = useState(false);
    const [deliveryOpen, setDeliveryOpen] = useState(false);
    const defaultTitle = useMemo(() => `${format(new Date(), "yyyy-MM-dd")} 공지`, []);
    const [activateNow, setActivateNow] = useState(true);
    const [isAllProducts, setIsAllProducts] = useState(false);
    const [manualSelectedProductIds, setManualSelectedProductIds] = useState<string[]>([]);

    const allProductIds = useMemo(() => products.map((product: any) => product.id), [products]);
    const effectiveSelectedIds = isAllProducts ? allProductIds : manualSelectedProductIds;

    const groupedProducts = useMemo(() => {
        const groups = new Map<string, any[]>();
        const sorted = [...products].sort((a: any, b: any) => {
            const aSort = a.categories?.sort_order ?? 999;
            const bSort = b.categories?.sort_order ?? 999;
            if (aSort !== bSort) return aSort - bSort;
            return (a.name || "").localeCompare(b.name || "");
        });

        sorted.forEach((product: any) => {
            const categoryName = product.categories?.name_ko || product.categories?.name || "기타";
            if (!groups.has(categoryName)) groups.set(categoryName, []);
            groups.get(categoryName)?.push(product);
        });

        return Array.from(groups.entries());
    }, [products]);

    const productOptions = useMemo(
        () => products.map((product: any) => ({
            value: product.id,
            label: `${product.name} (${product.name_ko || "-"})`,
        })),
        [products]
    );

    function addLimitRow() {
        setLimitRows((prev) => [
            ...prev,
            { id: crypto.randomUUID(), productId: "", maxQuantity: "" },
        ]);
    }

    function updateLimitRow(id: string, field: "productId" | "maxQuantity", value: string) {
        setLimitRows((prev) => prev.map((row) => row.id === id ? { ...row, [field]: value } : row));
    }

    function removeLimitRow(id: string) {
        setLimitRows((prev) => prev.filter((row) => row.id !== id));
    }

    return (
        <PageContainer size="wide">
            <div className="mb-8">
                <Button asChild variant="ghost" size="sm" className="mb-4">
                    <Link to="/admin/notices">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        공지 목록으로
                    </Link>
                </Button>
                <h1 className="text-3xl font-bold">새 공지</h1>
                <p className="text-muted-foreground mt-1">주문 공지와 마감 조건을 설정합니다</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>공지 정보</CardTitle>
                </CardHeader>
                <CardContent>
                    <form method="post" className="space-y-6">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">공지 제목</label>
                                <Input name="title" placeholder="예: 이번주 주문 공지" defaultValue={defaultTitle} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">활성화</label>
                                <input type="hidden" name="activate_now" value={activateNow ? "on" : ""} />
                                <div className="flex items-center gap-2 text-sm">
                                    <Checkbox
                                        checked={activateNow}
                                        onCheckedChange={(checked) => setActivateNow(Boolean(checked))}
                                    />
                                    <span>즉시 활성화</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">공지 내용</label>
                            <Textarea name="message" rows={4} placeholder="공지 내용을 입력하세요" />
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">시작 시간</label>
                                <input type="hidden" name="start_at" value={toDateTimeValue(startDate, startTime)} />
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <Popover open={startOpen} onOpenChange={setStartOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className={cn(
                                                    "w-full justify-start text-left font-normal",
                                                    !startDate && "text-muted-foreground"
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {startDate ? format(startDate, "yyyy-MM-dd") : "날짜 선택"}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={startDate}
                                                onSelect={(date) => {
                                                    setStartDate(date);
                                                    if (date) setStartOpen(false);
                                                }}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    <Input
                                        type="time"
                                        value={startTime}
                                        onChange={(event) => setStartTime(event.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">종료 시간</label>
                                <input type="hidden" name="end_at" value={toDateTimeValue(endDate, endTime)} />
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <Popover open={endOpen} onOpenChange={setEndOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className={cn(
                                                    "w-full justify-start text-left font-normal",
                                                    !endDate && "text-muted-foreground"
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {endDate ? format(endDate, "yyyy-MM-dd") : "날짜 선택"}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={endDate}
                                                onSelect={(date) => {
                                                    setEndDate(date);
                                                    if (date) setEndOpen(false);
                                                }}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    <Input
                                        type="time"
                                        value={endTime}
                                        onChange={(event) => setEndTime(event.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">배달일</label>
                                <input type="hidden" name="delivery_date" value={toDateValue(deliveryDate)} />
                                <Popover open={deliveryOpen} onOpenChange={setDeliveryOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !deliveryDate && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {deliveryDate ? format(deliveryDate, "yyyy-MM-dd") : "날짜 선택"}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={deliveryDate}
                                            onSelect={(date) => {
                                                setDeliveryDate(date);
                                                if (date) setDeliveryOpen(false);
                                            }}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <input type="hidden" name="is_all_products" value={isAllProducts ? "on" : ""} />
                            <div className="flex items-center gap-2 text-sm">
                                <Checkbox
                                    checked={isAllProducts}
                                    onCheckedChange={(checked) => setIsAllProducts(Boolean(checked))}
                                />
                                <span>모든 상품 대상</span>
                            </div>
                            <div className={cn("space-y-3", isAllProducts && "opacity-60")}>
                                <label className="text-sm font-medium">공지 대상 상품</label>
                                <div className="space-y-4">
                                    {groupedProducts.map(([categoryName, items]) => {
                                        const categoryIds = items.map((item: any) => item.id);
                                        const selectedCount = categoryIds.filter((id) => effectiveSelectedIds.includes(id)).length;
                                        const isChecked = selectedCount === categoryIds.length && categoryIds.length > 0;
                                        const isIndeterminate = selectedCount > 0 && selectedCount < categoryIds.length;

                                        return (
                                            <div key={categoryName} className="rounded-md border border-dashed p-3">
                                                <div className="flex items-center gap-2 rounded-md bg-muted/60 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                    <Checkbox
                                                        checked={isIndeterminate ? "indeterminate" : isChecked}
                                                        onCheckedChange={(checked) => {
                                                            setManualSelectedProductIds((prev) => {
                                                                if (checked) {
                                                                    const merged = new Set(prev);
                                                                    categoryIds.forEach((id) => merged.add(id));
                                                                    return Array.from(merged);
                                                                }
                                                                return prev.filter((id) => !categoryIds.includes(id));
                                                            });
                                                        }}
                                                        disabled={isAllProducts}
                                                    />
                                                    <span>{categoryName}</span>
                                                </div>
                                                <div className="mt-3 grid gap-2 pl-6 md:grid-cols-2 lg:grid-cols-3">
                                                    {items.map((product: any) => (
                                                        <label key={product.id} className="flex items-center gap-2 text-sm">
                                                            <Checkbox
                                                                checked={effectiveSelectedIds.includes(product.id)}
                                                                onCheckedChange={(checked) => {
                                                                    setManualSelectedProductIds((prev) => {
                                                                        if (checked) {
                                                                            return prev.includes(product.id) ? prev : [...prev, product.id];
                                                                        }
                                                                        return prev.filter((id) => id !== product.id);
                                                                    });
                                                                }}
                                                                disabled={isAllProducts}
                                                            />
                                                            <span>{product.name} ({product.name_ko || "-"})</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                {!isAllProducts && manualSelectedProductIds.map((productId) => (
                                    <input key={productId} type="hidden" name="notice_product_ids" value={productId} />
                                ))}
                            </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">전체 합계 수량 제한</label>
                                <Input name="total_limit" type="number" min="0" placeholder="예: 120" />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium">상품별 수량 제한</p>
                                    <p className="text-xs text-muted-foreground">상품별로 제한 수량을 설정합니다</p>
                                </div>
                                <Button type="button" variant="outline" size="sm" onClick={addLimitRow}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    상품 추가
                                </Button>
                            </div>
                            {limitRows.length === 0 ? (
                                <p className="text-sm text-muted-foreground">추가된 제한이 없습니다.</p>
                            ) : (
                                <div className="space-y-3">
                                    {limitRows.map((row) => (
                                        <div key={row.id} className="grid gap-3 md:grid-cols-[1fr_150px_40px] items-center">
                                            <Select
                                                value={row.productId}
                                                onValueChange={(value) => updateLimitRow(row.id, "productId", value)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="상품 선택" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {productOptions.map((option) => (
                                                        <SelectItem key={option.value} value={option.value}>
                                                            {option.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <Input
                                                type="number"
                                                min="0"
                                                placeholder="수량"
                                                value={row.maxQuantity}
                                                onChange={(event) => updateLimitRow(row.id, "maxQuantity", event.target.value)}
                                            />
                                            <Button type="button" variant="ghost" size="icon" onClick={() => removeLimitRow(row.id)}>
                                                <X className="h-4 w-4" />
                                            </Button>
                                            <input type="hidden" name="product_limit_product_id" value={row.productId} />
                                            <input type="hidden" name="product_limit_max_quantity" value={row.maxQuantity} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {actionData?.error && (
                            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                                {actionData.error}
                            </div>
                        )}

                        <Button type="submit">공지 저장</Button>
                    </form>
                </CardContent>
            </Card>
        </PageContainer>
    );
}
