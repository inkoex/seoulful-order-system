import { useEffect, useState } from "react";
import { Form, useNavigation, useActionData, useLoaderData, redirect, data, useSubmit, Link } from "react-router";
import { z } from "zod";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, addDays } from "date-fns";
import { CalendarIcon, Loader2, Plus, Minus, ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabaseAdmin } from "@/lib/supabase.server";
import { requireAuth } from "@/lib/auth.server";
import { PageContainer } from "@/components/ui/container";
import type { Route } from "./+types/admin.orders.new";

// --- Zod Schema ---
const phoneRegex = /^\d{10}$/;

const orderSchema = z.object({
    apartment: z.string().min(1, "아파트를 선택해주세요"),
    tower: z.string().min(1, "동/타워를 입력해주세요"),
    flat_number: z.string().min(1, "호수를 입력해주세요"),
    customer_name: z.string().min(1, "이름을 입력해주세요"),
    phone: z.string().regex(phoneRegex, "10자리 숫자로 입력해주세요"),
    items: z.array(z.object({
        productId: z.string(),
        quantity: z.number().min(0),
    })).refine((items) => items.some(item => item.quantity > 0), {
        message: "최소 1개 이상의 상품을 선택해주세요",
        path: ["root"],
    }),
    delivery_date: z.date(),
    payment_method: z.enum(["upi", "cash", "other"]),
    notes: z.string().optional(),
    entry_channel: z.string(),
});

type OrderFormValues = z.infer<typeof orderSchema>;

// --- Loader ---
export async function loader({ request }: Route.LoaderArgs) {
    await requireAuth(request);

    const { data: products, error } = await supabaseAdmin
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

    if (error || !products || products.length === 0) {
        console.warn("No active products found", error);
        return data({ products: [], apartments: [] });
    }

    // Fetch apartments
    const { data: apartments, error: aptError } = await supabaseAdmin
        .from('apartments')
        .select('id, name, name_ko, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

    if (aptError || !apartments || apartments.length === 0) {
        console.warn("No active apartments found", aptError);
        return data({
            products,
            apartments: [
                { id: 'fallback-1', name: 'Karle', name_ko: '칼레' },
                { id: 'fallback-2', name: 'Other', name_ko: '기타' }
            ]
        });
    }

    return data({ products, apartments });
}

// --- Action ---
export async function action({ request }: Route.ActionArgs) {
    await requireAuth(request);

    const formData = await request.formData();
    const payloadString = formData.get("payload");

    if (!payloadString || typeof payloadString !== "string") {
        return data({ error: "Invalid submission format" }, { status: 400 });
    }

    const payload = JSON.parse(payloadString);
    if (payload.delivery_date) {
        payload.delivery_date = new Date(payload.delivery_date);
    }

    const result = orderSchema.safeParse(payload);

    if (!result.success) {
        return data({ error: "Validation failed", details: result.error.flatten() }, { status: 400 });
    }

    const { items, ...orderInfo } = result.data;

    // Filter active items (quantity > 0)
    const activeItems = items
        .filter(i => i.quantity > 0)
        .map(i => ({
            product_id: i.productId,
            quantity: i.quantity
        }));

    if (activeItems.length === 0) {
        return data({ error: "최소 1개 이상의 상품을 선택해주세요" }, { status: 400 });
    }

    // Call database function to create order with items transactionally
    // Using supabaseAdmin to bypass RLS (admin operation)
    // This function handles:
    // - Atomic order number generation (no race condition)
    // - Transaction for order + items (all-or-nothing)
    // - Price calculation from products table
    // - Edit token generation
    const { data: orderResult, error: orderError } = await supabaseAdmin
        .rpc('create_order_with_items', {
            p_apartment_id: orderInfo.apartment,
            p_tower: orderInfo.tower,
            p_flat_number: orderInfo.flat_number,
            p_customer_name: orderInfo.customer_name,
            p_phone: orderInfo.phone,
            p_delivery_date: format(orderInfo.delivery_date, 'yyyy-MM-dd'),
            p_payment_method: orderInfo.payment_method,
            p_notes: orderInfo.notes || '',
            p_entry_channel: 'admin_whatsapp', // ADMIN-SPECIFIC
            p_items: activeItems
        });

    if (orderError) {
        console.error("Order Creation Error:", orderError);
        return data({
            error: "주문 저장에 실패했습니다.",
            details: orderError.message
        }, { status: 500 });
    }

    if (!orderResult) {
        return data({ error: "주문 생성 실패" }, { status: 500 });
    }

    // orderResult contains: { id, order_number, edit_token, total_amount }
    throw redirect("/admin/orders"); // Redirect to admin orders list
}

type ActionResponse =
    | { error: string; details?: any }
    | undefined;

export default function AdminOrderNewPage() {
    const { products, apartments } = useLoaderData<typeof loader>();
    const navigation = useNavigation();
    const submit = useSubmit();
    const isSubmitting = navigation.state === "submitting";
    const actionData = useActionData<typeof action>();

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
            payment_method: "upi",
            notes: "",
            entry_channel: "admin_whatsapp",
        },
    });

    const formControl = form.control as any;

    function onSubmit(values: OrderFormValues) {
        const formData = new FormData();
        formData.append("payload", JSON.stringify(values));
        submit(formData, { method: "post" });
    }

    return (
        <PageContainer size="standard">
            <div className="mb-8">
                <Button asChild variant="ghost" size="sm" className="mb-4">
                    <Link to="/admin/orders">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        주문 목록으로
                    </Link>
                </Button>
                <h1 className="text-3xl font-bold">WhatsApp 주문 대신 입력</h1>
                <p className="text-muted-foreground mt-1">WhatsApp으로 받은 주문을 시스템에 등록합니다</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>주문 정보</CardTitle>
                    <CardDescription>
                        고객 정보와 주문 상품을 입력해주세요
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <UiForm {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                            <FormField
                                control={formControl}
                                name="apartment"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>아파트 (Apartment) *</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="아파트 선택" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {apartments.map((apartment) => (
                                                    <SelectItem key={apartment.id} value={apartment.id}>
                                                        {apartment.name_ko} ({apartment.name})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={formControl}
                                    name="tower"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>동/타워 (Tower) *</FormLabel>
                                            <FormControl>
                                                <Input placeholder="예: A" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={formControl}
                                    name="flat_number"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>호수 (Flat No.) *</FormLabel>
                                            <FormControl>
                                                <Input placeholder="예: 101" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={formControl}
                                name="customer_name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>성함 (Name) *</FormLabel>
                                        <FormControl>
                                            <Input placeholder="홍길동" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={formControl}
                                name="phone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>연락처 (Phone) *</FormLabel>
                                        <FormControl>
                                            <Input placeholder="1234567890" type="tel" maxLength={10} {...field} />
                                        </FormControl>
                                        <FormDescription>숫자 10자리만 입력해주세요</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="space-y-4 border rounded-md p-4">
                                <p className="text-sm font-medium mb-2">주문 상품 (Menu) *</p>
                                {products.map((product, index) => (
                                    <FormField
                                        key={product.id}
                                        control={formControl}
                                        name={`items.${index}.quantity`}
                                        render={({ field }) => (
                                            <div className="flex items-center justify-between">
                                                <div className="text-sm">
                                                    <p className="font-medium">{product.name_ko}</p>
                                                    <p className="text-xs text-muted-foreground">{product.name} - ₹{product.price}</p>
                                                    <input type="hidden" {...form.register(`items.${index}.productId`)} value={product.id} />
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={() => {
                                                            const val = Number(field.value);
                                                            if (val > 0) field.onChange(val - 1);
                                                        }}
                                                    >
                                                        <Minus className="h-4 w-4" />
                                                    </Button>
                                                    <span className="w-6 text-center">{field.value}</span>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={() => {
                                                            const val = Number(field.value);
                                                            field.onChange(val + 1);
                                                        }}
                                                    >
                                                        <Plus className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    />
                                ))}
                                {form.formState.errors.root && (
                                    <p className="text-sm font-medium text-destructive">{form.formState.errors.root.message}</p>
                                )}
                            </div>

                            <FormField
                                control={formControl}
                                name="delivery_date"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>배달 희망일 (Date) *</FormLabel>
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
                                                            format(field.value, "PPP")
                                                        ) : (
                                                            <span>날짜 선택 (Pick a date)</span>
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
                                                        date < new Date() || date > addDays(new Date(), 30)
                                                    }
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                        <FormDescription>
                                            오늘부터 30일 이내 선택 가능
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={formControl}
                                name="payment_method"
                                render={({ field }) => (
                                    <FormItem className="space-y-4">
                                        <FormLabel>결제 방식 (Payment) *</FormLabel>
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
                                                    <FormLabel className="font-normal">현금 (Cash)</FormLabel>
                                                </FormItem>
                                                <FormItem className="flex items-center space-x-3 space-y-0">
                                                    <FormControl>
                                                        <RadioGroupItem value="other" />
                                                    </FormControl>
                                                    <FormLabel className="font-normal">기타 (Other)</FormLabel>
                                                </FormItem>
                                            </RadioGroup>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={formControl}
                                name="notes"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>특이사항 (Notes)</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="예: 경비실에 맡겨주세요"
                                                className="resize-none"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {errorData?.error && (
                                <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-950 rounded-md">
                                    {errorData.error}
                                    {errorData.details && <pre className="text-xs pt-1">{JSON.stringify(errorData.details, null, 2)}</pre>}
                                </div>
                            )}

                            <div className="flex gap-3">
                                <Button type="submit" className="flex-1" disabled={isSubmitting}>
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            주문 등록 중...
                                        </>
                                    ) : (
                                        "주문 등록"
                                    )}
                                </Button>
                                <Button type="button" variant="outline" asChild>
                                    <Link to="/admin/orders">취소</Link>
                                </Button>
                            </div>
                        </form>
                    </UiForm>
                </CardContent>
            </Card>
        </PageContainer>
    );
}
