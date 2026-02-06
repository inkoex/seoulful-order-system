import { formatDisplayDate, formatCurrency } from "~/utils/format";
import { calculateOrderTotals } from "~/utils/order";
import { Link, useLoaderData } from "react-router";
import { CheckCircle2, MessageCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { PageContainer } from "@/components/ui/container";
import type { Route } from "./+types/order.complete";

interface OrderProduct {
    name: string;
    name_ko: string;
}

interface OrderItem {
    quantity: number;
    unit_price: number;
    subtotal: number;
    products: OrderProduct | OrderProduct[] | null;
}

interface OrderData {
    id: string;
    order_number: string;
    total_amount: number;
    subtotal: number;
    delivery_fee: number;
    delivery_date: string;
    customer_name: string;
    edit_token: string;
}

export async function loader({ request }: Route.LoaderArgs) {
    const url = new URL(request.url);
    const orderId = url.searchParams.get("id");
    const origin = url.origin;

    if (!orderId) {
        throw new Response("Order ID is missing", { status: 400 });
    }

    // Fetch order basic info
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('order_number, total_amount, subtotal, delivery_fee, delivery_date, customer_name, edit_token, id')
        .eq('id', orderId)
        .single();

    if (orderError || !order) {
        throw new Response("Order not found", { status: 404 });
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

    if (itemsError) {
        throw new Response("Failed to load order items", { status: 500 });
    }

    return {
        order: order as OrderData,
        items: (items || []) as OrderItem[],
        origin
    };
}

export default function OrderCompletePage() {
    const { order, items, origin } = useLoaderData<typeof loader>();

    // Generate WhatsApp share URL
    const whatsappUrl = (() => {
        const editUrl = `${origin}/order/edit/${order.id}?token=${order.edit_token}`;

        const totals = calculateOrderTotals(items);
        const itemsList = items
            .map(item => {
                const product = Array.isArray(item.products) ? item.products[0] : item.products;
                return `• ${product?.name || product?.name_ko || 'Product'} × ${item.quantity}`;
            })
            .join('\n');

        const deliveryFeeDisplay = totals.deliveryFee > 0 ? `₹${totals.deliveryFee}` : "Free";

        const message = encodeURIComponent(
            `Hi ${order.customer_name},\n\n` +
            `Thank you for your Seoulful order 🤍\n` +
            `We’ll freshly prepare everything for delivery on ${formatDisplayDate(order.delivery_date)}.\n\n` +
            `🛒 Order Summary\n` +
            `${itemsList}\n\n` +
            `Subtotal: ₹${totals.subtotal}\n` +
            `Delivery: ${deliveryFeeDisplay}\n` +
            `Total: ₹${order.total_amount}\n\n` +
            `📦 Order No: ${order.order_number}\n\n` +
            `Need to make a change?\n` +
            `Edit here: ${editUrl}\n\n` +
            `Bringing a touch of Seoul to your table.\n` +
            `See you soon.`
        );
        return `https://wa.me/?text=${message}`;
    })();

    const totals = calculateOrderTotals(items);

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
                    {order && (
                        <div className="space-y-4 max-w-lg mx-auto">
                            <div className="p-5 border-2 border-brand-primary/20 rounded-2xl bg-gradient-to-br from-white to-brand-background/20">
                                <p className="text-xs font-black uppercase tracking-widest text-brand-primary mb-2">Order No.</p>
                                <p className="text-3xl font-black text-brand-charcoal">{order.order_number}</p>
                            </div>

                            {/* Order Items List */}
                            {items.length > 0 && (
                                <div className="p-5 border-2 border-brand-charcoal/10 rounded-2xl">
                                    <p className="text-sm font-black text-brand-charcoal tracking-wide mb-3">Order summary</p>
                                    <div className="space-y-2">
                                        {items.map((item, index) => {
                                            const product = Array.isArray(item.products) ? item.products[0] : item.products;
                                            return (
                                                <div key={index} className="flex justify-between text-sm py-1">
                                                    <span className="text-brand-charcoal/70">
                                                        {product?.name || product?.name_ko} × {item.quantity}
                                                    </span>
                                                    <span className="font-bold text-brand-charcoal">₹{item.subtotal}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="mt-4 border-t-2 border-brand-primary/10 pt-3 space-y-3 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-brand-charcoal/60 font-medium">Delivery fee</span>
                                            <span className="font-bold text-brand-charcoal">{totals.deliveryFee > 0 ? formatCurrency(totals.deliveryFee) : "Free"}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="font-black text-brand-primary">Total</span>
                                            <span className="font-black text-brand-primary">{formatCurrency(order.total_amount)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="p-4 border-2 border-brand-charcoal/10 rounded-2xl text-sm flex justify-between items-center">
                                <span className="text-brand-charcoal/40 font-medium">Delivery date</span>
                                <span className="font-bold text-brand-charcoal">{formatDisplayDate(order.delivery_date)}</span>
                            </div>

                        </div>
                    )}
                    <div className="mt-6 text-sm text-brand-charcoal/60">
                        <p>If you have any questions, please contact us via WhatsApp.</p>
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col sm:flex-row gap-3 justify-center pb-12">
                    <Button asChild variant="outline" className="rounded-xl border-2 border-brand-charcoal/10 hover:border-brand-primary hover:bg-brand-primary/5">
                        <Link to={`/order/edit/${order.id}?token=${order.edit_token}`}>Edit order</Link>
                    </Button>
                    <Button asChild variant="premium">
                        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                            <MessageCircle className="mr-2 h-5 w-5" />
                            Share on WhatsApp
                        </a>
                    </Button>
                </CardFooter>
            </Card>
        </PageContainer>
    );
}
