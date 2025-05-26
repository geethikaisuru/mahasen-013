
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
    <Card className="shadow-md overflow-hidden w-full"> {/* Ensure card itself is full width and hides overflow */}
      <CardHeader>
        <div className="flex items-start gap-4 min-w-0"> {/* Added min-w-0 for flex child to allow shrinking */}
          <Avatar className="h-10 w-10 shrink-0"> {/* Added shrink-0 to prevent avatar from pushing width */}
            <AvatarImage src={`https://placehold.co/40x40.png?text=${sender.charAt(0)}`} data-ai-hint="profile avatar" />
            <AvatarFallback>{sender.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1"> {/* Added min-w-0 and flex-1 so this part can shrink and wrap */}
            <CardTitle className="text-xl break-words">{subject}</CardTitle>
            <CardDescription className="break-words"> {/* Ensure description also breaks words */}
              From: {sender} &lt;{senderEmail}&gt; - Received: {receivedTime}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="prose prose-sm max-w-none text-foreground dark:prose-invert whitespace-pre-wrap overflow-x-auto w-full">
          {body}
        </div>
      </CardContent>
    </Card>
  );
}

    