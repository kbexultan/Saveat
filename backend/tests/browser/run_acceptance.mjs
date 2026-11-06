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
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const [repoDir, evidenceDir] = process.argv.slice(2);
const WEB = "http://localhost:3001";
const API = "http://127.0.0.1:8011";
const PASSWORD = "saveat-test-password";
const A = "customer.a@saveat-test.example.com";
const B = "customer.b@saveat-test.example.com";
const CHROME = process.env.CHROME_PATH ?? (process.platform === "win32"
  ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : "/usr/bin/google-chrome");
const PORT = 9333;

mkdirSync(evidenceDir, { recursive: true });

const { formatPickupDateWindow } = await import(
  pathToFileURL(join(repoDir, "frontend/lib/orders.ts")).href
);
const { SOLD_OUT_MESSAGE, CHECKOUT_NETWORK_ERROR_MESSAGE } = await import(
  pathToFileURL(join(repoDir, "frontend/lib/checkoutErrors.ts")).href
);

const results = [];
const pages = [];
function check(id, description, pass, actual) {
  results.push({ id, description, pass: Boolean(pass), actual });
  console.log(`${pass ? "PASS" : "FAIL"} ${id} ${description} :: ${JSON.stringify(actual)}`);
}

function db(args) {
  const out = execFileSync("uv", ["run", "python", join(import.meta.dirname, "db_tool.py"), ...args.split(" ")], {
    cwd: join(repoDir, "backend"),
    encoding: "utf8",
    windowsHide: true,
  });
  return JSON.parse(out.trim().split("\n").pop());
}

async function apiLogin(email) {
  const r = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (!r.ok) throw new Error(`API login failed (${r.status})`);
  return (await r.json()).access_token;
}

// ---------- CDP plumbing ----------
// Throwaway profile: never the user's real Chrome profile.
const profile = mkdtempSync(join(tmpdir(), "saveat-acceptance-"));
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
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP command timed out: ${method}`));
    }, 10000);
    pending.set(id, {
      resolve: (result) => { clearTimeout(timer); resolve(result); },
      reject: (error) => { clearTimeout(timer); reject(error); },
    });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function newPage() {
  const { browserContextId } = await send("Target.createBrowserContext");
  const { targetId } = await send("Target.createTarget", { url: "about:blank", browserContextId });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const page = { sessionId, browserContextId, console: [], network: [], checkoutRequests: 0, loaderId: null };
  pages.push(page);
  listeners.push((msg) => {
    if (msg.sessionId !== sessionId) return;
    if (msg.method === "Page.frameNavigated" && !msg.params.frame.parentId) page.loaderId = msg.params.frame.loaderId;
    if (msg.method === "Runtime.consoleAPICalled") {
      page.console.push(msg.params.args.map((a) => a.value ?? a.description).join(" "));
    }
    if (msg.method === "Runtime.exceptionThrown") page.console.push(msg.params.exceptionDetails);
    if (msg.method === "Network.responseReceived") {
      const { url, status } = msg.params.response;
      if (url.startsWith(API) || status >= 400) page.network.push({ url, status });
    }
    if (msg.method === "Network.loadingFailed") page.network.push(msg.params);
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
    snapshot = await evaluate(page, "JSON.stringify({url: location.href, text: document.body.innerText.slice(0, 3000)})");
  } catch {}
  throw new Error(`Timed out waiting for: ${label}
--- page ---
${snapshot}`);
}
const bodyText = (page) => evaluate(page, "document.body.innerText");
const waitText = (page, text, timeout) =>
  waitFor(page, `document.body.innerText.includes(${JSON.stringify(text)})`, text, timeout);
async function goto(page, path) {
  const { loaderId, errorText } = await send("Page.navigate", { url: WEB + path }, page.sessionId);
  if (errorText) throw new Error(`Navigation to ${path}: ${errorText}`);
  const deadline = Date.now() + 30000;
  while (page.loaderId !== loaderId && Date.now() < deadline) await sleep(50);
  if (page.loaderId !== loaderId) throw new Error(`Navigation did not commit: ${path}`);
  await waitFor(page, `location.pathname === ${JSON.stringify(path)} && document.readyState === 'complete'`, `load ${path}`);
}
async function shot(page, name) {
  const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }, page.sessionId);
  const file = join(evidenceDir, name);
  writeFileSync(file, Buffer.from(data, "base64"));
  return file;
}
async function clickButton(page, text, scopeText) {
  await waitFor(page, `(() => {
    const scope = ${scopeText ? `[...document.querySelectorAll("article")].find(a => a.innerText.includes(${JSON.stringify(scopeText)}))` : "document"};
    return !!scope && [...scope.querySelectorAll('button')].some(b => !b.disabled &&
      ((b.getAttribute('aria-label') ?? b.innerText).trim() === ${JSON.stringify(text)} || b.innerText.trim() === ${JSON.stringify(text)}));
  })()`, `enabled button ${text}`);
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
  // Token storage precedes /auth/me and router.replace. Navigating earlier
  // can abort that transition or reach the storefront before cart restore.
  await waitFor(page, "location.pathname === '/' && !!document.querySelector('a[aria-label=\"Открыть профиль\"]')", "completed login redirect");
}

async function holdRequest(page, url, requestStage = "Request") {
  let paused;
  const listener = (msg) => {
    if (msg.sessionId !== page.sessionId || msg.method !== "Fetch.requestPaused") return;
    if (msg.params.request.method === "OPTIONS") {
      void send("Fetch.continueRequest", { requestId: msg.params.requestId }, page.sessionId).catch(console.error);
    } else {
      paused = msg.params;
    }
  };
  listeners.push(listener);
  await send("Fetch.enable", { patterns: [{ urlPattern: url, requestStage }] }, page.sessionId);
  return {
    async wait() {
      const deadline = Date.now() + 30000;
      while (!paused && Date.now() < deadline) await sleep(50);
      if (!paused) throw new Error(`Request never paused: ${url}`);
      return paused;
    },
    async release(fail = false) {
      const { requestId } = await this.wait();
      await send(fail ? "Fetch.failRequest" : "Fetch.continueRequest",
        fail ? { requestId, errorReason: "ConnectionClosed" } : { requestId }, page.sessionId);
      await send("Fetch.disable", {}, page.sessionId);
      listeners.splice(listeners.indexOf(listener), 1);
    },
  };
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

  // Keep auth restoration pending while the real storefront has rendered.
  // A click here used to succeed, then be erased by late cart restoration.
  const auth = await holdRequest(a, `${API}/auth/me`);
  await goto(a, "/");
  await waitText(a, "Test croissant");
  await auth.wait();
  check("CART-RESTORE", "cannot add before the authenticated cart has restored",
    await evaluate(a, `[...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Добавить в корзину')?.disabled`), null);
  await evaluate(a, `[...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Добавить в корзину').click()`);
  check("CART-RESTORE", "pending cart cannot report a successful addition",
    !(await bodyText(a)).includes("Перейти в корзину"), null);
  await auth.release();
  const cardBefore = await storefrontCardText(a);
  await shot(a, "us3-01-storefront-before-3-left.png");

  await clickButton(a, "Увеличить количество", "Test croissant");
  await clickButton(a, "Добавить в корзину", "Test croissant");
  await waitText(a, "Перейти в корзину");
  await clickButton(a, "Перейти в корзину", "Test croissant");
  await waitText(a, "Подтвердить бронирование");
  await shot(a, "us3-02-cart.png");
  await goto(a, "/cart");
  await waitText(a, "Подтвердить бронирование");
  check("CART-RESTORE", "cart survives a full page reload after adding", (await bodyText(a)).includes("Test croissant"), null);
  // Drop the HTTP response only after the real backend committed the order.
  const lostResponse = await holdRequest(a, `${API}/orders/checkout`, "Response");
  await clickButton(a, "Подтвердить бронирование");
  const committed = await lostResponse.wait();
  check("CHECKOUT-RETRY", "first attempt commits before the response is lost", committed.responseStatusCode === 201, committed.responseStatusCode);
  check("CHECKOUT-RETRY", "order is in PostgreSQL before losing the response", db("state").orders === 1, null);
  const savedAttempt = await evaluate(a, "sessionStorage.getItem('saveat_checkout_attempt')");
  await lostResponse.release(true);
  await waitText(a, CHECKOUT_NETWORK_ERROR_MESSAGE);
  await goto(a, "/cart");
  await waitText(a, "Подтвердить бронирование");
  check("CHECKOUT-RETRY", "reload keeps the same retry key and cart",
    await evaluate(a, `sessionStorage.getItem('saveat_checkout_attempt') === ${JSON.stringify(savedAttempt)} && document.body.innerText.includes('Test croissant')`), null);
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
  check("CHECKOUT-RETRY", "retry creates no duplicate order or stock deduction", state.orders === 1 && state.quantity_remaining === 1, state);
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

  const staff = await newPage();
  await login(staff, "owner@saveat-test.example.com");
  await goto(staff, "/business/pickup");
  await waitFor(staff, "!!document.querySelector('input')", "pickup lookup form");
  await evaluate(staff, "document.querySelector('input').focus()");
  await send("Input.insertText", { text: order.pickup_code }, staff.sessionId);
  await clickButton(staff, "Найти");
  await waitText(staff, order.pickup_code);
  await clickButton(staff, "Выдать заказ");
  await waitText(staff, "Заказ успешно выдан.");
  await shot(staff, "pickup-01-business-confirmation.png");
  await goto(a, "/orders");
  await waitText(a, order.pickup_code);
  check("PICKUP", "bakery confirms the code and customer history shows collection", (await bodyText(a)).includes("Получен"), null);
  await send("Target.disposeBrowserContext", { browserContextId: staff.browserContextId });
  await send("Target.disposeBrowserContext", { browserContextId: a.browserContextId });

  // ================= ST4 / US5 (web part) =================
  state = db("seed 1");
  console.log("reseeded", state);
  const b = await newPage();
  await login(b, B);
  await goto(b, "/");
  await waitText(b, "Test croissant");
  await clickButton(b, "Добавить в корзину", "Test croissant");
  await waitText(b, "Перейти в корзину");
  await clickButton(b, "Перейти в корзину", "Test croissant");
  await waitText(b, "Подтвердить бронирование");

  // Customer A takes the last item first (through the API).
  const tokenA = await apiLogin(A);
  const winner = await fetch(`${API}/orders/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ items: [{ offer_id: "5a7ea700-0000-4000-8000-0000000000f1", quantity: 1 }] }),
  });
  check("US5-AC1", "customer A booking succeeds", winner.status === 201, winner.status);
  const winningOrder = await winner.json();

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
  await waitFor(b, "!!document.querySelector('a[aria-label=\"Открыть профиль\"]') && document.body.innerText.includes('SAVEAT')", "storefront loaded", 15000);
  const storefrontAfter = await storefrontCardText(b);
  await shot(b, "us5-02-storefront-after-sold-out.png");
  check("US5-AC2", "storefront no longer offers the sold-out item (matches 0 in DB)", storefrontAfter === null, storefrontAfter);

  // Same tab/device changes from B (cart still populated) to A.
  await evaluate(b, `localStorage.setItem('access_token', ${JSON.stringify(tokenA)})`);
  await goto(b, "/cart");
  await waitText(b, "Корзина пустая");
  check("ACCOUNT-ISOLATION", "new account does not see previous customer's cart",
    !(await evaluate(b, "document.body.innerText")).includes("Test croissant"), null);

  await goto(b, `/orders/${winningOrder.id}`);
  await waitText(b, "Отменить заказ");
  db("start-pickup");
  // The open page still has its earlier snapshot; the API must reject it.
  await clickButton(b, "Отменить заказ");
  await waitText(b, "Время выдачи уже началось. Отменить заказ нельзя.");
  await shot(b, "us8-01-cancellation-rejected.png");
  check("US8-AC2", "late cancellation shows a clear Russian error and keeps stock reserved",
    db("state").quantity_remaining === 0, null);
  await goto(b, `/orders/${winningOrder.id}`);
  await waitText(b, winningOrder.pickup_code);
  check("US8-AC2", "confirmation hides cancellation after pickup starts",
    !(await bodyText(b)).includes("Отменить заказ"), null);
  await goto(b, "/orders");
  await waitText(b, winningOrder.pickup_code);
  check("US8-AC2", "history hides cancellation after pickup starts",
    !(await bodyText(b)).includes("Отменить заказ"), null);
} catch (error) {
  console.error("RUN ERROR", error);
  results.push({ id: "RUN", description: String(error), pass: false });
  for (const [index, page] of pages.entries()) {
    await shot(page, `failure-page-${index}.png`).catch(() => {});
    writeFileSync(join(evidenceDir, `failure-page-${index}.json`), JSON.stringify({
      console: page.console, network: page.network,
      snapshot: await evaluate(page, "({url: location.href, text: document.body.innerText})").catch(String),
    }, null, 2));
  }
} finally {
  writeFileSync(join(evidenceDir, "browser-results.json"), JSON.stringify(results, null, 2));
  ws.close();
  chrome.kill();
  process.exitCode = results.length > 0 && results.every((result) => result.pass) ? 0 : 1;
}
