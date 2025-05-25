import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlugZap } from "lucide-react";

export default function IntegrationsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Integrations</h1>
        <p className="text-muted-foreground">
          Connect Mahasen AI with your favorite tools and services.
        </p>
      </div>
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlugZap className="h-6 w-6 text-primary" />
            Available Integrations
          </CardTitle>
          <CardDescription>
            Manage your connections to streamline your workflow.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-border rounded-lg">
            <PlugZap className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No integrations connected yet.</p>
            <p className="text-sm text-muted-foreground/80">Check back soon for new integrations!</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
