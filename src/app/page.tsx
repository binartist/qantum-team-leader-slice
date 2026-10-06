import { LinkButton } from "@/ui/LinkButton";
import styles from "@/ui/primitives.module.css";

export const metadata = { title: "About this demo" };

/** Explains the demo once: sample data, no login, shared decisions, nothing sent. */
export default function LandingPage() {
  return (
    <>
      <main>
        <h1>Ready to send the crew?</h1>
        <p>
          Check a site&apos;s materials before the crew goes. If something is short, decide what to do: wait, escalate, or
          suggest a substitute.
        </p>
        <section aria-labelledby="demo-heading">
          <h2 id="demo-heading">About this demo</h2>
          <ul>
            <li>Sample sites and stock. The fire-stopping catalogue is real.</li>
            <li>No login. Everyone with the link shares the same decisions.</li>
            <li>Nothing is sent or ordered. A substitute is a suggestion for a manager to check.</li>
          </ul>
        </section>
        <section aria-labelledby="try-heading">
          <h2 id="try-heading">Try it in two minutes</h2>
          <ol>
            <li>Open Harbour Point. Two shortages block the crew.</li>
            <li>Escalate the sealant. The crew stays blocked until stock arrives.</li>
            <li>Under the sealant, open L3, Riser 2 and propose 0451.</li>
            <li>Open Kingsway Works. Data problems block it too.</li>
            <li>See what you recorded in the Actions log.</li>
          </ol>
        </section>
      </main>
      {/* Last on the page and sticky, so it stays in view while reading and never covers the text at the end. */}
      <div className={styles.stickyAction}>
        <LinkButton href="/sites" primary>
          Open sites
        </LinkButton>
      </div>
    </>
  );
}
