import type { ReactNode } from "react";

export const metadata = { title: "Team leader", description: "Site readiness and shortage decisions" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
