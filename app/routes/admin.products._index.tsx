import { Link, useLoaderData, useFetcher, data } from "react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth.server";
import { supabaseAdmin } from "@/lib/supabase.server";
import { PageContainer } from "@/components/ui/container";
import type { Route } from "./+types/admin.products._index";

export async function loader({ request }: Route.LoaderArgs) {
    await requireAuth(request);

    // Fetch all products with category info
    const { data: products, error } = await supabaseAdmin
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
        .order('sort_order', { ascending: true });

    if (error) {
        console.error('Products fetch error:', error);
        throw new Error(`상품 목록을 불러오는데 실패했습니다: ${error.message}`);
    }

    // Sort by category sort_order, then by product sort_order
    const sortedProducts = (products || []).sort((a: any, b: any) => {
        const catSortA = a.categories?.sort_order ?? 999;
        const catSortB = b.categories?.sort_order ?? 999;
        if (catSortA !== catSortB) return catSortA - catSortB;
        return (a.sort_order || 0) - (b.sort_order || 0);
    });

    return data({ products: sortedProducts });
}

export async function action({ request }: Route.ActionArgs) {
    await requireAuth(request);

    const formData = await request.formData();
    const intent = formData.get("intent");
    const id = formData.get("id") as string;

    if (intent === "toggle") {
        const isActive = formData.get("is_active") === "true";

        const { error } = await supabaseAdmin
            .from('products')
            .update({ is_active: !isActive })
            .eq('id', id);

        if (error) {
            return data({ error: `상태 변경 실패: ${error.message}` }, { status: 500 });
        }

        return data({ success: true });
    }

    return data({ error: "잘못된 요청입니다" }, { status: 400 });
}

export default function AdminProductsPage() {
    const { products } = useLoaderData<typeof loader>();
    const fetcher = useFetcher();

    return (
        <PageContainer size="wide">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold">상품 관리</h1>
                    <p className="text-muted-foreground mt-1">빵과 스콘 관리</p>
                </div>
                <div className="flex gap-3">
                    <Button asChild variant="outline">
                        <Link to="/admin/dashboard">대시보드로</Link>
                    </Button>
                    <Button asChild variant="outline">
                        <Link to="/admin/categories">카테고리 관리</Link>
                    </Button>
                    <Button asChild>
                        <Link to="/admin/products/new">
                            <Plus className="mr-2 h-4 w-4" />
                            상품 추가
                        </Link>
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>전체 상품 ({products.length}개)</CardTitle>
                </CardHeader>
                <CardContent>
                    {products.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-muted-foreground">등록된 상품이 없습니다.</p>
                            <Button asChild className="mt-4" variant="outline">
                                <Link to="/admin/products/new">
                                    <Plus className="mr-2 h-4 w-4" />
                                    첫 상품 추가하기
                                </Link>
                            </Button>
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[100px]">정렬순서</TableHead>
                                        <TableHead>이름 (한글)</TableHead>
                                        <TableHead>이름 (영문)</TableHead>
                                        <TableHead>카테고리</TableHead>
                                        <TableHead className="text-right">가격</TableHead>
                                        <TableHead className="w-[100px]">상태</TableHead>
                                        <TableHead className="text-right w-[150px]">작업</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {products.map((product: any) => (
                                        <TableRow key={product.id}>
                                            <TableCell className="font-mono text-sm">
                                                {product.sort_order}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {product.name_ko || '-'}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {product.name}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">
                                                    {product.categories?.name_ko || product.category || '-'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right font-medium">
                                                ₹{product.price}
                                            </TableCell>
                                            <TableCell>
                                                <fetcher.Form method="post">
                                                    <input type="hidden" name="intent" value="toggle" />
                                                    <input type="hidden" name="id" value={product.id} />
                                                    <input type="hidden" name="is_active" value={String(product.is_active)} />
                                                    <button type="submit">
                                                        {product.is_active ? (
                                                            <Badge variant="default" className="bg-green-600 cursor-pointer hover:bg-green-700">활성</Badge>
                                                        ) : (
                                                            <Badge variant="secondary" className="cursor-pointer hover:bg-gray-300">비활성</Badge>
                                                        )}
                                                    </button>
                                                </fetcher.Form>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button asChild size="sm" variant="outline">
                                                        <Link to={`/admin/products/${product.id}`}>
                                                            <Pencil className="h-3 w-3" />
                                                        </Link>
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </PageContainer>
    );
}
