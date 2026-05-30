"use client";

import { useEffect, useState, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import { Shield, Check, X, RefreshCw, Clock, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { adminAPI } from "@/lib/admin-api";
import type { VexaUser } from "@/types/vexa";
import { parseUTCTimestamp } from "@/lib/utils";
import { toast } from "sonner";

export default function AdminApprovalsPage() {
  const [pendingUsers, setPendingUsers] = useState<VexaUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchPending = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const users = await adminAPI.getPendingUsers();
      setPendingUsers(users);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const handleApprove = async (userId: string, email: string) => {
    setActionLoading(userId);
    try {
      await adminAPI.approveUser(userId);
      toast.success(`Approved ${email}`);
      setPendingUsers((prev) => prev.filter((u) => String(u.id) !== userId));
    } catch (err) {
      toast.error(`Failed to approve: ${(err as Error).message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (userId: string, email: string) => {
    setActionLoading(userId);
    try {
      await adminAPI.rejectUser(userId);
      toast.success(`Rejected ${email}`);
      setPendingUsers((prev) => prev.filter((u) => String(u.id) !== userId));
    } catch (err) {
      toast.error(`Failed to reject: ${(err as Error).message}`);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Approvals</h1>
          <p className="text-muted-foreground">
            Review and approve new user registrations
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchPending} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : error ? (
        <ErrorState
          title="Failed to load pending users"
          message={error}
          onRetry={fetchPending}
        />
      ) : pendingUsers.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <UserPlus className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">No pending approvals</h3>
            <p className="text-muted-foreground mt-1">
              All user registrations have been reviewed.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {pendingUsers.map((user) => {
            const uid = String(user.id);
            const isActing = actionLoading === uid;
            const created = parseUTCTimestamp(user.created_at);

            return (
              <Card key={uid}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                        {(user.name || user.email).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{user.name || user.email.split("@")[0]}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                        {created && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3" />
                            Requested {formatDistanceToNow(created, { addSuffix: true })}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-amber-600 border-amber-300">
                        Pending
                      </Badge>
                      <Button
                        size="sm"
                        onClick={() => handleApprove(uid, user.email)}
                        disabled={isActing}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleReject(uid, user.email)}
                        disabled={isActing}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {pendingUsers.length > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          {pendingUsers.length} user{pendingUsers.length !== 1 ? "s" : ""} pending approval
        </p>
      )}
    </div>
  );
}
