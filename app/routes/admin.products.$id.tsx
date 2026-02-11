import { useActionData, useLoaderData, useNavigation, useSubmit, data, redirect } from "react-router";
import { z } from "zod";
import { useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
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
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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
import type { Route } from "./+types/admin.products.$id";

interface Category {
    id: string;
    name: string;
    name_ko: string;
}

const numberFromInput = (value: unknown) => {
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return NaN;
        return Number(trimmed);
    }
    return value;
};

const productSchema = z.object({
    name: z.string().min(1, "영문 이름을 입력해주세요"),
    name_ko: z.string().min(1, "한글 이름을 입력해주세요"),
    category_id: z.string().min(1, "카테고리를 선택해주세요"),
    price: z.preprocess(numberFromInput, z.number().min(0, "가격은 0 이상이어야 합니다")),
    description: z.string().optional(),
    image_url: z.preprocess(
        (val) => val === "" ? undefined : val,
        z.string().url("올바른 URL을 입력해주세요").optional()
    ),
    is_active: z.boolean().default(true),
    sort_order: z.preprocess(numberFromInput, z.number().min(0, "정렬 순서는 0 이상이어야 합니다")),
});

type ProductFormValues = z.infer<typeof productSchema>;
type ProductFormInput = z.input<typeof productSchema>;

export async function loader({ request, params }: Route.LoaderArgs) {
    await requireAuth(request);

    // Fetch product
    const { data: product, error } = await supabaseAdmin
        .from('products')
        .select('*')
        .eq('id', params.id)
        .single();

    if (error || !product) {
        throw new Response("상품을 찾을 수 없습니다", { status: 404 });
    }

    // Fetch categories
    const { data: categories, error: catError } = await supabaseAdmin
        .from('categories')
        .select('id, name, name_ko')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

    if (catError) {
        console.error('Categories fetch error:', catError);
    }

    return data({ product, categories: categories || [] });
}

export async function action({ request, params }: Route.ActionArgs) {
    await requireAuth(request);

    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "delete") {
        // Delete product
        const { error } = await supabaseAdmin
            .from('products')
            .delete()
            .eq('id', params.id);

        if (error) {
            return data({
                error: "상품 삭제에 실패했습니다",
                details: error.message
            }, { status: 500 });
        }

        invalidateCache('order-products');
        invalidateNoticeSnapshot();
        throw redirect("/admin/products");
    }

    // Update product
    const payloadString = formData.get("payload");

    if (!payloadString || typeof payloadString !== "string") {
        return data({ error: "Invalid submission format" }, { status: 400 });
    }

    const payload = JSON.parse(payloadString);
    const result = productSchema.safeParse(payload);

    if (!result.success) {
        return data({
            error: "입력값을 확인해주세요",
            details: result.error.flatten()
        }, { status: 400 });
    }

    // Update product
    const { error } = await supabaseAdmin
        .from('products')
        .update({
            name: result.data.name,
            name_ko: result.data.name_ko,
            category_id: result.data.category_id,
            price: result.data.price,
            description: result.data.description || null,
            image_url: result.data.image_url || null,
            is_active: result.data.is_active,
            sort_order: result.data.sort_order,
        })
        .eq('id', params.id);

    if (error) {
        return data({
            error: "상품 수정에 실패했습니다",
            details: error.message
        }, { status: 500 });
    }

    invalidateCache('order-products');
    invalidateNoticeSnapshot();
    throw redirect("/admin/products");
}

export default function AdminProductEditPage() {
    const { product, categories } = useLoaderData<typeof loader>();
    const actionData = useActionData<typeof action>();
    const navigation = useNavigation();
    const submit = useSubmit();
    const isSubmitting = navigation.state === "submitting";

    const form = useForm<ProductFormInput>({
        resolver: zodResolver(productSchema) as unknown as Resolver<ProductFormInput>,
        defaultValues: {
            name: product.name || "",
            name_ko: product.name_ko || "",
            category_id: product.category_id || "",
            price: product.price !== null && product.price !== undefined ? String(product.price) : "",
            description: product.description || "",
            image_url: product.image_url || "",
            is_active: product.is_active ?? true,
            sort_order: product.sort_order !== null && product.sort_order !== undefined ? String(product.sort_order) : "0",
        },
    });

    function onSubmit(values: ProductFormInput) {
        const formData = new FormData();
        formData.append("payload", JSON.stringify(values));
        submit(formData, { method: "post" });
    }

    function handleDelete() {
        const formData = new FormData();
        formData.append("intent", "delete");
        submit(formData, { method: "post" });
    }

    return (
        <PageContainer size="standard">
            <div className="mb-8">
                <Button asChild variant="ghost" size="sm" className="mb-4">
                    <Link to="/admin/products">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        상품 목록으로
                    </Link>
                </Button>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">상품 수정</h1>
                        <p className="text-muted-foreground mt-1">{product.name_ko}</p>
                    </div>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="icon" className="h-9 w-9" title="삭제">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>상품을 삭제하시겠습니까?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    이 작업은 되돌릴 수 없습니다. 상품 "{product.name_ko}"가 영구적으로 삭제됩니다.
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
                    <CardTitle>상품 정보</CardTitle>
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
                                            <FormLabel>이름 (한글) *</FormLabel>
                                            <FormControl>
                                                <Input placeholder="소금빵" {...field} />
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
                                    name="category_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>카테고리 *</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="선택" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {categories.map((cat: Category) => (
                                                        <SelectItem key={cat.id} value={cat.id}>
                                                            {cat.name_ko} ({cat.name})
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="price"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>가격 (₹) *</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    placeholder="100"
                                                    {...field}
                                                    onChange={(e) => field.onChange(e.target.value)}
                                                    value={(field.value as string | number | undefined) ?? ""}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>설명</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="상품 설명 (선택사항)"
                                                className="resize-none"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            상품에 대한 간단한 설명을 입력하세요
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="image_url"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>이미지 URL</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="url"
                                                placeholder="https://example.com/image.jpg"
                                                {...field}
                                                value={(field.value as string | undefined) ?? ""}
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            상품 이미지 URL (선택사항)
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

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
                                                    onChange={(e) => field.onChange(e.target.value)}
                                                    value={(field.value as string | number | undefined) ?? ""}
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
                                    <Link to="/admin/products">취소</Link>
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </PageContainer>
    );
}
