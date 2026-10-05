import { AppBar } from "@/ui/AppBar";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <>
      <AppBar title="Page not found" backHref="/" backName="Sites" />
      <main>
        <p>That page does not exist.</p>
      </main>
    </>
  );
}
