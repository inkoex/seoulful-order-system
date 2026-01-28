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
import { supabase } from "@/lib/supabase";
import { PageContainer } from "@/components/ui/container";
import type { Route } from "./+types/order.lookup";

// --- Zod Schema ---
const lookupSchema = z.object({
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

    // Query orders by phone
    const { data: orders, error } = await supabase
        .from('orders')
        .select('id, order_number, delivery_date, total_amount, status')
        .eq('phone', result.data.phone)
        .in('status', ['received', 'ready', 'delivered', 'paid'])
        .order('delivery_date', { ascending: false });

    if (error) {
        return data({
            error: "조회 중 오류가 발생했습니다.",
            details: error.message
        }, { status: 500 });
    }

    return data({ success: true, orders: orders || [] });
}

// --- Component ---
export default function OrderLookupPage() {
    const actionData = useActionData<typeof action>();
    const navigation = useNavigation();
    const submit = useSubmit();
    const isSubmitting = navigation.state === "submitting";

    const form = useForm<LookupFormValues>({
        resolver: zodResolver(lookupSchema),
        defaultValues: { phone: "" },
    });
    const statusLabel: Record<string, string> = {
        received: "접수됨",
        ready: "생산 완료",
        delivered: "배달 완료",
        paid: "지불 완료",
        cancelled: "취소됨",
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
        <PageContainer size="narrow">
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl">주문 조회</CardTitle>
                    <CardDescription>
                        연락처를 입력하여 주문 내역을 확인하세요
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <FormField
                                control={form.control}
                                name="phone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>연락처 (Phone)</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="1234567890"
                                                type="tel"
                                                maxLength={10}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            주문 시 입력한 연락처 10자리를 입력해주세요
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

                            <Button type="submit" className="w-full" disabled={isSubmitting}>
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        조회 중...
                                    </>
                                ) : (
                                    "주문 조회"
                                )}
                            </Button>
                        </form>
                    </Form>

                    {/* Results Section */}
                    {actionData && 'success' in actionData && (
                        <div className="mt-8">
                            {actionData.orders.length === 0 ? (
                                <div className="text-center py-8">
                                    <p className="text-muted-foreground">주문 내역이 없습니다.</p>
                                    <Button asChild className="mt-4" variant="outline">
                                        <Link to="/">새 주문하기</Link>
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <h3 className="font-semibold text-lg">주문 내역</h3>
                                    {actionData.orders.map((order: any) => (
                                        <Card key={order.id}>
                                            <CardContent className="pt-6">
                                                <div className="space-y-2">
                                                    <div className="flex justify-between">
                                                        <span className="text-sm text-muted-foreground">주문번호</span>
                                                        <span className="font-medium">{order.order_number}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-sm text-muted-foreground">배달일</span>
                                                        <span>{new Date(order.delivery_date).toLocaleDateString('ko-KR')}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-sm text-muted-foreground">금액</span>
                                                        <span className="font-bold">₹{order.total_amount}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-sm text-muted-foreground">상태</span>
                                                        <span className={cn(statusClassName[order.status] || "text-muted-foreground")}>
                                                            {statusLabel[order.status] || order.status}
                                                        </span>
                                                    </div>
                                                </div>
                                                <Button asChild className="w-full mt-4" variant="outline">
                                                    <Link to={`/order/edit/${order.id}?token=${order.edit_token}`}>
                                                        주문 보기/수정
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
