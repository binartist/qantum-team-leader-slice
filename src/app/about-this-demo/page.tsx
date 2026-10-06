import Link from "next/link";
import { MenuBar } from "@/ui/AppBar";
import { ACTIONS_PATH, MATERIALS_PATH, penetrationPath, sitePath } from "@/ui/format";

export const metadata = { title: "About this demo" };

/** Explains the demo once: sample data, no login, shared decisions, nothing sent; then how to get around. */
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
            <li>
              <p>
                Source code, specs and how it was built with AI agents: the{" "}
                <a href="https://github.com/binartist/qantum-team-leader-slice">GitHub repository</a>.
              </p>
            </li>
          </ul>
        </section>
        <section aria-labelledby="way-heading">
          <h2 id="way-heading">Finding your way</h2>
          <ul>
            <li>
              <p>
                The menu (beside the page on a wide screen, top left on a phone) opens <Link href="/sites">Sites</Link>, <Link href={MATERIALS_PATH}>Materials</Link>, the{" "}
                <Link href={ACTIONS_PATH}>Actions log</Link> and this page.
              </p>
            </li>
            <li>Every other page starts with a back control. It names where it goes: the page you came from, or else the page above.</li>
            <li>
              On a site, chips filter the list and icons on each row mark its problems and decisions. A penetration&apos;s own decisions are on its Actions log tab.
            </li>
          </ul>
        </section>
        <section aria-labelledby="try-heading">
          <h2 id="try-heading">Try it in two minutes</h2>
          <ol>
            <li>
              <p>
                Open <Link href={sitePath("site-b")}>Harbour Point</Link>. Each penetration is a row, and its chips say what
                blocks the crew.
              </p>
            </li>
            <li>
              <p>
                Open <Link href={penetrationPath("site-b", "pen-b-01")}>L3, Riser 2</Link> and tap its sealant line. The
                sealant page opens at Harbour Point. Escalate it, then go back: the crew stays blocked until stock arrives.
              </p>
            </li>
            <li>On the same penetration, select candidate 0451 and propose it.</li>
            <li>Open that penetration&apos;s Actions log tab to see the escalation and the proposal.</li>
            <li>
              <p>
                Open <Link href={`${sitePath("site-c")}?show=data-problems`}>Kingsway Works</Link>, filtered to data problems.
              </p>
            </li>
            <li>
              <p>
                <Link href={MATERIALS_PATH}>Materials</Link> shows each material&apos;s shared stock against every site&apos;s
                need. The <Link href={ACTIONS_PATH}>Actions log</Link> lists your decisions by site.
              </p>
            </li>
          </ol>
        </section>
      </main>
    </>
  );
}
