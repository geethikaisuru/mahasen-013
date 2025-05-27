"use client";

import { useEffect, useState } from 'react';

interface LoadingScreenProps {
  onComplete?: () => void;
  duration?: number;
}

export function LoadingScreen({ onComplete, duration = 3000 }: LoadingScreenProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      // Wait for fade out animation to complete
      setTimeout(() => {
        onComplete?.();
      }, 600);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onComplete]);

  if (!isVisible && onComplete) return null;

  return (
    <div className={`loading-screen ${!isVisible ? 'fade-out' : ''}`}>
      <div className="loading-circle">
        <div className="loading-spinner"></div>
      </div>
      <div className="loading-text">
        Mahasen AI
      </div>
      <div className="mt-2 text-sm text-muted-foreground font-light">
        v0.13
      </div>
    </div>
  );
} 