import { Card } from "./Card";
import { ProposeDialog } from "./decisions/ProposeDialog";
import { formatRating } from "./format";
import { StatusChip } from "./StatusChip";
import { availabilityStatus, type AvailabilityChip } from "./status";

export function CandidateCard({
  siteId,
  penetrationId,
  fromCode,
  toCode,
  integrityMinutes,
  insulationMinutes,
  overall,
  summary,
}: {
  siteId: string;
  penetrationId: string;
  fromCode: string;
  toCode: string;
  integrityMinutes: number | null;
  insulationMinutes: number | null;
  overall: AvailabilityChip;
  summary: string;
}) {
  return (
    <Card title={toCode}>
      <p>{`Rating ${formatRating(integrityMinutes, insulationMinutes)}`}</p>
      <StatusChip status={availabilityStatus(overall)} />
      {summary ? <p>{summary}</p> : null}
      <ProposeDialog siteId={siteId} penetrationId={penetrationId} fromCode={fromCode} toCode={toCode} />
    </Card>
  );
}
