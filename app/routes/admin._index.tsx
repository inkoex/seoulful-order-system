import { redirect } from "react-router";
import type { Route } from "./+types/admin._index";

export async function loader() {
    return redirect("/admin/dashboard");
}

export default function AdminIndex() {
    return null;
}
