"use client";

import { useEffect, useSyncExternalStore } from "react";
import { announce, getAnnouncement, getServerAnnouncement, installReplayAnnouncer, subscribeAnnouncements } from "./decisions/api-client";
import styles from "./primitives.module.css";

export function Announcer() {
  const message = useSyncExternalStore(subscribeAnnouncements, getAnnouncement, getServerAnnouncement);

  useEffect(() => {
    document.documentElement.dataset.hydrated = "true";
    return installReplayAnnouncer();
  }, []);

  return (
    <div role="status" aria-live="polite" className={styles.srOnly} data-announcer="">
      {message}
    </div>
  );
}

export { announce };
