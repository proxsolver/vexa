"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Clock, XCircle, LogOut } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { useAuthStore } from "@/stores/auth-store";

export default function PendingApprovalPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [status, setStatus] = useState<"pending" | "rejected" | "checking">("checking");

  useEffect(() => {
    if (user?.status === "rejected") {
      setStatus("rejected");
    } else if (user?.status === "pending") {
      setStatus("pending");
    } else if (user?.status === "approved") {
      router.push("/");
    } else {
      setStatus("pending");
    }
  }, [user, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center justify-center gap-2 mb-8">
          <Logo size="lg" showText={true} />
          <p className="text-sm text-muted-foreground">Meeting Transcription</p>
        </div>

        <Card className="border-0 shadow-xl">
          {status === "checking" && (
            <>
              <CardHeader className="text-center">
                <CardTitle className="text-xl">Checking approval status...</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </CardContent>
            </>
          )}

          {status === "pending" && (
            <>
              <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                  <div className="h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <Clock className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                  </div>
                </div>
                <CardTitle className="text-xl text-amber-600 dark:text-amber-400">
                  Awaiting Approval
                </CardTitle>
                <CardDescription className="mt-2">
                  Your account is waiting for admin approval.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                <p className="text-sm text-muted-foreground text-center">
                  Signed in as <span className="font-medium text-foreground">{user?.email}</span>
                </p>
                <p className="text-xs text-muted-foreground text-center">
                  You will be notified once your account is approved.
                  Refresh this page to check again.
                </p>
                <div className="flex gap-2 w-full pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => window.location.reload()}
                  >
                    Refresh
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => logout()}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {status === "rejected" && (
            <>
              <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                  <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                  </div>
                </div>
                <CardTitle className="text-xl text-red-600 dark:text-red-400">
                  Access Denied
                </CardTitle>
                <CardDescription className="mt-2">
                  Your account registration was not approved.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                <p className="text-sm text-muted-foreground text-center">
                  Signed in as <span className="font-medium text-foreground">{user?.email}</span>
                </p>
                <p className="text-xs text-muted-foreground text-center">
                  If you believe this is an error, please contact the administrator.
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => logout()}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </Button>
              </CardContent>
            </>
          )}
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Lexor Dashboard - AI Meeting Intelligence
        </p>
      </div>
    </div>
  );
}
