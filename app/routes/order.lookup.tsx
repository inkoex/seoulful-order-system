import { useActionData, useNavigation, useSubmit, data, Link } from "react-router";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabaseAdmin } from "@/lib/supabase.server";
import { getNoticeSnapshot } from "@/lib/notices.server";
import { createOrderGrant } from "@/lib/orderAccess.server";
import { PageContainer } from "@/components/ui/container";
import type { Route } from "./+types/order.lookup";

// --- Zod Schema ---
const lookupSchema = z.object({
    order_number: z.string().trim().min(1, "주문번호를 입력해주세요"),
    phone: z.string().regex(/^\d{10}$/, "10자리 숫자로 입력해주세요"),
});

type LookupFormValues = z.infer<typeof lookupSchema>;

// --- Action ---
export async function action({ request }: Route.ActionArgs) {
    const formData = await request.formData();
    const payloadString = formData.get("payload");

    if (!payloadString || typeof payloadString !== "string") {
        return data({ error: "Invalid submission format" }, { status: 400 });
    }

    const payload = JSON.parse(payloadString);
    const result = lookupSchema.safeParse(payload);

    if (!result.success) {
        return data({
            error: "Validation failed",
            details: result.error.flatten()
        }, { status: 400 });
    }

    // Access model: an order is identified by order number AND phone (both must
    // match). Runs server-side with the service role; edit_token is never selected
    // or returned. Edit access is conveyed by a short-lived signed grant instead.
    const [noticeSnapshot, ordersResult] = await Promise.all([
        getNoticeSnapshot(),
        supabaseAdmin
            .from('orders')
            .select('id, order_number, delivery_date, total_amount, status, created_at')
            .eq('order_number', result.data.order_number)
            .eq('phone', result.data.phone)
            .neq('status', 'cancelled')
            .order('delivery_date', { ascending: false })
    ]);

    const { data: orders, error } = ordersResult;

    if (error) {
        return data({
            error: "조회 중 오류가 발생했습니다.",
            details: error.message
        }, { status: 500 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const notice = noticeSnapshot.notice;
    const noticeStart = notice?.start_at ? new Date(notice.start_at) : null;
    const noticeEnd = notice?.end_at ? new Date(notice.end_at) : null;

    const ordersWithEdit = (orders || []).map((order: any) => {
        const deliveryDate = new Date(order.delivery_date);
        deliveryDate.setHours(0, 0, 0, 0);
        const createdAt = order.created_at ? new Date(order.created_at) : null;
        const inNoticeWindow = Boolean(
            noticeSnapshot.orderingOpen &&
            noticeStart &&
            createdAt &&
            createdAt >= noticeStart &&
            (!noticeEnd || createdAt <= noticeEnd)
        );
        const canEdit = inNoticeWindow && deliveryDate > today;
        return { ...order, can_edit: canEdit, grant: createOrderGrant(order.id) };
    });

    return data({ success: true, orders: ordersWithEdit });
}

// --- Component ---
export default function OrderLookupPage() {
    const actionData = useActionData<typeof action>();
    const navigation = useNavigation();
    const submit = useSubmit();
    const isSubmitting = navigation.state === "submitting";

    const form = useForm<LookupFormValues>({
        resolver: zodResolver(lookupSchema),
        defaultValues: { order_number: "", phone: "" },
    });
    const statusLabel: Record<string, string> = {
        received: "Received",
        ready: "Ready",
        delivered: "Delivered",
        paid: "Paid",
        cancelled: "Cancelled",
    };
    const statusClassName: Record<string, string> = {
        received: "text-yellow-600 dark:text-yellow-400",
        ready: "text-blue-600 dark:text-blue-400",
        delivered: "text-green-600 dark:text-green-400",
        paid: "text-emerald-700 dark:text-emerald-400",
        cancelled: "text-muted-foreground",
    };

    function onSubmit(values: LookupFormValues) {
        const formData = new FormData();
        formData.append("payload", JSON.stringify(values));
        submit(formData, { method: "post" });
    }

    return (
        <PageContainer size="narrow" className="py-8 md:py-12">
            <Card className="rounded-[2rem] shadow-2xl border-none bg-gradient-to-br from-white via-white to-brand-background/30">
                <CardHeader className="space-y-4 pb-2 p-6 md:p-8">
                    <div className="text-center space-y-3 animate-dynamic-reveal">
                        <span className="section-label">Order lookup</span>
                        <CardTitle className="text-3xl md:text-4xl font-black text-brand-charcoal">
                            Find your order
                        </CardTitle>
                        <CardDescription className="text-lg font-light text-brand-charcoal/50">
                            Enter your phone number to view your orders
                        </CardDescription>
                        <div className="mx-auto section-divider w-16 bg-brand-primary"></div>
                    </div>
                </CardHeader>
                <CardContent className="px-6 pb-6 pt-2 md:px-8 md:pb-8 md:pt-2">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <FormField
                                control={form.control}
                                name="order_number"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Order number</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="ORD-260706-001"
                                                type="text"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            The order number from your confirmation
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="phone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>WhatsApp number</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="1234567890"
                                                type="tel"
                                                maxLength={10}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            Enter the 10-digit number used for your order
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {actionData && 'error' in actionData && (
                                <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-950 rounded-md">
                                    {actionData.error}
                                </div>
                            )}

                            <Button type="submit" variant="premium" className="w-full h-16 text-lg font-black tracking-widest" disabled={isSubmitting}>
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        Searching...
                                    </>
                                ) : (
                                    "Find order"
                                )}
                            </Button>
                        </form>
                    </Form>

                    {/* Results Section */}
                    {actionData && 'success' in actionData && (
                        <div className="mt-8">
                            {actionData.orders.length === 0 ? (
                                <div className="text-center py-8">
                                    <p className="text-brand-charcoal/60">No orders found.</p>
                                    <Button asChild className="mt-4" variant="outline">
                                        <Link to="/order">Place a new order</Link>
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <h3 className="font-semibold text-lg text-brand-charcoal">Orders</h3>
                                    {actionData.orders.map((order: any) => (
                                        <Card key={order.id} className="border-2 border-brand-charcoal/10 rounded-2xl">
                                            <CardContent className="pt-6">
                                                <div className="space-y-2">
                                                    <div className="flex justify-between">
                                                        <span className="text-sm text-brand-charcoal/60">Order no.</span>
                                                        <span className="font-bold text-brand-charcoal">{order.order_number}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-sm text-brand-charcoal/60">Delivery date</span>
                                                        <span className="text-brand-charcoal">{new Date(order.delivery_date).toLocaleDateString('en-US')}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-sm text-brand-charcoal/60">Total</span>
                                                        <span className="font-bold text-brand-charcoal">₹{order.total_amount}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-sm text-brand-charcoal/60">Status</span>
                                                        <span className={cn(statusClassName[order.status] || "text-brand-charcoal/60")}>
                                                            {statusLabel[order.status] || order.status}
                                                        </span>
                                                    </div>
                                                </div>
                                                <Button asChild className="w-full mt-4" variant="outline">
                                                    <Link to={`/order/edit/${order.id}?g=${order.grant}${order.can_edit ? "" : "&mode=view"}`}>
                                                        {order.can_edit ? "Edit order" : "View order"}
                                                    </Link>
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </PageContainer>
    );
}
