import { Card } from "./Card";
import { ProposeDialog } from "./decisions/ProposeDialog";
import { formatRating, supplierRefLine } from "./format";
import { StatusChip } from "./StatusChip";
import { availabilityStatus, ratingComparison, type AvailabilityChip } from "./status";

export function CandidateCard({
  siteId,
  penetrationId,
  fromCode,
  toCode,
  integrityMinutes,
  insulationMinutes,
  requiredIntegrityMinutes,
  requiredInsulationMinutes,
  supplierRefCode,
  overall,
  summary,
}: {
  siteId: string;
  penetrationId: string;
  fromCode: string;
  toCode: string;
  integrityMinutes: number | null;
  insulationMinutes: number | null;
  requiredIntegrityMinutes: number | null;
  requiredInsulationMinutes: number | null;
  supplierRefCode: string;
  overall: AvailabilityChip;
  summary: string;
}) {
  const supplier = supplierRefLine(supplierRefCode);
  return (
    <Card title={toCode} kind="solution">
      <p>{formatRating(integrityMinutes, insulationMinutes)}</p>
      {supplier ? <p>{supplier}</p> : null}
      <StatusChip
        status={ratingComparison(integrityMinutes, insulationMinutes, requiredIntegrityMinutes, requiredInsulationMinutes)}
      />
      <StatusChip status={availabilityStatus(overall)} />
      {summary ? <p>{summary}</p> : null}
      <ProposeDialog siteId={siteId} penetrationId={penetrationId} fromCode={fromCode} toCode={toCode} />
    </Card>
  );
}
