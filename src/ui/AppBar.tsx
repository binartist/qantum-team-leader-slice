import Link from "next/link";
import { Icon } from "./Icon";
import styles from "./primitives.module.css";

/** The header holds the title. A back row sits directly below it, named after the screen it returns to. */
export function AppBar({ title, backHref, backName }: { title: string; backHref?: string; backName?: string }) {
  return (
    <>
      <header className={styles.appBar}>
        <h1>{title}</h1>
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
