import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const API_URL = process.env.VEXA_API_URL || "http://localhost:8066";
  const API_KEY = process.env.VEXA_API_KEY || "";
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (API_KEY) headers["X-API-Key"] = API_KEY;
    const resp = await fetch(`${API_URL}/calendar/connect?user_id=${userId}`, {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(10000),
    });
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 502 }
    );
  }
}
