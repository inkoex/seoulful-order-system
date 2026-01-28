import { redirect } from "react-router";
import { clearSessionCookie } from "@/lib/auth.server";
import type { Route } from "./+types/admin.logout";

export async function loader({ request }: Route.LoaderArgs) {
    // Clear session and redirect to login
    throw redirect("/admin/login", {
        headers: {
            "Set-Cookie": clearSessionCookie()
        }
    });
}

export default function AdminLogoutPage() {
    return null;
}
