/* =====================================================================
   board-feed.js — REQUIRED BY TOM'S MORNING BOARD. DO NOT REMOVE.
   Every Farm Ledger build must include this file and the hooks that
   call it (BoardFeed.init / BoardFeed.onData / BoardFeed.schedule),
   or the Morning Board's Farm Ledger panel stops updating.

   What it does: after each save (and at most hourly when the app is
   opened) it writes a small read-only summary to
     boardFeed/<secret token>
   The token lives only inside the locked farm document, never in this
   code. Firestore rules let anyone *get* that one document if they know
   the token, but nobody can list, change or reach anything else.
   Account panel (tap the build line in the header): sign out, copy the
   board link code, download a backup.
   ===================================================================== */
(function () {
  "use strict";
  const HOUR = 3600000;
  const S = { db: null, farmCode: null, getState: null, build: "", token: null,
              lastHash: null, lastWrite: 0, status: "starting", err: "", timer: null, farmData: null };

  function randomToken() {
    const a = new Uint8Array(24); crypto.getRandomValues(a);
    return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return String(h); }

  function summary() {
    const st = S.getState();
    const today = new Date().toISOString().slice(0, 10);
    const inc = {}, exp = {}; let income = 0, spend = 0, since = null;
    (st.finance || []).forEach((e) => {
      const amt = Number(e.amount) || 0;
      if (!since || e.date < since) since = e.date;
      if (e.kind === "revenue") { income += amt; inc[e.category] = (inc[e.category] || 0) + amt; }
      else { spend += amt; exp[e.category] = (exp[e.category] || 0) + amt; }
    });
    return {
      build: S.build,
      herd: (st.herd || []).filter((a) => !a.offDate).map((a) => ({ tag: String(a.tag || ""), sex: a.sex || "", breed: a.breed || "", dob: a.dob || "" })),
      withdrawals: (st.medicine || [])
        .filter((m) => m.withdrawalEndDateMeat && m.withdrawalEndDateMeat >= today && !m.notUsed)
        .map((m) => ({ product: m.productName || "", tags: (m.animalTags || []).map(String), until: m.withdrawalEndDateMeat })),
      money: { income, spend, since: since || "", spendByCategory: exp, incomeByCategory: inc },
      unpricedPurchases: (st.purchases || []).filter((p) => p.cost == null || p.cost === "").length,
    };
  }

  async function ensureToken() {
    if (S.token) return S.token;
    const t = S.farmData && S.farmData.boardFeedToken;
    if (t) { S.token = t; return t; }
    const nt = randomToken();
    await S.db.collection("farms").doc(S.farmCode).set({ boardFeedToken: nt }, { merge: true });
    S.token = nt; return nt;
  }

  async function push(force) {
    if (!S.db) return;
    try {
      const body = summary();
      const h = hash(JSON.stringify(body));
      if (!force && h === S.lastHash && Date.now() - S.lastWrite < HOUR) return;
      const token = await ensureToken();
      S.status = "sending"; paint();
      await S.db.collection("boardFeed").doc(token).set(Object.assign({ writtenAt: new Date().toISOString() }, body));
      S.lastHash = h; S.lastWrite = Date.now(); S.status = "ok"; S.err = "";
    } catch (e) { S.status = "error"; S.err = (e && (e.code || e.message)) || String(e); console.error("Board feed failed", e); }
    paint();
  }

  function paint() {
    const el = document.getElementById("board-feed-status"); if (!el) return;
    el.textContent = statusText();
    el.style.color = S.status === "error" ? "var(--heather, #9A3F5C)" : "";
  }
  function statusText() {
    if (S.status === "error") return "Board feed failed: " + S.err;
    if (S.status === "sending") return "Board feed: sending…";
    if (S.status === "ok") { const m = Math.round((Date.now() - S.lastWrite) / 60000); return "Board feed: sent " + (m < 1 ? "just now" : m + " min ago"); }
    return "Board feed: waiting";
  }

  function openPanel() {
    const user = (window.firebase && firebase.auth && firebase.auth().currentUser) || null;
    const old = document.getElementById("bf-panel"); if (old) old.remove();
    const d = document.createElement("div"); d.id = "bf-panel";
    d.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:flex-end;justify-content:center;z-index:9999";
    d.innerHTML = `<div style="background:var(--surface,#fff);color:var(--ink,#1B221D);width:100%;max-width:520px;border-radius:18px 18px 0 0;padding:20px 20px calc(20px + env(safe-area-inset-bottom,0px));font-family:inherit;display:grid;gap:12px">
      <div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:17px">Account &amp; Morning Board</b><button id="bf-x" style="border:0;background:none;font-size:22px;line-height:1;color:inherit">×</button></div>
      <div style="font-size:13px;color:var(--ink-2,#5E6B61)">Signed in as <b>${user ? user.email : "?"}</b><br>Build ${S.build}<br>${statusText()}</div>
      <div style="font-size:13px">Morning Board link code (paste this to Claude once; treat it like a password):</div>
      <div style="display:flex;gap:8px"><input id="bf-tok" readonly value="${S.token || "(created on first save)"}" style="flex:1;min-width:0;font:12px ui-monospace,monospace;padding:8px;border:1px solid var(--hair,#ddd);border-radius:8px;background:var(--fill,#F4F6F1);color:inherit"><button id="bf-copy" style="border:0;border-radius:8px;padding:8px 12px;background:var(--grass,#2F5D3A);color:#fff">Copy</button></div>
      <button id="bf-send" style="border:1px solid var(--hair,#ddd);border-radius:10px;padding:10px;background:none;color:inherit">Send board update now</button>
      <button id="bf-backup" style="border:1px solid var(--hair,#ddd);border-radius:10px;padding:10px;background:none;color:inherit">Download backup (JSON)</button>
      <button id="bf-out" style="border:0;border-radius:10px;padding:10px;background:var(--heather-soft,#F4E2E8);color:var(--heather,#9A3F5C)">Sign out</button>
    </div>`;
    document.body.appendChild(d);
    d.addEventListener("click", (e) => { if (e.target === d) d.remove(); });
    d.querySelector("#bf-x").onclick = () => d.remove();
    d.querySelector("#bf-copy").onclick = async () => { const i = d.querySelector("#bf-tok"); try { await navigator.clipboard.writeText(i.value); d.querySelector("#bf-copy").textContent = "Copied"; } catch (_) { i.select(); } };
    d.querySelector("#bf-send").onclick = async () => { await push(true); d.remove(); openPanel(); };
    d.querySelector("#bf-backup").onclick = () => {
      const st = S.getState();
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), build: S.build, herd: st.herd, finance: st.finance, fields: st.fields, medicine: st.medicine, purchases: st.purchases, keeper: st.keeper, fqa: st.fqa, places: st.places, feed: st.feed, medProducts: st.medProducts }, null, 2)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "farm-ledger-backup-" + new Date().toISOString().slice(0, 10) + ".json"; a.click();
    };
    d.querySelector("#bf-out").onclick = () => { if (confirm("Sign out of Farm Ledger on this device?")) firebase.auth().signOut().then(() => location.reload()); };
  }

  window.BoardFeed = {
    init(db, farmCode, getState, build) { S.db = db; S.farmCode = farmCode; S.getState = getState; S.build = build; },
    onData(farmData) { const first = !S.farmData; S.farmData = farmData || {}; if (S.farmData.boardFeedToken) S.token = S.farmData.boardFeedToken; if (first) schedule(); },
    schedule() { schedule(); },
    statusText, paint, openPanel,
  };
  function schedule() { clearTimeout(S.timer); S.timer = setTimeout(() => push(false), 3000); }
})();
