import Link from "next/link";
import { Icon } from "./Icon";
import { DEMO_TAG, DEMO_TAG_LABEL } from "./messages";
import styles from "./primitives.module.css";

/**
 * The sticky nav header: one compact row with the back control (a chevron and the name of the screen it
 * returns to) on the left and the Demo tag on the right. The page title is the page's own `h1` in `main`,
 * shown in full. With neither a back control nor a Demo tag there is no header at all.
 */
export function AppBar({ backHref, backName, demoTag = true }: { backHref?: string; backName?: string; demoTag?: boolean }) {
  const back = backHref && backName ? { href: backHref, name: backName } : null;
  if (!back && !demoTag) return null;
  return (
    <header className={styles.appBar}>
      {back ? (
        <Link className={styles.backControl} href={back.href} aria-label={`Back to ${back.name}`}>
          <Icon name="chevron-left" />
          <span className={styles.backLabel}>{back.name}</span>
        </Link>
      ) : null}
      {demoTag ? (
        <Link className={styles.demoTag} href="/" aria-label={DEMO_TAG_LABEL}>
          <span>{DEMO_TAG}</span>
        </Link>
      ) : null}
    </header>
  );
}
