import { redirect } from "react-router";
import { createHmac } from "crypto";
import bcrypt from "bcryptjs";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || "";
const SESSION_SECRET = process.env.SESSION_SECRET || "fallback-secret-key";
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export async function verifyPassword(password: string): Promise<boolean> {
    // 1. If ADMIN_PASSWORD_HASH is provided, use bcrypt (Secure)
    if (ADMIN_PASSWORD_HASH) {
        return bcrypt.compare(password, ADMIN_PASSWORD_HASH);
    }
    // 2. Fallback to plain text comparison (Legacy/Support for initial setup)
    return password === ADMIN_PASSWORD;
}

export function createSession(): string {
    const timestamp = Date.now();
    const expiresAt = timestamp + SESSION_DURATION;
    const payload = `${timestamp}:${expiresAt}`;
    const signature = createHmac("sha256", SESSION_SECRET)
        .update(payload)
        .digest("hex");
    return `${payload}:${signature}`;
}

export function getSession(request: Request): string | null {
    const cookieHeader = request.headers.get("Cookie");
    if (!cookieHeader) return null;

    const cookies = cookieHeader.split(";").map(c => c.trim());
    const sessionCookie = cookies.find(c => c.startsWith("admin_session="));
    if (!sessionCookie) return null;

    const sessionToken = sessionCookie.split("=")[1];
    if (!sessionToken) return null;

    // Verify session token
    const parts = sessionToken.split(":");
    if (parts.length !== 3) return null;

    const [timestamp, expiresAt, signature] = parts;
    const payload = `${timestamp}:${expiresAt}`;

    // Verify signature
    const expectedSignature = createHmac("sha256", SESSION_SECRET)
        .update(payload)
        .digest("hex");

    if (signature !== expectedSignature) return null;

    // Check expiration
    const expiresAtTime = parseInt(expiresAt, 10);
    if (Date.now() > expiresAtTime) return null;

    return sessionToken;
}

export async function requireAuth(request: Request): Promise<void> {
    const session = getSession(request);
    if (!session) {
        throw redirect("/admin/login");
    }
}

export function createSessionCookie(sessionToken: string): string {
    const maxAge = SESSION_DURATION / 1000; // Convert to seconds
    return `admin_session=${sessionToken}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

export function clearSessionCookie(): string {
    return "admin_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax";
}
