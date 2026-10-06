import type { ReactNode } from "react";
import Link from "next/link";
import { Icon } from "./Icon";
import { KindIcon, type EntityKind } from "./KindIcon";
import type { IconName, Tone } from "./status";
import styles from "./primitives.module.css";

export function Card({
  title,
  heading = "h2",
  titleHref,
  kind,
  mark,
  children,
}: {
  title: string;
  heading?: "h2" | "h3";
  titleHref?: string;
  kind?: EntityKind;
  /** A status icon in its tone's colour, in place of the kind icon (a logged wait or escalation). */
  mark?: { readonly tone: Tone; readonly icon: IconName };
  children: ReactNode;
}) {
  const Heading = heading;
  return (
    <article className={styles.card}>
      <Heading className={kind || mark ? styles.kindTitle : undefined}>
        {mark ? (
          <span className={`${styles.stateLabel} ${styles[mark.tone]}`}>
            <Icon name={mark.icon} />
          </span>
        ) : kind ? (
          <KindIcon kind={kind} />
        ) : null}
        {titleHref ? (
          <Link className={styles.blockLink} href={titleHref}>
            {title}
          </Link>
        ) : (
          title
        )}
      </Heading>
      {children}
    </article>
  );
}
