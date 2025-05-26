
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
import { LogOut, User, Settings, LogIn, Link as LinkIcon } from "lucide-react"; // Added LinkIcon
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
// Firebase specific imports (signInWithPopup, GoogleAuthProvider, signOut) are now handled in AuthContext

export function UserNav() {
  const { currentUser, loading, handleSignIn, handleSignOut, googleAccessToken } = useAuth();

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

  // If user is signed into Firebase but Google Access Token is missing,
  // show a button to re-connect/re-trigger OAuth flow.
  // This is helpful for page reloads.
  if (currentUser && !googleAccessToken) {
    return (
      <Button variant="outline" size="sm" onClick={handleSignIn} title="Connect to Google Services to access mail features">
        <LinkIcon className="mr-2 h-4 w-4" />
        Connect Google
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
            <Link href="/settings"> 
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span> 
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
