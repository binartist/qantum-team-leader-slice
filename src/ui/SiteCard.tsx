import Link from "next/link";
import { sitePath } from "./format";
import { StatusChip } from "./StatusChip";
import type { StatusView } from "./status";
import styles from "./primitives.module.css";

export function SiteCard({
  id,
  name,
  reference,
  status,
}: {
  id: string;
  name: string;
  reference: string;
  status: StatusView;
}) {
  return (
    <Link className={styles.siteCard} href={sitePath(id)}>
      <span>{name}</span>
      <span className={styles.muted}>{reference}</span>
      <StatusChip status={status} />
    </Link>
  );
}
