import Link from "next/link";
import { Icon } from "./Icon";
import { DEMO_TAG, DEMO_TAG_LABEL } from "./messages";
import styles from "./primitives.module.css";

/**
 * The header holds the title and a Demo tag that links to the page explaining the demo.
 * A back row sits directly below it, named after the screen it returns to.
 */
export function AppBar({
  title,
  backHref,
  backName,
  demoTag = true,
}: {
  title: string;
  backHref?: string;
  backName?: string;
  demoTag?: boolean;
}) {
  return (
    <>
      <header className={styles.appBar}>
        <h1>{title}</h1>
        {demoTag ? (
          <Link className={styles.demoTag} href="/" aria-label={DEMO_TAG_LABEL}>
            <span>{DEMO_TAG}</span>
          </Link>
        ) : null}
      </header>
      {backHref && backName ? (
        <div className={styles.backRow}>
          <Link className={styles.backControl} href={backHref} aria-label={`Back to ${backName}`}>
            <Icon name="chevron-left" />
            <span>{backName}</span>
          </Link>
        </div>
      ) : null}
    </>
  );
}
