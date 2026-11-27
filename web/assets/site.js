/* Tripwire site: shared chrome, theme, evidence data and live reads from QIE testnet. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // ---------------------------------------------------------------- theme
  const THEME_KEY = "tripwire-theme";
  const setTheme = (t) => {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem(THEME_KEY, t); } catch {}
  };
  try { const t = localStorage.getItem(THEME_KEY); if (t) document.documentElement.dataset.theme = t; } catch {}

  // ---------------------------------------------------------------- chrome
  const MARK = `<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="9" fill="currentColor"/><path d="M6 23h9l3-7 4 14 3-7h9" fill="none" stroke="var(--surface)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const ICON = {
    home: '<path d="M3 10.5 10 4l7 6.5V17a1 1 0 0 1-1 1h-4v-5H8v5H4a1 1 0 0 1-1-1z"/>',
    list: '<path d="M7 5h10M7 10h10M7 15h10M3 5h.01M3 10h.01M3 15h.01"/>',
    arm: '<path d="M10 2v4M10 14v4M2 10h4M14 10h4M10 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/>',
    proof: '<path d="M4 3h9l3 3v11H4zM8 10l2 2 4-4"/>',
    docs: '<path d="M5 3h7l3 3v11H5zM8 9h5M8 12h5"/>',
  };
  const icon = (k) => `<svg class="i" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;
  const page = document.body.dataset.page;
  const nav = [
    ["index.html", "home", "Overview"],
    ["list.html", "list", "The list"],
    ["arm.html", "arm", "Arm a trap"],
    ["evidence.html", "proof", "Evidence"],
  ];
  const head = $("[data-chrome=head]");
  if (head) {
    head.outerHTML = `<header class="site-head"><div class="shell site-head-in">
      <a class="brand" href="index.html"><span class="mark">${MARK}</span><span>Tripwire</span></a>
      <nav class="site-links" aria-label="Main">${nav
        .map(([h, i, t]) => `<a href="${h}"${page === h ? ' aria-current="page"' : ""}>${icon(i)}${t}</a>`)
        .join("")}</nav>
      <div class="site-end">
        <span class="net" title="Contracts live on QIE testnet (chain 1983)"><span class="pill pill-live" style="border:0;background:none;padding:0;height:auto"></span>QIE testnet</span>
        <button class="theme-dot" type="button" aria-label="Switch light or dark theme"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="10" cy="10" r="6.5"/><path d="M10 3.5v13" /><path d="M10 3.5a6.5 6.5 0 0 1 0 13z" fill="currentColor"/></svg></button>
        <a class="btn btn-ghost" href="https://github.com/tomcode1000/tripwire-qie">GitHub</a>
        <a class="btn btn-primary" href="arm.html">Arm a trap</a>
      </div></div></header>`;
  }
  const foot = $("[data-chrome=foot]");
  if (foot) {
    foot.outerHTML = `<footer class="site-foot"><div class="shell foot-in">
      <div style="display:grid;gap:10px;max-width:340px">
        <a class="brand" href="index.html"><span class="mark">${MARK}</span><span>Tripwire</span></a>
        <p class="fine">Bait keys for builders on QIE. Built for QIE Blockchain Hackathon 3.0, Developer Infrastructure &amp; Tooling. Testnet build, not audited.</p>
      </div>
      <div class="foot-cols">
        <div><span>Product</span><a href="list.html">The list</a><a href="arm.html">Arm a trap</a><a href="evidence.html">Evidence</a></div>
        <div><span>Proof</span><a href="https://github.com/tomcode1000/tripwire-qie/blob/main/docs/EVIDENCE.md">Claim by claim</a><a href="https://github.com/tomcode1000/tripwire-qie/blob/main/docs/EVAL.md">Attack evaluation</a><a href="https://github.com/tomcode1000/tripwire-qie/blob/main/docs/REFERENCES.md">References</a></div>
        <div><span>Code</span><a href="https://github.com/tomcode1000/tripwire-qie">GitHub</a><a href="https://github.com/tomcode1000/tripwire-qie/actions">CI runs</a><a href="https://testnet.qie.digital">QIE explorer</a></div>
      </div></div></footer>`;
  }
  $(".theme-dot")?.addEventListener("click", () =>
    setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark")
  );
  const sh = $(".site-head");
  const onScroll = () => sh && sh.classList.toggle("scrolled", scrollY > 8);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // fade sections in once
  const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), io.unobserve(e.target))), { rootMargin: "0px 0px -8% 0px" }) : null;
  $$(".fade").forEach((el) => (io ? io.observe(el) : el.classList.add("in")));

  // ---------------------------------------------------------------- helpers
  const short = (a, n = 4) => (a ? `${a.slice(0, 2 + n)}…${a.slice(-n)}` : "");
  const fmt = (n, d = 0) => Number(n).toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
  window.TW = { $, $$, short, fmt };

  // ---------------------------------------------------------------- evidence data
  TW.data = fetch("data.json", { cache: "no-cache" }).then((r) => r.json());
  TW.data.then((d) => {
    TW.d = d;
    const tx = (h) => `${d.network.explorer}/tx/${h}`;
    const addr = (a) => `${d.network.explorer}/address/${a}`;
    TW.tx = tx;
    TW.addr = addr;
    // fill [data-k="path.to.value"] with optional data-fmt
    $$("[data-k]").forEach((el) => {
      const v = el.dataset.k.split(".").reduce((o, k) => (o == null ? o : o[k]), d);
      if (v == null) return;
      const f = el.dataset.fmt;
      el.textContent = f === "short" ? short(v) : f === "int" ? fmt(v) : f === "1" ? fmt(v, 1) : f === "date" ? new Date(v).toUTCString().replace(" GMT", " UTC") : String(v);
    });
    // [data-href="tx:liveTrip.tx" | "addr:contracts.FlagRegistry" | "src:eval.source"]
    $$("[data-href]").forEach((el) => {
      const [kind, p] = el.dataset.href.split(":");
      const v = p.split(".").reduce((o, k) => (o == null ? o : o[k]), d);
      if (!v) return;
      el.href = kind === "tx" ? tx(v) : kind === "addr" ? addr(v) : v;
      el.target = "_blank";
      el.rel = "noopener";
    });
    document.dispatchEvent(new CustomEvent("tw:data", { detail: d }));
  });

  // ---------------------------------------------------------------- live chain
  const REGISTRY_ABI = [
    "function isFlagged(address) view returns (bool)",
    "function flaggedCount() view returns (uint256)",
    "function flagOf(address) view returns (tuple(uint64 firstSeen,uint64 lastSeen,uint32 count,address lastTrap,address lastBait))",
    "event Flagged(address indexed who, address indexed trap, address indexed bait, uint32 count)",
  ];
  TW.REGISTRY_ABI = REGISTRY_ABI;
  TW.provider = async () => {
    const d = await TW.data;
    for (const url of d.network.rpc) {
      try {
        const p = new ethers.JsonRpcProvider(url, d.network.chainId, { staticNetwork: true });
        await Promise.race([p.getBlockNumber(), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 8000))]);
        return p;
      } catch {}
    }
    throw new Error("QIE testnet RPC unreachable");
  };
  TW.registry = async () => {
    const d = await TW.data;
    return new ethers.Contract(d.contracts.FlagRegistry, REGISTRY_ABI, await TW.provider());
  };

  // address checker: any [data-check] form
  $$("[data-check]").forEach((form) => {
    const input = $("input", form);
    const out = $(".check-out", form.parentElement) || $(".check-out");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const a = input.value.trim();
      if (!/^0x[0-9a-fA-F]{40}$/.test(a)) {
        out.innerHTML = `<span class="fine">Enter a 0x address (42 characters).</span>`;
        return;
      }
      out.innerHTML = `<span class="fine">Reading the registry on QIE testnet…</span>`;
      try {
        const r = await TW.registry();
        if (await r.isFlagged(a)) {
          const f = await r.flagOf(a);
          out.innerHTML = `<span class="verdict bad">● Flagged</span> <span class="fine">· took bait ${f.count} time${f.count > 1 ? "s" : ""}, first ${new Date(Number(f.firstSeen) * 1000).toUTCString().replace(" GMT", " UTC")} · <a href="${TW.addr(a)}" target="_blank" rel="noopener">explorer</a></span>`;
        } else {
          out.innerHTML = `<span class="verdict good">● Not flagged</span> <span class="fine">· no trip recorded against this address</span>`;
        }
      } catch (err) {
        out.innerHTML = `<span class="fine">Could not reach QIE testnet right now (${err.message}). Try again in a moment.</span>`;
      }
    });
  });
})();
