"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Send, RefreshCw } from "lucide-react";

interface MainReplyComposerProps {
  replyContent: string;
  onReplyContentChange: (content: string) => void;
  onSend: () => void;
  onRegenerate: () => void;
  isSending: boolean;
  isRegenerating: boolean;
}

export function MainReplyComposer({
  replyContent,
  onReplyContentChange,
  onSend,
  onRegenerate,
  isSending,
  isRegenerating,
}: MainReplyComposerProps) {
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle>Compose Reply</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="mainReplyTextarea" className="text-base font-semibold">Your Reply</Label>
          <Textarea
            id="mainReplyTextarea"
            value={replyContent}
            onChange={(e) => onReplyContentChange(e.target.value)}
            placeholder="Your email reply will appear here. Edit as needed."
            className="w-full mt-1 min-h-[200px]"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-2 justify-end">
          <Button onClick={onRegenerate} disabled={isRegenerating || isSending} variant="outline">
            {isRegenerating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Regenerate Drafts
          </Button>
          <Button onClick={onSend} disabled={isSending || isRegenerating || !replyContent.trim()} className="bg-muted-green hover:bg-muted-green/90 text-white">
            {isSending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Send Reply
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
