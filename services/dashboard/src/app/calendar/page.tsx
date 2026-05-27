"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Unplug,
  Clock,
  Video,
  RefreshCw,
  Settings2,
  Pencil,
  Check,
  X,
  Bot,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth-store";
import { vexaAPI } from "@/lib/api";
import { withBasePath } from "@/lib/base-path";
import { cn } from "@/lib/utils";

interface CalendarEvent {
  id: number;
  title: string;
  start_time: string | null;
  end_time: string | null;
  meeting_url: string | null;
  platform: string | null;
  status: string;
  bot_name: string | null;
}

interface Preferences {
  auto_join: boolean;
  lead_time_minutes: number;
  leave_after_minutes: number;
  default_bot_name: string;
}

const PLATFORM_LABELS: Record<string, { label: string; color: string }> = {
  google_meet: { label: "Google Meet", color: "bg-green-900/40 text-green-300" },
  zoom: { label: "Zoom", color: "bg-blue-900/40 text-blue-300" },
  teams: { label: "Teams", color: "bg-purple-900/40 text-purple-300" },
};

function formatEventTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "Pending", cls: "bg-yellow-900/40 text-yellow-300" },
    scheduled: { label: "Scheduled", cls: "bg-blue-900/40 text-blue-300" },
    failed: { label: "Failed", cls: "bg-red-900/40 text-red-300" },
    cancelled: { label: "Cancelled", cls: "bg-zinc-700/50 text-zinc-400" },
  };
  const info = map[status] || { label: status, cls: "bg-zinc-700/50 text-zinc-400" };
  return (
    <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold", info.cls)}>
      {info.label}
    </span>
  );
}

export default function CalendarPage() {
  const user = useAuthStore((s) => s.user);

  const [connected, setConnected] = useState(false);
  const [eventCount, setEventCount] = useState(0);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [prefs, setPrefs] = useState<Preferences>({
    auto_join: true,
    lead_time_minutes: 2,
    leave_after_minutes: 0,
    default_bot_name: ".",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [editBotName, setEditBotName] = useState("");
  const [savingEventId, setSavingEventId] = useState<number | null>(null);

  const userId = user?.id ? Number(user.id) : null;

  const fetchStatus = useCallback(async () => {
    let uid = userId;
    if (!uid) {
      try {
        const meResp = await fetch(withBasePath("/api/auth/me"));
        if (meResp.ok) {
          const meData = await meResp.json();
          if (meData.user?.id) uid = Number(meData.user.id);
        }
      } catch { /* ignore */ }
    }
    if (!uid) {
      setIsLoading(false);
      return;
    }
    try {
      const status = await vexaAPI.calendar.getStatus(uid);
      setConnected(status.connected);
      setEventCount(status.event_count);

      if (status.connected) {
        const evts = await vexaAPI.calendar.getEvents(uid);
        setEvents(evts.map((e) => ({ ...e, bot_name: (e as Record<string, unknown>).bot_name as string | null ?? null })));
      }
    } catch {
      setConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      // Get fresh email from server (zustand store may be stale)
      let email = user?.email;
      if (!email) {
        const meResp = await fetch("/api/auth/me");
        if (!meResp.ok) throw new Error("Not authenticated — please log in again");
        const meData = await meResp.json();
        email = meData.user?.email;
      }
      if (!email) {
        toast.error("No user email found");
        setIsConnecting(false);
        return;
      }
      const { authUrl } = await vexaAPI.calendar.startOAuth(email, "/calendar");
      window.location.href = authUrl;
    } catch (error) {
      toast.error("Failed to start Google Calendar connection", {
        description: (error as Error).message,
      });
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!userId) return;
    setIsDisconnecting(true);
    try {
      await vexaAPI.calendar.disconnect(userId);
      setConnected(false);
      setEvents([]);
      setEventCount(0);
      toast.success("Google Calendar disconnected");
    } catch (error) {
      toast.error("Failed to disconnect", { description: (error as Error).message });
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleRefresh = async () => {
    if (!userId) return;
    setIsRefreshing(true);
    try {
      const result = await vexaAPI.calendar.connect(userId);
      setEventCount(result.events_synced);
      const evts = await vexaAPI.calendar.getEvents(userId);
      setEvents(evts.map((e) => ({ ...e, bot_name: (e as Record<string, unknown>).bot_name as string | null ?? null })));
      toast.success(`Synced ${result.events_synced} events`);
    } catch (error) {
      toast.error("Sync failed", { description: (error as Error).message });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSavePrefs = async () => {
    if (!userId) return;
    setIsSavingPrefs(true);
    try {
      await vexaAPI.calendar.updatePreferences(userId, prefs);
      toast.success("Preferences saved");
    } catch (error) {
      toast.error("Failed to save preferences", { description: (error as Error).message });
    } finally {
      setIsSavingPrefs(false);
    }
  };

  const handleSaveBotName = async (eventId: number) => {
    setSavingEventId(eventId);
    try {
      await vexaAPI.calendar.updateEventBotName(eventId, editBotName);
      setEvents((prev) =>
        prev.map((e) => (e.id === eventId ? { ...e, bot_name: editBotName || null } : e))
      );
      setEditingEventId(null);
      toast.success("Bot name updated");
    } catch (error) {
      toast.error("Failed to update bot name", { description: (error as Error).message });
    } finally {
      setSavingEventId(null);
    }
  };

  const startEditBotName = (evt: CalendarEvent) => {
    setEditBotName(evt.bot_name || "");
    setEditingEventId(evt.id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-foreground">
          Google Calendar
        </h1>
        <p className="text-sm text-muted-foreground">
          Auto-join meetings and record transcripts from your calendar
        </p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Connection Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Connection
            </CardTitle>
            <CardDescription>
              Connect your Google Calendar to automatically detect upcoming meetings with video call links.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {connected ? (
              <>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span className="font-medium text-green-600">Connected</span>
                  <Badge variant="secondary">{eventCount} events synced</Badge>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
                    {isRefreshing ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Sync Now
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleDisconnect} disabled={isDisconnecting}>
                    {isDisconnecting ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Unplug className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Disconnect
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                    <CalendarIcon className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium mb-1">No Calendar Connected</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mb-4">
                    Connect Google Calendar to auto-detect meetings and schedule bots to join and transcribe them.
                  </p>
                  <Button onClick={handleConnect} disabled={isConnecting}>
                    {isConnecting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4 mr-2" />
                    )}
                    Connect Google Calendar
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Preferences */}
        {connected && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                Auto-Join Preferences
              </CardTitle>
              <CardDescription>
                Configure how Vexa joins your scheduled meetings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Auto-Join Meetings</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically send a bot to meetings detected from your calendar.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={prefs.auto_join}
                  onClick={() => setPrefs((p) => ({ ...p, auto_join: !p.auto_join }))}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                    prefs.auto_join ? "bg-primary" : "bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 rounded-full bg-white transition-transform",
                      prefs.auto_join ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </button>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Bot className="h-3.5 w-3.5" />
                  Default Bot Name
                </Label>
                <p className="text-xs text-muted-foreground">
                  Name shown in the meeting participant list. Can be overridden per meeting.
                </p>
                <Input
                  value={prefs.default_bot_name}
                  onChange={(e) => setPrefs((p) => ({ ...p, default_bot_name: e.target.value }))}
                  placeholder="."
                  className="max-w-xs"
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Lead Time (minutes before meeting)
                </Label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 5, 10].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPrefs((p) => ({ ...p, lead_time_minutes: m }))}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-xs font-medium border transition-all",
                        prefs.lead_time_minutes === m
                          ? "border-foreground/30 bg-muted"
                          : "border-border hover:border-muted-foreground/30"
                      )}
                    >
                      {m} min
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="text-sm font-medium">Auto-Leave (bot exit time)</Label>
                <p className="text-xs text-muted-foreground">
                  How long the bot stays in the meeting before leaving. Set to 0 to stay until the meeting ends.
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { label: "Until end", value: 0 },
                    { label: "15 min", value: 15 },
                    { label: "30 min", value: 30 },
                    { label: "60 min", value: 60 },
                    { label: "120 min", value: 120 },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPrefs((p) => ({ ...p, leave_after_minutes: opt.value }))}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-xs font-medium border transition-all",
                        prefs.leave_after_minutes === opt.value
                          ? "border-foreground/30 bg-muted"
                          : "border-border hover:border-muted-foreground/30"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <Button size="sm" onClick={handleSavePrefs} disabled={isSavingPrefs}>
                {isSavingPrefs ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : null}
                Save Preferences
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Upcoming Events */}
        {connected && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5" />
                Upcoming Meetings
              </CardTitle>
              <CardDescription>
                Calendar events with video call links that Vexa can join.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No upcoming meetings with video links found.
                </p>
              ) : (
                <div className="space-y-3">
                  {events.map((evt) => (
                    <div
                      key={evt.id}
                      className="rounded-lg bg-muted/50 px-4 py-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">
                              {evt.title || "Untitled Event"}
                            </span>
                            {evt.platform && PLATFORM_LABELS[evt.platform] && (
                              <span
                                className={cn(
                                  "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold",
                                  PLATFORM_LABELS[evt.platform].color
                                )}
                              >
                                {PLATFORM_LABELS[evt.platform].label}
                              </span>
                            )}
                            {statusBadge(evt.status)}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {formatEventTime(evt.start_time)}
                          </p>
                        </div>
                        {evt.meeting_url && (
                          <a
                            href={evt.meeting_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground transition-colors ml-2"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>

                      {/* Bot name row */}
                      <div className="mt-2 flex items-center gap-2">
                        <Bot className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        {editingEventId === evt.id ? (
                          <div className="flex items-center gap-1 flex-1">
                            <Input
                              value={editBotName}
                              onChange={(e) => setEditBotName(e.target.value)}
                              placeholder={prefs.default_bot_name}
                              className="h-6 text-xs py-0 px-2"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveBotName(evt.id);
                                if (e.key === "Escape") setEditingEventId(null);
                              }}
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveBotName(evt.id)}
                              disabled={savingEventId === evt.id}
                              className="text-green-500 hover:text-green-400"
                            >
                              {savingEventId === evt.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              )}
                            </button>
                            <button
                              onClick={() => setEditingEventId(null)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditBotName(evt)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors group"
                          >
                            <span className="truncate max-w-[200px]">
                              {evt.bot_name || prefs.default_bot_name}
                            </span>
                            <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
