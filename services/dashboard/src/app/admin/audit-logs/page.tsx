"use client";

import { useEffect, useState, useCallback } from "react";
import { adminAPI } from "@/lib/admin-api";
import { AuditLog } from "@/types/vexa";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Shield,
  Search,
} from "lucide-react";

const PAGE_SIZE = 50;

const RESOURCE_TYPES = [
  { value: "all", label: "All Resources" },
  { value: "meeting", label: "Meeting" },
  { value: "transcript", label: "Transcript" },
  { value: "recording", label: "Recording" },
  { value: "user", label: "User" },
  { value: "token", label: "Token" },
  { value: "auth", label: "Auth" },
  { value: "config", label: "Config" },
  { value: "analytics", label: "Analytics" },
];

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterUserId, setFilterUserId] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterResourceType, setFilterResourceType] = useState("all");

  const fetchLogs = useCallback(async (newSkip = 0) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = {
        skip: newSkip,
        limit: PAGE_SIZE,
      };
      if (filterUserId) params.user_id = Number(filterUserId);
      if (filterAction) params.action = filterAction;
      if (filterResourceType && filterResourceType !== "all")
        params.resource_type = filterResourceType;

      const data = await adminAPI.getAuditLogs(params);
      setLogs(data.items);
      setTotal(data.total);
      setSkip(newSkip);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [filterUserId, filterAction, filterResourceType]);

  useEffect(() => {
    fetchLogs(0);
  }, [fetchLogs]);

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return ts;
    }
  };

  const getStatusColor = (code: number | null) => {
    if (!code) return "text-gray-500";
    if (code < 300) return "text-green-600 dark:text-green-400";
    if (code < 400) return "text-blue-600 dark:text-blue-400";
    return "text-red-600 dark:text-red-400";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6" />
          Audit Logs
        </h1>
        <p className="text-muted-foreground mt-1">
          Track all authenticated API activity
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="w-32">
              <label className="text-xs text-muted-foreground mb-1 block">
                User ID
              </label>
              <Input
                placeholder="User ID"
                value={filterUserId}
                onChange={(e) => setFilterUserId(e.target.value)}
                type="number"
              />
            </div>
            <div className="w-48">
              <label className="text-xs text-muted-foreground mb-1 block">
                Action
              </label>
              <Input
                placeholder="e.g. create_bot"
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
              />
            </div>
            <div className="w-44">
              <label className="text-xs text-muted-foreground mb-1 block">
                Resource
              </label>
              <Select
                value={filterResourceType}
                onValueChange={setFilterResourceType}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESOURCE_TYPES.map((rt) => (
                    <SelectItem key={rt.value} value={rt.value}>
                      {rt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => fetchLogs(0)}
              disabled={loading}
              variant="outline"
              size="sm"
            >
              <Search className="h-4 w-4 mr-1" />
              Search
            </Button>
            <Button
              onClick={() => fetchLogs(skip)}
              disabled={loading}
              variant="ghost"
              size="sm"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {total.toLocaleString()} entries
            {total > PAGE_SIZE &&
              ` (showing ${skip + 1}-${Math.min(skip + PAGE_SIZE, total)})`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="text-red-500 text-sm mb-4">Error: {error}</div>
          )}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">Time</TableHead>
                  <TableHead className="w-16">User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead className="w-24">Resource</TableHead>
                  <TableHead className="w-16">Status</TableHead>
                  <TableHead className="w-32">IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && logs.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-8 text-muted-foreground"
                    >
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No audit logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs font-mono">
                        {formatTime(log.timestamp)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.user_id ?? "-"}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                          {log.action}
                        </span>
                      </TableCell>
                      <TableCell>
                        {log.resource_type && (
                          <span className="text-xs text-muted-foreground">
                            {log.resource_type}
                            {log.resource_id && (
                              <span className="font-mono ml-1">
                                {log.resource_id.length > 12
                                  ? `${log.resource_id.slice(0, 12)}...`
                                  : log.resource_id}
                              </span>
                            )}
                          </span>
                        )}
                      </TableCell>
                      <TableCell
                        className={`font-mono text-xs font-semibold ${getStatusColor(log.status_code)}`}
                      >
                        {log.status_code ?? "-"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {log.ip_address ?? "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={skip === 0 || loading}
                onClick={() => fetchLogs(Math.max(0, skip - PAGE_SIZE))}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {Math.floor(skip / PAGE_SIZE) + 1} of{" "}
                {Math.ceil(total / PAGE_SIZE)}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={skip + PAGE_SIZE >= total || loading}
                onClick={() => fetchLogs(skip + PAGE_SIZE)}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
