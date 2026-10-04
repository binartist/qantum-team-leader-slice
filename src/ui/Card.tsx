import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./primitives.module.css";

export function Card({
  title,
  heading = "h2",
  titleHref,
  children,
}: {
  title: string;
  heading?: "h2" | "h3";
  titleHref?: string;
  children: ReactNode;
}) {
  const Heading = heading;
  return (
    <article className={styles.card}>
      <Heading>
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
