import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsIcon, Bell, Palette, ShieldCheck } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-muted-foreground">
          Manage your application preferences and account settings.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Notifications
            </CardTitle>
            <CardDescription>
              Configure your notification preferences.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="email-notifications" className="flex flex-col space-y-1">
                <span>Email Notifications</span>
                <span className="font-normal leading-snug text-muted-foreground text-xs">
                  Receive updates and alerts via email.
                </span>
              </Label>
              <Switch id="email-notifications" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="push-notifications" className="flex flex-col space-y-1">
                <span>Push Notifications</span>
                 <span className="font-normal leading-snug text-muted-foreground text-xs">
                  Get real-time alerts on your device. (Coming soon)
                </span>
              </Label>
              <Switch id="push-notifications" disabled />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              Appearance
            </CardTitle>
            <CardDescription>
              Customize the look and feel of the application.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="dark-mode" className="flex flex-col space-y-1">
                <span>Dark Mode</span>
                 <span className="font-normal leading-snug text-muted-foreground text-xs">
                  Toggle between light and dark themes.
                </span>
              </Label>
              {/* In a real app, this would use ThemeProvider from next-themes */}
              <Switch id="dark-mode" />
            </div>
             <div className="flex items-center justify-between">
              <Label htmlFor="compact-view" className="flex flex-col space-y-1">
                <span>Compact View</span>
                <span className="font-normal leading-snug text-muted-foreground text-xs">
                  Reduce padding for a more condensed UI. (Coming soon)
                </span>
              </Label>
              <Switch id="compact-view" disabled />
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-md md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Account & Security
            </CardTitle>
            <CardDescription>
              Manage your account details and security settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Account management features (e.g., change password, two-factor authentication) will be available here.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
