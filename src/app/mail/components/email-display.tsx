
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface EmailDisplayProps {
  sender: string;
  senderEmail: string;
  subject: string;
  body: string;
  receivedTime: string;
}

export function EmailDisplay({ sender, senderEmail, subject, body, receivedTime }: EmailDisplayProps) {
  return (
    <Card className="shadow-md">
      <CardHeader>
        <div className="flex items-center gap-4">
          <Avatar className="h-10 w-10">
            <AvatarImage src={`https://placehold.co/40x40.png?text=${sender.charAt(0)}`} data-ai-hint="profile avatar" />
            <AvatarFallback>{sender.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <CardTitle className="text-xl">{subject}</CardTitle>
            <CardDescription>
              From: {sender} &lt;{senderEmail}&gt; - Received: {receivedTime}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="prose prose-sm max-w-none text-foreground dark:prose-invert whitespace-pre-wrap overflow-x-auto">
          {body}
        </div>
      </CardContent>
    </Card>
  );
}
