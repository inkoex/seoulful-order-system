import { redirect } from "react-router";

export async function loader() {
    return redirect("/admin/dashboard");
}

export default function AdminIndex() {
    return null;
}
