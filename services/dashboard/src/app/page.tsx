"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Image from "next/image";
import {
  Mic,
  FileText,
  Users,
  Shield,
  Globe,
  Zap,
  ArrowRight,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Mic,
    title: "Real-time Transcription",
    desc: "AI-powered transcription captures every word as it's spoken, with speaker identification.",
  },
  {
    icon: FileText,
    title: "AI Meeting Summaries",
    desc: "Automatic summaries with key takeaways, action items, and decisions after every meeting.",
  },
  {
    icon: Users,
    title: "Multi-Platform Support",
    desc: "Works with Google Meet, Zoom, and Microsoft Teams. One tool for all your meetings.",
  },
  {
    icon: Globe,
    title: "50+ Languages",
    desc: "Automatic language detection and real-time transcription in over 50 languages.",
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    desc: "Data encryption, audit logging, and role-based access control built-in from day one.",
  },
  {
    icon: Zap,
    title: "API-First Design",
    desc: "Full REST API and MCP integration. Automate workflows and build custom solutions.",
  },
];

const platforms = [
  { name: "Google Meet", icon: "/icons/icons8-google-meet-96.png" },
  { name: "Zoom", icon: "/icons/icons8-zoom-96.png" },
  { name: "Microsoft Teams", icon: "/icons/icons8-teams-96.png" },
];

export default function HomePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => {
        if (r.ok) return r.json();
        throw new Error();
      })
      .then(() => router.replace("/meetings"))
      .catch(() => {});
  }, [router]);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    await signIn("google", { callbackUrl: "/meetings" });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Logo size="sm" showText />
          <Button
            variant="outline"
            size="sm"
            onClick={handleGoogleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              "Sign in"
            )}
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="relative max-w-4xl mx-auto px-4 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border bg-muted/50 text-xs text-muted-foreground mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            AI-Powered Meeting Intelligence
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-foreground leading-[1.1]">
            Never miss a word
            <br />
            <span className="text-muted-foreground">from your meetings</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Lexor automatically joins your meetings, transcribes conversations
            in real-time, and generates AI-powered summaries so you can focus on
            the discussion — not the notes.
          </p>

          {/* CTA */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              className="h-12 px-8 text-base gap-2"
              onClick={handleGoogleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Get Started with Google
                </>
              )}
            </Button>
          </div>

          {/* Platforms */}
          <div className="mt-10 flex items-center justify-center gap-6 text-sm text-muted-foreground">
            {platforms.map((p) => (
              <div
                key={p.name}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card"
              >
                <Image
                  src={p.icon}
                  alt={p.name}
                  width={20}
                  height={20}
                  className="rounded-sm"
                />
                <span>{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20 border-t">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-12">
            How it works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Connect your calendar",
                desc: "Sign in with Google and link your calendar. Lexor sees your upcoming meetings.",
              },
              {
                step: "2",
                title: "Bot joins automatically",
                desc: "Lexor's bot joins your meeting as a visible participant and starts transcribing.",
              },
              {
                step: "3",
                title: "Get AI summaries",
                desc: "After the meeting, receive a full transcript, summary, and action items instantly.",
              },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="mx-auto w-10 h-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-lg mb-4">
                  {s.step}
                </div>
                <h3 className="font-semibold mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 border-t bg-muted/30">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-3">
            Everything you need for smarter meetings
          </h2>
          <p className="text-center text-muted-foreground mb-12">
            Built for teams that value clarity and accountability.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="p-6 rounded-xl border bg-card hover:shadow-sm transition-shadow"
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-1.5">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust signals */}
      <section className="py-16 border-t">
        <div className="max-w-4xl mx-auto px-4">
          <div className="grid sm:grid-cols-3 gap-8 text-center">
            {[
              { value: "50+", label: "Languages Supported" },
              { value: "<2s", label: "Transcription Latency" },
              { value: "99.9%", label: "Service Uptime" },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-3xl font-bold text-foreground">
                  {s.value}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-20 border-t bg-muted/30">
        <div className="max-w-md mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold mb-3">
            Start transcribing your meetings
          </h2>
          <p className="text-muted-foreground mb-8">
            Free to get started. Sign in with your Google account and connect
            your first meeting in under a minute.
          </p>
          <Button
            size="lg"
            className="h-12 px-8 text-base gap-2"
            onClick={handleGoogleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                Sign in with Google
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
          <div className="mt-6 flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              No credit card required
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              Setup in 60 seconds
            </span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Logo size="sm" showText={false} />
            <span>&copy; {new Date().getFullYear()} Lexor. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
