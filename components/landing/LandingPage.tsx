"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";

interface LandingPageProps {
  isLoggedIn: boolean;
}

/* ─── Intersection-observer fade-in ─────────────────────────────── */
function useFadeIn<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("landing-visible");
          observer.unobserve(el);
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

/* ─── Logo component ────────────────────────────────────────────── */
function Logo({ variant = "dark" }: { variant?: "dark" | "white" }) {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <Image
        src={variant === "white" ? "/logo-white.svg" : "/logo.svg"}
        alt=""
        width={28}
        height={28}
        className="h-7 w-7"
      />
      <span
        className="text-xl font-semibold tracking-tight"
        style={{ color: variant === "white" ? "#FFFFFF" : "#1A1A1A" }}
      >
        twix
      </span>
    </Link>
  );
}

/* ─── Navigation ────────────────────────────────────────────────── */
function Nav({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? "rgba(255,252,248,0.92)" : "transparent",
        backdropFilter: scrolled ? "blur(16px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(221,217,208,0.6)" : "1px solid transparent",
      }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Logo />

        {/* Desktop links */}
        <div className="hidden items-center gap-8 md:flex">
          <a href="#features" className="landing-nav-link">
            Features
          </a>
          <a href="#how-it-works" className="landing-nav-link">
            How it Works
          </a>
        </div>

        {/* Desktop CTA */}
        <div className="hidden items-center gap-3 md:flex">
          {isLoggedIn ? (
            <Link href="/c" className="landing-btn-primary">
              Open App
            </Link>
          ) : (
            <>
              <Link href="/login" className="landing-nav-link">
                Sign in
              </Link>
              <Link href="/register" className="landing-btn-primary">
                Get Started
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="flex h-9 w-9 items-center justify-center rounded-lg md:hidden"
          style={{ color: "#1A1A1A" }}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Menu"
        >
          {mobileOpen ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div
          className="border-t px-6 pb-6 pt-4 md:hidden"
          style={{
            background: "rgba(255,252,248,0.98)",
            borderColor: "var(--color-border)",
          }}
        >
          <div className="flex flex-col gap-4">
            <a href="#features" className="landing-nav-link" onClick={() => setMobileOpen(false)}>Features</a>
            <a href="#how-it-works" className="landing-nav-link" onClick={() => setMobileOpen(false)}>How it Works</a>
            <hr style={{ borderColor: "var(--color-border)" }} />
            {isLoggedIn ? (
              <Link href="/c" className="landing-btn-primary text-center">Open App</Link>
            ) : (
              <>
                <Link href="/login" className="landing-nav-link">Sign in</Link>
                <Link href="/register" className="landing-btn-primary text-center">Get Started</Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

/* ─── Hero ──────────────────────────────────────────────────────── */
function Hero({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <section className="relative overflow-hidden pt-32 pb-20 md:pt-44 md:pb-32">
      {/* Background glow */}
      <div className="landing-hero-glow" />

      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium landing-badge">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#D97757" }} />
            AI-powered workspace
          </div>

          <h1
            className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl"
            style={{ color: "#1A1A1A" }}
          >
            Think deeper.{" "}
            <span style={{ color: "#D97757" }}>Build faster.</span>
            <br />
            Branch freely.
          </h1>

          <p
            className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed md:text-xl"
            style={{ color: "#6B6B6B" }}
          >
            The AI workspace where conversations branch like your thoughts. Explore
            any tangent without losing context, write and run code in a live cloud
            environment, and search the web in real time.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            {isLoggedIn ? (
              <Link href="/c" className="landing-btn-primary landing-btn-lg">
                Open App
                <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            ) : (
              <>
                <Link href="/register" className="landing-btn-primary landing-btn-lg">
                  Get Started — Free
                  <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                <a href="#how-it-works" className="landing-btn-secondary landing-btn-lg">
                  See how it works
                </a>
              </>
            )}
          </div>
        </div>

        {/* Hero visual — app mockup */}
        <div className="mt-16 md:mt-20">
          <div className="landing-hero-mockup">
            <HeroMockup />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Hero mockup (CSS-only app preview) ────────────────────────── */
function HeroMockup() {
  return (
    <div className="overflow-hidden rounded-xl border shadow-2xl" style={{ background: "#FAF9F5", borderColor: "#DDD9D0" }}>
      {/* Title bar */}
      <div className="flex items-center gap-2 border-b px-4 py-3" style={{ background: "#F0EDE8", borderColor: "#DDD9D0" }}>
        <div className="flex gap-1.5">
          <div className="h-3 w-3 rounded-full" style={{ background: "#E8E4DD" }} />
          <div className="h-3 w-3 rounded-full" style={{ background: "#E8E4DD" }} />
          <div className="h-3 w-3 rounded-full" style={{ background: "#E8E4DD" }} />
        </div>
        <div className="flex-1 text-center text-xs font-medium" style={{ color: "#6B6B6B" }}>
          twix
        </div>
      </div>

      {/* App content */}
      <div className="flex" style={{ height: 360 }}>
        {/* Sidebar */}
        <div className="hidden w-52 shrink-0 border-r p-3 sm:block" style={{ background: "#F0EDE8", borderColor: "#DDD9D0" }}>
          <div className="mb-3 rounded-lg px-3 py-2 text-xs font-medium" style={{ background: "#D97757", color: "#FFF" }}>
            New conversation
          </div>
          {["Understanding React hooks", "Python data pipeline", "API design patterns"].map((t, i) => (
            <div
              key={i}
              className="rounded-lg px-3 py-2 text-xs mb-1"
              style={{
                background: i === 0 ? "rgba(217,119,87,0.1)" : "transparent",
                color: i === 0 ? "#D97757" : "#6B6B6B",
              }}
            >
              {t}
            </div>
          ))}
        </div>

        {/* Chat area */}
        <div className="flex flex-1 flex-col">
          <div className="flex-1 overflow-hidden p-4 space-y-4">
            {/* User message */}
            <div className="flex justify-end">
              <div className="max-w-xs rounded-2xl rounded-br-md px-4 py-2.5 text-sm" style={{ background: "#D97757", color: "#FFF" }}>
                Explain how React hooks work and show me an example
              </div>
            </div>
            {/* Assistant message */}
            <div className="flex justify-start">
              <div className="max-w-sm rounded-2xl rounded-bl-md px-4 py-2.5 text-sm" style={{ background: "#F0EDE8", color: "#1A1A1A" }}>
                <p className="font-medium mb-1.5">React Hooks</p>
                <p className="text-xs leading-relaxed" style={{ color: "#6B6B6B" }}>
                  Hooks let you use state and lifecycle features in function components.
                  The most common are <code className="rounded px-1 py-0.5 text-[10px]" style={{ background: "#E8E4DD" }}>useState</code> and <code className="rounded px-1 py-0.5 text-[10px]" style={{ background: "#E8E4DD" }}>useEffect</code>...
                </p>
              </div>
            </div>
            {/* Branching indicator */}
            <div className="flex items-center gap-2 pl-2">
              <div className="h-px flex-1" style={{ background: "#DDD9D0" }} />
              <span className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-medium" style={{ background: "rgba(217,119,87,0.1)", color: "#D97757" }}>
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                Tangent: useEffect deep dive
              </span>
              <div className="h-px flex-1" style={{ background: "#DDD9D0" }} />
            </div>
          </div>

          {/* Input */}
          <div className="border-t p-3" style={{ borderColor: "#DDD9D0" }}>
            <div className="flex items-center gap-2 rounded-xl border px-4 py-2.5" style={{ borderColor: "#DDD9D0", background: "#FDFCFA" }}>
              <span className="flex-1 text-xs" style={{ color: "#BDBAB0" }}>Ask anything...</span>
              <div className="h-6 w-6 rounded-lg flex items-center justify-center" style={{ background: "#D97757" }}>
                <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Tangent panel */}
        <div className="hidden w-56 shrink-0 border-l lg:block" style={{ borderColor: "#DDD9D0", background: "#FDFCFA" }}>
          <div className="border-b p-3 text-xs font-medium" style={{ borderColor: "#DDD9D0", color: "#D97757" }}>
            useEffect deep dive
          </div>
          <div className="p-3 space-y-2">
            <div className="rounded-lg px-3 py-2 text-[11px]" style={{ background: "#F0EDE8", color: "#1A1A1A" }}>
              <p style={{ color: "#6B6B6B" }} className="leading-relaxed">
                The useEffect hook runs side effects after render. Think of it as componentDidMount + componentDidUpdate combined...
              </p>
            </div>
            <div className="rounded-lg px-3 py-2 text-[10px] font-mono" style={{ background: "#1E1D1A", color: "#E8E5DC" }}>
              {`useEffect(() => {`}<br />
              {`  fetchData();`}<br />
              {`}, [deps]);`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Features ──────────────────────────────────────────────────── */
const features = [
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: "Branching Conversations",
    description:
      "Highlight any text to branch into a tangent thread. Explore ideas freely, then merge insights back. Your main conversation stays clean and focused.",
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
    title: "Cloud Dev Environment",
    description:
      "Clone repos, edit files, and run tests in a full cloud sandbox. The AI writes code, you review and iterate — all in a live Linux environment.",
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    title: "Real-time Intelligence",
    description:
      "Twix searches the web before answering, cites sources inline, and stays current. No more outdated training data — every answer is grounded in live information.",
  },
];

function Features() {
  const ref = useFadeIn<HTMLElement>();

  return (
    <section id="features" ref={ref} className="landing-fade-in py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest" style={{ color: "#D97757" }}>
            Features
          </p>
          <h2
            className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl"
            style={{ color: "#1A1A1A" }}
          >
            Everything you need to think and build
          </h2>
          <p className="mt-4 text-lg leading-relaxed" style={{ color: "#6B6B6B" }}>
            A unified workspace that combines the best of AI chat, code execution, and research — without the tab switching.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {features.map((f, i) => (
            <div key={i} className="landing-feature-card group">
              <div className="landing-feature-icon">
                {f.icon}
              </div>
              <h3 className="mt-5 text-lg font-semibold" style={{ color: "#1A1A1A" }}>
                {f.title}
              </h3>
              <p className="mt-2.5 text-sm leading-relaxed" style={{ color: "#6B6B6B" }}>
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Feature showcase (alternating rows) ───────────────────────── */
function FeatureShowcase() {
  const ref1 = useFadeIn<HTMLDivElement>();
  const ref2 = useFadeIn<HTMLDivElement>();
  const ref3 = useFadeIn<HTMLDivElement>();

  return (
    <section className="py-24 md:py-32" style={{ background: "#FDFCFA" }}>
      <div className="mx-auto max-w-6xl px-6 space-y-24 md:space-y-32">
        {/* Row 1: Branching */}
        <div ref={ref1} className="landing-fade-in grid items-center gap-12 md:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest" style={{ color: "#D97757" }}>
              Branching
            </p>
            <h3 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: "#1A1A1A" }}>
              Follow every thread of thought
            </h3>
            <p className="mt-4 leading-relaxed" style={{ color: "#6B6B6B" }}>
              Select any text in a conversation to open a tangent — a focused side thread that inherits full context from the parent. Explore rabbit holes, compare approaches, or dive into details without cluttering the main conversation.
            </p>
            <p className="mt-3 leading-relaxed" style={{ color: "#6B6B6B" }}>
              When you&apos;re done, merge your findings back with an AI-generated summary. Branch as deep as you need — tangents can spawn their own tangents.
            </p>
          </div>
          <div className="landing-showcase-visual">
            <ShowcaseBranching />
          </div>
        </div>

        {/* Row 2: Dev environment */}
        <div ref={ref2} className="landing-fade-in grid items-center gap-12 md:grid-cols-2">
          <div className="order-2 md:order-1">
            <ShowcaseCode />
          </div>
          <div className="order-1 md:order-2">
            <p className="text-sm font-semibold uppercase tracking-widest" style={{ color: "#D97757" }}>
              Development
            </p>
            <h3 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: "#1A1A1A" }}>
              A real dev environment, not a toy
            </h3>
            <p className="mt-4 leading-relaxed" style={{ color: "#6B6B6B" }}>
              Every conversation gets a cloud Linux sandbox. Clone repositories, install dependencies, edit files, and run tests — all through natural language or the built-in code editor.
            </p>
            <p className="mt-3 leading-relaxed" style={{ color: "#6B6B6B" }}>
              Edit the AI&apos;s code directly in the browser with full syntax highlighting. Run it, iterate on it, and connect via VS Code to inspect changes on your terms.
            </p>
          </div>
        </div>

        {/* Row 3: Web search */}
        <div ref={ref3} className="landing-fade-in grid items-center gap-12 md:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest" style={{ color: "#D97757" }}>
              Intelligence
            </p>
            <h3 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: "#1A1A1A" }}>
              Always current, always cited
            </h3>
            <p className="mt-4 leading-relaxed" style={{ color: "#6B6B6B" }}>
              Twix automatically searches the web when your question involves current events, recent data, or anything beyond the model&apos;s training cutoff. No manual toggling — it just knows when to search.
            </p>
            <p className="mt-3 leading-relaxed" style={{ color: "#6B6B6B" }}>
              Every claim is cited inline with clickable source links. You always know where the information came from and can verify it yourself.
            </p>
          </div>
          <div className="landing-showcase-visual">
            <ShowcaseSearch />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Showcase visuals ──────────────────────────────────────────── */
function ShowcaseBranching() {
  return (
    <div className="rounded-xl border p-6" style={{ background: "#FAF9F5", borderColor: "#DDD9D0" }}>
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: "#D97757" }} />
          <div className="flex-1">
            <div className="text-xs font-medium" style={{ color: "#1A1A1A" }}>Main thread</div>
            <div className="mt-1 h-2 rounded-full" style={{ background: "#E8E4DD", width: "85%" }} />
            <div className="mt-1 h-2 rounded-full" style={{ background: "#E8E4DD", width: "60%" }} />
          </div>
        </div>

        <div className="ml-6 border-l-2 pl-5 py-2" style={{ borderColor: "#D97757" }}>
          <div className="flex items-start gap-3">
            <div className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: "#E5956F" }} />
            <div className="flex-1">
              <div className="text-xs font-medium" style={{ color: "#D97757" }}>Tangent: performance optimization</div>
              <div className="mt-1 h-2 rounded-full" style={{ background: "rgba(217,119,87,0.15)", width: "75%" }} />
              <div className="mt-1 h-2 rounded-full" style={{ background: "rgba(217,119,87,0.15)", width: "50%" }} />
            </div>
          </div>

          <div className="ml-6 mt-3 border-l-2 pl-5 py-2" style={{ borderColor: "#E5956F" }}>
            <div className="flex items-start gap-3">
              <div className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: "#F4B89A" }} />
              <div className="flex-1">
                <div className="text-xs font-medium" style={{ color: "#C8663F" }}>Sub-tangent: caching strategy</div>
                <div className="mt-1 h-2 rounded-full" style={{ background: "rgba(217,119,87,0.1)", width: "65%" }} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium" style={{ background: "rgba(22,163,74,0.1)", color: "#16A34A" }}>
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Merged back
          </div>
          <div className="h-px flex-1" style={{ background: "#DDD9D0" }} />
        </div>

        <div className="flex items-start gap-3">
          <div className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: "#D97757" }} />
          <div className="flex-1">
            <div className="text-xs font-medium" style={{ color: "#1A1A1A" }}>Main thread continues...</div>
            <div className="mt-1 h-2 rounded-full" style={{ background: "#E8E4DD", width: "70%" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ShowcaseCode() {
  return (
    <div className="landing-showcase-visual">
      <div className="overflow-hidden rounded-xl border" style={{ borderColor: "#333", background: "#1E1D1A" }}>
        {/* Editor toolbar */}
        <div className="flex items-center justify-between border-b px-4 py-2" style={{ borderColor: "#333", background: "#2A2926" }}>
          <div className="flex items-center gap-2">
            <span className="rounded px-2 py-0.5 text-[10px] font-medium" style={{ background: "rgba(217,119,87,0.2)", color: "#D97757" }}>
              Python
            </span>
            <span className="text-[10px]" style={{ color: "#6B6B6B" }}>server.py</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded px-2 py-0.5 text-[10px]" style={{ background: "rgba(22,163,74,0.15)", color: "#4ADE80" }}>
              Run
            </span>
          </div>
        </div>

        {/* Code content */}
        <div className="p-4 font-mono text-xs leading-relaxed" style={{ color: "#E8E5DC" }}>
          <div><span style={{ color: "#C586C0" }}>from</span> flask <span style={{ color: "#C586C0" }}>import</span> Flask</div>
          <div className="mt-1"><span style={{ color: "#C586C0" }}>from</span> flask_cors <span style={{ color: "#C586C0" }}>import</span> CORS</div>
          <div className="mt-3">app = Flask(<span style={{ color: "#CE9178" }}>__name__</span>)</div>
          <div>CORS(app)</div>
          <div className="mt-3"><span style={{ color: "#569CD6" }}>@app.route</span>(<span style={{ color: "#CE9178" }}>&quot;/api/health&quot;</span>)</div>
          <div><span style={{ color: "#C586C0" }}>def</span> <span style={{ color: "#DCDCAA" }}>health</span>():</div>
          <div className="pl-4"><span style={{ color: "#C586C0" }}>return</span> {`{`}<span style={{ color: "#CE9178" }}>&quot;status&quot;</span>: <span style={{ color: "#CE9178" }}>&quot;ok&quot;</span>{`}`}</div>
        </div>

        {/* Terminal output */}
        <div className="border-t px-4 py-3" style={{ borderColor: "#333", background: "#171614" }}>
          <div className="text-[10px] font-mono" style={{ color: "#4ADE80" }}>
            $ python server.py
          </div>
          <div className="mt-1 text-[10px] font-mono" style={{ color: "#6B6B6B" }}>
            * Running on http://127.0.0.1:5000
          </div>
        </div>
      </div>
    </div>
  );
}

function ShowcaseSearch() {
  return (
    <div className="rounded-xl border p-5" style={{ background: "#FAF9F5", borderColor: "#DDD9D0" }}>
      <div className="space-y-3">
        {/* User question */}
        <div className="flex justify-end">
          <div className="rounded-2xl rounded-br-md px-3.5 py-2 text-xs" style={{ background: "#D97757", color: "#FFF" }}>
            What&apos;s the latest on React 19?
          </div>
        </div>

        {/* Search indicator */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium" style={{ background: "rgba(217,119,87,0.1)", color: "#D97757" }}>
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Searching: &quot;React 19 latest updates 2026&quot;
          </div>
        </div>

        {/* AI response with citations */}
        <div className="rounded-2xl rounded-bl-md px-3.5 py-2.5 text-xs leading-relaxed" style={{ background: "#F0EDE8", color: "#1A1A1A" }}>
          <p>
            <span className="font-medium">React 19</span> is now stable with several major features including the new compiler...
          </p>
          <p className="mt-1.5" style={{ color: "#6B6B6B" }}>
            Source: <span className="underline" style={{ color: "#D97757" }}>react.dev/blog</span>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── How it works ──────────────────────────────────────────────── */
const steps = [
  {
    step: "01",
    title: "Start a conversation",
    description:
      "Ask anything — from debugging code to researching a topic. Twix responds with real-time web search, code, and detailed explanations.",
  },
  {
    step: "02",
    title: "Branch into tangents",
    description:
      "Highlight any text to explore a tangent. Each branch inherits full context, so you can dive deep without losing your place.",
  },
  {
    step: "03",
    title: "Build and merge",
    description:
      "Write and run code in a live sandbox, iterate on the AI's output, then merge your findings back into the main thread with a summary.",
  },
];

function HowItWorks() {
  const ref = useFadeIn<HTMLElement>();

  return (
    <section
      id="how-it-works"
      ref={ref}
      className="landing-fade-in py-24 md:py-32"
      style={{ background: "#1A1614" }}
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest" style={{ color: "#D97757" }}>
            How it works
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Three steps to deeper thinking
          </h2>
          <p className="mt-4 text-lg leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
            No setup, no config files. Sign up and start exploring.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={i} className="landing-step-card">
              <div className="text-3xl font-bold" style={{ color: "#D97757" }}>
                {s.step}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">
                {s.title}
              </h3>
              <p className="mt-2.5 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
                {s.description}
              </p>
              {i < steps.length - 1 && (
                <div className="landing-step-connector" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── CTA ───────────────────────────────────────────────────────── */
function CTA({ isLoggedIn }: { isLoggedIn: boolean }) {
  const ref = useFadeIn<HTMLElement>();

  return (
    <section ref={ref} className="landing-fade-in py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="landing-cta-card">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: "#1A1A1A" }}>
            Ready to think differently?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-lg leading-relaxed" style={{ color: "#6B6B6B" }}>
            Join Twix and experience conversations that branch, code that runs, and answers that stay current.
          </p>
          <div className="mt-8">
            {isLoggedIn ? (
              <Link href="/c" className="landing-btn-primary landing-btn-lg">
                Open App
                <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            ) : (
              <Link href="/register" className="landing-btn-primary landing-btn-lg">
                Get Started — Free
                <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Footer ────────────────────────────────────────────────────── */
function Footer() {
  return (
    <footer style={{ background: "#1A1614" }}>
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo variant="white" />
            <p className="mt-4 max-w-sm text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
              The AI workspace where conversations branch like your thoughts. Think deeper, build faster, explore freely.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white">Product</h4>
            <ul className="mt-4 space-y-2.5">
              <li><a href="#features" className="landing-footer-link">Features</a></li>
              <li><a href="#how-it-works" className="landing-footer-link">How it Works</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white">Account</h4>
            <ul className="mt-4 space-y-2.5">
              <li><Link href="/login" className="landing-footer-link">Sign In</Link></li>
              <li><Link href="/register" className="landing-footer-link">Create Account</Link></li>
            </ul>
          </div>
        </div>

        <div
          className="mt-12 flex flex-col items-center justify-between gap-4 border-t pt-8 sm:flex-row"
          style={{ borderColor: "rgba(255,255,255,0.1)" }}
        >
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
            &copy; {new Date().getFullYear()} Twix. All rights reserved.
          </p>
          <div className="flex gap-6">
            <span className="text-xs cursor-default" style={{ color: "rgba(255,255,255,0.4)" }}>Privacy</span>
            <span className="text-xs cursor-default" style={{ color: "rgba(255,255,255,0.4)" }}>Terms</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ─── Main page ─────────────────────────────────────────────────── */
export function LandingPage({ isLoggedIn }: LandingPageProps) {
  return (
    <div className="landing-page">
      <Nav isLoggedIn={isLoggedIn} />
      <Hero isLoggedIn={isLoggedIn} />
      <Features />
      <FeatureShowcase />
      <HowItWorks />
      <CTA isLoggedIn={isLoggedIn} />
      <Footer />
    </div>
  );
}
