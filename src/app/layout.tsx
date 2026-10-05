import type { ReactNode } from "react";
import { Announcer } from "@/ui/Announcer";
import "./globals.css";

export const metadata = {
  title: { default: "Team leader", template: "%s · Team leader" },
  description: "Site readiness and shortage decisions",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Announcer />
        {children}
      </body>
    </html>
  );
}
