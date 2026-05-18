import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Calendar service URL (direct, not through api-gateway since gateway doesn't route this)
const CALENDAR_SERVICE_URL = process.env.CALENDAR_SERVICE_URL || "http://calendar-service:8050";
const API_URL = process.env.VEXA_API_URL || "http://localhost:8066";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const API_KEY = process.env.VEXA_API_KEY || "";
  const { eventId } = await params;
  const botName = req.nextUrl.searchParams.get("bot_name");

  if (!botName && botName !== "") {
    return NextResponse.json({ error: "bot_name is required" }, { status: 400 });
  }

  const qs = new URLSearchParams({ bot_name: botName }).toString();

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (API_KEY) headers["X-API-Key"] = API_KEY;

    // Try api-gateway first, fallback to direct calendar-service
    const resp = await fetch(`${API_URL}/calendar/events/${eventId}/bot-name?${qs}`, {
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
