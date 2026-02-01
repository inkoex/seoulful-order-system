import { useEffect, useMemo, useState } from "react";
import { Link, Form, useNavigation, useActionData, useLoaderData, redirect, data, useSubmit } from "react-router";
import { z } from "zod";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, addDays } from "date-fns";
import { CalendarIcon, Loader2, Plus, Minus } from "lucide-react";

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
import { supabase } from "@/lib/supabase";
import { PageContainer } from "@/components/ui/container";
import type { Route } from "./+types/_index";

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
        path: ["root"], // attach error to root
    }),
    delivery_date: z.date(),
    payment_method: z.enum(["upi", "cash", "other"]),
    notes: z.string().optional(),
    entry_channel: z.string(),
});

type OrderFormValues = z.infer<typeof orderSchema>;

// --- Loader ---
export async function loader() {
    // Fetch products from Supabase with category info
    // Use anon key which is fine for Select on products (if RLS allows)

    const { data: products, error } = await supabase
        .from('products')
        .select(`
            *,
            categories (
                id,
                name,
                name_ko,
                sort_order
            )
        `)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

    // Fetch apartments
    const { data: apartments, error: aptError } = await supabase
        .from('apartments')
        .select('id, name, name_ko, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

    if (error) {
        console.error("Supabase products fetch error", error);
        return { products: [], apartments: [] };
    }

    if (aptError) {
        console.error("Supabase apartments fetch error", aptError);
        return { products: [], apartments: [] };
    }

    // Sort by category sort_order, then by product sort_order
    const sortedProducts = (products || []).sort((a: any, b: any) => {
        const catSortA = a.categories?.sort_order ?? 999;
        const catSortB = b.categories?.sort_order ?? 999;
        if (catSortA !== catSortB) return catSortA - catSortB;
        return (a.sort_order || 0) - (b.sort_order || 0);
    });

    return { products: sortedProducts, apartments: apartments || [] };
}

// --- Action ---
export async function action({ request }: Route.ActionArgs) {
    const formData = await request.formData();
    const rawData = Object.fromEntries(formData);

    // Reconstruct items from formData (since it's typically flat)
    // But standard Form submission converts nested objects poorly unless handled.
    // We will submit a JSON string for items or parse fields carefully.
    // EASIER: The client side uses RHF. We can submit the whole form as JSON via useSubmit?
    // OR: standard formData.
    // Let's rely on `remix-hook-form` pattern or just parse the JSON payload if we send it as such.
    // For simplicity, let's assume we submit standard form data.
    // Zod parsing of FormData is tricky with arrays.
    // We'll read the 'payload' field if we stringify on submit, OR parse manually.

    const payloadString = formData.get("payload");
    if (!payloadString || typeof payloadString !== "string") {
        return data({ error: "Invalid submission format" }, { status: 400 });
    }

    const payload = JSON.parse(payloadString);
    // Parse dates: JSON has strings
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
            p_delivery_date: format(orderInfo.delivery_date, 'yyyy-MM-dd'),
            p_payment_method: orderInfo.payment_method,
            p_notes: orderInfo.notes || '',
            p_entry_channel: orderInfo.entry_channel,
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
    return redirect(`/order/complete?id=${orderResult.id}`);
}



// Fix action types
type ActionResponse =
    | { error: string; details?: any }
    | undefined;
// --- Component ---
export default function OrderPage({ loaderData }: Route.ComponentProps) {
    const { products, apartments } = loaderData as unknown as { products: any[]; apartments: any[] };

    if (products.length === 0) {
        return (
            <PageContainer size="narrow">
                <Card>
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl font-bold">주문 불가 안내</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center py-10 space-y-4">
                        <p className="text-muted-foreground">
                            현재 주문 가능한 상품이 없습니다.<br />
                            잠시 후 다시 방문해 주세요.
                        </p>
                        <Button asChild variant="outline">
                            <Link to="/order/lookup">내 주문 조회하기</Link>
                        </Button>
                    </CardContent>
                </Card>
            </PageContainer>
        );
    }

    const navigation = useNavigation();
    const submit = useSubmit();
    const isSubmitting = navigation.state === "submitting";
    const actionData = useActionData<typeof action>();

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
    const totalAmount = useMemo(() => {
        if (!watchedItems) return 0;
        return watchedItems.reduce((total, item) => {
            const product = productsById.get(item.productId);
            const price = product?.price || 0;
            const quantity = Number(item.quantity) || 0;
            return total + price * quantity;
        }, 0);
    }, [productsById, watchedItems]);
    const deliveryFee = totalAmount > 0 && totalAmount < 500 ? 30 : 0;
    const grandTotal = totalAmount + deliveryFee;

    function onSubmit(values: OrderFormValues) {
        // Remove items with 0 quantity (except validation handles it)
        // Actually we keep them in values but server filters? 
        // Logic: We must submit `items` array.

        // Filter out 0 items for cleaner payload? 
        // But index matching is important if we use field array mapping by index.
        // Let's just submit specific product qtys.

        const formData = new FormData();
        formData.append("payload", JSON.stringify(values));
        submit(formData, { method: "post" });
    }

    return (
        <PageContainer size="narrow">
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl font-bold text-center">Seoulful 주문서</CardTitle>
                    <CardDescription className="text-center">
                        정성을 담아 만듭니다. 아래 정보를 입력해주세요.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <UiForm {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                            {/* Apartment */}
                            <FormField
                                control={formControl}
                                name="apartment"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>아파트 (Apartment)</FormLabel>
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

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Tower */}
                                <FormField
                                    control={formControl}
                                    name="tower"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>동/타워 (Tower)</FormLabel>
                                            <FormControl>
                                                <Input placeholder="예: A" {...field} />
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
                                            <FormLabel>호수 (Flat No.)</FormLabel>
                                            <FormControl>
                                                <Input placeholder="예: 101" {...field} />
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
                                        <FormLabel>성함 (Name)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="홍길동" {...field} />
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
                                        <FormLabel>연락처 (Phone)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="1234567890" type="tel" maxLength={10} {...field} />
                                        </FormControl>
                                        <FormDescription>숫자 10자리만 입력해주세요</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Products */}
                            <div className="space-y-4 border rounded-md p-4">
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
                                                    {/* Hidden input for productId */}
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
                                <div className="border-t pt-3 space-y-2 text-sm">
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">선택 합계</span>
                                        <span className="font-semibold">₹{totalAmount}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">배달비 (₹500 이상 무료)</span>
                                        <span className={deliveryFee ? "font-semibold" : "text-muted-foreground"}>
                                            {deliveryFee ? `₹${deliveryFee}` : "무료"}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between font-semibold">
                                        <span>예상 합계</span>
                                        <span>₹{grandTotal}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Delivery Date */}
                            <FormField
                                control={formControl}
                                name="delivery_date"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>배달 희망일 (Date)</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant={"outline"}
                                                        className={cn(
                                                            "w-full pl-3 text-left font-normal",
                                                            !field.value && "text-muted-foreground"
                                                        )}
                                                    >
                                                        {field.value ? (
                                                            format(field.value, "PPP")
                                                        ) : (
                                                            <span>날짜 선택 (Pick a date)</span>
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
                                                    disabled={(date) =>
                                                        date < new Date() || date > addDays(new Date(), 3)
                                                    }
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                        <FormDescription>
                                            오늘부터 3일 이내 선택 가능. 전날 오후 8시 마감.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Payment */}
                            <FormField
                                control={formControl}
                                name="payment_method"
                                render={({ field }) => (
                                    <FormItem className="space-y-4">
                                        <FormLabel>결제 방식 (Payment)</FormLabel>
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

                            {/* Notes */}
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

                            {/* Server Error Message */}
                            {errorData?.error && (
                                <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md">
                                    {errorData.error}
                                    {errorData.details && <pre className="text-xs pt-1">{JSON.stringify(errorData.details, null, 2)}</pre>}
                                </div>
                            )}

                            <Button type="submit" className="w-full" disabled={isSubmitting || products.length === 0}>
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        주문 접수 중...
                                    </>
                                ) : (
                                    "주문하기 (Order)"
                                )}
                            </Button>
                        </form>
                    </UiForm>
                </CardContent>
            </Card>
        </PageContainer>
    );
}
