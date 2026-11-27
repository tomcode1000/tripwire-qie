/* Tripwire site: shared chrome, theme, live status band, evidence data and live reads from QIE. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const REPO = "https://github.com/tomcode1000/tripwire-qie";

  // ---------------------------------------------------------------- theme
  const THEME_KEY = "tripwire-theme";
  const setTheme = (t) => {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem(THEME_KEY, t); } catch {}
  };

  // ---------------------------------------------------------------- chrome
  const MARK = `<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="8" fill="currentColor"/><path d="M7 25.5h26" stroke="var(--paper)" stroke-width="2" stroke-linecap="round"/><circle cx="13" cy="25.5" r="3.2" fill="var(--paper)"/><path d="M13 25.5 31 14" stroke="var(--paper)" stroke-width="1.4" stroke-linecap="round" opacity=".55"/></svg>`;
  const page = document.body.dataset.page;
  const nav = [
    ["index.html", "Overview"],
    ["incident.html", "Incidents"],
    ["registry.html", "Blocklist"],
    ["evidence.html", "Proof"],
    ["arm.html", "Set your alarm"],
  ];
  const head = $("[data-chrome=head]");
  if (head) {
    const overHero = !!document.querySelector(".hero");
    head.outerHTML = `<div class="masthead${overHero ? " over-hero" : ""}" id="masthead"><header class="site-head"><div class="shell site-head-in">
      <a class="brand" href="index.html"><span class="mark">${MARK}</span><span>Tripwire</span></a>
      <nav class="site-links" aria-label="Main">${nav.map(([h, t]) => `<a href="${h}"${page === h ? ' aria-current="page"' : ""}>${t}</a>`).join("")}</nav>
      <div class="site-end">
        <button class="theme-dot" type="button" aria-label="Switch light or dark theme"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="10" cy="10" r="6.5"/><path d="M10 3.5a6.5 6.5 0 0 1 0 13z" fill="currentColor"/></svg></button>
        <a class="btn btn-ghost btn-sm hide-sm" href="${REPO}">Source</a>
        <a class="btn btn-ink btn-sm hide-sm" href="arm.html">Set your alarm</a>
        <button class="menu-btn" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="drawer"><span></span><span></span></button>
      </div></div></header>
      <div class="drawer" id="drawer" hidden><div class="shell">${nav.map(([h, t], i) => `<a href="${h}"${page === h ? ' aria-current="page"' : ""}><span class="mono">0${i + 1}</span>${t}</a>`).join("")}
        <div class="drawer-cta"><a class="btn btn-ink btn-wide" href="arm.html">Set your alarm</a><a class="btn btn-ghost btn-wide" href="${REPO}">Source on GitHub</a></div></div></div>
      <div class="status" aria-label="Live status"><div class="shell status-in">
        <span class="st"><span class="dot"></span><b>Live on QIE testnet</b></span>
        <span class="st">Blocklist <a class="u" id="st-reg" href="#">—</a></span>
        <span class="st bad">Thieves caught <b id="st-flag">—</b></span>
        <span class="st">Last catch <b id="st-last">—</b></span>
        <span class="st">Tests <b id="st-tests">—</b> passing</span>
        <span class="st">Coverage <b id="st-cov">—</b></span>
        <span class="st">Audit <b>not yet</b></span>
      </div></div></div>`;
  }

  // masthead behaviour, as on real sites:
  //  - over the hero it is transparent; it turns solid once the page scrolls
  //  - scrolling down past the fold hides it; any scroll up brings it back
  //  - the status band folds away once scrolled, so only the 60px bar stays
  const mh = $("#masthead");
  if (mh) {
    let lastY = scrollY;
    let ticking = false;
    const update = () => {
      const y = Math.max(0, scrollY);
      mh.classList.toggle("solid", y > 8);
      mh.classList.toggle("compact", y > 120);
      const goingDown = y > lastY + 4;
      const goingUp = y < lastY - 4;
      if (goingDown && y > 420 && !mh.classList.contains("menu-open")) mh.classList.add("tucked");
      else if (goingUp || y < 420) mh.classList.remove("tucked");
      lastY = y;
      ticking = false;
    };
    addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
    const btn = $(".menu-btn", mh);
    const drawer = $("#drawer");
    const setMenu = (open) => {
      mh.classList.toggle("menu-open", open);
      btn.setAttribute("aria-expanded", String(open));
      btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      drawer.hidden = !open;
      document.body.style.overflow = open ? "hidden" : "";
    };
    btn.addEventListener("click", () => setMenu(!mh.classList.contains("menu-open")));
    addEventListener("keydown", (e) => e.key === "Escape" && setMenu(false));
    addEventListener("resize", () => innerWidth > 900 && setMenu(false));
  }
  const foot = $("[data-chrome=foot]");
  if (foot) {
    foot.outerHTML = `<footer class="site-foot"><div class="shell">
      <div class="foot-in">
        <div style="display:grid;gap:14px;max-width:420px">
          <a class="brand" href="index.html"><span class="mark">${MARK}</span><span>Tripwire</span></a>
          <p class="fine">Tripwire hides fake keys next to your real ones. The moment someone uses one, your money locks, the thief is blocklisted, and you know exactly which file leaked.</p>
        </div>
        <div class="foot-cols">
          <div><span>Product</span><a href="incident.html">Incidents</a><a href="registry.html">Blocklist</a><a href="arm.html">Set your alarm</a></div>
          <div><span>Proof</span><a href="evidence.html">How we tested it</a><a href="${REPO}/blob/main/docs/EVAL.md">Attack evaluation</a><a href="${REPO}/blob/main/docs/REFERENCES.md">References</a></div>
          <div><span>Source</span><a href="${REPO}">GitHub</a><a href="${REPO}/actions">CI runs</a><a href="https://testnet.qie.digital">QIE explorer</a></div>
        </div>
      </div>
      <div class="foot-legal"><span class="fine">QIE Blockchain Hackathon 3.0 · Developer Infrastructure &amp; Tooling · Testnet build, not audited.</span><span class="fine">MIT licensed</span></div>
    </div></footer>`;
  }
  $(".theme-dot")?.addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));

  // optional media: photographs and loops appear when the files exist; until then the stand-in shows
  $$("img[data-opt]").forEach((img) => img.addEventListener("error", () => img.remove(), { once: true }));
  $$("video[data-opt]").forEach((v) => {
    const src = v.querySelector("source");
    (src || v).addEventListener("error", () => v.remove(), { once: true });
  });

  // fade sections in once
  const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), io.unobserve(e.target))), { rootMargin: "0px 0px -8% 0px" }) : null;
  $$(".fade").forEach((el) => (io ? io.observe(el) : el.classList.add("in")));

  // ---------------------------------------------------------------- helpers
  const short = (a, n = 4) => (a ? `${a.slice(0, 2 + n)}…${a.slice(-n)}` : "");
  const fmt = (n, d = 0) => Number(n).toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
  const get = (o, p) => p.split(".").reduce((x, k) => (x == null ? x : x[k]), o);
  window.TW = { $, $$, short, fmt, REPO };

  // ---------------------------------------------------------------- evidence data
  TW.data = fetch("data.json", { cache: "no-cache" }).then((r) => r.json());
  TW.data.then((d) => {
    TW.d = d;
    TW.tx = (h) => `${d.network.explorer}/tx/${h}`;
    TW.addr = (a) => `${d.network.explorer}/address/${a}`;
    $$("[data-k]").forEach((el) => {
      const v = get(d, el.dataset.k);
      if (v == null) return;
      const f = el.dataset.fmt;
      el.textContent = f === "short" ? short(v) : f === "int" ? fmt(v) : f === "1" ? fmt(v, 1) : f === "date" ? new Date(v).toUTCString().replace(" GMT", " UTC") : f === "day" ? new Date(v).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : String(v);
    });
    $$("[data-href]").forEach((el) => {
      const [kind, p] = el.dataset.href.split(":");
      const v = get(d, p);
      if (!v) return;
      el.href = kind === "tx" ? TW.tx(v) : kind === "addr" ? TW.addr(v) : v;
      el.target = "_blank";
      el.rel = "noopener";
    });
    // status band from evidence; live values replace these below
    const reg = $("#st-reg");
    if (reg) { reg.textContent = short(d.contracts.FlagRegistry); reg.href = TW.addr(d.contracts.FlagRegistry); reg.target = "_blank"; }
    $("#st-tests") && ($("#st-tests").textContent = d.tests.passing);
    $("#st-cov") && ($("#st-cov").textContent = `${d.tests.coverage.lines}% lines`);
    $("#st-last") && ($("#st-last").textContent = `block ${fmt(d.liveTrip.block)}`);
    document.dispatchEvent(new CustomEvent("tw:data", { detail: d }));
    liveStatus(d);
  });

  // ---------------------------------------------------------------- live chain
  const REGISTRY_ABI = [
    "function isFlagged(address) view returns (bool)",
    "function flaggedCount() view returns (uint256)",
    "function flagOf(address) view returns (tuple(uint64 firstSeen,uint64 lastSeen,uint32 count,address lastTrap,address lastBait))",
    "event Flagged(address indexed who, address indexed trap, address indexed bait, uint32 count)",
  ];
  TW.REGISTRY_ABI = REGISTRY_ABI;
  let providerP;
  TW.provider = () =>
    (providerP ||= (async () => {
      const d = await TW.data;
      for (const url of d.network.rpc) {
        try {
          const p = new ethers.JsonRpcProvider(url, d.network.chainId, { staticNetwork: true, batchMaxCount: 1 });
          await Promise.race([p.getBlockNumber(), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 15000))]);
          return p;
        } catch {}
      }
      providerP = null;
      throw new Error("QIE testnet RPC unreachable");
    })());
  TW.registry = async () => new ethers.Contract((await TW.data).contracts.FlagRegistry, REGISTRY_ABI, await TW.provider());

  let flagEvents;
  TW.flagEvents = async () => {
    if (flagEvents) return flagEvents;
    const d = await TW.data;
    const r = await TW.registry();
    flagEvents = await r.queryFilter(r.filters.Flagged(), d.contracts.deployBlockHint);
    return flagEvents;
  };

  async function liveStatus() {
    if (!window.ethers || !$("#st-flag")) return;
    try {
      const r = await TW.registry();
      $("#st-flag").textContent = (await r.flaggedCount()).toString();
      const evs = await TW.flagEvents();
      if (evs.length) $("#st-last").textContent = `block ${fmt(evs[evs.length - 1].blockNumber)}`;
    } catch {
      $("#st-flag").textContent = "2 (saved)";
    }
  }

  // address checker: any [data-check] form
  $$("[data-check]").forEach((form) => {
    const input = $("input", form);
    const out = form.parentElement.querySelector(".check-out");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const a = input.value.trim();
      if (!/^0x[0-9a-fA-F]{40}$/.test(a)) { out.innerHTML = `<span class="fine">Enter a 0x address (42 characters).</span>`; return; }
      out.innerHTML = `<span class="fine">Reading the registry on QIE testnet…</span>`;
      try {
        const r = await TW.registry();
        if (await r.isFlagged(a)) {
          const f = await r.flagOf(a);
          out.innerHTML = `<span class="verdict bad">● Flagged</span> <span class="fine">· took bait ${f.count} time${f.count > 1 ? "s" : ""}, first ${new Date(Number(f.firstSeen) * 1000).toUTCString().replace(" GMT", " UTC")} · <a class="u" href="${TW.addr(a)}" target="_blank" rel="noopener">explorer</a></span>`;
        } else {
          out.innerHTML = `<span class="verdict good">● Not flagged</span> <span class="fine">· no trip recorded against this address</span>`;
        }
      } catch (err) {
        out.innerHTML = `<span class="fine">Could not reach QIE testnet right now (${err.message}). Try again in a moment.</span>`;
      }
    });
  });
})();
