import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./primitives.module.css";

export function LinkButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link className={styles.button} href={href}>
      {children}
    </Link>
  );
}
