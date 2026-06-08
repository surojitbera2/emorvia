// Verifies the FIX for "provider rejects → user keeps ringing":
// After call_reject, any retry call_request from caller should be answered
// with another call_reject (so caller stops retrying) AND must NOT re-fire
// the callee's incoming UI.

const io = require("socket.io-client");
const BACKEND = "http://localhost:8001";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const connect = (id, role) => new Promise((resolve) => {
  const s = io(BACKEND, { transports: ["websocket"], reconnection: false });
  s.on("connect", () => { s.emit("register", { id, role }); resolve(s); });
});
const collect = (s, ev) => { const a = []; s.on(ev, (m) => a.push(m)); return a; };
const assert = (c, m) => { if (!c) { console.error("FAIL:", m); process.exit(1); } console.log("PASS:", m); };

(async () => {
  const providers = await fetch(BACKEND + "/api/providers").then((r) => r.json());
  const PROVIDER_ID = providers[0].id || providers[0]._id;
  const USER_ID = "test-user-reject-" + Date.now();

  const caller = await connect(USER_ID, "user");
  const callee = await connect(PROVIDER_ID, "provider");

  const calleeReqs = collect(callee, "call_request");
  const callerRejects = collect(caller, "call_reject");

  // 1. Initial call
  caller.emit("call_request", { to: PROVIDER_ID, fromName: "Tester" });
  await wait(300);
  assert(calleeReqs.length === 1, "callee gets the initial call_request");

  // 2. Provider rejects
  callee.emit("call_reject", { to: USER_ID, reason: "manual" });
  await wait(300);
  assert(callerRejects.length === 1, "caller gets call_reject (1st)");

  // 3. Caller retry AFTER reject (simulates the 2.5s loop running once more
  //    before the offReject handler clears the interval)
  caller.emit("call_request", { to: PROVIDER_ID, fromName: "Tester" });
  await wait(300);
  // Callee should NOT receive a second call_request
  assert(calleeReqs.length === 1, "callee does NOT re-receive call_request after reject (no infinite ring)");
  // Caller should be re-told it's rejected so the retry stops
  assert(callerRejects.length === 2, "caller gets call_reject again so it stops retrying");
  assert(callerRejects[1].reason === "rejected", "tombstone reject has reason=rejected");

  console.log("\nReject-tombstone protection verified.");
  caller.close();
  callee.close();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
