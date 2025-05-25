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
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { UserNav } from '@/components/user-nav';
import { Logo } from '@/components/logo';
import { Separator } from '@/components/ui/separator';
import { Button } from './ui/button';
import { PanelLeftClose, PanelRightClose } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar'; // Ensure this hook is correctly imported

export function AppSidebar() {
  const pathname = usePathname();
  const { open, toggleSidebar, isMobile } = useSidebar();

  return (
    <Sidebar side="left" variant="sidebar" collapsible="icon" className="border-r">
      <SidebarHeader className="p-4 flex items-center justify-between">
        <Logo iconOnly={!open && !isMobile} />
         <Button variant="ghost" size="icon" onClick={toggleSidebar} className="md:hidden">
            {open ? <PanelLeftClose /> : <PanelRightClose />}
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
      <SidebarFooter className={cn("p-4 flex items-center", open || isMobile ? "justify-between" : "justify-center")}>
        <div className={cn(open || isMobile ? "block" : "hidden group-data-[collapsible=icon]:hidden")}>
           <UserNav />
        </div>
         <div className={cn(open || isMobile ? "hidden" : "block")}>
          {/* Icon-only version of UserNav or a simple avatar when collapsed */}
           <UserNav /> 
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
