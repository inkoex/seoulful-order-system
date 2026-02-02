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
import { supabaseAdmin } from "@/lib/supabase.server";
import { PageContainer } from "@/components/ui/container";
import type { Route } from "./+types/admin.apartments._index";

interface Apartment {
    id: string;
    name: string;
    name_ko: string;
    sort_order: number;
    is_active: boolean;
    order_count: number;
}

export async function loader({ request }: Route.LoaderArgs) {
    await requireAuth(request);

    // Fetch all apartments with order count
    const { data: apartments, error } = await supabaseAdmin
        .from('apartments')
        .select(`
            id,
            name,
            name_ko,
            sort_order,
            is_active,
            orders:orders(count)
        `)
        .order('sort_order', { ascending: true });

    if (error) {
        console.error('Apartments fetch error:', error);
        throw new Error(`아파트 목록을 불러오는데 실패했습니다: ${error.message}`);
    }

    // Transform to include order_count
    const apartmentsWithCount = (apartments || []).map((apt: any) => ({
        id: apt.id,
        name: apt.name,
        name_ko: apt.name_ko,
        sort_order: apt.sort_order,
        is_active: apt.is_active,
        order_count: apt.orders?.[0]?.count || 0
    }));

    return data({ apartments: apartmentsWithCount });
}

export async function action({ request }: Route.ActionArgs) {
    await requireAuth(request);

    const formData = await request.formData();
    const intent = formData.get("intent");
    const id = formData.get("id") as string;

    if (intent === "delete") {
        // Check if apartment has orders
        const { data: orders } = await supabaseAdmin
            .from('orders')
            .select('id')
            .eq('apartment_id', id)
            .limit(1);

        if (orders && orders.length > 0) {
            return data({
                error: "이 아파트에 주문이 있어 삭제할 수 없습니다. 먼저 주문을 다른 아파트로 이동하세요."
            }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from('apartments')
            .delete()
            .eq('id', id);

        if (error) {
            return data({ error: `삭제 실패: ${error.message}` }, { status: 500 });
        }

        return data({ success: true });
    }

    if (intent === "toggle") {
        const isActive = formData.get("is_active") === "true";

        const { error } = await supabaseAdmin
            .from('apartments')
            .update({ is_active: !isActive })
            .eq('id', id);

        if (error) {
            return data({ error: `상태 변경 실패: ${error.message}` }, { status: 500 });
        }

        return data({ success: true });
    }

    return data({ error: "잘못된 요청입니다" }, { status: 400 });
}

export default function AdminApartmentsPage() {
    const { apartments } = useLoaderData<typeof loader>();
    const fetcher = useFetcher();

    return (
        <PageContainer size="wide">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold">아파트 관리</h1>
                    <p className="text-muted-foreground mt-1">배달 지역 관리</p>
                </div>
                <Button asChild className="w-full sm:w-auto">
                    <Link to="/admin/apartments/new">
                        <Plus className="mr-2 h-4 w-4" />
                        아파트 추가
                    </Link>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>전체 아파트 ({apartments.length}개)</CardTitle>
                </CardHeader>
                <CardContent>
                    {apartments.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-muted-foreground">등록된 아파트가 없습니다.</p>
                            <Button asChild className="mt-4" variant="outline">
                                <Link to="/admin/apartments/new">
                                    <Plus className="mr-2 h-4 w-4" />
                                    첫 아파트 추가하기
                                </Link>
                            </Button>
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[80px]">순서</TableHead>
                                        <TableHead>이름 (한글)</TableHead>
                                        <TableHead className="hidden sm:table-cell">이름 (영문)</TableHead>
                                        <TableHead className="text-center">주문 수</TableHead>
                                        <TableHead className="w-[100px]">상태</TableHead>
                                        <TableHead className="text-right w-[150px]">작업</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {apartments.map((apartment: Apartment) => (
                                        <TableRow key={apartment.id}>
                                            <TableCell className="font-mono text-sm">
                                                {apartment.sort_order}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {apartment.name_ko}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground hidden sm:table-cell">
                                                {apartment.name}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="outline">
                                                    {apartment.order_count}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <fetcher.Form method="post">
                                                    <input type="hidden" name="intent" value="toggle" />
                                                    <input type="hidden" name="id" value={apartment.id} />
                                                    <input type="hidden" name="is_active" value={String(apartment.is_active)} />
                                                    <button type="submit">
                                                        {apartment.is_active ? (
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
                                                        <Link to={`/admin/apartments/${apartment.id}`}>
                                                            <Pencil className="h-3 w-3" />
                                                        </Link>
                                                    </Button>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                disabled={apartment.order_count > 0}
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>아파트 삭제</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    "{apartment.name_ko}" 아파트를 삭제하시겠습니까?
                                                                    이 작업은 되돌릴 수 없습니다.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>취소</AlertDialogCancel>
                                                                <fetcher.Form method="post">
                                                                    <input type="hidden" name="intent" value="delete" />
                                                                    <input type="hidden" name="id" value={apartment.id} />
                                                                    <AlertDialogAction type="submit" className="bg-red-600 hover:bg-red-700">
                                                                        삭제
                                                                    </AlertDialogAction>
                                                                </fetcher.Form>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
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
