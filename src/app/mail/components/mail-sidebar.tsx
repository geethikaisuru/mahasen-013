"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { EmailBoxType } from "@/types/mail";
import { Inbox, MailOpen, Send, FileText } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MailSidebarProps {
  onSelectBox: (boxType: EmailBoxType | "all") => void;
  activeBox: EmailBoxType | "all";
  isExpanded?: boolean;
}

const mailBoxItems: { name: EmailBoxType | "all"; label: string; icon: React.ElementType }[] = [
  { name: "inbox", label: "Inbox", icon: Inbox },
  { name: "unread", label: "Unread", icon: MailOpen },
  { name: "sent", label: "Sent", icon: Send },
  { name: "drafts", label: "Drafts", icon: FileText },
];

export function MailSidebar({ onSelectBox, activeBox, isExpanded = true }: MailSidebarProps) {
  return (
    <TooltipProvider delayDuration={0}>
      <Card className="glow-border bg-card/80 backdrop-blur-sm h-full smooth-transition">
        <CardContent className="p-2">
          <nav className="flex flex-col gap-1">
            {mailBoxItems.map((item) => {
              const isActive = activeBox === item.name;
              const IconComponent = item.icon;
              
              const button = (
                <Button
                  key={item.name}
                  variant="ghost"
                  size={isExpanded ? "default" : "icon"}
                  className={cn(
                    "smooth-transition group relative",
                    isExpanded ? "w-full justify-start" : "w-full justify-center",
                    "hover:bg-sidebar-accent/50 hover:scale-[1.02]",
                    isActive && [
                      "bg-gradient-to-r from-primary/20 to-secondary/10",
                      "glow-border border-primary/30"
                    ]
                  )}
                  onClick={() => onSelectBox(item.name)}
                >
                  <IconComponent 
                    className={cn(
                      "h-4 w-4 smooth-transition",
                      isActive ? "text-primary glow-icon" : "text-foreground/70 group-hover:text-primary group-hover:glow-icon",
                      isExpanded ? "mr-2" : ""
                    )} 
                  />
                  {isExpanded && (
                    <span className={cn(
                      "editorial-text font-light smooth-transition",
                      isActive ? "text-primary font-medium" : "text-foreground group-hover:text-primary"
                    )}>
                      {item.label}
                    </span>
                  )}
                  
                  {/* Active indicator glow */}
                  {isActive && (
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-secondary/5 rounded-md -z-10" />
                  )}
                </Button>
              );

              // Only show tooltip when collapsed
              if (!isExpanded) {
                return (
                  <Tooltip key={item.name}>
                    <TooltipTrigger asChild>
                      {button}
                    </TooltipTrigger>
                    <TooltipContent side="right" align="center">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return button;
            })}
          </nav>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
