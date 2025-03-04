
import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    // Check if we're in the browser environment
    if (typeof window === "undefined") {
      return false;
    }
    
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    // Return early if we're not in the browser
    if (typeof window === "undefined") {
      return;
    }
    
    const mediaQuery = window.matchMedia(query);
    
    // Initial check
    setMatches(mediaQuery.matches);
    
    // Add listener for changes
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };
    
    // Modern browsers
    mediaQuery.addEventListener("change", handleChange);
    
    // Cleanup
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [query]);

  return matches;
}
