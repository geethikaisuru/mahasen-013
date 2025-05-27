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
import { LogOut, User, Settings, LogIn, Link as LinkIcon } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

export function UserNav() {
  const { currentUser, loading, handleSignIn, handleSignOut, googleAccessToken } = useAuth();

  if (loading) {
    return (
      <Button variant="ghost" className="relative h-9 w-9 rounded-full smooth-transition" disabled>
        <Avatar className="h-9 w-9 glow-border">
          <AvatarFallback className="bg-card/50 text-muted-foreground">...</AvatarFallback>
        </Avatar>
      </Button>
    );
  }

  if (!currentUser) {
    return (
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleSignIn}
        className="smooth-transition glow-border bg-card/50 backdrop-blur-sm hover:bg-card/80 hover:scale-105"
      >
        <LogIn className="mr-2 h-4 w-4 glow-icon" />
        <span className="editorial-text font-light">Sign In</span>
      </Button>
    );
  }

  // If user is signed into Firebase but Google Access Token is missing,
  // show a button to re-connect/re-trigger OAuth flow.
  if (currentUser && !googleAccessToken) {
    return (
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleSignIn} 
        title="Connect to Google Services to access mail features"
        className="smooth-transition glow-border bg-card/50 backdrop-blur-sm hover:bg-card/80 hover:scale-105"
      >
        <LinkIcon className="mr-2 h-4 w-4 glow-icon" />
        <span className="editorial-text font-light">Connect</span>
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
        <Button variant="ghost" className="relative h-9 w-9 rounded-full smooth-transition hover:scale-110">
          <Avatar className="h-9 w-9 glow-border">
            {currentUser.photoURL ? (
              <AvatarImage 
                src={currentUser.photoURL} 
                alt={currentUser.displayName || "User Avatar"} 
                data-ai-hint="profile avatar" 
              />
            ) : (
              <AvatarImage 
                src={`https://placehold.co/40x40.png?text=${userInitials}`} 
                alt={currentUser.displayName || "User Avatar"} 
                data-ai-hint="profile initials avatar" 
              />
            )}
            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-secondary/20 text-primary font-medium editorial-text">
              {userInitials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        className="w-56 glow-border bg-card/90 backdrop-blur-xl" 
        align="end" 
        forceMount
      >
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="editorial-text text-sm font-medium leading-none">
              {currentUser.displayName || "User"}
            </p>
            <p className="text-xs leading-none text-muted-foreground font-light">
              {currentUser.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border/30" />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild className="smooth-transition hover:bg-sidebar-accent/50">
            <Link href="/settings" className="cursor-pointer"> 
              <User className="mr-2 h-4 w-4 glow-icon" />
              <span className="editorial-text font-light">Profile</span> 
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="smooth-transition hover:bg-sidebar-accent/50">
            <Link href="/settings" className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4 glow-icon" />
              <span className="editorial-text font-light">Settings</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="bg-border/30" />
        <DropdownMenuItem 
          onClick={handleSignOut}
          className="smooth-transition hover:bg-destructive/20 focus:bg-destructive/20"
        >
          <LogOut className="mr-2 h-4 w-4 text-destructive" />
          <span className="editorial-text font-light text-destructive">Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
