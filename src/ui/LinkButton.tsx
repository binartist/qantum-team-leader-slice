import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./primitives.module.css";

export function LinkButton({ href, children, primary = false }: { href: string; children: ReactNode; primary?: boolean }) {
  return (
    <Link className={primary ? `${styles.button} ${styles.primary}` : styles.button} href={href}>
      {children}
    </Link>
  );
}
