const { expect } = require("chai");
const fs = require("fs");
const os = require("os");
const path = require("path");
const L = require("../cli/lib");

describe("CLI helpers", function () {
  it("parseDelay reads hours, days and seconds within the vault's limits", function () {
    expect(L.parseDelay("24h")).to.equal(86400);
    expect(L.parseDelay("2d")).to.equal(172800);
    expect(L.parseDelay("3600")).to.equal(3600);
    expect(() => L.parseDelay("10m")).to.throw("between 1 hour and 30 days");
    expect(() => L.parseDelay("31d")).to.throw("between 1 hour and 30 days");
    expect(() => L.parseDelay("soon")).to.throw("can't read delay");
  });

  it("checkLabel requires a label of at most 31 bytes", function () {
    expect(L.checkLabel(" github:repo/.env ")).to.equal("github:repo/.env");
    expect(() => L.checkLabel("")).to.throw("needs a label");
    expect(() => L.checkLabel("x".repeat(32))).to.throw("longer than 31 bytes");
  });

  it("bait files look exactly like a real deploy config", function () {
    const s = L.baitFileContent("0xabc", "mainnet");
    expect(s).to.match(/^# deploy config\nPRIVATE_KEY=0xabc\nRPC_URL=https:\/\/.+\nCHAIN_ID=1990\n$/);
    expect(L.baitFileName(0, "github:my-repo/.env")).to.equal("bait-1-github-my-repo-env.env");
  });

  it("blockWindows never exceeds the RPC's 10,000-block limit and covers the whole range", function () {
    const w = L.blockWindows(100, 25_150);
    expect(w[0]).to.deep.equal([100, 10_099]);
    expect(w[w.length - 1][1]).to.equal(25_150);
    for (const [a, b] of w) expect(b - a + 1).to.be.at.most(10_000);
    for (let i = 1; i < w.length; i++) expect(w[i][0]).to.equal(w[i - 1][1] + 1);
    expect(L.blockWindows(5, 5)).to.deep.equal([[5, 5]]);
  });

  it("parseArgs reads positionals, flags, repeated flags and booleans", function () {
    const a = L.parseArgs(["bait", "--label", "a", "--label", "b", "--count", "2", "--dry"]);
    expect(a._).to.deep.equal(["bait"]);
    expect(a.label).to.deep.equal(["a", "b"]);
    expect(a.count).to.equal("2");
    expect(a.dry).to.equal(true);
  });

  it("loadNetwork returns the testnet deployment and refuses unknown networks", function () {
    const n = L.loadNetwork("testnet");
    expect(n.chainId).to.equal(1983);
    expect(L.isAddress(n.FlagRegistry)).to.equal(true);
    expect(() => L.loadNetwork("moon")).to.throw("unknown network");
  });

  it("the bait command writes .env files and a baits.json without private keys", async function () {
    const { main } = require("../bin/tripwire");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tw-"));
    const log = console.log;
    console.log = () => {};
    try {
      await main(["bait", "--count", "2", "--label", "github:demo/.env", "--out", dir]);
    } finally {
      console.log = log;
    }
    const j = JSON.parse(fs.readFileSync(path.join(dir, "baits.json"), "utf8"));
    expect(j.baits).to.have.length(2);
    expect(j.baits[0].label).to.equal("github:demo/.env");
    expect(JSON.stringify(j)).not.to.match(/0x[0-9a-f]{64}/i);
    const env = fs.readFileSync(path.join(dir, j.baits[0].file), "utf8");
    expect(env).to.match(/PRIVATE_KEY=0x[0-9a-f]{64}/);
  });
});
