"use client";

import type { MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "./Icon";
import { returnsToPrevious } from "./nav-history";
import styles from "./primitives.module.css";

/** The chevron back link. Pops the history entry when it is the named screen, so that page is revealed at once. */
export function BackControl({ href, name, className }: { href: string; name: string; className?: string }) {
  const router = useRouter();

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return;
    if (!returnsToPrevious(href)) return;
    event.preventDefault();
    router.back();
  }

  return (
    <Link className={className} href={href} aria-label={`Back to ${name}`} onClick={onClick}>
      <Icon name="chevron-left" />
      <span className={styles.backLabel}>{name}</span>
    </Link>
  );
}
