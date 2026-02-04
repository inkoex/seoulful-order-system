import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("routes/_index.tsx"),
    route("order", "routes/order._index.tsx"),
    route("order/complete", "routes/order.complete.tsx"),
    route("order/lookup", "routes/order.lookup.tsx"),
    route("order/edit/:id", "routes/order.edit.$id.tsx"),

    // Admin routes (with layout)
    route("admin", "routes/admin.tsx", [
        route("dashboard", "routes/admin.dashboard.tsx"),
        route("products", "routes/admin.products._index.tsx"),
        route("products/new", "routes/admin.products.new.tsx"),
        route("products/:id", "routes/admin.products.$id.tsx"),
        route("categories", "routes/admin.categories._index.tsx"),
        route("categories/new", "routes/admin.categories.new.tsx"),
        route("categories/:id", "routes/admin.categories.$id.tsx"),
        route("apartments", "routes/admin.apartments._index.tsx"),
        route("apartments/new", "routes/admin.apartments.new.tsx"),
        route("apartments/:id", "routes/admin.apartments.$id.tsx"),
        route("orders", "routes/admin.orders._index.tsx"),
        route("orders/new", "routes/admin.orders.new.tsx"),
        route("orders/:id", "routes/admin.orders.$id.tsx"),
        route("notices", "routes/admin.notices._index.tsx"),
        route("notices/new", "routes/admin.notices.new.tsx"),
        route("notices/:id", "routes/admin.notices.$id.tsx"),
    ]),
    // Keep login/logout outside layout
    route("admin/login", "routes/admin.login.tsx"),
    route("admin/logout", "routes/admin.logout.tsx"),
] satisfies RouteConfig;
