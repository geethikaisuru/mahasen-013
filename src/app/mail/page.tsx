import { EmailDisplay } from "./components/email-display";
import { DraftsSection } from "./components/drafts-section";
import { ChatView } from "./components/chat-view";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

// Mock Data for the initial email
const mockEmail = {
  sender: "Jane Doe",
  senderEmail: "jane.doe@example.com",
  subject: "Project Update & Next Steps",
  body: `Hi Team,\n\nJust wanted to provide a quick update on the Alpha project. We've successfully completed phase 1 milestones. Great work everyone!\n\nFor phase 2, we need to focus on user testing and feedback incorporation. Please come prepared to discuss your findings in our meeting next Monday.\n\nBest regards,\nJane`,
  receivedTime: "10:32 AM",
};


export default function MailPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Mail Assistant</h1>
        <p className="text-muted-foreground">
          Craft thoughtful email replies with the help of AI.
        </p>
      </div>
      <Separator />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <EmailDisplay {...mockEmail} />
          <DraftsSection initialEmailContent={mockEmail.body} />
        </div>
        <div className="lg:col-span-1">
          <ChatView />
        </div>
      </div>

      {/* Alternative layout using Tabs for smaller screens or focused views */}
      {/* <Tabs defaultValue="email" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="email">Email & Drafts</TabsTrigger>
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="context">Context</TabsTrigger>
        </TabsList>
        <TabsContent value="email" className="mt-6 space-y-6">
          <EmailDisplay {...mockEmail} />
          <DraftsSection initialEmailContent={mockEmail.body} />
        </TabsContent>
        <TabsContent value="chat" className="mt-6">
          <ChatView />
        </TabsContent>
        <TabsContent value="context" className="mt-6">
          <Card>
            <CardHeader><CardTitle>Personal Context</CardTitle></CardHeader>
            <CardContent>
              <Textarea defaultValue="I am a busy professional..." className="min-h-[200px]" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs> */}
    </div>
  );
}
