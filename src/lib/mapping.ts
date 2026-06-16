import { CanonicalField, FieldMapping, FieldSuggestion, MappingTarget, RawRow } from "../types";

export const CANONICAL_FIELD_LABELS: Record<CanonicalField, string> = {
  first_name: "First name",
  last_name: "Last name",
  middle_initial: "Middle initial",
  address_line_1: "Address line 1",
  address_line_2: "Address line 2",
  city: "City",
  state: "State",
  zip: "ZIP",
  zip4: "ZIP+4",
  current_lender: "Current lender",
  mortgage_balance: "Aggregate mortgage balance",
  highest_mortgage_balance: "First-lien balance",
  monthly_mortgage_payment: "Monthly mortgage payment",
  current_mortgage_rate: "Current first-mortgage rate",
  mortgage_origination_date: "Mortgage origination date",
  loan_type: "Loan type",
  fico: "FICO",
  bankcard_debt: "Bankcard debt",
  revolving_debt: "Retail/revolving debt",
  combined_debt: "Combined debt",
  revolving_monthly_payment: "Revolving monthly payment",
  mortgage_30_day_lates_12m: "Mortgage 30-day lates, 12m",
  mortgage_60_day_lates_12m: "Mortgage 60-day lates, 12m",
  mortgage_90_day_lates_12m: "Mortgage 90-day lates, 12m",
  months_since_bankruptcy: "Months since bankruptcy",
  months_since_mortgage_inquiry: "Months since mortgage inquiry",
  open_mortgage_trade_count: "Open mortgage trade count",
  owner_occupied: "Owner occupied",
  po_box_flag: "PO box flag",
  apartment_flag: "Apartment flag",
  reverse_suppress: "Reverse suppress",
  home_value: "Home value / AVM",
  estimated_equity: "Estimated equity",
  combined_ltv: "Combined LTV",
  age: "Age",
  va_eligible: "VA eligible",
  military_status: "Military status",
  phone: "Phone",
  email: "Email",
  marketing_consent_sms: "SMS consent",
  marketing_consent_email: "Email consent",
  marketing_consent_phone: "Phone consent",
  national_dnc_flag: "National DNC flag",
};

export const FIELD_OPTIONS: { value: MappingTarget; label: string }[] = [
  { value: "", label: "Unmapped" },
  { value: "ignore", label: "Ignore" },
  ...Object.entries(CANONICAL_FIELD_LABELS).map(([value, label]) => ({
    value: value as CanonicalField,
    label,
  })),
];

export const CRITICAL_FIELDS: CanonicalField[] = [
  "highest_mortgage_balance",
  "current_mortgage_rate",
  "mortgage_origination_date",
  "fico",
];

export const PROTECTED_QUARANTINE_FIELDS = [
  "HISP_FLAG",
  "HISPSURNAME_FLAG",
  "MARITALSTAT",
  "ED",
  "AGE",
  "DOB",
  "CREDIT_AGE",
  "INCOME",
  "INCOME_RANGE",
];

const SYNONYMS: Record<string, CanonicalField> = {
  FNAME: "first_name",
  FIRSTNAME: "first_name",
  FIRST_NAME: "first_name",
  LNAME: "last_name",
  LASTNAME: "last_name",
  LAST_NAME: "last_name",
  MI: "middle_initial",
  MIDDLE_INITIAL: "middle_initial",
  ADDR1: "address_line_1",
  ADDRESS1: "address_line_1",
  ADDRESS_LINE_1: "address_line_1",
  ADDR2: "address_line_2",
  ADDRESS2: "address_line_2",
  ADDRESS_LINE_2: "address_line_2",
  CITY: "city",
  STATE: "state",
  ZIP: "zip",
  ZIPCODE: "zip",
  ZIP4: "zip4",
  LENDERNAME1: "current_lender",
  CURRENT_LENDER: "current_lender",
  MTG08: "mortgage_balance",
  MTG10: "highest_mortgage_balance",
  MTG14: "monthly_mortgage_payment",
  MTG_RATE: "current_mortgage_rate",
  MTGRATE: "current_mortgage_rate",
  MTG_DATE: "mortgage_origination_date",
  MTGDATE: "mortgage_origination_date",
  MTG_LOANTYPE: "loan_type",
  MTG_LOAN_TYPE: "loan_type",
  FICO: "fico",
  BC16: "bankcard_debt",
  REV16: "revolving_debt",
  COMBINED_DEBT: "combined_debt",
  "COMBINED DEBT": "combined_debt",
  REV24: "revolving_monthly_payment",
  MTG19: "mortgage_30_day_lates_12m",
  MTG22: "mortgage_60_day_lates_12m",
  MTG25: "mortgage_90_day_lates_12m",
  PR26: "months_since_bankruptcy",
  MTG35: "months_since_mortgage_inquiry",
  MTG03: "open_mortgage_trade_count",
  OWNEROCCUPIED: "owner_occupied",
  OWNER_OCCUPIED: "owner_occupied",
  POBOX_FLAG: "po_box_flag",
  PO_BOX_FLAG: "po_box_flag",
  APT_FLAG: "apartment_flag",
  APARTMENT_FLAG: "apartment_flag",
  REVERSE_SUPPRESS: "reverse_suppress",
  MKTVAL: "home_value",
  MARKET_VALUE: "home_value",
  HOME_VALUE: "home_value",
  EQUITY01: "estimated_equity",
  EQUITY08: "estimated_equity",
  ESTIMATED_EQUITY: "estimated_equity",
  LTV05: "combined_ltv",
  COMBINED_LTV: "combined_ltv",
  AGE: "age",
  MTG73_FLAG: "va_eligible",
  VETERAN_HH_FLAG: "va_eligible",
  MILITARY_STATUS: "military_status",
  PHONE: "phone",
  EMAIL: "email",
  EMAIL02: "email",
  SMS_CONSENT: "marketing_consent_sms",
  EMAIL_CONSENT: "marketing_consent_email",
  PHONE_CONSENT: "marketing_consent_phone",
  NATL_DNC_FLAG: "national_dnc_flag",
};

export function suggestMappings(columns: string[], rows: RawRow[]): FieldMapping[] {
  return columns.map((column) => {
    const suggestion = suggestMapping(column, rows);
    return {
      ...suggestion,
      confirmedTarget: suggestion.target,
    };
  });
}

function suggestMapping(column: string, rows: RawRow[]): FieldSuggestion {
  const examples = sampleValues(column, rows);
  const normalized = normalizeHeader(column);
  const exactCanonical = (Object.keys(CANONICAL_FIELD_LABELS) as CanonicalField[]).find(
    (field) => normalizeHeader(field) === normalized,
  );

  if (PROTECTED_QUARANTINE_FIELDS.includes(normalized)) {
    return {
      source: column,
      target: "ignore",
      confidence: "high",
      reason: "Protected-class/proxy field quarantined by compliance rules.",
      examples,
      warning: "Excluded from scoring, segmentation, and targeting.",
    };
  }

  if (exactCanonical) {
    return {
      source: column,
      target: exactCanonical,
      confidence: "high",
      reason: "Exact canonical field match.",
      examples,
    };
  }

  const synonym = SYNONYMS[normalized] ?? SYNONYMS[column.trim().toUpperCase()];
  if (synonym) {
    return {
      source: column,
      target: synonym,
      confidence: "high",
      reason: "Matched vendor dictionary / known synonym.",
      examples,
      warning:
        normalized === "MTG_RATE"
          ? "Rate encoding will be detected from values and shown before scoring."
          : normalized === "PR26"
            ? "Zero will be treated as no bankruptcy, not zero months ago."
            : normalized === "MTG35"
              ? "Zero is treated as no/unknown inquiry and flagged as ambiguous."
              : undefined,
    };
  }

  const pattern = detectByValuePattern(examples);
  if (pattern) {
    return {
      source: column,
      target: pattern.target,
      confidence: pattern.confidence,
      reason: pattern.reason,
      examples,
    };
  }

  return {
    source: column,
    target: "",
    confidence: "unmapped",
    reason: "No reliable match.",
    examples,
  };
}

function normalizeHeader(header: string) {
  return header.trim().replace(/\s+/g, "_").replace(/[^A-Za-z0-9_]/g, "").toUpperCase();
}

function sampleValues(column: string, rows: RawRow[]) {
  const values: string[] = [];
  for (const row of rows) {
    const value = row[column];
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      values.push(String(value).trim());
    }
    if (values.length >= 5) break;
  }
  return values;
}

function detectByValuePattern(examples: string[]): Pick<FieldSuggestion, "target" | "confidence" | "reason"> | null {
  if (examples.length === 0) return null;
  const numbers = examples
    .map((value) => Number(String(value).replace(/[$,%\s,]/g, "")))
    .filter((value) => Number.isFinite(value));
  if (numbers.length < Math.ceil(examples.length * 0.8)) return null;

  const allDateLike = examples.every((value) => /^\d{8}$/.test(value) && Number(value.slice(0, 4)) >= 1990);
  if (allDateLike) {
    return {
      target: "mortgage_origination_date",
      confidence: "medium",
      reason: "Values look like YYYYMMDD dates.",
    };
  }

  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  const allInteger = numbers.every((value) => Number.isInteger(value));

  if (min >= 300 && max <= 850 && allInteger) {
    return {
      target: "fico",
      confidence: "medium",
      reason: "Values fall in the FICO score range.",
    };
  }

  if (min >= 150 && max <= 1200 && allInteger) {
    return {
      target: "current_mortgage_rate",
      confidence: "low",
      reason: "Values look like mortgage-rate basis points.",
    };
  }

  if (min >= 1.5 && max <= 12 && examples.some((value) => value.includes("."))) {
    return {
      target: "current_mortgage_rate",
      confidence: "low",
      reason: "Values look like mortgage-rate percentages.",
    };
  }

  if (min >= 100000 && max <= 3000000) {
    return {
      target: "highest_mortgage_balance",
      confidence: "low",
      reason: "Values look like mortgage balances.",
    };
  }

  return null;
}
