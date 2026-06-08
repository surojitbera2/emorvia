// Verifies that when caller sends call_end (mid-call hangup), the callee
// reliably receives a call_end socket event — addresses user complaint
// "if user call or chat end in provider side is not disconnected".

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
  const USER_ID = "u-end-" + Date.now();
  const PROV_ID = "p-end-" + Date.now();

  const caller = await connect(USER_ID, "user");
  const callee = await connect(PROV_ID, "provider");

  const calleeEnds = collect(callee, "call_end");
  const calleeChatEnds = collect(callee, "chat_end");

  // call_end relay
  caller.emit("call_end", { to: PROV_ID });
  await wait(200);
  assert(calleeEnds.length === 1, "provider receives call_end after user hangs up");
  assert(calleeEnds[0].from === USER_ID, "call_end carries correct caller id");

  // chat_end relay
  caller.emit("chat_end", { to: PROV_ID, reason: "user_ended" });
  await wait(200);
  assert(calleeChatEnds.length === 1, "provider receives chat_end after user ends chat");
  assert(calleeChatEnds[0].reason === "user_ended", "chat_end carries reason");

  // disconnect propagation: if caller socket dies during a live chat, provider
  // should receive chat_end / call_end via the disconnect handler.
  // Set up an active ringing session via chat_request relay; then close socket.
  // (Skipped here — requires real DB-backed provider; covered by other tests.)

  console.log("\nEnd-call/chat propagation verified.");
  caller.close();
  callee.close();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
