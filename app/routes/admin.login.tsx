import { useState } from "react";
import { useActionData, useNavigation, useSubmit, data, redirect } from "react-router";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageContainer } from "@/components/ui/container";
import { verifyPassword, createSession, createSessionCookie, getSession } from "@/lib/auth.server";
import type { Route } from "./+types/admin.login";

const loginSchema = z.object({
    password: z.string().min(1, "비밀번호를 입력해주세요"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export async function loader({ request }: Route.LoaderArgs) {
    // If already logged in, redirect to dashboard
    const session = getSession(request);
    if (session) {
        throw redirect("/admin/dashboard");
    }
    return null;
}

export async function action({ request }: Route.ActionArgs) {
    const formData = await request.formData();
    const payloadString = formData.get("payload");

    if (!payloadString || typeof payloadString !== "string") {
        return data({ error: "Invalid submission format" }, { status: 400 });
    }

    const payload = JSON.parse(payloadString);
    const result = loginSchema.safeParse(payload);

    if (!result.success) {
        return data({
            error: "유효하지 않은 입력입니다",
            details: result.error.flatten()
        }, { status: 400 });
    }

    // Verify password
    const isValid = await verifyPassword(result.data.password);
    if (!isValid) {
        return data({
            error: "비밀번호가 올바르지 않습니다"
        }, { status: 401 });
    }

    // Create session
    const sessionToken = createSession();
    const cookie = createSessionCookie(sessionToken);

    // Redirect to dashboard with session cookie
    throw redirect("/admin/dashboard", {
        headers: {
            "Set-Cookie": cookie
        }
    });
}

export default function AdminLoginPage() {
    const actionData = useActionData<typeof action>();
    const navigation = useNavigation();
    const submit = useSubmit();
    const isSubmitting = navigation.state === "submitting";
    const [showPassword, setShowPassword] = useState(false);

    const form = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
        defaultValues: { password: "" },
    });

    function onSubmit(values: LoginFormValues) {
        const formData = new FormData();
        formData.append("payload", JSON.stringify(values));
        submit(formData, { method: "post" });
    }

    return (
        <PageContainer size="narrow" className="h-screen flex flex-col justify-center">
            <Card>
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                        <Lock className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle className="text-2xl">관리자 로그인</CardTitle>
                    <CardDescription>
                        Seoulful Order System Admin
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <FormField
                                control={form.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="block pb-2">비밀번호 (Password)</FormLabel>
                                        <div className="mt-2 relative">
                                            <FormControl>
                                                <Input
                                                    type={showPassword ? "text" : "password"}
                                                    placeholder="Enter admin password"
                                                    autoFocus
                                                    {...field}
                                                    className="pr-12"
                                                />
                                            </FormControl>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                                onClick={() => setShowPassword((prev) => !prev)}
                                                aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보이기"}
                                            >
                                                {showPassword ? (
                                                    <EyeOff className="h-4 w-4" />
                                                ) : (
                                                    <Eye className="h-4 w-4" />
                                                )}
                                            </Button>
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {actionData?.error && (
                                <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-950 rounded-md">
                                    {actionData.error}
                                </div>
                            )}

                            <Button type="submit" className="w-full" disabled={isSubmitting}>
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        로그인 중...
                                    </>
                                ) : (
                                    "로그인"
                                )}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </PageContainer>
    );
}
