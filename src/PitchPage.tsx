import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, DollarSign, FileSpreadsheet, Target } from "lucide-react";

const proof = [
  {
    label: "Upload and map borrower files",
    text: "CSV/XLSX in, field mapping handled, records normalized in the browser.",
  },
  {
    label: "Score who is worth calling",
    text: "Rate, equity, debt, owner status, product fit, and suppression logic all become visible.",
  },
  {
    label: "Export usable campaign lists",
    text: "Ranked opportunities, detail views, and clean exports for sales or marketing follow-up.",
  },
];

const ideas = [
  "Rate-drop watchlist that wakes up borrowers when a refi becomes worth a call.",
  "HELOC and second-lien finder for people with cheap first mortgages and usable equity.",
  "Conquest lists that rank borrowers currently sitting with target lenders.",
  "Segment-specific funnels for refi, HELOC, VA, and purchase campaigns.",
  "Scenario simulator showing how many leads become active at 5.99%, 5.75%, or 5.50%.",
  "CRM-ready exports so loan officers get cleaner lists with less manual sorting.",
];

const introFrames = [
  { text: "Hi Ian \u{1F44B}", duration: 1400 },
  { text: "AI has changed the game. Felix is your guide.", duration: 2800 },
  { text: "We've built an app with the data dictionary.", duration: 2600 },
  { text: "Not a mockup. Fully working. Yours to Keep.", duration: 2800 },
  { text: "Enjoy!", duration: 1300 },
];

export default function PitchPage() {
  return (
    <main className="min-h-screen bg-white text-[#101714]">
      <IntroOverlay />
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-6 md:px-8">
        <nav className="flex items-center justify-between border-b border-black/10 pb-4">
          <a className="text-sm font-semibold tracking-wide" href="./">
            Sulphur for USAloans
          </a>
          <a className="rounded border border-black/15 px-3 py-2 text-sm font-medium hover:bg-black/[0.03]" href="./?app=refisignal">
            Open app
          </a>
        </nav>

        <div className="grid flex-1 gap-10 py-10 lg:grid-cols-[1fr_360px] lg:items-center">
          <section className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#355b4d]">Practical mortgage software</p>
            <h1 className="mt-5 text-5xl font-semibold leading-[1.02] tracking-normal md:text-7xl">
              Turn USAloans data into funded-loan opportunities.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-black/62">
              RefiSignal is the first proof: a browser-based mortgage intelligence app that turns borrower files into ranked, product-aware outreach lists.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a className="inline-flex items-center gap-2 rounded bg-[#101714] px-4 py-3 text-sm font-semibold text-white hover:bg-[#355b4d]" href="./?app=refisignal">
                View RefiSignal
                <ArrowRight size={16} aria-hidden="true" />
              </a>
              <a className="inline-flex items-center gap-2 rounded border border-black/15 px-4 py-3 text-sm font-semibold hover:bg-black/[0.03]" href="#money">
                Revenue ideas
                <DollarSign size={16} aria-hidden="true" />
              </a>
            </div>
          </section>

          <aside className="rounded border border-black/10 bg-white p-5 shadow-[0_18px_60px_rgba(16,23,20,0.06)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">RefiSignal</p>
                <p className="text-xs text-black/55">Working app, not a mockup</p>
              </div>
              <FileSpreadsheet className="text-[#355b4d]" size={24} aria-hidden="true" />
            </div>
            <div className="mt-6 space-y-2">
              {[
                ["Input", "Borrower files"],
                ["Logic", "Mortgage scoring"],
                ["Output", "Campaign exports"],
              ].map(([title, body]) => (
                <div key={title} className="flex items-start gap-3 border-t border-black/10 py-3 first:border-t-0 first:pt-0">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-[#355b4d]" size={18} aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="text-sm text-black/58">{body}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 border-t border-black/10 pt-4">
              <p className="text-sm font-semibold text-[#355b4d]">Key wedge</p>
              <p className="mt-2 text-sm leading-6 text-black/62">
                It avoids pitching cash-out refis to borrowers who should be routed toward HELOC or second-lien options instead.
              </p>
            </div>
          </aside>
        </div>

        <div id="money" className="border-t border-black/10 py-8">
          <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#355b4d]">What this app proved</p>
              <div className="mt-5 space-y-4">
                {proof.map((item) => (
                  <article key={item.label} className="border-t border-black/10 pt-4 first:border-t-0 first:pt-0">
                    <h2 className="text-lg font-semibold">{item.label}</h2>
                    <p className="mt-2 text-sm leading-6 text-black/62">{item.text}</p>
                  </article>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#355b4d]">Other ways to make money</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {ideas.map((idea) => (
                  <div key={idea} className="flex gap-3 border-t border-black/10 pt-3">
                    <Target className="mt-0.5 shrink-0 text-[#355b4d]" size={17} aria-hidden="true" />
                    <p className="text-sm leading-6 text-black/68">{idea}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-4 border-t border-black/10 pt-6 md:grid-cols-[1fr_auto] md:items-center">
            <p className="max-w-3xl text-xl font-semibold leading-8">
              The pitch: build small, sharp mortgage tools that help USAloans find better borrowers, route them to the right product, and move before competitors do.
            </p>
            <a className="inline-flex items-center justify-center gap-2 rounded bg-[#101714] px-4 py-3 text-sm font-semibold text-white hover:bg-[#355b4d]" href="mailto:sulphur@hamilton.garden?subject=USAloans%20mortgage%20growth%20tools">
              Talk next steps
              <ArrowRight size={16} aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}

function IntroOverlay() {
  const [activeFrame, setActiveFrame] = useState(0);
  const [isClosing, setIsClosing] = useState(false);
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    const timers: number[] = [];
    let elapsed = 0;

    introFrames.forEach((frame, index) => {
      if (index > 0) {
        timers.push(window.setTimeout(() => setActiveFrame(index), elapsed));
      }
      elapsed += frame.duration;
    });

    timers.push(window.setTimeout(() => setIsClosing(true), elapsed));
    timers.push(window.setTimeout(() => setIsHidden(true), elapsed + 650));

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  if (isHidden) return null;

  return (
    <div className={`pitch-intro ${isClosing ? "pitch-intro-exit" : ""}`} role="status" aria-live="polite" aria-label={introFrames[activeFrame].text}>
      <div className="pitch-intro-stage">
        {introFrames.map((frame, index) => (
          <p
            key={frame.text}
            className={`pitch-intro-line ${activeFrame === index ? "pitch-intro-line-active" : ""}`}
            style={{ animationDuration: `${frame.duration}ms` }}
          >
            {frame.text}
          </p>
        ))}
      </div>
    </div>
  );
}
