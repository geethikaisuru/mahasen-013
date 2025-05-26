
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User, Settings, LogIn } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { auth } from "@/lib/firebase";
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";

export function UserNav() {
  const { currentUser, loading, setGoogleAccessToken } = useAuth();
  const { toast } = useToast();

  const handleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    // Add scopes for Gmail, Google Drive, and Google Calendar
    provider.addScope('https://mail.google.com/'); // Full access to Gmail
    provider.addScope('https://www.googleapis.com/auth/drive'); // Full access to Google Drive
    provider.addScope('https://www.googleapis.com/auth/calendar'); // Full access to Google Calendar
    
    try {
      console.log("UserNav: Initiating sign-in with popup...");
      const result = await signInWithPopup(auth, provider);
      console.log("UserNav: signInWithPopup result:", result);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      console.log("UserNav: Credential from result:", credential);
      const token = credential?.accessToken;
      console.log("UserNav: Extracted access token:", token ? token.substring(0, 20) + "..." : token); // Log only a snippet for security
      
      if (token) {
        setGoogleAccessToken(token);
      } else {
        setGoogleAccessToken(null);
        console.error("UserNav: Google OAuth access token NOT FOUND after sign-in. Credential object:", credential);
        toast({
          title: "Sign In Warning",
          description: "Could not retrieve Google access token. Some features might not work.",
          variant: "destructive",
        });
      }
      toast({
        title: "Signed In",
        description: `Successfully signed in as ${result.user.email}. Requested permissions for Gmail, Drive, and Calendar.`,
        variant: "default",
      });
    } catch (error) {
      console.error("UserNav: Error signing in with Google: ", error);
      setGoogleAccessToken(null);
      toast({
        title: "Sign In Failed",
        description: (error as Error).message || "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setGoogleAccessToken(null); // Clear the access token
      toast({
        title: "Signed Out",
        description: "Successfully signed out.",
        variant: "default",
      });
    } catch (error) {
      console.error("Error signing out: ", error);
      toast({
        title: "Sign Out Failed",
        description: (error as Error).message || "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Button variant="ghost" className="relative h-9 w-9 rounded-full" disabled>
        <Avatar className="h-9 w-9">
          <AvatarFallback>...</AvatarFallback>
        </Avatar>
      </Button>
    );
  }

  if (!currentUser) {
    return (
      <Button variant="outline" size="sm" onClick={handleSignIn}>
        <LogIn className="mr-2 h-4 w-4" />
        Sign In
      </Button>
    );
  }

  const userInitials = 
    currentUser.displayName
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() ||
    currentUser.email?.charAt(0).toUpperCase() || 
    "U";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 w-9 rounded-full">
          <Avatar className="h-9 w-9">
            {currentUser.photoURL ? (
              <AvatarImage src={currentUser.photoURL} alt={currentUser.displayName || "User Avatar"} data-ai-hint="profile avatar" />
            ) : (
              <AvatarImage src={`https://placehold.co/40x40.png?text=${userInitials}`} alt={currentUser.displayName || "User Avatar"} data-ai-hint="profile initials avatar" />
            )}
            <AvatarFallback>{userInitials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {currentUser.displayName || "User"}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {currentUser.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/settings"> {/* Changed from /profile to /settings based on nav items */}
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span> {/* Kept label as Profile for user clarity, links to settings */}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
