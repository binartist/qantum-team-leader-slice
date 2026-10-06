"use client";

import { useId } from "react";
import { Drawer } from "./Drawer";
import { Icon } from "./Icon";
import { NAV } from "./messages";
import { NavContent } from "./NavContent";
import type { NavSection } from "./nav-section";
import styles from "./primitives.module.css";

export type { NavSection };

/** The menu control for a top-level screen and the left drawer it opens (AC 37). */
export function NavDrawer({ current }: { current: NavSection }) {
  const navId = useId();
  return (
    <Drawer
      title={NAV.title}
      closeLabel={NAV.close}
      trigger={{
        className: styles.menuButton,
        label: NAV.open,
        content: <Icon name="menu" />,
        popup: true,
      }}
    >
      <NavContent current={current} collapsed={false} navId={navId} />
    </Drawer>
  );
}
