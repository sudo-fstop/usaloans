import {
  CloseLikelihood,
  EquityEvaluation,
  MarketInputs,
  NormalizedRecord,
  OpportunityType,
  ScoreConfig,
  ScoreFactor,
  ScoredRecord,
} from "../types";

export const SAVINGS_DISCLAIMER =
  "Estimate for internal prioritization only. Not an offer, quote, or guarantee of savings or eligibility. Subject to full underwriting and current pricing.";

export const DEFAULT_MARKET_INPUTS: MarketInputs = {
  mortgage30yRate: 6.59,
  mortgage15yRate: 5.95,
  secondLienRate: 8.75,
  offerMargin: 0.25,
  weeklyChange30y: 0.04,
  fredApiKey: "",
  marketAsOf: "June 16, 2026 Bankrate national averages; confirm before scoring",
  inputsConfirmed: false,
};

export const DEFAULT_SCORE_CONFIG: ScoreConfig = {
  rateTermThreshold: 0.5,
  vaRateDeltaThreshold: 0.5,
  minMonthlyBenefit: 100,
  assumedEquityPct: 0.2,
  maxCltv: 0.8,
  secondLienTermMonths: 240,
  debtMinPaymentPct: 0.03,
  weights: {
    refinanceIncentive: 25,
    equityOpportunity: 20,
    fico: 15,
    balanceRevenue: 15,
    debtConsolidation: 10,
    loanAge: 5,
    cleanProfile: 5,
    contactability: 5,
  },
};

export function scoreRecords(records: NormalizedRecord[], market: MarketInputs, config: ScoreConfig): ScoredRecord[] {
  const scoredAt = new Date().toISOString();
  return records.map((record) => scoreRecord(record, market, config, scoredAt));
}

function scoreRecord(record: NormalizedRecord, market: MarketInputs, config: ScoreConfig, scoredAt: string): ScoredRecord {
  const offerRate30y = market.mortgage30yRate + market.offerMargin;
  const rateDelta =
    record.currentMortgageRate != null && Number.isFinite(record.currentMortgageRate)
      ? round(record.currentMortgageRate - offerRate30y, 3)
      : null;
  const suppressReasons = getSuppressReasons(record);
  const equity = evaluateEquity(record, market, config);

  const factors: ScoreFactor[] = [
    scoreRefinanceIncentive(rateDelta, config.weights.refinanceIncentive),
    scoreEquityOpportunity(equity, config.weights.equityOpportunity),
    scoreFico(record.fico, config.weights.fico),
    scoreBalance(record.highestMortgageBalance, config.weights.balanceRevenue),
    scoreDebt(getDebtAmount(record), config.weights.debtConsolidation),
    scoreLoanAge(record.loanAgeMonths, config.weights.loanAge),
    scoreCleanProfile(record, config.weights.cleanProfile),
    scoreContactability(record, config.weights.contactability),
  ];

  let refiScore = clamp(factors.reduce((sum, factor) => sum + factor.score, 0), 0, 100);
  let opportunityType: OpportunityType;

  if (suppressReasons.length > 0) {
    opportunityType = "Suppress";
    refiScore = 0;
  } else if (record.vaEligible && rateDelta != null && rateDelta >= config.vaRateDeltaThreshold && (record.loanAgeMonths ?? 0) >= 6) {
    opportunityType = "VA IRRRL";
  } else if (rateDelta != null && rateDelta >= config.rateTermThreshold) {
    opportunityType = "Rate-Term Refi";
  } else if (equity.isLead && equity.bestStructure === "Second-Lien Equity") {
    opportunityType = "Second-Lien Equity";
  } else if (equity.isLead && equity.bestStructure === "Cash-Out Refi") {
    opportunityType = record.vaEligible ? "VA Cash-Out" : "Cash-Out Refi";
  } else if (record.vaEligible && isCleanBorrower(record)) {
    opportunityType = "Watchlist (VA)";
  } else if (isCleanBorrower(record) && refiScore >= 18) {
    opportunityType = "Watchlist";
  } else {
    opportunityType = "Low Priority";
  }

  const complianceFlags = buildComplianceFlags(record, opportunityType, equity);
  const recommendation = recommend(opportunityType, equity);
  const closeLikelihood = likelihood(refiScore);
  const explanation = explain(record, opportunityType, rateDelta, offerRate30y, equity, suppressReasons);
  const estimatedMonthlySavings = equity.isLead ? equity.monthlyDelta : opportunityType === "Rate-Term Refi" ? estimateRateTermSavings(record, offerRate30y) : null;
  const estimatedAnnualSavings = estimatedMonthlySavings != null ? estimatedMonthlySavings * 12 : null;

  return {
    ...record,
    refiScore: round(refiScore),
    closeLikelihood,
    opportunityType,
    recommendedChannel: recommendation.channel,
    marketingAngle: recommendation.angle,
    explanation,
    scoreExplanation: factors.map((factor) => `${factor.label}: ${factor.score}/${factor.max} - ${factor.note}`).join(" | "),
    estimatedMonthlySavings: estimatedMonthlySavings != null ? round(estimatedMonthlySavings) : null,
    estimatedAnnualSavings: estimatedAnnualSavings != null ? round(estimatedAnnualSavings) : null,
    savingsDisclaimer: SAVINGS_DISCLAIMER,
    equityConfirmed: equity.equityConfirmed,
    marketRateAtScoring: market.mortgage30yRate,
    offerRateAtScoring: offerRate30y,
    scoredAt,
    segmentName: recommendation.segment,
    complianceFlags,
    rateDelta,
    factors,
    equity,
  };
}

function getSuppressReasons(record: NormalizedRecord) {
  const reasons: string[] = [];
  if (record.reverseSuppress === true) reasons.push("reverse suppression flag");
  if (record.ownerOccupied === false) reasons.push("not owner occupied");
  if (record.monthsSinceBankruptcy != null && record.monthsSinceBankruptcy < 24) reasons.push("bankruptcy within 24 months");
  if ((record.mortgage30DayLates12m ?? 0) > 0 || (record.mortgage60DayLates12m ?? 0) > 0 || (record.mortgage90DayLates12m ?? 0) > 0) {
    reasons.push("recent mortgage delinquency");
  }
  return reasons;
}

function evaluateEquity(record: NormalizedRecord, market: MarketInputs, config: ScoreConfig): EquityEvaluation {
  const notes: string[] = [];
  const balance = record.highestMortgageBalance ?? record.mortgageBalance ?? null;
  const aggregateBalance = record.mortgageBalance ?? record.highestMortgageBalance ?? null;
  const debt = getDebtAmount(record);
  const blank: EquityEvaluation = {
    equityConfirmed: false,
    estimatedEquity: null,
    availableHeadroom: null,
    cashNeeded: null,
    statusQuoMonthly: null,
    mortgagePaymentUsed: null,
    mortgagePaymentEstimated: false,
    cashoutMonthly: null,
    secondLienOnlyMonthly: null,
    secondLienStructureMonthly: null,
    bestStructure: null,
    monthlyDelta: null,
    annualDelta: null,
    isLead: false,
    notes,
  };

  if (!balance || balance <= 0 || !debt || debt < 5000) {
    notes.push("No meaningful consolidatable debt or mortgage balance for equity math.");
    return blank;
  }

  const equityInputs = estimateEquity(record, config);
  const cashNeeded = Math.min(debt, Math.max(0, equityInputs.availableHeadroom ?? 0));
  if (cashNeeded < 5000) {
    return {
      ...blank,
      equityConfirmed: equityInputs.confirmed,
      equityUnconfirmedReason: equityInputs.unconfirmedReason,
      estimatedEquity: equityInputs.estimatedEquity,
      availableHeadroom: equityInputs.availableHeadroom,
      cashNeeded,
      notes: [...notes, "Available equity headroom is below the minimum useful cash amount."],
    };
  }

  const offerRate30y = market.mortgage30yRate + market.offerMargin;
  const mortgagePayment =
    record.monthlyMortgagePayment && record.monthlyMortgagePayment > 0
      ? record.monthlyMortgagePayment
      : amortizedPayment(balance, record.currentMortgageRate ?? offerRate30y, 360);
  const mortgagePaymentEstimated = !(record.monthlyMortgagePayment && record.monthlyMortgagePayment > 0);
  const debtPayment = record.revolvingMonthlyPayment && record.revolvingMonthlyPayment > 0 ? record.revolvingMonthlyPayment : debt * config.debtMinPaymentPct;
  const statusQuoMonthly = mortgagePayment + debtPayment;
  const cashoutMonthly = amortizedPayment(balance + cashNeeded, offerRate30y, 360);
  const secondLienOnlyMonthly = amortizedPayment(cashNeeded, market.secondLienRate, config.secondLienTermMonths);
  const secondLienStructureMonthly = mortgagePayment + secondLienOnlyMonthly;
  const bestStructure = cashoutMonthly < secondLienStructureMonthly ? "Cash-Out Refi" : "Second-Lien Equity";
  const bestMonthly = Math.min(cashoutMonthly, secondLienStructureMonthly);
  const monthlyDelta = statusQuoMonthly - bestMonthly;
  const isLead = monthlyDelta > config.minMonthlyBenefit;

  if (!equityInputs.confirmed) {
    notes.push("equity unconfirmed - verify");
  }
  if (mortgagePaymentEstimated) {
    notes.push("Mortgage payment estimated because payment field was missing or zero.");
  }
  if (!isLead) {
    notes.push("Blended-cost comparison does not clear the monthly benefit threshold.");
  }

  return {
    equityConfirmed: equityInputs.confirmed,
    equityUnconfirmedReason: equityInputs.unconfirmedReason,
    estimatedEquity: equityInputs.estimatedEquity,
    availableHeadroom: equityInputs.availableHeadroom,
    cashNeeded,
    statusQuoMonthly,
    mortgagePaymentUsed: mortgagePayment,
    mortgagePaymentEstimated,
    cashoutMonthly,
    secondLienOnlyMonthly,
    secondLienStructureMonthly,
    bestStructure,
    monthlyDelta,
    annualDelta: monthlyDelta * 12,
    isLead,
    notes,
  };
}

function estimateEquity(record: NormalizedRecord, config: ScoreConfig) {
  const aggregateBalance = record.mortgageBalance ?? record.highestMortgageBalance ?? null;
  const firstBalance = record.highestMortgageBalance ?? record.mortgageBalance ?? null;

  if (record.combinedLtv != null && record.combinedLtv > 0 && aggregateBalance) {
    const inferredValue = record.homeValue ?? aggregateBalance / (record.combinedLtv / 100);
    const availableHeadroom = inferredValue * config.maxCltv - aggregateBalance;
    return {
      confirmed: true,
      estimatedEquity: inferredValue - aggregateBalance,
      availableHeadroom: Math.max(0, availableHeadroom),
    };
  }

  if (record.homeValue != null && record.homeValue > 0 && aggregateBalance) {
    return {
      confirmed: true,
      estimatedEquity: record.homeValue - aggregateBalance,
      availableHeadroom: Math.max(0, record.homeValue * config.maxCltv - aggregateBalance),
    };
  }

  if (record.estimatedEquity != null && record.estimatedEquity > 0) {
    return {
      confirmed: true,
      estimatedEquity: record.estimatedEquity,
      availableHeadroom: Math.max(0, record.estimatedEquity),
    };
  }

  const assumed = firstBalance ? firstBalance * config.assumedEquityPct : 0;
  return {
    confirmed: false,
    estimatedEquity: assumed,
    availableHeadroom: assumed,
    unconfirmedReason: "No home value, LTV05, or equity field mapped.",
  };
}

function scoreRefinanceIncentive(rateDelta: number | null, max: number): ScoreFactor {
  let ratio = 0;
  if (rateDelta != null) {
    if (rateDelta >= 1) ratio = 1;
    else if (rateDelta >= 0.75) ratio = 0.8;
    else if (rateDelta >= 0.5) ratio = 0.52;
    else if (rateDelta >= 0.25) ratio = 0.24;
  }
  return {
    label: "Refinance incentive",
    score: round(max * ratio),
    max,
    note: rateDelta == null ? "Missing/invalid rate." : `Rate delta ${formatPct(rateDelta)}.`,
  };
}

function scoreEquityOpportunity(equity: EquityEvaluation, max: number): ScoreFactor {
  let ratio = 0;
  const delta = equity.monthlyDelta ?? 0;
  if (delta >= 1000) ratio = 1;
  else if (delta >= 500) ratio = 0.75;
  else if (delta >= 250) ratio = 0.5;
  else if (equity.isLead) ratio = 0.3;
  if (!equity.equityConfirmed && ratio > 0) ratio *= 0.85;
  return {
    label: "Equity opportunity",
    score: round(max * ratio),
    max,
    note: equity.isLead
      ? `${equity.bestStructure} saves estimated ${formatCurrency(delta)}/mo${equity.equityConfirmed ? "" : "; equity unconfirmed"}.`
      : equity.notes[0] ?? "No equity product beats status quo.",
  };
}

function scoreFico(fico: number | null | undefined, max: number): ScoreFactor {
  let ratio = 0;
  if (fico != null) {
    if (fico >= 780) ratio = 1;
    else if (fico >= 740) ratio = 0.8;
    else if (fico >= 700) ratio = 0.53;
    else if (fico >= 660) ratio = 0.27;
  }
  return {
    label: "FICO",
    score: round(max * ratio),
    max,
    note: fico == null ? "Missing FICO." : `${Math.round(fico)} score.`,
  };
}

function scoreBalance(balance: number | null | undefined, max: number): ScoreFactor {
  let ratio = 0;
  if (balance != null) {
    if (balance >= 500000) ratio = 1;
    else if (balance >= 300000) ratio = 0.8;
    else if (balance >= 200000) ratio = 0.6;
    else if (balance >= 100000) ratio = 0.33;
    else ratio = 0.13;
  }
  return {
    label: "Balance / revenue",
    score: round(max * ratio),
    max,
    note: balance == null ? "Missing balance." : `${formatCurrency(balance)} first-lien balance.`,
  };
}

function scoreDebt(debt: number | null, max: number): ScoreFactor {
  let ratio = 0;
  if (debt != null) {
    if (debt >= 50000) ratio = 1;
    else if (debt >= 25000) ratio = 0.8;
    else if (debt >= 10000) ratio = 0.5;
    else if (debt >= 5000) ratio = 0.2;
  }
  return {
    label: "Debt consolidation",
    score: round(max * ratio),
    max,
    note: debt == null ? "Missing debt." : `${formatCurrency(debt)} consolidatable debt input.`,
  };
}

function scoreLoanAge(loanAgeMonths: number | null | undefined, max: number): ScoreFactor {
  let ratio = 0;
  if (loanAgeMonths != null) {
    if (loanAgeMonths >= 24 && loanAgeMonths <= 84) ratio = 1;
    else if (loanAgeMonths > 84) ratio = 0.8;
    else if (loanAgeMonths >= 6) ratio = 0.4;
  }
  return {
    label: "Loan age",
    score: round(max * ratio),
    max,
    note: loanAgeMonths == null ? "Missing origination date." : `${loanAgeMonths} months old.`,
  };
}

function scoreCleanProfile(record: NormalizedRecord, max: number): ScoreFactor {
  const lates = (record.mortgage30DayLates12m ?? 0) + (record.mortgage60DayLates12m ?? 0) + (record.mortgage90DayLates12m ?? 0);
  const recentBk = record.monthsSinceBankruptcy != null && record.monthsSinceBankruptcy < 48;
  const recentInquiry = record.monthsSinceMortgageInquiry != null && record.monthsSinceMortgageInquiry <= 3;
  let ratio = 1;
  if (lates > 0) ratio -= 0.6;
  if (recentBk) ratio -= 0.4;
  if (recentInquiry) ratio -= 0.2;
  ratio = clamp(ratio, 0, 1);
  return {
    label: "Clean profile",
    score: round(max * ratio),
    max,
    note: ratio === 1 ? "No recent lates, bankruptcy, or inquiry churn." : "Recent credit friction present.",
  };
}

function scoreContactability(record: NormalizedRecord, max: number): ScoreFactor {
  const hasEmailConsent = Boolean(record.email && record.marketingConsentEmail === true);
  const hasPhoneConsent = Boolean(record.phone && record.marketingConsentPhone === true && record.nationalDncFlag !== true);
  const hasSmsConsent = Boolean(record.phone && record.marketingConsentSms === true && record.nationalDncFlag !== true);
  const hasContact = Boolean(record.email || record.phone);
  let ratio = 0;
  if (hasEmailConsent || hasPhoneConsent || hasSmsConsent) ratio = 1;
  else if (hasContact) ratio = 0.6;
  return {
    label: "Contactability",
    score: round(max * ratio),
    max,
    note: ratio === 1 ? "Usable consented contact field." : hasContact ? "Contact present, consent/DNC unverified." : "No contact fields mapped.",
  };
}

function buildComplianceFlags(record: NormalizedRecord, opportunityType: OpportunityType, equity: EquityEvaluation) {
  const flags: string[] = [];
  if (opportunityType === "Suppress") flags.push("Do not market");
  if (!equity.equityConfirmed && (opportunityType === "Second-Lien Equity" || opportunityType === "Cash-Out Refi" || opportunityType === "VA Cash-Out")) {
    flags.push("Equity unconfirmed - verify");
  }
  if (record.nationalDncFlag === true) flags.push("Phone export blocked by DNC");
  if (record.phone && record.nationalDncFlag == null) flags.push("DNC status unverified");
  if (record.email && record.marketingConsentEmail !== true) flags.push("Email consent unverified");
  if (record.phone && record.marketingConsentPhone !== true) flags.push("Phone consent unverified");
  if (record.poBoxFlag === true) flags.push("PO box address");
  if (record.apartmentFlag === true) flags.push("Apartment flag");
  if (record.age != null) flags.push("Age field quarantined from eligibility logic");
  if (!record.vaEligible && record.loanType) flags.push("VA targeting unavailable unless VA fields are present");
  return flags;
}

function recommend(opportunityType: OpportunityType, equity: EquityEvaluation) {
  switch (opportunityType) {
    case "Rate-Term Refi":
      return {
        segment: "Rate-Term Refi (active)",
        channel: "Paid search + email",
        angle: "Math-driven payment review; no guaranteed savings language.",
      };
    case "Second-Lien Equity":
      return {
        segment: equity.equityConfirmed ? "Second-Lien Equity" : "Second-Lien Equity (unconfirmed)",
        channel: "Paid social + landing page",
        angle: "Use equity to reduce high-interest debt without touching the current first-mortgage rate.",
      };
    case "Cash-Out Refi":
      return {
        segment: "Cash-Out Refi",
        channel: "Paid search + LO review",
        angle: "Whole-loan repricing only when blended-cost math beats status quo.",
      };
    case "VA IRRRL":
      return {
        segment: "VA active",
        channel: "Search + veteran-affinity landing page",
        angle: "VA benefit review; avoid guaranteed savings or entitlement claims.",
      };
    case "VA Cash-Out":
      return {
        segment: "VA equity review",
        channel: "Search + LO review",
        angle: "VA cash-out only after whole-loan repricing review.",
      };
    case "Watchlist (VA)":
      return {
        segment: "VA watchlist",
        channel: "Retargeting + email nurture",
        angle: "Low-intensity VA benefit review and rate-drop monitoring.",
      };
    case "Watchlist":
      return {
        segment: "Watchlist / Rate Monitor",
        channel: "Retargeting + email nurture",
        angle: "Low-intensity nurture; prioritize when rates fall.",
      };
    case "Suppress":
      return {
        segment: "Suppress / Do Not Market",
        channel: "Excluded",
        angle: "Do not export for marketing.",
      };
    default:
      return {
        segment: "Low Priority",
        channel: "Optional nurture",
        angle: "No product clears the economic gate today.",
      };
  }
}

function explain(
  record: NormalizedRecord,
  opportunityType: OpportunityType,
  rateDelta: number | null,
  offerRate30y: number,
  equity: EquityEvaluation,
  suppressReasons: string[],
) {
  if (opportunityType === "Suppress") return `Suppressed: ${suppressReasons.join(", ")}.`;
  if (opportunityType === "Rate-Term Refi") {
    return `Current rate ${formatPct(record.currentMortgageRate)} is ${formatPct(rateDelta)} above the offer rate ${formatPct(offerRate30y)}.`;
  }
  if (opportunityType === "Second-Lien Equity" || opportunityType === "Cash-Out Refi" || opportunityType === "VA Cash-Out") {
    const verify = equity.equityConfirmed ? "" : " Equity unconfirmed - verify.";
    return `${equity.bestStructure} wins the blended-cost comparison by estimated ${formatCurrency(equity.monthlyDelta ?? 0)}/mo.${verify}`;
  }
  if (opportunityType === "VA IRRRL") {
    return `VA fields indicate eligibility and rate delta ${formatPct(rateDelta)} clears the active threshold.`;
  }
  if (opportunityType === "Watchlist" || opportunityType === "Watchlist (VA)") {
    return `Current rate ${formatPct(record.currentMortgageRate)} is below offer rate ${formatPct(offerRate30y)}; no product beats status quo today.`;
  }
  return record.missingCritical.length
    ? `Missing critical fields: ${record.missingCritical.join(", ")}.`
    : "Weak economics today; keep out of active refinance campaigns.";
}

function estimateRateTermSavings(record: NormalizedRecord, offerRate: number) {
  const balance = record.highestMortgageBalance ?? record.mortgageBalance;
  if (!balance || !record.currentMortgageRate) return null;
  const currentPayment = record.monthlyMortgagePayment ?? amortizedPayment(balance, record.currentMortgageRate, 360);
  const newPayment = amortizedPayment(balance, offerRate, 360);
  return Math.max(0, currentPayment - newPayment);
}

function likelihood(score: number): CloseLikelihood {
  if (score >= 80) return "Very High";
  if (score >= 60) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

function isCleanBorrower(record: NormalizedRecord) {
  return (
    record.ownerOccupied !== false &&
    record.reverseSuppress !== true &&
    (record.mortgage30DayLates12m ?? 0) === 0 &&
    (record.mortgage60DayLates12m ?? 0) === 0 &&
    (record.mortgage90DayLates12m ?? 0) === 0 &&
    !(record.monthsSinceBankruptcy != null && record.monthsSinceBankruptcy < 24)
  );
}

function getDebtAmount(record: NormalizedRecord) {
  return record.bankcardDebt ?? record.combinedDebt ?? record.revolvingDebt ?? null;
}

export function amortizedPayment(principal: number, annualRate: number, months: number) {
  if (principal <= 0 || months <= 0) return 0;
  const monthlyRate = annualRate / 100 / 12;
  if (monthlyRate === 0) return principal / months;
  return (principal * monthlyRate) / (1 - (1 + monthlyRate) ** -months);
}

function formatPct(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "n/a";
  return `${value.toFixed(2)}%`;
}

function formatCurrency(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "n/a";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function round(value: number, decimals = 2) {
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
