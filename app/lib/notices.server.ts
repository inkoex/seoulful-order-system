import { supabaseAdmin } from "@/lib/supabase.server";

type NoticeLimit = {
    id: string;
    type: "total" | "product";
    product_id: string | null;
    max_quantity: number;
};

type NoticeProduct = {
    product_id: string;
};

export type NoticeSnapshot = {
    hasNotices: boolean;
    orderingOpen: boolean;
    notice: null | {
        id: string;
        title: string;
        message: string;
        status: string;
        start_at: string;
        end_at: string | null;
        delivery_date: string | null;
        is_all_products: boolean;
    };
    targetProductIds: string[];
    totals: {
        totalMax: number | null;
        totalUsed: number;
        totalRemaining: number | null;
    };
    productRemainingById: Record<string, number>;
    productMaxById: Record<string, number>;
    soldOutProductIds: string[];
};

const toNumber = (value: unknown) => {
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return NaN;
        return Number(trimmed);
    }
    return Number(value);
};

const NOTICE_SNAPSHOT_TTL_MS = 30 * 1000;
let cachedNoticeSnapshot: { value: NoticeSnapshot; expiresAt: number } | null = null;

export async function getNoticeSnapshot(now = new Date()): Promise<NoticeSnapshot> {
    const nowMs = now.getTime();
    if (cachedNoticeSnapshot && cachedNoticeSnapshot.expiresAt > nowMs) {
        return cachedNoticeSnapshot.value;
    }

    const nowIso = now.toISOString();
    const { data: activeNotices, error: activeError } = await supabaseAdmin
        .from("notices")
        .select("id, title, message, status, start_at, end_at, delivery_date, is_all_products, notice_products(product_id), notice_limits(id, type, product_id, max_quantity)")
        .eq("status", "active")
        .lte("start_at", nowIso)
        .or(`end_at.is.null,end_at.gte.${nowIso}`)
        .order("created_at", { ascending: false })
        .limit(1);

    if (activeError) {
        console.error("Notice fetch error:", activeError);
    }

    const activeNotice = (activeNotices as any[] | null)?.[0] as any | undefined;

    if (!activeNotice) {
        const { count } = await supabaseAdmin
            .from("notices")
            .select("id", { count: "exact", head: true });

        const snapshot = {
            hasNotices: (count || 0) > 0,
            orderingOpen: false,
            notice: null,
            targetProductIds: [],
            totals: { totalMax: null, totalUsed: 0, totalRemaining: null },
            productRemainingById: {},
            productMaxById: {},
            soldOutProductIds: [],
        };
        cachedNoticeSnapshot = { value: snapshot, expiresAt: nowMs + NOTICE_SNAPSHOT_TTL_MS };
        return snapshot;
    }

    const notice = {
        id: activeNotice.id,
        title: activeNotice.title,
        message: activeNotice.message,
        status: activeNotice.status,
        start_at: activeNotice.start_at,
        end_at: activeNotice.end_at,
        delivery_date: activeNotice.delivery_date ?? null,
        is_all_products: activeNotice.is_all_products,
    };

    const noticeProducts = (activeNotice.notice_products || []) as NoticeProduct[];
    const noticeLimits = (activeNotice.notice_limits || []) as NoticeLimit[];

    let targetProductIds = noticeProducts.map((item) => item.product_id);
    if (notice.is_all_products) {
        const { data: products } = await supabaseAdmin
            .from("products")
            .select("id")
            .eq("is_active", true);
        targetProductIds = (products || []).map((product: any) => product.id);
    }

    const totalLimit = noticeLimits.find((limit) => limit.type === "total");
    const productLimits = noticeLimits.filter((limit) => limit.type === "product" && limit.product_id);

    const usageEnd = notice.end_at && new Date(notice.end_at) < now ? new Date(notice.end_at) : now;

    const productRemainingById: Record<string, number> = {};
    const productMaxById: Record<string, number> = {};
    productLimits.forEach((limit) => {
        if (limit.product_id) {
            productMaxById[limit.product_id] = Number(limit.max_quantity) || 0;
        }
    });

    let totalUsed = 0;
    const usedByProductId: Record<string, number> = {};
    const shouldCheckUsage = Boolean(totalLimit) || productLimits.length > 0;

    if (targetProductIds.length > 0 && shouldCheckUsage) {
        const { data: items, error } = await supabaseAdmin
            .from("order_items")
            .select("quantity, product_id, orders!inner(created_at, status)")
            .in("product_id", targetProductIds)
            .gte("orders.created_at", notice.start_at)
            .lte("orders.created_at", usageEnd.toISOString())
            .neq("orders.status", "cancelled");

        if (error) {
            console.error("Notice usage fetch error:", error);
        }

        (items || []).forEach((item: any) => {
            const qty = Number(item.quantity) || 0;
            totalUsed += qty;
            const current = usedByProductId[item.product_id] || 0;
            usedByProductId[item.product_id] = current + qty;
        });
    }

    productLimits.forEach((limit) => {
        if (!limit.product_id) return;
        const used = usedByProductId[limit.product_id] || 0;
        const max = Number(limit.max_quantity) || 0;
        productRemainingById[limit.product_id] = Math.max(0, max - used);
    });

    const totalMax = totalLimit ? toNumber(totalLimit.max_quantity) : null;
    const totalRemaining = totalMax === null || Number.isNaN(totalMax)
        ? null
        : Math.max(0, totalMax - totalUsed);

    const isTimeClosed = Boolean(notice.end_at && new Date(notice.end_at) < now);
    const isTotalClosed = totalRemaining !== null && totalRemaining <= 0;

    if (isTimeClosed || isTotalClosed) {
        await supabaseAdmin.from("notices").update({ status: "closed" }).eq("id", notice.id);
    }

    const soldOutProductIds = Object.entries(productRemainingById)
        .filter(([, remaining]) => remaining <= 0)
        .map(([productId]) => productId);

    const snapshot = {
        hasNotices: true,
        orderingOpen: !isTimeClosed && !isTotalClosed,
        notice,
        targetProductIds,
        totals: {
            totalMax: totalMax === null || Number.isNaN(totalMax) ? null : totalMax,
            totalUsed,
            totalRemaining,
        },
        productRemainingById,
        productMaxById,
        soldOutProductIds,
    };
    cachedNoticeSnapshot = { value: snapshot, expiresAt: nowMs + NOTICE_SNAPSHOT_TTL_MS };
    return snapshot;
}
export function invalidateNoticeSnapshot() {
    cachedNoticeSnapshot = null;
}
