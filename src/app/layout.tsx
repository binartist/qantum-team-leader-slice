import { Suspense, type ReactNode } from "react";
import { Announcer } from "@/ui/Announcer";
import { NavHistory } from "@/ui/NavHistory";
import { SideMenu } from "@/ui/SideMenu";
import { HEAD_SCRIPT } from "@/ui/sidebar";
import styles from "@/ui/primitives.module.css";
import "./globals.css";

export const metadata = {
  title: { default: "Team leader", template: "%s · Team leader" },
  description: "Site readiness and shortage decisions",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // The head script stamps a remembered theme and sidebar on <html> before React hydrates, hence the warning
    // opt-out. It is a plain inline script on purpose: next/script's beforeInteractive queues inline code until
    // Next's runtime loads, which would flash light first. React's dev build logs "Encountered a script tag";
    // production does not.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: HEAD_SCRIPT }} />
      </head>
      <body>
        <Announcer />
        <Suspense fallback={null}>
          <NavHistory />
        </Suspense>
        <div className={styles.appShell}>
          <SideMenu />
          <div className={styles.appContent}>{children}</div>
        </div>
      </body>
    </html>
  );
}
