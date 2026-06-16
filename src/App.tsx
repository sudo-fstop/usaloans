import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { readSheet, type CellValue } from "read-excel-file/browser";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  FileSpreadsheet,
  Filter,
  RefreshCw,
  Search,
  Settings,
  CircleHelp,
  SlidersHorizontal,
  Upload,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { buildExportCsv, downloadCsv } from "./lib/export";
import { CANONICAL_FIELD_LABELS, FIELD_OPTIONS, suggestMappings } from "./lib/mapping";
import { buildDataQualityReport, normalizeRows } from "./lib/normalization";
import { DEFAULT_MARKET_INPUTS, DEFAULT_SCORE_CONFIG, scoreRecords } from "./lib/scoring";
import PitchPage from "./PitchPage";
import {
  DataQualityReport,
  FieldMapping,
  MarketInputs,
  OpportunityType,
  ParsedUpload,
  RawRow,
  ScoreConfig,
  ScoredRecord,
} from "./types";

type SortKey =
  | "refiScore"
  | "opportunityType"
  | "fico"
  | "currentMortgageRate"
  | "highestMortgageBalance"
  | "debt"
  | "currentLender"
  | "city";

interface Filters {
  opportunity: "All" | OpportunityType;
  minScore: number;
  ficoMin: string;
  ficoMax: string;
  rateMin: string;
  rateMax: string;
  debtMin: string;
  lender: string;
  place: string;
  suppression: "include" | "exclude" | "only";
}

const DEFAULT_FILTERS: Filters = {
  opportunity: "All",
  minScore: 0,
  ficoMin: "",
  ficoMax: "",
  rateMin: "",
  rateMax: "",
  debtMin: "",
  lender: "",
  place: "",
  suppression: "exclude",
};

const OPPORTUNITY_COLORS: Record<string, string> = {
  "Rate-Term Refi": "#2c7a5b",
  "Second-Lien Equity": "#b45309",
  "Cash-Out Refi": "#c84f31",
  "VA IRRRL": "#466a8f",
  "VA Cash-Out": "#7c5c93",
  Watchlist: "#65786e",
  "Watchlist (VA)": "#527a9a",
  "Low Priority": "#a1a19a",
  Suppress: "#3d3d3a",
};

const TOUR_STORAGE_KEY = "refisignal-tour-complete";

type TourPlacement = "top" | "right" | "bottom" | "left" | "center";

interface TourStep {
  target: string;
  title: string;
  body: string;
  firstRunBody?: string;
  unavailable?: string;
}

interface TourRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface TourPosition {
  top: number;
  left: number;
  width: number;
  height: number;
  placement: TourPlacement;
  arrow?: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
}

type TourMode = "first-run" | "replay";

interface TourGate {
  blocked: boolean;
  message: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    target: "upload",
    title: "Start with the file",
    body: "Drop a CSV/XLSX here or choose one from the machine. The borrower file is parsed locally in the browser.",
    firstRunBody: "Upload a CSV/XLSX to begin. The rest of the walkthrough unlocks after the file is parsed.",
  },
  {
    target: "market",
    title: "Confirm market pricing",
    body: "Set the 30Y rate, 15Y rate, second-lien rate, and offer margin before scoring. These inputs control the economics.",
    firstRunBody: "Confirm these market inputs before scoring. The tour will wait here until the Confirmed box is checked.",
  },
  {
    target: "settings",
    title: "Tune the rules",
    body: "Adjust thresholds only when the client has a different pricing or credit policy. Defaults match the v0 spec.",
  },
  {
    target: "mapping",
    title: "Confirm field mapping",
    body: "After upload, review each suggested column mapping. Low-confidence or protected fields should be corrected or ignored.",
    unavailable: "Upload a file to reveal the field mapping table.",
  },
  {
    target: "score",
    title: "Score after confirmation",
    body: "Confirm market inputs and mapping first. Then this button runs normalization, data quality checks, and scoring.",
    firstRunBody: "Click Confirm & Score so the data-quality report, dashboard, lead table, and detail panel can appear.",
    unavailable: "Upload a file and confirm market inputs to reveal the scoring button.",
  },
  {
    target: "quality",
    title: "Check data quality",
    body: "Review valid rows, missing critical fields, missing equity, flagged rates/dates, and factors with little spread.",
    unavailable: "Score a file to reveal the data-quality report.",
  },
  {
    target: "dashboard",
    title: "Read the opportunity mix",
    body: "The dashboard should show rate-term, second-lien, watchlist, suppress, and other segments without turning low-rate first mortgages into cash-out leads.",
    unavailable: "Score a file to reveal the dashboard.",
  },
  {
    target: "lead-table",
    title: "Filter the lead list",
    body: "Use score, opportunity type, FICO, rate, debt, lender, city/ZIP, and suppression filters to shape the export set.",
    unavailable: "Score a file to reveal the lead table.",
  },
  {
    target: "detail",
    title: "Inspect the math",
    body: "Select a row to see factor scores, compliance flags, and the blended-cost comparison behind the recommendation.",
    unavailable: "Score a file and select a row to reveal the detail panel.",
  },
  {
    target: "export",
    title: "Export filtered records",
    body: "Export downloads the current filtered set with original fields plus scoring, explanation, savings estimate, and compliance columns.",
  },
];

export default function App() {
  const routePath = getRoutePath();
  const [upload, setUpload] = useState<ParsedUpload | null>(null);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [mappingConfirmed, setMappingConfirmed] = useState(false);
  const [market, setMarket] = useState<MarketInputs>(DEFAULT_MARKET_INPUTS);
  const [config, setConfig] = useState<ScoreConfig>(DEFAULT_SCORE_CONFIG);
  const [scored, setScored] = useState<ScoredRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "refiScore", direction: "desc" });
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [fredStatus, setFredStatus] = useState("");
  const [tourOpen, setTourOpen] = useState(false);
  const [tourMode, setTourMode] = useState<TourMode>("replay");
  const [tourStepIndex, setTourStepIndex] = useState(0);

  const normalized = useMemo(() => (upload && mappingConfirmed ? normalizeRows(upload.rows, mappings) : []), [upload, mappingConfirmed, mappings]);
  const quality: DataQualityReport | null = useMemo(
    () => (mappingConfirmed ? buildDataQualityReport(normalized, scored, mappings) : null),
    [mappingConfirmed, mappings, normalized, scored],
  );
  const selected = scored.find((record) => record.id === selectedId) ?? scored[0] ?? null;
  const filtered = useMemo(() => filterAndSort(scored, filters, sort), [filters, scored, sort]);
  const dashboard = useMemo(() => buildDashboard(scored, market), [scored, market]);
  const canScore = Boolean(upload && mappings.length && market.inputsConfirmed);

  if (routePath.startsWith("/usaloans-pitch")) {
    return <PitchPage />;
  }

  useEffect(() => {
    try {
      if (window.localStorage.getItem(TOUR_STORAGE_KEY) !== "true") {
        window.setTimeout(() => {
          setTourMode("first-run");
          setTourOpen(true);
        }, 450);
      }
    } catch {
      window.setTimeout(() => {
        setTourMode("first-run");
        setTourOpen(true);
      }, 450);
    }
  }, []);

  useEffect(() => {
    if (tourOpen && tourMode === "first-run" && tourStepIndex === 0 && upload && !isParsing) {
      setTourStepIndex(1);
    }
  }, [isParsing, tourMode, tourOpen, tourStepIndex, upload]);

  useEffect(() => {
    if (tourOpen && tourMode === "first-run" && tourStepIndex === 4 && scored.length > 0) {
      setTourStepIndex(5);
    }
  }, [scored.length, tourMode, tourOpen, tourStepIndex]);

  async function handleFile(file: File) {
    setIsParsing(true);
    setParseError("");
    setMappingConfirmed(false);
    setScored([]);
    setSelectedId(null);
    setExportOpen(false);
    try {
      const parsed = await parseFile(file);
      setUpload(parsed);
      setMappings(suggestMappings(parsed.columns, parsed.rows));
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "Could not parse file.");
    } finally {
      setIsParsing(false);
    }
  }

  function confirmAndScore() {
    if (!upload) return;
    const nextNormalized = normalizeRows(upload.rows, mappings);
    const nextScored = scoreRecords(nextNormalized, market, config);
    setMappingConfirmed(true);
    setScored(nextScored);
    setSelectedId(nextScored[0]?.id ?? null);
  }

  async function fetchFredRates() {
    if (!market.fredApiKey.trim()) {
      setFredStatus("Manual entry active");
      return;
    }
    setFredStatus("Fetching FRED");
    try {
      const [thirty, fifteen] = await Promise.all([
        fetchFredSeries("MORTGAGE30US", market.fredApiKey),
        fetchFredSeries("MORTGAGE15US", market.fredApiKey),
      ]);
      setMarket((current) => ({
        ...current,
        mortgage30yRate: thirty.value,
        mortgage15yRate: fifteen.value,
        weeklyChange30y: thirty.previousValue == null ? current.weeklyChange30y : round(thirty.value - thirty.previousValue, 3),
        marketAsOf: `FRED ${thirty.date}`,
      }));
      setFredStatus("Updated");
    } catch {
      setFredStatus("Manual entry active");
    }
  }

  function openExportPanel() {
    setExportOpen(true);
  }

  function runExport() {
    const csv = buildExportCsv(filtered);
    downloadCsv(`refisignal_export_${new Date().toISOString().slice(0, 10)}.csv`, csv);
    setExportOpen(false);
  }

  function startTour() {
    setSettingsOpen(true);
    setTourMode("replay");
    setTourStepIndex(0);
    setTourOpen(true);
  }

  function finishTour() {
    setTourOpen(false);
    try {
      window.localStorage.setItem(TOUR_STORAGE_KEY, "true");
    } catch {
      // Local storage can be unavailable in hardened browser contexts.
    }
  }

  return (
    <main className="min-h-screen bg-cloud text-ink">
      <header className="border-b border-black/10 bg-white">
        <div className="mx-auto flex max-w-[1540px] flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded bg-moss text-white">
              <FileSpreadsheet size={22} aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-normal">RefiSignal</h1>
              <p className="text-sm text-ink/65">Mortgage refinance intelligence, scored locally in the browser</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              data-tour="tour-replay"
              className="inline-flex items-center gap-2 rounded border border-black/15 bg-white px-3 py-2 text-sm font-medium shadow-panel hover:bg-mint"
              onClick={startTour}
              title="Run guided tour"
            >
              <CircleHelp size={16} aria-hidden="true" />
              Tour
            </button>
            <button
              className="inline-flex items-center gap-2 rounded border border-black/15 bg-white px-3 py-2 text-sm font-medium shadow-panel hover:bg-mint"
              onClick={() => setSettingsOpen((value) => !value)}
              title="Toggle settings"
            >
              <Settings size={16} aria-hidden="true" />
              Settings
            </button>
            <button
              data-tour="export"
              className="inline-flex items-center gap-2 rounded bg-moss px-3 py-2 text-sm font-medium text-white shadow-panel hover:bg-moss/90 disabled:cursor-not-allowed disabled:bg-black/25"
              onClick={openExportPanel}
              disabled={!filtered.length}
              title="Export filtered records"
            >
              <Download size={16} aria-hidden="true" />
              Export
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1540px] gap-4 px-4 py-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <UploadPanel isParsing={isParsing} error={parseError} upload={upload} onFile={handleFile} />
          <MarketPanel market={market} setMarket={setMarket} fredStatus={fredStatus} onFetchFred={fetchFredRates} />
          {settingsOpen && <SettingsPanel config={config} setConfig={setConfig} />}
        </aside>

        <section className="space-y-4">
          {upload ? (
            <>
              <PreviewPanel upload={upload} />
              <MappingPanel mappings={mappings} setMappings={setMappings} canScore={canScore} onScore={confirmAndScore} marketConfirmed={market.inputsConfirmed} />
              {quality && <QualityPanel quality={quality} />}
              {scored.length > 0 && (
                <>
                  <DashboardPanel dashboard={dashboard} scored={scored} quality={quality} />
                  <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_420px]">
                    <LeadTablePanel
                      records={filtered}
                      filters={filters}
                      setFilters={setFilters}
                      sort={sort}
                      setSort={setSort}
                      selectedId={selected?.id ?? null}
                      onSelect={setSelectedId}
                    />
                    <DetailPanel record={selected} />
                  </div>
                </>
              )}
            </>
          ) : (
            <EmptyState />
          )}
        </section>
      </div>

      {exportOpen && (
        <ExportPanel
          records={filtered}
          onClose={() => setExportOpen(false)}
          onExport={runExport}
        />
      )}
      {tourOpen && (
        <GuidedTour
          steps={TOUR_STEPS}
          currentIndex={tourStepIndex}
          setCurrentIndex={setTourStepIndex}
          mode={tourMode}
          gate={getTourGate(tourMode, tourStepIndex, {
            uploadReady: Boolean(upload && !isParsing),
            marketConfirmed: market.inputsConfirmed,
            scoreReady: scored.length > 0,
            canScore,
          })}
          maxNavigableIndex={getTourMaxNavigableIndex(tourMode, {
            uploadReady: Boolean(upload && !isParsing),
            marketConfirmed: market.inputsConfirmed,
            scoreReady: scored.length > 0,
          })}
          onClose={finishTour}
        />
      )}
    </main>
  );
}

function GuidedTour({
  steps,
  currentIndex,
  setCurrentIndex,
  mode,
  gate,
  maxNavigableIndex,
  onClose,
}: {
  steps: TourStep[];
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
  mode: TourMode;
  gate: TourGate;
  maxNavigableIndex: number;
  onClose: () => void;
}) {
  const step = steps[currentIndex];
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [targetRect, setTargetRect] = useState<TourRect | null>(null);
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [cardHeight, setCardHeight] = useState(240);
  const paddedRect = targetRect ? padRect(targetRect, 10, viewport) : null;
  const position = getTourPosition(paddedRect, viewport, cardHeight);
  const unavailable = !targetRect && step.unavailable;

  useLayoutEffect(() => {
    let frame = 0;
    const measureTarget = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const target = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
        setViewport({ width: window.innerWidth, height: window.innerHeight });
        if (!target) {
          setTargetRect(null);
          return;
        }
        const rect = target.getBoundingClientRect();
        setTargetRect({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
      });
    };

    const scrollToTarget = () => {
      const target = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      if (!target) {
        setTargetRect(null);
        return;
      }
      target.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      window.setTimeout(measureTarget, 180);
    };

    scrollToTarget();
    window.addEventListener("resize", measureTarget);
    window.addEventListener("scroll", measureTarget, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", measureTarget);
      window.removeEventListener("scroll", measureTarget, true);
    };
  }, [step.target]);

  useLayoutEffect(() => {
    if (cardRef.current) {
      setCardHeight(cardRef.current.getBoundingClientRect().height);
    }
  }, [currentIndex, targetRect, unavailable]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") {
        event.preventDefault();
        if (!gate.blocked) setCurrentIndex(Math.min(currentIndex + 1, steps.length - 1));
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setCurrentIndex(Math.max(currentIndex - 1, 0));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentIndex, gate.blocked, onClose, setCurrentIndex, steps.length]);

  return (
    <div aria-live="polite">
      <svg className="pointer-events-none fixed inset-0 z-50 h-screen w-screen" width={viewport.width} height={viewport.height}>
        <defs>
          <mask id="tour-spotlight-mask">
            <rect x="0" y="0" width={viewport.width} height={viewport.height} fill="white" />
            {paddedRect && (
              <rect
                x={paddedRect.left}
                y={paddedRect.top}
                width={paddedRect.width}
                height={paddedRect.height}
                rx="8"
                fill="black"
              />
            )}
          </mask>
          <marker id="tour-arrow-head" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto" markerUnits="strokeWidth">
            <path d="M2,2 L10,6 L2,10 Z" fill="#f7d36b" />
          </marker>
        </defs>
        <rect x="0" y="0" width={viewport.width} height={viewport.height} fill="rgba(8, 18, 16, 0.72)" mask="url(#tour-spotlight-mask)" />
        {position.arrow && (
          <line
            x1={position.arrow.x1}
            y1={position.arrow.y1}
            x2={position.arrow.x2}
            y2={position.arrow.y2}
            stroke="#f7d36b"
            strokeWidth="3"
            strokeLinecap="round"
            markerEnd="url(#tour-arrow-head)"
          />
        )}
      </svg>

      {paddedRect && (
        <div
          className="pointer-events-none fixed z-[60] rounded-lg border-2 border-butter bg-transparent shadow-[0_0_0_1px_rgba(247,211,107,0.35),0_0_28px_rgba(247,211,107,0.5)]"
          style={{
            top: paddedRect.top,
            left: paddedRect.left,
            width: paddedRect.width,
            height: paddedRect.height,
          }}
        />
      )}

      <div
        ref={cardRef}
        className="fixed z-[70] rounded border border-butter/70 bg-white p-4 shadow-2xl"
        style={{
          top: position.top,
          left: position.left,
          width: position.width,
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Guided tour"
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-moss">
              Step {currentIndex + 1} of {steps.length}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-ink">{step.title}</h2>
          </div>
          <button className="rounded p-1 text-ink/60 hover:bg-cloud hover:text-ink" onClick={onClose} title="Close tour">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <p className="text-sm leading-6 text-ink/75">{unavailable ? step.unavailable : mode === "first-run" ? step.firstRunBody ?? step.body : step.body}</p>
        {gate.blocked && (
          <div className="mt-3 rounded border border-butter/70 bg-butter/20 px-3 py-2 text-sm font-medium text-ink">
            {gate.message}
          </div>
        )}
        {unavailable && <p className="mt-2 text-xs font-medium text-moss">You can replay the tour after that step appears.</p>}
        <div className="mt-4 h-1.5 rounded bg-black/10">
          <div className="h-1.5 rounded bg-moss" style={{ width: `${((currentIndex + 1) / steps.length) * 100}%` }} />
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            className="inline-flex items-center gap-2 rounded border border-black/15 bg-white px-3 py-2 text-sm font-medium hover:bg-cloud disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => setCurrentIndex(Math.max(currentIndex - 1, 0))}
            disabled={currentIndex === 0}
          >
            <ArrowLeft size={15} aria-hidden="true" />
            Back
          </button>
          <div className="flex gap-1">
            {steps.map((tourStep, index) => {
              const dotDisabled = mode === "first-run" && index > maxNavigableIndex;
              return (
                <button
                  key={tourStep.target}
                  className={`h-2.5 w-2.5 rounded-full ${index === currentIndex ? "bg-moss" : "bg-black/20"} ${dotDisabled ? "cursor-not-allowed opacity-40" : ""}`}
                  onClick={() => setCurrentIndex(index)}
                  disabled={dotDisabled}
                  title={`Go to step ${index + 1}`}
                  aria-label={`Go to step ${index + 1}`}
                />
              );
            })}
          </div>
          {currentIndex === steps.length - 1 ? (
            <button className="inline-flex items-center gap-2 rounded bg-moss px-3 py-2 text-sm font-semibold text-white hover:bg-moss/90" onClick={onClose}>
              Finish
              <Check size={15} aria-hidden="true" />
            </button>
          ) : (
            <button
              className="inline-flex items-center gap-2 rounded bg-moss px-3 py-2 text-sm font-semibold text-white hover:bg-moss/90 disabled:cursor-not-allowed disabled:bg-black/25"
              onClick={() => setCurrentIndex(currentIndex + 1)}
              disabled={gate.blocked}
            >
              Next
              <ArrowRight size={15} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function padRect(rect: TourRect, padding: number, viewport: { width: number; height: number }): TourRect {
  const left = Math.max(8, rect.left - padding);
  const top = Math.max(8, rect.top - padding);
  const right = Math.min(viewport.width - 8, rect.left + rect.width + padding);
  const bottom = Math.min(viewport.height - 8, rect.top + rect.height + padding);
  return {
    left,
    top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

function getTourGate(
  mode: TourMode,
  currentIndex: number,
  state: { uploadReady: boolean; marketConfirmed: boolean; scoreReady: boolean; canScore: boolean },
): TourGate {
  if (mode === "replay") return { blocked: false, message: "" };
  if (currentIndex === 0 && !state.uploadReady) {
    return {
      blocked: true,
      message: "Upload a file to continue the first-run walkthrough.",
    };
  }
  if (currentIndex === 1 && !state.marketConfirmed) {
    return {
      blocked: true,
      message: "Check Confirmed after reviewing the market inputs.",
    };
  }
  if (currentIndex === 4 && !state.scoreReady) {
    return {
      blocked: true,
      message: state.canScore
        ? "Click Confirm & Score to generate the post-upload reports."
        : "Resolve mapping issues and confirm market inputs so scoring can run.",
    };
  }
  return { blocked: false, message: "" };
}

function getTourMaxNavigableIndex(
  mode: TourMode,
  state: { uploadReady: boolean; marketConfirmed: boolean; scoreReady: boolean },
) {
  if (mode === "replay") return TOUR_STEPS.length - 1;
  if (!state.uploadReady) return 0;
  if (!state.marketConfirmed) return 1;
  if (!state.scoreReady) return 4;
  return TOUR_STEPS.length - 1;
}

function getTourPosition(rect: TourRect | null, viewport: { width: number; height: number }, cardHeight: number): TourPosition {
  const gap = 22;
  const width = Math.min(380, viewport.width - 32);
  const estimatedHeight = Math.max(cardHeight, 220);

  if (!rect || viewport.width < 720) {
    return {
      top: Math.max(16, viewport.height - estimatedHeight - 20),
      left: Math.max(16, (viewport.width - width) / 2),
      width,
      height: estimatedHeight,
      placement: "center",
    };
  }

  const targetCenterX = rect.left + rect.width / 2;
  const targetCenterY = rect.top + rect.height / 2;

  if (rect.left + rect.width + gap + width <= viewport.width - 16) {
    const top = clamp(targetCenterY - estimatedHeight / 2, 16, viewport.height - estimatedHeight - 16);
    const left = rect.left + rect.width + gap;
    return {
      top,
      left,
      width,
      height: estimatedHeight,
      placement: "right",
      arrow: {
        x1: left,
        y1: top + Math.min(84, estimatedHeight / 2),
        x2: rect.left + rect.width + 6,
        y2: targetCenterY,
      },
    };
  }

  if (rect.left - gap - width >= 16) {
    const top = clamp(targetCenterY - estimatedHeight / 2, 16, viewport.height - estimatedHeight - 16);
    const left = rect.left - gap - width;
    return {
      top,
      left,
      width,
      height: estimatedHeight,
      placement: "left",
      arrow: {
        x1: left + width,
        y1: top + Math.min(84, estimatedHeight / 2),
        x2: rect.left - 6,
        y2: targetCenterY,
      },
    };
  }

  if (rect.top + rect.height + gap + estimatedHeight <= viewport.height - 16) {
    const top = rect.top + rect.height + gap;
    const left = clamp(targetCenterX - width / 2, 16, viewport.width - width - 16);
    return {
      top,
      left,
      width,
      height: estimatedHeight,
      placement: "bottom",
      arrow: {
        x1: left + width / 2,
        y1: top,
        x2: targetCenterX,
        y2: rect.top + rect.height + 6,
      },
    };
  }

  const top = Math.max(16, rect.top - gap - estimatedHeight);
  const left = clamp(targetCenterX - width / 2, 16, viewport.width - width - 16);
  return {
    top,
    left,
    width,
    height: estimatedHeight,
    placement: "top",
    arrow: {
      x1: left + width / 2,
      y1: top + estimatedHeight,
      x2: targetCenterX,
      y2: rect.top - 6,
    },
  };
}

function UploadPanel({
  isParsing,
  error,
  upload,
  onFile,
}: {
  isParsing: boolean;
  error: string;
  upload: ParsedUpload | null;
  onFile: (file: File) => void;
}) {
  return (
    <section data-tour="upload" className="rounded border border-black/10 bg-white p-4 shadow-panel">
      <div
        className="flex min-h-40 flex-col items-center justify-center rounded border border-dashed border-moss/50 bg-mint/45 px-4 py-5 text-center"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer.files[0];
          if (file) onFile(file);
        }}
      >
        <Upload className="mb-2 text-moss" size={28} aria-hidden="true" />
        <label className="cursor-pointer rounded bg-moss px-3 py-2 text-sm font-medium text-white hover:bg-moss/90">
          Choose CSV/XLSX
          <input
            type="file"
            className="sr-only"
            accept=".csv,.xlsx"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onFile(file);
            }}
          />
        </label>
        <p className="mt-3 text-sm text-ink/65">{isParsing ? "Parsing file" : upload ? upload.fileName : "Drop a file here"}</p>
      </div>
      {error && <p className="mt-3 rounded border border-coral/30 bg-coral/10 px-3 py-2 text-sm text-coral">{error}</p>}
    </section>
  );
}

function MarketPanel({
  market,
  setMarket,
  fredStatus,
  onFetchFred,
}: {
  market: MarketInputs;
  setMarket: (next: MarketInputs | ((current: MarketInputs) => MarketInputs)) => void;
  fredStatus: string;
  onFetchFred: () => void;
}) {
  const window = refiWindow(market.weeklyChange30y);
  return (
    <section data-tour="market" className="rounded border border-black/10 bg-white p-4 shadow-panel">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/70">Market Inputs</h2>
        <span className={`rounded px-2 py-1 text-xs font-semibold ${windowClass(window)}`}>{window}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumberInput label="30Y rate" value={market.mortgage30yRate} suffix="%" onChange={(value) => setMarket((current) => ({ ...current, mortgage30yRate: value }))} />
        <NumberInput label="15Y rate" value={market.mortgage15yRate} suffix="%" onChange={(value) => setMarket((current) => ({ ...current, mortgage15yRate: value }))} />
        <NumberInput label="Second lien" value={market.secondLienRate} suffix="%" onChange={(value) => setMarket((current) => ({ ...current, secondLienRate: value }))} />
        <NumberInput label="Offer margin" value={market.offerMargin} suffix="%" onChange={(value) => setMarket((current) => ({ ...current, offerMargin: value }))} />
        <NumberInput label="WoW change" value={market.weeklyChange30y} suffix="%" step={0.01} onChange={(value) => setMarket((current) => ({ ...current, weeklyChange30y: value }))} />
        <label className="text-xs font-medium text-ink/70">
          FRED key
          <input
            className="mt-1 w-full rounded border border-black/15 bg-white px-2 py-2 text-sm"
            value={market.fredApiKey}
            type="password"
            onChange={(event) => setMarket((current) => ({ ...current, fredApiKey: event.target.value }))}
          />
        </label>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          className="inline-flex items-center gap-2 rounded border border-black/15 bg-white px-3 py-2 text-sm font-medium hover:bg-mint"
          onClick={onFetchFred}
          title="Fetch weekly FRED mortgage rates"
        >
          <RefreshCw size={15} aria-hidden="true" />
          FRED
        </button>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={market.inputsConfirmed}
            onChange={(event) => setMarket((current) => ({ ...current, inputsConfirmed: event.target.checked }))}
          />
          Confirmed
        </label>
      </div>
      <p className="mt-2 text-xs text-ink/60">{market.marketAsOf}</p>
      {fredStatus && <p className="mt-1 text-xs font-medium text-moss">{fredStatus}</p>}
    </section>
  );
}

function SettingsPanel({ config, setConfig }: { config: ScoreConfig; setConfig: (next: ScoreConfig | ((current: ScoreConfig) => ScoreConfig)) => void }) {
  return (
    <section data-tour="settings" className="rounded border border-black/10 bg-white p-4 shadow-panel">
      <div className="mb-3 flex items-center gap-2">
        <SlidersHorizontal size={16} aria-hidden="true" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/70">Scoring Settings</h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumberInput label="Rate-term gate" value={config.rateTermThreshold} suffix="%" step={0.05} onChange={(value) => setConfig((current) => ({ ...current, rateTermThreshold: value }))} />
        <NumberInput label="VA rate gate" value={config.vaRateDeltaThreshold} suffix="%" step={0.05} onChange={(value) => setConfig((current) => ({ ...current, vaRateDeltaThreshold: value }))} />
        <NumberInput label="Min benefit" value={config.minMonthlyBenefit} prefix="$" step={25} onChange={(value) => setConfig((current) => ({ ...current, minMonthlyBenefit: value }))} />
        <NumberInput label="Debt min pay" value={config.debtMinPaymentPct * 100} suffix="%" step={0.25} onChange={(value) => setConfig((current) => ({ ...current, debtMinPaymentPct: value / 100 }))} />
        <NumberInput label="Assumed equity" value={config.assumedEquityPct * 100} suffix="%" step={1} onChange={(value) => setConfig((current) => ({ ...current, assumedEquityPct: value / 100 }))} />
        <NumberInput label="Max CLTV" value={config.maxCltv * 100} suffix="%" step={1} onChange={(value) => setConfig((current) => ({ ...current, maxCltv: value / 100 }))} />
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {Object.entries(config.weights).map(([key, value]) => (
          <NumberInput
            key={key}
            label={shortWeightLabel(key)}
            value={value}
            step={1}
            onChange={(next) =>
              setConfig((current) => ({
                ...current,
                weights: { ...current.weights, [key]: next },
              }))
            }
          />
        ))}
      </div>
    </section>
  );
}

function PreviewPanel({ upload }: { upload: ParsedUpload }) {
  const previewColumns = upload.columns.slice(0, 8);
  return (
    <section data-tour="preview" className="rounded border border-black/10 bg-white p-4 shadow-panel">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/70">Parsed File</h2>
        <div className="flex gap-2 text-sm">
          <MetricPill label="Rows" value={upload.rows.length.toLocaleString()} />
          <MetricPill label="Columns" value={upload.columns.length.toLocaleString()} />
        </div>
      </div>
      <div className="max-h-72 overflow-auto rounded border border-black/10 scrollbar-thin">
        <table className="min-w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 bg-cloud">
            <tr>
              {previewColumns.map((column) => (
                <th key={column} className="border-b border-black/10 px-3 py-2 font-semibold">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {upload.preview.map((row, index) => (
              <tr key={index} className="odd:bg-white even:bg-cloud/60">
                {previewColumns.map((column) => (
                  <td key={column} className="max-w-48 truncate border-b border-black/5 px-3 py-2">
                    {String(row[column] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MappingPanel({
  mappings,
  setMappings,
  canScore,
  onScore,
  marketConfirmed,
}: {
  mappings: FieldMapping[];
  setMappings: (next: FieldMapping[] | ((current: FieldMapping[]) => FieldMapping[])) => void;
  canScore: boolean;
  onScore: () => void;
  marketConfirmed: boolean;
}) {
  const duplicateTargets = useMemo(() => {
    const counts = new Map<string, number>();
    for (const mapping of mappings) {
      if (!mapping.confirmedTarget || mapping.confirmedTarget === "ignore") continue;
      counts.set(mapping.confirmedTarget, (counts.get(mapping.confirmedTarget) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .filter(([, count]) => count > 1)
      .map(([target]) => target);
  }, [mappings]);

  return (
    <section data-tour="mapping" className="rounded border border-black/10 bg-white p-4 shadow-panel">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/70">Field Mapping</h2>
          <p className="text-xs text-ink/60">Review suggested mappings before scoring.</p>
        </div>
        <button
          data-tour="score"
          className="inline-flex items-center gap-2 rounded bg-moss px-3 py-2 text-sm font-semibold text-white hover:bg-moss/90 disabled:cursor-not-allowed disabled:bg-black/25"
          disabled={!canScore || duplicateTargets.length > 0}
          onClick={onScore}
          title="Confirm mapping and score"
        >
          <Check size={16} aria-hidden="true" />
          Confirm & Score
        </button>
      </div>
      {!marketConfirmed && (
        <div className="mb-3 flex items-center gap-2 rounded border border-butter/60 bg-butter/20 px-3 py-2 text-sm">
          <AlertTriangle size={16} aria-hidden="true" />
          Confirm market inputs before scoring.
        </div>
      )}
      {duplicateTargets.length > 0 && (
        <div className="mb-3 rounded border border-coral/30 bg-coral/10 px-3 py-2 text-sm text-coral">
          Duplicate mappings: {duplicateTargets.map((target) => CANONICAL_FIELD_LABELS[target as keyof typeof CANONICAL_FIELD_LABELS] ?? target).join(", ")}
        </div>
      )}
      <div className="max-h-[460px] overflow-auto rounded border border-black/10 scrollbar-thin">
        <table className="min-w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 bg-cloud">
            <tr>
              <th className="border-b border-black/10 px-3 py-2">Source</th>
              <th className="border-b border-black/10 px-3 py-2">Mapping</th>
              <th className="border-b border-black/10 px-3 py-2">Confidence</th>
              <th className="border-b border-black/10 px-3 py-2">Examples</th>
              <th className="border-b border-black/10 px-3 py-2">Note</th>
            </tr>
          </thead>
          <tbody>
            {mappings.map((mapping, index) => (
              <tr key={mapping.source} className="odd:bg-white even:bg-cloud/60">
                <td className="border-b border-black/5 px-3 py-2 font-medium">{mapping.source}</td>
                <td className="border-b border-black/5 px-3 py-2">
                  <select
                    className="w-56 rounded border border-black/15 bg-white px-2 py-1"
                    value={mapping.confirmedTarget}
                    onChange={(event) =>
                      setMappings((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, confirmedTarget: event.target.value as FieldMapping["confirmedTarget"] } : item,
                        ),
                      )
                    }
                  >
                    {FIELD_OPTIONS.map((option) => (
                      <option key={option.value || "unmapped"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="border-b border-black/5 px-3 py-2">
                  <span className={`rounded px-2 py-1 font-semibold ${confidenceClass(mapping.confidence)}`}>{mapping.confidence}</span>
                </td>
                <td className="max-w-52 truncate border-b border-black/5 px-3 py-2 text-ink/70">{mapping.examples.join(", ")}</td>
                <td className="max-w-80 border-b border-black/5 px-3 py-2 text-ink/70">
                  {mapping.reason}
                  {mapping.warning ? <span className="ml-1 font-semibold text-coral">{mapping.warning}</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function QualityPanel({ quality }: { quality: DataQualityReport }) {
  const missing = Object.entries(quality.missingCriticalCounts).filter(([, count]) => count > 0);
  return (
    <section data-tour="quality" className="rounded border border-black/10 bg-white p-4 shadow-panel">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/70">Data Quality</h2>
        <div className="flex flex-wrap gap-2 text-sm">
          <MetricPill label="Valid" value={quality.validRows.toLocaleString()} />
          <MetricPill label="Suppressed" value={quality.suppressedRows.toLocaleString()} />
          <MetricPill label="Missing equity" value={quality.missingEquityRows.toLocaleString()} />
          <MetricPill label="Duplicates" value={quality.duplicateHouseholds.toLocaleString()} />
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-4">
        <MiniDistribution title="FICO" data={quality.distributions.fico} />
        <MiniDistribution title="Rate" data={quality.distributions.rate} />
        <MiniDistribution title="Balance" data={quality.distributions.balance} />
        <MiniDistribution title="Debt" data={quality.distributions.debt} />
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <InfoList title="Missing critical fields" items={missing.map(([field, count]) => `${field}: ${count.toLocaleString()}`)} fallback="No critical gaps" />
        <InfoList title="Lenders" items={quality.lenderBreakdown.map((item) => `${item.name}: ${item.count.toLocaleString()}`)} fallback="No lender field" />
        <InfoList title="Spread warnings" items={quality.inertFactorWarnings} fallback="Scoring factors have usable spread" />
      </div>
    </section>
  );
}

function DashboardPanel({
  dashboard,
  scored,
  quality,
}: {
  dashboard: ReturnType<typeof buildDashboard>;
  scored: ScoredRecord[];
  quality: DataQualityReport | null;
}) {
  return (
    <section data-tour="dashboard" className="rounded border border-black/10 bg-white p-4 shadow-panel">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/70">Dashboard</h2>
        <div className="flex flex-wrap gap-2 text-sm">
          <MetricPill label="Avg score" value={dashboard.avgScore.toFixed(1)} />
          <MetricPill label="Watchlist balance" value={formatCurrency(dashboard.watchlistBalance)} />
          <MetricPill label="Rate window" value={dashboard.rateWindow} />
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="h-72 rounded border border-black/10 p-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dashboard.counts}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e5dc" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={70} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {dashboard.counts.map((entry) => (
                  <Cell key={entry.name} fill={OPPORTUNITY_COLORS[entry.name] ?? "#65786e"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <SegmentSummary title="Top Segments" items={dashboard.counts.slice(0, 5).map((item) => `${item.name}: ${item.count.toLocaleString()}`)} />
          <SegmentSummary
            title="Compliance"
            items={[
              `Suppressed: ${(quality?.suppressedRows ?? 0).toLocaleString()}`,
              `Equity unconfirmed: ${scored.filter((row) => row.complianceFlags.includes("Equity unconfirmed - verify")).length.toLocaleString()}`,
              `DNC unverified: ${scored.filter((row) => row.complianceFlags.includes("DNC status unverified")).length.toLocaleString()}`,
            ]}
          />
        </div>
      </div>
    </section>
  );
}

function LeadTablePanel({
  records,
  filters,
  setFilters,
  sort,
  setSort,
  selectedId,
  onSelect,
}: {
  records: ScoredRecord[];
  filters: Filters;
  setFilters: (next: Filters | ((current: Filters) => Filters)) => void;
  sort: { key: SortKey; direction: "asc" | "desc" };
  setSort: (sort: { key: SortKey; direction: "asc" | "desc" }) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const opportunities = ["All", "Rate-Term Refi", "Second-Lien Equity", "Cash-Out Refi", "VA IRRRL", "VA Cash-Out", "Watchlist", "Watchlist (VA)", "Low Priority", "Suppress"];
  return (
    <section data-tour="lead-table" className="rounded border border-black/10 bg-white p-4 shadow-panel">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Filter size={16} aria-hidden="true" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/70">Lead Table</h2>
        </div>
        <span className="text-sm font-medium text-ink/70">{records.length.toLocaleString()} records</span>
      </div>
      <div className="mb-3 grid gap-2 md:grid-cols-4 xl:grid-cols-8">
        <label className="text-xs font-medium text-ink/70">
          Opportunity
          <select
            className="mt-1 w-full rounded border border-black/15 bg-white px-2 py-2 text-sm"
            value={filters.opportunity}
            onChange={(event) => setFilters((current) => ({ ...current, opportunity: event.target.value as Filters["opportunity"] }))}
          >
            {opportunities.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <NumberFilter label="Min score" value={filters.minScore} onChange={(value) => setFilters((current) => ({ ...current, minScore: value }))} />
        <TextFilter label="FICO min" value={filters.ficoMin} onChange={(value) => setFilters((current) => ({ ...current, ficoMin: value }))} />
        <TextFilter label="FICO max" value={filters.ficoMax} onChange={(value) => setFilters((current) => ({ ...current, ficoMax: value }))} />
        <TextFilter label="Rate min" value={filters.rateMin} onChange={(value) => setFilters((current) => ({ ...current, rateMin: value }))} />
        <TextFilter label="Rate max" value={filters.rateMax} onChange={(value) => setFilters((current) => ({ ...current, rateMax: value }))} />
        <TextFilter label="Debt min" value={filters.debtMin} onChange={(value) => setFilters((current) => ({ ...current, debtMin: value }))} />
        <label className="text-xs font-medium text-ink/70">
          Suppression
          <select
            className="mt-1 w-full rounded border border-black/15 bg-white px-2 py-2 text-sm"
            value={filters.suppression}
            onChange={(event) => setFilters((current) => ({ ...current, suppression: event.target.value as Filters["suppression"] }))}
          >
            <option value="exclude">Exclude</option>
            <option value="include">Include</option>
            <option value="only">Only</option>
          </select>
        </label>
      </div>
      <div className="mb-3 grid gap-2 md:grid-cols-2">
        <SearchInput label="Lender" value={filters.lender} onChange={(value) => setFilters((current) => ({ ...current, lender: value }))} />
        <SearchInput label="City / ZIP" value={filters.place} onChange={(value) => setFilters((current) => ({ ...current, place: value }))} />
      </div>
      <div className="max-h-[680px] overflow-auto rounded border border-black/10 scrollbar-thin">
        <table className="min-w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 bg-cloud">
            <tr>
              <SortHeader label="Score" sortKey="refiScore" sort={sort} setSort={setSort} />
              <SortHeader label="Opportunity" sortKey="opportunityType" sort={sort} setSort={setSort} />
              <SortHeader label="FICO" sortKey="fico" sort={sort} setSort={setSort} />
              <SortHeader label="Rate" sortKey="currentMortgageRate" sort={sort} setSort={setSort} />
              <SortHeader label="Balance" sortKey="highestMortgageBalance" sort={sort} setSort={setSort} />
              <SortHeader label="Debt" sortKey="debt" sort={sort} setSort={setSort} />
              <SortHeader label="Lender" sortKey="currentLender" sort={sort} setSort={setSort} />
              <SortHeader label="City" sortKey="city" sort={sort} setSort={setSort} />
              <th className="min-w-72 border-b border-black/10 px-3 py-2 font-semibold">Explanation</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr
                key={record.id}
                className={`cursor-pointer border-b border-black/5 hover:bg-mint/60 ${selectedId === record.id ? "bg-mint" : "odd:bg-white even:bg-cloud/60"}`}
                onClick={() => onSelect(record.id)}
              >
                <td className="px-3 py-2 font-semibold">{record.refiScore.toFixed(1)}</td>
                <td className="px-3 py-2">
                  <span className="rounded px-2 py-1 font-semibold text-white" style={{ backgroundColor: OPPORTUNITY_COLORS[record.opportunityType] ?? "#65786e" }}>
                    {record.opportunityType}
                  </span>
                </td>
                <td className="px-3 py-2">{record.fico ?? ""}</td>
                <td className="px-3 py-2">{formatPct(record.currentMortgageRate)}</td>
                <td className="px-3 py-2">{formatCurrency(record.highestMortgageBalance)}</td>
                <td className="px-3 py-2">{formatCurrency(getDebt(record))}</td>
                <td className="max-w-44 truncate px-3 py-2">{record.currentLender ?? ""}</td>
                <td className="max-w-36 truncate px-3 py-2">{[record.city, record.zip].filter(Boolean).join(" ")}</td>
                <td className="max-w-96 px-3 py-2 text-ink/75">{record.explanation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DetailPanel({ record }: { record: ScoredRecord | null }) {
  if (!record) {
    return (
      <section data-tour="detail" className="rounded border border-black/10 bg-white p-4 shadow-panel">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/70">Record Detail</h2>
      </section>
    );
  }

  return (
    <section data-tour="detail" className="rounded border border-black/10 bg-white p-4 shadow-panel 2xl:sticky 2xl:top-4 2xl:max-h-[calc(100vh-2rem)] 2xl:overflow-auto">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/70">Record Detail</h2>
          <p className="mt-1 text-lg font-semibold">{[record.firstName, record.lastName].filter(Boolean).join(" ") || `Row ${record.sourceIndex + 1}`}</p>
          <p className="text-sm text-ink/60">{[record.addressLine1, record.city, record.state, record.zip].filter(Boolean).join(", ")}</p>
        </div>
        <span className="rounded px-2 py-1 text-xs font-semibold text-white" style={{ backgroundColor: OPPORTUNITY_COLORS[record.opportunityType] ?? "#65786e" }}>
          {record.opportunityType}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <MetricPill label="Score" value={record.refiScore.toFixed(1)} />
        <MetricPill label="Likelihood" value={record.closeLikelihood} />
        <MetricPill label="Rate delta" value={formatPct(record.rateDelta)} />
        <MetricPill label="Offer rate" value={formatPct(record.offerRateAtScoring)} />
      </div>

      <div className="mt-4 rounded border border-black/10 p-3">
        <h3 className="mb-2 text-sm font-semibold">Score Breakdown</h3>
        <div className="space-y-2">
          {record.factors.map((factor) => (
            <div key={factor.label}>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium">{factor.label}</span>
                <span>
                  {factor.score}/{factor.max}
                </span>
              </div>
              <div className="mt-1 h-2 rounded bg-black/10">
                <div className="h-2 rounded bg-moss" style={{ width: `${factor.max ? Math.min((factor.score / factor.max) * 100, 100) : 0}%` }} />
              </div>
              <p className="mt-1 text-xs text-ink/60">{factor.note}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded border border-black/10 p-3">
        <h3 className="mb-2 text-sm font-semibold">Blended-Cost Comparison</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <MetricPill label="Status quo" value={formatCurrency(record.equity.statusQuoMonthly)} />
          <MetricPill label="Cash needed" value={formatCurrency(record.equity.cashNeeded)} />
          <MetricPill label="Cash-out refi" value={formatCurrency(record.equity.cashoutMonthly)} />
          <MetricPill label="Second lien total" value={formatCurrency(record.equity.secondLienStructureMonthly)} />
          <MetricPill label="Best monthly delta" value={formatCurrency(record.equity.monthlyDelta)} />
          <MetricPill label="Equity" value={record.equityConfirmed ? "Confirmed" : "Unconfirmed"} />
        </div>
        {record.equity.notes.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs text-ink/65">
            {record.equity.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 rounded border border-black/10 p-3">
        <h3 className="mb-2 text-sm font-semibold">Marketing</h3>
        <p className="text-sm font-medium">{record.recommendedChannel}</p>
        <p className="mt-1 text-sm text-ink/70">{record.marketingAngle}</p>
        <p className="mt-2 text-xs text-ink/55">{record.savingsDisclaimer}</p>
      </div>

      <div className="mt-4 rounded border border-black/10 p-3">
        <h3 className="mb-2 text-sm font-semibold">Compliance Flags</h3>
        {record.complianceFlags.length ? (
          <div className="flex flex-wrap gap-2">
            {record.complianceFlags.map((flag) => (
              <span key={flag} className="rounded bg-butter/30 px-2 py-1 text-xs font-medium">
                {flag}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink/60">No row-level flags.</p>
        )}
      </div>
    </section>
  );
}

function ExportPanel({ records, onClose, onExport }: { records: ScoredRecord[]; onClose: () => void; onExport: () => void }) {
  const suppressed = records.filter((record) => record.opportunityType === "Suppress").length;
  const missingConsent = records.filter((record) => record.complianceFlags.some((flag) => flag.includes("consent"))).length;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
      <section className="w-full max-w-lg rounded border border-black/10 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Export Filtered Leads</h2>
          <button className="rounded p-1 hover:bg-cloud" onClick={onClose} title="Close">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <MetricPill label="Records" value={records.length.toLocaleString()} />
          <MetricPill label="Suppressed" value={suppressed.toLocaleString()} />
          <MetricPill label="Missing consent" value={missingConsent.toLocaleString()} />
        </div>
        <p className="mt-4 rounded border border-butter/60 bg-butter/20 px-3 py-2 text-sm">
          Estimate for internal prioritization only. Not an offer, quote, or guarantee of savings or eligibility. Subject to full underwriting and current pricing.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded border border-black/15 bg-white px-3 py-2 text-sm font-medium hover:bg-cloud" onClick={onClose}>
            Cancel
          </button>
          <button className="inline-flex items-center gap-2 rounded bg-moss px-3 py-2 text-sm font-semibold text-white hover:bg-moss/90" onClick={onExport}>
            <Download size={16} aria-hidden="true" />
            Download CSV
          </button>
        </div>
      </section>
    </div>
  );
}

function EmptyState() {
  return (
    <section className="flex min-h-[520px] items-center justify-center rounded border border-black/10 bg-white p-8 shadow-panel">
      <div className="max-w-xl text-center">
        <FileSpreadsheet className="mx-auto mb-4 text-moss" size={42} aria-hidden="true" />
        <h2 className="text-2xl font-semibold">Upload a mortgage file</h2>
        <p className="mt-2 text-ink/65">The app will parse the file, ask you to confirm field mappings, then score every record locally.</p>
      </div>
    </section>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  prefix,
  suffix,
  step = 0.1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
}) {
  return (
    <label className="text-xs font-medium text-ink/70">
      {label}
      <div className="mt-1 flex items-center rounded border border-black/15 bg-white px-2 py-1">
        {prefix && <span className="text-ink/50">{prefix}</span>}
        <input
          className="min-w-0 flex-1 border-0 bg-transparent px-1 py-1 text-sm outline-none"
          type="number"
          step={step}
          value={Number.isFinite(value) ? value : 0}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        {suffix && <span className="text-ink/50">{suffix}</span>}
      </div>
    </label>
  );
}

function NumberFilter({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="text-xs font-medium text-ink/70">
      {label}
      <input className="mt-1 w-full rounded border border-black/15 bg-white px-2 py-2 text-sm" type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function TextFilter({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="text-xs font-medium text-ink/70">
      {label}
      <input className="mt-1 w-full rounded border border-black/15 bg-white px-2 py-2 text-sm" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SearchInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="text-xs font-medium text-ink/70">
      {label}
      <div className="mt-1 flex items-center rounded border border-black/15 bg-white px-2">
        <Search size={15} className="text-ink/50" aria-hidden="true" />
        <input className="min-w-0 flex-1 border-0 bg-transparent px-2 py-2 text-sm outline-none" value={value} onChange={(event) => onChange(event.target.value)} />
      </div>
    </label>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-black/10 bg-cloud px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink/50">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

function MiniDistribution({ title, data }: { title: string; data: { label: string; count: number }[] }) {
  return (
    <div className="h-44 rounded border border-black/10 p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/60">{title}</h3>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={data}>
          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
          <YAxis hide allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#325246" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function InfoList({ title, items, fallback }: { title: string; items: string[]; fallback: string }) {
  return (
    <div className="rounded border border-black/10 p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/60">{title}</h3>
      {items.length ? (
        <ul className="space-y-1 text-sm text-ink/70">
          {items.slice(0, 8).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink/60">{fallback}</p>
      )}
    </div>
  );
}

function SegmentSummary({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded border border-black/10 p-3">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <ul className="space-y-2 text-sm text-ink/70">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  sort,
  setSort,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; direction: "asc" | "desc" };
  setSort: (sort: { key: SortKey; direction: "asc" | "desc" }) => void;
}) {
  const active = sort.key === sortKey;
  return (
    <th className="border-b border-black/10 px-3 py-2 font-semibold">
      <button
        className="inline-flex items-center gap-1 hover:text-moss"
        onClick={() => setSort({ key: sortKey, direction: active && sort.direction === "desc" ? "asc" : "desc" })}
      >
        {label}
        {active ? sort.direction === "desc" ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronUp size={14} aria-hidden="true" /> : null}
      </button>
    </th>
  );
}

async function parseFile(file: File): Promise<ParsedUpload> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "csv") {
    return new Promise((resolve, reject) => {
      Papa.parse<RawRow>(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        complete: (results) => {
          const rows = results.data.filter((row) => Object.values(row).some((value) => String(value ?? "").trim() !== ""));
          const columns = collectColumns(rows, results.meta.fields ?? []);
          resolve({ fileName: file.name, rows, columns, preview: rows.slice(0, 20) });
        },
        error: (error) => reject(error),
      });
    });
  }

  if (extension === "xlsx") {
    const sheetRows = (await readSheet(file)) as CellValue[][];
    if (!sheetRows.length) {
      return { fileName: file.name, rows: [], columns: [], preview: [] };
    }
    const headers = uniqueHeaders(
      sheetRows[0].map((cell, index) => {
        const value = String(cell ?? "").trim();
        return value || `Column ${index + 1}`;
      }),
    );
    const rows = sheetRows
      .slice(1)
      .map((cells) =>
        headers.reduce<RawRow>((row, header, index) => {
          row[header] = cells[index] ?? "";
          return row;
        }, {}),
      )
      .filter((row) => Object.values(row).some((value) => String(value ?? "").trim() !== ""));
    return { fileName: file.name, rows, columns: collectColumns(rows), preview: rows.slice(0, 20) };
  }

  throw new Error("Upload a CSV or XLSX file.");
}

function collectColumns(rows: RawRow[], initial: string[] = []) {
  const columns = new Set(initial.filter(Boolean));
  for (const row of rows.slice(0, 200)) {
    for (const key of Object.keys(row)) columns.add(key);
  }
  return Array.from(columns);
}

function uniqueHeaders(headers: string[]) {
  const counts = new Map<string, number>();
  return headers.map((header) => {
    const count = counts.get(header) ?? 0;
    counts.set(header, count + 1);
    return count === 0 ? header : `${header}_${count + 1}`;
  });
}

async function fetchFredSeries(seriesId: string, apiKey: string) {
  const url = new URL("https://api.stlouisfed.org/fred/series/observations");
  url.searchParams.set("series_id", seriesId);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("sort_order", "desc");
  url.searchParams.set("limit", "2");
  const response = await fetch(url);
  if (!response.ok) throw new Error("FRED request failed");
  const json = (await response.json()) as { observations: Array<{ date: string; value: string }> };
  const valid = json.observations.filter((item) => item.value !== ".").map((item) => ({ date: item.date, value: Number(item.value) }));
  if (!valid.length || !Number.isFinite(valid[0].value)) throw new Error("No FRED value");
  return {
    date: valid[0].date,
    value: valid[0].value,
    previousValue: valid[1]?.value,
  };
}

function filterAndSort(records: ScoredRecord[], filters: Filters, sort: { key: SortKey; direction: "asc" | "desc" }) {
  const parsed = {
    ficoMin: toOptionalNumber(filters.ficoMin),
    ficoMax: toOptionalNumber(filters.ficoMax),
    rateMin: toOptionalNumber(filters.rateMin),
    rateMax: toOptionalNumber(filters.rateMax),
    debtMin: toOptionalNumber(filters.debtMin),
  };
  const filtered = records.filter((record) => {
    if (filters.opportunity !== "All" && record.opportunityType !== filters.opportunity) return false;
    if (record.refiScore < filters.minScore) return false;
    if (parsed.ficoMin != null && (record.fico ?? -Infinity) < parsed.ficoMin) return false;
    if (parsed.ficoMax != null && (record.fico ?? Infinity) > parsed.ficoMax) return false;
    if (parsed.rateMin != null && (record.currentMortgageRate ?? -Infinity) < parsed.rateMin) return false;
    if (parsed.rateMax != null && (record.currentMortgageRate ?? Infinity) > parsed.rateMax) return false;
    if (parsed.debtMin != null && (getDebt(record) ?? -Infinity) < parsed.debtMin) return false;
    if (filters.lender && !String(record.currentLender ?? "").toLowerCase().includes(filters.lender.toLowerCase())) return false;
    if (filters.place) {
      const place = [record.city, record.state, record.zip].filter(Boolean).join(" ").toLowerCase();
      if (!place.includes(filters.place.toLowerCase())) return false;
    }
    if (filters.suppression === "exclude" && record.opportunityType === "Suppress") return false;
    if (filters.suppression === "only" && record.opportunityType !== "Suppress") return false;
    return true;
  });

  return [...filtered].sort((a, b) => {
    const direction = sort.direction === "asc" ? 1 : -1;
    return compare(sortValue(a, sort.key), sortValue(b, sort.key)) * direction;
  });
}

function sortValue(record: ScoredRecord, key: SortKey) {
  if (key === "debt") return getDebt(record) ?? 0;
  return record[key] ?? "";
}

function compare(a: string | number, b: string | number) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

function buildDashboard(records: ScoredRecord[], market: MarketInputs) {
  const counts = Array.from(
    records.reduce((map, record) => map.set(record.opportunityType, (map.get(record.opportunityType) ?? 0) + 1), new Map<string, number>()),
  )
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  const avgScore = records.length ? records.reduce((sum, record) => sum + record.refiScore, 0) / records.length : 0;
  const watchlistBalance = records
    .filter((record) => record.opportunityType === "Watchlist" || record.opportunityType === "Watchlist (VA)")
    .reduce((sum, record) => sum + (record.highestMortgageBalance ?? 0), 0);
  return {
    counts,
    avgScore,
    watchlistBalance,
    rateWindow: refiWindow(market.weeklyChange30y),
  };
}

function getDebt(record: ScoredRecord) {
  return record.bankcardDebt ?? record.combinedDebt ?? record.revolvingDebt ?? null;
}

function refiWindow(weeklyChange: number) {
  if (weeklyChange <= -0.5) return "Hot";
  if (weeklyChange <= -0.25) return "Active";
  if (weeklyChange <= -0.1) return "Watch";
  return "Cold";
}

function windowClass(window: string) {
  if (window === "Hot") return "bg-coral text-white";
  if (window === "Active") return "bg-butter text-ink";
  if (window === "Watch") return "bg-mint text-moss";
  return "bg-black/10 text-ink/70";
}

function confidenceClass(confidence: string) {
  if (confidence === "high") return "bg-mint text-moss";
  if (confidence === "medium") return "bg-butter/50 text-ink";
  if (confidence === "low") return "bg-coral/15 text-coral";
  return "bg-black/10 text-ink/60";
}

function shortWeightLabel(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase())
    .replace("Refinance", "Refi")
    .replace("Opportunity", "Opp.");
}

function toOptionalNumber(value: string) {
  if (!value.trim()) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatCurrency(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatPct(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "";
  return `${value.toFixed(2)}%`;
}

function round(value: number, decimals = 2) {
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getRoutePath() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const path = window.location.pathname;
  if (base && path.startsWith(base)) {
    return path.slice(base.length) || "/";
  }
  return path;
}
