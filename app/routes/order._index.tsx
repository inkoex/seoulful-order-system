import { useMemo } from "react";
import { Link, useNavigation, useActionData, useLoaderData, redirect, data, useSubmit } from "react-router";
import { z } from "zod";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, addDays, parseISO } from "date-fns";
import { formatToISODate, formatDisplayDate } from "~/utils/format";
import { calculateOrderTotals } from "~/utils/order";
import { CalendarIcon, Loader2, XCircle, AlertCircle } from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { QuantitySelector } from "~/components/order/QuantitySelector";
import { OrderPriceSummary } from "~/components/order/OrderPriceSummary";
import { Calendar } from "@/components/ui/calendar";
import {
    Form as UiForm,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { getNoticeSnapshot, type NoticeSnapshot } from "@/lib/notices.server";
import { PageContainer } from "@/components/ui/container";
import type { Route } from "./+types/order._index";

// --- Zod Schema ---
const phoneRegex = /^\d{10}$/;

const orderSchema = z.object({
    apartment: z.string().min(1, "Please select an apartment (아파트를 선택해주세요)"),
    tower: z.string().min(1, "Please enter your tower (동을 입력해주세요)"),
    flat_number: z.string().min(1, "Please enter your flat number (호수를 입력해주세요)"),
    customer_name: z.string().min(1, "Please enter your name (이름을 입력해주세요)"),
    phone: z.string().regex(phoneRegex, "Please enter a 10-digit number (10자리 숫자로 입력해주세요)"),
    items: z.array(z.object({
        productId: z.string(),
        quantity: z.number().min(0),
    })).refine((items) => items.some(item => item.quantity > 0), {
        message: "Please select at least 1 item (최소 1개 이상의 상품을 선택해주세요)",
        path: ["root"], // attach error to root
    }),
    delivery_date: z.date(),
    payment_method: z.enum(["upi", "cash", "other"]),
    notes: z.string().optional(),
    entry_channel: z.string(),
    confirmDuplicate: z.boolean().optional(),
});

type OrderFormValues = z.infer<typeof orderSchema>;

import { getOrSetCache } from "@/lib/cache.server";

// --- Loader ---
export async function loader() {
    // Cache TTLs
    const PRODUCT_CACHE_TTL = 60 * 1000; // 1 minute
    const APARTMENT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    // Fetch products and notice snapshot in parallel (critical path)
    const [products, noticeSnapshot] = await Promise.all([
        getOrSetCache('order-products', async () => {
            const { data } = await supabase
                .from('products')
                .select('id, name, name_ko, price, sort_order, category_id, is_active, categories(id, name, name_ko, sort_order)')
                .eq('is_active', true)
                .order('sort_order', { ascending: true });
            return data || [];
        }, PRODUCT_CACHE_TTL),
        getNoticeSnapshot()
    ]);

    // Fetch apartments synchronously for stability (especially mobile hydration)
    const apartments = await getOrSetCache('order-apartments', async () => {
        const { data } = await supabase
            .from('apartments')
            .select('id, name, name_ko, sort_order')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });
        return data || [];
    }, APARTMENT_CACHE_TTL);

    // Sort by category sort_order, then by product sort_order
    const sortedProducts = [...products].sort((a: any, b: any) => {
        const catSortA = a.categories?.sort_order ?? 999;
        const catSortB = b.categories?.sort_order ?? 999;
        if (catSortA !== catSortB) return catSortA - catSortB;
        return (a.sort_order || 0) - (b.sort_order || 0);
    });

    let visibleProducts = sortedProducts;

    if (noticeSnapshot.notice && !noticeSnapshot.notice.is_all_products) {
        const allowedIds = new Set(noticeSnapshot.targetProductIds);
        visibleProducts = sortedProducts.filter((product: any) => allowedIds.has(product.id));
    }

    return {
        products: visibleProducts,
        apartments,
        notice: noticeSnapshot
    };
}

// --- Action ---
export async function action({ request }: Route.ActionArgs) {
    const formData = await request.formData();
    // Payload parsing from JSON

    // Parse JSON payload from form submission
    const payloadString = formData.get("payload");
    if (!payloadString || typeof payloadString !== "string") {
        return data({ error: "Invalid submission format (제출 형식이 올바르지 않습니다)" }, { status: 400 });
    }

    const payload = JSON.parse(payloadString);
    // Parse dates: JSON has strings
    if (payload.delivery_date) {
        payload.delivery_date = new Date(payload.delivery_date);
    }

    const result = orderSchema.safeParse(payload);

    if (!result.success) {
        return data({ error: "Validation failed (검증에 실패했습니다)", details: result.error.flatten() }, { status: 400 });
    }

    const { items, ...orderInfo } = result.data;
    let deliveryDate = orderInfo.delivery_date;

    const noticeSnapshot = await getNoticeSnapshot();
    if (!noticeSnapshot.orderingOpen) {
        return data({ error: "Ordering is closed (현재 주문이 마감되었습니다)" }, { status: 400 });
    }

    // Duplicate Order Check (Phone + Delivery Date)
    if (!payload.confirmDuplicate) {
        const { data: existingOrders, error: checkError } = await supabase
            .from('orders')
            .select('id, order_number')
            .eq('phone', result.data.phone)
            .eq('delivery_date', format(deliveryDate, 'yyyy-MM-dd'))
            .not('status', 'eq', 'cancelled')
            .limit(1);

        if (checkError) {
            console.error("Duplicate check failed:", checkError);
        } else if (existingOrders && existingOrders.length > 0) {
            return data({
                duplicate: true,
                message: `An order already exists for this date with order number: ${existingOrders[0].order_number}. Do you want to place another order? (이미 해당 배송일에 접수된 주문이 있습니다 [주문번호: ${existingOrders[0].order_number}]. 새로 주문하시겠습니까?)`
            }, { status: 409 });
        }
    }

    if (noticeSnapshot.notice?.delivery_date) {
        const noticeDate = noticeSnapshot.notice.delivery_date;
        const requestedDate = formatToISODate(deliveryDate);
        if (requestedDate !== noticeDate) {
            deliveryDate = parseISO(noticeDate);
        }
    }

    // Filter active items (quantity > 0)
    const activeItems = items
        .filter(i => i.quantity > 0)
        .map(i => ({
            product_id: i.productId,
            quantity: i.quantity
        }));

    if (activeItems.length === 0) {
        return data({ error: "Please select at least 1 item (최소 1개 이상의 상품을 선택해주세요)" }, { status: 400 });
    }

    if (noticeSnapshot.notice) {
        const targetIds = new Set(noticeSnapshot.targetProductIds);
        const orderQuantityByProduct: Record<string, number> = {};
        let totalIncoming = 0;

        activeItems.forEach((item) => {
            if (noticeSnapshot.notice?.is_all_products || targetIds.has(item.product_id)) {
                totalIncoming += item.quantity;
                orderQuantityByProduct[item.product_id] = (orderQuantityByProduct[item.product_id] || 0) + item.quantity;
            }
        });

        if (noticeSnapshot.totals.totalMax !== null) {
            const nextTotal = noticeSnapshot.totals.totalUsed + totalIncoming;
            if (nextTotal > noticeSnapshot.totals.totalMax) {
                return data({ error: "Order limit reached. Please reduce quantity. (주문 가능 수량을 초과했습니다)" }, { status: 400 });
            }
        }

        const soldOut = Object.entries(orderQuantityByProduct).filter(([productId, quantity]) => {
            const remaining = noticeSnapshot.productRemainingById[productId];
            if (remaining === undefined) return false;
            return quantity > remaining;
        });

        if (soldOut.length > 0) {
            return data({ error: "Some items are sold out. Please adjust your order. (품절된 상품이 포함되어 있습니다)" }, { status: 400 });
        }
    }

    // Call database function to create order with items transactionally
    // This function handles:
    // - Atomic order number generation (no race condition)
    // - Transaction for order + items (all-or-nothing)
    // - Price calculation from products table
    // - Edit token generation
    const { data: orderResult, error: orderError } = await supabase
        .rpc('create_order_with_items', {
            p_apartment_id: orderInfo.apartment,  // UUID now instead of TEXT
            p_tower: orderInfo.tower,
            p_flat_number: orderInfo.flat_number,
            p_customer_name: orderInfo.customer_name,
            p_phone: orderInfo.phone,
            p_delivery_date: format(deliveryDate, 'yyyy-MM-dd'),
            p_payment_method: orderInfo.payment_method,
            p_notes: orderInfo.notes || '',
            p_entry_channel: orderInfo.entry_channel,
            p_items: activeItems
        });

    if (orderError) {
        console.error("Order Creation Error:", orderError);
        return data({
            error: "Failed to save order (주문 저장에 실패했습니다)",
            details: orderError.message
        }, { status: 500 });
    }

    if (!orderResult) {
        return data({ error: "Order creation failed (주문 생성 실패)" }, { status: 500 });
    }

    // orderResult contains: { id, order_number, edit_token, total_amount }
    return redirect(`/order/complete?id=${orderResult.id}`);
}



// Fix action types
type ActionResponse =
    | { error: string; details?: any }
    | { duplicate: boolean; message: string }
    | undefined;
// --- Component ---
export default function OrderPage({ loaderData }: Route.ComponentProps) {
    const { products, apartments, notice } = loaderData as unknown as {
        products: any[];
        apartments: any[];
        notice: NoticeSnapshot;
    };
    const orderingClosed = !notice?.orderingOpen;
    const noticeDeliveryDate = notice?.notice?.delivery_date;
    const fixedDeliveryDate = noticeDeliveryDate ? parseISO(noticeDeliveryDate) : undefined;
    const isDeliveryLocked = Boolean(noticeDeliveryDate);
    const soldOutIds = useMemo(() => new Set(notice?.soldOutProductIds || []), [notice?.soldOutProductIds]);

    if (products.length === 0) {
        return (
            <PageContainer size="narrow" className="min-h-screen flex flex-col justify-center py-12">
                <Card className="text-center rounded-[2rem] shadow-2xl border-none bg-gradient-to-br from-white via-white to-brand-background/30">
                    <CardHeader className="space-y-6 pb-8">
                        {/* Premium icon with animation */}
                        <div className="mx-auto relative animate-dynamic-reveal">
                            <div className="h-24 w-24 rounded-full bg-brand-primary/10 flex items-center justify-center backdrop-blur-sm">
                                <div className="h-20 w-20 rounded-full bg-brand-primary/20 flex items-center justify-center animate-pulse">
                                    <XCircle className="h-12 w-12 text-brand-primary" strokeWidth={2.5} />
                                </div>
                            </div>
                        </div>

                        {/* Premium typography */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <span className="section-label">Temporarily Closed</span>
                                <h1 className="text-3xl md:text-4xl font-black text-brand-charcoal">
                                    Orders Unavailable
                                </h1>
                                <p className="text-lg font-light text-brand-charcoal/50">
                                    주문 불가
                                </p>
                            </div>
                            <div className="mx-auto section-divider w-16 bg-brand-primary"></div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6 pb-8">
                        <p className="text-lg text-brand-charcoal/70 leading-relaxed max-w-md mx-auto">
                            There are no items available right now.
                            <br />
                            Please check back later.
                            <br />
                            <span className="text-brand-charcoal/50">현재 주문 가능한 상품이 없습니다</span>
                        </p>
                    </CardContent>
                    <CardFooter className="flex justify-center pb-12">
                        <Button asChild variant="premium" className="w-full max-w-sm mx-auto">
                            <Link to="/order/lookup">
                                <span>View my order</span>
                                <span className="text-xl ml-2">→</span>
                            </Link>
                        </Button>
                    </CardFooter>
                </Card>
            </PageContainer>
        );
    }

    const navigation = useNavigation();
    const submit = useSubmit();
    const isSubmitting = navigation.state === "submitting";
    const actionData = useActionData<typeof action>();
    const [duplicateWarning, setDuplicateWarning] = useMemo(() => {
        const data = actionData as any;
        if (data?.duplicate) return data;
        return null;
    }, [actionData]);

    // Safe cast for ActionData
    const errorData = actionData as ActionResponse;
    const form = useForm<OrderFormValues>({
        resolver: zodResolver(orderSchema),
        defaultValues: {
            apartment: "",
            tower: "",
            flat_number: "",
            customer_name: "",
            phone: "",
            items: products.map(p => ({ productId: p.id, quantity: 0 })),
            delivery_date: fixedDeliveryDate,
            payment_method: "upi",
            notes: "",
            entry_channel: "customer_direct",
        },
    });

    const formControl = form.control as any;
    const watchedItems = useWatch({ control: form.control, name: "items" });
    const productsById = useMemo(
        () => new Map(products.map((product) => [product.id, product])),
        [products]
    );

    const totals = useMemo(() => {
        const itemsForCalc = (watchedItems || []).map((item: any) => {
            const product = productsById.get(item.productId);
            return {
                quantity: Number(item.quantity) || 0,
                unit_price: product?.price || 0
            };
        });
        return calculateOrderTotals(itemsForCalc as any);
    }, [watchedItems, productsById]);

    function onSubmit(values: OrderFormValues) {
        // Submit form data as JSON payload

        const formData = new FormData();
        formData.append("payload", JSON.stringify(values));
        submit(formData, { method: "post" });
    }

    if (orderingClosed) {
        return (
            <PageContainer size="narrow" className="min-h-screen flex flex-col justify-center py-12">
                <Card className="text-center rounded-[2rem] shadow-2xl border-none bg-gradient-to-br from-white via-white to-brand-background/30">
                    <CardHeader className="space-y-6 pb-8">
                        {/* Premium icon with animation */}
                        <div className="mx-auto relative animate-dynamic-reveal">
                            <div className="h-24 w-24 rounded-full bg-brand-primary/10 flex items-center justify-center backdrop-blur-sm">
                                <div className="h-20 w-20 rounded-full bg-brand-primary/20 flex items-center justify-center animate-pulse">
                                    <XCircle className="h-12 w-12 text-brand-primary" strokeWidth={2.5} />
                                </div>
                            </div>
                        </div>

                        {/* Premium typography */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <span className="section-label">Temporarily Closed</span>
                                <h1 className="text-3xl md:text-4xl font-black text-brand-charcoal">
                                    Orders Unavailable
                                </h1>
                                <p className="text-lg font-light text-brand-charcoal/50">
                                    주문 불가
                                </p>
                            </div>
                            <div className="mx-auto section-divider w-16 bg-brand-primary"></div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6 pb-8">
                        <p className="text-lg text-brand-charcoal/70 leading-relaxed max-w-md mx-auto">
                            There are no items available right now.
                            <br />
                            Please check back later.
                            <br />
                            <span className="text-brand-charcoal/50">현재 주문 가능한 상품이 없습니다</span>
                        </p>
                    </CardContent>
                    <CardFooter className="flex justify-center pb-12">
                        <Button asChild variant="premium" className="w-full max-w-sm mx-auto">
                            <Link to="/order/lookup">
                                <span>View my order</span>
                                <span className="text-xl ml-2">→</span>
                            </Link>
                        </Button>
                    </CardFooter>
                </Card>
            </PageContainer>
        );
    }

    return (
        <PageContainer size="narrow" className="py-8 md:py-12">
            <Card className="rounded-[2rem] shadow-2xl border-none bg-gradient-to-br from-white via-white to-brand-background/30">
                <CardHeader className="space-y-4 pb-2 p-6 md:p-8">
                    {/* Logo with animation */}
                    <div className="animate-dynamic-reveal flex justify-center">
                        <img
                            src="/images/seoulful-logo.png"
                            alt="Seoulful Korean Bakery by Yujin"
                            className="h-auto w-full max-w-[300px]"
                        />
                    </div>

                    {/* Premium section label (landing page pattern) */}
                    <div className="text-center space-y-3 animate-dynamic-reveal [animation-delay:200ms]">
                        <span className="section-label">Pre-order now</span>
                        <h1 className="text-3xl md:text-4xl font-black text-brand-charcoal">
                            Place Your Order
                        </h1>
                        <div className="mx-auto section-divider w-16 bg-brand-primary"></div>
                    </div>
                </CardHeader>
                <CardContent className="px-6 md:px-8 pt-2 pb-6 md:pb-8 space-y-4">
                    {notice?.notice?.delivery_date && (
                        <div className="space-y-2">
                            <Label>Delivery date (배송일)</Label>
                            <div
                                className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground opacity-70 cursor-not-allowed"
                                aria-disabled="true"
                            >
                                {format(parseISO(notice.notice.delivery_date), "yyyy-MM-dd (EEE)")}
                            </div>
                            {/* Temporarily hidden - can be restored later if needed */}
                            {/* <div className="mt-2 flex flex-wrap gap-3 text-xs text-brand-charcoal/70 font-medium">
                                {notice.totals.totalRemaining !== null && (
                                    <span>
                                        Remaining: {notice.totals.totalRemaining} / {notice.totals.totalMax}
                                    </span>
                                )}
                                {notice.notice.end_at && (
                                    <span>
                                        Closes at {format(new Date(notice.notice.end_at), "yyyy. MM. dd. HH:mm:ss")}
                                    </span>
                                )}
                            </div> */}
                        </div>
                    )}
                    <UiForm {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                            {/* Apartment */}
                            <FormField
                                control={formControl}
                                name="apartment"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Apartment (아파트)</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value || ""}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select an apartment (아파트 선택)" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {apartments.map((apt) => (
                                                    <SelectItem key={apt.id} value={apt.id}>
                                                        {apt.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Tower */}
                                <FormField
                                    control={formControl}
                                    name="tower"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Tower (동)</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g., A (예: A)" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* Flat */}
                                <FormField
                                    control={formControl}
                                    name="flat_number"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Flat No. (호)</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g., 101 (예: 101)" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {/* Name */}
                            <FormField
                                control={formControl}
                                name="customer_name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Name (성함)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Your name (이름)" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Phone */}
                            <FormField
                                control={formControl}
                                name="phone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>WhatsApp No. (왓츠앱 번호)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="1234567890" type="tel" maxLength={10} {...field} />
                                        </FormControl>
                                        <FormDescription>Enter 10 digits only (숫자 10자리만 입력해주세요)</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Products */}
                            <div className="space-y-6 border-2 border-brand-primary/10 rounded-2xl p-6 bg-gradient-to-br from-white to-brand-background/10">
                                {products.map((product, index) => (
                                    <FormField
                                        key={product.id}
                                        control={formControl}
                                        name={`items.${index}.quantity`}
                                        render={({ field }) => (
                                            <div className={cn(
                                                "flex items-center justify-between py-4 px-4 -mx-4 border-b border-brand-charcoal/5 last:border-b-0 hover:bg-brand-primary/5 rounded-xl transition-all duration-300 gap-2",
                                                soldOutIds.has(product.id) && "opacity-60 bg-slate-50"
                                            )}>
                                                <div className="flex-1 min-w-0 pr-4">
                                                    <p className="font-bold text-brand-charcoal text-base leading-tight">{product.name}</p>
                                                    <p className="text-sm text-brand-charcoal/50 mt-0.5 leading-snug">{product.name_ko}</p>
                                                    <p className="text-brand-primary font-black mt-2 text-base">₹{product.price}</p>
                                                    {soldOutIds.has(product.id) && (
                                                        <div className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                                                            Sold out (품절)
                                                        </div>
                                                    )}
                                                    {/* Hidden input for productId */}
                                                    <input type="hidden" {...form.register(`items.${index}.productId`)} value={product.id} />
                                                </div>
                                                <div className="shrink-0 flex items-center">
                                                    <QuantitySelector
                                                        value={field.value}
                                                        onChange={field.onChange}
                                                        disabled={orderingClosed || soldOutIds.has(product.id)}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    />
                                ))}

                                {(() => {
                                    return (
                                        <>
                                            {form.formState.errors.root && (
                                                <p className="text-sm font-medium text-destructive">{form.formState.errors.root.message}</p>
                                            )}
                                            <OrderPriceSummary
                                                subtotal={totals.subtotal}
                                                deliveryFee={totals.deliveryFee}
                                                total={totals.total}
                                            />
                                        </>
                                    );
                                })()}
                            </div>

                            {/* Delivery Date */}
                            {isDeliveryLocked ? (
                                <FormField
                                    control={formControl}
                                    name="delivery_date"
                                    render={({ field }) => (
                                        <input
                                            type="hidden"
                                            name={field.name}
                                            ref={field.ref}
                                            value={field.value ? formatToISODate(field.value) : ""}
                                            onChange={() => null}
                                        />
                                    )}
                                />
                            ) : (
                                <FormField
                                    control={formControl}
                                    name="delivery_date"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <FormLabel>Delivery date (배달 희망일)</FormLabel>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button
                                                            variant={"outline"}
                                                            className={cn(
                                                                "w-full justify-start text-left font-normal",
                                                                !field.value && "text-muted-foreground"
                                                            )}
                                                        >
                                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                                            {field.value ? (
                                                                formatDisplayDate(field.value)
                                                            ) : (
                                                                <span>Pick a date (날짜 선택)</span>
                                                            )}
                                                        </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start">
                                                    <Calendar
                                                        mode="single"
                                                        selected={field.value}
                                                        onSelect={field.onChange}
                                                        disabled={(date) =>
                                                            date < new Date() || date > addDays(new Date(), 3)
                                                        }
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                            <FormDescription>
                                                Choose within 3 days. Orders close 8 PM the day before. (오늘부터 3일 이내 선택 가능)
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}

                            {/* Payment */}
                            <FormField
                                control={formControl}
                                name="payment_method"
                                render={({ field }) => (
                                    <FormItem className="space-y-4">
                                        <FormLabel>Payment (결제 방식)</FormLabel>
                                        <FormControl>
                                            <RadioGroup
                                                onValueChange={field.onChange}
                                                defaultValue={field.value}
                                                className="gap-3 pt-2"
                                            >
                                                <FormItem className="flex items-center space-x-3 space-y-0">
                                                    <FormControl>
                                                        <RadioGroupItem value="upi" />
                                                    </FormControl>
                                                    <FormLabel className="font-normal">UPI (GPay/PhonePe 등)</FormLabel>
                                                </FormItem>
                                                <FormItem className="flex items-center space-x-3 space-y-0">
                                                    <FormControl>
                                                        <RadioGroupItem value="cash" />
                                                    </FormControl>
                                                    <FormLabel className="font-normal">Cash (현금)</FormLabel>
                                                </FormItem>
                                                <FormItem className="flex items-center space-x-3 space-y-0">
                                                    <FormControl>
                                                        <RadioGroupItem value="other" />
                                                    </FormControl>
                                                    <FormLabel className="font-normal">Other (기타)</FormLabel>
                                                </FormItem>
                                            </RadioGroup>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Notes */}
                            <FormField
                                control={formControl}
                                name="notes"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Notes (특이사항)</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="e.g., Please leave it with security (예: 경비실에 맡겨주세요)"
                                                className="resize-none"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Server Error Message */}
                            {errorData && 'error' in errorData && (
                                <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md">
                                    {errorData.error}
                                    {errorData.details && <pre className="text-xs pt-1">{JSON.stringify(errorData.details, null, 2)}</pre>}
                                </div>
                            )}

                            <Button
                                type="submit"
                                variant="premium"
                                className="w-full h-16 text-lg font-black tracking-widest"
                                disabled={isSubmitting || products.length === 0 || orderingClosed}
                            >
                                {isSubmitting ? (
                                    <div className="flex items-center space-x-3">
                                        <Loader2 className="h-6 w-6 animate-spin" />
                                        <span>Processing your order...</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center space-x-3">
                                        <span>Place Order</span>
                                        <span className="text-2xl">→</span>
                                    </div>
                                )}
                            </Button>
                        </form>
                    </UiForm>
                </CardContent>
            </Card>

            {/* Duplicate Order Confirmation Dialog */}
            <AlertDialog open={!!duplicateWarning} onOpenChange={(open) => !open && window.location.reload()}>
                <AlertDialogContent className="rounded-3xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-amber-500" />
                            <span>Confirm Duplicate Order</span>
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-brand-charcoal/70">
                            {duplicateWarning?.message}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                        <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                const values = form.getValues();
                                const formData = new FormData();
                                formData.append("payload", JSON.stringify({ ...values, confirmDuplicate: true }));
                                submit(formData, { method: "post" });
                            }}
                            className="bg-brand-primary text-white hover:bg-brand-primary/90 rounded-full"
                        >
                            Yes, proceed anyway
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </PageContainer>
    );
}
