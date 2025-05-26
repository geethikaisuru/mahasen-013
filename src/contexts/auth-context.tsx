
"use client";

import type { User } from "firebase/auth";
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut } from "firebase/auth";
import type { ReactNode} from "react";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { auth } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast"; // Added for notifications

interface AuthContextType {
  currentUser: User | null;
  googleAccessToken: string | null;
  setGoogleAccessToken: (token: string | null) => void;
  loading: boolean;
  handleSignIn: () => Promise<void>;
  handleSignOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [googleAccessToken, setGoogleAccessTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast(); // Added

  const setGoogleAccessToken = useCallback((token: string | null) => {
    console.log("AuthContext: setGoogleAccessToken called with token:", token ? token.substring(0, 20) + "..." : token);
    setGoogleAccessTokenState(token);
  }, []);

  const handleSignIn = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://mail.google.com/');
    provider.addScope('https://www.googleapis.com/auth/drive');
    provider.addScope('https://www.googleapis.com/auth/calendar');
    
    try {
      console.log("AuthContext: Initiating sign-in with popup...");
      const result = await signInWithPopup(auth, provider);
      console.log("AuthContext: signInWithPopup result (user object):", result.user);
      // console.log("AuthContext: result.user.providerData[0]:", result.user.providerData[0]); // Can be useful for debugging specific provider info

      const credential = GoogleAuthProvider.credentialFromResult(result);
      console.log("AuthContext: Credential from result:", credential);
      const token = credential?.accessToken;
      console.log("AuthContext: Extracted access token:", token ? token.substring(0, 20) + "..." : token);
      
      if (token) {
        setGoogleAccessToken(token);
      } else {
        setGoogleAccessToken(null);
        console.error("AuthContext: Google OAuth access token NOT FOUND after sign-in. Credential object:", credential);
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
      console.error("AuthContext: Error signing in with Google: ", error);
      setGoogleAccessToken(null);
      toast({
        title: "Sign In Failed",
        description: (error as Error).message || "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  }, [setGoogleAccessToken, toast]);

  const handleSignOut = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
      setGoogleAccessToken(null); 
      // currentUser will be set to null by onAuthStateChanged
      toast({
        title: "Signed Out",
        description: "Successfully signed out.",
        variant: "default",
      });
    } catch (error) {
      console.error("AuthContext: Error signing out: ", error);
      toast({
        title: "Sign Out Failed",
        description: (error as Error).message || "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  }, [setGoogleAccessToken, toast]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("AuthContext: onAuthStateChanged triggered. User:", user?.email);
      setCurrentUser(user);
      if (!user) {
        console.log("AuthContext: User signed out or no user, clearing Google access token.");
        setGoogleAccessTokenState(null); // Explicitly clear token if no Firebase user
      }
      // IMPORTANT: Do not try to re-fetch Google Access Token here directly from onAuthStateChanged
      // It must be obtained via an explicit OAuth flow like signInWithPopup.
      // If a user session is restored but token is needed, user must re-trigger the flow (e.g. via a button).
      setLoading(false);
      console.log("AuthContext: auth loading state set to false.");
    });

    return () => unsubscribe();
  }, []); // Removed setGoogleAccessToken from dependency array as it's stable via useCallback

  return (
    <AuthContext.Provider value={{ currentUser, loading, googleAccessToken, setGoogleAccessToken, handleSignIn, handleSignOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
