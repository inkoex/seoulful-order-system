import { useNavigation, useActionData, useLoaderData, redirect, data, useSubmit, Link } from "react-router";
import { z } from "zod";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Minus, Lock, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuantitySelector } from "~/components/order/QuantitySelector";
import { OrderPriceSummary } from "~/components/order/OrderPriceSummary";
import { formatToISODate, formatCurrency, formatDisplayDate } from "~/utils/format";
import { calculateOrderTotals } from "~/utils/order";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabaseAdmin } from "@/lib/supabase.server";
import { getNoticeSnapshot } from "@/lib/notices.server";
import { PageContainer } from "@/components/ui/container";
import type { Route } from "./+types/order.edit.$id";

// --- Zod Schema ---
const editSchema = z.object({
    items: z.array(z.object({
        productId: z.string(),
        quantity: z.number().min(0),
    })).refine((items) => items.some(item => item.quantity > 0), {
        message: "최소 1개 이상의 상품을 선택해주세요",
        path: ["root"],
    }),
    delivery_date: z.date(),
    notes: z.string().optional(),
    token: z.string().uuid(),
});

type EditFormValues = z.infer<typeof editSchema>;

// --- Loader ---
export async function loader({ params, request }: Route.LoaderArgs) {
    const orderId = params.id;
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    const mode = url.searchParams.get('mode');

    if (!token) {
        return data({
            error: "접근 권한이 없습니다. 올바른 링크를 사용해주세요."
        }, { status: 403 });
    }

    const [orderResult, noticeSnapshot] = await Promise.all([
        supabaseAdmin
            .from('orders')
            .select(`
                *,
                order_items (
                    id,
                    product_id,
                    quantity,
                    unit_price,
                    subtotal
                )
            `)
            .eq('id', orderId)
            .eq('edit_token', token)
            .single(),
        getNoticeSnapshot()
    ]);

    const { data: order, error: orderError } = orderResult;

    if (orderError || !order) {
        return data({
            error: "접근 권한이 없습니다. 올바른 링크를 사용해주세요."
        }, { status: 403 });
    }

    // Fetch all products for form
    const { data: products } = await supabaseAdmin
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

    return {
        order,
        products: products || [],
        isLocked: order.is_locked,
        token,
        noticeSnapshot,
        mode
    };
}

// --- Action ---
export async function action({ request, params }: Route.ActionArgs) {
    const orderId = params.id;
    const formData = await request.formData();
    const payloadString = formData.get("payload");

    if (!payloadString || typeof payloadString !== "string") {
        return data({ error: "Invalid submission format" }, { status: 400 });
    }

    const payload = JSON.parse(payloadString);
    if (payload.delivery_date) {
        payload.delivery_date = new Date(payload.delivery_date);
    }
    const token = payload.token;

    const noticeSnapshot = await getNoticeSnapshot();
    if (!noticeSnapshot.orderingOpen) {
        return data({ error: "현재 주문 기간이 아닙니다. WhatsApp으로 문의해주세요." }, { status: 400 });
    }

    // Validate token
    const { data: existingOrder, error: fetchError } = await supabaseAdmin
        .from('orders')
        .select('edit_token, is_locked, delivery_date, created_at, order_items(product_id, quantity), notes')
        .eq('id', orderId)
        .eq('edit_token', token)
        .single();

    if (fetchError || !existingOrder) {
        return data({ error: "접근 권한이 없습니다." }, { status: 403 });
    }

    if (existingOrder.is_locked) {
        return data({
            error: "마감된 주문입니다. WhatsApp으로 연락주세요."
        }, { status: 400 });
    }

    // Validate delivery date hasn't passed
    const deliveryDate = new Date(existingOrder.delivery_date);
    deliveryDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (deliveryDate <= today) {
        return data({
            error: "배달일이 지난 주문은 수정할 수 없습니다."
        }, { status: 400 });
    }

    const notice = noticeSnapshot.notice;
    const noticeStart = notice?.start_at ? new Date(notice.start_at) : null;
    const noticeEnd = notice?.end_at ? new Date(notice.end_at) : null;
    const orderCreatedAt = existingOrder.created_at ? new Date(existingOrder.created_at) : null;

    const isWithinNoticeWindow = Boolean(
        noticeSnapshot.orderingOpen &&
        noticeStart &&
        orderCreatedAt &&
        orderCreatedAt >= noticeStart &&
        (!noticeEnd || orderCreatedAt <= noticeEnd)
    );

    if (!isWithinNoticeWindow) {
        return data({
            error: "이 주문은 이전 공지에 해당되어 수정할 수 없습니다."
        }, { status: 400 });
    }

    // Validate schema
    const result = editSchema.safeParse(payload);
    if (!result.success) {
        return data({
            error: "Validation failed",
            details: result.error.flatten()
        }, { status: 400 });
    }

    const { items, delivery_date, notes } = result.data;

    // Calculate new total
    const { data: dbProducts } = await supabaseAdmin.from('products').select('*');
    const productMap = new Map(dbProducts?.map(p => [p.id, p]) || []);

    const activeItems = items.filter(i => i.quantity > 0);
    const orderItemsData = activeItems.map(item => {
        const product = productMap.get(item.productId);
        const unitPrice = product?.price || 0;
        return {
            product_id: item.productId,
            quantity: item.quantity,
            unit_price: unitPrice,
            subtotal: unitPrice * item.quantity
        };
    });

    const totals = calculateOrderTotals(orderItemsData);
    const subtotalValue = totals.subtotal;
    const deliveryFeeValue = totals.deliveryFee;
    const finalTotalAmount = totals.total;

    // Track changes for order_history
    const changedFields: any = {};

    // Compare items
    const oldItemsMap = new Map(
        existingOrder.order_items.map((i: any) => [i.product_id, i.quantity])
    );
    const newItemsMap = new Map(
        activeItems.map(i => [i.productId, i.quantity])
    );

    const itemChanges: any = {};
    for (const [productId, newQty] of newItemsMap) {
        const oldQty = oldItemsMap.get(productId) || 0;
        if (oldQty !== newQty) {
            itemChanges[productId] = { from: oldQty, to: newQty };
        }
    }

    // Check for removed items
    for (const [productId, oldQty] of oldItemsMap) {
        if (!newItemsMap.has(productId) && oldQty > 0) {
            itemChanges[productId] = { from: oldQty, to: 0 };
        }
    }

    if (Object.keys(itemChanges).length > 0) {
        changedFields.items = itemChanges;
    }

    // Compare delivery_date
    const newDateStr = formatToISODate(delivery_date);
    if (existingOrder.delivery_date !== newDateStr) {
        changedFields.delivery_date = {
            from: existingOrder.delivery_date,
            to: newDateStr
        };
    }

    // Compare notes
    if ((existingOrder.notes || '') !== (notes || '')) {
        changedFields.notes = {
            from: existingOrder.notes || '',
            to: notes || ''
        };
    }

    // Update order
    const { error: updateError } = await supabaseAdmin
        .from('orders')
        .update({
            delivery_date: newDateStr,
            notes: notes || null,
            subtotal: subtotalValue,
            delivery_fee: deliveryFeeValue,
            total_amount: finalTotalAmount,
            updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

    if (updateError) {
        return data({
            error: "주문 수정에 실패했습니다.",
            details: updateError.message
        }, { status: 500 });
    }

    // Delete old items and insert new ones
    await supabaseAdmin.from('order_items').delete().eq('order_id', orderId);

    if (orderItemsData.length > 0) {
        const itemsToInsert = orderItemsData.map(i => ({
            ...i,
            order_id: orderId
        }));

        const { error: itemsError } = await supabaseAdmin
            .from('order_items')
            .insert(itemsToInsert);

        if (itemsError) {
            return data({
                error: "주문 상품 수정 실패",
                details: itemsError.message
            }, { status: 500 });
        }
    }

    // Log to order_history
    if (Object.keys(changedFields).length > 0) {
        await supabaseAdmin.from('order_history').insert({
            order_id: orderId,
            changed_fields: changedFields,
            changed_by: 'customer'
        });
    }

    return redirect(`/order/complete?id=${orderId}`);
}

// --- Component ---
export default function OrderEditPage() {
    const loaderData = useLoaderData<typeof loader>();
    const actionData = useActionData<typeof action>();
    const navigation = useNavigation();
    const submit = useSubmit();
    const isSubmitting = navigation.state === "submitting";

    if ('error' in loaderData) {
        return (
            <PageContainer size="narrow">
                <Card>
                    <CardHeader>
                        <CardTitle>오류</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-destructive">{loaderData.error}</p>
                        <Button asChild className="mt-4">
                            <Link to="/order/lookup">주문 조회로 돌아가기</Link>
                        </Button>
                    </CardContent>
                </Card>
            </PageContainer>
        );
    }

    const { order, products, isLocked, token, noticeSnapshot, mode } = loaderData;
    const isNoticeClosed = !noticeSnapshot?.orderingOpen;
    const isViewMode = mode === "view";

    // Map existing order items to form format
    const existingItemsMap = new Map(
        order.order_items.map((item: any) => [item.product_id, item.quantity])
    );

    const editableProducts = products.filter((product: any) => existingItemsMap.has(product.id));

    const form = useForm<EditFormValues>({
        resolver: zodResolver(editSchema),
        defaultValues: {
            items: editableProducts.map((p: any) => ({
                productId: p.id,
                quantity: Number(existingItemsMap.get(p.id) || 0)
            })),
            delivery_date: new Date(order.delivery_date),
            notes: order.notes || "",
            token,
        } as EditFormValues,
    });

    const watchedItems = useWatch({ control: form.control, name: "items" });
    const productsById = new Map(products.map((product: any) => [product.id, product]));
    const totalAmount = (watchedItems || []).reduce((total, item) => {
        const product = productsById.get(item.productId);
        const price = product?.price || 0;
        const quantity = Number(item.quantity) || 0;
        return total + price * quantity;
    }, 0);
    const deliveryFee = totalAmount > 0 && totalAmount < 500 ? 30 : 0;
    const grandTotal = totalAmount + deliveryFee;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deliveryDate = new Date(order.delivery_date);
    deliveryDate.setHours(0, 0, 0, 0);

    const notice = noticeSnapshot?.notice;
    const noticeStart = notice?.start_at ? new Date(notice.start_at) : null;
    const noticeEnd = notice?.end_at ? new Date(notice.end_at) : null;
    const orderCreatedAt = order.created_at ? new Date(order.created_at) : null;
    const isWithinNoticeWindow = Boolean(
        noticeSnapshot?.orderingOpen &&
        noticeStart &&
        orderCreatedAt &&
        orderCreatedAt >= noticeStart &&
        (!noticeEnd || orderCreatedAt <= noticeEnd)
    );

    const isDeliveryDay = deliveryDate <= today;
    const isEditingDisabled = isViewMode || isLocked || isNoticeClosed || !isWithinNoticeWindow || isDeliveryDay;

    function onSubmit(values: EditFormValues) {
        const formData = new FormData();
        const payload: EditFormValues = {
            ...values,
            delivery_date: new Date(order.delivery_date)
        };
        formData.append("payload", JSON.stringify(payload));
        submit(formData, { method: "post" });
    }

    return (
        <PageContainer size="narrow" className="py-8 md:py-12">
            <Card className="rounded-[2rem] shadow-2xl border-none bg-gradient-to-br from-white via-white to-brand-background/30">
                <CardHeader className="space-y-3 pb-2 p-6 md:p-8">
                    <div className="text-center space-y-3 animate-dynamic-reveal">
                        <span className="section-label">Edit order</span>
                        <CardTitle className="text-3xl md:text-4xl font-black text-brand-charcoal">
                            Edit Order
                        </CardTitle>
                        <CardDescription className="text-lg font-light text-brand-charcoal/50">
                            You can update your order details
                        </CardDescription>
                        <div className="mx-auto section-divider w-16 bg-brand-primary"></div>
                    </div>
                </CardHeader>
                <CardContent className="px-6 pb-6 pt-2 md:px-8 md:pb-8 md:pt-2 space-y-4">
                    {/* Locked Banner */}
                    {isEditingDisabled && (
                        <div className="mb-8 p-6 bg-gradient-to-br from-brand-charcoal/5 to-brand-charcoal/10 border-2 border-brand-charcoal/20 rounded-2xl animate-dynamic-reveal">
                            <div className="flex items-start space-x-4">
                                <div className="h-12 w-12 rounded-full bg-brand-charcoal/10 flex items-center justify-center flex-shrink-0">
                                    <Lock className="h-6 w-6 text-brand-charcoal/70" strokeWidth={2.5} />
                                </div>
                                <div className="flex-1">
                                    <p className="font-black text-brand-charcoal text-lg tracking-wide">
                                        {isLocked
                                            ? "Order is locked"
                                            : !isWithinNoticeWindow
                                                ? "This order is view-only"
                                                : isDeliveryDay
                                                    ? "Edits are closed on delivery day"
                                                    : "Order edits are currently unavailable"}
                                    </p>
                                    <p className="text-sm text-brand-charcoal/70 mt-2 leading-relaxed">
                                        {isLocked
                                            ? "This order is locked and cannot be edited. Please contact us via WhatsApp if you need changes."
                                            : !isWithinNoticeWindow
                                                ? "This order belongs to a previous notice and cannot be edited."
                                                : isDeliveryDay
                                                    ? "Edits are disabled on the delivery date. Please contact us via WhatsApp if you need changes."
                                                    : "There is no active notice, so order edits are disabled. Please contact us via WhatsApp if you need changes."}
                                    </p>
                                    <Button asChild variant="outline" className="mt-4 rounded-xl border-2 border-brand-charcoal/20 hover:border-brand-primary hover:bg-brand-primary/5" size="sm">
                                        <a href="https://wa.me/" target="_blank" rel="noopener noreferrer">
                                            <MessageCircle className="mr-2 h-4 w-4" />
                                            Contact via WhatsApp
                                        </a>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Customer Info (Read-only) */}
                    <Card className="mb-4 border-2 border-brand-charcoal/10 rounded-2xl bg-white">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg">Order details</CardTitle>
                            <CardDescription>These details cannot be changed</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-brand-charcoal/60 font-medium">Order no.</span>
                                <span className="font-bold text-brand-charcoal">{order.order_number}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-brand-charcoal/60 font-medium">Name</span>
                                <span className="text-brand-charcoal">{order.customer_name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-brand-charcoal/60 font-medium">Contact</span>
                                <span className="text-brand-charcoal">{order.phone}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-brand-charcoal/60 font-medium">Delivery address</span>
                                <span className="text-brand-charcoal">{order.apartment} - {order.tower} {order.flat_number}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-brand-charcoal/60 font-medium">Delivery date</span>
                                <span className="text-brand-charcoal">{new Date(order.delivery_date).toLocaleDateString('ko-KR')}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-brand-charcoal/60 font-medium">Payment</span>
                                <span className="text-brand-charcoal">
                                    {order.payment_method === 'upi' ? 'UPI' :
                                        order.payment_method === 'cash' ? 'Cash' : 'Other'}
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Editable Form */}
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            {/* Products */}
                            <div className="space-y-4">
                                <h3 className="font-semibold text-brand-charcoal">Items</h3>
                                {editableProducts.length === 0 ? (
                                    <p className="text-sm text-brand-charcoal/60">There are no editable items.</p>
                                ) : (
                                    <div className="space-y-4 border-2 border-brand-primary/10 rounded-2xl p-6 bg-gradient-to-br from-white to-brand-background/10">
                                        {editableProducts.map((product: any, index: number) => (
                                            <FormField
                                                key={product.id}
                                                control={form.control}
                                                name={`items.${index}.quantity`}
                                                render={({ field }) => (
                                                    <div className="flex items-center justify-between py-4 px-4 -mx-4 border-b border-brand-charcoal/5 last:border-b-0 hover:bg-brand-primary/5 rounded-xl transition-all duration-300 gap-2">
                                                        <div className="flex-1 min-w-0 pr-4">
                                                            <p className="font-bold text-brand-charcoal text-base leading-tight">{product.name}</p>
                                                            <p className="text-sm text-brand-charcoal/50 mt-0.5 leading-snug">{product.name_ko}</p>
                                                            <p className="text-brand-primary font-black mt-2 text-base">₹{product.price}</p>
                                                            <input
                                                                type="hidden"
                                                                {...form.register(`items.${index}.productId`)}
                                                                value={product.id}
                                                            />
                                                        </div>
                                                        <div className="shrink-0 flex items-center">
                                                            <QuantitySelector
                                                                value={field.value}
                                                                onChange={field.onChange}
                                                                disabled={isEditingDisabled}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            />
                                        ))}
                                        {form.formState.errors.items?.root && (
                                            <p className="text-sm font-medium text-destructive">
                                                {form.formState.errors.items.root.message}
                                            </p>
                                        )}
                                        <OrderPriceSummary
                                            subtotal={totalAmount}
                                            deliveryFee={deliveryFee}
                                            total={grandTotal}
                                            subtotalLabel="Subtotal"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Notes */}
                            <FormField
                                control={form.control}
                                name="notes"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Notes (optional)</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Add delivery notes"
                                                className="resize-none"
                                                {...field}
                                                disabled={isEditingDisabled}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {actionData?.error && (
                                <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-950 rounded-md">
                                    {actionData.error}
                                </div>
                            )}

                            <Button type="submit" variant="premium" className="w-full h-16 text-lg font-black tracking-widest" disabled={isSubmitting || isEditingDisabled}>
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    isEditingDisabled ? "View only" : "Save changes"
                                )}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </PageContainer>
    );
}
