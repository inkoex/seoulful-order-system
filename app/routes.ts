import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("routes/_index.tsx"),
    route("order/complete", "routes/order.complete.tsx"),
    route("order/lookup", "routes/order.lookup.tsx"),
    route("order/edit/:id", "routes/order.edit.$id.tsx"),

    // Admin routes
    route("admin/login", "routes/admin.login.tsx"),
    route("admin/logout", "routes/admin.logout.tsx"),
    route("admin/dashboard", "routes/admin.dashboard.tsx"),
    route("admin/products", "routes/admin.products._index.tsx"),
    route("admin/products/new", "routes/admin.products.new.tsx"),
    route("admin/products/:id", "routes/admin.products.$id.tsx"),
    route("admin/categories", "routes/admin.categories._index.tsx"),
    route("admin/categories/new", "routes/admin.categories.new.tsx"),
    route("admin/categories/:id", "routes/admin.categories.$id.tsx"),
    route("admin/apartments", "routes/admin.apartments._index.tsx"),
    route("admin/apartments/new", "routes/admin.apartments.new.tsx"),
    route("admin/apartments/:id", "routes/admin.apartments.$id.tsx"),
    route("admin/orders", "routes/admin.orders._index.tsx"),
    route("admin/orders/new", "routes/admin.orders.new.tsx"),
    route("admin/orders/:id", "routes/admin.orders.$id.tsx"),
] satisfies RouteConfig;
