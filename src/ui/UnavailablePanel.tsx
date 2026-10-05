import { Banner } from "./Banner";
import { ReloadButton } from "./ReloadButton";
import type { StatusView } from "./status";

export function UnavailablePanel({ status }: { status: StatusView }) {
  return (
    <>
      <Banner status={status} />
      <ReloadButton />
    </>
  );
}
