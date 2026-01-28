import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { CheckCircle2, Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { PageContainer } from "@/components/ui/container";

export default function OrderCompletePage() {
    const [searchParams] = useSearchParams();
    const orderId = searchParams.get("id");
    const [orderData, setOrderData] = useState<any>(null);
    const [orderItems, setOrderItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchOrder() {
            if (!orderId) return;

            // Fetch order basic info
            const { data: order, error: orderError } = await supabase
                .from('orders')
                .select('order_number, total_amount, delivery_date, customer_name, edit_token, id')
                .eq('id', orderId)
                .single();

            if (!orderError && order) {
                setOrderData(order);
            }

            // Fetch order items with product details
            const { data: items, error: itemsError } = await supabase
                .from('order_items')
                .select(`
                    quantity,
                    unit_price,
                    subtotal,
                    products (
                        name_ko,
                        name
                    )
                `)
                .eq('order_id', orderId);

            if (!itemsError && items) {
                setOrderItems(items);
            }

            setLoading(false);
        }

        fetchOrder();
    }, [orderId]);

    if (loading) {
        return (
            <PageContainer size="narrow" className="h-screen flex flex-col justify-center">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-400" />
                </div>
            </PageContainer>
        );
    }

    // Generate WhatsApp share URL
    const whatsappUrl = orderData ? (() => {
        const editUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/order/edit/${orderData.id}?token=${orderData.edit_token}`;
        const message = encodeURIComponent(
            `안녕하세요! Seoulful 주문이 완료되었습니다.\n\n` +
            `📦 주문번호: ${orderData.order_number}\n` +
            `👤 고객명: ${orderData.customer_name}\n` +
            `📅 배달일: ${new Date(orderData.delivery_date).toLocaleDateString('ko-KR')}\n` +
            `💰 총 금액: ₹${orderData.total_amount}\n\n` +
            `✏️ 주문 수정: ${editUrl}\n\n` +
            `⏰ 마감: 배달 전날 오후 8시까지`
        );
        return `https://wa.me/?text=${message}`;
    })() : '';

    return (
        <PageContainer size="narrow" className="h-screen flex flex-col justify-center">
            <Card className="text-center">
                <CardHeader>
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                        <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
                    </div>
                    <CardTitle className="text-2xl">주문이 완료되었습니다!</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground mb-4">
                        주문해주셔서 감사합니다.
                    </p>
                    {orderData && (
                        <div className="space-y-3">
                            <div className="p-4 border rounded-md">
                                <p className="text-sm text-muted-foreground font-medium">주문 번호</p>
                                <p className="text-2xl font-bold">{orderData.order_number}</p>
                            </div>

                            {/* Order Items List */}
                            {orderItems.length > 0 && (
                                <div className="p-3 border rounded-md">
                                    <p className="text-sm font-medium mb-2">주문 내역</p>
                                    <div className="space-y-2">
                                        {orderItems.map((item: any, index: number) => (
                                            <div key={index} className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">
                                                    {item.products?.name_ko || item.products?.name} × {item.quantity}
                                                </span>
                                                <span className="font-medium">₹{item.subtotal}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="p-3 border rounded-md text-sm">
                                <div className="flex justify-between py-1">
                                    <span className="text-muted-foreground">고객명</span>
                                    <span className="font-medium">{orderData.customer_name}</span>
                                </div>
                                <div className="flex justify-between py-1">
                                    <span className="text-muted-foreground">배달일</span>
                                    <span className="font-medium">{new Date(orderData.delivery_date).toLocaleDateString('ko-KR')}</span>
                                </div>
                                <div className="flex justify-between py-1 border-t mt-2 pt-2">
                                    <span className="text-muted-foreground">총 금액</span>
                                    <span className="font-bold text-lg">₹{orderData.total_amount}</span>
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="mt-6 text-sm text-muted-foreground">
                        <p>확인 메시지를 곧 보내드리겠습니다.</p>
                        <p className="mt-1">문의: WhatsApp</p>
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button asChild variant="outline">
                        <Link to="/">추가 주문하기</Link>
                    </Button>
                    {orderData && (
                        <Button asChild variant="default">
                            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                                <MessageCircle className="mr-2 h-4 w-4" />
                                WhatsApp으로 공유
                            </a>
                        </Button>
                    )}
                </CardFooter>
            </Card>
        </PageContainer>
    );
}
