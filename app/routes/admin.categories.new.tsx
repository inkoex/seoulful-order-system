import { useActionData, useNavigation, useSubmit, data, redirect } from "react-router";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ArrowLeft } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth.server";
import { supabaseAdmin } from "@/lib/supabase.server";
import { PageContainer } from "@/components/ui/container";
import { invalidateCache } from "@/lib/cache.server";
import { invalidateNoticeSnapshot } from "@/lib/notices.server";
import type { Route } from "./+types/admin.categories.new";

const categorySchema = z.object({
    name: z.string().min(1, "영문 이름을 입력해주세요"),
    name_ko: z.string().min(1, "표시 이름을 입력해주세요"),
    sort_order: z.number().min(0, "정렬 순서는 0 이상이어야 합니다"),
    is_active: z.boolean(),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

export async function loader({ request }: Route.LoaderArgs) {
    await requireAuth(request);
    return null;
}

export async function action({ request }: Route.ActionArgs) {
    await requireAuth(request);

    const formData = await request.formData();
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

    // Check for duplicate name
    const { data: existing } = await supabaseAdmin
        .from('categories')
        .select('id')
        .eq('name', result.data.name)
        .limit(1);

    if (existing && existing.length > 0) {
        return data({
            error: "이미 존재하는 카테고리 이름입니다"
        }, { status: 400 });
    }

    // Insert category
    const { error } = await supabaseAdmin
        .from('categories')
        .insert({
            name: result.data.name,
            name_ko: result.data.name_ko,
            sort_order: result.data.sort_order,
            is_active: result.data.is_active,
        });

    if (error) {
        return data({
            error: "카테고리 추가에 실패했습니다",
            details: error.message
        }, { status: 500 });
    }

    invalidateCache('order-products');
    invalidateNoticeSnapshot();

    throw redirect("/admin/categories");
}

export default function AdminCategoryNewPage() {
    const actionData = useActionData<typeof action>();
    const navigation = useNavigation();
    const submit = useSubmit();
    const isSubmitting = navigation.state === "submitting";

    const form = useForm<CategoryFormValues>({
        resolver: zodResolver(categorySchema),
        defaultValues: {
            name: "",
            name_ko: "",
            sort_order: 0,
            is_active: true,
        },
    });

    function onSubmit(values: CategoryFormValues) {
        const formData = new FormData();
        formData.append("payload", JSON.stringify(values));
        submit(formData, { method: "post" });
    }

    return (
        <PageContainer size="standard">
            <div className="mb-8">
                <Button asChild variant="ghost" size="sm" className="mb-4">
                    <Link to="/admin/categories">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        카테고리 목록으로
                    </Link>
                </Button>
                <h1 className="text-3xl font-bold">카테고리 추가</h1>
                <p className="text-muted-foreground mt-1">새로운 카테고리를 등록합니다</p>
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
                                            추가 중...
                                        </>
                                    ) : (
                                        "카테고리 추가"
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
