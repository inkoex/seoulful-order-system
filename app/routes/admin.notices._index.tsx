import { useMemo, useState } from "react";
import { Link, useActionData, useLoaderData, data, type LoaderFunctionArgs, type ActionFunctionArgs } from "react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { requireAuth } from "@/lib/auth.server";
import { invalidateNoticeSnapshot } from "@/lib/notices.server";
import { supabaseAdmin } from "@/lib/supabase.server";
import { PageContainer } from "@/components/ui/container";

const formatDateTime = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString();
};

const formatDate = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString();
};

export async function loader({ request }: LoaderFunctionArgs) {
    await requireAuth(request);

    const { data: notices, error } = await supabaseAdmin
        .from("notices")
        .select(`
            id,
            title,
            message,
            status,
            start_at,
            end_at,
            delivery_date,
            is_all_products,
            created_at,
            notice_products(product_id, products(name, name_ko, is_active)),
            notice_limits(id, type, product_id, max_quantity, products(name, name_ko))
        `)
        .order("created_at", { ascending: false });

    if (error) {
        throw new Error("공지 목록을 불러오는데 실패했습니다");
    }

    return data({ notices: notices || [] });
}

export async function action({ request }: ActionFunctionArgs) {
    await requireAuth(request);

    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "close") {
        const noticeId = formData.get("noticeId");
        if (!noticeId || typeof noticeId !== "string") {
            return data({ error: "공지 ID가 없습니다" }, { status: 400 });
        }
        await supabaseAdmin.from("notices").update({ status: "closed" }).eq("id", noticeId);
        invalidateNoticeSnapshot();
        return data({ success: true });
    }

    if (intent === "activate") {
        const noticeId = formData.get("noticeId");
        if (!noticeId || typeof noticeId !== "string") {
            return data({ error: "공지 ID가 없습니다" }, { status: 400 });
        }
        await supabaseAdmin.from("notices").update({ status: "closed" }).neq("id", noticeId).eq("status", "active");
        await supabaseAdmin.from("notices").update({ status: "active" }).eq("id", noticeId);
        invalidateNoticeSnapshot();
        return data({ success: true });
    }

    if (intent === "delete") {
        const noticeId = formData.get("noticeId");
        if (!noticeId || typeof noticeId !== "string") {
            return data({ error: "공지 ID가 없습니다" }, { status: 400 });
        }
        await supabaseAdmin.from("notice_limits").delete().eq("notice_id", noticeId);
        await supabaseAdmin.from("notice_products").delete().eq("notice_id", noticeId);
        await supabaseAdmin.from("notices").delete().eq("id", noticeId);
        invalidateNoticeSnapshot();
        return data({ success: true });
    }

    return data({ error: "잘못된 요청입니다" }, { status: 400 });
}

export default function AdminNoticesPage() {
    const { notices } = useLoaderData<typeof loader>();
    const actionData = useActionData<typeof action>() as { error?: string } | undefined;

    return (
        <PageContainer size="wide">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold">공지 관리</h1>
                    <p className="text-muted-foreground mt-1">주문 공지와 마감 설정</p>
                </div>
                <Button asChild>
                    <Link to="/admin/notices/new">
                        <Plus className="mr-2 h-4 w-4" />
                        새 공지
                    </Link>
                </Button>
            </div>

            {actionData?.error && (
                <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {actionData.error}
                </div>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>공지 내역</CardTitle>
                </CardHeader>
                <CardContent>
                    {notices.length === 0 ? (
                        <div className="text-center py-8 text-sm text-muted-foreground">
                            등록된 공지가 없습니다.
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>상태</TableHead>
                                        <TableHead>제목</TableHead>
                                        <TableHead>기간</TableHead>
                                        <TableHead>배달일</TableHead>
                                        <TableHead>대상</TableHead>
                                        <TableHead>제한</TableHead>
                                        <TableHead className="text-right">작업</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {notices.map((notice: any) => {
                                        const totalLimit = (notice.notice_limits || []).find((limit: any) => limit.type === "total");
                                        const productLimits = (notice.notice_limits || []).filter((limit: any) => limit.type === "product");
                                        return (
                                            <TableRow key={notice.id}>
                                                <TableCell>
                                                    <Badge
                                                        variant={notice.status === "active" ? "default" : "secondary"}
                                                        className={notice.status === "active" ? "bg-green-600 hover:bg-green-700" : undefined}
                                                    >
                                                        {notice.status === "active" ? "활성" : "종료"}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-medium">{notice.title}</div>
                                                    <div className="text-xs text-muted-foreground line-clamp-2">{notice.message}</div>
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">
                                                    <div>{formatDateTime(notice.start_at)}</div>
                                                    <div>{formatDateTime(notice.end_at)}</div>
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">
                                                    {formatDate(notice.delivery_date)}
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">
                                                    {notice.is_all_products ? (
                                                        <span>전체 상품</span>
                                                    ) : (
                                                        <div className="space-y-1">
                                                            {(() => {
                                                                const activeProducts = (notice.notice_products || []).filter((item: any) => item.products?.is_active);
                                                                if (activeProducts.length === 0) return <span>선택 없음</span>;
                                                                return activeProducts.map((item: any) => (
                                                                    <div key={item.product_id}>{item.products?.name || "-"}</div>
                                                                ));
                                                            })()}
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">
                                                    <div>
                                                        전체: {totalLimit ? totalLimit.max_quantity : "-"}
                                                    </div>
                                                    {productLimits.map((limit: any) => (
                                                        <div key={limit.id}>
                                                            {limit.products?.name || "상품"}: {limit.max_quantity}
                                                        </div>
                                                    ))}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button asChild size="sm" variant="outline" className="h-8 w-8 p-0">
                                                            <Link to={`/admin/notices/${notice.id}`}>
                                                                <Pencil className="h-3 w-3" />
                                                            </Link>
                                                        </Button>
                                                        <form method="post" className="w-full">
                                                            <input type="hidden" name="intent" value={notice.status === "active" ? "close" : "activate"} />
                                                            <input type="hidden" name="noticeId" value={notice.id} />
                                                            <Button size="sm" variant="outline" type="submit" className="h-8 w-full justify-center">
                                                                {notice.status === "active" ? "종료" : "활성화"}
                                                            </Button>
                                                        </form>
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button size="sm" variant="outline" type="button" className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50">
                                                                    <Trash2 className="h-3 w-3" />
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>공지 삭제</AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        "{notice.title}" 공지를 삭제하시겠습니까?
                                                                        이 작업은 되돌릴 수 없습니다.
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>취소</AlertDialogCancel>
                                                                    <form method="post">
                                                                        <input type="hidden" name="intent" value="delete" />
                                                                        <input type="hidden" name="noticeId" value={notice.id} />
                                                                        <AlertDialogAction type="submit" className="bg-red-600 hover:bg-red-700">
                                                                            삭제
                                                                        </AlertDialogAction>
                                                                    </form>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </PageContainer>
    );
}
