import Link from "next/link";
import { Icon } from "./Icon";
import type { PenetrationFact } from "./penetrations";
import { StatusChip } from "./StatusChip";
import styles from "./primitives.module.css";

/** A penetration fact. A short material is a link to its stock page and prefetches that page; every other fact stays text. */
export function FactLine({ fact }: { fact: PenetrationFact }) {
  const chip = <StatusChip status={fact} appearance="label" />;
  if (!fact.href) return chip;
  return (
    <Link className={styles.factLink} href={fact.href} prefetch={true}>
      <span className={styles.factLinkLabel}>{chip}</span>
      <Icon name="chevron-right" />
    </Link>
  );
}
