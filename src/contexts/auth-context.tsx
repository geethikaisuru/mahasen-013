
"use client";

import type { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import type { ReactNode} from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { auth } from "@/lib/firebase";

interface AuthContextType {
  currentUser: User | null;
  googleAccessToken: string | null;
  setGoogleAccessToken: (token: string | null) => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [googleAccessToken, setGoogleAccessTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const setGoogleAccessToken = (token: string | null) => {
    console.log("AuthContext: setGoogleAccessToken called with token:", token ? token.substring(0, 20) + "..." : token);
    setGoogleAccessTokenState(token);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("AuthContext: onAuthStateChanged triggered. User:", user?.email);
      setCurrentUser(user);
      if (!user) {
        // Clear access token if user signs out
        console.log("AuthContext: User signed out, clearing Google access token.");
        setGoogleAccessTokenState(null);
      }
      setLoading(false);
      console.log("AuthContext: auth loading state set to false.");
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, loading, googleAccessToken, setGoogleAccessToken }}>
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
