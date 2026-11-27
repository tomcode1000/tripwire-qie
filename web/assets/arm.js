/* Arm a trap: connect, vault, bait keys (generated locally), arm, guardian, watch. */
(() => {
  const { $ } = TW;
  const FACTORY_ABI = [
    "function createVault(address recovery, uint64 delay) returns (address)",
    "function arm(address vault, address keeper, address[] baits, bytes32[] labels) returns (address)",
    "event VaultCreated(address indexed owner, address indexed vault, address recovery, uint64 delay)",
    "event Armed(address indexed owner, address indexed trap, address indexed vault, uint256 baits)",
  ];
  const VAULT_ABI = [
    "function owner() view returns (address)",
    "function recovery() view returns (address)",
    "function locked() view returns (bool)",
    "function lockReason() view returns (bytes32)",
    "function isGuardian(address) view returns (bool)",
    "function setGuardian(address guardian, bool enabled)",
  ];
  const TRAP_ABI = ["function tripCount() view returns (uint256)", "function baitCount() view returns (uint256)"];
  const CHAIN_HEX = "0x7bf"; // 1983

  const S = { signer: null, account: null, vault: null, baits: [], trap: null };
  let D;

  const log = (msg, kind = "", hash) => {
    const el = $("#log");
    if (el.firstElementChild?.classList.contains("fine")) el.innerHTML = "";
    const row = document.createElement("div");
    row.innerHTML = `<span class="${kind === "ok" ? "t-ok" : kind === "err" ? "t-err" : "fine"}">${kind === "ok" ? "✓" : kind === "err" ? "✕" : "·"}</span><span>${msg}${hash ? ` <a class="mono fine" href="${TW.tx(hash)}" target="_blank" rel="noopener">${TW.short(hash, 6)} ↗</a>` : ""}</span>`;
    el.prepend(row);
  };
  const pill = (id, text, kind) => {
    const p = $(id);
    p.textContent = text;
    p.className = `pill${kind ? ` pill-${kind}` : ""}`;
  };
  const step = (n) => {
    for (let i = 1; i <= 5; i++) {
      $(`#n${i}`).classList.toggle("on", i === n);
      $(`#n${i}`).classList.toggle("done", i < n);
    }
  };
  const isAddr = (a) => /^0x[0-9a-fA-F]{40}$/.test(a);
  const wallet = () => window.qie || window.ethereum;

  async function connect() {
    const w = wallet();
    if (!w) return log("No wallet found. Install QIE Wallet or another EIP-1193 wallet.", "err");
    try {
      await w.request({ method: "eth_requestAccounts" });
      try {
        await w.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_HEX }] });
      } catch (e) {
        if (e.code === 4902 || /Unrecognized|not added/i.test(e.message || "")) {
          await w.request({
            method: "wallet_addEthereumChain",
            params: [{ chainId: CHAIN_HEX, chainName: "QIE Testnet", nativeCurrency: { name: "QIE", symbol: "QIE", decimals: 18 }, rpcUrls: D.network.rpc, blockExplorerUrls: [D.network.explorer] }],
          });
        } else throw e;
      }
      const bp = new ethers.BrowserProvider(w);
      S.signer = await bp.getSigner();
      S.account = await S.signer.getAddress();
      pill("#who", TW.short(S.account), "good");
      $("#create-vault").disabled = false;
      $("#use-vault").disabled = false;
      log(`Connected ${TW.short(S.account)} on QIE testnet`, "ok");
      step(2);
      w.on?.("accountsChanged", async () => {
        S.signer = await new ethers.BrowserProvider(w).getSigner();
        S.account = await S.signer.getAddress();
        pill("#who", TW.short(S.account), "good");
        log(`Switched to ${TW.short(S.account)}`);
        refreshArmButtons();
      });
    } catch (e) {
      log(`Connect failed: ${e.shortMessage || e.message}`, "err");
    }
  }

  async function createVault() {
    const rec = $("#recovery").value.trim();
    if (!isAddr(rec)) return log("Enter a valid backup key address.", "err");
    if (rec.toLowerCase() === S.account.toLowerCase()) return log("Your backup key must be a different wallet from the one you connected.", "err");
    try {
      const f = new ethers.Contract(D.contracts.TripwireFactory, FACTORY_ABI, S.signer);
      const tx = await f.createVault(rec, BigInt($("#delay").value));
      log("Creating vault…", "", tx.hash);
      const r = await tx.wait();
      const ev = r.logs.map((l) => { try { return f.interface.parseLog(l); } catch { return null; } }).find((x) => x?.name === "VaultCreated");
      setVault(ev.args.vault);
      log(`Vault created ${TW.short(S.vault)}`, "ok", tx.hash);
    } catch (e) {
      log(`Vault failed: ${e.shortMessage || e.message}`, "err");
    }
  }

  async function useVault() {
    const v = $("#existing").value.trim();
    if (!isAddr(v)) return log("Enter a valid vault address.", "err");
    try {
      const c = new ethers.Contract(v, VAULT_ABI, S.signer);
      await c.recovery();
      setVault(v);
      log(`Using vault ${TW.short(v)}`, "ok");
    } catch {
      log("That address is not a Tripwire vault on QIE testnet.", "err");
    }
  }

  function setVault(v) {
    S.vault = v;
    pill("#vault-state", TW.short(v), "good");
    if (!S.baits.length) { addBait("github:my-repo/.env"); addBait("notes:keys.txt"); }
    step(3);
    refreshArmButtons();
  }

  function addBait(label = "") {
    const w = ethers.Wallet.createRandom();
    S.baits.push({ wallet: w, label });
    renderBaits();
  }

  function renderBaits() {
    $("#baits").innerHTML = S.baits
      .map(
        (b, i) => `<div class="bait-item"><span class="mono fine">${b.wallet.address}</span>
        <input class="input" data-i="${i}" value="${b.label}" placeholder="where you will hide it, e.g. github:repo/.env" maxlength="31">
        <button class="btn btn-ghost" data-rm="${i}" type="button" aria-label="Remove bait">Remove</button></div>`
      )
      .join("");
    $("#baits").querySelectorAll("input").forEach((inp) => inp.addEventListener("input", () => { S.baits[+inp.dataset.i].label = inp.value; refreshArmButtons(); }));
    $("#baits").querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", () => { S.baits.splice(+b.dataset.rm, 1); renderBaits(); }));
    pill("#bait-state", S.baits.length ? `${S.baits.length} ready` : "None yet", S.baits.length ? "good" : "");
    $("#download").disabled = !S.baits.length;
    refreshArmButtons();
  }

  function download() {
    S.baits.forEach((b, i) => {
      const body = `# deploy config\nPRIVATE_KEY=${b.wallet.privateKey}\nRPC_URL=https://rpc1mainnet.qie.digital\nCHAIN_ID=1990\n`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([body], { type: "text/plain" }));
      a.download = `bait-${i + 1}-${(b.label || "env").replace(/[^a-z0-9]+/gi, "-")}.env`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
    log(`Downloaded ${S.baits.length} fake key${S.baits.length > 1 ? "s" : ""}. Hide each one where its label says.`, "ok");
  }

  async function refreshArmButtons() {
    const ready = S.vault && S.baits.length && S.baits.every((b) => b.label.trim().length);
    let isRecovery = false;
    if (S.vault && S.signer) {
      try { isRecovery = (await new ethers.Contract(S.vault, VAULT_ABI, S.signer).recovery()).toLowerCase() === S.account.toLowerCase(); } catch {}
    }
    $("#arm").disabled = !(ready && isRecovery && !S.trap);
    $("#guard").disabled = !(S.trap && isRecovery);
    if (ready && !isRecovery && !S.trap) pill("#arm-state", "Switch to your backup key", "");
  }

  async function arm() {
    try {
      const f = new ethers.Contract(D.contracts.TripwireFactory, FACTORY_ABI, S.signer);
      const labels = S.baits.map((b) => ethers.encodeBytes32String(b.label.trim()));
      const tx = await f.arm(S.vault, ethers.ZeroAddress, S.baits.map((b) => b.wallet.address), labels);
      log("Setting the trap…", "", tx.hash);
      const r = await tx.wait();
      const ev = r.logs.map((l) => { try { return f.interface.parseLog(l); } catch { return null; } }).find((x) => x?.name === "Armed");
      S.trap = ev.args.trap;
      pill("#arm-state", "Set, one step left", "");
      log(`Trap set ${TW.short(S.trap)}`, "ok", tx.hash);
      refreshArmButtons();
      watch();
    } catch (e) {
      log(`Arm failed: ${e.shortMessage || e.message}`, "err");
    }
  }

  async function guard() {
    try {
      const v = new ethers.Contract(S.vault, VAULT_ABI, S.signer);
      const tx = await v.setGuardian(S.trap, true);
      log("Letting the trap lock your vault…", "", tx.hash);
      await tx.wait();
      pill("#arm-state", "Set", "good");
      log("Done. The trap can now lock your vault", "ok", tx.hash);
      step(5);
      watch();
    } catch (e) {
      log(`Guardian failed: ${e.shortMessage || e.message}`, "err");
    }
  }

  let timer;
  async function watch() {
    clearTimeout(timer);
    try {
      const p = await TW.provider();
      const v = new ethers.Contract(S.vault, VAULT_ABI, p);
      const t = new ethers.Contract(S.trap, TRAP_ABI, p);
      const [locked, reason, guardian, trips, baits] = await Promise.all([v.locked(), v.lockReason(), v.isGuardian(S.trap), t.tripCount(), t.baitCount()]);
      $("#status").innerHTML = `
        <div class="row"><span>Trap</span><b><a class="mono" href="${TW.addr(S.trap)}" target="_blank" rel="noopener">${S.trap}</a></b></div>
        <div class="row"><span>Vault</span><b><a class="mono" href="${TW.addr(S.vault)}" target="_blank" rel="noopener">${S.vault}</a></b></div>
        <div class="row"><span>Fake keys set</span><b>${baits}</b></div>
        <div class="row"><span>Trap can lock your vault</span><b class="${guardian ? "safe" : "flag"}">${guardian ? "Yes" : "No, finish step 4"}</b></div>
        <div class="row"><span>Catches</span><b class="${trips > 0n ? "flag" : ""}">${trips}</b></div>
        <div class="row"><span>Vault</span><b class="${locked ? "flag" : "safe"}">${locked ? `Locked. You leaked at ${ethers.decodeBytes32String(reason)}` : "Open, nothing caught"}</b></div>`;
      pill("#watch-state", locked ? "Caught" : "Watching", locked ? "bad" : "good");
    } catch (e) {
      log(`Status read failed: ${e.message}`, "err");
    }
    timer = setTimeout(watch, 15000);
  }

  TW.data.then((d) => {
    D = d;
    $("#connect").onclick = connect;
    $("#create-vault").onclick = createVault;
    $("#use-vault").onclick = useVault;
    $("#add-bait").onclick = () => addBait("");
    $("#download").onclick = download;
    $("#arm").onclick = arm;
    $("#guard").onclick = guard;
    if (!wallet()) log("No browser wallet detected. You can still read the steps; connecting needs QIE Wallet or MetaMask.");
  });
})();
