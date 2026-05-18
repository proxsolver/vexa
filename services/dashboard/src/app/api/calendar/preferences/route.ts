import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest) {
  const API_URL = process.env.VEXA_API_URL || "http://localhost:8066";
  const API_KEY = process.env.VEXA_API_KEY || "";
  const userId = req.nextUrl.searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  // Map frontend params to backend params (userId -> user_id)
  const backendParams = new URLSearchParams();
  backendParams.set("user_id", userId);

  const srcParams = req.nextUrl.searchParams;
  if (srcParams.get("auto_join") !== null) backendParams.set("auto_join", srcParams.get("auto_join")!);
  if (srcParams.get("lead_time_minutes") !== null) backendParams.set("lead_time_minutes", srcParams.get("lead_time_minutes")!);
  if (srcParams.get("leave_after_minutes") !== null) backendParams.set("leave_after_minutes", srcParams.get("leave_after_minutes")!);
  if (srcParams.get("default_bot_name") !== null) backendParams.set("default_bot_name", srcParams.get("default_bot_name")!);

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (API_KEY) headers["X-API-Key"] = API_KEY;
    const resp = await fetch(`${API_URL}/calendar/preferences?${backendParams.toString()}`, {
      method: "PUT",
      headers,
      signal: AbortSignal.timeout(5000),
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
