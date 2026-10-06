import type { ReactNode } from "react";
import Link from "next/link";
import { KindIcon, type EntityKind } from "./KindIcon";
import styles from "./primitives.module.css";

export function Card({
  title,
  heading = "h2",
  titleHref,
  kind,
  children,
}: {
  title: string;
  heading?: "h2" | "h3";
  titleHref?: string;
  kind?: EntityKind;
  children: ReactNode;
}) {
  const Heading = heading;
  return (
    <article className={styles.card}>
      <Heading className={kind ? styles.kindTitle : undefined}>
        {kind ? <KindIcon kind={kind} /> : null}
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
