"use client";

import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { Toaster } from "@/components/ui/toaster";
import { APP_NAME } from '@/lib/constants';
import { AuthProvider } from '@/contexts/auth-context';
import { LoadingScreen } from '@/components/loading-screen';
import { useState, useEffect } from 'react';

interface ClientLayoutProps {
  children: React.ReactNode;
}

export function ClientLayout({ children }: ClientLayoutProps) {
  const [showLoading, setShowLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Set dark mode by default
    document.documentElement.classList.add('dark');
  }, []);

  const handleLoadingComplete = () => {
    setShowLoading(false);
  };

  if (!mounted) {
    return null;
  }

  return (
    <>
      {showLoading && <LoadingScreen onComplete={handleLoadingComplete} />}
      
      <AuthProvider>
        <SidebarProvider defaultOpen={true}>
          <div className="flex min-h-screen w-full relative">
            <AppSidebar />
            <SidebarInset className="flex flex-col flex-1 smooth-transition">
              <header className="sticky top-0 z-10 flex h-[57px] items-center gap-1 glow-border bg-card/80 backdrop-blur-xl px-4 md:hidden">
                <SidebarTrigger className="glow-icon" />
                <h1 className="text-xl font-light editorial-text">{APP_NAME.split(':')[0]}</h1>
              </header>
              <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8 relative">
                {children}
              </main>
            </SidebarInset>
          </div>
        </SidebarProvider>
      </AuthProvider>
      <Toaster />
    </>
  );
} 