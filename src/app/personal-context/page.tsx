"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { UserCog, Save } from "lucide-react";
import { useToast } from '@/hooks/use-toast';

export default function PersonalContextPage() {
  const [context, setContext] = useState(
    "I am a senior software engineer specializing in full-stack development with a focus on AI-driven applications. I prefer clear, concise communication and appreciate when technical details are explained simply. My current projects involve Next.js, Python, and various cloud platforms. I am generally available during standard business hours in the Pacific Time Zone."
  );
  const { toast } = useToast();

  const handleSaveContext = () => {
    // In a real app, this would save to a backend/localStorage
    console.log("Saving context:", context);
    toast({
      title: "Context Saved",
      description: "Your personal context has been updated.",
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Personal Context</h1>
        <p className="text-muted-foreground">
          Provide information about yourself to help the AI generate more relevant and personalized responses.
        </p>
      </div>
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="h-6 w-6 text-primary" />
            Your Context
          </CardTitle>
          <CardDescription>
            This information will be used by the AI to tailor email drafts. It is kept private and secure.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid w-full gap-1.5">
            <Label htmlFor="personal-context-area">Enter your context below:</Label>
            <Textarea
              id="personal-context-area"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="e.g., Your role, communication style, current projects, availability, etc."
              className="min-h-[250px] text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              The more detail you provide, the better the AI can assist you.
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSaveContext}>
            <Save className="mr-2 h-4 w-4" />
            Save Context
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
