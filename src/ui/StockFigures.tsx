import { Banner } from "./Banner";
import { stockFiguresLine, stockIsStale } from "./format";
import { STOCK_STALE } from "./messages";
import { Notice } from "./Notice";

/** The shared-stock notice, the figures' age, and a warning when they are more than a day old. */
export function StockFigures({ notice, stockAsOf, asOf }: { notice: string; stockAsOf: string; asOf: string }) {
  return (
    <>
      <Notice>{notice}</Notice>
      <p>{stockFiguresLine(stockAsOf, asOf)}</p>
      {stockIsStale(stockAsOf, asOf) ? <Banner status={{ label: STOCK_STALE, tone: "warning", icon: "warning" }} /> : null}
    </>
  );
}
