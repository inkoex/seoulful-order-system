import { useActionData, useLoaderData, useNavigation, useSubmit, data, redirect } from "react-router";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ArrowLeft, Trash2 } from "lucide-react";
import { Link } from "react-router";

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
import { Switch } from "@/components/ui/switch";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth.server";
import { supabaseAdmin } from "@/lib/supabase.server";
import { PageContainer } from "@/components/ui/container";
import { invalidateCache } from "@/lib/cache.server";
import { invalidateNoticeSnapshot } from "@/lib/notices.server";
import type { Route } from "./+types/admin.categories.$id";

const categorySchema = z.object({
    name: z.string().min(1, "영문 이름을 입력해주세요"),
    name_ko: z.string().min(1, "표시 이름을 입력해주세요"),
    sort_order: z.number().min(0, "정렬 순서는 0 이상이어야 합니다"),
    is_active: z.boolean(),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

export async function loader({ request, params }: { request: Request; params: { id: string } }) {
    await requireAuth(request);

    const { data: category, error } = await supabaseAdmin
        .from('categories')
        .select('*')
        .eq('id', params.id)
        .single();

    if (error || !category) {
        throw new Response("카테고리를 찾을 수 없습니다", { status: 404 });
    }

    // Get product count for this category
    const { count } = await supabaseAdmin
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('category_id', params.id);

    return data({ category, productCount: count || 0 });
}

export async function action({ request, params }: { request: Request; params: { id: string } }) {
    await requireAuth(request);

    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "delete") {
        // Check if category has products
        const { data: products } = await supabaseAdmin
            .from('products')
            .select('id')
            .eq('category_id', params.id)
            .limit(1);

        if (products && products.length > 0) {
            return data({
                error: "이 카테고리에 상품이 있어 삭제할 수 없습니다. 먼저 상품을 다른 카테고리로 이동하세요."
            }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from('categories')
            .delete()
            .eq('id', params.id);

        if (error) {
            return data({
                error: "카테고리 삭제에 실패했습니다",
                details: error.message
            }, { status: 500 });
        }

        invalidateCache('order-products');
        invalidateNoticeSnapshot();

        throw redirect("/admin/categories");
    }

    // Update category
    const payloadString = formData.get("payload");

    if (!payloadString || typeof payloadString !== "string") {
        return data({ error: "Invalid submission format" }, { status: 400 });
    }

    const payload = JSON.parse(payloadString);
    const result = categorySchema.safeParse(payload);

    if (!result.success) {
        return data({
            error: "입력값을 확인해주세요",
            details: result.error.flatten()
        }, { status: 400 });
    }

    // Check for duplicate name (excluding current)
    const { data: existing } = await supabaseAdmin
        .from('categories')
        .select('id')
        .eq('name', result.data.name)
        .neq('id', params.id)
        .limit(1);

    if (existing && existing.length > 0) {
        return data({
            error: "이미 존재하는 카테고리 이름입니다"
        }, { status: 400 });
    }

    // Update category
    const { error } = await supabaseAdmin
        .from('categories')
        .update({
            name: result.data.name,
            name_ko: result.data.name_ko,
            sort_order: result.data.sort_order,
            is_active: result.data.is_active,
        })
        .eq('id', params.id);

    if (error) {
        return data({
            error: "카테고리 수정에 실패했습니다",
            details: error.message
        }, { status: 500 });
    }

    invalidateCache('order-products');
    await invalidateNoticeSnapshot();

    throw redirect("/admin/categories");
}

export default function AdminCategoryEditPage() {
    const { category, productCount } = useLoaderData<typeof loader>();
    const actionData = useActionData<typeof action>();
    const navigation = useNavigation();
    const submit = useSubmit();
    const isSubmitting = navigation.state === "submitting";

    const form = useForm<CategoryFormValues>({
        resolver: zodResolver(categorySchema),
        defaultValues: {
            name: category.name || "",
            name_ko: category.name_ko || "",
            sort_order: category.sort_order || 0,
            is_active: category.is_active ?? true,
        },
    });

    function onSubmit(values: CategoryFormValues) {
        const formData = new FormData();
        formData.append("payload", JSON.stringify(values));
        submit(formData, { method: "post" });
    }

    function handleDelete() {
        const formData = new FormData();
        formData.append("intent", "delete");
        submit(formData, { method: "post" });
    }

    const canDelete = productCount === 0;

    return (
        <PageContainer size="standard">
            <div className="mb-8">
                <Button asChild variant="ghost" size="sm" className="mb-4">
                    <Link to="/admin/categories">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        카테고리 목록으로
                    </Link>
                </Button>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">카테고리 수정</h1>
                        <p className="text-muted-foreground mt-1">
                            {category.name_ko} ({productCount}개 상품)
                        </p>
                    </div>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                                variant="destructive"
                                size="icon"
                                className="h-9 w-9"
                                disabled={!canDelete}
                                title={!canDelete ? "상품이 있는 카테고리는 삭제할 수 없습니다" : "삭제"}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>카테고리를 삭제하시겠습니까?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    이 작업은 되돌릴 수 없습니다. 카테고리 "{category.name_ko}"가 영구적으로 삭제됩니다.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>취소</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    삭제
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>카테고리 정보</CardTitle>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <div className="grid gap-6 md:grid-cols-2">
                                <FormField
                                    control={form.control}
                                    name="name_ko"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>표시 이름 (한글) *</FormLabel>
                                            <FormControl>
                                                <Input placeholder="빵" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>이름 (영문) *</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Salt Bread" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="grid gap-6 md:grid-cols-2">
                                <FormField
                                    control={form.control}
                                    name="sort_order"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>정렬 순서</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    placeholder="0"
                                                    {...field}
                                                    onChange={(e) => field.onChange(Number(e.target.value))}
                                                />
                                            </FormControl>
                                            <FormDescription>
                                                숫자가 작을수록 먼저 표시됩니다
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="is_active"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                            <div className="space-y-0.5">
                                                <FormLabel className="text-base">활성화</FormLabel>
                                                <FormDescription>
                                                    고객에게 표시됩니다
                                                </FormDescription>
                                            </div>
                                            <FormControl>
                                                <Switch
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {actionData?.error && (
                                <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-950 rounded-md">
                                    {actionData.error}
                                </div>
                            )}

                            <div className="flex gap-3">
                                <Button type="submit" className="flex-1" disabled={isSubmitting}>
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            저장 중...
                                        </>
                                    ) : (
                                        "변경사항 저장"
                                    )}
                                </Button>
                                <Button type="button" variant="outline" asChild>
                                    <Link to="/admin/categories">취소</Link>
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </PageContainer>
    );
}
