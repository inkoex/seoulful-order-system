import { useNavigation, useActionData, useLoaderData, redirect, data, useSubmit, Link } from "react-router";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Plus, Minus, Lock, MessageCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
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

    if (!token) {
        return data({
            error: "접근 권한이 없습니다. 올바른 링크를 사용해주세요."
        }, { status: 403 });
    }

    // Fetch order with items
    const { data: order, error: orderError } = await supabase
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
        .single();

    if (orderError || !order) {
        return data({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
    }

    // Verify token
    if (order.edit_token !== token) {
        return data({
            error: "접근 권한이 없습니다. 올바른 토큰을 사용해주세요."
        }, { status: 403 });
    }

    // Fetch all products for form
    const { data: products } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

    return {
        order,
        products: products || [],
        isLocked: order.is_locked,
        token
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
    const token = payload.token;

    // Validate token
    const { data: existingOrder, error: fetchError } = await supabase
        .from('orders')
        .select('edit_token, is_locked, delivery_date, order_items(product_id, quantity), notes')
        .eq('id', orderId)
        .single();

    if (fetchError || !existingOrder) {
        return data({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
    }

    if (existingOrder.edit_token !== token) {
        return data({ error: "접근 권한이 없습니다." }, { status: 403 });
    }

    if (existingOrder.is_locked) {
        return data({
            error: "마감된 주문입니다. WhatsApp으로 연락주세요."
        }, { status: 400 });
    }

    // Validate delivery date hasn't passed
    const deliveryDate = new Date(existingOrder.delivery_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (deliveryDate < today) {
        return data({
            error: "배달일이 지난 주문은 수정할 수 없습니다."
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
    const { data: dbProducts } = await supabase.from('products').select('*');
    const productMap = new Map(dbProducts?.map(p => [p.id, p]) || []);

    let totalAmount = 0;
    const activeItems = items.filter(i => i.quantity > 0);
    const orderItemsData = activeItems.map(item => {
        const product = productMap.get(item.productId);
        const unitPrice = product?.price || 0;
        const subtotal = unitPrice * item.quantity;
        totalAmount += subtotal;
        return {
            product_id: item.productId,
            quantity: item.quantity,
            unit_price: unitPrice,
            subtotal
        };
    });

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
    const newDateStr = delivery_date.toISOString().split('T')[0];
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
    const { error: updateError } = await supabase
        .from('orders')
        .update({
            delivery_date: newDateStr,
            notes: notes || null,
            total_amount: totalAmount,
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
    await supabase.from('order_items').delete().eq('order_id', orderId);

    if (orderItemsData.length > 0) {
        const itemsToInsert = orderItemsData.map(i => ({
            ...i,
            order_id: orderId
        }));

        const { error: itemsError } = await supabase
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
        await supabase.from('order_history').insert({
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

    const { order, products, isLocked, token } = loaderData;

    // Map existing order items to form format
    const existingItemsMap = new Map(
        order.order_items.map((item: any) => [item.product_id, item.quantity])
    );

    const form = useForm<EditFormValues>({
        resolver: zodResolver(editSchema),
        defaultValues: {
            items: products.map((p: any) => ({
                productId: p.id,
                quantity: Number(existingItemsMap.get(p.id) || 0)
            })),
            delivery_date: new Date(order.delivery_date),
            notes: order.notes || "",
            token,
        } as EditFormValues,
    });

    function onSubmit(values: EditFormValues) {
        const formData = new FormData();
        formData.append("payload", JSON.stringify(values));
        submit(formData, { method: "post" });
    }

    return (
        <PageContainer size="narrow">
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl">주문 수정</CardTitle>
                    <CardDescription>
                        주문 내용을 변경하실 수 있습니다
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {/* Locked Banner */}
                    {isLocked && (
                        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950 border-2 border-amber-200 dark:border-amber-800 rounded-lg">
                            <div className="flex items-start space-x-3">
                                <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                                <div className="flex-1">
                                    <p className="font-medium text-amber-800 dark:text-amber-200">
                                        마감된 주문입니다
                                    </p>
                                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                                        이 주문은 마감되어 수정할 수 없습니다.
                                        변경이 필요하시면 WhatsApp으로 연락주세요.
                                    </p>
                                    <Button asChild variant="outline" className="mt-3" size="sm">
                                        <a href="https://wa.me/" target="_blank" rel="noopener noreferrer">
                                            <MessageCircle className="mr-2 h-4 w-4" />
                                            WhatsApp으로 문의
                                        </a>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Customer Info (Read-only) */}
                    <Card className="mb-6 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                        <CardHeader>
                            <CardTitle className="text-lg">주문 정보</CardTitle>
                            <CardDescription>변경할 수 없는 정보입니다</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">주문번호</span>
                                <span className="font-medium">{order.order_number}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">고객명</span>
                                <span>{order.customer_name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">연락처</span>
                                <span>{order.phone}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">배달 주소</span>
                                <span>{order.apartment} - {order.tower}동 {order.flat_number}호</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">결제 방식</span>
                                <span>
                                    {order.payment_method === 'upi' ? 'UPI' :
                                        order.payment_method === 'cash' ? '현금' : '기타'}
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Editable Form */}
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            {/* Products */}
                            <div className="space-y-4">
                                <h3 className="font-semibold">상품 선택</h3>
                                {products.map((product: any, index: number) => (
                                    <FormField
                                        key={product.id}
                                        control={form.control}
                                        name={`items.${index}.quantity`}
                                        render={({ field }) => (
                                            <div className="flex items-center justify-between p-3 border rounded-md">
                                                <div>
                                                    <p className="font-medium">{product.name_ko}</p>
                                                    <p className="text-sm text-muted-foreground">₹{product.price}</p>
                                                    <input
                                                        type="hidden"
                                                        {...form.register(`items.${index}.productId`)}
                                                        value={product.id}
                                                    />
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        onClick={() => {
                                                            const newValue = Math.max(0, Number(field.value) - 1);
                                                            field.onChange(newValue);
                                                        }}
                                                        disabled={isLocked || Number(field.value) <= 0}
                                                    >
                                                        <Minus className="h-4 w-4" />
                                                    </Button>
                                                    <span className="w-12 text-center font-medium">{field.value}</span>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        onClick={() => {
                                                            const newValue = Number(field.value) + 1;
                                                            field.onChange(newValue);
                                                        }}
                                                        disabled={isLocked}
                                                    >
                                                        <Plus className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    />
                                ))}
                                {form.formState.errors.items?.root && (
                                    <p className="text-sm text-destructive">
                                        {form.formState.errors.items.root.message}
                                    </p>
                                )}
                            </div>

                            {/* Delivery Date */}
                            <FormField
                                control={form.control}
                                name="delivery_date"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>배달 날짜</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant="outline"
                                                        className={cn(
                                                            "w-full pl-3 text-left font-normal",
                                                            !field.value && "text-muted-foreground"
                                                        )}
                                                        disabled={isLocked}
                                                    >
                                                        {field.value ? (
                                                            format(field.value, "PPP")
                                                        ) : (
                                                            <span>날짜를 선택하세요</span>
                                                        )}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={field.value}
                                                    onSelect={field.onChange}
                                                    disabled={(date) => date < new Date()}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Notes */}
                            <FormField
                                control={form.control}
                                name="notes"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>요청사항 (Optional)</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="배송 시 요청사항을 입력해주세요"
                                                className="resize-none"
                                                {...field}
                                                disabled={isLocked}
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

                            <Button type="submit" className="w-full" disabled={isSubmitting || isLocked}>
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        저장 중...
                                    </>
                                ) : (
                                    "수정 완료"
                                )}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </PageContainer>
    );
}
