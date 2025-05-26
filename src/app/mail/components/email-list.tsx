
"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import type { Email } from "@/types/mail";
import { EmailListItem } from "./email-list-item";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Inbox } from 'lucide-react';

interface EmailListProps {
  emails: Email[];
  onSelectEmail: (email: Email) => void;
  selectedEmailId?: string | null;
  isLoading: boolean;
  title: string;
}

export function EmailList({ emails, onSelectEmail, selectedEmailId, isLoading, title }: EmailListProps) {
  return (
    <Card className="shadow-md h-full flex flex-col">
      <CardHeader className="py-4 px-4">
        <CardTitle className="text-lg flex items-center">
          <Inbox className="mr-2 h-5 w-5 text-primary" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 flex-grow overflow-hidden">
        <ScrollArea className="h-full p-2">
          {isLoading && (
            <div className="space-y-2 p-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex flex-col gap-2 rounded-lg border p-3 animate-pulse bg-muted/50">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-24 bg-muted rounded"></div>
                    <div className="ml-auto h-3 w-12 bg-muted rounded"></div>
                  </div>
                  <div className="h-4 w-3/4 bg-muted rounded"></div>
                  <div className="h-3 w-full bg-muted rounded mt-1"></div>
                  <div className="h-3 w-5/6 bg-muted rounded"></div>
                </div>
              ))}
            </div>
          )}
          {!isLoading && emails.length === 0 && (
            <div className="text-center text-muted-foreground p-4">No emails found.</div>
          )}
          {!isLoading && emails.length > 0 && (
            <div className="flex flex-col gap-2">
              {emails.map((email) => (
                <EmailListItem
                  key={email.id}
                  email={email}
                  onSelect={() => onSelectEmail(email)}
                  isSelected={selectedEmailId === email.id}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
