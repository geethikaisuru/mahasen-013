"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { UserNav } from '@/components/user-nav';
import { Logo } from '@/components/logo';
import { Separator } from '@/components/ui/separator';
import { Button } from './ui/button';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar'; 

export function AppSidebar() {
  const pathname = usePathname();
  const { open, toggleSidebar, isMobile, state } = useSidebar();

  return (
    <Sidebar 
      side="left" 
      variant="sidebar" 
      collapsible="icon" 
      className="glow-border bg-sidebar/80 backdrop-blur-xl smooth-transition border-sidebar-border/30"
    >
      <SidebarHeader className="p-4 flex items-center justify-between">
        <Logo iconOnly={!open && !isMobile} />
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={toggleSidebar} 
          className="hidden md:flex glow-icon hover:scale-110 smooth-transition"
        >
          {open || state === 'expanded' ? 
            <ChevronsLeft className="h-4 w-4" /> : 
            <ChevronsRight className="h-4 w-4" />
          }
        </Button>
      </SidebarHeader>
      
      <Separator className="bg-sidebar-border/30" />
      
      <SidebarContent className="p-2">
        <SidebarMenu className="space-y-2">
          {NAV_ITEMS.map((item) => (
            <SidebarMenuItem key={item.href}>
              <Link href={item.href} legacyBehavior passHref>
                <SidebarMenuButton
                  isActive={item.match ? item.match(pathname) : pathname.startsWith(item.href)}
                  tooltip={{ children: item.label, side: 'right', align: 'center' }}
                  className={cn(
                    "justify-start smooth-transition group relative",
                    "hover:bg-sidebar-accent/50 hover:scale-[1.02]",
                    "data-[active=true]:bg-gradient-to-r data-[active=true]:from-primary/20 data-[active=true]:to-secondary/10",
                    "data-[active=true]:glow-border data-[active=true]:border-primary/30"
                  )}
                >
                  <item.icon className={cn(
                    "h-5 w-5 smooth-transition",
                    item.match ? item.match(pathname) : pathname.startsWith(item.href) 
                      ? "text-primary glow-icon" 
                      : "text-sidebar-foreground/70 group-hover:text-primary group-hover:glow-icon"
                  )} />
                  <span className={cn(
                    "ml-3 editorial-text font-light",
                    open || isMobile ? "inline" : "hidden group-data-[collapsible=icon]:hidden",
                    item.match ? item.match(pathname) : pathname.startsWith(item.href) 
                      ? "text-primary font-medium" 
                      : "text-sidebar-foreground group-hover:text-primary"
                  )}>
                    {item.label}
                  </span>
                  
                  {/* Active indicator glow */}
                  {(item.match ? item.match(pathname) : pathname.startsWith(item.href)) && (
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-secondary/5 rounded-md -z-10" />
                  )}
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      
      <Separator className="bg-sidebar-border/30" />
      
      <SidebarFooter className={cn(
        "p-4 flex items-center smooth-transition", 
        (open || isMobile) ? "justify-between" : "justify-center group-data-[collapsible=icon]:justify-center"
      )}>
        <div className={cn(
          "smooth-transition",
          (open || isMobile) ? "block" : "hidden group-data-[collapsible=icon]:hidden"
        )}>
          <UserNav />
        </div>
        
        {/* For collapsed icon-only sidebar */}
        <div className={cn(
          "group-data-[collapsible=icon]:block smooth-transition", 
          (open || isMobile) ? "hidden" : "block"
        )}>
          <UserNav /> 
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

