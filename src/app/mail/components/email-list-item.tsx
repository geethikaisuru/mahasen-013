
"use client";

import { cn } from "@/lib/utils";
import type { Email } from "@/types/mail";

interface EmailListItemProps {
  email: Email;
  onSelect: () => void;
  isSelected: boolean;
}

export function EmailListItem({ email, onSelect, isSelected }: EmailListItemProps) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex flex-col items-start gap-2 rounded-lg border p-3 text-left text-sm transition-all hover:bg-accent w-full",
        isSelected && "bg-muted"
      )}
    >
      <div className="flex w-full flex-col gap-1">
        <div className="flex items-center">
          <div className="flex items-center gap-2">
            <div className={cn("font-semibold", !email.read && "text-primary")}>{email.sender}</div>
            {!email.read && (
              <span className="flex h-2 w-2 rounded-full bg-primary" />
            )}
          </div>
          <div className={cn("ml-auto text-xs", isSelected ? "text-foreground" : "text-muted-foreground")}>
            {email.receivedTime}
          </div>
        </div>
        <div className={cn("text-xs font-medium", !email.read && "text-foreground")}>{email.subject}</div>
      </div>
      <div className="line-clamp-2 text-xs text-muted-foreground">
        {email.snippet}
      </div>
    </button>
  );
}
