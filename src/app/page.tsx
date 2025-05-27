"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_NAME } from "@/lib/constants";
import { Sparkles, Zap, Rocket, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="flex flex-col gap-12 min-h-full relative">
      {/* Ambient background glow */}
      <div className="ambient-glow fixed inset-0 pointer-events-none" />
      
      {/* Hero Section */}
      <div className="text-center md:text-left space-y-6 pt-8">
        <div className="space-y-4">
          <h1 className="editorial-text text-4xl md:text-6xl font-light tracking-tight text-foreground">
            Welcome to{" "}
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent font-medium">
              {APP_NAME.split(':')[0]}
            </span>
          </h1>
          <div className="text-lg md:text-xl text-muted-foreground font-light max-w-2xl">
            Your ethereal companion for crafting the perfect email communications.
            <br />
            <span className="text-sm opacity-75">Powered by advanced AI and personal context</span>
          </div>
        </div>
      </div>

      {/* Feature Cards */}
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 relative z-10">
        <Card className="glow-border smooth-transition hover:scale-105 float-card bg-card/80 backdrop-blur-sm">
          <CardHeader className="space-y-4">
            <div className="flex items-center justify-between">
              <CardTitle className="editorial-text text-xl font-medium">Intelligent Drafts</CardTitle>
              <Sparkles className="h-6 w-6 text-primary glow-icon" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground font-light leading-relaxed">
              Generate contextually aware email drafts that understand your communication style 
              and adapt to each unique conversation.
            </p>
          </CardContent>
        </Card>

        <Card className="glow-border smooth-transition hover:scale-105 float-card bg-card/80 backdrop-blur-sm" style={{ animationDelay: '1s' }}>
          <CardHeader className="space-y-4">
            <div className="flex items-center justify-between">
              <CardTitle className="editorial-text text-xl font-medium">Context Awareness</CardTitle>
              <Zap className="h-6 w-6 text-secondary glow-icon" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground font-light leading-relaxed">
              Leverage your personal context and communication patterns to create 
              responses that feel authentically you.
            </p>
          </CardContent>
        </Card>

        <Card className="glow-border smooth-transition hover:scale-105 float-card bg-card/80 backdrop-blur-sm md:col-span-2 lg:col-span-1" style={{ animationDelay: '2s' }}>
          <CardHeader className="space-y-4">
            <div className="flex items-center justify-between">
              <CardTitle className="editorial-text text-xl font-medium">Effortless Flow</CardTitle>
              <Rocket className="h-6 w-6 text-primary glow-icon" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground font-light leading-relaxed">
              Transform your email workflow into a seamless, intuitive experience 
              that enhances rather than interrupts your productivity.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Start Section with Enhanced Gradient Halo */}
      <div className="relative">
        {/* Enhanced Background Halo */}
        <div className="absolute -inset-12 md:-inset-16 lg:-inset-20">
          <div className="w-full h-full bg-gradient-to-br from-primary/20 via-secondary/15 to-primary/10 rounded-3xl blur-3xl opacity-60"></div>
          <div className="absolute inset-4 bg-gradient-to-tr from-secondary/15 via-primary/10 to-transparent rounded-2xl blur-2xl opacity-80"></div>
        </div>
        
        {/* Outer Glow Ring */}
        <div className="absolute -inset-8 bg-gradient-to-r from-primary/10 via-secondary/8 to-primary/10 rounded-2xl blur-xl opacity-40"></div>
        
        {/* Content Card */}
        <div className="relative">
          <Card className="glow-border bg-card/60 backdrop-blur-xl smooth-transition hover:scale-[1.02] border-primary/20 shadow-2xl shadow-primary/10">
            <CardHeader className="text-center space-y-4">
              <CardTitle className="editorial-text text-2xl font-light">
                Begin Your Journey
              </CardTitle>
              <CardDescription className="text-lg text-muted-foreground font-light">
                Navigate to Mail to start generating intelligent email responses, 
                or explore Integrations to connect your accounts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/mail">
                  <Button 
                    size="lg" 
                    className="group smooth-transition bg-primary/90 hover:bg-primary text-primary-foreground backdrop-blur-sm glow-border border-primary/30 shadow-lg shadow-primary/20"
                  >
                    Start with Mail
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <Link href="/integrations">
                  <Button 
                    variant="outline" 
                    size="lg" 
                    className="smooth-transition glow-border bg-card/50 backdrop-blur-sm hover:bg-card/80 border-primary/20 hover:border-primary/40"
                  >
                    Setup Integrations
                  </Button>
                </Link>
              </div>
              
              <div className="text-center">
                <p className="text-sm text-muted-foreground font-light">
                  Enhance your experience by updating your{" "}
                  <Link href="/personal-context" className="text-primary hover:text-primary/80 underline underline-offset-4">
                    Personal Context
                  </Link>
                  {" "}or configuring{" "}
                  <Link href="/settings" className="text-primary hover:text-primary/80 underline underline-offset-4">
                    Settings
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Subtle version indicator */}
      <div className="fixed bottom-4 right-4 text-xs text-muted-foreground/50 font-light">
        {APP_NAME}
      </div>
    </div>
  );
}
