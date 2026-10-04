import { LinkButton } from "@/ui/LinkButton";
import { BUTTONS } from "@/ui/messages";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main>
      <h1>Page not found</h1>
      <p>That page does not exist.</p>
      <LinkButton href="/">{BUTTONS.backToSites}</LinkButton>
    </main>
  );
}
