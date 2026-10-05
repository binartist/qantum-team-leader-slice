import Link from "next/link";
import { sitePath } from "./format";
import { StatusChip } from "./StatusChip";
import type { StatusView } from "./status";
import styles from "./primitives.module.css";

export function SiteCard({
  id,
  name,
  status,
}: {
  id: string;
  name: string;
  status: StatusView;
}) {
  return (
    <Link className={styles.siteCard} href={sitePath(id)}>
      <span>{name}</span>
      <StatusChip status={status} />
    </Link>
  );
}
