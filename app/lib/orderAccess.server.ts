import { createHmac, timingSafeEqual } from "crypto";

/**
 * Short-lived, signed capability granting edit/view access to ONE order.
 *
 * The permanent `edit_token` never leaves the server. Instead, once a customer
 * proves ownership (order number + phone at lookup, or by having just placed the
 * order), the server hands out a grant: an HMAC over the order id plus an expiry.
 * It carries no phone number and no permanent token, and it expires, so a leaked
 * URL (browser history, a forwarded link) is only briefly and narrowly useful.
 */

function requireSecret(): string {
    const secret = process.env.SESSION_SECRET;
    if (!secret) {
        throw new Error(
            "Missing SESSION_SECRET environment variable (required to sign order grants)."
        );
    }
    return secret;
}

const SECRET = requireSecret();
const GRANT_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

function sign(payload: string): string {
    return createHmac("sha256", SECRET).update(`order-edit:${payload}`).digest("hex");
}

export function createOrderGrant(orderId: string, now: number = Date.now()): string {
    const expiresAt = now + GRANT_TTL_MS;
    return `${expiresAt}.${sign(`${orderId}:${expiresAt}`)}`;
}

export function verifyOrderGrant(
    orderId: string,
    grant: string | null | undefined,
    now: number = Date.now()
): boolean {
    if (!grant) return false;
    const dot = grant.lastIndexOf(".");
    if (dot <= 0) return false;

    const expiresStr = grant.slice(0, dot);
    const sig = grant.slice(dot + 1);
    const expiresAt = Number(expiresStr);
    if (!Number.isFinite(expiresAt) || now > expiresAt) return false;

    const expected = sign(`${orderId}:${expiresAt}`);
    const sigBuf = Buffer.from(sig, "hex");
    const expectedBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expectedBuf.length) return false;
    return timingSafeEqual(sigBuf, expectedBuf);
}
