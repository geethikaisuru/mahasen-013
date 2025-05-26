
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
  // SidebarTrigger, // This trigger is typically for mobile sheet, explicit desktop toggle added
} from '@/components/ui/sidebar';
import { UserNav } from '@/components/user-nav';
import { Logo } from '@/components/logo';
import { Separator } from '@/components/ui/separator';
import { Button } from './ui/button';
import { PanelLeftClose, PanelRightClose, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar'; 

export function AppSidebar() {
  const pathname = usePathname();
  const { open, toggleSidebar, isMobile, state } = useSidebar();

  return (
    <Sidebar side="left" variant="sidebar" collapsible="icon" className="border-r">
      <SidebarHeader className="p-4 flex items-center justify-between">
        <Logo iconOnly={!open && !isMobile} />
         <Button variant="ghost" size="icon" onClick={toggleSidebar} className="md:hidden"> {/* Mobile toggle */}
            {open || state === 'expanded' ? <PanelLeftClose /> : <PanelRightClose />}
        </Button>
        <Button variant="ghost" size="icon" onClick={toggleSidebar} className="hidden md:flex"> {/* Desktop toggle */}
            {open || state === 'expanded' ? <ChevronsLeft className="h-5 w-5" /> : <ChevronsRight className="h-5 w-5" />}
        </Button>
      </SidebarHeader>
      <Separator />
      <SidebarContent className="p-2">
        <SidebarMenu>
          {NAV_ITEMS.map((item) => (
            <SidebarMenuItem key={item.href}>
              <Link href={item.href} legacyBehavior passHref>
                <SidebarMenuButton
                  isActive={item.match ? item.match(pathname) : pathname.startsWith(item.href)}
                  tooltip={{ children: item.label, side: 'right', align: 'center' }}
                  className="justify-start"
                >
                  <item.icon className="h-5 w-5" />
                  <span className={cn(
                      "ml-2",
                      open || isMobile ? "inline" : "hidden group-data-[collapsible=icon]:hidden"
                    )}>{item.label}</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <Separator />
      <SidebarFooter className={cn(
        "p-4 flex items-center", 
        (open || isMobile) ? "justify-between" : "justify-center group-data-[collapsible=icon]:justify-center"
        )}>
        <div className={cn((open || isMobile) ? "block" : "hidden group-data-[collapsible=icon]:hidden")}>
           <UserNav />
        </div>
         {/* For collapsed icon-only sidebar, UserNav itself handles avatar display */}
        <div className={cn("group-data-[collapsible=icon]:block", (open || isMobile) ? "hidden" : "block")}>
           <UserNav /> 
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

