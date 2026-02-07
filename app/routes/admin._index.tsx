import { redirect, useNavigate } from "react-router";
import { useEffect } from "react";

export async function loader() {
    return redirect("/admin/dashboard");
}

export default function AdminIndex() {
    const navigate = useNavigate();

    useEffect(() => {
        navigate("/admin/dashboard", { replace: true });
    }, [navigate]);

    return null;
}
