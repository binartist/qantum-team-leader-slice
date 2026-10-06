import { MenuBar } from "@/ui/AppBar";

export const metadata = { title: "About this demo" };

/** Explains the demo once: sample data, no login, shared decisions, nothing sent. */
export default function LandingPage() {
  return (
    <>
      <MenuBar current="about" />
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
            <li>Open Harbour Point. Shortages block the crew.</li>
            <li>In L3, Riser 2, open the sealant line and escalate it. The crew stays blocked until stock arrives.</li>
            <li>Open L3, Riser 2 and propose 0451.</li>
            <li>Open Kingsway Works and filter to data problems.</li>
            <li>Open the Actions log in the header, then Materials from the menu on the sites list.</li>
          </ol>
        </section>
      </main>
    </>
  );
}
