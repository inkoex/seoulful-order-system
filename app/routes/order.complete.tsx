import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { CheckCircle2, Loader2, MessageCircle, Sparkles } from "lucide-react";
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
                .select('order_number, total_amount, subtotal, delivery_fee, delivery_date, customer_name, edit_token, id')
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
    const whatsappUrl = (orderData && orderItems.length > 0) ? (() => {
        const editUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/order/edit/${orderData.id}?token=${orderData.edit_token}`;

        const itemsSubtotal = Number(orderData.subtotal) || 0;
        const deliveryFee = Number(orderData.delivery_fee) || 0;

        const itemsList = orderItems
            .map(item => `- ${item.products?.name || item.products?.name_ko} x ${item.quantity}`)
            .join('\n');

        const message = encodeURIComponent(
            `Hello! Your Seoulful order is confirmed.\n\n` +
            `📦 Order No.: ${orderData.order_number}\n` +
            `👤 Name: ${orderData.customer_name}\n` +
            `📅 Delivery date: ${new Date(orderData.delivery_date).toLocaleDateString('en-US')}\n\n` +
            `🛒 *Order Summary*:\n${itemsList}\n\n` +
            `------------------\n` +
            `Subtotal: ₹${itemsSubtotal}\n` +
            `Delivery Fee: ${deliveryFee > 0 ? `₹${deliveryFee}` : "Free"}\n` +
            `*Total: ₹${orderData.total_amount}*\n\n` +
            `✏️ Edit order: ${editUrl}`
        );
        return `https://wa.me/?text=${message}`;
    })() : '';

    const deliveryFeeValue = orderData ? Number(orderData.delivery_fee) : 0;

    return (
        <PageContainer size="narrow" className="min-h-screen flex flex-col justify-center py-12">
            <Card className="text-center rounded-[2rem] shadow-2xl border-none bg-gradient-to-br from-white via-white to-brand-background/30">
                <CardHeader className="space-y-6 pb-8">
                    {/* Success icon with celebration effect */}
                    <div className="mx-auto relative animate-dynamic-reveal">
                        <div className="h-28 w-28 rounded-full bg-brand-primary/10 flex items-center justify-center backdrop-blur-sm">
                            <div className="h-24 w-24 rounded-full bg-brand-primary/20 flex items-center justify-center">
                                <CheckCircle2 className="h-16 w-16 text-brand-primary" strokeWidth={2.5} />
                            </div>
                        </div>

                        {/* Decorative sparkles */}
                        <Sparkles className="absolute -top-2 -right-2 text-brand-primary animate-pulse" size={24} />
                        <Sparkles className="absolute -bottom-2 -left-2 text-brand-primary animate-pulse [animation-delay:300ms]" size={20} />
                    </div>

                    {/* Premium success message */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <span className="section-label">Success</span>
                            <CardTitle className="text-3xl md:text-4xl font-black text-brand-charcoal">
                                Order Confirmed!
                            </CardTitle>
                            <p className="text-lg font-light text-brand-charcoal/50">
                                주문이 완료되었습니다
                            </p>
                        </div>
                        <div className="mx-auto section-divider w-16 bg-brand-primary"></div>
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="text-lg text-brand-charcoal/70 leading-relaxed mb-6">
                        Thanks for your order. We'll be in touch soon!
                    </p>
                    {orderData && (
                        <div className="space-y-4 max-w-lg mx-auto">
                            <div className="p-5 border-2 border-brand-primary/20 rounded-2xl bg-gradient-to-br from-white to-brand-background/20">
                                <p className="text-xs font-black uppercase tracking-widest text-brand-primary mb-2">Order No.</p>
                                <p className="text-3xl font-black text-brand-charcoal">{orderData.order_number}</p>
                            </div>

                            {/* Order Items List */}
                            {orderItems.length > 0 && (
                                <div className="p-5 border-2 border-brand-charcoal/10 rounded-2xl">
                                    <p className="text-sm font-black text-brand-charcoal tracking-wide mb-3">Order summary</p>
                                    <div className="space-y-2">
                                        {orderItems.map((item: any, index: number) => (
                                            <div key={index} className="flex justify-between text-sm py-1">
                                                <span className="text-brand-charcoal/70">
                                                    {item.products?.name || item.products?.name_ko} × {item.quantity}
                                                </span>
                                                <span className="font-bold text-brand-charcoal">₹{item.subtotal}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-4 border-t-2 border-brand-primary/10 pt-3 space-y-3 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-brand-charcoal/60 font-medium">Delivery fee</span>
                                            <span className="font-bold text-brand-charcoal">{deliveryFeeValue > 0 ? `₹${deliveryFeeValue}` : "Free"}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="font-black text-brand-primary">Total</span>
                                            <span className="font-black text-brand-primary text-lg">₹{orderData.total_amount}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="p-4 border-2 border-brand-charcoal/10 rounded-2xl text-sm flex justify-between items-center">
                                <span className="text-brand-charcoal/60 font-medium">Delivery date</span>
                                <span className="font-bold text-brand-charcoal">{new Date(orderData.delivery_date).toLocaleDateString('ko-KR')}</span>
                            </div>

                        </div>
                    )}
                    <div className="mt-6 text-sm text-brand-charcoal/60">
                        <p>If you have any questions, please contact us via WhatsApp.</p>
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col sm:flex-row gap-3 justify-center pb-12">
                    {orderData && (
                        <Button asChild variant="outline" className="rounded-xl border-2 border-brand-charcoal/10 hover:border-brand-primary hover:bg-brand-primary/5">
                            <Link to={`/order/edit/${orderData.id}?token=${orderData.edit_token}`}>Edit order</Link>
                        </Button>
                    )}
                    {orderData && (
                        <Button asChild variant="premium">
                            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                                <MessageCircle className="mr-2 h-5 w-5" />
                                Share on WhatsApp
                            </a>
                        </Button>
                    )}
                </CardFooter>
            </Card>
        </PageContainer>
    );
}
