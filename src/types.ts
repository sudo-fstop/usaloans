export type RawRow = Record<string, unknown>;

export type Confidence = "high" | "medium" | "low" | "unmapped";

export type CanonicalField =
  | "first_name"
  | "last_name"
  | "middle_initial"
  | "address_line_1"
  | "address_line_2"
  | "city"
  | "state"
  | "zip"
  | "zip4"
  | "current_lender"
  | "mortgage_balance"
  | "highest_mortgage_balance"
  | "monthly_mortgage_payment"
  | "current_mortgage_rate"
  | "mortgage_origination_date"
  | "loan_type"
  | "fico"
  | "bankcard_debt"
  | "revolving_debt"
  | "combined_debt"
  | "revolving_monthly_payment"
  | "mortgage_30_day_lates_12m"
  | "mortgage_60_day_lates_12m"
  | "mortgage_90_day_lates_12m"
  | "months_since_bankruptcy"
  | "months_since_mortgage_inquiry"
  | "open_mortgage_trade_count"
  | "owner_occupied"
  | "po_box_flag"
  | "apartment_flag"
  | "reverse_suppress"
  | "home_value"
  | "estimated_equity"
  | "combined_ltv"
  | "age"
  | "va_eligible"
  | "military_status"
  | "phone"
  | "email"
  | "marketing_consent_sms"
  | "marketing_consent_email"
  | "marketing_consent_phone"
  | "national_dnc_flag";

export type MappingTarget = CanonicalField | "ignore" | "";

export interface FieldSuggestion {
  source: string;
  target: MappingTarget;
  confidence: Confidence;
  reason: string;
  examples: string[];
  warning?: string;
}

export interface FieldMapping extends FieldSuggestion {
  confirmedTarget: MappingTarget;
}

export interface ParsedUpload {
  fileName: string;
  rows: RawRow[];
  columns: string[];
  preview: RawRow[];
}

export interface NormalizedRecord {
  id: string;
  sourceIndex: number;
  original: RawRow;
  warnings: string[];
  missingCritical: string[];
  rateInterpretation?: string;
  dateInterpretation?: string;
  firstName?: string;
  lastName?: string;
  middleInitial?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zip?: string;
  zip4?: string;
  currentLender?: string;
  mortgageBalance?: number | null;
  highestMortgageBalance?: number | null;
  monthlyMortgagePayment?: number | null;
  currentMortgageRate?: number | null;
  mortgageOriginationDate?: string | null;
  loanAgeMonths?: number | null;
  loanType?: string;
  fico?: number | null;
  bankcardDebt?: number | null;
  revolvingDebt?: number | null;
  combinedDebt?: number | null;
  revolvingMonthlyPayment?: number | null;
  mortgage30DayLates12m?: number | null;
  mortgage60DayLates12m?: number | null;
  mortgage90DayLates12m?: number | null;
  monthsSinceBankruptcy?: number | null;
  monthsSinceMortgageInquiry?: number | null;
  openMortgageTradeCount?: number | null;
  ownerOccupied?: boolean | null;
  poBoxFlag?: boolean | null;
  apartmentFlag?: boolean | null;
  reverseSuppress?: boolean | null;
  homeValue?: number | null;
  estimatedEquity?: number | null;
  combinedLtv?: number | null;
  age?: number | null;
  vaEligible?: boolean | null;
  militaryStatus?: string;
  phone?: string;
  email?: string;
  marketingConsentSms?: boolean | null;
  marketingConsentEmail?: boolean | null;
  marketingConsentPhone?: boolean | null;
  nationalDncFlag?: boolean | null;
}

export type OpportunityType =
  | "Suppress"
  | "VA IRRRL"
  | "Rate-Term Refi"
  | "Second-Lien Equity"
  | "Cash-Out Refi"
  | "VA Cash-Out"
  | "Watchlist"
  | "Watchlist (VA)"
  | "Low Priority";

export type CloseLikelihood = "Very High" | "High" | "Medium" | "Low";

export interface MarketInputs {
  mortgage30yRate: number;
  mortgage15yRate: number;
  secondLienRate: number;
  offerMargin: number;
  weeklyChange30y: number;
  fredApiKey: string;
  marketAsOf: string;
  inputsConfirmed: boolean;
}

export interface ScoreWeights {
  refinanceIncentive: number;
  equityOpportunity: number;
  fico: number;
  balanceRevenue: number;
  debtConsolidation: number;
  loanAge: number;
  cleanProfile: number;
  contactability: number;
}

export interface ScoreConfig {
  rateTermThreshold: number;
  vaRateDeltaThreshold: number;
  minMonthlyBenefit: number;
  assumedEquityPct: number;
  maxCltv: number;
  secondLienTermMonths: number;
  debtMinPaymentPct: number;
  weights: ScoreWeights;
}

export interface EquityEvaluation {
  equityConfirmed: boolean;
  equityUnconfirmedReason?: string;
  estimatedEquity: number | null;
  availableHeadroom: number | null;
  cashNeeded: number | null;
  statusQuoMonthly: number | null;
  mortgagePaymentUsed: number | null;
  mortgagePaymentEstimated: boolean;
  cashoutMonthly: number | null;
  secondLienOnlyMonthly: number | null;
  secondLienStructureMonthly: number | null;
  bestStructure: "Cash-Out Refi" | "Second-Lien Equity" | null;
  monthlyDelta: number | null;
  annualDelta: number | null;
  isLead: boolean;
  notes: string[];
}

export interface ScoreFactor {
  label: string;
  score: number;
  max: number;
  note: string;
}

export interface ScoredRecord extends NormalizedRecord {
  refiScore: number;
  closeLikelihood: CloseLikelihood;
  opportunityType: OpportunityType;
  recommendedChannel: string;
  marketingAngle: string;
  explanation: string;
  scoreExplanation: string;
  estimatedMonthlySavings: number | null;
  estimatedAnnualSavings: number | null;
  savingsDisclaimer: string;
  equityConfirmed: boolean;
  marketRateAtScoring: number;
  offerRateAtScoring: number;
  scoredAt: string;
  segmentName: string;
  complianceFlags: string[];
  rateDelta: number | null;
  factors: ScoreFactor[];
  equity: EquityEvaluation;
}

export interface DataQualityReport {
  totalRows: number;
  columnCount: number;
  validRows: number;
  suppressedRows: number;
  duplicateHouseholds: number;
  missingCriticalCounts: Record<string, number>;
  invalidRateRows: number;
  invalidDateRows: number;
  ownerOccupiedRows: number;
  missingEquityRows: number;
  quarantinedColumns: string[];
  distributions: {
    fico: DistributionBin[];
    rate: DistributionBin[];
    balance: DistributionBin[];
    debt: DistributionBin[];
  };
  lenderBreakdown: { name: string; count: number }[];
  inertFactorWarnings: string[];
}

export interface DistributionBin {
  label: string;
  count: number;
}
