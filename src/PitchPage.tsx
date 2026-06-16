import { useEffect, useRef } from "react";
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  FileSearch,
  Gauge,
  Layers3,
  LineChart,
  LockKeyhole,
  MousePointerClick,
  Rocket,
  ShieldCheck,
  Sparkles,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";

const signals = [
  "Rate-term candidates",
  "Second-lien equity",
  "HELOC fit",
  "Watchlist volume",
  "Compliance flags",
  "Lender conquesting",
];

const workstreams = [
  {
    icon: FileSearch,
    title: "Research the market",
    copy: "Swarm agents track product pages, competitors, funnel language, rates, and customer intent so strategy starts from evidence.",
  },
  {
    icon: BrainCircuit,
    title: "Build intelligence tools",
    copy: "Turn purchased credit and mortgage data into ranked, explainable segments that a loan team can actually act on.",
  },
  {
    icon: Workflow,
    title: "Automate follow-through",
    copy: "Create dashboards, landing-page variants, campaign exports, QA checks, and rate-triggered workflows without waiting on a full dev queue.",
  },
  {
    icon: ShieldCheck,
    title: "Validate before launch",
    copy: "Every recommendation gets a math trail, compliance flags, and a review loop before it reaches borrowers or ad platforms.",
  },
];

const deliverables = [
  "Mortgage/refi lead intelligence app",
  "HELOC and home-equity campaign pages",
  "Rate-drop watchlist activations",
  "Customer-match audience exports",
  "Compliance-aware message libraries",
  "Scenario simulator for rate movement",
];

export default function PitchPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#050807] text-white">
      <PitchHero />
      <section id="what-ships" className="relative z-10 border-y border-white/10 bg-[#07100d] px-5 py-14 md:px-8">
        <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-[0.9fr_1.1fr] md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#f7d36b]">For Ian Isaacson</p>
            <h2 className="mt-4 text-3xl font-semibold md:text-5xl">A digital mortgage company needs more than a prettier application.</h2>
            <p className="mt-4 text-base leading-7 text-white/68">
              It needs intelligence behind the funnel: knowing who to contact, what product actually fits, when rates create movement, and which digital path should catch that borrower.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Digital mortgage", "Sharper application paths for HELOC, refinance, VA, FHA, and purchase funnels."],
              ["Data intelligence", "Purchased lists become explainable opportunity queues, not static spreadsheets."],
              ["Speed to launch", "New tools, pages, and experiments ship in days instead of quarters."],
              ["Safer marketing", "Savings estimates, suppression flags, and copy rules stay visible before export."],
            ].map(([title, copy]) => (
              <article key={title} className="rounded border border-white/10 bg-white/[0.045] p-4 shadow-2xl shadow-black/20 backdrop-blur">
                <h3 className="font-semibold text-[#f7d36b]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/72">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 bg-[#f7f8f5] px-5 py-16 text-[#17211d] md:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#c84f31]">Sulphur AI Swarm</p>
            <h2 className="mt-4 text-3xl font-semibold md:text-5xl">Not one assistant. A coordinated build team.</h2>
            <p className="mt-4 text-lg leading-8 text-[#17211d]/70">
              Ian, this is the part that matters: Sulphur can turn a business idea into working mortgage software with research, planning, implementation, validation, and deployment moving in parallel.
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {workstreams.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="group rounded border border-black/10 bg-white p-5 shadow-panel transition duration-300 hover:-translate-y-1 hover:shadow-xl">
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-[#325246] text-white">
                    <Icon size={20} aria-hidden="true" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#17211d]/68">{item.copy}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative z-10 bg-[#07100d] px-5 py-16 md:px-8">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#f7d36b]">The first proof</p>
            <h2 className="mt-4 text-3xl font-semibold md:text-5xl">RefiSignal turns mortgage lists into ranked action.</h2>
            <p className="mt-4 text-lg leading-8 text-white/70">
              The first app already ingests borrower files, confirms mappings, normalizes rates, avoids bad cash-out recommendations, identifies second-lien opportunities, and exports channel-ready segments. That is the kind of operating system a digital mortgage company should be built around.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                className="inline-flex items-center gap-2 rounded bg-[#f7d36b] px-4 py-3 text-sm font-semibold text-[#17211d] transition hover:bg-white"
                href="./"
              >
                Open RefiSignal
                <ArrowRight size={16} aria-hidden="true" />
              </a>
              <a
                className="inline-flex items-center gap-2 rounded border border-white/20 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                href="https://sulphur.technology/"
              >
                Visit Sulphur
                <Sparkles size={16} aria-hidden="true" />
              </a>
            </div>
          </div>
          <div className="rounded border border-white/10 bg-white/[0.045] p-4 shadow-2xl shadow-black/30">
            <div className="rounded bg-[#0c1713] p-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="text-sm font-semibold text-white/72">Opportunity mix</span>
                <span className="rounded bg-[#325246] px-2 py-1 text-xs font-semibold text-white">Live model</span>
              </div>
              <div className="mt-4 space-y-3">
                {[
                  ["Watchlist", "66%", "#65786e"],
                  ["Second-lien equity", "24%", "#f7d36b"],
                  ["Rate-term tail", "3%", "#2c7a5b"],
                  ["Suppress / verify", "7%", "#c84f31"],
                ].map(([label, value, color]) => (
                  <div key={label}>
                    <div className="mb-1 flex justify-between text-xs text-white/66">
                      <span>{label}</span>
                      <span>{value}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded bg-white/10">
                      <div className="h-full rounded" style={{ width: value, backgroundColor: color }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded border border-[#f7d36b]/30 bg-[#f7d36b]/10 p-3 text-sm leading-6 text-[#f7d36b]">
                Low-rate first mortgages stay protected. Equity plays route to second liens only when the blended-cost math clears the gate.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 bg-[#f7f8f5] px-5 py-16 text-[#17211d] md:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#c84f31]">What I can ship next</p>
              <h2 className="mt-4 text-3xl font-semibold md:text-5xl">A digital mortgage launch stack for Ian and USAloans.</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {deliverables.map((item) => (
                <div key={item} className="flex items-center gap-3 rounded border border-black/10 bg-white p-4 shadow-panel">
                  <CheckCircle2 className="shrink-0 text-[#325246]" size={20} aria-hidden="true" />
                  <span className="text-sm font-semibold">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-10 rounded border border-black/10 bg-[#17211d] p-6 text-white md:p-8">
            <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#f7d36b]">The offer</p>
                <h2 className="mt-3 text-2xl font-semibold md:text-4xl">Ian brings the mortgage vision. Sulphur turns it into working software, live funnels, and measurable borrower intelligence.</h2>
              </div>
              <a
                className="inline-flex items-center justify-center gap-2 rounded bg-[#f7d36b] px-5 py-3 text-sm font-semibold text-[#17211d] transition hover:bg-white"
                href="mailto:sulphur@hamilton.garden?subject=USAloans%20AI%20growth%20system"
              >
                Start the build
                <Rocket size={17} aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function PitchHero() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let frame = 0;
    let animation = 0;
    let width = 0;
    let height = 0;
    const particles = Array.from({ length: 54 }, (_, index) => ({
      x: Math.random(),
      y: Math.random(),
      r: 1.2 + Math.random() * 2.8,
      speed: 0.16 + Math.random() * 0.42,
      phase: index * 0.41,
    }));

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const draw = () => {
      frame += 0.012;
      context.clearRect(0, 0, width, height);
      const gradient = context.createRadialGradient(width * 0.7, height * 0.24, 0, width * 0.7, height * 0.24, Math.max(width, height));
      gradient.addColorStop(0, "rgba(247, 211, 107, 0.2)");
      gradient.addColorStop(0.32, "rgba(50, 82, 70, 0.2)");
      gradient.addColorStop(1, "rgba(5, 8, 7, 0)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);

      for (const particle of particles) {
        const x = particle.x * width + Math.sin(frame * particle.speed + particle.phase) * 24;
        const y = particle.y * height + Math.cos(frame * particle.speed + particle.phase) * 20;
        context.beginPath();
        context.arc(x, y, particle.r, 0, Math.PI * 2);
        context.fillStyle = "rgba(247, 211, 107, 0.58)";
        context.fill();
      }

      for (let i = 0; i < particles.length; i += 1) {
        for (let j = i + 1; j < particles.length; j += 1) {
          const ax = particles[i].x * width + Math.sin(frame * particles[i].speed + particles[i].phase) * 24;
          const ay = particles[i].y * height + Math.cos(frame * particles[i].speed + particles[i].phase) * 20;
          const bx = particles[j].x * width + Math.sin(frame * particles[j].speed + particles[j].phase) * 24;
          const by = particles[j].y * height + Math.cos(frame * particles[j].speed + particles[j].phase) * 20;
          const distance = Math.hypot(ax - bx, ay - by);
          if (distance < 130) {
            context.strokeStyle = `rgba(230, 244, 237, ${0.16 - distance / 900})`;
            context.lineWidth = 1;
            context.beginPath();
            context.moveTo(ax, ay);
            context.lineTo(bx, by);
            context.stroke();
          }
        }
      }

      animation = window.requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener("resize", resize);
    return () => {
      window.cancelAnimationFrame(animation);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <section className="relative min-h-screen overflow-hidden px-5 py-5 md:px-8">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,8,7,0.98)_0%,rgba(5,8,7,0.86)_42%,rgba(5,8,7,0.38)_100%)]" />

      <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between">
        <a className="flex items-center gap-3" href="./usaloans-pitch/">
          <span className="flex h-10 w-10 items-center justify-center rounded bg-[#f7d36b] text-[#17211d]">
            <Sparkles size={20} aria-hidden="true" />
          </span>
        <span className="text-sm font-semibold uppercase tracking-[0.28em] text-white/82">For Ian Isaacson</span>
        </a>
        <a className="hidden rounded border border-white/20 px-4 py-2 text-sm font-semibold text-white/86 transition hover:bg-white/10 sm:inline-flex" href="./">
          View app
        </a>
      </nav>

      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-88px)] max-w-7xl items-center gap-10 py-12 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#f7d36b]/40 bg-[#f7d36b]/10 px-3 py-2 text-sm font-semibold text-[#f7d36b]">
            <Zap size={15} aria-hidden="true" />
            Purpose-built for a digital mortgage company
          </div>
          <h1 className="mt-6 max-w-3xl text-5xl font-semibold leading-[1.02] md:text-6xl xl:text-7xl">
            Ian, let’s build the digital mortgage company you’re imagining.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/72 md:text-xl">
            Using Sulphur’s autonomous multi-agent engineering system, I can research, build, test, and deploy the tools that connect USAloans’ digital funnels to real borrower intelligence.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a className="inline-flex items-center gap-2 rounded bg-[#f7d36b] px-5 py-3 text-sm font-semibold text-[#17211d] transition hover:bg-white" href="#what-ships">
              See what ships
              <ArrowRight size={16} aria-hidden="true" />
            </a>
            <a className="inline-flex items-center gap-2 rounded border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10" href="./">
              Try RefiSignal
              <MousePointerClick size={16} aria-hidden="true" />
            </a>
          </div>
        </div>

        <div className="relative min-h-[620px]">
          <div className="pitch-orbit pitch-orbit-one" />
          <div className="pitch-orbit pitch-orbit-two" />
          <div className="pitch-core">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#f7d36b] text-[#17211d] shadow-[0_0_40px_rgba(247,211,107,0.55)]">
              <BrainCircuit size={38} aria-hidden="true" />
            </div>
            <span>Sulphur AI Swarm</span>
          </div>

          {signals.map((signal, index) => (
            <div key={signal} className={`pitch-signal pitch-signal-${index + 1}`}>
              <span className="pitch-pulse" />
              {signal}
            </div>
          ))}

          <div className="pitch-dashboard">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-white/74">Ian’s mortgage growth cockpit</span>
              <span className="rounded bg-[#2c7a5b] px-2 py-1 text-xs font-semibold">online</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Metric icon={Gauge} label="Rank leads" value="19.5k" />
              <Metric icon={LineChart} label="Rate watch" value="24/7" />
              <Metric icon={LockKeyhole} label="PII local" value="safe" />
            </div>
            <div className="mt-4 space-y-2">
              {["Upload file", "Normalize fields", "Run economics", "Export segments"].map((item, index) => (
                <div key={item} className="flex items-center gap-3 rounded bg-white/8 px-3 py-2 text-sm">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#f7d36b] text-xs font-bold text-[#17211d]">{index + 1}</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pitch-card pitch-card-top">
            <Layers3 size={18} aria-hidden="true" />
            Multi-agent build lanes
          </div>
          <div className="pitch-card pitch-card-bottom">
            <ShieldCheck size={18} aria-hidden="true" />
            Validation before launch
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded bg-white/8 p-3">
      <Icon className="text-[#f7d36b]" size={18} aria-hidden="true" />
      <div className="mt-3 text-lg font-semibold">{value}</div>
      <div className="text-xs text-white/56">{label}</div>
    </div>
  );
}
