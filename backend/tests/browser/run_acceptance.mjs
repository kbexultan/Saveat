// Browser acceptance checks for US3 / US5 (ST4, ST8).
//
// Drives the real web app in headless Chrome over the DevTools Protocol
// against the guarded test API, so it only ever touches the Docker test
// database. See backend/tests/README.md ("Browser acceptance checks").
//
// Usage: node run_acceptance.mjs <repoDir> <evidenceDir>
// Needs: test DB up, `uv run python -m tests.serve` on :8011 and
// `NEXT_PUBLIC_API_URL=http://127.0.0.1:8011 npx next dev -p 3001`.
// CHROME_PATH overrides the Chrome executable.
import { execSync, spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const [repoDir, evidenceDir] = process.argv.slice(2);
const WEB = "http://localhost:3001";
const API = "http://127.0.0.1:8011";
const PASSWORD = "saveat-test-password";
const A = "customer.a@saveat-test.example.com";
const B = "customer.b@saveat-test.example.com";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9333;

mkdirSync(evidenceDir, { recursive: true });

const { formatPickupDateWindow } = await import(
  pathToFileURL(join(repoDir, "frontend/lib/orders.ts")).href
);
const { SOLD_OUT_MESSAGE } = await import(
  pathToFileURL(join(repoDir, "frontend/lib/checkoutErrors.ts")).href
);

const results = [];
function check(id, description, pass, actual) {
  results.push({ id, description, pass: Boolean(pass), actual });
  console.log(`${pass ? "PASS" : "FAIL"} ${id} ${description} :: ${JSON.stringify(actual)}`);
}

function db(args) {
  const out = execSync(`uv run python "${join(import.meta.dirname, "db_tool.py")}" ${args}`, {
    cwd: join(repoDir, "backend"),
    encoding: "utf8",
  });
  return JSON.parse(out.trim().split("\n").pop());
}

async function apiLogin(email) {
  const r = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  return (await r.json()).access_token;
}

// ---------- CDP plumbing ----------
// Throwaway profile: never the user's real Chrome profile.
const profile = join(tmpdir(), "saveat-acceptance-chrome-profile");
rmSync(profile, { recursive: true, force: true });
const chrome = spawn(CHROME, [
  "--headless=new",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  "--no-first-run",
  "--no-default-browser-check",
  "--window-size=1280,1000",
  "about:blank",
]);

let version;
for (let i = 0; i < 50 && !version; i++) {
  try {
    version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
  } catch {
    await new Promise((r) => setTimeout(r, 200));
  }
}
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));

let nextId = 1;
const pending = new Map();
const listeners = [];
ws.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
  } else if (msg.method) {
    for (const l of listeners) l(msg);
  }
});
function send(method, params = {}, sessionId) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params, sessionId }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function newPage() {
  const { browserContextId } = await send("Target.createBrowserContext");
  const { targetId } = await send("Target.createTarget", { url: "about:blank", browserContextId });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const page = { sessionId, console: [], checkoutRequests: 0 };
  listeners.push((msg) => {
    if (msg.sessionId !== sessionId) return;
    if (msg.method === "Runtime.consoleAPICalled") {
      page.console.push(msg.params.args.map((a) => a.value ?? a.description).join(" "));
    }
    if (msg.method === "Network.requestWillBeSent") {
      const { url, method } = msg.params.request;
      if (url.endsWith("/orders/checkout") && method === "POST") page.checkoutRequests++;
    }
  });
  await send("Page.enable", {}, sessionId);
  await send("Runtime.enable", {}, sessionId);
  await send("Network.enable", {}, sessionId);
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false }, sessionId);
  return page;
}

async function evaluate(page, expression) {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, page.sessionId);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
}
async function waitFor(page, expression, label, timeout = 30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try {
      if (await evaluate(page, expression)) return;
    } catch {}
    await sleep(200);
  }
  let snapshot = "";
  try {
    snapshot = await evaluate(page, "location.href + '\n' + document.body.innerText.slice(0, 1500)");
  } catch {}
  throw new Error(`Timed out waiting for: ${label}
--- page ---
${snapshot}`);
}
const bodyText = (page) => evaluate(page, "document.body.innerText");
const waitText = (page, text, timeout) =>
  waitFor(page, `document.body.innerText.includes(${JSON.stringify(text)})`, text, timeout);
async function goto(page, path) {
  await send("Page.navigate", { url: WEB + path }, page.sessionId);
  await waitFor(page, "document.readyState === 'complete'", `load ${path}`);
}
async function shot(page, name) {
  await sleep(400);
  const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }, page.sessionId);
  const file = join(evidenceDir, name);
  writeFileSync(file, Buffer.from(data, "base64"));
  return file;
}
async function clickButton(page, text, scopeText) {
  const ok = await evaluate(
    page,
    `(() => {
      const scope = ${scopeText ? `[...document.querySelectorAll("article")].find(a => a.innerText.includes(${JSON.stringify(scopeText)}))` : "document"};
      if (!scope) return false;
      const b = [...scope.querySelectorAll("button")].find(b => (b.getAttribute("aria-label") ?? b.innerText).trim() === ${JSON.stringify(text)} || b.innerText.trim() === ${JSON.stringify(text)});
      if (!b || b.disabled) return false;
      b.click();
      return true;
    })()`,
  );
  if (!ok) throw new Error(`Button not clickable: ${text}`);
}
async function login(page, email) {
  await goto(page, "/login");
  await waitFor(page, "!!document.querySelector('input[type=password]')", "login form");
  for (const [selector, value] of [
    ["input[type=email]", email],
    ["input[type=password]", PASSWORD],
  ]) {
    await evaluate(page, `document.querySelector(${JSON.stringify(selector)}).focus()`);
    await send("Input.insertText", { text: value }, page.sessionId);
  }
  await evaluate(page, "document.querySelector('button[type=submit]').click()");
  await waitFor(page, "!!localStorage.getItem('access_token')", "token after login");
}
function storefrontCardText(page) {
  return evaluate(
    page,
    `[...document.querySelectorAll("article")].find(a => a.innerText.includes("Test croissant"))?.innerText ?? null`,
  );
}

try {
  // ================= ST8 / US3 =================
  let state = db("seed 3");
  console.log("seeded", state);
  const a = await newPage();
  await login(a, A);

  await goto(a, "/");
  await waitText(a, "Test croissant");
  const cardBefore = await storefrontCardText(a);
  await shot(a, "us3-01-storefront-before-3-left.png");

  await clickButton(a, "Увеличить количество", "Test croissant");
  await clickButton(a, "Добавить в корзину", "Test croissant");
  await waitText(a, "Перейти в корзину");
  await goto(a, "/cart");
  await waitText(a, "Подтвердить бронирование");
  await shot(a, "us3-02-cart.png");
  await clickButton(a, "Подтвердить бронирование");
  await waitFor(a, "/^\\/orders\\/[0-9a-f-]{36}$/.test(location.pathname)", "confirmation URL");
  await waitText(a, "Код получения");

  const token = await evaluate(a, "localStorage.getItem('access_token')");
  const orderId = await evaluate(a, "location.pathname.split('/').pop()");
  const order = await (await fetch(`${API}/orders/${orderId}`, { headers: { Authorization: `Bearer ${token}` } })).json();
  const confirmation = await bodyText(a);
  await shot(a, "us3-03-confirmation-page.png");
  const window = formatPickupDateWindow(order.pickup_start, order.pickup_end);

  check("US3-AC1", "confirmation page shows order code", confirmation.includes(order.pickup_code), order.pickup_code);
  check("US3-AC1", "confirmation page shows pickup time window", confirmation.includes(window), window);
  check("US3-AC1", "confirmation page shows bakery address", confirmation.includes(order.address), order.address);
  check("US3-AC1", "confirmation page shows bakery name", confirmation.includes(order.business_name), order.business_name);

  state = db("state");
  check("US3-AC2", "database quantity decreased 3 -> 1 after booking 2", state.quantity_remaining === 1, state);

  await goto(a, "/");
  await waitText(a, "Test croissant");
  const cardAfter = await storefrontCardText(a);
  await shot(a, "us3-04-storefront-after-1-left.png");
  check(
    "US3-AC2",
    "storefront shows 'Осталось 3 шт.' before and '1 шт.' after",
    /Осталось\s*3 шт\./.test(cardBefore) && /Осталось\s*1 шт\./.test(cardAfter),
    { before: cardBefore?.match(/Осталось\s*\d+ шт\./)?.[0], after: cardAfter?.match(/Осталось\s*\d+ шт\./)?.[0] },
  );

  await goto(a, "/orders");
  await waitText(a, order.pickup_code);
  const history = await bodyText(a);
  await shot(a, "us3-05-order-history.png");
  check("US3-AC2", "order appears in customer's history", history.includes(order.pickup_code), order.pickup_code);
  check("US3-AC2", "history shows status 'Забронирован'", history.includes("Забронирован"), "Забронирован");

  // ================= ST4 / US5 (web part) =================
  state = db("seed 1");
  console.log("reseeded", state);
  const b = await newPage();
  await login(b, B);
  await goto(b, "/");
  await waitText(b, "Test croissant");
  await clickButton(b, "Добавить в корзину", "Test croissant");
  await waitText(b, "Перейти в корзину");
  await goto(b, "/cart");
  await waitText(b, "Подтвердить бронирование");

  // Customer A takes the last item first (through the API).
  const tokenA = await apiLogin(A);
  const winner = await fetch(`${API}/orders/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ items: [{ offer_id: "5a7ea700-0000-4000-8000-0000000000f1", quantity: 1 }] }),
  });
  check("US5-AC1", "customer A booking succeeds", winner.status === 201, winner.status);

  // Customer B presses the button twice in the same tick.
  b.checkoutRequests = 0;
  await evaluate(
    b,
    `(() => { const btn = [...document.querySelectorAll("button")].find(x => x.innerText.trim() === "Подтвердить бронирование"); btn.click(); btn.click(); })()`,
  );
  await waitFor(b, "!!document.querySelector('[role=alert]')", "error alert");
  const alert = await evaluate(b, "document.querySelector('[role=alert]').innerText.trim()");
  await waitText(b, "Нет в наличии", 10000).catch(() => {});
  const cartAfterError = await bodyText(b);
  await shot(b, "us5-01-sold-out-error-in-cart.png");

  check("US5-AC1", "customer B sees the Russian unavailable-product message", alert === SOLD_OUT_MESSAGE, alert);
  check("US5-AC1", "raw English backend text is not shown", !cartAfterError.includes("is unavailable"), null);
  check("US5-AC1", "customer B stays on the cart with the item kept", (await evaluate(b, "location.pathname")) === "/cart" && cartAfterError.includes("Test croissant"), null);
  check(
    "US5-AC2",
    "cart shows the live stock after the conflict (no stale 'Осталось: 1 шт.')",
    cartAfterError.includes("Нет в наличии") && !cartAfterError.includes("Осталось: 1 шт."),
    cartAfterError.match(/Нет в наличии|Осталось: \d+ шт\./)?.[0] ?? null,
  );
  check("US5-AC1", "double click sends one checkout request", b.checkoutRequests === 1, b.checkoutRequests);
  check(
    "US5-AC1",
    "raw 409 logged to the dev console only",
    b.console.some((m) => m.includes("[checkout] failed") && m.includes("409")),
    b.console.filter((m) => m.includes("[checkout]")),
  );

  state = db("state");
  check("US5-AC1", "only one order exists in the database", state.orders === 1, state);
  check("US5-AC2", "database quantity is 0 and never negative", state.quantity_remaining === 0 && state.min_quantity >= 0, state);

  await goto(b, "/");
  await waitFor(b, "document.body.innerText.length > 0 && !document.body.innerText.includes('Загруж')", "storefront loaded", 15000);
  await sleep(1500);
  const storefrontAfter = await storefrontCardText(b);
  await shot(b, "us5-02-storefront-after-sold-out.png");
  check("US5-AC2", "storefront no longer offers the sold-out item (matches 0 in DB)", storefrontAfter === null, storefrontAfter);
} catch (error) {
  console.error("RUN ERROR", error);
  results.push({ id: "RUN", description: String(error), pass: false });
} finally {
  writeFileSync(join(evidenceDir, "browser-results.json"), JSON.stringify(results, null, 2));
  ws.close();
  chrome.kill();
}
