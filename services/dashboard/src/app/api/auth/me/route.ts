import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createUserToken } from "@/lib/vexa-admin-api";

// Scopes every dashboard session needs. Tokens minted before scope
// enforcement carry {bot} only and 403 on /transcripts and /b/ routes.
const REQUIRED_SCOPES = ["bot", "tx", "browser"];

function isSecureRequest(): boolean {
  return process.env.NEXTAUTH_URL?.startsWith("https://") ||
         process.env.DASHBOARD_URL?.startsWith("https://") ||
         false;
}

/**
 * Get current user info from token.
 * Auth chain: cookie only. No fallback to env vars.
 * User identity resolved via gateway /auth/me.
 */
export async function GET() {
  const VEXA_API_URL = process.env.VEXA_API_URL || "http://localhost:8056";

  const cookieStore = await cookies();
  const cookieToken = cookieStore.get("vexa-token")?.value;
  const token = cookieToken || "";

  if (!token) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  try {
    // Resolve user identity via gateway /auth/me
    const response = await fetch(`${VEXA_API_URL}/auth/me`, {
      headers: { "X-API-Key": token },
    });

    if (!response.ok) {
      if (cookieToken) cookieStore.delete("vexa-token");
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401 }
      );
    }

    const data = await response.json();
    const user = {
      id: data.user_id,
      email: data.email,
      name: data.name || data.email,
      role: data.role || "free",
      status: data.status || "approved",
    };

    // Self-heal under-scoped sessions: mint a full-scope token and rotate
    // the cookie. On mint failure keep the old token — same behavior as before.
    let activeToken = token;
    const scopes: string[] = Array.isArray(data.scopes) ? data.scopes : [];
    if (REQUIRED_SCOPES.some((s) => !scopes.includes(s))) {
      const minted = await createUserToken(String(data.user_id));
      if (minted.success && minted.data?.token) {
        activeToken = minted.data.token;
        cookieStore.set("vexa-token", activeToken, {
          httpOnly: true,
          secure: isSecureRequest(),
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 30, // 30 days
          path: "/",
        });
      }
    }

    return NextResponse.json({ authenticated: true, user, token: activeToken });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to verify authentication" },
      { status: 500 }
    );
  }
}
