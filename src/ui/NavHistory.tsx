"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { noteNavigation } from "./nav-history";

// Set in the popstate listener, which runs before the pathname effect. Cleared after paint so a pop that
// does not change the path and query cannot make the next forward visit look like a pop.
let popRecorded = false;

/** Records push and pop for the back control. Renders nothing. Mount once, under a Suspense boundary. */
export function NavHistory() {
  const pathname = usePathname();
  const search = useSearchParams().toString();

  useEffect(() => {
    const onPop = () => {
      popRecorded = true;
      noteNavigation(window.location.pathname + window.location.search, true);
      requestAnimationFrame(() => {
        popRecorded = false;
      });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (popRecorded) return;
    noteNavigation(window.location.pathname + window.location.search, false);
  }, [pathname, search]);

  return null;
}
