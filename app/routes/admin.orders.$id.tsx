import { useLoaderData, useActionData, useSubmit, data, Link } from "react-router";
import { ArrowLeft, Lock, Unlock, Calendar, User, Phone, MapPin, CreditCard, Package } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { requireAuth } from "@/lib/auth.server";
import { supabaseAdmin } from "@/lib/supabase.server";
import { PageContainer } from "@/components/ui/container";
import { invalidateNoticeSnapshot } from "@/lib/notices.server";
import type { Route } from "./+types/admin.orders.$id";

export async function loader({ request, params }: Route.LoaderArgs) {
    await requireAuth(request);

    // Fetch order with items
    const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .select('*')
        .eq('id', params.id)
        .single();

    if (orderError || !order) {
        throw new Response("주문을 찾을 수 없습니다", { status: 404 });
    }

    // Fetch order items with product details
    const { data: items, error: itemsError } = await supabaseAdmin
        .from('order_items')
        .select(`
            *,
            products (
                name,
                name_ko,
                category
            )
        `)
        .eq('order_id', params.id);

    // Fetch order history
    const { data: history, error: historyError } = await supabaseAdmin
        .from('order_history')
        .select('*')
        .eq('order_id', params.id)
        .order('changed_at', { ascending: false });

    return data({
        order,
        items: items || [],
        history: history || []
    });
}

const VALID_STATUSES = ["received", "ready", "delivered", "paid", "cancelled"] as const;

export async function action({ request, params }: Route.ActionArgs) {
    await requireAuth(request);

    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "update_status") {
        const status = formData.get("status");
        if (typeof status !== "string" || !VALID_STATUSES.includes(status as any)) {
            return data({ error: "잘못된 주문 상태입니다 (Invalid order status)" }, { status: 400 });
        }

        // Keep cancellation metadata consistent: set it when cancelling here,
        // clear it when moving the order back out of the cancelled state.
        const updates: Record<string, unknown> = { status };
        if (status === "cancelled") {
            updates.cancelled_at = new Date().toISOString();
        } else {
            updates.cancelled_at = null;
            updates.cancelled_reason = null;
        }

        const { error: updateError } = await supabaseAdmin
            .from('orders')
            .update(updates)
            .eq('id', params.id);

        if (updateError) {
            console.error("Status update failed:", updateError);
            return data({ error: "주문 상태 변경에 실패했습니다 (Failed to update status)" }, { status: 500 });
        }

        // Log to history only after the change actually succeeded.
        await supabaseAdmin.from('order_history').insert({
            order_id: params.id,
            changed_fields: { status },
            changed_by: 'admin'
        });

    } else if (intent === "toggle_lock") {
        const { data: order, error: fetchError } = await supabaseAdmin
            .from('orders')
            .select('is_locked')
            .eq('id', params.id)
            .single();

        if (fetchError || !order) {
            return data({ error: "주문을 찾을 수 없습니다 (Order not found)" }, { status: 404 });
        }

        const { error: updateError } = await supabaseAdmin
            .from('orders')
            .update({ is_locked: !order.is_locked })
            .eq('id', params.id);

        if (updateError) {
            console.error("Lock toggle failed:", updateError);
            return data({ error: "잠금 상태 변경에 실패했습니다 (Failed to toggle lock)" }, { status: 500 });
        }

        await supabaseAdmin.from('order_history').insert({
            order_id: params.id,
            changed_fields: { is_locked: !order.is_locked },
            changed_by: 'admin'
        });
    } else if (intent === "update_notes") {
        const notes = formData.get("admin_notes");
        const { error: updateError } = await supabaseAdmin
            .from('orders')
            .update({ admin_notes: notes })
            .eq('id', params.id);

        if (updateError) {
            console.error("Notes update failed:", updateError);
            return data({ error: "메모 저장에 실패했습니다 (Failed to save notes)" }, { status: 500 });
        }
    } else {
        return data({ error: "알 수 없는 요청입니다 (Unknown intent)" }, { status: 400 });
    }

    invalidateNoticeSnapshot();
    return data({ success: true });
}

export default function AdminOrderDetailPage() {
    const { order, items, history } = useLoaderData<typeof loader>();
    const submit = useSubmit();
    const statusOptions = [
        { value: "received", label: "접수됨" },
        { value: "ready", label: "생산 완료" },
        { value: "delivered", label: "배달 완료" },
        { value: "paid", label: "지불 완료" },
        { value: "cancelled", label: "취소됨" },
    ];
    const statusStyles: Record<string, { label: string; className?: string; variant?: "default" | "secondary" | "outline" }> = {
        received: { label: "접수됨", className: "bg-yellow-600" },
        ready: { label: "생산 완료", className: "bg-blue-600" },
        delivered: { label: "배달 완료", className: "bg-green-600" },
        paid: { label: "지불 완료", className: "bg-emerald-700" },
        cancelled: { label: "취소됨", variant: "secondary" },
    };
    const itemsSubtotal = items.reduce((total: number, item: any) => total + (Number(item.subtotal) || 0), 0);
    const deliveryFee = Math.max(0, Number(order.total_amount) - itemsSubtotal);

    function handleStatusChange(status: string) {
        const formData = new FormData();
        formData.append("intent", "update_status");
        formData.append("status", status);
        submit(formData, { method: "post" });
    }

    function handleToggleLock() {
        const formData = new FormData();
        formData.append("intent", "toggle_lock");
        submit(formData, { method: "post" });
    }

    function handleNotesUpdate() {
        const formData = new FormData();
        formData.append("intent", "update_notes");
        formData.append("admin_notes", (document.getElementById("admin_notes") as HTMLTextAreaElement)?.value || "");
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
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">주문 상세</h1>
                        <p className="text-muted-foreground mt-1">주문번호: {order.order_number}</p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant={order.is_locked ? "default" : "outline"}
                            size="sm"
                            onClick={handleToggleLock}
                        >
                            {order.is_locked ? (
                                <>
                                    <Unlock className="mr-2 h-4 w-4" />
                                    잠금 해제
                                </>
                            ) : (
                                <>
                                    <Lock className="mr-2 h-4 w-4" />
                                    잠금
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 mb-6">
                {/* Order Status */}
                <Card>
                    <CardHeader>
                        <CardTitle>주문 상태</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">현재 상태</span>
                            <div>
                                {(() => {
                                    const info = statusStyles[order.status] || { label: order.status };
                                    if (info.variant) {
                                        return <Badge variant={info.variant}>{info.label}</Badge>;
                                    }
                                    return <Badge className={info.className}>{info.label}</Badge>;
                                })()}
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-2 block">상태 변경</label>
                            <Select value={order.status} onValueChange={handleStatusChange}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {statusOptions.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">주문 채널</span>
                            <Badge variant="outline">
                                {order.entry_channel === 'admin_whatsapp' ? 'WhatsApp' : '직접 주문'}
                            </Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">주문 잠금</span>
                            <span>{order.is_locked ? '잠김' : '잠기지 않음'}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Customer Info */}
                <Card>
                    <CardHeader>
                        <CardTitle>고객 정보</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex items-start gap-3">
                            <User className="h-4 w-4 mt-1 text-muted-foreground" />
                            <div className="flex-1">
                                <p className="text-sm text-muted-foreground">고객명</p>
                                <p className="font-medium">{order.customer_name}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <Phone className="h-4 w-4 mt-1 text-muted-foreground" />
                            <div className="flex-1">
                                <p className="text-sm text-muted-foreground">연락처</p>
                                <p className="font-medium">{order.phone}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <MapPin className="h-4 w-4 mt-1 text-muted-foreground" />
                            <div className="flex-1">
                                <p className="text-sm text-muted-foreground">배달 주소</p>
                                <p className="font-medium">
                                    {order.apartment} {order.tower}동 {order.flat_number}호
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <Calendar className="h-4 w-4 mt-1 text-muted-foreground" />
                            <div className="flex-1">
                                <p className="text-sm text-muted-foreground">배달일</p>
                                <p className="font-medium">
                                    {new Date(order.delivery_date).toLocaleDateString('ko-KR')}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <CreditCard className="h-4 w-4 mt-1 text-muted-foreground" />
                            <div className="flex-1">
                                <p className="text-sm text-muted-foreground">결제 방식</p>
                                <p className="font-medium">
                                    {order.payment_method === 'upi' && 'UPI'}
                                    {order.payment_method === 'cash' && '현금'}
                                    {order.payment_method === 'other' && '기타'}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Order Items */}
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>주문 내역</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>상품명</TableHead>
                                    <TableHead className="text-center">수량</TableHead>
                                    <TableHead className="text-right">단가</TableHead>
                                    <TableHead className="text-right">소계</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map((item: any) => (
                                    <TableRow key={item.id}>
                                        <TableCell>
                                            <div>
                                                <p className="font-medium">{item.products?.name_ko}</p>
                                                <p className="text-xs text-muted-foreground">{item.products?.name}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">{item.quantity}</TableCell>
                                        <TableCell className="text-right">₹{item.unit_price}</TableCell>
                                        <TableCell className="text-right font-medium">₹{item.subtotal}</TableCell>
                                    </TableRow>
                                ))}
                                <TableRow>
                                    <TableCell colSpan={3} className="text-right font-medium">배달비</TableCell>
                                    <TableCell className="text-right font-medium">
                                        {deliveryFee > 0 ? `₹${deliveryFee}` : "무료"}
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell colSpan={3} className="text-right font-bold">총액</TableCell>
                                    <TableCell className="text-right font-bold text-lg">₹{order.total_amount}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Notes */}
            <div className="grid gap-6 md:grid-cols-2 mb-6">
                <Card>
                    <CardHeader>
                        <CardTitle>고객 요청사항</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {order.notes ? (
                            <p className="text-sm">{order.notes}</p>
                        ) : (
                            <p className="text-sm text-muted-foreground">없음</p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>관리자 메모</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Textarea
                            id="admin_notes"
                            placeholder="관리자용 메모를 입력하세요"
                            defaultValue={order.admin_notes || ""}
                            rows={3}
                        />
                        <Button size="sm" onClick={handleNotesUpdate}>
                            메모 저장
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* History */}
            {history.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>변경 이력</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {history.map((h: any) => (
                                <div key={h.id} className="flex justify-between items-start text-sm border-b pb-2">
                                    <div>
                                        <p className="font-medium">
                                            {Object.keys(h.changed_fields).join(', ')} 변경됨
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {h.changed_by === 'admin' ? '관리자' : '고객'}
                                        </p>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {new Date(h.changed_at).toLocaleString('ko-KR')}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </PageContainer>
    );
}
