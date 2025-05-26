
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { EmailBoxType } from "@/types/mail";
import { Inbox, MailOpen, Send, FileText, Landmark } from "lucide-react"; // Using Landmark for "All Mail" as an example

interface MailSidebarProps {
  onSelectBox: (boxType: EmailBoxType | "all") => void;
  activeBox: EmailBoxType | "all";
}

const mailBoxItems: { name: EmailBoxType | "all"; label: string; icon: React.ElementType }[] = [
  { name: "inbox", label: "Inbox", icon: Inbox },
  { name: "unread", label: "Unread", icon: MailOpen },
  { name: "sent", label: "Sent", icon: Send },
  { name: "drafts", label: "Drafts", icon: FileText },
];

export function MailSidebar({ onSelectBox, activeBox }: MailSidebarProps) {
  return (
    <Card className="shadow-md h-full">
      <CardContent className="p-2">
        <nav className="flex flex-col gap-1">
          {mailBoxItems.map((item) => (
            <Button
              key={item.name}
              variant={activeBox === item.name ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start",
                activeBox === item.name && "font-semibold"
              )}
              onClick={() => onSelectBox(item.name)}
            >
              <item.icon className="mr-2 h-4 w-4" />
              {item.label}
            </Button>
          ))}
        </nav>
      </CardContent>
    </Card>
  );
}
