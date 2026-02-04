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
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchOrder() {
            if (!orderId) {
                setError("Order ID is missing. (주문 정보를 찾을 수 없습니다)");
                setLoading(false);
                return;
            }

            // Fetch order basic info
            const { data: order, error: orderError } = await supabase
                .from('orders')
                .select('order_number, total_amount, delivery_date, customer_name, edit_token, id')
                .eq('id', orderId)
                .single();

            if (orderError || !order) {
                setError("Order not found. (주문 정보를 찾을 수 없습니다)");
                setLoading(false);
                return;
            }

            setOrderData(order);

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

            if (itemsError) {
                setError("Failed to load order items. (주문 내역을 불러오지 못했습니다)");
                setLoading(false);
                return;
            }

            if (items) {
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

    if (error) {
        return (
            <PageContainer size="narrow" className="h-screen flex flex-col justify-center">
                <Card className="text-center">
                    <CardHeader>
                        <CardTitle className="text-2xl">Unable to load order</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground mb-4">{error}</p>
                    </CardContent>
                    <CardFooter className="flex justify-center">
                        <Button asChild variant="outline">
                            <Link to="/order/lookup">View my order (내 주문 조회)</Link>
                        </Button>
                    </CardFooter>
                </Card>
            </PageContainer>
        );
    }

    // Generate WhatsApp share URL
    const whatsappUrl = orderData ? (() => {
        const editUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/order/edit/${orderData.id}?token=${orderData.edit_token}`;
        const message = encodeURIComponent(
            `Hello! Your Seoulful order is confirmed.\n\n` +
            `📦 Order No.: ${orderData.order_number}\n` +
            `👤 Name: ${orderData.customer_name}\n` +
            `📅 Delivery date: ${new Date(orderData.delivery_date).toLocaleDateString('ko-KR')}\n` +
            `💰 Total: ₹${orderData.total_amount}\n\n` +
            `✏️ Edit order: ${editUrl}\n\n` +
            `⏰ Deadline: 8 PM the day before delivery`
        );
        return `https://wa.me/?text=${message}`;
    })() : '';

    const itemsSubtotal = orderItems.reduce((total, item) => total + (Number(item.subtotal) || 0), 0);
    const deliveryFee = orderData ? Math.max(0, Number(orderData.total_amount) - itemsSubtotal) : 0;

    return (
        <PageContainer size="narrow" className="h-screen flex flex-col justify-center">
            <Card className="text-center">
                <CardHeader>
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                        <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
                    </div>
                    <CardTitle className="text-2xl">Order completed!</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground mb-4">
                        Thanks for your order.
                    </p>
                    {orderData && (
                        <div className="space-y-3">
                            <div className="p-4 border rounded-md">
                                <p className="text-sm text-muted-foreground font-medium">Order No.</p>
                                <p className="text-2xl font-bold">{orderData.order_number}</p>
                            </div>

                            {/* Order Items List */}
                            {orderItems.length > 0 && (
                                <div className="p-3 border rounded-md">
                                    <p className="text-sm font-medium mb-2">Order summary</p>
                                    <div className="space-y-2">
                                        {orderItems.map((item: any, index: number) => (
                                            <div key={index} className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">
                                                    {item.products?.name || item.products?.name_ko} × {item.quantity}
                                                </span>
                                                <span className="font-medium">₹{item.subtotal}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="p-3 border rounded-md text-sm">
                                <div className="flex justify-between py-1">
                                    <span className="text-muted-foreground">Delivery date</span>
                                    <span className="font-medium">{new Date(orderData.delivery_date).toLocaleDateString('ko-KR')}</span>
                                </div>
                                <div className="flex justify-between py-1">
                                    <span className="text-muted-foreground">Delivery fee</span>
                                    <span className="font-medium">{deliveryFee > 0 ? `₹${deliveryFee}` : "Free"}</span>
                                </div>
                                <div className="flex justify-between py-1 border-t mt-2 pt-2">
                                    <span className="text-muted-foreground">Total</span>
                                    <span className="font-bold text-lg">₹{orderData.total_amount}</span>
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="mt-6 text-sm text-muted-foreground">
                        <p>We will send a confirmation message soon.</p>
                        <p className="mt-1">Contact: WhatsApp</p>
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button asChild variant="outline">
                        <Link to="/">Place another order</Link>
                    </Button>
                    {orderData && (
                        <Button asChild variant="default">
                            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                                <MessageCircle className="mr-2 h-4 w-4" />
                                Share on WhatsApp
                            </a>
                        </Button>
                    )}
                </CardFooter>
            </Card>
        </PageContainer>
    );
}
