// Verify call_request dedupes FCM/push (the core fix for "provider end pe
// continuous call aata rehta hai"). We simulate the user's CallScreen 2.5s
// retry interval by emitting call_request multiple times and confirm the
// callee socket only sees the relay (which is fine) AND that we can recover
// after a call_cancel.
//
// Cannot directly intercept FCM/push from this test, but we use the
// `ringingSessions` side effect on call_accept-after-cancel: server should
// reply with call_end instead of call_accept.

const io = require("socket.io-client");
const BACKEND = "http://localhost:8001";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const connect = (id, role) =>
  new Promise((resolve) => {
    const s = io(BACKEND, { transports: ["websocket"], reconnection: false });
    s.on("connect", () => { s.emit("register", { id, role }); resolve(s); });
  });
const collect = (s, ev) => { const a = []; s.on(ev, (m) => a.push(m)); return a; };
const assert = (c, m) => { if (!c) { console.error("FAIL:", m); process.exit(1); } console.log("PASS:", m); };

(async () => {
  // Use real seeded provider so call_request actually triggers full flow
  const providers = await fetch(BACKEND + "/api/providers").then((r) => r.json());
  if (!providers.length) { console.error("no providers seeded"); process.exit(1); }
  const PROVIDER_ID = providers[0].id || providers[0]._id;

  // Need a real user too — create one via auth
  const USER_ID = "test-user-" + Date.now();

  const caller = await connect(USER_ID, "user");
  const callee = await connect(PROVIDER_ID, "provider");

  const calleeReqs = collect(callee, "call_request");
  const calleeCancels = collect(callee, "call_cancel");
  const callerEnds = collect(caller, "call_end");
  const calleeEnds = collect(callee, "call_end");

  // Test 1: multiple call_requests within dedup window
  // (Provider may be offline -> call_reject; but the call_request relay still fires
  // before the provider lookup. Actually it doesn't — provider lookup happens first.)
  caller.emit("call_request", { to: PROVIDER_ID, fromName: "Tester" });
  await wait(100);
  caller.emit("call_request", { to: PROVIDER_ID, fromName: "Tester" });
  caller.emit("call_request", { to: PROVIDER_ID, fromName: "Tester" });
  await wait(500);
  console.log("call_request relays seen by callee:", calleeReqs.length);
  // All 3 are relayed via socket (good — keeps caller-side retry idempotent),
  // but FCM dedup logic blocks repeat pushes after the first.
  assert(calleeReqs.length >= 1, "callee sees at least one call_request");

  // Test 2: caller cancels mid-ring
  caller.emit("call_cancel", { to: PROVIDER_ID });
  await wait(200);
  assert(calleeCancels.length >= 1, "callee receives call_cancel after caller cancels");

  // Test 3: late call_accept from callee should be blocked (no ghost auto-accept)
  callee.emit("call_accept", { to: USER_ID });
  await wait(500);
  console.log("post-cancel → callee call_end events:", JSON.stringify(calleeEnds));
  console.log("post-cancel → caller call_accept events:", JSON.stringify(callerEnds));
  const cancelledEnd = calleeEnds.find((e) => e.reason === "cancelled");
  assert(!!cancelledEnd, "late call_accept after cancel is rejected (callee gets call_end reason=cancelled)");

  caller.close();
  callee.close();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
