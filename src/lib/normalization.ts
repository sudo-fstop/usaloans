import {
  DataQualityReport,
  DistributionBin,
  FieldMapping,
  NormalizedRecord,
  RawRow,
  ScoredRecord,
} from "../types";
import { CRITICAL_FIELDS, PROTECTED_QUARANTINE_FIELDS } from "./mapping";

const TARGET_TO_PROP: Record<string, keyof NormalizedRecord> = {
  first_name: "firstName",
  last_name: "lastName",
  middle_initial: "middleInitial",
  address_line_1: "addressLine1",
  address_line_2: "addressLine2",
  city: "city",
  state: "state",
  zip: "zip",
  zip4: "zip4",
  current_lender: "currentLender",
  mortgage_balance: "mortgageBalance",
  highest_mortgage_balance: "highestMortgageBalance",
  monthly_mortgage_payment: "monthlyMortgagePayment",
  current_mortgage_rate: "currentMortgageRate",
  mortgage_origination_date: "mortgageOriginationDate",
  loan_type: "loanType",
  fico: "fico",
  bankcard_debt: "bankcardDebt",
  revolving_debt: "revolvingDebt",
  combined_debt: "combinedDebt",
  revolving_monthly_payment: "revolvingMonthlyPayment",
  mortgage_30_day_lates_12m: "mortgage30DayLates12m",
  mortgage_60_day_lates_12m: "mortgage60DayLates12m",
  mortgage_90_day_lates_12m: "mortgage90DayLates12m",
  months_since_bankruptcy: "monthsSinceBankruptcy",
  months_since_mortgage_inquiry: "monthsSinceMortgageInquiry",
  open_mortgage_trade_count: "openMortgageTradeCount",
  owner_occupied: "ownerOccupied",
  po_box_flag: "poBoxFlag",
  apartment_flag: "apartmentFlag",
  reverse_suppress: "reverseSuppress",
  home_value: "homeValue",
  estimated_equity: "estimatedEquity",
  combined_ltv: "combinedLtv",
  age: "age",
  va_eligible: "vaEligible",
  military_status: "militaryStatus",
  phone: "phone",
  email: "email",
  marketing_consent_sms: "marketingConsentSms",
  marketing_consent_email: "marketingConsentEmail",
  marketing_consent_phone: "marketingConsentPhone",
  national_dnc_flag: "nationalDncFlag",
};

export function normalizeRows(rows: RawRow[], mappings: FieldMapping[]): NormalizedRecord[] {
  const targetToSource = new Map<string, string>();
  for (const mapping of mappings) {
    if (mapping.confirmedTarget && mapping.confirmedTarget !== "ignore" && !targetToSource.has(mapping.confirmedTarget)) {
      targetToSource.set(mapping.confirmedTarget, mapping.source);
    }
  }

  return rows.map((row, index) => normalizeRow(row, index, targetToSource));
}

function normalizeRow(row: RawRow, index: number, targetToSource: Map<string, string>): NormalizedRecord {
  const warnings: string[] = [];
  const record: NormalizedRecord = {
    id: `${index + 1}`,
    sourceIndex: index,
    original: row,
    warnings,
    missingCritical: [],
  };

  const get = (target: string) => {
    const source = targetToSource.get(target);
    return source ? row[source] : undefined;
  };

  assignString(record, "first_name", get, "firstName");
  assignString(record, "last_name", get, "lastName");
  assignString(record, "middle_initial", get, "middleInitial");
  assignString(record, "address_line_1", get, "addressLine1");
  assignString(record, "address_line_2", get, "addressLine2");
  assignString(record, "city", get, "city");
  assignString(record, "state", get, "state");
  assignString(record, "zip", get, "zip", true);
  assignString(record, "zip4", get, "zip4", true);
  assignString(record, "current_lender", get, "currentLender");
  assignString(record, "loan_type", get, "loanType");
  assignString(record, "military_status", get, "militaryStatus");
  assignString(record, "phone", get, "phone");
  assignString(record, "email", get, "email");

  record.mortgageBalance = parseCurrency(get("mortgage_balance"));
  record.highestMortgageBalance = parseCurrency(get("highest_mortgage_balance"));
  record.monthlyMortgagePayment = parseCurrency(get("monthly_mortgage_payment"));
  if (record.monthlyMortgagePayment === 0) {
    record.monthlyMortgagePayment = null;
    warnings.push("Mortgage payment of 0 treated as missing.");
  }

  const rate = parseRate(get("current_mortgage_rate"));
  record.currentMortgageRate = rate.value;
  record.rateInterpretation = rate.interpretation;
  if (rate.warning) warnings.push(rate.warning);

  const date = parseDate(get("mortgage_origination_date"));
  record.mortgageOriginationDate = date.value;
  record.loanAgeMonths = date.loanAgeMonths;
  record.dateInterpretation = date.interpretation;
  if (date.warning) warnings.push(date.warning);

  record.fico = parseNumber(get("fico"));
  record.bankcardDebt = parseCurrency(get("bankcard_debt"));
  record.revolvingDebt = parseCurrency(get("revolving_debt"));
  record.combinedDebt = parseCurrency(get("combined_debt"));
  record.revolvingMonthlyPayment = parseCurrency(get("revolving_monthly_payment"));
  record.mortgage30DayLates12m = parseNumber(get("mortgage_30_day_lates_12m"));
  record.mortgage60DayLates12m = parseNumber(get("mortgage_60_day_lates_12m"));
  record.mortgage90DayLates12m = parseNumber(get("mortgage_90_day_lates_12m"));
  record.monthsSinceBankruptcy = parseMonthsSince(get("months_since_bankruptcy"));
  record.monthsSinceMortgageInquiry = parseMonthsSince(get("months_since_mortgage_inquiry"));
  if (get("months_since_mortgage_inquiry") !== undefined && parseNumber(get("months_since_mortgage_inquiry")) === 0) {
    warnings.push("Mortgage inquiry value 0 treated as no/unknown inquiry.");
  }
  record.openMortgageTradeCount = parseNumber(get("open_mortgage_trade_count"));
  record.homeValue = parseCurrency(get("home_value"));
  record.estimatedEquity = parseCurrency(get("estimated_equity"));
  record.combinedLtv = parseNumber(get("combined_ltv"));
  record.age = parseNumber(get("age"));
  record.ownerOccupied = parseBoolean(get("owner_occupied"));
  record.poBoxFlag = parseBoolean(get("po_box_flag"));
  record.apartmentFlag = parseBoolean(get("apartment_flag"));
  record.reverseSuppress = parseBoolean(get("reverse_suppress"));
  record.vaEligible = parseBoolean(get("va_eligible"));
  record.marketingConsentSms = parseBoolean(get("marketing_consent_sms"));
  record.marketingConsentEmail = parseBoolean(get("marketing_consent_email"));
  record.marketingConsentPhone = parseBoolean(get("marketing_consent_phone"));
  record.nationalDncFlag = parseBoolean(get("national_dnc_flag"));

  if (record.currentMortgageRate == null) record.missingCritical.push("current_mortgage_rate");
  if (record.highestMortgageBalance == null) record.missingCritical.push("highest_mortgage_balance");
  if (record.mortgageOriginationDate == null) record.missingCritical.push("mortgage_origination_date");
  if (record.fico == null) record.missingCritical.push("fico");
  if (record.revolvingDebt == null && record.combinedDebt == null && record.bankcardDebt == null) {
    record.missingCritical.push("debt");
  }

  return record;
}

function assignString(
  record: NormalizedRecord,
  target: string,
  get: (target: string) => unknown,
  prop: keyof NormalizedRecord,
  preserveAsString = false,
) {
  const value = get(target);
  if (value === null || value === undefined || String(value).trim() === "") return;
  const raw = String(value).trim();
  (record[prop] as string | undefined) = preserveAsString ? raw : raw.replace(/\s+/g, " ");
}

export function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value).trim().replace(/[$,%\s,]/g, "");
  if (!cleaned) return null;
  const numeric = Number(cleaned);
  return Number.isFinite(numeric) ? numeric : null;
}

export function parseCurrency(value: unknown): number | null {
  return parseNumber(value);
}

function parseRate(value: unknown): { value: number | null; interpretation?: string; warning?: string } {
  const raw = parseNumber(value);
  if (raw == null) return { value: null };

  let normalized: number | null = null;
  let interpretation = "";

  if (raw > 30) {
    normalized = raw / 100;
    interpretation = `${raw} interpreted as basis points -> ${normalized.toFixed(2)}%`;
  } else if (raw >= 1.5 && raw <= 12) {
    normalized = raw;
    interpretation = `${raw} interpreted as percent`;
  } else if (raw > 0 && raw < 0.15) {
    normalized = raw * 100;
    interpretation = `${raw} interpreted as fraction -> ${normalized.toFixed(2)}%`;
  } else {
    return {
      value: null,
      interpretation: `${raw} could not be safely interpreted`,
      warning: `Ambiguous mortgage rate "${raw}" excluded from scoring.`,
    };
  }

  if (normalized < 1.5 || normalized > 12) {
    return {
      value: null,
      interpretation,
      warning: `Mortgage rate "${raw}" normalized outside plausible band and was flagged.`,
    };
  }

  return { value: round(normalized, 3), interpretation };
}

function parseMonthsSince(value: unknown): number | null {
  const parsed = parseNumber(value);
  if (parsed == null || parsed === 0) return null;
  return parsed > 0 ? parsed : null;
}

function parseBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1 ? true : value === 0 ? false : null;
  const normalized = String(value).trim().toUpperCase();
  if (["Y", "YES", "TRUE", "T", "1", "OWNER", "OWNEROCCUPIED"].includes(normalized)) return true;
  if (["N", "NO", "FALSE", "F", "0", "NONE"].includes(normalized)) return false;
  return null;
}

function parseDate(value: unknown): { value: string | null; loanAgeMonths: number | null; interpretation?: string; warning?: string } {
  if (value === null || value === undefined || String(value).trim() === "") {
    return { value: null, loanAgeMonths: null };
  }
  const raw = String(value).trim();
  let date: Date | null = null;
  let interpretation = "";

  if (/^\d{8}$/.test(raw)) {
    const year = Number(raw.slice(0, 4));
    const month = Number(raw.slice(4, 6));
    const day = Number(raw.slice(6, 8));
    date = new Date(year, month - 1, day);
    interpretation = `${raw} interpreted as YYYYMMDD`;
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      date = null;
    }
  } else {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      date = parsed;
      interpretation = `${raw} interpreted as date`;
    }
  }

  if (!date) {
    return {
      value: null,
      loanAgeMonths: null,
      warning: `Mortgage date "${raw}" could not be parsed.`,
    };
  }

  const iso = date.toISOString().slice(0, 10);
  return {
    value: iso,
    loanAgeMonths: monthsBetween(date, new Date()),
    interpretation,
  };
}

function monthsBetween(start: Date, end: Date) {
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) months -= 1;
  return Math.max(months, 0);
}

export function buildDataQualityReport(
  normalized: NormalizedRecord[],
  scored: ScoredRecord[],
  mappings: FieldMapping[],
): DataQualityReport {
  const totalRows = normalized.length;
  const missingCriticalCounts: Record<string, number> = {};
  for (const field of [...CRITICAL_FIELDS, "debt"] as string[]) {
    missingCriticalCounts[field] = normalized.filter((row) => row.missingCritical.includes(field)).length;
  }

  const duplicateHouseholds = countDuplicates(normalized);
  const invalidRateRows = normalized.filter((row) => row.warnings.some((warning) => warning.includes("rate"))).length;
  const invalidDateRows = normalized.filter((row) => row.warnings.some((warning) => warning.includes("date"))).length;
  const ownerOccupiedRows = normalized.filter((row) => row.ownerOccupied === true).length;
  const missingEquityRows = normalized.filter(
    (row) => row.homeValue == null && row.estimatedEquity == null && row.combinedLtv == null,
  ).length;
  const quarantinedColumns = mappings
    .filter((mapping) => PROTECTED_QUARANTINE_FIELDS.includes(mapping.source.trim().replace(/\s+/g, "_").toUpperCase()))
    .map((mapping) => mapping.source);

  return {
    totalRows,
    columnCount: mappings.length,
    validRows: normalized.filter((row) => row.missingCritical.length === 0).length,
    suppressedRows: scored.filter((row) => row.opportunityType === "Suppress").length,
    duplicateHouseholds,
    missingCriticalCounts,
    invalidRateRows,
    invalidDateRows,
    ownerOccupiedRows,
    missingEquityRows,
    quarantinedColumns,
    distributions: {
      fico: makeBins(normalized.map((row) => row.fico), [660, 700, 740, 780, 820], ["<660", "660-699", "700-739", "740-779", "780-819", "820+"]),
      rate: makeBins(normalized.map((row) => row.currentMortgageRate), [3, 4, 5, 6, 7], ["<3", "3-3.99", "4-4.99", "5-5.99", "6-6.99", "7+"]),
      balance: makeBins(
        normalized.map((row) => row.highestMortgageBalance),
        [100000, 200000, 300000, 500000, 750000],
        ["<100k", "100-199k", "200-299k", "300-499k", "500-749k", "750k+"],
      ),
      debt: makeBins(
        normalized.map((row) => row.bankcardDebt ?? row.combinedDebt ?? row.revolvingDebt),
        [5000, 10000, 25000, 50000, 75000],
        ["<5k", "5-9k", "10-24k", "25-49k", "50-74k", "75k+"],
      ),
    },
    lenderBreakdown: topCounts(normalized.map((row) => row.currentLender ?? "Unknown"), 8),
    inertFactorWarnings: buildInertWarnings(scored),
  };
}

function countDuplicates(records: NormalizedRecord[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const record of records) {
    const key = [record.lastName, record.firstName, record.addressLine1, record.zip].filter(Boolean).join("|").toUpperCase();
    if (!key) continue;
    if (seen.has(key)) duplicates.add(key);
    seen.add(key);
  }
  return duplicates.size;
}

function makeBins(values: Array<number | null | undefined>, breaks: number[], labels: string[]): DistributionBin[] {
  const bins = labels.map((label) => ({ label, count: 0 }));
  for (const value of values) {
    if (value == null || !Number.isFinite(value)) continue;
    const index = breaks.findIndex((breakpoint) => value < breakpoint);
    bins[index === -1 ? bins.length - 1 : index].count += 1;
  }
  return bins;
}

function topCounts(values: string[], limit: number) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

function buildInertWarnings(scored: ScoredRecord[]) {
  const warnings: string[] = [];
  const factorLabels = scored[0]?.factors.map((factor) => factor.label) ?? [];
  for (const label of factorLabels) {
    const values = scored
      .map((record) => record.factors.find((factor) => factor.label === label)?.score ?? 0)
      .filter((value) => Number.isFinite(value));
    if (values.length === 0) continue;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const unique = new Set(values.map((value) => value.toFixed(2))).size;
    if (unique <= 2 || max - min < 1) {
      warnings.push(`${label} has little or no spread in this file.`);
    }
  }
  return warnings;
}

function round(value: number, decimals = 2) {
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
}
