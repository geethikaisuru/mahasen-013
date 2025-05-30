import type { LucideIcon } from 'lucide-react';
import { LayoutDashboard, Mail, Blocks, UserCog, SettingsIcon, MessageCircle, Mic } from 'lucide-react';

export const APP_NAME = "Mahasen AI: V013";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  match?: (pathname: string) => boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, match: (pathname) => pathname === "/" },
  { href: "/mail", label: "Mail", icon: Mail },
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/live-voice-chat", label: "Live Voice Chat", icon: Mic },
  { href: "/integrations", label: "Integrations", icon: Blocks },
  { href: "/personal-context", label: "Personal Context", icon: UserCog },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];
