import { ScoredRecord } from "../types";

const SCORING_COLUMNS = [
  "refi_score",
  "close_likelihood",
  "opportunity_type",
  "recommended_channel",
  "marketing_angle",
  "score_explanation",
  "estimated_monthly_savings",
  "estimated_annual_savings",
  "savings_disclaimer",
  "equity_confirmed",
  "market_rate_at_scoring",
  "scored_at",
  "segment_name",
  "compliance_flags",
];

export function buildExportCsv(records: ScoredRecord[]) {
  const originalColumns = Array.from(new Set(records.flatMap((record) => Object.keys(record.original))));
  const columns = [...originalColumns, ...SCORING_COLUMNS];
  const lines = [columns.map(escapeCsv).join(",")];

  for (const record of records) {
    const appended: Record<string, unknown> = {
      refi_score: record.refiScore,
      close_likelihood: record.closeLikelihood,
      opportunity_type: record.opportunityType,
      recommended_channel: record.recommendedChannel,
      marketing_angle: record.marketingAngle,
      score_explanation: record.scoreExplanation,
      estimated_monthly_savings: record.estimatedMonthlySavings ?? "",
      estimated_annual_savings: record.estimatedAnnualSavings ?? "",
      savings_disclaimer: record.savingsDisclaimer,
      equity_confirmed: record.equityConfirmed ? "true" : "false",
      market_rate_at_scoring: record.marketRateAtScoring,
      scored_at: record.scoredAt,
      segment_name: record.segmentName,
      compliance_flags: record.complianceFlags.join("; "),
    };

    const row = columns.map((column) => escapeCsv(column in appended ? appended[column] : record.original[column]));
    lines.push(row.join(","));
  }

  return lines.join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeCsv(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}
