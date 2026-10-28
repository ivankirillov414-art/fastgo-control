(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key3 of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key3) && key3 !== except)
          __defProp(to, key3, { get: () => from[key3], enumerable: !(desc = __getOwnPropDesc(from, key3)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // warehouse-desktop/update-clock.cjs
  var require_update_clock = __commonJS({
    "warehouse-desktop/update-clock.cjs"(exports, module) {
      function createDailyCheck2({ read, write: write2, check, now = () => Date.now() }) {
        let last = read() || "", running = false;
        return async function daily() {
          const local = new Date(now() + 5 * 60 * 60 * 1e3), day = local.toISOString().slice(0, 10);
          if (running || local.getUTCHours() < 18 || last >= day) return false;
          running = true;
          last = day;
          try {
            write2(day);
            await check();
            return true;
          } finally {
            running = false;
          }
        };
      }
      module.exports = { createDailyCheck: createDailyCheck2 };
    }
  });

  // warehouse/scan-normalize.js
  var keys = { \u0439: "q", \u0446: "w", \u0443: "e", \u043A: "r", \u0435: "t", \u043D: "y", \u0433: "u", \u0448: "i", \u0449: "o", \u0437: "p", \u0445: "[", \u044A: "]", \u0444: "a", \u044B: "s", \u0432: "d", \u0430: "f", \u043F: "g", \u0440: "h", \u043E: "j", \u043B: "k", \u0434: "l", \u0436: ";", \u044D: "'", \u044F: "z", \u0447: "x", \u0441: "c", \u043C: "v", \u0438: "b", \u0442: "n", \u044C: "m", \u0431: ",", \u044E: ".", \u0451: "`" };
  var shifted = { "[": "{", "]": "}", ";": ":", "'": '"', ",": "<", ".": ">", "`": "~" };
  var punctuation = { '"': "@", "\u2116": "#", ";": "$", ":": "^", "?": "&", ".": "/", ",": "?", "/": "|" };
  var clean = (value) => String(value != null ? value : "").replace(/^[\x00-\x20\uFEFF]+|[\x00-\x20]+$/g, "");
  var aim = (value) => value.replace(/^\][a-z][0-9]/i, "");
  function normalizeScan(value) {
    const raw = clean(value);
    if (/[а-яё]/i.test(raw)) {
      const mapped = aim([...raw].map((c) => {
        const low = c.toLowerCase(), key3 = keys[low];
        if (key3) return c === low ? key3 : shifted[key3] || key3.toUpperCase();
        return punctuation[c] || c;
      }).join(""));
      if (/^(?:FGP-\d|FGC-|FGPARTS1\.|https?:\/\/)/i.test(mapped)) return mapped;
    }
    return aim(raw);
  }

  // warehouse/client.js
  var BASE = "https://oqgpjfikjpcplnxueoki.supabase.co";
  var KEY = "sb_publishable_-aVkOpeHXncVZhF2jPuG5w_4DkRYqji";
  var STORE = "fastgo_warehouse_session_v1";
  var unified = new URLSearchParams(location.search).get("unified") === "1";
  var SESSION_KEY = unified ? "fastgo_workshop_session" : STORE;
  var session;
  try {
    session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch (e) {
  }
  var userId = () => (session == null ? void 0 : session.user_id) || "";
  var esc = (v) => String(v != null ? v : "").replace(/[&<>"']/g, (x) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[x]);
  var money = (n) => Number(n || 0).toLocaleString("ru-RU", { style: "currency", currency: "RUB" });
  var refreshing;
  async function request(path, body, auth) {
    let r;
    try {
      r = await fetch(BASE + path, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json", ...auth ? { Authorization: "Bearer " + auth } : {} }, body: JSON.stringify(body), signal: (() => {
        if (typeof AbortController === "undefined") return void 0;
        const c = new AbortController();
        setTimeout(() => c.abort(), 3e4);
        return c.signal;
      })() });
    } catch (e) {
      throw Error("\u041D\u0435\u0442 \u0441\u0432\u044F\u0437\u0438. \u0414\u0430\u043D\u043D\u044B\u0435 \u043D\u0435 \u0443\u0434\u0430\u043B\u0435\u043D\u044B. \u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0435 \u043F\u043E\u0441\u043B\u0435 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F.");
    }
    let j;
    try {
      j = await r.json();
    } catch (e) {
      throw Error("\u0421\u0435\u0440\u0432\u0435\u0440 \u0432\u0435\u0440\u043D\u0443\u043B \u043D\u0435\u043F\u043E\u043B\u043D\u044B\u0439 \u043E\u0442\u0432\u0435\u0442. \u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0435 \u043F\u043E\u043F\u044B\u0442\u043A\u0443.");
    }
    if (!r.ok) {
      const code = j.error_code || j.code, msg = j.error_description || j.msg || j.message || j.error || "\u041E\u0448\u0438\u0431\u043A\u0430 \u0441\u0435\u0440\u0432\u0438\u0441\u0430", known = { invalid_credentials: "\u041D\u0435\u0432\u0435\u0440\u043D\u0430\u044F \u043F\u043E\u0447\u0442\u0430 \u0438\u043B\u0438 \u043F\u0430\u0440\u043E\u043B\u044C. \u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439\u0442\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u0432\u0445\u043E\u0434\u0430 \u0438\u0437 FastGo \u0421\u0435\u0440\u0432\u0438\u0441.", email_not_confirmed: "\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0435 \u043F\u043E\u0447\u0442\u0443 \u0434\u043B\u044F \u0432\u0445\u043E\u0434\u0430.", over_request_rate_limit: "\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u043C\u043D\u043E\u0433\u043E \u043F\u043E\u043F\u044B\u0442\u043E\u043A. \u041F\u043E\u0434\u043E\u0436\u0434\u0438\u0442\u0435 \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u043C\u0438\u043D\u0443\u0442." };
      throw Object.assign(Error(known[code] || { "Invalid login credentials": known.invalid_credentials }[msg] || msg), { status: r.status });
    }
    return j;
  }
  function save(j) {
    var _a3;
    session = { access_token: j.access_token, refresh_token: j.refresh_token, user_id: ((_a3 = j.user) == null ? void 0 : _a3.id) || (session == null ? void 0 : session.user_id), expires_at: j.expires_at || Math.floor(Date.now() / 1e3) + j.expires_in };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
  async function login(email, password) {
    save(await request("/auth/v1/token?grant_type=password", { email, password }));
  }
  async function logout() {
    const token = session == null ? void 0 : session.access_token;
    session = null;
    localStorage.removeItem(SESSION_KEY);
    if (token) await request("/auth/v1/logout?scope=local", {}, token).catch(() => {
    });
  }
  var serviceActions = /* @__PURE__ */ new Set(["catalog_save", "label_targets", "label_enqueue", "inventory_edit", "preorders", "preorder_get", "preorder_suggestions", "preorder_save", "catalog", "me", "part_save", "stock", "part_photos", "part_photo_url", "part_photo_upload", "part_photo_primary"]);
  var serviceApi = (action, params = {}) => {
    if (!serviceActions.has(action)) throw Error("\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u044F \u043A\u0430\u0442\u0430\u043B\u043E\u0433\u0430");
    return api("service_" + action, params);
  };
  async function api(action, params = {}) {
    if (!session) throw Object.assign(Error("\u0412\u043E\u0439\u0434\u0438\u0442\u0435 \u0432 FastGo"), { status: 401 });
    if (session.expires_at * 1e3 < Date.now() + 6e4) {
      if (!refreshing) refreshing = request("/auth/v1/token?grant_type=refresh_token", { refresh_token: session.refresh_token }).then(save).finally(() => refreshing = null);
      await refreshing;
    }
    if (action.startsWith("service_")) {
      const operation2 = action.slice(8);
      if (!serviceActions.has(operation2)) throw Error("\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u044F \u043A\u0430\u0442\u0430\u043B\u043E\u0433\u0430");
      return (await request("/functions/v1/fastgo-workshop-api", { action: operation2, params }, session.access_token)).data;
    }
    return (await request("/functions/v1/fastgo-warehouse", { ...params, action }, session.access_token)).data;
  }
  async function avitoApi(action, params = {}) {
    if (!session) throw Object.assign(Error("\u0412\u043E\u0439\u0434\u0438\u0442\u0435 \u0432 FastGo"), { status: 401 });
    if (session.expires_at * 1e3 < Date.now() + 6e4) {
      if (!refreshing) refreshing = request("/auth/v1/token?grant_type=refresh_token", { refresh_token: session.refresh_token }).then(save).finally(() => refreshing = null);
      await refreshing;
    }
    return (await request("/functions/v1/fastgo-avito", { action, ...params }, session.access_token)).data;
  }
  var uuid = () => crypto.randomUUID ? crypto.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (Number(c) ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> Number(c) / 4).toString(16));
  function matchBarcode(parts2, value) {
    const find = (code) => parts2.filter((x) => String(x.barcode || "").toUpperCase() === code || String(x.sku || "").toUpperCase() === code || x.id.toUpperCase() === code), raw = String(value).trim().toUpperCase(), exact = find(raw);
    return exact.length ? exact : find(normalizeScan(value).toUpperCase());
  }

  // warehouse/final-report.js
  var names = { cash: "\u041D\u0430\u043B\u0438\u0447\u043D\u044B\u0435", transfer: "\u041F\u0435\u0440\u0435\u0432\u043E\u0434", card: "\u0411\u0435\u0437\u043D\u0430\u043B\u0438\u0447\u043D\u044B\u0435" };
  function mountFinalReport({ root, call: call2 }) {
    let disposed = false, revision = 0;
    root.classList.add("final-report");
    root.innerHTML = '<div class="toolbar"><h1>\u0418\u0442\u043E\u0433\u043E\u0432\u044B\u0439 \u043E\u0442\u0447\u0451\u0442</h1><button type="button" data-refresh>\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C</button></div><form data-period><label>\u0421 \u0434\u0430\u0442\u044B<input type="date" name="from"></label><label>\u041F\u043E \u0434\u0430\u0442\u0443<input type="date" name="to"></label><button>\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C</button><button type="button" data-all>\u0417\u0430 \u0432\u0441\u0451 \u0432\u0440\u0435\u043C\u044F</button></form><p data-report-status role="status"></p><div class="report-total">\u0412\u0441\u0435 \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u0438 <strong data-grand-total>\u2014</strong><span data-count></span></div><div data-groups></div>';
    const $2 = (s) => root.querySelector(s), form = $2("[data-period]");
    const parameters = () => {
      const from = form.elements.from.value, to = form.elements.to.value;
      const date2 = (v) => /* @__PURE__ */ new Date(v + "T00:00:00");
      const end = to ? date2(to) : null;
      if (end) end.setDate(end.getDate() + 1);
      return { ...from ? { from: date2(from).toISOString() } : {}, ...end ? { to: end.toISOString() } : {} };
    };
    const row = (x) => '<article class="report-operation"><time>' + esc(new Date(x.created_at).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })) + "</time><div><b>" + esc(x.title) + "</b>" + (x.note ? "<small>" + esc(x.note) + "</small>" : "") + "<small>" + esc(x.actor) + "</small></div><strong>" + money(x.amount) + "</strong></article>";
    async function refresh() {
      const current = ++revision, opened = new Set([...root.querySelectorAll("details[open]")].map((x) => x.dataset.method));
      $2("[data-report-status]").textContent = "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u043F\u0440\u043E\u0432\u0435\u0434\u0451\u043D\u043D\u044B\u0435 \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u0438\u2026";
      $2("[data-refresh]").disabled = true;
      try {
        const data = await call2("final_report", parameters());
        if (disposed || current !== revision) return;
        $2("[data-grand-total]").textContent = money(data.total);
        $2("[data-count]").textContent = "\u041E\u043F\u0435\u0440\u0430\u0446\u0438\u0439: " + data.count;
        $2("[data-groups]").innerHTML = data.groups.map((g) => '<details data-method="' + g.method + '"' + (opened.has(g.method) ? " open" : "") + "><summary><span>" + names[g.method] + "<small>" + g.count + " \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u0439</small></span><strong>" + money(g.total) + '</strong><span class="report-chevron" aria-hidden="true">\u25B6</span></summary><div class="report-operations">' + (g.items.map(row).join("") || "<p>\u041E\u043F\u0435\u0440\u0430\u0446\u0438\u0439 \u043D\u0435\u0442.</p>") + "</div>" + (g.items.length < g.count ? '<button type="button" data-more="' + g.method + '" data-offset="' + g.items.length + '">\u0415\u0449\u0451 \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u0438</button>' : "") + "</details>").join("");
        $2("[data-report-status]").textContent = "\u041F\u0440\u043E\u0432\u0435\u0434\u0451\u043D\u043D\u044B\u0435 \u043F\u0440\u043E\u0434\u0430\u0436\u0438 \u0438 \u043E\u043F\u043B\u0430\u0442\u044B \u0440\u0430\u0431\u043E\u0442, \u0440\u0435\u043C\u043E\u043D\u0442\u043E\u0432 \u0438 \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F. \u0412\u044B\u0434\u0430\u0447\u0430 \u0437\u0430\u043F\u0447\u0430\u0441\u0442\u0435\u0439 \u043C\u0430\u0441\u0442\u0435\u0440\u0443 \u043D\u0435 \u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u043E\u043F\u043B\u0430\u0442\u043E\u0439.";
        root.querySelectorAll("[data-more]").forEach((button) => button.onclick = async () => {
          button.disabled = true;
          try {
            const data2 = await call2("final_report", { ...parameters(), method: button.dataset.more, offset: Number(button.dataset.offset) });
            if (disposed || current !== revision) return;
            const group = data2.groups.find((g) => g.method === button.dataset.more);
            button.previousElementSibling.insertAdjacentHTML("beforeend", group.items.map(row).join(""));
            button.dataset.offset = String(Number(button.dataset.offset) + group.items.length);
            button.hidden = Number(button.dataset.offset) >= group.count;
          } catch (e) {
            $2("[data-report-status]").textContent = e.message;
          } finally {
            button.disabled = false;
          }
        });
      } catch (e) {
        if (!disposed && current === revision) $2("[data-report-status]").textContent = "\u041E\u0442\u0447\u0451\u0442 \u043D\u0435 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D: " + e.message;
      } finally {
        if (!disposed && current === revision) $2("[data-refresh]").disabled = false;
      }
    }
    form.onsubmit = (e) => {
      e.preventDefault();
      void refresh();
    };
    $2("[data-refresh]").onclick = refresh;
    $2("[data-all]").onclick = () => {
      form.reset();
      void refresh();
    };
    return { ready: refresh(), dispose() {
      disposed = true;
      revision++;
    } };
  }

  // warehouse/services.js
  function mountServices({ root, call: call2, editor, message: message2 }) {
    root.classList.add("service-workspace");
    let services = [], pending2 = null, dirty = false;
    root.innerHTML = '<div class="toolbar"><h1>\u0420\u0435\u043C\u043E\u043D\u0442\u043D\u044B\u0435 \u0440\u0430\u0431\u043E\u0442\u044B</h1>' + (editor ? '<button type="button" data-new>+ \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0440\u0430\u0431\u043E\u0442\u0443</button>' : "") + '</div><p>\u041E\u0431\u0449\u0438\u0439 \u043F\u0440\u0430\u0439\u0441 \u0441\u0435\u0440\u0432\u0438\u0441\u0430 \u0438 \u0441\u043A\u043B\u0430\u0434\u0430. \u0418\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435 \u0446\u0435\u043D\u044B \u043D\u0435 \u043C\u0435\u043D\u044F\u0435\u0442 \u0440\u0430\u043D\u0435\u0435 \u043F\u0440\u043E\u0432\u0435\u0434\u0451\u043D\u043D\u044B\u0435 \u043E\u043F\u043B\u0430\u0442\u044B.</p><div data-editor></div><input type="search" data-search placeholder="\u041F\u043E\u0438\u0441\u043A \u0440\u0430\u0431\u043E\u0442\u044B"><div data-list></div>';
    const $2 = (s) => root.querySelector(s);
    window.fastgoServiceCatalogDirty = () => root.isConnected && dirty;
    function draw() {
      const q = $2("[data-search]").value.trim().toLowerCase();
      $2("[data-list]").innerHTML = services.filter((x) => x.title.toLowerCase().includes(q)).map((x) => '<div class="row"><span>' + esc(x.title) + "</span><strong>" + money(x.labor_price) + "</strong>" + (editor ? '<button type="button" data-edit="' + esc(x.id) + '">\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C</button>' : "") + "</div>").join("") || "<p>\u0420\u0430\u0431\u043E\u0442 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442.</p>";
      root.querySelectorAll("[data-edit]").forEach((b) => b.onclick = () => edit(services.find((x) => x.id === b.dataset.edit)));
    }
    function edit(item) {
      var _a3;
      if (pending2) {
        message2("\u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0435: \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043F\u0440\u043E\u0448\u043B\u043E\u0433\u043E \u0437\u0430\u043F\u0440\u043E\u0441\u0430 \u043F\u043E\u043A\u0430 \u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u0435\u043D.", true);
        return;
      }
      dirty = true;
      $2("[data-editor]").innerHTML = '<form class="panel"><h2>' + (item ? "\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u0440\u0430\u0431\u043E\u0442\u0443" : "\u041D\u043E\u0432\u0430\u044F \u0440\u0430\u0431\u043E\u0442\u0430") + '</h2><label>\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435<input name="title" maxlength="200" required value="' + esc((item == null ? void 0 : item.title) || "") + '"></label><label>\u0421\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C, \u20BD<input name="price" type="number" min="0" max="100000000" step="0.01" required value="' + ((_a3 = item == null ? void 0 : item.labor_price) != null ? _a3 : "") + '"></label><div class="actions"><button class="primary">\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C</button><button type="button" data-cancel>\u041E\u0442\u043C\u0435\u043D\u0430</button></div><p role="status" data-error></p></form>';
      const form = $2("form");
      $2("[data-cancel]").onclick = () => {
        if (pending2) return;
        dirty = false;
        $2("[data-editor]").innerHTML = "";
      };
      form.onsubmit = async (e) => {
        e.preventDefault();
        if (!form.reportValidity()) return;
        let p = pending2;
        if (!p) {
          p = { request_id: uuid(), id: (item == null ? void 0 : item.id) || uuid(), title: form.elements.title.value.trim(), labor_price: Number(form.elements.price.value), create: !item, ...item ? { expected_title: item.title, expected_price: item.labor_price } : {} };
          pending2 = p;
        }
        form.querySelectorAll("input,button").forEach((x) => x.disabled = true);
        try {
          await call2("work_catalog_save", p);
          pending2 = null;
          dirty = false;
          services = await call2("work_catalog");
          $2("[data-editor]").innerHTML = "";
          draw();
          message2("\u041F\u0440\u0430\u0439\u0441 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D");
        } catch (error) {
          $2("[data-error]").textContent = error.message;
          if (error.status && error.status < 500) {
            pending2 = null;
          }
          form.querySelectorAll("input").forEach((x) => x.disabled = !!pending2);
          form.querySelectorAll("button").forEach((x) => x.disabled = false);
        }
      };
    }
    $2("[data-search]").oninput = draw;
    if ($2("[data-new]")) $2("[data-new]").onclick = () => edit(null);
    return { ready: call2("work_catalog").then((x) => {
      services = x;
      draw();
    }), dispose() {
      window.fastgoServiceCatalogDirty = () => false;
    } };
  }
  function mountManualPayment({ root, call: call2, load: load2, save: save3, home: home2, message: message2 }) {
    root.classList.add("service-workspace", "manual-payment-workspace");
    let catalog2 = [], draft2 = load2("manual-service-payment") || { id: uuid(), items: [], method: "", total: "" }, paying = false;
    const persist2 = () => save3("manual-service-payment", draft2);
    const $2 = (s) => root.querySelector(s);
    root.innerHTML = '<div class="live-heading"><button type="button" data-back>\u2190 \u041A \u043E\u043F\u043B\u0430\u0442\u0435</button><h1>\u0420\u0443\u0447\u043D\u0430\u044F \u043E\u043F\u043B\u0430\u0442\u0430 \u0440\u0430\u0431\u043E\u0442</h1></div><p>\u0411\u0435\u0437 \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u044F \u043A\u043B\u0438\u0435\u043D\u0442\u0430 \u0438 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438 \u0440\u0435\u043C\u043E\u043D\u0442\u0430. \u041E\u0441\u0442\u0430\u0442\u043A\u0438 \u0437\u0430\u043F\u0447\u0430\u0441\u0442\u0435\u0439 \u043D\u0435 \u043C\u0435\u043D\u044F\u044E\u0442\u0441\u044F.</p><div class="manual-payment-grid"><section><form data-add class="panel"><label>\u0420\u0430\u0431\u043E\u0442\u0430<input name="work" list="service-choices" maxlength="200" autocomplete="off" required placeholder="\u041D\u0430\u0447\u043D\u0438\u0442\u0435 \u0432\u0432\u043E\u0434\u0438\u0442\u044C \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435"><datalist id="service-choices"></datalist></label><label>\u0421\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C, \u20BD<input name="price" type="number" min="0" max="100000000" step="0.01" required></label><button>\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0440\u0430\u0431\u043E\u0442\u0443</button></form><div data-lines></div></section><form data-payment class="panel"><label>\u0421\u0443\u043C\u043C\u0430 \u043A \u043E\u043F\u043B\u0430\u0442\u0435, \u20BD<input name="total" type="number" min="0.01" max="100000000" step="0.01" required></label><fieldset class="payment-options"><legend>\u0421\u043F\u043E\u0441\u043E\u0431 \u043E\u043F\u043B\u0430\u0442\u044B</legend>' + [["cash", "\u041D\u0430\u043B\u0438\u0447\u043D\u044B\u0435"], ["card", "\u0411\u0435\u0437\u043D\u0430\u043B\u0438\u0447\u043D\u044B\u0439 \u0440\u0430\u0441\u0447\u0451\u0442"], ["transfer", "\u041F\u0435\u0440\u0435\u0432\u043E\u0434"]].map(([v, n]) => '<label><input type="radio" name="method" value="' + v + '" required>' + n + "</label>").join("") + '</fieldset><button class="primary" data-submit>\u041F\u0440\u0438\u043D\u044F\u0442\u044C \u043E\u043F\u043B\u0430\u0442\u0443</button><button type="button" data-cancel>\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C \u043E\u043F\u043B\u0430\u0442\u0443</button><p data-payment-error role="status"></p></form></div>';
    function state() {
      root.querySelectorAll("input,button").forEach((x) => x.disabled = paying || !!draft2.pending);
      $2("[data-submit]").disabled = paying || !draft2.items.length;
      $2("[data-back]").disabled = paying || !!draft2.pending;
      $2("[data-cancel]").disabled = paying || !!draft2.pending;
      root.querySelectorAll("button").forEach((x) => x.dataset.unavailable = String(x.disabled));
      $2("[data-submit]").textContent = draft2.pending ? "\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043E\u043F\u043B\u0430\u0442\u044B" : "\u041F\u0440\u0438\u043D\u044F\u0442\u044C \u043E\u043F\u043B\u0430\u0442\u0443";
      if (draft2.pending && !paying && !$2("[data-payment-error]").textContent) $2("[data-payment-error]").textContent = "\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043E\u043F\u043B\u0430\u0442\u044B \u0435\u0449\u0451 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D. \u041F\u043E\u043B\u044F \u0437\u0430\u0449\u0438\u0449\u0435\u043D\u044B \u043E\u0442 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0439. \u041D\u0430\u0436\u043C\u0438\u0442\u0435 \xAB\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043E\u043F\u043B\u0430\u0442\u044B\xBB \u2014 \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u043E\u0433\u043E \u0441\u043F\u0438\u0441\u0430\u043D\u0438\u044F \u043D\u0435 \u0431\u0443\u0434\u0435\u0442.";
    }
    function draw() {
      const gross = Math.round(draft2.items.reduce((s, x) => s + x.quantity * x.unit_price, 0) * 100) / 100;
      $2("[data-lines]").innerHTML = draft2.items.map((x, i) => '<div class="row"><span>' + esc(x.title) + "</span><strong>" + money(x.unit_price) + '</strong><button type="button" data-remove="' + i + '">\u0423\u0434\u0430\u043B\u0438\u0442\u044C</button></div>').join("");
      const form = $2("[data-payment]");
      form.elements.total.value = draft2.total === "" ? gross : draft2.total;
      for (const x of form.querySelectorAll("[name=method]")) x.checked = x.value === draft2.method;
      root.querySelectorAll("[data-remove]").forEach((b) => b.onclick = () => {
        if (draft2.pending) return;
        draft2.items.splice(Number(b.dataset.remove), 1);
        draft2.total = "";
        persist2();
        draw();
      });
      state();
    }
    const add = $2("[data-add]");
    add.elements.work.value = draft2.work || "";
    add.elements.price.value = draft2.price || "";
    add.elements.price.oninput = () => {
      draft2.price = add.elements.price.value;
      persist2();
    };
    add.elements.work.oninput = () => {
      draft2.work = add.elements.work.value;
      const selected = catalog2.find((x) => x.title === add.elements.work.value);
      if (selected) add.elements.price.value = selected.labor_price;
      draft2.price = add.elements.price.value;
      persist2();
    };
    add.onsubmit = (e) => {
      e.preventDefault();
      if (draft2.pending || !add.reportValidity()) return;
      const title = add.elements.work.value.trim(), selected = catalog2.find((x) => x.title === title), before = JSON.parse(JSON.stringify(draft2));
      try {
        draft2.items.push({ title, quantity: 1, unit_price: Number(add.elements.price.value), ...selected ? { service_id: selected.id } : {} });
        draft2.total = "";
        delete draft2.work;
        delete draft2.price;
        persist2();
        add.reset();
        draw();
        add.elements.work.focus();
      } catch (error) {
        draft2 = before;
        message2("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0447\u0435\u0440\u043D\u043E\u0432\u0438\u043A: " + error.message, true);
      }
    };
    const payment = $2("[data-payment]");
    payment.oninput = () => {
      if (draft2.pending) return;
      draft2.total = payment.elements.total.value;
      draft2.method = payment.elements.method.value;
      persist2();
    };
    payment.onsubmit = async (e) => {
      e.preventDefault();
      if (paying || !payment.reportValidity() || !draft2.items.length) return;
      const p = draft2.pending || { request_id: draft2.id, items: draft2.items, payment_method: payment.elements.method.value, total_override: Number(payment.elements.total.value) };
      try {
        draft2.pending = p;
        persist2();
        paying = true;
        state();
        $2("[data-payment-error]").textContent = "\u0421\u043E\u0445\u0440\u0430\u043D\u044F\u0435\u043C \u043E\u043F\u043B\u0430\u0442\u0443\u2026";
        const result = await call2("work_payment", p);
        save3("manual-service-payment", null);
        draft2 = { id: uuid(), items: [], method: "", total: "" };
        home2();
        message2("\u041E\u043F\u043B\u0430\u0442\u0430 \u0440\u0430\u0431\u043E\u0442 \u043F\u0440\u0438\u043D\u044F\u0442\u0430: " + money(result.total));
      } catch (error) {
        $2("[data-payment-error]").textContent = error.message;
        if (error.status && error.status < 500) {
          delete draft2.pending;
          persist2();
        }
      } finally {
        paying = false;
        if (root.isConnected) state();
      }
    };
    $2("[data-back]").onclick = () => home2();
    $2("[data-cancel]").onclick = () => {
      if (draft2.pending || paying) return;
      save3("manual-service-payment", null);
      draft2 = { id: uuid(), items: [], method: "", total: "" };
      home2();
      message2("\u0420\u0443\u0447\u043D\u0430\u044F \u043E\u043F\u043B\u0430\u0442\u0430 \u043E\u0442\u043C\u0435\u043D\u0435\u043D\u0430. \u0414\u0435\u043D\u044C\u0433\u0438 \u0438 \u043E\u0441\u0442\u0430\u0442\u043A\u0438 \u043D\u0435 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u044B.");
    };
    draw();
    return { ready: call2("work_catalog").then((x) => {
      catalog2 = x;
      $2("datalist").innerHTML = x.map((s) => '<option value="' + esc(s.title) + '">' + money(s.labor_price) + "</option>").join("");
    }) };
  }

  // warehouse/scan-policy.js
  function scanError(kind, code) {
    if (!kind) return "\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0440\u0430\u0437\u0434\u0435\u043B \u0441\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F";
    const value = String(code || "").trim(), link = /^[a-z][a-z0-9+.-]*:/i.test(value) || /^www\./i.test(value), pickup = value.startsWith("FGPARTS1.");
    if (!value) return "\u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u043A\u043E\u0434";
    if (kind === "repair") {
      try {
        const u = new URL(value);
        if (u.protocol === "https:" && u.hostname === "ivankirillov414-art.github.io" && !u.username && !u.password && (u.pathname === "/fastgo-control/repair-status.html" || u.pathname === "/fastgo-control/workshop.html" && u.hash.startsWith("#order?") && u.hash.includes("kind=repair"))) return "";
      } catch (e) {
      }
      return "\u0412 \u043E\u043F\u043B\u0430\u0442\u0435 \u0440\u0435\u043C\u043E\u043D\u0442\u0430 \u0441\u043A\u0430\u043D\u0438\u0440\u0443\u0439\u0442\u0435 \u0442\u043E\u043B\u044C\u043A\u043E QR \u0440\u0435\u043C\u043E\u043D\u0442\u0430";
    }
    if (kind === "parts") return pickup || !link ? "" : "\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0440\u0430\u0437\u0434\u0435\u043B \xAB\u041E\u043F\u043B\u0430\u0442\u0430 \u0440\u0435\u043C\u043E\u043D\u0442\u0430\xBB";
    if (!["receipt", "sale"].includes(kind)) return "\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0440\u0430\u0437\u0434\u0435\u043B \u0441\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F";
    return pickup ? "QR \u043C\u0430\u0441\u0442\u0435\u0440\u0430 \u043F\u0440\u0438\u043D\u0438\u043C\u0430\u0435\u0442\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u0432 \u0432\u044B\u0434\u0430\u0447\u0435 \u0437\u0430\u043F\u0447\u0430\u0441\u0442\u0435\u0439" : link ? "\u0412 \u044D\u0442\u043E\u043C \u0440\u0430\u0437\u0434\u0435\u043B\u0435 \u0441\u043A\u0430\u043D\u0438\u0440\u0443\u0439\u0442\u0435 \u0448\u0442\u0440\u0438\u0445\u043A\u043E\u0434 \u0442\u043E\u0432\u0430\u0440\u0430. \u0414\u043B\u044F QR \u0440\u0435\u043C\u043E\u043D\u0442\u0430 \u043E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \xAB\u041E\u043F\u043B\u0430\u0442\u0430 \u0440\u0435\u043C\u043E\u043D\u0442\u0430\xBB" : "";
  }

  // warehouse/scanner.js
  function bindScanner(input, form, enabled, { silent = false } = {}) {
    let timer, previous = "", lastAt = 0, burst = 0, disposed = false;
    const editable = (el) => el && (el.matches("input,textarea,select") || el.isContentEditable);
    const reset = () => {
      clearTimeout(timer);
      previous = "";
      lastAt = 0;
      burst = 0;
    };
    const live2 = () => !disposed && input.isConnected && enabled();
    const focus = () => {
      if (live2() && (!editable(document.activeElement) || document.activeElement === input)) {
        input.focus({ preventScroll: true });
      }
    };
    if (silent) {
      input.setAttribute("inputmode", "none");
      input.tabIndex = -1;
    }
    const submit = () => {
      reset();
      if (live2() && input.value.trim()) form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    };
    const onInput = (e) => {
      if (!live2() || e.isComposing) return reset();
      const value = input.value, now = performance.now();
      if (value === previous) return;
      clearTimeout(timer);
      const appended = value.startsWith(previous), added = appended ? value.length - previous.length : value.length;
      if (added <= 0) {
        reset();
        previous = value;
        return;
      }
      burst = appended && now - lastAt <= 65 ? burst + added : added;
      previous = value;
      lastAt = now;
      if (added >= 4 || burst >= 4) timer = setTimeout(() => {
        if (live2() && (silent || document.activeElement === input) && input.value === value) submit();
      }, 200);
    };
    const onKey = (e) => {
      if (!live2() || e.isComposing || e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.target === input && (e.key === "Enter" || e.key === "Tab") && input.value.trim()) {
        e.preventDefault();
        submit();
        return;
      }
      if (!editable(e.target) && e.key && e.key.length === 1) {
        e.preventDefault();
        focus();
        input.setRangeText(e.key, input.selectionStart, input.selectionEnd, "end");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    };
    const onPaste = () => {
      setTimeout(() => {
        if (live2()) onInput({ isComposing: false });
      }, 0);
    };
    const suspend = () => {
      if (silent) {
        reset();
        input.blur();
      }
    };
    const onVisible = () => {
      if (document.hidden) suspend();
      else focus();
    };
    const onClick = (e) => {
      if (!editable(e.target) && !e.target.closest("button,a,label")) focus();
    };
    input.addEventListener("input", onInput);
    input.addEventListener("change", onInput);
    input.addEventListener("compositionend", onInput);
    input.addEventListener("paste", onPaste);
    form.addEventListener("submit", reset, true);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("click", onClick);
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", onVisible);
    focus();
    const paint = requestAnimationFrame(focus);
    return () => {
      disposed = true;
      reset();
      cancelAnimationFrame(paint);
      input.removeEventListener("input", onInput);
      input.removeEventListener("change", onInput);
      input.removeEventListener("compositionend", onInput);
      input.removeEventListener("paste", onPaste);
      form.removeEventListener("submit", reset, true);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("click", onClick);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }

  // warehouse/scanner-diagnostics.js
  function installScannerDiagnostics({ parts: parts2, report = async () => {
  } }) {
    const bridge = window.warehouseDesktop;
    if (!(bridge == null ? void 0 : bridge.scannerStatus)) return;
    const button = document.createElement("button");
    button.textContent = "\u0421\u043A\u0430\u043D\u0435\u0440";
    button.id = "hardware-scanner";
    document.querySelector("header").append(button);
    button.onclick = async () => {
      const dialog = document.createElement("dialog");
      dialog.className = "barcode-print-dialog";
      dialog.setAttribute("aria-label", "\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0441\u043A\u0430\u043D\u0435\u0440\u0430");
      dialog.innerHTML = '<h2>\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0441\u043A\u0430\u043D\u0435\u0440\u0430</h2><div data-devices>\u041F\u0440\u043E\u0432\u0435\u0440\u044F\u0435\u043C \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 Windows\u2026</div><p>\u0421\u043A\u0430\u043D\u0438\u0440\u0443\u0439\u0442\u0435 \u044D\u0442\u0438\u043A\u0435\u0442\u043A\u0438 \u043F\u043E \u043E\u0447\u0435\u0440\u0435\u0434\u0438. \u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043D\u0435 \u0441\u043E\u0437\u0434\u0430\u0451\u0442 \u043F\u0440\u0438\u0445\u043E\u0434 \u0438\u043B\u0438 \u043F\u0440\u043E\u0434\u0430\u0436\u0443.</p><form><label>\u041A\u043E\u0434 \u0441\u043E \u0441\u043A\u0430\u043D\u0435\u0440\u0430<input data-scan autocomplete="off" spellcheck="false"></label><button type="submit">\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u043A\u043E\u0434</button></form><p data-result role="status"></p><button type="button" data-close>\u0417\u0430\u043A\u0440\u044B\u0442\u044C</button>';
      document.body.append(dialog);
      dialog.showModal();
      dialog.querySelector("[data-close]").onclick = () => dialog.close();
      const form = dialog.querySelector("form"), input = dialog.querySelector("[data-scan]"), result = dialog.querySelector("[data-result]");
      form.onsubmit = (e) => {
        e.preventDefault();
        const code = input.value.trim();
        input.value = "";
        if (!code) return;
        const matches = matchBarcode(parts2(), code);
        result.textContent = matches.length === 1 ? "\u0421\u043A\u0430\u043D\u0435\u0440 \u043F\u0435\u0440\u0435\u0434\u0430\u043B \u043A\u043E\u0434 \xB7 " + matches[0].name : "\u041A\u043E\u0434 \u043F\u043E\u043B\u0443\u0447\u0435\u043D, \u0441\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u0439 \u0432 \u043A\u0430\u0442\u0430\u043B\u043E\u0433\u0435: " + matches.length;
        void report({ scan_test: { received: true, matched: matches.length === 1, characters: code.length } }).catch(() => {
        });
      };
      const dispose = bindScanner(input, form, () => dialog.open);
      dialog.onclose = () => {
        dispose();
        dialog.remove();
      };
      try {
        const status = await bridge.scannerStatus();
        if (!dialog.isConnected) return;
        dialog.querySelector("[data-devices]").innerHTML = status.devices.length ? status.devices.map((d) => "<p><b>" + esc(d.name) + "</b><br><small>" + esc(d.kind) + " \xB7 " + esc(d.status) + " \xB7 " + esc(d.hardware) + "</small></p>").join("") : "<p>Windows \u043D\u0435 \u0441\u043E\u043E\u0431\u0449\u0438\u043B\u0430 \u043E \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D\u043D\u043E\u043C USB-\u0441\u043A\u0430\u043D\u0435\u0440\u0435. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u043F\u0438\u0442\u0430\u043D\u0438\u0435 \u0438 \u043A\u0430\u0431\u0435\u043B\u044C.</p>";
        await report({ scanner: status });
      } catch (e) {
        if (dialog.isConnected) dialog.querySelector("[data-devices]").textContent = e.message;
      }
    };
  }

  // warehouse/receipt-labels.js
  function startReceiptLabels({ call: call2, bridge = window.warehouseDesktop, notify = () => {
  } }) {
    if (!(bridge == null ? void 0 : bridge.printReceiptLabels)) return { tick: async () => {
    }, stop() {
    } };
    let running = false, stopped = false, loader;
    async function barcode() {
      if (window.JsBarcode) return;
      if (!loader) loader = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = new URL("vendor/jsbarcode-3.12.3.min.js", document.baseURI).href;
        script.onload = resolve;
        script.onerror = () => reject(Error("\u041D\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u043B\u0441\u044F \u0433\u0435\u043D\u0435\u0440\u0430\u0442\u043E\u0440 \u0448\u0442\u0440\u0438\u0445\u043A\u043E\u0434\u043E\u0432"));
        document.head.append(script);
      }).catch((e) => {
        loader = null;
        throw e;
      });
      await loader;
    }
    async function tick() {
      var _a3, _b, _c, _d, _e;
      if (stopped || running) return;
      running = true;
      try {
        const jobs = await call2("receipt_label_jobs", { label_pipeline: 3 });
        if (!Array.isArray(jobs) || !jobs.length) return;
        await barcode();
        for (const job2 of jobs) {
          if (stopped) return;
          const items = (((_a3 = job2.result) == null ? void 0 : _a3.items) || []).map((part) => {
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            window.JsBarcode(svg, String(part.barcode), { format: "CODE128", displayValue: false, width: 2, height: 72, margin: 0, marginLeft: 20, marginRight: 20, background: "#ffffff", lineColor: "#000000" });
            return { name: part.name, barcode: String(part.barcode), quantity: part.quantity, price: part.retail_price, svg: svg.outerHTML };
          });
          await bridge.printReceiptLabels({ id: job2.id, items, ...((_b = job2.result) == null ? void 0 : _b.printer_name) ? { printer_name: job2.result.printer_name, remember_printer: job2.result.remember_printer === true } : {}, ...((_c = job2.result) == null ? void 0 : _c.width_mm) !== void 0 || ((_d = job2.result) == null ? void 0 : _d.height_mm) !== void 0 ? { widthMm: job2.result.width_mm, heightMm: job2.result.height_mm } : {} });
          await call2("receipt_label_ack", { id: job2.id });
          notify({ ok: true, text: (((_e = job2.payload) == null ? void 0 : _e.kind) === "labels" ? "\u041F\u0435\u0447\u0430\u0442\u044C \u0441 \u0442\u0435\u043B\u0435\u0444\u043E\u043D\u0430" : "\u041F\u0440\u0438\u0445\u043E\u0434 \u043E\u0444\u043E\u0440\u043C\u043B\u0435\u043D") + " \xB7 " + items.reduce((n, x) => n + x.quantity, 0) + " \u044D\u0442\u0438\u043A\u0435\u0442\u043E\u043A \u043F\u0435\u0440\u0435\u0434\u0430\u043D\u043E \u0442\u0435\u0440\u043C\u043E\u043F\u0440\u0438\u043D\u0442\u0435\u0440\u0443" });
        }
      } catch (error) {
        notify({ ok: false, text: "\u042D\u0442\u0438\u043A\u0435\u0442\u043A\u0438 \u043F\u0440\u0438\u0445\u043E\u0434\u0430 \u043E\u0436\u0438\u0434\u0430\u044E\u0442 \u043F\u0435\u0447\u0430\u0442\u0438: " + error.message });
      } finally {
        running = false;
      }
    }
    const timer = setInterval(() => void tick(), 1e4);
    const first = setTimeout(() => void tick(), 2e3);
    window.addEventListener("online", tick);
    return { tick, stop() {
      stopped = true;
      clearTimeout(first);
      clearInterval(timer);
      window.removeEventListener("online", tick);
    } };
  }

  // workshop/notifications.js
  var escape = (value) => String(value != null ? value : "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  var clock = (value) => value ? new Date(value).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
  var styles = ".fg-notice-bell{position:fixed;right:20px;top:76px;z-index:80;width:46px;height:46px;border:1px solid #3c6581;border-radius:50%;background:#152b40;color:#eef7ff;display:grid;place-items:center;box-shadow:0 4px 20px #0004;cursor:pointer}.fg-notice-bell svg{width:23px;height:23px;fill:none;stroke:currentColor;stroke-width:1.7}.fg-notice-bell b{position:absolute;right:-5px;top:-5px;min-width:21px;height:21px;padding:2px 5px;border-radius:14px;background:#008cff;color:white;font:700 12px Arial}.fg-notice-bell b[hidden]{display:none}.fg-notice-drawer{position:fixed;right:16px;top:132px;bottom:20px;width:min(430px,calc(100vw - 32px));z-index:180;border:1px solid #456078;border-radius:16px;background:#122338;color:#edf5ff;box-shadow:0 20px 80px #0009;overflow:auto;padding:20px;font:15px/1.45 Arial,sans-serif}.fg-notice-drawer[hidden]{display:none}.fg-notice-drawer h2{font-size:23px;margin:0 0 8px}.fg-notice-drawer button{cursor:pointer;background:#173c59;color:#edf5ff;border:1px solid #456078;border-radius:9px;padding:10px 14px;font:inherit}.fg-notice-head{display:flex;justify-content:space-between;gap:12px}.fg-notice-drawer .fg-notice-item{display:block;width:100%;text-align:left;margin:10px 0;padding:14px;background:#132e46}.fg-notice-item.unread{border-color:#1c99ff;background:#123858}.fg-notice-item strong,.fg-notice-item span,.fg-notice-item small{display:block;overflow-wrap:anywhere}.fg-notice-item small,.fg-notice-help{color:#aabed0;font-size:13px}.fg-notice-actions{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}.fg-notice-drawer label{display:block;margin:12px 0}.fg-notice-drawer input,.fg-notice-drawer select{box-sizing:border-box;width:100%;margin-top:5px;padding:11px;border:1px solid #456078;border-radius:8px;background:#0c1b2d;color:white}.fg-notice-error{color:#ffb7ac;white-space:pre-wrap}.fg-chat-message{white-space:pre-wrap;overflow-wrap:anywhere;margin:10px 30px 10px 0;padding:10px 14px;border-radius:12px;background:#1b3a54}.fg-chat-message.out{margin:10px 0 10px 30px;background:#1b5265}.fg-notice-toast{position:fixed;right:20px;top:16px;z-index:300;width:min(350px,calc(100vw - 40px));padding:16px 20px;border:1px solid #168dce;border-radius:14px;background:#123449;color:#fff;box-shadow:0 10px 36px #0008;cursor:pointer;font:15px/1.4 Arial,sans-serif}.fg-notice-toast strong,.fg-notice-toast span{display:block}.fg-notice-toast span{margin-top:5px;overflow-wrap:anywhere}.fg-notice-toast small{color:#a5d7f0}@media(max-width:650px){.fg-notice-bell{right:16px;top:70px}.fg-notice-drawer{top:124px;bottom:80px}}";
  function startNotifications({ call: call2, station = async () => null, actor = "" }) {
    var _a3, _b;
    if (((_a3 = window.fastgoNotifications) == null ? void 0 : _a3.actor) === actor) return window.fastgoNotifications;
    (_b = window.fastgoNotifications) == null ? void 0 : _b.stop();
    if (!document.getElementById("fg-notification-style")) {
      const style = document.createElement("style");
      style.id = "fg-notification-style";
      style.textContent = styles;
      document.head.append(style);
    }
    let state = null, busy2 = false, stopped = false, screen2 = "list", selected = "", initialized = false;
    const seenKey = "fastgo_avito_seen:" + actor;
    let seen = /* @__PURE__ */ new Set();
    try {
      seen = new Set(JSON.parse(localStorage.getItem(seenKey) || "[]"));
      initialized = localStorage.getItem(seenKey) !== null;
    } catch (e) {
    }
    const bell = document.createElement("button");
    bell.type = "button";
    bell.className = "fg-notice-bell";
    bell.setAttribute("aria-label", "\u0423\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F \u0410\u0432\u0438\u0442\u043E");
    bell.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><b hidden></b>';
    document.body.append(bell);
    const drawer = document.createElement("section");
    drawer.className = "fg-notice-drawer";
    drawer.hidden = true;
    drawer.setAttribute("aria-label", "\u0423\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F \u0410\u0432\u0438\u0442\u043E");
    document.body.append(drawer);
    const note = (message2, error = false) => {
      const target = drawer.querySelector("[data-notice-state]");
      if (target) {
        target.textContent = message2;
        target.className = error ? "fg-notice-error" : "fg-notice-help";
      }
    };
    const request2 = async (action, p = {}) => {
      const binding = action === "list" ? await station().catch(() => null) : null;
      return call2(action, { ...p, ...binding ? { device_id: binding.id, device_token: binding.token } : {} });
    };
    const mark = async (ids) => {
      if (!ids.length) return;
      await request2("read", { message_ids: ids });
      state.notifications.forEach((n) => {
        if (ids.includes(n.message_id)) n.read = true;
      });
      badge();
    };
    function badge() {
      const unread = ((state == null ? void 0 : state.notifications) || []).filter((n) => !n.read).length, b = bell.querySelector("b");
      b.hidden = !unread;
      b.textContent = unread > 99 ? "99+" : String(unread);
      bell.setAttribute("aria-label", "\u0423\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F \u0410\u0432\u0438\u0442\u043E: " + unread);
    }
    function toast(item) {
      var _a4;
      if ((_a4 = window.warehouseDesktop) == null ? void 0 : _a4.notifyAvito) {
        void window.warehouseDesktop.notifyAvito({ id: item.message_id, title: item.sender + " \xB7 \u0410\u0432\u0438\u0442\u043E", body: item.body, chat_id: item.chat_id }).catch(() => {
        });
        return;
      }
      const old = document.querySelector(".fg-notice-toast");
      old == null ? void 0 : old.remove();
      const el = document.createElement("button");
      el.type = "button";
      el.className = "fg-notice-toast";
      el.innerHTML = "<small>\u0410\u0432\u0438\u0442\u043E \xB7 " + escape(item.title) + "</small><strong>" + escape(item.sender) + "</strong><span>" + escape(item.body.slice(0, 160)) + "</span>";
      el.onclick = () => {
        el.remove();
        void openChat(item);
      };
      document.body.append(el);
      setTimeout(() => el.remove(), 7e3);
    }
    async function refresh() {
      if (busy2 || stopped) return;
      busy2 = true;
      try {
        const next = await request2("list");
        if (stopped) return;
        state = next;
        bell.hidden = false;
        badge();
        const fresh = (next.notifications || []).filter((n) => !seen.has(n.message_id));
        if (initialized && next.popups_allowed) fresh.filter((n) => !n.read).slice().reverse().slice(-5).forEach(toast);
        for (const item of next.notifications || []) seen.add(item.message_id);
        seen = new Set([...seen].slice(-1e3));
        localStorage.setItem(seenKey, JSON.stringify([...seen]));
        initialized = true;
        if (!drawer.hidden && screen2 === "list") drawList();
      } catch (e) {
        if (e.status === 401 || e.status === 403) {
          bell.hidden = true;
          drawer.hidden = true;
        } else if (!drawer.hidden) note(e.message, true);
      } finally {
        busy2 = false;
      }
    }
    function heading(title) {
      drawer.innerHTML = '<div class="fg-notice-head"><h2>' + escape(title) + '</h2><button type="button" data-close aria-label="\u0417\u0430\u043A\u0440\u044B\u0442\u044C \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F">\xD7</button></div><p data-notice-state role="status"></p><div data-notice-content></div>';
      drawer.querySelector("[data-close]").onclick = () => drawer.hidden = true;
      return drawer.querySelector("[data-notice-content]");
    }
    function drawList() {
      var _a4;
      screen2 = "list";
      const host = heading("\u0410\u0432\u0438\u0442\u043E"), notifications2 = (state == null ? void 0 : state.notifications) || [];
      note((state == null ? void 0 : state.connected) ? "\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u043E: " + state.label + (state.last_synced_at ? " \xB7 " + clock(state.last_synced_at) : "") : "\u0410\u0432\u0438\u0442\u043E \u0435\u0449\u0451 \u043D\u0435 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D");
      host.innerHTML = '<div class="fg-notice-actions"><button type="button" data-refresh>\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C</button><button type="button" data-read-all>\u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C \u0432\u0441\u0435</button>' + ((state == null ? void 0 : state.owner) ? '<button type="button" data-settings>\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435</button>' : "") + "</div>" + ((state == null ? void 0 : state.error) ? '<p class="fg-notice-error">' + escape(state.error) + "</p>" : "") + (notifications2.length ? notifications2.map((n, i) => '<button type="button" class="fg-notice-item' + (n.read ? "" : " unread") + '" data-message="' + i + '"><small>' + escape(n.title) + " \xB7 " + clock(n.created_at) + "</small><strong>" + escape(n.sender) + "</strong><span>" + escape(n.body.slice(0, 220)) + "</span></button>").join("") : '<p class="fg-notice-help">\u0417\u0434\u0435\u0441\u044C \u043F\u043E\u044F\u0432\u044F\u0442\u0441\u044F \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F \u043A\u043B\u0438\u0435\u043D\u0442\u043E\u0432 \u0410\u0432\u0438\u0442\u043E.</p>');
      host.querySelector("[data-refresh]").onclick = () => void refresh();
      host.querySelector("[data-read-all]").onclick = async () => {
        try {
          await mark(notifications2.filter((n) => !n.read).map((n) => n.message_id));
          drawList();
        } catch (e) {
          note(e.message, true);
        }
      };
      (_a4 = host.querySelector("[data-settings]")) == null ? void 0 : _a4.addEventListener("click", drawSettings);
      host.querySelectorAll("[data-message]").forEach((button) => button.onclick = () => void openChat(notifications2[Number(button.dataset.message)]));
    }
    function drawSettings() {
      var _a4, _b2, _c;
      screen2 = "settings";
      const host = heading("\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u0410\u0432\u0438\u0442\u043E");
      host.innerHTML = '<button type="button" data-back>\u2190 \u041A \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F\u043C</button><p class="fg-notice-help">\u0412\u043B\u0430\u0434\u0435\u043B\u0435\u0446 \u043E\u0434\u0438\u043D \u0440\u0430\u0437 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0430\u0435\u0442 API \u0441\u0432\u043E\u0435\u0433\u043E \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u0430. \u0414\u0430\u043B\u044C\u0448\u0435 FastGo \u043E\u0431\u043D\u043E\u0432\u043B\u044F\u0435\u0442 \u0434\u043E\u0441\u0442\u0443\u043F \u0438 \u043F\u043E\u043B\u0443\u0447\u0430\u0435\u0442 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438.</p><form><label>Client ID<input name="client_id" autocomplete="off" required maxlength="500"></label><label>Client Secret<input name="client_secret" type="password" autocomplete="new-password" required maxlength="4000"></label><p class="fg-notice-help">\u0414\u0430\u043D\u043D\u044B\u0435 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B \u0432 \u043A\u0430\u0431\u0438\u043D\u0435\u0442\u0435 \u0410\u0432\u0438\u0442\u043E: \xAB\u0414\u043B\u044F \u043F\u0440\u043E\u0444\u0435\u0441\u0441\u0438\u043E\u043D\u0430\u043B\u043E\u0432\xBB \u2192 API.</p><button type="submit">\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u0410\u0432\u0438\u0442\u043E</button></form>' + ((state == null ? void 0 : state.connected) ? '<div class="fg-notice-actions"><button type="button" data-disconnect>\u041E\u0442\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u0438\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439</button></div>' : "") + (((_a4 = state == null ? void 0 : state.stations) == null ? void 0 : _a4.length) ? "<label>\u0412\u0441\u043F\u043B\u044B\u0432\u0430\u044E\u0449\u0438\u0435 \u043E\u043A\u043D\u0430 \u043D\u0430 \u043D\u043E\u0443\u0442\u0431\u0443\u043A\u0435<select data-station>" + state.stations.map((s, i) => '<option value="' + escape(s.station_id) + '" ' + (state.popup_station_id === s.station_id ? "selected" : "") + ">" + (s.slot === 1 ? "\u041A\u0430\u0441\u0441\u0430 / \u0441\u043A\u043B\u0430\u0434 \xB7 \u0414\u0440\u0430\u0433\u043D\u0438\u0440" : "\u0412\u0442\u043E\u0440\u043E\u0439 \u0440\u0430\u0437\u0440\u0435\u0448\u0451\u043D\u043D\u044B\u0439 \u043D\u043E\u0443\u0442\u0431\u0443\u043A") + "</option>").join("") + "</select></label>" : "");
      host.querySelector("[data-back]").onclick = drawList;
      host.querySelector("form").onsubmit = async (e) => {
        e.preventDefault();
        const button = host.querySelector("[type=submit]");
        button.disabled = true;
        note("\u041F\u0440\u043E\u0432\u0435\u0440\u044F\u0435\u043C \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435\u2026");
        try {
          const form = e.target;
          await request2("connect", { client_id: form.elements.client_id.value, client_secret: form.elements.client_secret.value });
          form.reset();
          screen2 = "list";
          await refresh();
          drawList();
        } catch (error) {
          note(error.message, true);
        } finally {
          button.disabled = false;
        }
      };
      (_b2 = host.querySelector("[data-disconnect]")) == null ? void 0 : _b2.addEventListener("click", async () => {
        try {
          await request2("disconnect");
          screen2 = "list";
          await refresh();
          drawList();
        } catch (e) {
          note(e.message, true);
        }
      });
      (_c = host.querySelector("[data-station]")) == null ? void 0 : _c.addEventListener("change", async (e) => {
        try {
          await request2("popup_station", { station_id: e.target.value });
          note("\u041D\u043E\u0443\u0442\u0431\u0443\u043A \u0434\u043B\u044F \u0432\u0441\u043F\u043B\u044B\u0432\u0430\u044E\u0449\u0438\u0445 \u043E\u043A\u043E\u043D \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D");
        } catch (error) {
          note(error.message, true);
        }
      });
    }
    async function openChat(item) {
      selected = item.chat_id;
      screen2 = "chat";
      drawer.hidden = false;
      const host = heading(item.sender || "\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F \u0410\u0432\u0438\u0442\u043E");
      host.innerHTML = '<button type="button" data-back>\u2190 \u0423\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F</button><p>' + escape(item.title) + "</p><div data-messages></div>";
      host.querySelector("[data-back]").onclick = drawList;
      note("\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u043F\u0435\u0440\u0435\u043F\u0438\u0441\u043A\u0443\u2026");
      try {
        await mark([item.message_id]);
        const list = await request2("messages", { chat_id: item.chat_id });
        if (stopped || selected !== item.chat_id || screen2 !== "chat") return;
        host.querySelector("[data-messages]").innerHTML = list.slice().sort((a, b) => a.created - b.created).map((m) => '<div class="fg-chat-message ' + (m.direction === "out" ? "out" : "") + '">' + escape(m.text) + "<br><small>" + clock(new Date(m.created * 1e3).toISOString()) + "</small></div>").join("");
        note("\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F \u0438\u0437 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D\u043D\u043E\u0433\u043E \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u0430 \u0410\u0432\u0438\u0442\u043E");
      } catch (e) {
        note(e.message, true);
      }
    }
    bell.onclick = () => {
      drawer.hidden = !drawer.hidden;
      if (!drawer.hidden) {
        drawList();
        void refresh();
      }
    };
    const external = (e) => {
      var _a4;
      const item = (_a4 = state == null ? void 0 : state.notifications) == null ? void 0 : _a4.find((n) => {
        var _a5;
        return n.chat_id === ((_a5 = e.detail) == null ? void 0 : _a5.chat_id);
      });
      if (item) void openChat(item);
      else {
        drawer.hidden = false;
        drawList();
        void refresh();
      }
    };
    window.addEventListener("fastgo-open-avito", external);
    const controller = { actor, refresh, stop() {
      var _a4;
      stopped = true;
      clearInterval(timer);
      bell.remove();
      drawer.remove();
      (_a4 = document.querySelector(".fg-notice-toast")) == null ? void 0 : _a4.remove();
      window.removeEventListener("fastgo-open-avito", external);
      if (window.fastgoNotifications === controller) delete window.fastgoNotifications;
    } };
    window.fastgoNotifications = controller;
    const timer = setInterval(() => void refresh(), 15e3);
    void refresh();
    return controller;
  }

  // warehouse/unknown-scans.js
  function unknownScans({ call: call2, parts: parts2, refresh, run: run2, owner, message: message2 }) {
    let loading = false;
    const cancel = (row) => run2(async () => {
      var _a3;
      if (!confirm("\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C \u044D\u0442\u043E \u0441\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435? \u0422\u043E\u0432\u0430\u0440 \u043D\u0435 \u0431\u0443\u0434\u0435\u0442 \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D \u0432 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442.")) return;
      const result = await call2("unknown_cancel", { id: row.id });
      if (!(result == null ? void 0 : result.cancelled)) throw Error("\u041A\u043E\u0434 \u0443\u0436\u0435 \u0441\u0432\u044F\u0437\u0430\u043D \u0441 \u0442\u043E\u0432\u0430\u0440\u043E\u043C. \u041E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u043D\u0430 \u0422\u0421\u0414");
      (_a3 = document.querySelector(".unknown-dialog")) == null ? void 0 : _a3.close();
      await poll2();
      message2("\u0421\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u043E\u0442\u043C\u0435\u043D\u0435\u043D\u043E");
    });
    async function poll2() {
      const host = document.getElementById("unknown-scans");
      if (!host || loading) return;
      loading = true;
      try {
        const rows = await call2("unknown_scans");
        if (!host.isConnected) return;
        const signature = JSON.stringify(rows);
        if (host._unknownSignature === signature) return;
        host._unknownSignature = signature;
        host.innerHTML = rows.length ? "<h2>\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0435 \u043A\u043E\u0434\u044B \u0441 \u0422\u0421\u0414</h2>" + rows.map((x) => '<div class="unknown-row"><button data-unknown="' + esc(x.id) + '">' + esc(x.payload.code) + " \xB7 " + (x.payload.document_kind === "receipt" ? "\u041F\u0440\u0438\u0445\u043E\u0434" : "\u041F\u0440\u043E\u0434\u0430\u0436\u0430") + '</button><button data-unknown-cancel="' + esc(x.id) + '" ' + (x.state !== "queued" || x.checkout ? 'disabled data-unavailable="true"' : "") + ">\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C \u0441\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435</button></div>").join("") : "";
        host.querySelectorAll("[data-unknown]").forEach((b) => b.onclick = () => open(rows.find((x) => x.id === b.dataset.unknown)));
        host.querySelectorAll("[data-unknown-cancel]").forEach((b) => b.onclick = () => cancel(rows.find((x) => x.id === b.dataset.unknownCancel)));
      } catch (e) {
        if (host.isConnected) {
          host._unknownSignature = null;
          host.textContent = "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0435 \u043A\u043E\u0434\u044B: " + e.message;
        }
      } finally {
        loading = false;
      }
    }
    function open(row) {
      var _a3, _b, _c, _d, _e, _f, _g;
      const dialog = document.createElement("dialog");
      dialog.className = "unknown-dialog";
      const creating = !!row.checkout;
      dialog.innerHTML = "<h2>\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 \u043A\u043E\u0434</h2><p>" + esc(row.payload.code) + '</p><form><label>\u041D\u0430\u0439\u0442\u0438 \u0442\u043E\u0432\u0430\u0440<input id="unknown-filter" placeholder="\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0438\u043B\u0438 \u0430\u0440\u0442\u0438\u043A\u0443\u043B"></label><label>\u0421\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0430\u044F \u043F\u043E\u0437\u0438\u0446\u0438\u044F<select id="unknown-part"><option value="">\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0442\u043E\u0432\u0430\u0440</option></select></label><button class="primary" type="submit">\u0421\u0432\u044F\u0437\u0430\u0442\u044C \u0441 \u0442\u043E\u0432\u0430\u0440\u043E\u043C</button></form>' + (owner() ? "<details " + (creating ? "open" : "") + '><summary>\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043D\u043E\u0432\u0443\u044E \u043F\u043E\u0437\u0438\u0446\u0438\u044E</summary><form id="unknown-create"><label>\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435<input name="name" required value="' + esc(((_b = (_a3 = row.checkout) == null ? void 0 : _a3.create) == null ? void 0 : _b.name) || "") + '"></label><label>\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F<input name="category" required value="' + esc(((_d = (_c = row.checkout) == null ? void 0 : _c.create) == null ? void 0 : _d.category) || "") + '"></label><label>\u0426\u0435\u043D\u0430, \u20BD<input name="retail_price" type="number" min="0" max="100000000" step="0.01" required value="' + esc((_g = (_f = (_e = row.checkout) == null ? void 0 : _e.create) == null ? void 0 : _f.retail_price) != null ? _g : "") + '"></label><button class="primary">\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u0438 \u0441\u0432\u044F\u0437\u0430\u0442\u044C</button></form></details>' : "") + "<button data-cancel-scan " + (row.state !== "queued" || creating ? 'disabled data-unavailable="true"' : "") + '>\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C \u0441\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435</button><p class="error" role="status"></p><button data-close>\u0417\u0430\u043A\u0440\u044B\u0442\u044C</button>';
      document.body.append(dialog);
      dialog.showModal();
      dialog.querySelector("[data-close]").onclick = () => dialog.close();
      dialog.querySelector("[data-cancel-scan]").onclick = () => cancel(row);
      dialog.onclose = () => dialog.remove();
      dialog.onclick = (e) => {
        if (e.target === dialog) {
          const r = dialog.getBoundingClientRect();
          if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
        }
      };
      const select = dialog.querySelector("#unknown-part"), filter = dialog.querySelector("#unknown-filter");
      const draw = () => {
        const q = filter.value.toLowerCase();
        select.innerHTML = '<option value="">\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0442\u043E\u0432\u0430\u0440</option>' + parts2().filter((x) => x.active !== false && (x.name + " " + (x.sku || "")).toLowerCase().includes(q)).slice(0, 200).map((x) => '<option value="' + esc(x.id) + '">' + esc(x.name) + " \xB7 " + esc(x.sku || x.barcode || "") + "</option>").join("");
      };
      draw();
      filter.oninput = draw;
      const submit = (payload) => run2(async () => {
        try {
          await call2("unknown_resolve", { id: row.id, ...payload });
          await refresh();
          dialog.close();
          await poll2();
          message2("\u041A\u043E\u0434 \u0441\u0432\u044F\u0437\u0430\u043D. \u0422\u0421\u0414 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438 \u0434\u043E\u0431\u0430\u0432\u0438\u0442 \u0442\u043E\u0432\u0430\u0440 \u0432 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442.");
        } catch (e) {
          dialog.querySelector(".error").textContent = e.message;
          throw e;
        }
      });
      dialog.querySelector("form").onsubmit = (e) => {
        e.preventDefault();
        if (!select.value) return;
        void submit({ part_id: select.value });
      };
      if (creating) {
        dialog.querySelector("form button").disabled = true;
        select.disabled = true;
      }
      const create = dialog.querySelector("#unknown-create");
      if (create) {
        if (creating) create.querySelectorAll("input").forEach((i) => i.readOnly = true);
        create.onsubmit = (e) => {
          e.preventDefault();
          const data = new FormData(create);
          void submit({ create: { name: data.get("name"), category: data.get("category"), retail_price: Number(data.get("retail_price")) } });
        };
      }
    }
    return { poll: poll2 };
  }

  // warehouse/printer-settings.js
  var native = () => window.warehouseDesktop;
  var printerSetupAvailable = () => {
    var _a3, _b;
    return typeof ((_a3 = native()) == null ? void 0 : _a3.printers) === "function" && typeof ((_b = native()) == null ? void 0 : _b.savePrinter) === "function";
  };
  function printerFields(root, { format = "label", allowDialog = false, changed = () => {
  } } = {}) {
    root.className = "printer-fields";
    root.innerHTML = '<label>\u041F\u0440\u0438\u043D\u0442\u0435\u0440<select data-printer></select></label><button type="button" data-refresh>\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u0441\u043F\u0438\u0441\u043E\u043A</button><div class="printer-size"><label>\u0428\u0438\u0440\u0438\u043D\u0430, \u043C\u043C<input data-width type="number" min="30" max="110" step="0.1" value="58" required></label><label>\u0412\u044B\u0441\u043E\u0442\u0430, \u043C\u043C<input data-height type="number" min="20" max="200" step="0.1" value="30" required></label></div>' + (allowDialog ? '<label class="printer-remember"><input type="checkbox" data-remember checked>\u0417\u0430\u043F\u043E\u043C\u043D\u0438\u0442\u044C \u0434\u043B\u044F \u044D\u0442\u043E\u0433\u043E \u0444\u043E\u0440\u043C\u0430\u0442\u0430</label>' : "") + '<p class="muted" data-note role="status"></p>';
    const select = root.querySelector("[data-printer]"), width = root.querySelector("[data-width]"), height = root.querySelector("[data-height]"), remember = root.querySelector("[data-remember]"), note = root.querySelector("[data-note]"), refresh = root.querySelector("[data-refresh]");
    const connect = document.createElement("button");
    connect.type = "button";
    connect.dataset.connectP2 = "";
    connect.textContent = "\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u044C DETONGER P2";
    connect.hidden = true;
    refresh.after(connect);
    const connectPC = document.createElement("button");
    connectPC.type = "button";
    connectPC.textContent = "\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u044C POScenter PC-365";
    connectPC.hidden = true;
    connect.after(connectPC);
    let snapshot = { printers: [], profiles: {} }, loading = false, pollTimer;
    const option = (name, value) => {
      const o = document.createElement("option");
      o.value = value;
      o.textContent = name;
      return o;
    };
    function describe() {
      var _a3, _b, _c, _d, _e, _f, _g, _h;
      if (remember) remember.disabled = !select.value;
      const found = snapshot.printers.some((p) => p.name === select.value);
      note.textContent = select.value && !found ? "\u042D\u0442\u043E\u0442 \u043F\u0440\u0438\u043D\u0442\u0435\u0440 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D. \u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u0435 \u0435\u0433\u043E \u0438 \u043E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 \u0441\u043F\u0438\u0441\u043E\u043A." : select.value ? "\u0412\u044B\u0431\u043E\u0440 \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u0435\u0442\u0441\u044F \u043D\u0430 \u044D\u0442\u043E\u043C \u043D\u043E\u0443\u0442\u0431\u0443\u043A\u0435 \u0434\u043B\u044F \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0445 \u043F\u0435\u0447\u0430\u0442\u0435\u0439." : allowDialog ? "\u0414\u043B\u044F \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E \u0432\u044B\u0431\u043E\u0440\u0430 \u0443\u043A\u0430\u0436\u0438\u0442\u0435 \u043F\u0440\u0438\u043D\u0442\u0435\u0440 \u0438\u0437 \u0441\u043F\u0438\u0441\u043A\u0430." : "\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u0435 \u043F\u0440\u0438\u043D\u0442\u0435\u0440 \u043A \u043D\u043E\u0443\u0442\u0431\u0443\u043A\u0443, \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u0435 \u0434\u0440\u0430\u0439\u0432\u0435\u0440 \u0435\u0433\u043E \u043C\u043E\u0434\u0435\u043B\u0438 \u0438 \u043E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 \u0441\u043F\u0438\u0441\u043E\u043A.";
      if (format === "label" && ((_a3 = snapshot.setup) == null ? void 0 : _a3.message)) note.textContent = snapshot.setup.message;
      if (snapshot.warning) note.textContent = snapshot.warning;
      connect.hidden = format !== "label" || typeof ((_b = native()) == null ? void 0 : _b.setupPrinter) !== "function" || ((_c = snapshot.setup) == null ? void 0 : _c.status) === "ready";
      connect.disabled = ((_d = snapshot.setup) == null ? void 0 : _d.busy) === true;
      connect.textContent = connect.disabled ? "\u0423\u0441\u0442\u0430\u043D\u0430\u0432\u043B\u0438\u0432\u0430\u0435\u043C DETONGER P2\u2026" : "\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u044C DETONGER P2";
      connectPC.hidden = format !== "label" || typeof ((_e = native()) == null ? void 0 : _e.setupPrinter) !== "function" || ((_f = snapshot.pc365) == null ? void 0 : _f.status) === "ready";
      connectPC.disabled = ((_g = snapshot.pc365) == null ? void 0 : _g.busy) === true;
      if (format === "label" && ((_h = snapshot.pc365) == null ? void 0 : _h.message) && snapshot.pc365.status !== "not_connected") note.textContent += (note.textContent ? " \xB7 " : "") + snapshot.pc365.message;
      changed({ loading });
    }
    function populate(preserve = false) {
      var _a3;
      const saved = (_a3 = snapshot.profiles) == null ? void 0 : _a3[format], wanted = preserve ? select.value : (saved == null ? void 0 : saved.deviceName) || "";
      select.replaceChildren(option(allowDialog ? "\u0412\u044B\u0431\u043E\u0440 \u0432 \u043E\u043A\u043D\u0435 Windows" : "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044B\u0439 \u043F\u0440\u0438\u043D\u0442\u0435\u0440", ""), ...snapshot.printers.map((p) => option(p.displayName + (p.isDefault ? " \xB7 \u043E\u0441\u043D\u043E\u0432\u043D\u043E\u0439 \u0432 Windows" : ""), p.name)));
      if (wanted && !snapshot.printers.some((p) => p.name === wanted)) select.append(option(wanted + " \xB7 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D", wanted));
      select.value = wanted;
      root.querySelector(".printer-size").hidden = format !== "label";
      width.disabled = height.disabled = format !== "label";
      if (!preserve) {
        width.value = (saved == null ? void 0 : saved.widthMm) || 58;
        height.value = (saved == null ? void 0 : saved.heightMm) || 30;
      }
      describe();
    }
    async function load2(preserve = false) {
      var _a3, _b, _c, _d, _e, _f;
      if (loading) return;
      loading = true;
      refresh.disabled = select.disabled = true;
      changed({ loading });
      note.textContent = "\u041F\u043E\u043B\u0443\u0447\u0430\u0435\u043C \u0441\u043F\u0438\u0441\u043E\u043A \u043F\u0440\u0438\u043D\u0442\u0435\u0440\u043E\u0432\u2026";
      try {
        const previous = (_a3 = snapshot.setup) == null ? void 0 : _a3.status;
        snapshot = await native().printers();
        populate(previous === "installing" && ((_b = snapshot.setup) == null ? void 0 : _b.status) === "ready" ? false : preserve);
      } catch (e) {
        note.textContent = "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u0441\u043F\u0438\u0441\u043E\u043A \u043F\u0440\u0438\u043D\u0442\u0435\u0440\u043E\u0432. \u041D\u0430\u0436\u043C\u0438\u0442\u0435 \xAB\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u0441\u043F\u0438\u0441\u043E\u043A\xBB.";
      } finally {
        loading = false;
        refresh.disabled = select.disabled = false;
        changed({ loading });
        clearTimeout(pollTimer);
        if (((_c = snapshot.setup) == null ? void 0 : _c.busy) || ((_d = snapshot.setup) == null ? void 0 : _d.status) === "installing" || ((_e = snapshot.pc365) == null ? void 0 : _e.busy) || ((_f = snapshot.pc365) == null ? void 0 : _f.status) === "installing") pollTimer = setTimeout(() => {
          if (root.isConnected) void load2(true);
        }, 3e3);
      }
    }
    select.onchange = describe;
    refresh.onclick = () => void load2(true);
    connect.onclick = async () => {
      connect.disabled = true;
      try {
        await native().setupPrinter();
        await load2(true);
      } catch (e) {
        note.textContent = e.message;
        connect.disabled = false;
      }
    };
    connectPC.onclick = async () => {
      connectPC.disabled = true;
      try {
        await native().setupPrinter({ model: "pc365" });
        await load2(true);
      } catch (e) {
        note.textContent = e.message;
        connectPC.disabled = false;
      }
    };
    const ready = load2();
    return { ready, setFormat: (next) => {
      format = next;
      populate();
    }, selection: () => {
      if (loading) throw Error("\u0414\u043E\u0436\u0434\u0438\u0442\u0435\u0441\u044C \u0441\u043F\u0438\u0441\u043A\u0430 \u043F\u0440\u0438\u043D\u0442\u0435\u0440\u043E\u0432");
      const deviceName = select.value;
      if (deviceName && !snapshot.printers.some((p) => p.name === deviceName)) throw Error("\u041F\u0440\u0438\u043D\u0442\u0435\u0440 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D. \u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u0435 \u0435\u0433\u043E \u0438 \u043E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 \u0441\u043F\u0438\u0441\u043E\u043A.");
      if (!deviceName && !allowDialog) throw Error("\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044B\u0439 \u043F\u0440\u0438\u043D\u0442\u0435\u0440");
      return { deviceName, systemDialog: !deviceName, remember: !!deviceName && !!(remember == null ? void 0 : remember.checked), ...format === "label" ? { widthMm: Number(width.value), heightMm: Number(height.value) } : {} };
    } };
  }
  function setupLabelPrinter() {
    if (!printerSetupAvailable()) return;
    const dialog = document.createElement("dialog");
    dialog.className = "barcode-print-dialog";
    dialog.setAttribute("aria-label", "\u041F\u0440\u0438\u043D\u0442\u0435\u0440 \u044D\u0442\u0438\u043A\u0435\u0442\u043E\u043A");
    dialog.innerHTML = '<form><h2>\u041F\u0440\u0438\u043D\u0442\u0435\u0440 \u044D\u0442\u0438\u043A\u0435\u0442\u043E\u043A</h2><p>\u0421\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0439 \u043F\u0440\u0438\u043D\u0442\u0435\u0440 \u0431\u0443\u0434\u0435\u0442 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438 \u0432\u044B\u0431\u0438\u0440\u0430\u0442\u044C\u0441\u044F \u0432 \u0441\u043A\u043B\u0430\u0434\u0435 \u0438 \u0432 \u0440\u0430\u0437\u0434\u0435\u043B\u0435 \u0441\u043A\u043B\u0430\u0434\u0430 \u043E\u0431\u0449\u0435\u0433\u043E FastGo.</p><div data-printer-fields></div><p role="alert" class="error"></p><div class="actions"><button type="button" data-close>\u0417\u0430\u043A\u0440\u044B\u0442\u044C</button><button type="button" data-test>\u041F\u0440\u043E\u0431\u043D\u0430\u044F \u044D\u0442\u0438\u043A\u0435\u0442\u043A\u0430</button><button type="submit" class="primary">\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C</button></div><p data-result role="status"></p></form>';
    document.body.append(dialog);
    dialog.showModal();
    dialog.onclose = () => dialog.remove();
    dialog.querySelector("[data-close]").onclick = () => dialog.close();
    const form = dialog.querySelector("form"), save3 = dialog.querySelector("[type=submit]"), test = dialog.querySelector("[data-test]"), error = dialog.querySelector("[role=alert]"), result = dialog.querySelector("[data-result]");
    let busy2 = false;
    const controls = printerFields(dialog.querySelector("[data-printer-fields]"), { changed: ({ loading }) => {
      save3.disabled = test.disabled = loading || busy2;
    } });
    async function run2(testLabel) {
      if (busy2 || !form.reportValidity()) return;
      busy2 = true;
      save3.disabled = test.disabled = true;
      error.textContent = "";
      result.textContent = "";
      try {
        const selection = controls.selection();
        if (testLabel) {
          const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          window.JsBarcode(svg, "FASTGO-TEST", { format: "CODE128", displayValue: false, width: 2, height: 72, margin: 0, marginLeft: 20, marginRight: 20 });
          const r = await native().printBarcode({ ...selection, remember: true, format: "label", quantity: 1, name: "\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043F\u0440\u0438\u043D\u0442\u0435\u0440\u0430 FastGo", barcode: "FASTGO-TEST", svg: svg.outerHTML });
          result.textContent = (r == null ? void 0 : r.warning) || "\u041F\u0440\u043E\u0431\u043D\u0430\u044F \u044D\u0442\u0438\u043A\u0435\u0442\u043A\u0430 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0430 \u043F\u0440\u0438\u043D\u0442\u0435\u0440\u0443. \u0412\u044B\u0431\u043E\u0440 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D.";
        } else {
          await native().savePrinter({ format: "label", ...selection });
          result.textContent = "\u041F\u0440\u0438\u043D\u0442\u0435\u0440 \u0438 \u0440\u0430\u0437\u043C\u0435\u0440 \u044D\u0442\u0438\u043A\u0435\u0442\u043A\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B \u043D\u0430 \u044D\u0442\u043E\u043C \u043D\u043E\u0443\u0442\u0431\u0443\u043A\u0435.";
        }
      } catch (e) {
        error.textContent = e.message;
      } finally {
        busy2 = false;
        save3.disabled = test.disabled = false;
      }
    }
    form.onsubmit = (e) => {
      e.preventDefault();
      void run2(false);
    };
    test.onclick = () => void run2(true);
  }

  // warehouse/barcode-print.js
  function printBarcode(part) {
    const dialog = document.createElement("dialog");
    dialog.setAttribute("aria-label", "\u041F\u0435\u0447\u0430\u0442\u044C \u0448\u0442\u0440\u0438\u0445\u043A\u043E\u0434\u043E\u0432");
    dialog.className = "barcode-print-dialog";
    dialog.innerHTML = "<form><h2>\u041F\u0435\u0447\u0430\u0442\u044C \u0448\u0442\u0440\u0438\u0445\u043A\u043E\u0434\u043E\u0432</h2><p>" + esc(part.name) + '</p><label>\u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u044D\u0442\u0438\u043A\u0435\u0442\u043E\u043A<input name="quantity" type="number" min="1" max="1000" step="1" value="1" required></label><label>\u0424\u043E\u0440\u043C\u0430\u0442<select name="format"><option value="label">\u0422\u0435\u0440\u043C\u043E\u044D\u0442\u0438\u043A\u0435\u0442\u043A\u0430</option><option value="a4">\u041B\u0438\u0441\u0442 A4</option></select></label><div data-printer-fields hidden></div><p role="alert" class="error"></p><div class="actions"><button type="button" data-close>\u041E\u0442\u043C\u0435\u043D\u0430</button><button type="submit" class="primary">\u041F\u0435\u0447\u0430\u0442\u044C</button></div></form>';
    document.body.append(dialog);
    dialog.showModal();
    dialog.onclose = () => dialog.remove();
    dialog.querySelector("[data-close]").onclick = () => dialog.close();
    dialog.querySelector("input").focus();
    dialog.querySelector("input").select();
    let printers;
    const formatSelect = dialog.querySelector("[name=format]");
    if (printerSetupAvailable()) {
      const root = dialog.querySelector("[data-printer-fields]");
      root.hidden = false;
      printers = printerFields(root, { allowDialog: true, changed: ({ loading }) => {
        dialog.querySelector("[type=submit]").disabled = loading;
      } });
      formatSelect.onchange = () => printers.setFormat(formatSelect.value);
    }
    dialog.querySelector("form").onsubmit = async (event) => {
      var _a3;
      event.preventDefault();
      const button = dialog.querySelector("[type=submit]"), quantity = Number(dialog.querySelector("[name=quantity]").value), format = formatSelect.value;
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1e3) return;
      try {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        window.JsBarcode(svg, String(part.barcode), { format: "CODE128", displayValue: false, width: 2, height: 72, margin: 0, marginLeft: 20, marginRight: 20, background: "#ffffff", lineColor: "#000000" });
        const payload = { name: part.name, barcode: String(part.barcode), price: Number(part.retail_price), svg: svg.outerHTML, quantity, format };
        if ((_a3 = window.warehouseDesktop) == null ? void 0 : _a3.printBarcode) {
          button.disabled = true;
          const result = await window.warehouseDesktop.printBarcode({ ...payload, ...printers == null ? void 0 : printers.selection() });
          dialog.close();
          if (result == null ? void 0 : result.warning) {
            const message2 = document.getElementById("message");
            if (message2) message2.textContent = result.warning;
          }
          return;
        }
        const label = '<section class="label"><div class="label-heading"><strong>' + esc(part.name) + '</strong><b class="price">' + esc(Number(part.retail_price).toLocaleString("ru-RU", { maximumFractionDigits: 2 }) + " \u20BD") + "</b></div>" + svg.outerHTML + "<small>" + esc(part.barcode) + "</small></section>", frame = document.createElement("iframe");
        frame.title = "\u041F\u0435\u0447\u0430\u0442\u044C \u044D\u0442\u0438\u043A\u0435\u0442\u043E\u043A";
        frame.style.cssText = "position:fixed;width:1px;height:1px;left:-10000px;border:0";
        frame.srcdoc = barcodeDocument(label, quantity, format);
        frame.onload = () => {
          frame.contentWindow.addEventListener("afterprint", () => frame.remove(), { once: true });
          frame.contentWindow.focus();
          frame.contentWindow.print();
        };
        document.body.append(frame);
        dialog.close();
      } catch (error) {
        dialog.querySelector("[role=alert]").textContent = error.message;
      } finally {
        button.disabled = false;
      }
    };
  }
  function barcodeDocument(label, quantity, format) {
    return '<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>\u042D\u0442\u0438\u043A\u0435\u0442\u043A\u0438 FastGo</title><style>@page{size:' + (format === "a4" ? "A4;margin:10mm" : "58mm 30mm;margin:0") + "}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:black;background:white;" + (format === "a4" ? "display:grid;grid-template-columns:repeat(3,58mm);grid-auto-rows:30mm;gap:2mm;" : "") + "}.label{width:58mm;height:30mm;padding:2mm;display:flex;flex-direction:column;justify-content:center;align-items:center;overflow:hidden;break-inside:avoid;" + (format === "a4" ? "" : "break-after:page;") + "}.label:last-child{break-after:auto}.label-heading{display:flex;align-items:center;justify-content:space-between;gap:1mm;width:100%}.label-heading strong{min-width:0;flex:1;text-align:left}.price{font-size:8pt;font-weight:bold;white-space:nowrap}strong{font-size:9pt;line-height:1.1;max-height:8mm;overflow:hidden;text-align:center}small{font-size:7pt}svg{width:54mm;height:15mm;flex-shrink:0}" + (format === "a4" ? "" : ".label{justify-content:flex-start;gap:.5mm}.label strong{height:3.3mm;flex:0 0 3.3mm;max-height:none;font-size:8pt;line-height:3.3mm;white-space:nowrap;text-overflow:ellipsis;width:100%}.label svg{height:9mm;shape-rendering:crispEdges}.label small{height:3mm;flex:0 0 3mm;line-height:3mm;white-space:nowrap}") + "</style></head><body>" + label.repeat(quantity) + "</body></html>";
  }

  // workshop/equipment-core.js
  var equipmentTypes = ["\u042D\u043B\u0435\u043A\u0442\u0440\u043E\u0441\u0430\u043C\u043E\u043A\u0430\u0442\u044B", "\u042D\u043B\u0435\u043A\u0442\u0440\u043E\u0432\u0435\u043B\u043E\u0441\u0438\u043F\u0435\u0434\u044B", "\u0412\u0435\u043B\u043E\u0441\u0438\u043F\u0435\u0434\u044B", "\u042D\u043B\u0435\u043A\u0442\u0440\u043E\u043C\u043E\u043F\u0435\u0434\u044B", "\u042D\u043B\u0435\u043A\u0442\u0440\u043E\u0441\u043A\u0443\u0442\u0435\u0440\u044B", "\u0414\u0440\u0443\u0433\u0430\u044F \u0442\u0435\u0445\u043D\u0438\u043A\u0430"];
  function equipmentType(product2) {
    const category = String(product2.category || "").trim();
    if (category.startsWith("\u0422\u0435\u0445\u043D\u0438\u043A\u0430 \xB7 ")) return category.slice(10);
    return equipmentTypes.find((type) => type.toLowerCase() === category.toLowerCase()) || null;
  }

  // warehouse/product-panel.js
  var pencil = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m15 4 5 5M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z"/></svg>';
  function productPanel({ parts: parts2, editable, call: call2, run: run2, changed, message: message2, photos: photos2, offerLabels: offerLabels2 = () => {
  } }) {
    let dialog, selected, editing = "", pending2, stopPhotos;
    function close() {
      if ((dialog == null ? void 0 : dialog.dataset.uploading) === "true") return;
      stopPhotos == null ? void 0 : stopPhotos();
      stopPhotos = null;
      if (dialog == null ? void 0 : dialog.open) dialog.close();
      dialog == null ? void 0 : dialog.remove();
      dialog = null;
      selected = null;
      editing = "";
      pending2 = null;
    }
    function open(part) {
      if ((dialog == null ? void 0 : dialog.dataset.uploading) === "true") return;
      close();
      selected = part;
      dialog = document.createElement("dialog");
      dialog.className = "product-dialog";
      dialog.setAttribute("aria-label", "\u041A\u0430\u0440\u0442\u043E\u0447\u043A\u0430 \u0442\u043E\u0432\u0430\u0440\u0430");
      document.body.append(dialog);
      draw();
      dialog.showModal();
      dialog.querySelector("[data-close]").focus();
      dialog.onclick = (e) => {
        if (e.target !== dialog) return;
        const r = dialog.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close();
      };
      const owned = dialog;
      dialog.oncancel = (e) => {
        if (owned.dataset.uploading === "true") e.preventDefault();
      };
      dialog.onclose = () => {
        owned.remove();
        if (dialog === owned) {
          stopPhotos == null ? void 0 : stopPhotos();
          stopPhotos = null;
          dialog = null;
          selected = null;
        }
      };
    }
    function metric(field, label, value) {
      return '<section class="product-metric" data-metric="' + field + '"><div class="metric-label">' + label + (editable() ? '<button type="button" class="pencil" data-edit="' + field + '" aria-label="\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C ' + (field === "quantity" ? "\u043E\u0441\u0442\u0430\u0442\u043E\u043A" : field === "unit_cost" ? "\u0437\u0430\u043A\u0443\u043F\u043E\u0447\u043D\u0443\u044E \u0446\u0435\u043D\u0443" : "\u0446\u0435\u043D\u0443") + '">' + pencil + "</button>" : "") + "</div><strong>" + value + "</strong><div data-editor></div></section>";
    }
    function draw() {
      if (!dialog || !selected) return;
      dialog.innerHTML = '<button class="product-close" type="button" data-close aria-label="\u0417\u0430\u043A\u0440\u044B\u0442\u044C \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0443">\xD7</button><div class="product-main"><h2>' + esc(selected.name) + '</h2><div class="product-metrics">' + metric("quantity", "\u041E\u0441\u0442\u0430\u0442\u043E\u043A", selected.quantity + " <span>\u0448\u0442.</span>") + metric("retail_price", "\u0426\u0435\u043D\u0430 \u043F\u0440\u043E\u0434\u0430\u0436\u0438", money(selected.retail_price)) + metric("unit_cost", "\u0417\u0430\u043A\u0443\u043F\u043E\u0447\u043D\u0430\u044F \u0446\u0435\u043D\u0430", money(selected.unit_cost)) + '</div><div class="product-sku"><span>\u0410\u0440\u0442\u0438\u043A\u0443\u043B</span><b>' + esc(selected.sku || "\u041D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D") + '</b></div></div><div class="product-barcode"><span>\u0428\u0442\u0440\u0438\u0445\u043A\u043E\u0434</span>' + (selected.barcode ? '<svg id="product-barcode" role="img" aria-label="\u0428\u0442\u0440\u0438\u0445\u043A\u043E\u0434 ' + esc(selected.barcode) + '"></svg>' : "<p>\u041D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D</p>") + "<b>" + esc(selected.barcode || "") + "</b>" + (selected.barcode ? '<button type="button" class="primary" data-print-barcode>\u041F\u0435\u0447\u0430\u0442\u044C \u0448\u0442\u0440\u0438\u0445\u043A\u043E\u0434\u043E\u0432</button>' : "") + '</div><p class="product-error" role="alert"></p>';
      const toolbar = document.createElement("div");
      toolbar.className = "product-dialog-toolbar";
      const title = document.createElement("span");
      title.textContent = "\u041A\u0430\u0440\u0442\u043E\u0447\u043A\u0430 \u0442\u043E\u0432\u0430\u0440\u0430";
      toolbar.append(title, dialog.querySelector("[data-close]"));
      dialog.prepend(toolbar);
      dialog.querySelector(".product-main").append(dialog.querySelector(".product-barcode"));
      stopPhotos == null ? void 0 : stopPhotos();
      const gallery = document.createElement("section");
      gallery.className = "product-photos";
      dialog.querySelector(".product-error").before(gallery);
      stopPhotos = photos2 == null ? void 0 : photos2.mount(gallery, selected);
      if (dialog.querySelector("[data-print-barcode]")) dialog.querySelector("[data-print-barcode]").onclick = () => {
        if (!offerLabels2(selected, 1)) printBarcode(selected);
      };
      dialog.querySelector("[data-close]").onclick = close;
      dialog.querySelectorAll("[data-edit]").forEach((b) => b.onclick = () => edit(b.dataset.edit));
      if (selected.barcode) {
        try {
          window.JsBarcode(dialog.querySelector("svg#product-barcode"), String(selected.barcode), { format: "CODE128", displayValue: false, width: 2, height: 110, margin: 16, background: "#ffffff", lineColor: "#000000" });
        } catch (e) {
          dialog.querySelector("#product-barcode").outerHTML = "<p>\u041A\u043E\u0434: " + esc(selected.barcode) + "</p>";
        }
      }
    }
    function edit(field) {
      var _a3;
      editing = field;
      pending2 = null;
      draw();
      const min = field === "quantity" && !equipmentType(selected) ? -1e6 : 0, max = field === "quantity" ? 1e6 : 1e8, host = dialog.querySelector('[data-metric="' + field + '"] [data-editor]');
      host.innerHTML = '<form class="metric-editor"><label>' + (field === "quantity" ? "\u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E, \u0448\u0442." : field === "unit_cost" ? "\u0417\u0430\u043A\u0443\u043F\u043E\u0447\u043D\u0430\u044F \u0446\u0435\u043D\u0430, \u20BD" : "\u0426\u0435\u043D\u0430 \u043F\u0440\u043E\u0434\u0430\u0436\u0438, \u20BD") + '<input type="number" min="' + min + '" max="' + max + '" step="' + (field === "quantity" ? "1" : "0.01") + '" value="' + ((_a3 = selected[field]) != null ? _a3 : 0) + '" required aria-label="' + (field === "quantity" ? "\u041D\u043E\u0432\u044B\u0439 \u043E\u0441\u0442\u0430\u0442\u043E\u043A" : field === "unit_cost" ? "\u041D\u043E\u0432\u0430\u044F \u0437\u0430\u043A\u0443\u043F\u043E\u0447\u043D\u0430\u044F \u0446\u0435\u043D\u0430" : "\u041D\u043E\u0432\u0430\u044F \u0446\u0435\u043D\u0430") + '"></label><div><button class="primary" type="submit">\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C</button><button type="button" data-cancel>\u041E\u0442\u043C\u0435\u043D\u0430</button></div></form>';
      const input = host.querySelector("input");
      input.focus();
      input.select();
      host.querySelector("[data-cancel]").onclick = () => {
        editing = "";
        pending2 = null;
        draw();
      };
      host.querySelector("form").onsubmit = (e) => {
        var _a4;
        e.preventDefault();
        const part = selected, value = Number(input.value), field2 = editing;
        if (input.value.trim() === "" || !Number.isFinite(value) || value < min || value > max || field2 === "quantity" && !Number.isInteger(value) || field2 !== "quantity" && Math.abs(value * 100 - Math.round(value * 100)) > 1e-5) {
          dialog.querySelector(".product-error").textContent = "\u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435";
          return;
        }
        if (!pending2 || pending2.value !== value) pending2 = { request_id: uuid(), part_id: part.id, field: field2, value, expected: (_a4 = part[field2]) != null ? _a4 : 0 };
        const payload = { ...pending2 };
        void run2(async () => {
          input.disabled = true;
          dialog.querySelector(".product-error").textContent = "\u0421\u043E\u0445\u0440\u0430\u043D\u044F\u0435\u043C\u2026";
          try {
            const updated = await call2("inventory_edit", payload);
            const index = parts2().findIndex((x) => x.id === updated.id);
            if (index >= 0) parts2()[index] = updated;
            selected = updated;
            editing = "";
            pending2 = null;
            changed();
            draw();
            message2("\u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E \u0432 \u043E\u0431\u0449\u0435\u0439 \u0431\u0430\u0437\u0435");
            if (field2 === "quantity" && value !== payload.expected && value > 0) offerLabels2(updated, value);
          } catch (e2) {
            if (dialog) dialog.querySelector(".product-error").textContent = e2.message;
            throw e2;
          } finally {
            input.disabled = false;
          }
        });
      };
    }
    return { open, close };
  }

  // workshop/photo-upload.js
  var videoType = (file) => file.type || ({ "mp4": "video/mp4", "mov": "video/quicktime", "webm": "video/webm" }[file.name.split(".").pop().toLowerCase()] || "");
  var preparedParts = /* @__PURE__ */ new WeakMap();
  var preparePartPhoto = (file) => prepareImage(file, preparedParts, true);
  async function prepareImage(file, cache, compact = false) {
    if (cache.has(file)) return cache.get(file);
    const task = (async () => {
      if (file.size > 25 * 1024 * 1024) throw new Error("\u0424\u043E\u0442\u043E " + file.name + " \u0431\u043E\u043B\u044C\u0448\u0435 25 \u041C\u0411");
      const url = URL.createObjectURL(file), img = new Image();
      try {
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = () => reject(new Error("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C " + file.name + ". \u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u043D\u0438\u043C\u043E\u043A \u0432 JPG, PNG \u0438\u043B\u0438 WebP."));
          img.src = url;
        });
        const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight)), canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        let blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
        if (compact) for (const quality of [0.72, 0.62, 0.52]) {
          if (!blob || blob.size <= 750 * 1024) break;
          blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
        }
        if (!blob) throw new Error("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u044C \u0444\u043E\u0442\u043E " + file.name);
        if (blob.size >= file.size && ["image/jpeg", "image/png", "image/webp"].includes(videoType(file)) && scale === 1) return file;
        return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg", lastModified: file.lastModified });
      } finally {
        URL.revokeObjectURL(url);
      }
    })();
    cache.set(file, task);
    return task;
  }
  var fileBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C \u0444\u0430\u0439\u043B"));
    reader.readAsDataURL(file);
  });

  // workshop/photo-cache.js
  var NAME = "fastgo-part-photos-v1";
  var MAX_BYTES = 64 * 1024 * 1024;
  var MAX_ITEMS = 100;
  var MAX_AGE = 7 * 864e5;
  var pending = /* @__PURE__ */ new Map();
  var writes = Promise.resolve();
  var keyFor = (key3) => "https://fastgo-photo-cache.invalid/" + encodeURIComponent(key3);
  async function cachedPhoto(url, key3, { enabled = !!(((_a3) => (_a3 = globalThis.window) == null ? void 0 : _a3.fastgoDesktop)() || ((_b) => (_b = globalThis.window) == null ? void 0 : _b.warehouseDesktop)()), refresh = false } = {}) {
    if (!enabled || !key3 || !globalThis.caches) return null;
    const address = keyFor(key3), flight = address + (refresh ? ":refresh" : "");
    if (pending.has(flight)) return pending.get(flight);
    const task = (async () => {
      var _a4;
      const cache = await caches.open(NAME);
      if (!refresh) {
        const hit = await cache.match(address);
        if (hit && Date.now() - Number(hit.headers.get("x-fastgo-stored")) < MAX_AGE) return hit.blob();
      }
      const response = await fetch(url, { credentials: "omit", signal: AbortSignal.timeout(12e3) });
      if (!response.ok || !((_a4 = response.headers.get("content-type")) == null ? void 0 : _a4.startsWith("image/"))) throw Error("Photo unavailable");
      const blob = await response.blob();
      if (!blob.size || blob.size > 5 * 1024 * 1024) return blob;
      writes = writes.catch(() => {
      }).then(async () => {
        await cache.delete(address);
        await cache.put(address, new Response(blob, { headers: { "Content-Type": blob.type, "x-fastgo-stored": String(Date.now()), "x-fastgo-size": String(blob.size) } }));
        const keys2 = await cache.keys();
        let bytes = 0, items = [];
        for (const request2 of keys2) {
          const saved = await cache.match(request2), time = Number(saved.headers.get("x-fastgo-stored")), size = Number(saved.headers.get("x-fastgo-size"));
          if (Date.now() - time >= MAX_AGE) {
            await cache.delete(request2);
            continue;
          }
          bytes += size;
          items.push({ request: request2, size, time });
        }
        items.sort((a, b) => a.time - b.time);
        while (items.length > MAX_ITEMS || bytes > MAX_BYTES) {
          const oldest = items.shift();
          bytes -= oldest.size;
          await cache.delete(oldest.request);
        }
      });
      await writes.catch(() => {
      });
      return blob;
    })();
    pending.set(flight, task);
    try {
      return await task;
    } finally {
      pending.delete(flight);
    }
  }

  // workshop/private-photo.js
  function displayPrivatePhoto(img, { getUrl, url, cacheKey, isCurrent = () => img.isConnected, onLoad = () => {
  }, onError = () => {
  } }) {
    let retries = 0, stopped = false, refreshing2 = false, objectUrl;
    const release = () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
    };
    img.loading = "eager";
    img.decoding = "async";
    const current = () => !stopped && isCurrent();
    const fail = () => {
      if (current()) {
        stopped = true;
        onError();
      }
    };
    const refresh = async () => {
      if (!current() || refreshing2) return;
      refreshing2 = true;
      try {
        const next = url && retries === 0 ? url : await getUrl();
        if (!next) throw new Error("Missing photo URL");
        let blob = null;
        try {
          blob = await cachedPhoto(next, cacheKey, { refresh: retries > 0 });
        } catch (e) {
        }
        if (current()) {
          release();
          objectUrl = blob ? URL.createObjectURL(blob) : null;
          img.src = objectUrl || next;
        }
      } catch (e) {
        fail();
      } finally {
        refreshing2 = false;
      }
    };
    img.onload = () => {
      if (current()) {
        retries = 0;
        onLoad();
      }
    };
    img.onerror = () => {
      if (!current()) return;
      if (retries++ < 1) refresh();
      else fail();
    };
    if (url && !cacheKey) img.src = url;
    else refresh();
    return () => {
      stopped = true;
      img.onload = img.onerror = null;
      release();
    };
  }

  // warehouse/part-photos.js
  function partPhotos({ api: api2, editable, run: run2, changed, message: message2 }) {
    let observer;
    const thumbnails = [];
    const cacheKey = (part, path) => userId() && path ? userId() + ":" + part.id + ":" + path : void 0;
    const placeholder = '<span aria-hidden="true">\u25A7</span>';
    function thumbnail(part) {
      return '<span class="inventory-photo" data-photo="' + esc(part.id) + '">' + (part.primary_photo_path ? '<img alt="\u0424\u043E\u0442\u043E: ' + esc(part.name) + '">' : placeholder) + "</span>";
    }
    function bindThumbnails(host, parts2) {
      observer == null ? void 0 : observer.disconnect();
      thumbnails.splice(0).forEach((stop) => stop());
      const load2 = (el) => {
        const part = parts2.find((p) => p.id === el.dataset.photo), img = el.querySelector("img");
        if (!img || !part) return;
        thumbnails.push(displayPrivatePhoto(img, { cacheKey: cacheKey(part, part.primary_photo_path), getUrl: async () => (await api2("part_photo_url", { part_id: part.id })).url, onError: () => {
          if (el.isConnected) {
            el.innerHTML = placeholder;
            el.title = "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0444\u043E\u0442\u043E. \u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0443 \u0434\u043B\u044F \u043F\u043E\u0432\u0442\u043E\u0440\u0430.";
          }
        } }));
      };
      if (typeof IntersectionObserver === "undefined") {
        host.querySelectorAll("[data-photo]").forEach(load2);
        return;
      }
      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) if (entry.isIntersecting) {
          observer.unobserve(entry.target);
          load2(entry.target);
        }
      }, { rootMargin: "180px" });
      host.querySelectorAll("[data-photo]").forEach((el) => observer.observe(el));
    }
    async function upload(part, file, requestId = uuid(), primaryForCategory = false, onProgress = () => {
    }) {
      if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 25 * 1024 * 1024) throw Error("\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 JPG, PNG \u0438\u043B\u0438 WebP \u043D\u0435 \u0431\u043E\u043B\u044C\u0448\u0435 25 \u041C\u0411");
      onProgress("\u041F\u043E\u0434\u0433\u043E\u0442\u0430\u0432\u043B\u0438\u0432\u0430\u0435\u043C \u0444\u043E\u0442\u043E\u0433\u0440\u0430\u0444\u0438\u044E\u2026");
      const prepared = await preparePartPhoto(file);
      if (prepared.size > 5 * 1024 * 1024) throw Error("\u0424\u043E\u0442\u043E \u043F\u043E\u0441\u043B\u0435 \u0441\u0436\u0430\u0442\u0438\u044F \u0434\u043E\u043B\u0436\u043D\u043E \u0431\u044B\u0442\u044C \u043D\u0435 \u0431\u043E\u043B\u044C\u0448\u0435 5 \u041C\u0411");
      onProgress("\u0421\u043E\u0445\u0440\u0430\u043D\u044F\u0435\u043C \u0444\u043E\u0442\u043E \xB7 " + Math.ceil(prepared.size / 1024) + " \u041A\u0411\u2026");
      const result = await api2("part_photo_upload", { part_id: part.id, request_id: requestId, content_type: prepared.type, content_base64: await fileBase64(prepared), primary_for_category: primaryForCategory });
      if (!(result == null ? void 0 : result.path)) throw Error("\u0421\u0435\u0440\u0432\u0435\u0440 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u043B \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0435 \u0444\u043E\u0442\u043E\u0433\u0440\u0430\u0444\u0438\u0438. \u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0443.");
      part.primary_photo_path = result.path;
      return result;
    }
    function mount(host, part) {
      let pending2 = null, saving = false, stopped = false, viewer = null;
      const cleanups = [];
      host.innerHTML = '<div class="product-photo-heading"><h3>\u0424\u043E\u0442\u043E\u0433\u0440\u0430\u0444\u0438\u0438</h3>' + (editable() ? '<label class="photo-upload-button">\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0444\u043E\u0442\u043E<input type="file" accept="image/jpeg,image/png,image/webp" aria-label="\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0444\u043E\u0442\u043E\u0433\u0440\u0430\u0444\u0438\u044E \u0437\u0430\u043F\u0447\u0430\u0441\u0442\u0438"></label>' : "") + '</div><div class="product-photo-gallery">\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u0444\u043E\u0442\u043E\u0433\u0440\u0430\u0444\u0438\u0438\u2026</div><div class="product-photo-thumbs" aria-label="\u0412\u044B\u0431\u043E\u0440 \u0444\u043E\u0442\u043E\u0433\u0440\u0430\u0444\u0438\u0438"></div><p class="photo-status" role="status" aria-live="polite"></p><button type="button" class="photo-retry" hidden>\u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0443</button>';
      const gallery = host.querySelector(".product-photo-gallery"), status = host.querySelector(".photo-status"), input = host.querySelector("input"), retry = host.querySelector(".photo-retry");
      const current = () => !stopped && host.isConnected;
      function closeViewer() {
        if (viewer) {
          const old = viewer;
          viewer = null;
          old.close();
          old.remove();
        }
      }
      function enlarge(img) {
        if (!img.naturalWidth || saving) return;
        closeViewer();
        viewer = document.createElement("dialog");
        viewer.className = "product-photo-viewer";
        viewer.setAttribute("aria-label", "\u0424\u043E\u0442\u043E\u0433\u0440\u0430\u0444\u0438\u044F: " + part.name);
        const big = document.createElement("img");
        big.src = img.src;
        big.alt = part.name;
        const close = document.createElement("button");
        close.type = "button";
        close.className = "product-close";
        close.setAttribute("aria-label", "\u0417\u0430\u043A\u0440\u044B\u0442\u044C \u0444\u043E\u0442\u043E\u0433\u0440\u0430\u0444\u0438\u044E");
        close.textContent = "\xD7";
        close.onclick = closeViewer;
        viewer.append(big, close);
        document.body.append(viewer);
        const owned = viewer;
        owned.onclose = () => {
          owned.remove();
          if (viewer === owned) viewer = null;
        };
        owned.onclick = (e) => {
          if (e.target === owned) closeViewer();
        };
        owned.showModal();
        close.focus();
      }
      const busy2 = (value) => {
        saving = value;
        host.closest("dialog").dataset.uploading = String(value);
        if (input) input.disabled = value;
        gallery.querySelectorAll("button").forEach((b) => b.disabled = value || b.dataset.unavailable === "true");
        retry.disabled = value;
      };
      async function save3() {
        if (saving || !pending2) return;
        await run2(async () => {
          busy2(true);
          retry.hidden = true;
          try {
            if (pending2.file) await upload(part, pending2.file, pending2.id, false, (text) => {
              if (current()) status.textContent = text;
            });
            else {
              status.textContent = "\u0421\u043E\u0445\u0440\u0430\u043D\u044F\u0435\u043C \u043E\u0441\u043D\u043E\u0432\u043D\u0443\u044E \u0444\u043E\u0442\u043E\u0433\u0440\u0430\u0444\u0438\u044E\u2026";
              const result = await api2("part_photo_primary", { part_id: part.id, photo_id: pending2.photo.id, request_id: pending2.id });
              part.primary_photo_path = result.path;
            }
            pending2 = null;
            if (current()) status.textContent = "\u0424\u043E\u0442\u043E \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E";
            await changed(part);
            if (current()) await load2();
            message2("\u0424\u043E\u0442\u043E\u0433\u0440\u0430\u0444\u0438\u044F \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0430 \u0432 \u043E\u0431\u0449\u0435\u0439 \u0431\u0430\u0437\u0435");
          } catch (error) {
            if (current()) {
              status.textContent = error.message;
              retry.hidden = false;
            }
            throw error;
          } finally {
            if (current()) busy2(false);
          }
        });
      }
      async function load2() {
        var _a3;
        try {
          const photos2 = await api2("part_photos", { part_id: part.id });
          if (!current()) return;
          closeViewer();
          cleanups.splice(0).forEach((stop) => stop());
          gallery.textContent = photos2.length ? "" : "\u0424\u043E\u0442\u043E\u0433\u0440\u0430\u0444\u0438\u0439 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442";
          const thumbs = host.querySelector(".product-photo-thumbs");
          thumbs.replaceChildren();
          const first = Math.max(0, photos2.findIndex((p) => p.primary)), cards = [], tabs = [];
          for (const [index, photo] of photos2.entries()) {
            const card = document.createElement("div");
            card.className = "product-photo-card";
            card.hidden = true;
            card.innerHTML = '<button type="button" class="product-photo-open" aria-label="\u0423\u0432\u0435\u043B\u0438\u0447\u0438\u0442\u044C \u0444\u043E\u0442\u043E\u0433\u0440\u0430\u0444\u0438\u044E ' + (index + 1) + '"><img alt="' + esc(part.name) + '"><span>\u2922 \u0423\u0432\u0435\u043B\u0438\u0447\u0438\u0442\u044C</span></button>' + (editable() ? '<button type="button" data-photo-primary ' + (photo.primary ? "disabled" : "") + ">" + (photo.primary ? "\u041E\u0441\u043D\u043E\u0432\u043D\u043E\u0435 \u0444\u043E\u0442\u043E" : "\u0421\u0434\u0435\u043B\u0430\u0442\u044C \u043E\u0441\u043D\u043E\u0432\u043D\u044B\u043C") + "</button>" : "");
            gallery.append(card);
            cards.push(card);
            const img = card.querySelector("img"), tab = document.createElement("button");
            tab.type = "button";
            tab.className = "product-photo-thumb";
            tab.textContent = String(index + 1);
            tab.setAttribute("aria-label", "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0444\u043E\u0442\u043E\u0433\u0440\u0430\u0444\u0438\u044E " + (index + 1));
            thumbs.append(tab);
            tabs.push(tab);
            let started = false;
            tab.onclick = () => {
              cards.forEach((c, i) => {
                c.hidden = i !== index;
                tabs[i].setAttribute("aria-pressed", String(i === index));
              });
              if (started) return;
              started = true;
              cleanups.push(displayPrivatePhoto(img, { cacheKey: cacheKey(part, photo.path), isCurrent: () => current() && card.isConnected, getUrl: async () => (await api2("part_photo_url", { part_id: part.id, photo_id: photo.id })).url, onLoad: () => {
                const preview = document.createElement("img");
                preview.src = img.src;
                preview.alt = "";
                tab.replaceChildren(preview);
              }, onError: () => {
                img.alt = "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0444\u043E\u0442\u043E";
              } }));
            };
            card.querySelector(".product-photo-open").onclick = () => enlarge(img);
            const choose = card.querySelector("[data-photo-primary]");
            if (choose) {
              choose.dataset.unavailable = String(!!photo.primary);
              choose.onclick = () => {
                pending2 = { photo, id: uuid() };
                void save3();
              };
            }
          }
          (_a3 = tabs[first]) == null ? void 0 : _a3.click();
        } catch (error) {
          if (current()) {
            gallery.textContent = "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0444\u043E\u0442\u043E\u0433\u0440\u0430\u0444\u0438\u0438: " + error.message;
            const reload = document.createElement("button");
            reload.type = "button";
            reload.textContent = "\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u0444\u043E\u0442\u043E\u0433\u0440\u0430\u0444\u0438\u0438";
            reload.onclick = () => void load2();
            gallery.append(reload);
          }
        }
      }
      if (input) input.onchange = () => {
        const file = input.files[0];
        if (file) {
          pending2 = { file, id: uuid() };
          void save3();
        }
      };
      retry.onclick = () => void save3();
      void load2();
      return () => {
        stopped = true;
        closeViewer();
        cleanups.forEach((stop) => stop());
      };
    }
    return { thumbnail, bindThumbnails, mount, upload };
  }

  // workshop/product-intake.js
  var keyFor2 = (actor) => "fastgo_product_intake_v1:" + actor;
  var write = (storage, key3, value) => {
    const encoded = JSON.stringify(value);
    storage.setItem(key3, encoded);
    if (storage.getItem(key3) !== encoded) throw new Error("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0445\u043E\u0434 \u043F\u0440\u0438\u0451\u043C\u043A\u0438 \u0432 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0435.");
  };
  function loadProductIntake(storage, actor) {
    var _a3, _b, _c;
    const raw = storage.getItem(keyFor2(actor));
    if (!raw) return null;
    let value;
    try {
      value = JSON.parse(raw);
    } catch (e) {
      throw new Error("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C \u043D\u0435\u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043D\u043D\u0443\u044E \u043F\u0440\u0438\u0451\u043C\u043A\u0443. \u041D\u0435 \u0441\u043E\u0437\u0434\u0430\u0432\u0430\u0439\u0442\u0435 \u0435\u0451 \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u043E; \u0441\u0432\u0435\u0440\u044C\u0442\u0435 \u0441\u043A\u043B\u0430\u0434.");
    }
    if (value.version !== 1 || !value.product || !((_a3 = value.ids) == null ? void 0 : _a3.product) || !((_b = value.ids) == null ? void 0 : _b.stock) || !((_c = value.ids) == null ? void 0 : _c.photo)) throw new Error("\u041D\u0435\u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043D\u043D\u0430\u044F \u043F\u0440\u0438\u0451\u043C\u043A\u0430 \u0442\u0440\u0435\u0431\u0443\u0435\u0442 \u0441\u0432\u0435\u0440\u043A\u0438 \u0441\u043A\u043B\u0430\u0434\u0430.");
    return value;
  }
  function startProductIntake(storage, actor, { product: product2, quantity, photo = null }) {
    const existing = loadProductIntake(storage, actor);
    if (existing) return existing;
    if (!String(product2.name || "").trim() || !String(product2.category || "").trim() || !Number.isInteger(quantity) || quantity < 0 || quantity > 1e5) throw new Error("\u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u043D\u0430\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u0438\u0435, \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044E \u0438 \u043A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E (\u043E\u0442 0 \u0434\u043E 100000).");
    for (const name of ["unit_cost", "retail_price"]) if (!Number.isFinite(product2[name]) || product2[name] < 0 || product2[name] > 1e9) throw new Error("\u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0446\u0435\u043D\u0443 \u0442\u043E\u0432\u0430\u0440\u0430.");
    const state = { version: 1, product: product2, quantity, photo, ids: { product: crypto.randomUUID(), stock: crypto.randomUUID(), photo: crypto.randomUUID() }, part: null, received: false, photoSaved: false };
    write(storage, keyFor2(actor), state);
    return state;
  }
  async function continueProductIntake(storage, actor, { api: api2, uploadPhoto, onProgress = () => {
  } }) {
    const key3 = keyFor2(actor), state = loadProductIntake(storage, actor);
    if (!state) throw new Error("\u041D\u0435\u0442 \u043D\u0435\u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043D\u043D\u043E\u0439 \u043F\u0440\u0438\u0451\u043C\u043A\u0438.");
    if (!state.part) {
      onProgress("\u0421\u043E\u0445\u0440\u0430\u043D\u044F\u0435\u043C \u0442\u043E\u0432\u0430\u0440\u2026");
      try {
        state.part = await api2("part_save", { ...state.product, request_id: state.ids.product });
      } catch (error) {
        if ([400, 403, 404, 409, 413, 422].includes(error.status)) storage.removeItem(key3);
        throw error;
      }
      write(storage, key3, state);
    }
    if (state.quantity > 0 && !state.received) {
      onProgress("\u0422\u043E\u0432\u0430\u0440 \u0441\u043E\u0437\u0434\u0430\u043D. \u0417\u0430\u043F\u0438\u0441\u044B\u0432\u0430\u0435\u043C \u043F\u0440\u0438\u0445\u043E\u0434\u2026");
      await api2("stock", { part_id: state.part.id, movement_type: "receipt", quantity: state.quantity, note: "\u041F\u0435\u0440\u0432\u0438\u0447\u043D\u0430\u044F \u0440\u0443\u0447\u043D\u0430\u044F \u043F\u0440\u0438\u0451\u043C\u043A\u0430", request_id: state.ids.stock });
      state.received = true;
      write(storage, key3, state);
    }
    if (state.photo && !state.photoSaved) {
      onProgress("\u0422\u043E\u0432\u0430\u0440 \u0438 \u043F\u0440\u0438\u0445\u043E\u0434 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B. \u0421\u043E\u0445\u0440\u0430\u043D\u044F\u0435\u043C \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u043E\u0435 \u0444\u043E\u0442\u043E\u2026");
      await uploadPhoto(state.part, state.photo, state.ids.photo);
      state.photoSaved = true;
      write(storage, key3, state);
    }
    storage.removeItem(key3);
    return state.part;
  }

  // warehouse/new-part.js
  function newPartForm({ actor, api: api2, photos: photos2, parts: parts2, canReceive, run: run2, refresh, openProduct, message: message2, offerLabels: offerLabels2 = () => {
  } }) {
    return function open() {
      const dialog = document.createElement("dialog");
      dialog.className = "new-part-dialog";
      dialog.setAttribute("aria-label", "\u041D\u043E\u0432\u0430\u044F \u0437\u0430\u043F\u0447\u0430\u0441\u0442\u044C");
      const categories = [...new Set(parts2().map((p) => p.category).filter(Boolean))].sort();
      dialog.innerHTML = '<form><h2>\u041D\u043E\u0432\u0430\u044F \u0437\u0430\u043F\u0447\u0430\u0441\u0442\u044C</h2><div class="new-part-fields"><label>\u041D\u0430\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u0438\u0435<input name="name" required maxlength="200"></label><label>\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F<input name="category" required maxlength="100" list="new-part-categories"><datalist id="new-part-categories">' + categories.map((c) => '<option value="' + esc(c) + '">').join("") + '</datalist></label><label>\u041C\u043E\u0434\u0435\u043B\u044C / \u0440\u0430\u0437\u043C\u0435\u0440<input name="model" maxlength="120"></label><label>\u0410\u0440\u0442\u0438\u043A\u0443\u043B / SKU<input name="sku" maxlength="100"></label><label>\u0417\u0430\u043A\u0443\u043F\u043E\u0447\u043D\u0430\u044F \u0446\u0435\u043D\u0430, \u20BD<input name="unit_cost" type="number" min="0" max="1000000000" step="0.01" value="0" required></label><label>\u041F\u0440\u043E\u0434\u0430\u0436\u0430, \u20BD<input name="retail_price" type="number" min="0" max="1000000000" step="0.01" value="0" required></label><label>\u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u043F\u0440\u0438 \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u0438<input name="initial_quantity" type="number" min="0" max="100000" step="1" value="0" ' + (canReceive() ? "" : "disabled") + '></label><label>\u0415\u0434\u0438\u043D\u0438\u0446\u0430 \u0438\u0437\u043C\u0435\u0440\u0435\u043D\u0438\u044F<input name="unit" value="\u0448\u0442" maxlength="20" required></label></div><p class="muted">\u0428\u0442\u0440\u0438\u0445\u043A\u043E\u0434 FastGo \u043F\u0440\u0438\u0441\u0432\u043E\u0438\u0442\u0441\u044F \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438.' + (canReceive() ? " \u041D\u0430\u0447\u0430\u043B\u044C\u043D\u043E\u0435 \u043A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u043E\u0444\u043E\u0440\u043C\u0438\u0442\u0441\u044F \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u043C \u043F\u0440\u0438\u0445\u043E\u0434\u043E\u043C." : " \u041F\u0440\u0438\u0445\u043E\u0434 \u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D \u043D\u0430 \u0434\u0432\u0443\u0445 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D\u043D\u044B\u0445 \u043D\u043E\u0443\u0442\u0431\u0443\u043A\u0430\u0445.") + '</p><label>\u0424\u043E\u0442\u043E\u0433\u0440\u0430\u0444\u0438\u044F \u0437\u0430\u043F\u0447\u0430\u0441\u0442\u0438<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"></label><img class="new-part-preview" alt="\u0412\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0435 \u0444\u043E\u0442\u043E" hidden><label class="new-part-category-photo"><input name="category_primary" type="checkbox"> \u0421\u0434\u0435\u043B\u0430\u0442\u044C \u0444\u043E\u0442\u043E \u043E\u0441\u043D\u043E\u0432\u043D\u044B\u043C \u0434\u043B\u044F \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438</label><p class="new-part-status" role="status" aria-live="polite"></p><div class="actions"><button type="button" data-close>\u0417\u0430\u043A\u0440\u044B\u0442\u044C</button><button class="primary" type="submit">\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u0437\u0430\u043F\u0447\u0430\u0441\u0442\u044C</button></div></form>';
      document.body.append(dialog);
      dialog.showModal();
      const form = dialog.querySelector("form"), submit = dialog.querySelector("[type=submit]"), status = dialog.querySelector("[role=status]"), close = dialog.querySelector("[data-close]"), fileInput = form.elements.photo;
      let preview = "", saving = false;
      const restore = () => {
        var _a3;
        const state = loadProductIntake(localStorage, actor());
        if (!state) return null;
        for (const [name, value] of Object.entries({ ...state.product, initial_quantity: state.quantity })) {
          const input = form.elements.namedItem(name);
          if (input) {
            input.value = value;
            input.disabled = true;
          }
        }
        form.elements.category_primary.checked = !!((_a3 = state.photo) == null ? void 0 : _a3.primary);
        form.elements.category_primary.disabled = true;
        submit.textContent = "\u041F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0435";
        return state;
      };
      try {
        if (restore()) status.textContent = "\u041F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u043C \u043D\u0435\u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043D\u043D\u043E\u0435 \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u0435. \u0422\u043E\u0432\u0430\u0440 \u0438 \u043F\u0440\u0438\u0445\u043E\u0434 \u043D\u0435 \u0431\u0443\u0434\u0443\u0442 \u0437\u0430\u043F\u0438\u0441\u0430\u043D\u044B \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u043E.";
      } catch (error) {
        status.textContent = error.message;
        submit.disabled = true;
        submit.dataset.unavailable = "true";
      }
      close.onclick = () => dialog.close();
      dialog.addEventListener("cancel", (e) => {
        if (saving) e.preventDefault();
      });
      dialog.onclose = () => {
        if (preview) URL.revokeObjectURL(preview);
        dialog.remove();
      };
      fileInput.onchange = () => {
        if (preview) URL.revokeObjectURL(preview);
        const file = fileInput.files[0], image = dialog.querySelector(".new-part-preview");
        image.hidden = !file;
        if (file) {
          preview = URL.createObjectURL(file);
          image.src = preview;
        } else image.removeAttribute("src");
      };
      form.onsubmit = (e) => {
        e.preventDefault();
        if (saving || !form.reportValidity()) return;
        void run2(async () => {
          saving = true;
          submit.disabled = true;
          close.disabled = true;
          fileInput.disabled = true;
          try {
            const fields = new FormData(form), file = fileInput.files[0];
            let photo = null;
            if (file) {
              if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 25 * 1024 * 1024) throw Error("\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 JPG, PNG \u0438\u043B\u0438 WebP \u043D\u0435 \u0431\u043E\u043B\u044C\u0448\u0435 25 \u041C\u0411");
              const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()));
              photo = { sha256: [...hash].map((v) => v.toString(16).padStart(2, "0")).join(""), type: file.type, primary: form.elements.category_primary.checked };
            }
            let state = loadProductIntake(localStorage, actor());
            if (!state) state = startProductIntake(localStorage, actor(), { product: { name: String(fields.get("name") || "").trim(), category: String(fields.get("category") || "").trim(), model: String(fields.get("model") || "").trim(), sku: String(fields.get("sku") || "").trim(), unit_cost: Number(fields.get("unit_cost") || 0), retail_price: Number(fields.get("retail_price") || 0), unit: String(fields.get("unit") || "\u0448\u0442") }, quantity: Number(fields.get("initial_quantity") || 0), photo });
            restore();
            if (state.quantity > 0 && !canReceive()) throw Error("\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0439 \u043F\u0440\u0438\u0445\u043E\u0434 \u043D\u0430 \u0440\u0430\u0437\u0440\u0435\u0448\u0451\u043D\u043D\u043E\u043C \u0441\u043A\u043B\u0430\u0434\u0441\u043A\u043E\u043C \u043D\u043E\u0443\u0442\u0431\u0443\u043A\u0435.");
            if (state.photo && !state.photoSaved && (!photo || photo.sha256 !== state.photo.sha256 || photo.type !== state.photo.type)) throw Error("\u0414\u043B\u044F \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0435\u043D\u0438\u044F \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0442\u043E \u0436\u0435 \u0444\u043E\u0442\u043E. \u0422\u043E\u0432\u0430\u0440 \u0438 \u043F\u0440\u0438\u0445\u043E\u0434 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B.");
            const part = await continueProductIntake(localStorage, actor(), { api: api2, onProgress: (text) => status.textContent = text, uploadPhoto: (part2, metadata, id) => photos2.upload(part2, file, id, metadata.primary, (text) => status.textContent = text) });
            let refreshFailed = false;
            try {
              await refresh();
            } catch (e2) {
              refreshFailed = true;
            }
            dialog.close();
            const saved = parts2().find((p) => p.id === part.id) || { ...part, quantity: state.quantity };
            openProduct(saved);
            message2("\u0417\u0430\u043F\u0447\u0430\u0441\u0442\u044C \u0441\u043E\u0437\u0434\u0430\u043D\u0430. " + (state.quantity > 0 ? "\u041F\u0440\u0438\u0445\u043E\u0434 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D. " : "") + (state.photo ? "\u0424\u043E\u0442\u043E\u0433\u0440\u0430\u0444\u0438\u044F \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0430. " : "") + (refreshFailed ? "\u0421\u043F\u0438\u0441\u043E\u043A \u043E\u0431\u043D\u043E\u0432\u0438\u0442\u0441\u044F \u043F\u043E\u0441\u043B\u0435 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F." : ""));
            if (state.quantity > 0) offerLabels2(saved, state.quantity);
          } catch (error) {
            if (dialog.isConnected) status.textContent = error.message;
            throw error;
          } finally {
            saving = false;
            if (dialog.isConnected) {
              submit.disabled = false;
              close.disabled = false;
              fileInput.disabled = false;
            }
          }
        });
      };
      form.elements.name.focus();
    };
  }

  // warehouse/label-offer.js
  var mobileLabelOffer = () => !window.warehouseDesktop && (matchMedia("(max-width: 700px)").matches || matchMedia("(pointer: coarse)").matches);
  function offerLabelPrinting(part, quantity, { call: call2, actor }) {
    var _a3;
    if (!(part == null ? void 0 : part.barcode) || !Number.isInteger(quantity) || quantity < 1) return;
    const key3 = "fastgo_label_offer_v1:" + actor + ":" + part.id;
    let pending2 = null;
    try {
      pending2 = JSON.parse(localStorage.getItem(key3) || "null");
    } catch (e) {
    }
    if ((pending2 == null ? void 0 : pending2.part_id) !== part.id) pending2 = null;
    const dialog = document.createElement("dialog");
    dialog.className = "barcode-print-dialog";
    dialog.setAttribute("aria-label", "\u041D\u0430\u043F\u0435\u0447\u0430\u0442\u0430\u0442\u044C \u044D\u0442\u0438\u043A\u0435\u0442\u043A\u0438?");
    dialog.innerHTML = "<form><h2>\u041D\u0430\u043F\u0435\u0447\u0430\u0442\u0430\u0442\u044C \u044D\u0442\u0438\u043A\u0435\u0442\u043A\u0438?</h2><p>" + esc(part.name) + "</p><p>\u0422\u043E\u0432\u0430\u0440 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D. \u041F\u0440\u0435\u0434\u043B\u0430\u0433\u0430\u0435\u043C \u043D\u0430\u043F\u0435\u0447\u0430\u0442\u0430\u0442\u044C <b>" + quantity + '</b> \u044D\u0442\u0438\u043A\u0435\u0442\u043E\u043A. \u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u043C\u043E\u0436\u043D\u043E \u0438\u0437\u043C\u0435\u043D\u0438\u0442\u044C.</p><label>\u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u044D\u0442\u0438\u043A\u0435\u0442\u043E\u043A<input name="quantity" type="number" min="1" max="1000" step="1" required value="' + esc((_a3 = pending2 == null ? void 0 : pending2.quantity) != null ? _a3 : quantity) + '"></label><label>\u041A\u0430\u0441\u0441\u0430 \u0438 \u0442\u0435\u0440\u043C\u043E\u043F\u0440\u0438\u043D\u0442\u0435\u0440<select name="station" required aria-label="\u041A\u0430\u0441\u0441\u043E\u0432\u044B\u0439 \u043F\u0440\u0438\u043D\u0442\u0435\u0440"></select></label><div class="printer-size"><label>\u0428\u0438\u0440\u0438\u043D\u0430, \u043C\u043C<input name="width_mm" aria-label="\u0428\u0438\u0440\u0438\u043D\u0430 \u044D\u0442\u0438\u043A\u0435\u0442\u043A\u0438, \u043C\u043C" type="number" min="30" max="110" step="0.1" value="58" required></label><label>\u0412\u044B\u0441\u043E\u0442\u0430, \u043C\u043C<input name="height_mm" aria-label="\u0412\u044B\u0441\u043E\u0442\u0430 \u044D\u0442\u0438\u043A\u0435\u0442\u043A\u0438, \u043C\u043C" type="number" min="20" max="200" step="0.1" value="30" required></label></div><label class="printer-remember" data-remember-label hidden><input name="remember" type="checkbox" checked>\u0417\u0430\u043F\u043E\u043C\u043D\u0438\u0442\u044C \u043F\u0440\u0438\u043D\u0442\u0435\u0440 \u0438 \u0440\u0430\u0437\u043C\u0435\u0440 \u043D\u0430 \u043A\u0430\u0441\u0441\u0435</label><p data-status role="status">\u0418\u0449\u0435\u043C \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D\u043D\u044B\u0435 \u0442\u0435\u0440\u043C\u043E\u043F\u0440\u0438\u043D\u0442\u0435\u0440\u044B\u2026</p><p class="error" role="alert"></p><div class="actions"><button type="button" data-close>\u041D\u0435 \u043F\u0435\u0447\u0430\u0442\u0430\u0442\u044C</button><button type="submit" class="primary" disabled>\u041D\u0430\u043F\u0435\u0447\u0430\u0442\u0430\u0442\u044C</button></div></form>';
    document.body.append(dialog);
    dialog.showModal();
    dialog.onclose = () => dialog.remove();
    const form = dialog.querySelector("form"), input = form.elements.quantity, station = form.elements.station, width = form.elements.width_mm, height = form.elements.height_mm, remember = form.elements.remember, rememberLabel = form.querySelector("[data-remember-label]"), button = form.querySelector("[type=submit]"), close = form.querySelector("[data-close]"), status = form.querySelector("[data-status]"), error = form.querySelector("[role=alert]");
    let busy2 = false, targets = [];
    const targetKey = (x) => JSON.stringify([x.id, x.printer]);
    const selected = () => targets.find((x) => targetKey(x) === station.value);
    const sizedTarget = (target) => Number.isSafeInteger(target == null ? void 0 : target.label_pipeline) && target.label_pipeline >= 3;
    close.onclick = () => dialog.close();
    dialog.oncancel = (e) => {
      if (busy2) e.preventDefault();
    };
    const freeze = (value) => {
      for (const el of [input, station, width, height, remember]) el.disabled = value;
    };
    if (pending2) {
      freeze(true);
      close.textContent = "\u0417\u0430\u043A\u0440\u044B\u0442\u044C";
    }
    function showTarget() {
      var _a4, _b, _c, _d;
      const target = selected();
      button.disabled = !pending2 && !target;
      width.value = (_b = (_a4 = pending2 == null ? void 0 : pending2.width_mm) != null ? _a4 : target == null ? void 0 : target.width_mm) != null ? _b : 58;
      height.value = (_d = (_c = pending2 == null ? void 0 : pending2.height_mm) != null ? _c : target == null ? void 0 : target.height_mm) != null ? _d : 30;
      form.querySelector(".printer-size").hidden = !sizedTarget(target) && (pending2 == null ? void 0 : pending2.width_mm) === void 0;
      width.disabled = height.disabled = !!pending2 || !sizedTarget(target);
      rememberLabel.hidden = !((target == null ? void 0 : target.can_remember) === true || (pending2 == null ? void 0 : pending2.remember_printer) === true);
      remember.checked = pending2 ? pending2.remember_printer === true : (target == null ? void 0 : target.can_remember) === true;
      remember.disabled = !!pending2 || (target == null ? void 0 : target.can_remember) !== true;
      status.textContent = pending2 ? "\u041F\u043E\u0432\u0442\u043E\u0440\u044F\u0435\u043C \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u043E\u0435 \u0437\u0430\u0434\u0430\u043D\u0438\u0435 \u0441 \u0442\u0435\u043C \u0436\u0435 \u043F\u0440\u0438\u043D\u0442\u0435\u0440\u043E\u043C, \u043A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E\u043C \u0438 \u0444\u043E\u0440\u043C\u0430\u0442\u043E\u043C." : !target ? "\u041A\u0430\u0441\u0441\u0430 \u043F\u043E\u043A\u0430 \u043D\u0435 \u0441\u043E\u043E\u0431\u0449\u0438\u043B\u0430 \u043E \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D\u043D\u043E\u043C \u0442\u0435\u0440\u043C\u043E\u043F\u0440\u0438\u043D\u0442\u0435\u0440\u0435." : target.online ? "\u042D\u0442\u0438\u043A\u0435\u0442\u043A\u0438 \u043D\u0430\u043F\u0435\u0447\u0430\u0442\u0430\u0435\u0442 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0439 \u043F\u0440\u0438\u043D\u0442\u0435\u0440 \u043A\u0430\u0441\u0441\u043E\u0432\u043E\u0433\u043E \u043D\u043E\u0443\u0442\u0431\u0443\u043A\u0430." : "\u041A\u0430\u0441\u0441\u0430 \u0441\u0435\u0439\u0447\u0430\u0441 \u043D\u0435 \u0432 \u0441\u0435\u0442\u0438. \u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u0434\u043E\u0436\u0434\u0451\u0442\u0441\u044F \u0435\u0451 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F.";
    }
    void call2("label_targets", { label_pipeline: 3 }).then((result) => {
      if (!dialog.isConnected) return;
      targets = Array.isArray(result) ? result : [];
      station.innerHTML = targets.map((x) => '<option value="' + esc(targetKey(x)) + '">' + esc(x.name + " \xB7 " + (x.displayName || x.printer) + (x.isDefault ? " \xB7 \u043E\u0441\u043D\u043E\u0432\u043D\u043E\u0439" : "")) + "</option>").join("");
      const target = pending2 ? targets.find((x) => x.id === pending2.station_id && (!pending2.printer_name || x.printer === pending2.printer_name)) : targets.find((x) => x.isDefault) || targets[0];
      if (target) station.value = targetKey(target);
      else if (pending2) {
        const option = document.createElement("option");
        option.value = "pending";
        option.textContent = "\u0421\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u043E\u0435 \u0437\u0430\u0434\u0430\u043D\u0438\u0435" + (pending2.printer_name ? " \xB7 " + pending2.printer_name : "");
        station.append(option);
        station.value = option.value;
      }
      station.onchange = showTarget;
      showTarget();
    }).catch((e) => {
      var _a4, _b;
      if (dialog.isConnected) {
        status.textContent = "\u0421\u043F\u0438\u0441\u043E\u043A \u043A\u0430\u0441\u0441\u043E\u0432\u044B\u0445 \u043F\u0440\u0438\u043D\u0442\u0435\u0440\u043E\u0432 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D.";
        error.textContent = e.message;
        if (pending2) {
          button.disabled = false;
          width.value = (_a4 = pending2.width_mm) != null ? _a4 : 58;
          height.value = (_b = pending2.height_mm) != null ? _b : 30;
        }
      }
    });
    form.onsubmit = async (e) => {
      var _a4;
      e.preventDefault();
      if (busy2 || !form.reportValidity()) return;
      const count = Number(input.value), widthMm = Number(width.value), heightMm = Number(height.value);
      if (!pending2 && (!Number.isInteger(count) || count < 1 || count > 1e3 || !Number.isFinite(widthMm) || widthMm < 30 || widthMm > 110 || !Number.isFinite(heightMm) || heightMm < 20 || heightMm > 200)) {
        error.textContent = "\u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u043A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u0438 \u0440\u0430\u0437\u043C\u0435\u0440 \u044D\u0442\u0438\u043A\u0435\u0442\u043A\u0438";
        return;
      }
      try {
        if (!pending2) {
          const target = selected();
          if (!target) throw Error("\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0442\u0435\u0440\u043C\u043E\u043F\u0440\u0438\u043D\u0442\u0435\u0440");
          const candidate = { request_id: uuid(), part_id: part.id, quantity: count, station_id: target.id, printer_name: target.printer, remember_printer: target.can_remember === true && remember.checked, ...sizedTarget(target) ? { width_mm: widthMm, height_mm: heightMm } : {} };
          const raw = JSON.stringify(candidate);
          localStorage.setItem(key3, raw);
          if (localStorage.getItem(key3) !== raw) throw Error("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0437\u0430\u0434\u0430\u043D\u0438\u0435 \u043D\u0430 \u0442\u0435\u043B\u0435\u0444\u043E\u043D\u0435. \u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0435.");
          pending2 = candidate;
        }
        busy2 = true;
        button.disabled = true;
        close.disabled = true;
        close.textContent = "\u0417\u0430\u043A\u0440\u044B\u0442\u044C";
        freeze(true);
        error.textContent = "";
        const result = await call2("label_enqueue", pending2);
        if ((result == null ? void 0 : result.id) !== pending2.request_id || !["pending", "printed"].includes(result.status)) throw Error("\u0421\u0435\u0440\u0432\u0435\u0440 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u043B \u043F\u0435\u0447\u0430\u0442\u044C. \u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0435 \u044D\u0442\u043E \u0436\u0435 \u0437\u0430\u0434\u0430\u043D\u0438\u0435.");
        localStorage.removeItem(key3);
        status.textContent = result.status === "printed" ? "\u042D\u0442\u0438\u043A\u0435\u0442\u043A\u0438 \u0443\u0436\u0435 \u043F\u0435\u0440\u0435\u0434\u0430\u043D\u044B \u043F\u0440\u0438\u043D\u0442\u0435\u0440\u0443. \u041F\u043E\u0432\u0442\u043E\u0440\u043D\u043E \u043D\u0435 \u043F\u0435\u0447\u0430\u0442\u0430\u0435\u043C." : "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u043D\u0430 " + pending2.quantity + " \u044D\u0442\u0438\u043A\u0435\u0442\u043E\u043A \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u043E \u043D\u0430 \u043A\u0430\u0441\u0441\u0443. \u041F\u0435\u0447\u0430\u0442\u044C \u043D\u0430\u0447\u043D\u0451\u0442\u0441\u044F \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438.";
        button.hidden = true;
        close.textContent = "\u0413\u043E\u0442\u043E\u0432\u043E";
      } catch (e2) {
        error.textContent = e2.message;
        if ([400, 403, 404, 409, 413, 422].includes(e2.status)) {
          localStorage.removeItem(key3);
          pending2 = null;
          freeze(false);
          width.disabled = height.disabled = !sizedTarget(selected());
          remember.disabled = ((_a4 = selected()) == null ? void 0 : _a4.can_remember) !== true;
        } else if (pending2) status.textContent = "\u041E\u0442\u0432\u0435\u0442 \u043D\u0435 \u043F\u043E\u043B\u0443\u0447\u0435\u043D. \u041D\u0430\u0436\u043C\u0438\u0442\u0435 \xAB\u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C\xBB: \u043A\u043E\u0434 \u0437\u0430\u0434\u0430\u043D\u0438\u044F \u0438 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u044B \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B, \u0434\u0443\u0431\u043B\u0438\u043A\u0430\u0442\u0430 \u043D\u0435 \u0431\u0443\u0434\u0435\u0442.";
        button.textContent = "\u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C";
        button.disabled = false;
      } finally {
        busy2 = false;
        close.disabled = false;
      }
    };
    return dialog;
  }

  // warehouse/web-update.js
  var import_update_clock = __toESM(require_update_clock());
  function createWebUpdater({ version, fetchVersion, fetchPage, canApply, apply, notify = () => {
  } }) {
    let pending2 = null, checking = false, applying = false, immediate = false;
    async function tick() {
      if (!pending2 || applying) return;
      applying = true;
      try {
        if (!await canApply(immediate)) {
          notify("\u041E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435 \u044D\u043A\u0440\u0430\u043D\u0430 \u0433\u043E\u0442\u043E\u0432\u043E \xB7 \u043F\u0440\u0438\u043C\u0435\u043D\u0438\u0442\u0441\u044F \u043F\u043E\u0441\u043B\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u044F \u0440\u0430\u0431\u043E\u0442\u044B");
          return;
        }
        apply(pending2);
        pending2 = null;
        immediate = false;
      } catch (e) {
        notify("\u041E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435 \u044D\u043A\u0440\u0430\u043D\u0430 \u043E\u0442\u043B\u043E\u0436\u0435\u043D\u043E. \u041F\u043E\u0432\u0442\u043E\u0440\u0438\u043C \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438.");
      } finally {
        applying = false;
      }
    }
    async function check() {
      if (checking || applying) return;
      checking = true;
      try {
        const next = await fetchVersion();
        if (!/^[a-f0-9]{24}$/.test(next) || next === version) {
          if (next === version) {
            pending2 = null;
            if (immediate) notify("\u0423\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0430 \u0430\u043A\u0442\u0443\u0430\u043B\u044C\u043D\u0430\u044F \u0432\u0435\u0440\u0441\u0438\u044F \u044D\u043A\u0440\u0430\u043D\u0430 \xB7 " + version);
            immediate = false;
          }
          return;
        }
        if (await fetchPage(next) !== next) {
          notify("\u041F\u0443\u0431\u043B\u0438\u043A\u0430\u0446\u0438\u044F \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F \u0435\u0449\u0451 \u0438\u0434\u0451\u0442. \u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0443 \u043F\u043E\u0437\u0436\u0435.");
          return;
        }
        pending2 = next;
        notify("\u0414\u043E\u0441\u0442\u0443\u043F\u043D\u043E \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435 \u044D\u043A\u0440\u0430\u043D\u0430");
      } catch (e) {
        if (immediate) notify("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0438\u043D\u0442\u0435\u0440\u043D\u0435\u0442 \u0438 \u043F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0435.");
      } finally {
        checking = false;
      }
      await tick();
    }
    return { check, tick, now: async () => {
      immediate = true;
      notify("\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0432\u0435\u0440\u0441\u0438\u0438\u2026");
      await check();
      await tick();
    } };
  }
  function startWebUpdates({ canApply }) {
    var _a3;
    const version = (_a3 = document.querySelector('meta[name="warehouse-web-version"]')) == null ? void 0 : _a3.content;
    if (!version) return null;
    const get = async (url) => {
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15e3);
      try {
        const r = await fetch(url, { cache: "no-store", signal: controller.signal });
        if (!r.ok) throw Error("\u041D\u0435\u0442 \u0441\u0432\u044F\u0437\u0438");
        return r;
      } finally {
        clearTimeout(timer);
      }
    };
    const updater = createWebUpdater({
      version,
      fetchVersion: async () => {
        const u = new URL("warehouse/web-version.json", location.href);
        u.searchParams.set("check", Date.now());
        return (await (await get(u)).json()).version;
      },
      fetchPage: async (next) => {
        var _a4;
        const u = new URL(location.href);
        u.searchParams.set("ui", next);
        const html = await (await get(u)).text();
        return (_a4 = new DOMParser().parseFromString(html, "text/html").querySelector('meta[name="warehouse-web-version"]')) == null ? void 0 : _a4.content;
      },
      canApply,
      apply: (next) => {
        document.body.inert = true;
        const u = new URL(location.href);
        u.searchParams.set("ui", next);
        location.replace(u.href);
      },
      notify: (text) => {
        const el = document.getElementById("web-update-status");
        if (el) el.textContent = text;
      }
    });
    const daily = (0, import_update_clock.createDailyCheck)({ read: () => {
      try {
        return localStorage.getItem("warehouse-update-day");
      } catch (e) {
        return "";
      }
    }, write: (day) => {
      try {
        localStorage.setItem("warehouse-update-day", day);
      } catch (e) {
      }
    }, check: updater.check });
    setTimeout(() => void updater.check(), 5e3);
    setInterval(() => void updater.check(), 6e4);
    setInterval(() => void updater.tick(), 5e3);
    window.addEventListener("online", () => void updater.check());
    return updater;
  }

  // warehouse/price-adjustment.js
  var money2 = (n) => Number(n || 0).toLocaleString("ru-RU", { style: "currency", currency: "RUB" });
  function adjustedTotal(base, edit) {
    var _a3;
    const cents = Math.round(base * 100);
    if (!edit) return cents / 100;
    const raw = String((_a3 = edit.value) != null ? _a3 : "").trim().replace(",", ".");
    if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) return null;
    const value = Number(raw);
    if (!Number.isFinite(value) || value > 1e8) return null;
    if (edit.mode !== "discount") return value;
    if (edit.unit === "percent") return value <= 100 ? Math.round(cents * (1e4 - Math.round(value * 100)) / 1e4) / 100 : null;
    const off = Math.round(value * 100);
    return off <= cents ? (cents - off) / 100 : null;
  }
  function priceAdjustment({ prefix, base, read, write: write2, locked = () => false, changed = () => {
  }, label = "\u0418\u0442\u043E\u0433\u043E", inputLabel = "\u0421\u0443\u043C\u043C\u0430 \u043A \u043E\u043F\u043B\u0430\u0442\u0435", resetLabel = "\u041F\u043E \u043A\u0430\u0442\u0430\u043B\u043E\u0433\u0443" }) {
    const $2 = (name) => document.getElementById(prefix + "-" + name);
    const total = () => adjustedTotal(base(), read());
    const markup = () => '<div class="price-adjustment"><div class="total"><span>' + label + '</span><b id="' + prefix + '-total"></b></div><div class="price-actions"><button type="button" id="' + prefix + '-total-edit">\u270E \u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u0441\u0443\u043C\u043C\u0443</button><button type="button" id="' + prefix + '-discount-edit">% \u0421\u043A\u0438\u0434\u043A\u0430</button></div><div id="' + prefix + '-total-field" hidden><label>' + inputLabel + ', \u20BD<input id="' + prefix + '-total-input" type="text" inputmode="decimal" autocomplete="off" aria-label="' + inputLabel + '"></label></div><div id="' + prefix + '-discount-field" hidden><label>\u0420\u0430\u0437\u043C\u0435\u0440 \u0441\u043A\u0438\u0434\u043A\u0438<input id="' + prefix + '-discount-input" type="text" inputmode="decimal" autocomplete="off" aria-label="\u0420\u0430\u0437\u043C\u0435\u0440 \u0441\u043A\u0438\u0434\u043A\u0438"></label><label>\u0421\u043A\u0438\u0434\u043A\u0430 \u0432<select id="' + prefix + '-discount-unit" aria-label="\u0421\u043A\u0438\u0434\u043A\u0430 \u0432"><option value="rub">\u0420\u0443\u0431\u043B\u044F\u0445</option><option value="percent">\u041F\u0440\u043E\u0446\u0435\u043D\u0442\u0430\u0445</option></select></label></div><p id="' + prefix + '-price-note" class="muted" role="status"></p><button type="button" id="' + prefix + '-total-reset" hidden>' + resetLabel + "</button></div>";
    function draw() {
      var _a3;
      if (!$2("total")) return;
      const edit = read(), value = total(), discount = (edit == null ? void 0 : edit.mode) === "discount";
      $2("total").textContent = value === null ? "\u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0441\u0443\u043C\u043C\u0443" : money2(value);
      $2("total-field").hidden = !edit || discount;
      $2("discount-field").hidden = !discount;
      $2("total-reset").hidden = !edit;
      for (const [name, v] of [["total-input", discount ? "" : (_a3 = edit == null ? void 0 : edit.value) != null ? _a3 : ""], ["discount-input", discount ? edit.value : ""], ["discount-unit", (edit == null ? void 0 : edit.unit) || "rub"]]) if (document.activeElement !== $2(name)) $2(name).value = v;
      $2("price-note").textContent = value === null ? "\u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u0443\u044E \u0441\u0443\u043C\u043C\u0443. \u0421\u043A\u0438\u0434\u043A\u0430 \u043D\u0435 \u043C\u043E\u0436\u0435\u0442 \u043F\u0440\u0435\u0432\u044B\u0448\u0430\u0442\u044C \u0441\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C." : edit ? "\u0414\u043E \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F: " + money2(base()) + (value < base() ? " \xB7 \u0421\u043A\u0438\u0434\u043A\u0430: " + money2(Math.round((base() - value) * 100) / 100) : "") : "";
      for (const name of ["total-edit", "discount-edit", "total-input", "discount-input", "discount-unit", "total-reset"]) {
        $2(name).disabled = locked();
        $2(name).dataset.unavailable = String(locked());
      }
    }
    function bind() {
      const update = (edit) => {
        if (locked()) return;
        write2(edit);
        draw();
        changed();
      };
      $2("total-edit").onclick = () => {
        var _a3;
        if (locked()) return;
        update({ mode: "total", value: String((_a3 = total()) != null ? _a3 : base()) });
        $2("total-input").focus();
        $2("total-input").select();
      };
      $2("discount-edit").onclick = () => {
        if (locked()) return;
        update({ mode: "discount", unit: "rub", value: "0" });
        $2("discount-input").focus();
        $2("discount-input").select();
      };
      $2("total-input").oninput = () => update({ mode: "total", value: $2("total-input").value });
      const discount = () => update({ mode: "discount", value: $2("discount-input").value, unit: $2("discount-unit").value });
      $2("discount-input").oninput = discount;
      $2("discount-unit").onchange = discount;
      $2("total-reset").onclick = () => update(null);
      draw();
    }
    return { markup, draw, bind, total };
  }

  // warehouse/repair-payment.js?v=20261016-scan-2
  function repairPayment({ call: call2, render, home: home2, run: run2, message: message2, load: load2, save: save3 }) {
    let watching = 0;
    const $2 = (id) => document.getElementById(id);
    const summary = (q) => '<section class="panel"><h2>\u0420\u0435\u043C\u043E\u043D\u0442 \u2116 ' + esc(q.number) + "</h2><p>" + esc(q.vehicle) + '</p><div class="total"><span>\u041A \u043E\u043F\u043B\u0430\u0442\u0435</span><b>' + money(q.due) + "</b></div></section>";
    async function enqueue(q, usbId) {
      const cacheKey = usbId ? "repair:usb:" + usbId : "repair:terminal";
      let pending2 = load2(cacheKey);
      if (!pending2 || pending2.repair_id !== q.id) {
        pending2 = { request_id: uuid(), repair_id: q.id };
        save3(cacheKey, pending2);
      }
      const result = await call2("enqueue_repair", pending2);
      return { pending: pending2, result };
    }
    async function terminal2(q) {
      render('<div class="live-heading"><button id="repair-back" aria-label="\u041D\u0430\u0437\u0430\u0434">\u2190</button><h1>\u041E\u043F\u043B\u0430\u0442\u0430</h1></div>' + summary(q) + '<p id="repair-status" role="status">\u041F\u0435\u0440\u0435\u0434\u0430\u0451\u043C \u043D\u0430 \u043D\u043E\u0443\u0442\u0431\u0443\u043A\u2026</p>');
      $2("repair-back").onclick = home2;
      let jobId = "", polling2 = false;
      async function poll2() {
        var _a3;
        if (polling2 || !$2("repair-status")) return;
        polling2 = true;
        try {
          if (!jobId) {
            const { pending: pending2 } = await enqueue(q);
            jobId = pending2.request_id;
          }
          const r = await call2("job", { id: jobId });
          if (!$2("repair-status")) return;
          if ((r == null ? void 0 : r.state) === "done") {
            save3("repair:terminal", null);
            home2();
            message2(((_a3 = r.result) == null ? void 0 : _a3.cancelled) ? "\u0421\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u043E\u043F\u043B\u0430\u0442\u044B \u043E\u0442\u043C\u0435\u043D\u0435\u043D\u043E" : "\u041E\u043F\u043B\u0430\u0442\u0430 \u043F\u0440\u0438\u043D\u044F\u0442\u0430");
            return;
          }
          $2("repair-status").textContent = "\u041E\u0436\u0438\u0434\u0430\u0435\u043C \u043E\u043F\u043B\u0430\u0442\u0443 \u043D\u0430 \u043D\u043E\u0443\u0442\u0431\u0443\u043A\u0435";
        } catch (e) {
          if ($2("repair-status")) $2("repair-status").textContent = e.message;
        } finally {
          polling2 = false;
        }
      }
      void poll2();
      const timer = setInterval(() => {
        if (!$2("repair-status")) clearInterval(timer);
        else void poll2();
      }, 1e3);
    }
    async function station(q, usbId) {
      const { pending: pending2 } = await enqueue(q, usbId);
      await checkout2(await call2("job", { id: pending2.request_id }));
    }
    async function checkout2(job2) {
      var _a3, _b;
      const latest = await call2("job", { id: job2.id });
      if (!latest) throw Error("\u0414\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D");
      if (latest.state === "done") {
        home2();
        message2(((_a3 = latest.result) == null ? void 0 : _a3.cancelled) ? "\u0421\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u043E\u043F\u043B\u0430\u0442\u044B \u043E\u0442\u043C\u0435\u043D\u0435\u043D\u043E" : "\u041E\u043F\u043B\u0430\u0442\u0430 \u0443\u0436\u0435 \u043F\u0440\u043E\u0432\u0435\u0434\u0435\u043D\u0430");
        return;
      }
      const q = latest.repair || await call2("repair_quote", { repair_id: latest.payload.repair_id }), fixed = latest.checkout;
      const cacheKey = "repair-price:" + latest.id, methodKey = "repair-method:" + latest.id, signature = JSON.stringify([q.total, q.paid, q.revision]);
      let stale = false, submitting = false;
      const read = () => {
        if ((fixed == null ? void 0 : fixed.total_override) !== void 0) return { value: String(fixed.total_override) };
        const saved = load2(cacheKey);
        return (saved == null ? void 0 : saved.signature) === signature ? saved : null;
      };
      const editable = (_b = q.price_editable) != null ? _b : !["issued", "cancelled", "returned"].includes(q.status);
      const price = priceAdjustment({ prefix: "repair", base: () => q.total, read, write: (edit) => save3(cacheKey, edit ? { ...edit, signature } : null), locked: () => !!fixed || submitting || stale || !editable, changed: drawBalance, label: "\u041F\u043E\u043B\u043D\u0430\u044F \u0441\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C \u0440\u0435\u043C\u043E\u043D\u0442\u0430", inputLabel: "\u0421\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C \u0440\u0435\u043C\u043E\u043D\u0442\u0430", resetLabel: "\u0422\u0435\u043A\u0443\u0449\u0430\u044F \u0441\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C \u0437\u0430\u043A\u0430\u0437\u0430" });
      render('<div class="live-heading"><button id="repair-back" aria-label="\u041D\u0430\u0437\u0430\u0434">\u2190</button><h1>\u041E\u043F\u043B\u0430\u0442\u0430 \u0440\u0435\u043C\u043E\u043D\u0442\u0430</h1></div><section class="panel"><h2>\u0420\u0435\u043C\u043E\u043D\u0442 \u2116 ' + esc(q.number) + "</h2><p>" + esc(q.vehicle) + "</p>" + price.markup() + '<div class="total"><span>\u0423\u0436\u0435 \u043E\u043F\u043B\u0430\u0447\u0435\u043D\u043E</span><b>' + money(q.paid) + '</b></div><div class="total"><span>\u041A \u043E\u043F\u043B\u0430\u0442\u0435</span><b id="repair-due"></b></div></section><fieldset class="payment-options"><legend>\u0421\u043F\u043E\u0441\u043E\u0431 \u043E\u043F\u043B\u0430\u0442\u044B</legend>' + [["cash", "\u041D\u0430\u043B\u0438\u0447\u043D\u044B\u0435"], ["card", "\u0411\u0435\u0437\u043D\u0430\u043B\u0438\u0447\u043D\u044B\u0439 \u0440\u0430\u0441\u0447\u0451\u0442"], ["transfer", "\u041F\u0435\u0440\u0435\u0432\u043E\u0434"]].map(([value, label]) => '<label><input type="radio" name="repair-method" value="' + value + '">' + label + "</label>").join("") + '</fieldset><p id="repair-state" class="muted" role="status"></p><button type="button" id="repair-refresh" hidden>\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u0441\u0443\u043C\u043C\u0443 \u0440\u0435\u043C\u043E\u043D\u0442\u0430</button><button class="primary" id="repair-pay">\u041F\u0440\u0438\u043D\u044F\u0442\u044C \u043E\u043F\u043B\u0430\u0442\u0443</button><button type="button" class="live-cancel" id="repair-cancel">\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C \u043E\u043F\u043B\u0430\u0442\u0443</button>');
      const renderedPayment = $2("repair-pay");
      function drawBalance() {
        if ($2("repair-pay") !== renderedPayment) return;
        const total = price.total(), due = total === null ? null : (Math.round(total * 100) - Math.round(q.paid * 100)) / 100;
        $2("repair-due").textContent = due === null || due < 0 ? "\u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0441\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C" : money(due);
        const disabled = stale || submitting || !fixed && (!editable || due === null || due <= 0);
        $2("repair-pay").disabled = disabled;
        $2("repair-pay").dataset.unavailable = String(disabled);
        $2("repair-pay").textContent = read() && !fixed ? "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0446\u0435\u043D\u0443 \u0438 \u043F\u0440\u0438\u043D\u044F\u0442\u044C \u043E\u043F\u043B\u0430\u0442\u0443" : "\u041F\u0440\u0438\u043D\u044F\u0442\u044C \u043E\u043F\u043B\u0430\u0442\u0443";
        const cancellingBlocked = !!fixed || submitting || latest.state !== "queued";
        $2("repair-cancel").disabled = cancellingBlocked;
        $2("repair-cancel").dataset.unavailable = String(cancellingBlocked);
        if (!stale) $2("repair-state").textContent = !editable ? "\u0420\u0435\u043C\u043E\u043D\u0442 \u0437\u0430\u043A\u0440\u044B\u0442. \u041F\u0440\u0438\u0451\u043C \u043E\u043F\u043B\u0430\u0442\u044B \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D." : due < 0 ? "\u0421\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C \u043C\u0435\u043D\u044C\u0448\u0435 \u0443\u0436\u0435 \u0432\u043D\u0435\u0441\u0451\u043D\u043D\u043E\u0439 \u043E\u043F\u043B\u0430\u0442\u044B. \u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043E\u0444\u043E\u0440\u043C\u0438\u0442\u0435 \u0432\u043E\u0437\u0432\u0440\u0430\u0442." : due === 0 ? "\u0420\u0435\u043C\u043E\u043D\u0442 \u043E\u043F\u043B\u0430\u0447\u0435\u043D. \u0414\u043B\u044F \u043D\u043E\u0432\u043E\u0439 \u0441\u0443\u043C\u043C\u044B \u0438\u0437\u043C\u0435\u043D\u0438\u0442\u0435 \u043F\u043E\u043B\u043D\u0443\u044E \u0441\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C." : read() ? "\u041D\u043E\u0432\u0430\u044F \u043F\u043E\u043B\u043D\u0430\u044F \u0441\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0441\u044F \u0432\u043C\u0435\u0441\u0442\u0435 \u0441 \u043E\u043F\u043B\u0430\u0442\u043E\u0439. \u041E\u0441\u0442\u0430\u0442\u043E\u043A \u0434\u043E\u043B\u0433\u0430 \u0431\u0443\u0434\u0435\u0442 \u043F\u0435\u0440\u0435\u0441\u0447\u0438\u0442\u0430\u043D." : "";
      }
      price.bind();
      drawBalance();
      $2("repair-back").onclick = home2;
      $2("repair-refresh").onclick = () => run2(() => checkout2(latest));
      const method = (fixed == null ? void 0 : fixed.method) || load2(methodKey);
      for (const input of document.querySelectorAll('input[name="repair-method"]')) {
        input.checked = input.value === method;
        input.disabled = !!fixed;
        input.onchange = () => save3(methodKey, input.value);
      }
      const token = ++watching;
      let polling2 = false;
      const timer = setInterval(async () => {
        var _a4;
        if (token !== watching || !$2("repair-pay")) {
          clearInterval(timer);
          return;
        }
        if (polling2 || submitting) return;
        polling2 = true;
        try {
          const status = await call2("job", { id: latest.id });
          if (token !== watching || !$2("repair-pay")) return;
          if ((status == null ? void 0 : status.state) === "done") {
            clearInterval(timer);
            save3(cacheKey, null);
            save3(methodKey, null);
            home2();
            message2(((_a4 = status.result) == null ? void 0 : _a4.cancelled) ? "\u041E\u043F\u043B\u0430\u0442\u0430 \u0440\u0435\u043C\u043E\u043D\u0442\u0430 \u043E\u0442\u043C\u0435\u043D\u0435\u043D\u0430" : "\u041E\u043F\u043B\u0430\u0442\u0430 \u0440\u0435\u043C\u043E\u043D\u0442\u0430 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0430");
          } else if ((status == null ? void 0 : status.checkout) && !fixed) {
            clearInterval(timer);
            await checkout2(status);
          } else if ((status == null ? void 0 : status.repair) && JSON.stringify([status.repair.total, status.repair.paid, status.repair.revision]) !== signature) {
            stale = true;
            price.draw();
            drawBalance();
            $2("repair-state").textContent = "\u0421\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C \u0438\u043B\u0438 \u0434\u0430\u043D\u043D\u044B\u0435 \u0440\u0435\u043C\u043E\u043D\u0442\u0430 \u0438\u0437\u043C\u0435\u043D\u0438\u043B\u0438\u0441\u044C \u043D\u0430 \u0434\u0440\u0443\u0433\u043E\u043C \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0435. \u041E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 \u0441\u0443\u043C\u043C\u0443 \u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0441\u043A\u0438\u0434\u043A\u0443 \u043F\u0435\u0440\u0435\u0434 \u043E\u043F\u043B\u0430\u0442\u043E\u0439.";
            $2("repair-refresh").hidden = false;
          }
        } catch (e) {
          if ($2("repair-state")) $2("repair-state").textContent = e.message;
        } finally {
          polling2 = false;
        }
      }, 1e3);
      $2("repair-cancel").onclick = () => run2(async () => {
        if (fixed || submitting || latest.state !== "queued") throw Error("\u041E\u043F\u043B\u0430\u0442\u0430 \u0443\u0436\u0435 \u043F\u0440\u043E\u0432\u043E\u0434\u0438\u0442\u0441\u044F. \u0414\u043E\u0436\u0434\u0438\u0442\u0435\u0441\u044C \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0430");
        if (!confirm("\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C \u043E\u043F\u043B\u0430\u0442\u0443 \u0440\u0435\u043C\u043E\u043D\u0442\u0430? \u0421\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C \u0440\u0435\u043C\u043E\u043D\u0442\u0430 \u0438 \u0443\u0436\u0435 \u0432\u043D\u0435\u0441\u0451\u043D\u043D\u044B\u0435 \u0441\u0443\u043C\u043C\u044B \u043D\u0435 \u0438\u0437\u043C\u0435\u043D\u044F\u0442\u0441\u044F.")) return;
        submitting = true;
        drawBalance();
        const complete = (result) => {
          var _a4, _b2;
          if ((result == null ? void 0 : result.state) !== "done") throw Error("\u0421\u0435\u0440\u0432\u0435\u0440 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u043B \u043E\u0442\u043C\u0435\u043D\u0443. \u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0435");
          watching++;
          clearInterval(timer);
          save3(cacheKey, null);
          save3(methodKey, null);
          if (((_a4 = load2("repair:terminal")) == null ? void 0 : _a4.request_id) === latest.id) save3("repair:terminal", null);
          home2();
          message2(((_b2 = result.result) == null ? void 0 : _b2.cancelled) ? "\u041E\u043F\u043B\u0430\u0442\u0430 \u0440\u0435\u043C\u043E\u043D\u0442\u0430 \u043E\u0442\u043C\u0435\u043D\u0435\u043D\u0430" : "\u041E\u043F\u043B\u0430\u0442\u0430 \u0443\u0436\u0435 \u043F\u0440\u043E\u0432\u0435\u0434\u0435\u043D\u0430");
        };
        try {
          complete(await call2("cancel_document", { id: latest.id, kind: "repair", revision: 1, repair_id: q.id }));
        } catch (error) {
          const status = await call2("job", { id: latest.id }).catch(() => null);
          if ((status == null ? void 0 : status.state) === "done") {
            complete(status);
            return;
          }
          if (status == null ? void 0 : status.checkout) await checkout2(status);
          throw error;
        } finally {
          submitting = false;
          drawBalance();
        }
      });
      $2("repair-pay").onclick = () => run2(async () => {
        var _a4, _b2, _c;
        const method2 = (fixed == null ? void 0 : fixed.method) || ((_a4 = document.querySelector('input[name="repair-method"]:checked')) == null ? void 0 : _a4.value);
        if (!method2) throw Error("\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u043F\u043E\u0441\u043E\u0431 \u043E\u043F\u043B\u0430\u0442\u044B");
        const total = price.total();
        if (total === null || stale) throw Error("\u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0441\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C \u0440\u0435\u043C\u043E\u043D\u0442\u0430");
        submitting = true;
        price.draw();
        drawBalance();
        try {
          await call2("checkout", { id: latest.id, payment_method: method2, amount: (_b2 = fixed == null ? void 0 : fixed.amount) != null ? _b2 : (Math.round(total * 100) - Math.round(q.paid * 100)) / 100, expected_revision: (_c = fixed == null ? void 0 : fixed.expected_revision) != null ? _c : q.revision, ...read() ? { total_override: total } : {} });
          save3(cacheKey, null);
          save3(methodKey, null);
          home2();
          message2("\u041E\u043F\u043B\u0430\u0442\u0430 \u0440\u0435\u043C\u043E\u043D\u0442\u0430 \u2116 " + q.number + " \u0437\u0430\u043F\u0438\u0441\u0430\u043D\u0430");
        } catch (e) {
          await checkout2(latest);
          throw e;
        } finally {
          submitting = false;
        }
      });
    }
    return { terminal: terminal2, station, checkout: checkout2 };
  }

  // warehouse/live-basket.js?v=20261016-scan-2
  function liveBasket({ terminal: terminal2, call: call2, parts: parts2, render, home: home2, run: run2, message: message2, load: load2, save: save3, refresh, repair: repair2, stationRepair, canOpen = () => true, manual }) {
    const $2 = (id) => document.getElementById(id), key3 = (kind2) => "live:" + kind2 + ":" + (terminal2 ? "terminal" : "station");
    let draft2 = null, current = null, kind = "", active = false, locked = false, stop = null, timer = null, pollTimer = null, syncing = null, polling2 = false, overrides = {}, dismissed = "", lastId = "", scanChain = Promise.resolve();
    const product2 = (x) => parts2().find((p) => p.id === (x == null ? void 0 : x.part_id));
    const shown = /* @__PURE__ */ new Map();
    const jobStamp = (value) => String((value == null ? void 0 : value.payload.updated_at) || (value == null ? void 0 : value.created_at) || "");
    function suspend() {
      if (current) dismissed = current.id + ":" + current.payload.revision;
      checkpoint();
      cleanup();
    }
    const rejected = (text) => Object.assign(Error(text), { rejected: true });
    const remaining = (local, job2) => local && local.id === job2.id && local.revision > job2.payload.revision ? local.items.map((x) => {
      var _a3;
      return { ...x, quantity: x.quantity - (((_a3 = job2.payload.items.find((y) => y.part_id === x.part_id)) == null ? void 0 : _a3.quantity) || 0) };
    }).filter((x) => x.quantity > 0) : [];
    function rememberUSB(local) {
      var _a3;
      if ((_a3 = local == null ? void 0 : local.usb_ids) == null ? void 0 : _a3.length) save3("usb:accepted", [...load2("usb:accepted") || [], ...local.usb_ids].slice(-1e4));
    }
    const cache = () => {
      if (draft2) save3(key3(draft2.kind), draft2);
    };
    function checkpoint() {
      if (terminal2) return;
      cache();
      if (current || (draft2 == null ? void 0 : draft2.items.length)) save3("live:resume:station", { kind, current: current ? JSON.parse(JSON.stringify(current)) : null, draft_id: (draft2 == null ? void 0 : draft2.id) || null });
    }
    async function restore() {
      var _a3;
      if (terminal2) return false;
      const saved = load2("live:resume:station");
      if (!saved) return false;
      if (saved.current) {
        const latest = await call2("job", { id: saved.current.id }).catch(() => null);
        if ((latest == null ? void 0 : latest.state) === "done") {
          save3("live:resume:station", null);
          return false;
        }
        await openMirror(latest || saved.current);
        return true;
      }
      if (((_a3 = load2(key3(saved.kind))) == null ? void 0 : _a3.id) === saved.draft_id) {
        await open(saved.kind);
        return true;
      }
      save3("live:resume:station", null);
      return false;
    }
    const newDraft = (k) => ({ id: uuid(), kind: k, revision: 1, acked: 0, items: [], usb_ids: [], note: "" });
    const source = () => (current == null ? void 0 : current.payload) || draft2 || { kind, items: [] };
    const qty = (x) => overrides[x.part_id] ? Number(overrides[x.part_id].value) + x.quantity - overrides[x.part_id].base : x.quantity;
    const signature = () => JSON.stringify(source().items);
    const baseTotal = () => Math.round(source().items.reduce((sum, x) => sum + x.quantity * amount(x), 0) * 100) / 100;
    function totalEdit() {
      const saved = load2("live-total:" + documentId());
      return (saved == null ? void 0 : saved.signature) === signature() ? saved : null;
    }
    const price = priceAdjustment({ prefix: "live", base: baseTotal, read: () => {
      var _a3;
      return ((_a3 = current == null ? void 0 : current.checkout) == null ? void 0 : _a3.total_override) !== void 0 ? { value: String(current.checkout.total_override) } : totalEdit();
    }, write: (edit) => save3("live-total:" + documentId(), edit ? { ...edit, signature: signature() } : null), locked: () => locked || !!(current == null ? void 0 : current.checkout) });
    const totalValue = () => price.total();
    const amount = (x) => {
      var _a3;
      return x.custom_price ? Number(x.unit_price) : Number(((_a3 = product2(x)) == null ? void 0 : _a3.retail_price) || 0);
    };
    function cleanup() {
      active = false;
      stop == null ? void 0 : stop();
      stop = null;
      clearTimeout(timer);
      clearInterval(pollTimer);
      pollTimer = null;
    }
    function changed() {
      draft2.revision++;
      cache();
      clearTimeout(timer);
      timer = setTimeout(() => void sync().catch((e) => feedback(e.message, true)), 120);
    }
    function feedback(text, error = false) {
      if (!$2("scan-feedback")) return;
      $2("scan-feedback").textContent = text;
      $2("scan-feedback").className = error ? "error" : "";
    }
    function finished(job2) {
      var _a3;
      if (!active) return;
      const local = draft2 || load2(key3(job2.payload.kind)), extra = remaining(local, job2);
      if (!terminal2) {
        save3("live:resume:station", null);
        save3("live-method:" + job2.id, null);
      }
      if ((local == null ? void 0 : local.id) === job2.id) {
        rememberUSB(local);
        save3(key3(local.kind), null);
      }
      if (draft2) {
        save3(key3(draft2.kind), null);
        save3("live:" + draft2.kind, null);
      }
      if (extra.length) {
        draft2 = { ...newDraft(kind), items: extra, last_part_id: extra[extra.length - 1].part_id };
        current = null;
        locked = false;
        cache();
        draw();
        changed();
        return;
      }
      draft2 = null;
      current = null;
      locked = false;
      cleanup();
      void refresh().catch(() => {
      });
      home2();
      message2(((_a3 = job2.result) == null ? void 0 : _a3.cancelled) ? job2.payload.kind === "receipt" ? "\u041F\u0440\u0438\u0445\u043E\u0434 \u043E\u0442\u043C\u0435\u043D\u0451\u043D" : "\u0414\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u043E\u0442\u043C\u0435\u043D\u0451\u043D" : kind === "receipt" ? "\u041F\u0440\u0438\u0445\u043E\u0434 \u043E\u0444\u043E\u0440\u043C\u043B\u0435\u043D" : "\u041E\u043F\u043B\u0430\u0442\u0430 \u043F\u0440\u0438\u043D\u044F\u0442\u0430");
    }
    async function sync() {
      if (syncing) {
        await syncing;
        if (draft2 && draft2.acked < draft2.revision) return sync();
        return;
      }
      if (!draft2 || locked || draft2.acked >= draft2.revision) return;
      const local = draft2, body = JSON.parse(JSON.stringify(local));
      syncing = call2("draft_sync", { request_id: body.id, kind: body.kind, revision: body.revision, items: body.items, note: body.note || "", active: active && draft2 === local }).then((r) => {
        if (r.state === "done") {
          if (draft2 === local) finished(r);
          return;
        }
        if (r.state !== "queued") throw Error("\u041E\u043F\u0435\u0440\u0430\u0446\u0438\u044F \u043F\u0440\u043E\u0432\u043E\u0434\u0438\u0442\u0441\u044F \u043D\u0430 \u043D\u043E\u0443\u0442\u0431\u0443\u043A\u0435");
        local.acked = Math.max(local.acked || 0, r.payload.revision);
        save3(key3(local.kind), local);
        if (active && draft2 === local && $2("live-sync")) $2("live-sync").textContent = "";
      }).catch(async (e) => {
        const job2 = await call2("job", { id: local.id }).catch(() => null);
        if ((job2 == null ? void 0 : job2.state) === "done" && draft2 === local) {
          finished(job2);
          return;
        }
        if (active && draft2 === local && $2("live-sync")) $2("live-sync").textContent = "\u041D\u0435\u0442 \u0441\u0432\u044F\u0437\u0438 \xB7 \u0441\u043A\u0430\u043D\u044B \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B";
        throw e;
      }).finally(() => syncing = null);
      await syncing;
      if (draft2 === local && local.acked < local.revision && !locked) return sync();
    }
    function draw() {
      var _a3, _b;
      if (!active || !$2("live-items")) return;
      const value = source(), items = value.items.filter((x) => {
        var _a4;
        return !((_a4 = overrides[x.part_id]) == null ? void 0 : _a4.removed) || qty(x) > 0;
      });
      if (terminal2) {
        const x = items.find((x2) => x2.part_id === (draft2 == null ? void 0 : draft2.last_part_id)) || items[items.length - 1];
        $2("live-items").innerHTML = x ? '<article class="last-scan"><small>\u041E\u0442\u0441\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u043E</small><h2>' + esc(((_a3 = product2(x)) == null ? void 0 : _a3.name) || x.part_id) + "</h2><p>" + x.quantity + " \u0448\u0442.</p></article>" : "";
        $2("scan-empty").hidden = !!x;
        return;
      }
      checkpoint();
      const host = $2("live-items"), seen = /* @__PURE__ */ new Set();
      for (const x of items) {
        seen.add(x.part_id);
        let row = [...host.children].find((r) => r.dataset.part === x.part_id);
        if (!row) {
          row = document.createElement("article");
          row.className = "scan-product station-product" + (value.kind === "receipt" ? " receipt-product" : "");
          row.dataset.part = x.part_id;
          row.innerHTML = "<strong></strong>" + (value.kind === "receipt" ? '<label>\u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E<input type="number" min="1" max="1000" step="1" data-live-qty="' + x.part_id + '" aria-label="\u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E"></label><button type="button" class="live-remove" data-live-remove="' + x.part_id + '" aria-label="\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u043F\u043E\u0437\u0438\u0446\u0438\u044E" title="\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u043F\u043E\u0437\u0438\u0446\u0438\u044E"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6"/></svg><span>\u0423\u0434\u0430\u043B\u0438\u0442\u044C</span></button>' : "<span data-count></span><b data-price></b>");
          host.append(row);
          const remove = row.querySelector("[data-live-remove]");
          if (remove) remove.onclick = () => {
            if (locked) return;
            const item = source().items.find((i) => i.part_id === x.part_id);
            overrides[x.part_id] = { value: 0, base: item.quantity, removed: true };
            save3("live-edits:" + documentId(), overrides);
            draw();
          };
          const input2 = row.querySelector("input");
          if (input2) {
            input2.oninput = () => {
              const item = source().items.find((i) => i.part_id === x.part_id);
              overrides[x.part_id] = { value: input2.value, base: item.quantity };
              save3("live-edits:" + documentId(), overrides);
            };
            input2.onblur = draw;
          }
        }
        const removeButton = row.querySelector("[data-live-remove]");
        if (removeButton) removeButton.disabled = locked;
        row.querySelector("strong").textContent = ((_b = product2(x)) == null ? void 0 : _b.name) || x.part_id;
        const input = row.querySelector("input");
        if (input) {
          input.disabled = locked;
          if (document.activeElement !== input) input.value = String(qty(x));
        } else {
          row.querySelector("[data-count]").textContent = x.quantity + " \u0448\u0442.";
          row.querySelector("[data-price]").textContent = money(amount(x) * x.quantity);
        }
      }
      for (const row of [...host.children]) if (!seen.has(row.dataset.part)) row.remove();
      if ($2("live-cancel")) {
        $2("live-cancel").disabled = locked;
        $2("live-cancel").dataset.unavailable = String(locked);
      }
      $2("scan-empty").hidden = !!items.length;
      $2("live-payment").hidden = value.kind !== "sale" || !items.length;
      $2("live-submit").hidden = !items.length;
      price.draw();
      for (const el of document.querySelectorAll('input[name="live-method"]')) el.disabled = locked;
    }
    function documentId() {
      return (current == null ? void 0 : current.id) || (draft2 == null ? void 0 : draft2.id) || "";
    }
    function markup(k) {
      return '<div class="live-heading"><button id="live-back" aria-label="\u0417\u0430\u043A\u0440\u044B\u0442\u044C \u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0447\u0435\u0440\u043D\u043E\u0432\u0438\u043A">' + (terminal2 ? "\u2190" : "\u2190 \u041A \u0441\u043F\u0438\u0441\u043A\u0443") + "</button><h1>" + (k === "receipt" ? "\u041F\u0440\u0438\u0445\u043E\u0434" : "\u041E\u043F\u043B\u0430\u0442\u0430") + "</h1></div>" + (!terminal2 && k === "sale" ? '<button type="button" id="manual-service-payment">\u0412\u043D\u0435\u0441\u0442\u0438 \u043E\u043F\u043B\u0430\u0442\u0443 \u0440\u0430\u0431\u043E\u0442 \u0432\u0440\u0443\u0447\u043D\u0443\u044E</button>' : "") + '<small id="live-sync"></small><form id="live-scan" class="scanner-sink" aria-hidden="true"><input id="live-code" inputmode="none" tabindex="-1" autocomplete="off" autocapitalize="off" spellcheck="false"></form><p id="scan-empty" class="scan-empty">\u041E\u0436\u0438\u0434\u0430\u0435\u043C \u0441\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435</p><div id="live-items" aria-live="polite"></div><p id="scan-feedback" role="status"></p>' + (terminal2 ? '<button id="scanner-compat">\u0421\u043A\u0430\u043D\u0435\u0440 \u043D\u0435 \u0432\u0432\u043E\u0434\u0438\u0442 \u043A\u043E\u0434?</button><small id="scan-received" role="status"></small>' : "") + (terminal2 ? "" : '<section id="live-payment" hidden>' + price.markup() + '<fieldset class="payment-options"><legend>\u0421\u043F\u043E\u0441\u043E\u0431 \u043E\u043F\u043B\u0430\u0442\u044B</legend>' + [["cash", "\u041D\u0430\u043B\u0438\u0447\u043D\u044B\u0435"], ["card", "\u0411\u0435\u0437\u043D\u0430\u043B\u0438\u0447\u043D\u044B\u0439 \u0440\u0430\u0441\u0447\u0451\u0442"], ["transfer", "\u041F\u0435\u0440\u0435\u0432\u043E\u0434"]].map(([v, label]) => '<label><input type="radio" name="live-method" value="' + v + '">' + label + "</label>").join("") + '</fieldset></section><button class="primary" id="live-submit" hidden>' + (k === "receipt" ? "\u041E\u0444\u043E\u0440\u043C\u0438\u0442\u044C \u043F\u0440\u0438\u0445\u043E\u0434" : "\u041F\u0440\u0438\u043D\u044F\u0442\u044C \u043E\u043F\u043B\u0430\u0442\u0443") + '</button><button type="button" class="live-cancel" id="live-cancel">' + (k === "receipt" ? "\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C \u0432\u0435\u0441\u044C \u043F\u0440\u0438\u0445\u043E\u0434" : "\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C \u043E\u043F\u043B\u0430\u0442\u0443") + "</button>");
    }
    function mount() {
      var _a3;
      render(markup(kind));
      draw();
      $2("live-back").onclick = () => {
        if (current) dismissed = current.id + ":" + current.payload.revision;
        cleanup();
        home2();
      };
      $2("live-scan").onsubmit = (e) => {
        e.preventDefault();
        const code = $2("live-code").value.trim();
        if (!code) return;
        if ($2("scan-received")) $2("scan-received").textContent = "\u041F\u043E\u043B\u0443\u0447\u0435\u043D \u043A\u043E\u0434: " + code;
        $2("live-code").value = "";
        void add(code).catch((e2) => feedback(e2.message, true));
      };
      if (terminal2) stop = bindScanner($2("live-code"), $2("live-scan"), () => active && !locked, { silent: true });
      function compatible(enabled, focus = false) {
        stop == null ? void 0 : stop();
        const form = $2("live-scan"), input = $2("live-code");
        form.className = enabled ? "scanner-compatible" : "scanner-sink";
        form.setAttribute("aria-hidden", String(!enabled));
        input.setAttribute("inputmode", enabled ? "text" : "none");
        input.tabIndex = enabled ? 0 : -1;
        input.setAttribute("aria-label", "\u041A\u043E\u0434 \u0430\u043F\u043F\u0430\u0440\u0430\u0442\u043D\u043E\u0433\u043E \u0441\u043A\u0430\u043D\u0435\u0440\u0430");
        input.placeholder = "\u041E\u0442\u0441\u043A\u0430\u043D\u0438\u0440\u0443\u0439\u0442\u0435 \u0442\u043E\u0432\u0430\u0440";
        stop = bindScanner(input, form, () => active && !locked, { silent: !enabled });
        $2("scanner-compat").textContent = enabled ? "\u0421\u043A\u0440\u044B\u0442\u044C \u043F\u043E\u043B\u0435 \u0441\u043A\u0430\u043D\u0435\u0440\u0430" : "\u0421\u043A\u0430\u043D\u0435\u0440 \u043D\u0435 \u0432\u0432\u043E\u0434\u0438\u0442 \u043A\u043E\u0434?";
        if (enabled) feedback("\u041E\u0431\u044B\u0447\u043D\u044B\u0439 \u0432\u0432\u043E\u0434 \u0432\u043A\u043B\u044E\u0447\u0451\u043D. \u041E\u0442\u0441\u043A\u0430\u043D\u0438\u0440\u0443\u0439\u0442\u0435 \u0442\u043E\u0432\u0430\u0440.");
        if (focus) input.focus();
      }
      if (terminal2) {
        let enabled = load2("scanner:compat") === true;
        if (enabled) compatible(true);
        $2("scanner-compat").onclick = () => {
          enabled = !enabled;
          save3("scanner:compat", enabled);
          compatible(enabled, true);
        };
      }
      if (!terminal2) {
        if ($2("manual-service-payment")) $2("manual-service-payment").onclick = () => manual == null ? void 0 : manual();
        if ($2("live-cancel")) $2("live-cancel").onclick = () => run2(cancelCurrent);
        $2("live-submit").onclick = () => run2(finish);
        price.bind();
        const method = ((_a3 = current == null ? void 0 : current.checkout) == null ? void 0 : _a3.payment_method) || load2("live-method:" + documentId());
        for (const el of document.querySelectorAll('input[name="live-method"]')) {
          el.checked = el.value === method;
          el.onchange = () => {
            save3("live-method:" + documentId(), el.value);
            checkpoint();
          };
        }
      }
      pollTimer = setInterval(() => void poll2().catch((e) => {
        if (active && $2("live-sync")) $2("live-sync").textContent = e.message;
      }), 1e3);
    }
    async function open(k) {
      cleanup();
      kind = k;
      current = null;
      locked = false;
      overrides = {};
      lastId = "";
      draft2 = load2(key3(kind)) || (terminal2 ? load2("live:" + kind) : null);
      if (draft2) {
        const r = await call2("job", { id: draft2.id }).catch(() => null);
        if ((r == null ? void 0 : r.state) === "done") {
          const extra = remaining(draft2, r);
          rememberUSB(draft2);
          save3(key3(kind), null);
          save3("live:" + kind, null);
          draft2 = extra.length ? { ...newDraft(kind), items: extra, last_part_id: extra[extra.length - 1].part_id } : null;
        } else if ((r == null ? void 0 : r.state) === "processing") {
          if (!terminal2) {
            current = r;
            draft2 = null;
            locked = true;
          } else locked = true;
        }
      }
      if (terminal2 && !draft2) draft2 = newDraft(kind);
      if (draft2) {
        cache();
        lastId = draft2.last_part_id || "";
        overrides = load2("live-edits:" + draft2.id) || {};
      }
      active = true;
      mount();
      if (draft2 == null ? void 0 : draft2.pickup) void run2(issuePending);
      else if (draft2) void sync().catch((e) => feedback(e.message, true));
    }
    async function openMirror(value) {
      var _a3;
      cleanup();
      kind = value.payload.kind;
      draft2 = null;
      current = value;
      shown.set(value.id, value.payload.revision);
      locked = value.state === "processing";
      overrides = load2("live-edits:" + value.id) || {};
      active = true;
      mount();
      if ((_a3 = value.checkout) == null ? void 0 : _a3.payment_method) {
        const el = document.querySelector('input[name="live-method"][value="' + value.checkout.payment_method + '"]');
        if (el) el.checked = true;
      }
    }
    async function addCode2(code, usbId) {
      var _a3, _b;
      if (!code) return;
      if (!active || locked) throw Error("\u0414\u043E\u0436\u0434\u0438\u0442\u0435\u0441\u044C \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u044F \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u0438");
      if (usbId && (((_a3 = draft2 == null ? void 0 : draft2.usb_ids) == null ? void 0 : _a3.includes(usbId)) || (load2("usb:accepted") || []).includes(usbId))) {
        const p = matchBarcode(parts2(), code)[0];
        return { name: (p == null ? void 0 : p.name) || code, price: p == null ? void 0 : p.retail_price, quantity: ((_b = draft2 == null ? void 0 : draft2.items.find((x) => x.part_id === (p == null ? void 0 : p.id))) == null ? void 0 : _b.quantity) || 1 };
      }
      if (current) throw Error("\u0421\u0435\u0439\u0447\u0430\u0441 \u043E\u0442\u043A\u0440\u044B\u0442 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u0434\u0440\u0443\u0433\u043E\u0433\u043E \u0442\u0435\u0440\u043C\u0438\u043D\u0430\u043B\u0430");
      const scanProblem = scanError(kind, code);
      if (scanProblem) throw rejected(scanProblem);
      const found = matchBarcode(parts2(), code);
      if (found.length !== 1) throw rejected(found.length ? "\u041A\u043E\u0434 \u043D\u0435\u043E\u0434\u043D\u043E\u0437\u043D\u0430\u0447\u0435\u043D" : "\u0422\u043E\u0432\u0430\u0440 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D: " + code);
      if (!draft2) draft2 = newDraft(kind);
      const before = JSON.stringify(draft2), old = draft2.items.find((x) => x.part_id === found[0].id);
      if (old) {
        if (old.quantity >= 1e3) throw rejected("\u041D\u0435 \u0431\u043E\u043B\u044C\u0448\u0435 1000 \u0448\u0442.");
        old.quantity++;
      } else {
        if (draft2.items.length >= 40) throw rejected("\u041D\u0435 \u0431\u043E\u043B\u044C\u0448\u0435 40 \u043F\u043E\u0437\u0438\u0446\u0438\u0439");
        draft2.items.push({ part_id: found[0].id, quantity: 1 });
      }
      draft2.last_part_id = found[0].id;
      if (usbId) (draft2.usb_ids || (draft2.usb_ids = [])).push(usbId);
      try {
        changed();
      } catch (e) {
        draft2 = JSON.parse(before);
        throw e;
      }
      lastId = found[0].id;
      draw();
      feedback("");
      return { name: found[0].name, price: found[0].retail_price, quantity: draft2.items.find((x) => x.part_id === lastId).quantity };
    }
    function add(code, usbId) {
      const next = scanChain.then(() => addCode2(code, usbId));
      scanChain = next.catch(() => {
      });
      return next;
    }
    async function issuePending() {
      if (!(draft2 == null ? void 0 : draft2.pickup)) throw Error("\u041D\u0435\u0442 \u0432\u044B\u0434\u0430\u0447\u0438 \u0434\u043B\u044F \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u044F");
      const local = draft2;
      locked = true;
      draw();
      try {
        const result = await call2("parts_issue", { request_id: local.pickup.request_id, code: local.pickup.code, items: local.items });
        await call2("cancel_document", { id: local.id, kind: "sale", revision: local.revision });
        finished({ id: local.id, payload: local, result: {} });
        message2("\u0417\u0430\u043F\u0447\u0430\u0441\u0442\u0438 \u0432\u044B\u0434\u0430\u043D\u044B \u0432 \u0440\u0435\u043C\u043E\u043D\u0442 \u2116 " + result.number + " \xB7 " + result.master_name);
      } catch (e) {
        locked = true;
        draw();
        feedback("\u0412\u044B\u0434\u0430\u0447\u0430 \u043D\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0430: " + e.message + ". \u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0435 QR \u043C\u0430\u0441\u0442\u0435\u0440\u0430 \u0438\u043B\u0438 \u043E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u044D\u0442\u043E\u0442 \u0447\u0435\u0440\u043D\u043E\u0432\u0438\u043A \u0434\u043B\u044F \u043F\u043E\u0432\u0442\u043E\u0440\u0430.", true);
        throw e;
      }
    }
    async function issueParts(code) {
      if (terminal2 || current || !(draft2 == null ? void 0 : draft2.items.length) || kind !== "sale") throw Error("\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043E\u0442\u0441\u043A\u0430\u043D\u0438\u0440\u0443\u0439\u0442\u0435 \u0437\u0430\u043F\u0447\u0430\u0441\u0442\u0438 \u0434\u043B\u044F \u043C\u0430\u0441\u0442\u0435\u0440\u0430. \u0421\u043A\u0430\u043D \u043E\u0442\u043C\u0435\u043D\u0451\u043D.");
      if (draft2.pickup) {
        if (draft2.pickup.code !== code) throw Error("\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u0435 \u043F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0443\u044E \u0432\u044B\u0434\u0430\u0447\u0443");
        return issuePending();
      }
      if (locked) throw Error("\u0414\u043E\u0436\u0434\u0438\u0442\u0435\u0441\u044C \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u044F \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u0438");
      await scanChain;
      await sync();
      await call2("parts_pickup_quote", { code });
      draft2.pickup = { code, request_id: uuid() };
      cache();
      checkpoint();
      return issuePending();
    }
    async function poll2() {
      if (polling2 || !active) return;
      polling2 = true;
      try {
        if (draft2) {
          const local = draft2;
          void sync().catch(() => {
          });
          const r = await call2("job", { id: local.id });
          if (active && draft2 === local && (r == null ? void 0 : r.state) === "done") finished(r);
          else if (active && draft2 === local && r) {
            locked = r.state === "processing";
            draw();
          }
          return;
        }
        if (current) {
          const id = current.id, r = await call2("job", { id });
          if (!active || (current == null ? void 0 : current.id) !== id || !r) return;
          if (r.state === "done") {
            finished(r);
            return;
          }
          if (r.payload.revision !== current.payload.revision || r.state !== current.state) {
            current = r;
            locked = r.state === "processing";
            draw();
          }
          return;
        }
        if (!terminal2) await pollMirror();
      } finally {
        polling2 = false;
      }
    }
    async function pollMirror() {
      var _a3, _b;
      if (terminal2 || !canOpen() || active && (locked || (draft2 == null ? void 0 : draft2.items.length))) return;
      const jobs = await call2("live_jobs");
      if (!canOpen() || active && (locked || (draft2 == null ? void 0 : draft2.items.length))) return;
      const candidates = jobs.filter((j) => j.state !== "done").sort((a, b) => String(b.payload.updated_at || b.created_at).localeCompare(String(a.payload.updated_at || a.created_at)));
      const found = candidates.find((j) => (!j.station_id || j.terminal_id !== j.station_id) && j.id !== (current == null ? void 0 : current.id) && shown.get(j.id) !== j.payload.revision && j.id + ":" + j.payload.revision !== dismissed && (!active || !current || jobStamp(j) > jobStamp(current)));
      if (found) {
        suspend();
        await openMirror(found);
        void ((_b = (_a3 = window.warehouseDesktop) == null ? void 0 : _a3.showIncoming) == null ? void 0 : _b.call(_a3));
        return;
      }
      const target = $2("live-terminal-panel");
      if (target) {
        target.textContent = "";
        for (const saved of candidates) {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = (saved.payload.kind === "receipt" ? "\u041F\u0440\u0438\u0445\u043E\u0434" : "\u041E\u043F\u043B\u0430\u0442\u0430") + " \xB7 \u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0447\u0435\u0440\u043D\u043E\u0432\u0438\u043A";
          button.onclick = () => run2(() => saved.terminal_id && saved.terminal_id === saved.station_id ? open(saved.payload.kind) : openMirror(saved));
          target.append(button);
        }
      }
    }
    async function cancelCurrent() {
      if (terminal2) return;
      const receipt = kind === "receipt";
      if (locked) throw Error("\u0414\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u0443\u0436\u0435 \u043F\u0440\u043E\u0432\u043E\u0434\u0438\u0442\u0441\u044F. \u0414\u043E\u0436\u0434\u0438\u0442\u0435\u0441\u044C \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0430");
      if (!confirm(receipt ? "\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C \u0432\u0435\u0441\u044C \u043F\u0440\u0438\u0445\u043E\u0434? \u0421\u043A\u043B\u0430\u0434\u0441\u043A\u0438\u0435 \u043E\u0441\u0442\u0430\u0442\u043A\u0438 \u043D\u0435 \u0438\u0437\u043C\u0435\u043D\u044F\u0442\u0441\u044F." : "\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C \u043E\u043F\u043B\u0430\u0442\u0443? \u041F\u0440\u043E\u0434\u0430\u0436\u0430 \u043D\u0435 \u0431\u0443\u0434\u0435\u0442 \u043F\u0440\u043E\u0432\u0435\u0434\u0435\u043D\u0430, \u043E\u0441\u0442\u0430\u0442\u043A\u0438 \u0438 \u0440\u0430\u0441\u0447\u0451\u0442\u044B \u043D\u0435 \u0438\u0437\u043C\u0435\u043D\u044F\u0442\u0441\u044F.")) return;
      await scanChain;
      if (draft2) await sync();
      const id = documentId(), value = source();
      if (!id) {
        cleanup();
        home2();
        message2(receipt ? "\u041F\u0443\u0441\u0442\u043E\u0439 \u043F\u0440\u0438\u0445\u043E\u0434 \u0437\u0430\u043A\u0440\u044B\u0442" : "\u041F\u0443\u0441\u0442\u0430\u044F \u043E\u043F\u043B\u0430\u0442\u0430 \u0437\u0430\u043A\u0440\u044B\u0442\u0430");
        return;
      }
      locked = true;
      draw();
      try {
        const result = await call2(receipt ? "draft_close" : "cancel_document", { id, kind, revision: value.revision });
        if ((result == null ? void 0 : result.state) !== "done") throw Error("\u0421\u0435\u0440\u0432\u0435\u0440 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u043B \u043E\u0442\u043C\u0435\u043D\u0443. \u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0435");
        save3("live-edits:" + id, null);
        save3("live-total:" + id, null);
        finished(result);
      } catch (e) {
        const latest = await call2("job", { id }).catch(() => null);
        if ((latest == null ? void 0 : latest.state) === "done") {
          save3("live-edits:" + id, null);
          finished(latest);
          return;
        }
        if (current && latest) current = latest;
        locked = (latest == null ? void 0 : latest.state) === "processing" || !!(latest == null ? void 0 : latest.checkout);
        draw();
        throw e;
      }
    }
    async function finish() {
      var _a3, _b, _c;
      if (terminal2) return;
      if (draft2 == null ? void 0 : draft2.pickup) throw Error("\u042D\u0442\u0438 \u0437\u0430\u043F\u0447\u0430\u0441\u0442\u0438 \u0432\u044B\u0434\u0430\u044E\u0442\u0441\u044F \u043C\u0430\u0441\u0442\u0435\u0440\u0443. \u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0447\u0435\u0440\u043D\u043E\u0432\u0438\u043A \u0434\u043B\u044F \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u044F \u0432\u044B\u0434\u0430\u0447\u0438.");
      await scanChain;
      if (draft2) await sync();
      const value = source(), id = documentId();
      if (!value.items.length) throw Error("\u041D\u0435\u0442 \u043E\u0442\u0441\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0445 \u0442\u043E\u0432\u0430\u0440\u043E\u0432");
      const method = ((_a3 = current == null ? void 0 : current.checkout) == null ? void 0 : _a3.payment_method) || ((_b = document.querySelector('input[name="live-method"]:checked')) == null ? void 0 : _b.value);
      if (kind === "sale" && !method) throw Error("\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u043F\u043E\u0441\u043E\u0431 \u043E\u043F\u043B\u0430\u0442\u044B");
      let chosen;
      if (kind === "receipt") {
        chosen = value.items.filter((x) => {
          var _a4;
          return !((_a4 = overrides[x.part_id]) == null ? void 0 : _a4.removed) || qty(x) > 0;
        }).map((x) => ({ part_id: x.part_id, quantity: qty(x) }));
        if (chosen.some((x) => !Number.isInteger(x.quantity) || x.quantity < 1 || x.quantity > 1e3) || Object.values(overrides).some((x) => !x.removed && x.value === "")) throw Error("\u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u043E\u0442 1 \u0434\u043E 1000");
      }
      const total = kind === "sale" ? totalValue() : void 0;
      if (total === null) throw Error("\u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u0441\u0443\u043C\u043C\u0443 \u043E\u0442 0 \u0434\u043E 100 000 000 \u20BD, \u043D\u0435 \u0431\u043E\u043B\u044C\u0448\u0435 \u0434\u0432\u0443\u0445 \u0437\u043D\u0430\u043A\u043E\u0432 \u043F\u043E\u0441\u043B\u0435 \u0437\u0430\u043F\u044F\u0442\u043E\u0439");
      const custom = kind === "sale" && (totalEdit() || ((_c = current == null ? void 0 : current.checkout) == null ? void 0 : _c.total_override) !== void 0);
      locked = true;
      draw();
      try {
        const result = await call2(kind === "receipt" ? "live_receive" : "live_pay", { id, revision: value.revision, payment_method: method, ...custom ? { total_override: total } : {}, ...chosen ? { items: chosen } : {} });
        save3("live-edits:" + id, null);
        save3("live-total:" + id, null);
        finished({ id, payload: value, result });
      } catch (e) {
        const r = await call2("job", { id }).catch(() => null);
        if ((r == null ? void 0 : r.state) === "done") {
          finished(r);
          return;
        }
        if (r) {
          if (current) current = r;
          locked = r.state === "processing";
        } else locked = true;
        draw();
        throw e;
      }
    }
    return { open, cleanup, suspend, checkpoint, restore, pollMirror, hasDraft: () => active && (!!current || locked) || !!(draft2 == null ? void 0 : draft2.items.length), active: () => active, kind: () => kind, canAutoOpen: () => !active || !locked && !(draft2 == null ? void 0 : draft2.items.length) && !(current == null ? void 0 : current.checkout), canPaymentScan: () => !current && (!locked || !!(draft2 == null ? void 0 : draft2.pickup)), issueParts, acceptPaymentScan: async (code) => {
      if (terminal2 || current || locked) throw Error("\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u0435 \u0442\u0435\u043A\u0443\u0449\u0438\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442. \u0421\u043A\u0430\u043D \u043E\u0442\u043C\u0435\u043D\u0451\u043D.");
      if (!active || kind !== "sale") {
        checkpoint();
        await open("sale");
      }
      return add(code);
    }, canUSB: (k) => !active || !current && !locked && kind === k, acceptUSB: async (item) => {
      if (!active) await open(item.kind);
      if (kind !== item.kind) throw Error("\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u0435 \u0442\u0435\u043A\u0443\u0449\u0438\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442");
      return add(item.code, item.id);
    } };
  }

  // warehouse/usb-client.js
  function bindUSBInbox({ key: key3, label, container, enabled, add, error, bridge = window.warehouseDesktop }) {
    if (!(bridge == null ? void 0 : bridge.usbTarget)) {
      container.hidden = true;
      return () => {
      };
    }
    let stopped = false, working = false, rendered = "";
    const live2 = () => !stopped && container.isConnected && enabled();
    function render(unassigned, blocked) {
      const signature = JSON.stringify([unassigned, blocked == null ? void 0 : blocked.id]);
      if (signature === rendered) return;
      rendered = signature;
      container.replaceChildren();
      const caption = document.createElement("span");
      caption.textContent = blocked ? "USB: \u043A\u043E\u0434 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D \u2014 " + blocked.code : "USB-\u0441\u043A\u0430\u043D\u0435\u0440: \u0433\u043E\u0442\u043E\u0432 \u043A \u043F\u0440\u0438\u0451\u043C\u0443";
      container.append(caption);
      const button = (text, action) => {
        const b = document.createElement("button");
        b.textContent = text;
        b.onclick = async () => {
          b.disabled = true;
          try {
            await action();
          } catch (e) {
            error(e.message);
          } finally {
            b.disabled = false;
          }
        };
        container.append(b);
      };
      if (unassigned) button("\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u043D\u0430\u043A\u043E\u043F\u043B\u0435\u043D\u043D\u044B\u0435 \u0441\u043A\u0430\u043D\u044B (" + unassigned + ")", () => bridge.usbClaim(key3));
      if (blocked) button("\u041F\u0440\u043E\u043F\u0443\u0441\u0442\u0438\u0442\u044C \u044D\u0442\u043E\u0442 \u0441\u043A\u0430\u043D", () => bridge.usbAck(key3, [blocked.id]));
    }
    async function poll2() {
      if (!live2() || working) return;
      working = true;
      try {
        await bridge.usbTarget({ key: key3, label });
        if (!live2()) return;
        const batch = await bridge.usbBatch(key3);
        if (!live2()) return;
        let blocked;
        for (const item of batch.items) {
          if (!live2()) break;
          if (!add(item)) {
            blocked = item;
            break;
          }
          await bridge.usbAck(key3, [item.id]);
        }
        if (live2()) render(batch.unassigned, blocked);
      } catch (e) {
        if (live2()) error(e.message);
      } finally {
        working = false;
      }
    }
    void poll2();
    const timer = setInterval(poll2, 400);
    return () => {
      stopped = true;
      clearInterval(timer);
      void bridge.usbTarget(null).catch(() => {
      });
    };
  }

  // warehouse/payment-scanner.js
  function paymentScan(code, parts2) {
    const value = normalizeScan(code);
    if (value.startsWith("FGPARTS1.")) return { kind: "parts", code: value };
    if (!scanError("repair", value)) return { kind: "repair", code: value };
    const problem = scanError("sale", value);
    if (problem) throw Error(problem);
    const found = matchBarcode(parts2, code);
    if (found.length !== 1) throw Object.assign(Error(found.length ? "\u041A\u043E\u0434 \u043D\u0435\u043E\u0434\u043D\u043E\u0437\u043D\u0430\u0447\u0435\u043D" : "\u0422\u043E\u0432\u0430\u0440 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D. \u041F\u043E\u043B\u0443\u0447\u0435\u043D \u043A\u043E\u0434: " + value.replace(/[\x00-\x1f\x7f]/g, "").slice(0, 80) + ". \u0421\u043A\u0430\u043D \u043E\u0442\u043C\u0435\u043D\u0451\u043D."), { code: found.length ? "ambiguous" : "product_not_found" });
    return { kind: "sale", code: found[0].barcode || value, part: found[0] };
  }
  function installPaymentScanner({ enabled, parts: parts2, accept, error, refresh, observed = () => {
  } }) {
    const form = document.createElement("form");
    form.className = "scanner-sink";
    form.setAttribute("aria-hidden", "true");
    form.innerHTML = '<input data-payment-scan autocomplete="off" autocapitalize="off" spellcheck="false" inputmode="none" tabindex="-1">';
    document.body.append(form);
    const input = form.firstElementChild;
    let chain = Promise.resolve();
    form.onsubmit = (e) => {
      e.preventDefault();
      const code = input.value.trim();
      input.value = "";
      if (!code) return;
      chain = chain.then(async () => {
        if (!enabled()) throw Error("\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u0435 \u0442\u0435\u043A\u0443\u0449\u0443\u044E \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u044E \u043F\u0435\u0440\u0435\u0434 \u043E\u043F\u043B\u0430\u0442\u043E\u0439. \u0421\u043A\u0430\u043D \u043E\u0442\u043C\u0435\u043D\u0451\u043D.");
        let scan;
        try {
          try {
            scan = paymentScan(code, parts2());
          } catch (e2) {
            if (e2.code !== "product_not_found" || !refresh) throw e2;
            await refresh();
            scan = paymentScan(code, parts2());
          }
        } catch (e2) {
          try {
            observed({ received: true, matched: false, characters: code.length, normalized: normalizeScan(code) !== code, code: normalizeScan(code) });
          } catch (e3) {
          }
          throw e2;
        }
        try {
          observed({ received: true, matched: true, characters: code.length, normalized: normalizeScan(code) !== code, code: scan.kind === "sale" ? scan.part.barcode : "" });
        } catch (e2) {
        }
        return accept(scan);
      }).catch((e2) => error(e2.message));
    };
    return bindScanner(input, form, enabled, { silent: true });
  }

  // workshop/pending.js
  function canonical(value) {
    if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
    if (value && typeof value === "object") return "{" + Object.keys(value).sort().map((k) => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
    return JSON.stringify(value);
  }
  async function operation(storage, actor, action, params) {
    const body = { ...params };
    delete body.request_id;
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical({ action, body })));
    const signature = Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, "0")).join("");
    const key3 = "fastgo_pending_v1:" + actor + ":" + signature;
    let entry;
    try {
      entry = JSON.parse(storage.getItem(key3) || "null");
    } catch (e) {
    }
    if (!entry) {
      entry = { request_id: params.request_id || crypto.randomUUID(), action, created_at: (/* @__PURE__ */ new Date()).toISOString() };
      storage.setItem(key3, JSON.stringify(entry));
    }
    if (!storage.getItem(key3)) throw new Error("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043A\u043E\u0434 \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u0438 \u0432 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0435. \u041E\u0441\u0432\u043E\u0431\u043E\u0434\u0438\u0442\u0435 \u043C\u0435\u0441\u0442\u043E \u0438 \u043F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0435.");
    return { key: key3, params: { ...params, request_id: entry.request_id }, finish: () => storage.removeItem(key3) };
  }

  // warehouse/preorders.js
  var statuses = { waiting: "\u041E\u0436\u0438\u0434\u0430\u0435\u043C", ordered: "\u0417\u0430\u043A\u0430\u0437\u0430\u043D\u043E", arrived: "\u041F\u0440\u0438\u0448\u043B\u043E", issued: "\u0412\u044B\u0434\u0430\u043D\u043E", cancelled: "\u041E\u0442\u043C\u0435\u043D\u0435\u043D\u043E" };
  var esc2 = (value) => String(value != null ? value : "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  var money3 = (value) => Number(value || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 }) + " \u20BD";
  var date = (value, time = false) => value ? new Date(value.length === 10 ? value + "T12:00:00+05:00" : value).toLocaleString("ru-RU", { timeZone: "Asia/Yekaterinburg", year: "numeric", month: "2-digit", day: "2-digit", ...time ? { hour: "2-digit", minute: "2-digit" } : {} }) : "\u041D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D\u0430";
  var options = (values, selected) => Object.entries(values).map(([key3, label]) => '<option value="'.concat(key3, '"').concat(key3 === selected ? " selected" : "", ">").concat(label, "</option>")).join("");
  var fullName = (r) => [r.last_name, r.first_name, r.middle_name].filter(Boolean).join(" ");
  var preorderAccess = (me) => ["developer", "owner", "admin", "receiver", "manager", "seller"].includes(me == null ? void 0 : me.role) || (me == null ? void 0 : me.can_sell) === true;
  function mountPreorders({ root, call: call2, actor, onDirty = () => {
  } }) {
    if (!document.getElementById("preorder-styles")) {
      const style = document.createElement("link");
      style.id = "preorder-styles";
      style.rel = "stylesheet";
      style.href = "warehouse/preorders.css?v=20261024";
      document.head.append(style);
    }
    root.classList.add("fg-preorders");
    root.innerHTML = '<div class="preorder-toolbar"><p>\u041E\u0436\u0438\u0434\u0430\u043D\u0438\u044F \u043A\u043B\u0438\u0435\u043D\u0442\u043E\u0432 \u0438 \u043F\u0440\u0435\u0434\u043E\u043F\u043B\u0430\u0442\u044B \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u044E\u0442\u0441\u044F \u0432 \u043E\u0431\u0449\u0435\u0439 \u0431\u0430\u0437\u0435.</p><button type="button" class="primary btn" data-new>+ \u041D\u043E\u0432\u044B\u0439 \u043F\u0440\u0435\u0434\u0437\u0430\u043A\u0430\u0437</button></div><div class="preorder-filters"><label>\u041F\u043E\u0438\u0441\u043A<input type="search" data-search placeholder="\u0424\u0418\u041E, \u0442\u0435\u043B\u0435\u0444\u043E\u043D, \u0442\u0435\u0445\u043D\u0438\u043A\u0430, \u0437\u0430\u043F\u0447\u0430\u0441\u0442\u044C \u0438\u043B\u0438 \u043D\u043E\u043C\u0435\u0440" maxlength="200"></label><label>\u0421\u0442\u0430\u0442\u0443\u0441<select data-status>'.concat(options({ active: "\u0412\u0441\u0435 \u043E\u0442\u043A\u0440\u044B\u0442\u044B\u0435", ...statuses, archive: "\u0410\u0440\u0445\u0438\u0432", all: "\u0412\u0441\u0435 \u043F\u0440\u0435\u0434\u0437\u0430\u043A\u0430\u0437\u044B" }, "active"), '</select></label><label>\u0421\u043E\u0437\u0434\u0430\u043D \u0441<input type="date" data-from></label><label>\u041F\u043E<input type="date" data-to></label><label>\u041F\u043E\u0440\u044F\u0434\u043E\u043A<select data-sort><option value="created">\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043D\u043E\u0432\u044B\u0435</option><option value="expected">\u041F\u043E \u0434\u0430\u0442\u0435 \u043E\u0436\u0438\u0434\u0430\u043D\u0438\u044F</option></select></label></div><p data-message role="status"></p><div data-records aria-live="polite"></div><div class="preorder-pagination"><span data-count></span><div><button type="button" data-prev>\u041D\u0430\u0437\u0430\u0434</button><button type="button" data-next>\u0414\u0430\u043B\u0435\u0435</button></div></div>');
    const $2 = (selector) => root.querySelector(selector);
    let offset = 0, generation = 0, searchTimer, poll2, dialog, dirty = false, saving = false, opening = false, disposed = false;
    const flag = (value) => {
      dirty = value;
      onDirty(value || saving);
    };
    window.fastgoPreordersDirty = () => root.isConnected && (dirty || saving);
    const beforeUnload = (e) => {
      if (root.isConnected && (dirty || saving)) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    function message2(value, error = false) {
      $2("[data-message]").textContent = value;
      $2("[data-message]").classList.toggle("error", error);
    }
    async function load2() {
      const current = ++generation;
      if (disposed || !root.isConnected) return;
      message2("\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u043F\u0440\u0435\u0434\u0437\u0430\u043A\u0430\u0437\u044B\u2026");
      try {
        const result = await call2("preorders", { search: $2("[data-search]").value, status: $2("[data-status]").value, from: $2("[data-from]").value, to: $2("[data-to]").value, sort: $2("[data-sort]").value, offset });
        if (current !== generation || disposed || !root.isConnected) return;
        $2("[data-records]").innerHTML = result.items.length ? '<div class="preorder-table"><table><thead><tr><th>\u041D\u043E\u043C\u0435\u0440 \u0438 \u0434\u0430\u0442\u044B</th><th>\u041A\u043B\u0438\u0435\u043D\u0442</th><th>\u0427\u0442\u043E \u043E\u0436\u0438\u0434\u0430\u0435\u0442</th><th>\u041F\u0440\u0435\u0434\u043E\u043F\u043B\u0430\u0442\u0430</th><th>\u0421\u0442\u0430\u0442\u0443\u0441</th><th></th></tr></thead><tbody>'.concat(result.items.map((r) => "<tr><td><b>".concat(esc2(r.number), "</b><small>\u0421\u043E\u0437\u0434\u0430\u043D ").concat(date(r.created_at), "</small><small>\u041E\u0436\u0438\u0434\u0430\u0435\u043C: ").concat(date(r.expected_on), "</small></td><td>").concat(esc2(fullName(r)), '<small><a href="tel:').concat(esc2(r.phone), '">').concat(esc2(r.phone), "</a></small></td><td>").concat(r.items.map((item) => '<span class="preorder-item-summary">'.concat(esc2(item.name), " \xB7 ").concat(item.quantity, " \u0448\u0442.<small>").concat(item.kind === "equipment" ? "\u0422\u0435\u0445\u043D\u0438\u043A\u0430" : "\u0417\u0430\u043F\u0447\u0430\u0441\u0442\u044C", "</small></span>")).join(""), '</td><td class="preorder-amount">').concat(money3(r.prepayment), '</td><td><span class="preorder-status ').concat(esc2(r.status), '">').concat(esc2(statuses[r.status]), '</span></td><td><button type="button" data-open="').concat(esc2(r.id), '">\u041E\u0442\u043A\u0440\u044B\u0442\u044C</button></td></tr>')).join(""), "</tbody></table></div>") : '<div class="preorder-empty">\u041F\u0440\u0435\u0434\u0437\u0430\u043A\u0430\u0437\u043E\u0432 \u043F\u043E \u044D\u0442\u0438\u043C \u0443\u0441\u043B\u043E\u0432\u0438\u044F\u043C \u043F\u043E\u043A\u0430 \u043D\u0435\u0442.<br>\u041D\u0430\u0436\u043C\u0438\u0442\u0435 \xAB\u041D\u043E\u0432\u044B\u0439 \u043F\u0440\u0435\u0434\u0437\u0430\u043A\u0430\u0437\xBB, \u0447\u0442\u043E\u0431\u044B \u0437\u0430\u043F\u0438\u0441\u0430\u0442\u044C \u043E\u0436\u0438\u0434\u0430\u043D\u0438\u0435 \u043A\u043B\u0438\u0435\u043D\u0442\u0430.</div>';
        $2("[data-count]").textContent = "\u0417\u0430\u043F\u0438\u0441\u0435\u0439: ".concat(result.count, " \xB7 \u041F\u0440\u0435\u0434\u043E\u043F\u043B\u0430\u0442\u0430: ").concat(money3(result.prepayment_total));
        $2("[data-prev]").disabled = offset <= 0;
        $2("[data-next]").disabled = offset + result.limit >= result.count;
        for (const selector of ["[data-prev]", "[data-next]"]) $2(selector).dataset.unavailable = String($2(selector).disabled);
        root.querySelectorAll("[data-open]").forEach((button) => button.onclick = () => void open(button.dataset.open));
        message2("");
      } catch (error) {
        if (current === generation && !disposed && root.isConnected) message2(error.message, true);
      }
    }
    function close(force = false) {
      if (saving && !force) return;
      if (dirty && !force && !confirm("\u0417\u0430\u043A\u0440\u044B\u0442\u044C \u043F\u0440\u0435\u0434\u0437\u0430\u043A\u0430\u0437 \u0431\u0435\u0437 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0439?")) return;
      dialog == null ? void 0 : dialog.close();
      dialog == null ? void 0 : dialog.remove();
      dialog = null;
      saving = false;
      flag(false);
    }
    async function open(id) {
      if (dialog || opening) return;
      opening = true;
      let record, history = [], historyCount = 0;
      try {
        if (id) {
          const result = await call2("preorder_get", { id });
          if (disposed || !root.isConnected) return;
          record = result.record;
          history = result.history;
          historyCount = result.history_count;
        }
      } catch (error2) {
        message2(error2.message, true);
        return;
      } finally {
        opening = false;
      }
      const value = record || { id: crypto.randomUUID(), revision: 0, first_name: "", last_name: "", middle_name: "", phone: "", prepayment: 0, expected_on: "", note: "", status: "waiting", items: [] };
      dialog = document.createElement("dialog");
      dialog.className = "preorder-dialog fg-preorders";
      dialog.setAttribute("aria-label", record ? "\u041F\u0440\u0435\u0434\u0437\u0430\u043A\u0430\u0437 " + record.number : "\u041D\u043E\u0432\u044B\u0439 \u043F\u0440\u0435\u0434\u0437\u0430\u043A\u0430\u0437");
      const field = (name, label, type = "text", required = false) => '<label class="preorder-field">'.concat(label, '<input name="').concat(name, '" type="').concat(type, '" value="').concat(esc2(value[name]), '"').concat(required ? " required" : "", " ").concat(type === "text" ? 'maxlength="80"' : "", "></label>");
      dialog.innerHTML = '<form><div class="preorder-dialog-head"><div><h2>'.concat(record ? esc2(record.number) : "\u041D\u043E\u0432\u044B\u0439 \u043F\u0440\u0435\u0434\u0437\u0430\u043A\u0430\u0437", "</h2>").concat(record ? "<p>\u0421\u043E\u0437\u0434\u0430\u043D ".concat(date(record.created_at, true), " \xB7 \u0418\u0437\u043C\u0435\u043D\u0451\u043D ").concat(date(record.updated_at, true), "</p>") : "", '</div><button type="button" data-close aria-label="\u0417\u0430\u043A\u0440\u044B\u0442\u044C \u043E\u043A\u043D\u043E">\xD7</button></div><h3>\u041A\u043B\u0438\u0435\u043D\u0442</h3><div class="preorder-customer">').concat(field("last_name", "\u0424\u0430\u043C\u0438\u043B\u0438\u044F", "text", true)).concat(field("first_name", "\u0418\u043C\u044F", "text", true)).concat(field("middle_name", "\u041E\u0442\u0447\u0435\u0441\u0442\u0432\u043E")).concat(field("phone", "\u0422\u0435\u043B\u0435\u0444\u043E\u043D", "tel", true), '</div><h3>\u0427\u0442\u043E \u043E\u0436\u0438\u0434\u0430\u0435\u0442 \u043A\u043B\u0438\u0435\u043D\u0442</h3><p class="preorder-hint">\u041D\u0430\u0447\u043D\u0438\u0442\u0435 \u0432\u0432\u043E\u0434\u0438\u0442\u044C \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0438 \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u0443. \u0415\u0441\u043B\u0438 \u0442\u043E\u0432\u0430\u0440\u0430 \u0435\u0449\u0451 \u043D\u0435\u0442 \u0432 \u0431\u0430\u0437\u0435, \u0432\u043F\u0438\u0448\u0438\u0442\u0435 \u0435\u0433\u043E \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0432\u0440\u0443\u0447\u043D\u0443\u044E.</p><div data-lines></div><button type="button" data-add>+ \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u043F\u043E\u0437\u0438\u0446\u0438\u044E</button><div class="preorder-payment">').concat(field("prepayment", "\u041F\u0440\u0435\u0434\u043E\u043F\u043B\u0430\u0442\u0430, \u20BD", "number", true)).concat(field("expected_on", "\u041E\u0436\u0438\u0434\u0430\u0435\u043C\u0430\u044F \u0434\u0430\u0442\u0430", "date"), '<label>\u0421\u0442\u0430\u0442\u0443\u0441<select name="status" aria-label="\u0421\u0442\u0430\u0442\u0443\u0441">').concat(options(statuses, value.status), '</select></label></div><label>\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439<textarea name="note" rows="2" maxlength="2000">').concat(esc2(value.note), '</textarea></label><p class="preorder-hint">\u0417\u0434\u0435\u0441\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u0435\u0442\u0441\u044F \u0441\u0443\u043C\u043C\u0430 \u043F\u0440\u0438\u043D\u044F\u0442\u043E\u0439 \u043F\u0440\u0435\u0434\u043E\u043F\u043B\u0430\u0442\u044B. \u0420\u0430\u0441\u0447\u0451\u0442 \u0438 \u0447\u0435\u043A \u043E\u0444\u043E\u0440\u043C\u043B\u044F\u044E\u0442\u0441\u044F \u043D\u0430 \u043A\u0430\u0441\u0441\u0435.</p><div data-error role="alert" class="error"></div><div class="preorder-dialog-actions"><button type="button" data-close>\u0417\u0430\u043A\u0440\u044B\u0442\u044C</button><button type="submit" class="primary btn">\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043F\u0440\u0435\u0434\u0437\u0430\u043A\u0430\u0437</button></div>').concat(record ? '<section class="preorder-history"><h3>\u0418\u0441\u0442\u043E\u0440\u0438\u044F \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0439</h3><div data-history></div><button type="button" data-history-more hidden>\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0435\u0449\u0451</button></section>' : "", "</form>");
      root.append(dialog);
      dialog.showModal();
      const form = dialog.querySelector("form"), lines = dialog.querySelector("[data-lines]"), error = dialog.querySelector("[data-error]");
      let historyOffset = history.length;
      form.elements.prepayment.min = "0";
      form.elements.prepayment.max = "100000000";
      form.elements.prepayment.step = "0.01";
      form.elements.phone.maxLength = 24;
      form.addEventListener("input", () => flag(true));
      form.addEventListener("change", () => flag(true));
      dialog.querySelectorAll("[data-close]").forEach((button) => button.onclick = () => close());
      dialog.oncancel = (e) => {
        e.preventDefault();
        close();
      };
      function suggest(input, { kind, select }) {
        const box = document.createElement("div");
        box.className = "preorder-suggestions";
        box.hidden = true;
        box.setAttribute("role", "listbox");
        box.id = "preorder-hints-" + crypto.randomUUID();
        input.parentElement.append(box);
        input.setAttribute("role", "combobox");
        input.setAttribute("aria-autocomplete", "list");
        input.setAttribute("aria-controls", box.id);
        input.setAttribute("aria-expanded", "false");
        let timer, sequence = 0, selected = -1;
        const hide = () => {
          box.hidden = true;
          input.setAttribute("aria-expanded", "false");
        };
        input.addEventListener("input", () => {
          clearTimeout(timer);
          const q = input.value.trim(), seq = ++sequence;
          hide();
          if (q.length < 2) return;
          timer = setTimeout(async () => {
            if (!input.isConnected) return;
            try {
              const matches = await call2("preorder_suggestions", { kind: typeof kind === "function" ? kind() : kind, search: q });
              if (seq !== sequence || !input.isConnected) return;
              selected = -1;
              box.replaceChildren();
              for (const match of matches) {
                const button = document.createElement("button");
                button.type = "button";
                button.setAttribute("role", "option");
                button.textContent = match.full_name ? match.full_name + " \xB7 " + match.phone : match.name + (match.sku ? " \xB7 " + match.sku : "") + " \xB7 " + (match.kind === "equipment" ? "\u0422\u0435\u0445\u043D\u0438\u043A\u0430" : "\u0417\u0430\u043F\u0447\u0430\u0441\u0442\u044C");
                button.onclick = () => {
                  select(match);
                  flag(true);
                  hide();
                  input.focus();
                };
                box.append(button);
              }
              box.hidden = !matches.length;
              input.setAttribute("aria-expanded", String(matches.length > 0));
            } catch (e) {
              hide();
            }
          }, 180);
        });
        input.addEventListener("keydown", (e) => {
          const buttons = [...box.querySelectorAll("button")];
          if (box.hidden || !buttons.length) return;
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            hide();
          } else if (["ArrowDown", "ArrowUp"].includes(e.key)) {
            e.preventDefault();
            selected = (selected + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
            buttons.forEach((button, i) => button.classList.toggle("selected", i === selected));
          } else if (e.key === "Enter" && selected >= 0) {
            e.preventDefault();
            buttons[selected].click();
          }
        });
        input.addEventListener("blur", () => setTimeout(() => {
          if (!box.contains(document.activeElement)) hide();
        }, 180));
      }
      const chooseCustomer = (match) => {
        const names2 = match.full_name.split(/\s+/);
        form.elements.last_name.value = names2[0] || "";
        form.elements.first_name.value = names2[1] || "";
        form.elements.middle_name.value = names2.slice(2).join(" ");
        form.elements.phone.value = match.phone || "";
      };
      for (const name of ["last_name", "first_name", "phone"]) suggest(form.elements[name], { kind: "customer", select: chooseCustomer });
      function addLine(item = { kind: "part", name: "", quantity: 1, product_id: null }) {
        if (lines.children.length >= 20) {
          error.textContent = "\u0412 \u043E\u0434\u043D\u043E\u043C \u043F\u0440\u0435\u0434\u0437\u0430\u043A\u0430\u0437\u0435 \u043C\u043E\u0436\u043D\u043E \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0434\u043E 20 \u043F\u043E\u0437\u0438\u0446\u0438\u0439";
          return;
        }
        const line = document.createElement("div");
        line.className = "preorder-line";
        line.dataset.productId = item.product_id || "";
        line.innerHTML = "<label>\u0422\u0438\u043F<select data-kind>".concat(options({ part: "\u0417\u0430\u043F\u0447\u0430\u0441\u0442\u044C", equipment: "\u0422\u0435\u0445\u043D\u0438\u043A\u0430" }, item.kind), '</select></label><label class="preorder-field preorder-product">\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435<input data-name value="').concat(esc2(item.name), '" maxlength="200" required autocomplete="off" placeholder="\u041D\u0430\u043F\u0440\u0438\u043C\u0435\u0440: \u043A\u0430\u043C\u0435\u0440\u0430 10 \xD7 2,5"></label><label>\u041A\u043E\u043B-\u0432\u043E<input data-qty type="number" min="1" max="1000" step="1" value="').concat(item.quantity, '" required></label><button type="button" data-remove aria-label="\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u043F\u043E\u0437\u0438\u0446\u0438\u044E">\xD7</button>');
        lines.append(line);
        const name = line.querySelector("[data-name]"), type = line.querySelector("[data-kind]");
        name.oninput = () => {
          line.dataset.productId = "";
        };
        type.onchange = () => {
          line.dataset.productId = "";
        };
        line.querySelector("[data-remove]").onclick = () => {
          line.remove();
          flag(true);
        };
        suggest(name, { kind: () => type.value, select: (match) => {
          name.value = match.name;
          type.value = match.kind;
          line.dataset.productId = match.id;
        } });
      }
      (value.items.length ? value.items : [void 0]).forEach(addLine);
      dialog.querySelector("[data-add]").onclick = () => {
        addLine();
        flag(true);
      };
      const showHistory = (entries) => {
        const target = dialog == null ? void 0 : dialog.querySelector("[data-history]");
        if (!target) return;
        for (const entry of entries) {
          const row = document.createElement("p");
          row.innerHTML = "<b>".concat(date(entry.at, true), "</b> \xB7 ").concat(esc2(entry.actor_name || "\u0421\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A"), "<br>").concat(esc2(statuses[entry.status] || entry.status), " \xB7 \u041F\u0440\u0435\u0434\u043E\u043F\u043B\u0430\u0442\u0430 ").concat(money3(entry.prepayment), " \xB7 \u0418\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435 \u2116 ").concat(entry.revision);
          target.append(row);
        }
        const more = dialog.querySelector("[data-history-more]");
        if (more) more.hidden = historyOffset >= historyCount;
      };
      if (record) {
        showHistory(history);
        dialog.querySelector("[data-history-more]").onclick = async (e) => {
          e.target.disabled = true;
          try {
            const result = await call2("preorder_get", { id: value.id, history_offset: historyOffset });
            if (!dialog) return;
            historyCount = result.history_count;
            historyOffset += result.history.length;
            showHistory(result.history);
          } catch (ex) {
            error.textContent = ex.message;
          } finally {
            if (e.target.isConnected) e.target.disabled = false;
          }
        };
      }
      form.onsubmit = async (e) => {
        e.preventDefault();
        if (saving || !form.reportValidity()) return;
        error.textContent = "";
        if (!lines.children.length) {
          error.textContent = "\u0414\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u0445\u043E\u0442\u044F \u0431\u044B \u043E\u0434\u043D\u0443 \u043F\u043E\u0437\u0438\u0446\u0438\u044E";
          return;
        }
        const payload = { id: value.id, revision: value.revision, first_name: form.elements.first_name.value.trim(), last_name: form.elements.last_name.value.trim(), middle_name: form.elements.middle_name.value.trim(), phone: form.elements.phone.value, prepayment: Number(form.elements.prepayment.value), expected_on: form.elements.expected_on.value, status: form.elements.status.value, note: form.elements.note.value, items: [...lines.children].map((line) => ({ kind: line.querySelector("[data-kind]").value, name: line.querySelector("[data-name]").value, quantity: Number(line.querySelector("[data-qty]").value), product_id: line.dataset.productId || null })) };
        saving = true;
        onDirty(true);
        form.querySelectorAll("button,input,select,textarea").forEach((button) => button.disabled = true);
        let pending2;
        try {
          pending2 = await operation(localStorage, actor, "preorder_save", payload);
          const result = await call2("preorder_save", pending2.params);
          if (!(result == null ? void 0 : result.id) || !result.revision) throw Error("\u0421\u0435\u0440\u0432\u0435\u0440 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u043B \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0435. \u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0435 \u0442\u0443 \u0436\u0435 \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u044E.");
          pending2.finish();
          saving = false;
          flag(false);
          close(true);
          await load2();
          message2("\u041F\u0440\u0435\u0434\u0437\u0430\u043A\u0430\u0437 " + result.number + " \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D");
        } catch (ex) {
          if (error.isConnected) error.textContent = ex.message;
        } finally {
          saving = false;
          onDirty(dirty);
          if (form.isConnected) form.querySelectorAll("button,input,select,textarea").forEach((button) => button.disabled = false);
        }
      };
      flag(false);
      form.elements.last_name.focus();
    }
    $2("[data-new]").onclick = () => void open();
    $2("[data-search]").oninput = () => {
      clearTimeout(searchTimer);
      offset = 0;
      searchTimer = setTimeout(() => void load2(), 250);
    };
    for (const selector of ["[data-status]", "[data-from]", "[data-to]", "[data-sort]"]) $2(selector).onchange = () => {
      offset = 0;
      void load2();
    };
    $2("[data-prev]").onclick = () => {
      offset = Math.max(0, offset - 50);
      void load2();
    };
    $2("[data-next]").onclick = () => {
      offset += 50;
      void load2();
    };
    function dispose() {
      disposed = true;
      clearTimeout(searchTimer);
      clearInterval(poll2);
      window.removeEventListener("beforeunload", beforeUnload);
      if (dialog) {
        dialog.close();
        dialog.remove();
        dialog = null;
      }
      dirty = saving = false;
      onDirty(false);
    }
    const ready = load2();
    poll2 = setInterval(() => {
      if (!root.isConnected) dispose();
      else if (!dialog && !saving && document.visibilityState !== "hidden") void load2();
    }, 2e4);
    return { ready, dispose, hasDraft: () => dirty || saving };
  }

  // workshop/viewport-layout.js
  var key = /* @__PURE__ */ Symbol.for("fastgo.viewport-layout");
  function installViewportLayout({ header = null } = {}) {
    var _a3, _b;
    const win = window, root = document.documentElement;
    if (win[key]) {
      if (header) win[key].observeHeader(header);
      win[key].update();
      return win[key].dispose;
    }
    let frame = 0, observer = null, observedHeader = null, disposed = false;
    const set = (name, value) => {
      if (root.style.getPropertyValue(name) !== value) root.style.setProperty(name, value);
    };
    function update() {
      var _a4, _b2;
      if (disposed) return;
      if (frame) {
        win.cancelAnimationFrame(frame);
        frame = 0;
      }
      const viewport = win.visualViewport, useVisual = viewport && Math.abs((viewport.scale || 1) - 1) < 0.05;
      const height = Math.round(useVisual && viewport.height || win.innerHeight), top = useVisual ? Math.max(0, Math.round(viewport.offsetTop || 0)) : 0;
      const constrained = height < win.innerHeight - 80;
      if (height > 0) {
        set("--fastgo-viewport-height", height + "px");
        set("--fastgo-viewport-top", top + "px");
        if (constrained) root.setAttribute("data-fastgo-visual-constrained", "");
        else root.removeAttribute("data-fastgo-visual-constrained");
      }
      if (observedHeader == null ? void 0 : observedHeader.isConnected) set("--warehouse-header-height", Math.ceil(observedHeader.getBoundingClientRect().height) + "px");
      const active = document.activeElement, panel = (_a4 = active == null ? void 0 : active.closest) == null ? void 0 : _a4.call(active, "dialog[open],.compact-panel-body.is-open,.repair-pane-body");
      if (constrained && panel && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) {
        const bounds = panel.getBoundingClientRect(), toolbar = panel.querySelector(".product-dialog-toolbar");
        const lower = Math.min(bounds.bottom, top + height) - 20, upper = Math.max(bounds.top, top) + ((toolbar == null ? void 0 : toolbar.getBoundingClientRect().height) || 12);
        const editor = (_b2 = active.closest(".metric-editor")) == null ? void 0 : _b2.getBoundingClientRect(), field = editor && editor.height <= lower - upper ? editor : active.getBoundingClientRect();
        if (field.bottom > lower) panel.scrollTop += field.bottom - lower;
        else if (field.top < upper) panel.scrollTop -= upper - field.top;
      }
    }
    const schedule = () => {
      if (!disposed && !frame) frame = win.requestAnimationFrame(update);
    };
    function observeHeader(value) {
      if (value === observedHeader) return;
      observer == null ? void 0 : observer.disconnect();
      observedHeader = value;
      if (value && win.ResizeObserver) {
        observer = new win.ResizeObserver(schedule);
        observer.observe(value);
      }
      schedule();
    }
    function dispose() {
      var _a4, _b2;
      if (disposed) return;
      disposed = true;
      if (frame) win.cancelAnimationFrame(frame);
      observer == null ? void 0 : observer.disconnect();
      win.removeEventListener("resize", schedule);
      win.removeEventListener("orientationchange", schedule);
      (_a4 = win.visualViewport) == null ? void 0 : _a4.removeEventListener("resize", schedule);
      (_b2 = win.visualViewport) == null ? void 0 : _b2.removeEventListener("scroll", schedule);
      delete win[key];
    }
    win.addEventListener("resize", schedule);
    win.addEventListener("orientationchange", schedule);
    (_a3 = win.visualViewport) == null ? void 0 : _a3.addEventListener("resize", schedule);
    (_b = win.visualViewport) == null ? void 0 : _b.addEventListener("scroll", schedule);
    win[key] = { update, dispose, observeHeader };
    observeHeader(header);
    update();
    return dispose;
  }

  // warehouse/window-controls.js
  function windowStateUpdates(apply) {
    let revision = -1;
    return (state) => {
      if (!state) return false;
      if (Number.isSafeInteger(state.revision)) {
        if (state.revision < revision) return false;
        revision = state.revision;
      } else if (revision >= 0) return false;
      apply(state);
      return true;
    };
  }
  function installWindowControls({ bar, native: native2 = window.fastgoWindow, document: document2 = window.document } = {}) {
    if (!bar || !native2 || bar.querySelector("[data-fastgo-window-controls]")) return;
    const style = document2.createElement("style");
    style.textContent = "\n .fastgo-window-controls{display:flex;align-items:center;gap:4px;flex:0 0 auto;order:99;-webkit-app-region:no-drag}\n .fastgo-window-controls button{display:inline-flex;align-items:center;justify-content:center;flex:0 0 36px;width:36px;min-width:36px;min-height:30px;padding:5px!important;border:1px solid #334453;border-radius:6px;background:#0b121e;color:#e7f2fc;cursor:pointer;-webkit-app-region:no-drag}\n .fastgo-window-controls button:hover{background:#0873df}.fastgo-window-controls button:focus-visible{outline:2px solid #47bdff;outline-offset:2px}\n .fastgo-window-controls button svg{width:18px;height:18px;pointer-events:none}.fastgo-window-frame{display:flex;gap:4px}.fastgo-window-frame[hidden]{display:none}\n .fastgo-window-controls [data-window-action=close]:hover{background:#ad3041}\n body.fastgo-window-fullscreen #desktop-status:not(.desktop-status){left:0;width:100%;right:0}\n body.fastgo-window-fullscreen.warehouse-native-window header{padding-right:12px}\n @media print{.fastgo-window-controls{display:none!important}}\n ";
    document2.head.append(style);
    const controls = document2.createElement("div");
    controls.className = "fastgo-window-controls";
    controls.setAttribute("data-fastgo-window-controls", "");
    const icon = (paths) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">' + paths + "</svg>";
    controls.innerHTML = '<button type="button" data-window-action="toggle-fullscreen" aria-label="\u041F\u043E\u043B\u043D\u044B\u0439 \u044D\u043A\u0440\u0430\u043D (F11)" title="\u041F\u043E\u043B\u043D\u044B\u0439 \u044D\u043A\u0440\u0430\u043D (F11)" aria-pressed="false">' + icon('<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>') + '</button><div class="fastgo-window-frame" hidden><button type="button" data-window-action="minimize" aria-label="\u0421\u0432\u0435\u0440\u043D\u0443\u0442\u044C" title="\u0421\u0432\u0435\u0440\u043D\u0443\u0442\u044C">' + icon('<path d="M5 16h14"/>') + '</button><button type="button" data-window-action="restore" aria-label="\u0412\u0435\u0440\u043D\u0443\u0442\u044C \u043E\u043A\u043D\u043E" title="\u0412\u0435\u0440\u043D\u0443\u0442\u044C \u043E\u043A\u043D\u043E">' + icon('<rect x="5" y="5" width="14" height="14"/>') + '</button><button type="button" data-window-action="close" aria-label="\u0417\u0430\u043A\u0440\u044B\u0442\u044C" title="\u0417\u0430\u043A\u0440\u044B\u0442\u044C">' + icon('<path d="m6 6 12 12M6 18 18 6"/>') + "</button></div>";
    bar.append(controls);
    let fullscreen = false;
    const update = windowStateUpdates((state) => {
      fullscreen = state.fullscreen === true;
      document2.body.classList.toggle("fastgo-window-fullscreen", fullscreen);
      const button = controls.querySelector("[data-window-action=toggle-fullscreen]"), label = fullscreen ? "\u0412\u044B\u0439\u0442\u0438 \u0438\u0437 \u043F\u043E\u043B\u043D\u043E\u0433\u043E \u044D\u043A\u0440\u0430\u043D\u0430 (Esc)" : "\u041F\u043E\u043B\u043D\u044B\u0439 \u044D\u043A\u0440\u0430\u043D (F11)";
      button.setAttribute("aria-label", label);
      button.title = label;
      button.setAttribute("aria-pressed", String(fullscreen));
      controls.querySelector(".fastgo-window-frame").hidden = !fullscreen;
    });
    const action = async (value) => {
      try {
        update(await native2.command(value));
      } catch (e) {
      }
    };
    controls.addEventListener("click", (event) => {
      const button = event.target.closest("[data-window-action]");
      if (button) void action(button.dataset.windowAction);
    });
    const escape2 = (event) => {
      if (event.key === "Escape" && fullscreen && !document2.querySelector('dialog[open],[aria-modal="true"]')) {
        event.preventDefault();
        event.stopPropagation();
        void action("exit-fullscreen");
      }
    };
    document2.addEventListener("keydown", escape2, true);
    const stop = native2.onChanged(update);
    void native2.state().then(update).catch(() => {
    });
    return () => {
      stop();
      document2.removeEventListener("keydown", escape2, true);
      controls.remove();
      style.remove();
      document2.body.classList.remove("fastgo-window-fullscreen");
    };
  }

  // warehouse/app.js
  installViewportLayout({ header: document.querySelector("body > header") });
  installWindowControls({ bar: document.querySelector("body > header") });
  var formValues = (form) => {
    const p = {};
    new FormData(form).forEach((v, k) => p[k] = v);
    return p;
  };
  var $ = (id) => document.getElementById(id);
  var terminal = document.body.dataset.mode === "terminal";
  var device;
  var parts = [];
  var staff = [];
  var screen = "home";
  var draft;
  var job;
  var busy = false;
  var polling = false;
  var memberRole = "";
  var lastActivity = Date.now();
  var stopScanner;
  var stopUSB;
  var preorderView;
  var serviceView;
  if (!terminal && !window.warehouseDesktop && matchMedia("(max-width:760px)").matches) {
    for (const id of ["usb-scanner", "terminal-update"]) if ($(id)) $(id).hidden = true;
  }
  var serviceLink = $("warehouse-service");
  if (serviceLink) serviceLink.hidden = !(window.fastgoDesktop || new URLSearchParams(location.search).get("unified") === "1");
  serviceLink == null ? void 0 : serviceLink.addEventListener("click", (e) => {
    var _a3;
    if (!((_a3 = window.fastgoWarehouseCanLeave) == null ? void 0 : _a3.call(window))) {
      e.preventDefault();
      message("\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u0435 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u043F\u0435\u0440\u0435\u0434 \u043F\u0435\u0440\u0435\u0445\u043E\u0434\u043E\u043C \u0432 \u0441\u0435\u0440\u0432\u0438\u0441", true);
    }
  });
  var networkButton = $("network-diagnostics");
  var _a;
  if (networkButton) {
    networkButton.hidden = !((_a = window.warehouseDesktop) == null ? void 0 : _a.openNetworkDiagnostics);
    networkButton.onclick = () => window.warehouseDesktop.openNetworkDiagnostics().catch((e) => message(e.message, true));
  }
  var printerButton = $("printer-settings");
  if (printerButton) {
    printerButton.hidden = !printerSetupAvailable();
    printerButton.onclick = setupLabelPrinter;
  }
  var key2 = (n) => "fgwarehouse:" + userId() + ":" + n;
  var load = (n) => {
    try {
      return JSON.parse(localStorage.getItem(key2(n)) || "null");
    } catch (e) {
      throw Error("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442");
    }
  };
  var save2 = (n, v) => localStorage.setItem(key2(n), JSON.stringify(v));
  var repair = repairPayment({ call: (a, p) => call(a, p), render: (html) => {
    live.cleanup();
    screen = "repair";
    shell(html);
  }, home, run, message, load, save: save2 });
  var live = liveBasket({ terminal, call: (a, p) => call(a, p), parts: () => parts, render: (html) => {
    screen = "live";
    shell(html);
  }, home, run, message, load, save: save2, refresh: catalog, repair: (q) => repair.terminal(q), stationRepair: (q, id) => repair.station(q, id), canOpen: canReceiveIncoming, manual: () => run(showManualPayment) });
  var call = (action, p = {}) => {
    if (!device && document.body.dataset.readonly === "true") {
      if (action === "catalog") return api("service_catalog");
      if (action === "inventory_edit") return serviceApi(action, p);
      if (action === "work_catalog") return api("service_catalog").then((c) => c.services);
      if (action === "work_catalog_save") return serviceApi("catalog_save", p);
      throw Error("\u041F\u0440\u0438\u0445\u043E\u0434, \u043E\u043F\u043B\u0430\u0442\u0430 \u0438 \u0422\u0421\u0414 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B \u043D\u0430 \u0434\u0432\u0443\u0445 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D\u043D\u044B\u0445 \u043D\u043E\u0443\u0442\u0431\u0443\u043A\u0430\u0445. \u0417\u0434\u0435\u0441\u044C \u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D \u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440 \u0441\u043A\u043B\u0430\u0434\u0430.");
    }
    return api(action, { device_id: device == null ? void 0 : device.id, device_token: device == null ? void 0 : device.token, ...p });
  };
  var receiptNoticeTimer;
  function clearReceiptNotice() {
    var _a3;
    clearTimeout(receiptNoticeTimer);
    (_a3 = document.getElementById("receipt-label-notice")) == null ? void 0 : _a3.remove();
  }
  var receiptLabels = !terminal ? startReceiptLabels({ call: (a, p) => device ? call(a, p) : Promise.resolve([]), notify: (value) => {
    clearTimeout(receiptNoticeTimer);
    let box = $("receipt-label-notice");
    if (!box) {
      box = document.createElement("p");
      box.id = "receipt-label-notice";
      box.setAttribute("role", "status");
      $("message").after(box);
    }
    box.textContent = value.text;
    box.className = value.ok ? "notice" : "error";
    if (value.ok) receiptNoticeTimer = setTimeout(clearReceiptNotice, 1e4);
  } }) : null;
  function applyReadOnly() {
    if (document.body.dataset.readonly !== "true") return;
    if (!window.warehouseDesktop) {
      for (const id of ["usb-scanner", "terminal-update", "network-diagnostics", "printer-settings"]) if ($(id)) $(id).hidden = true;
    }
    for (const id of ["receipt", "pay", "nav-receipt", "nav-pay", "shift", "usb-scanner", "terminal-update"]) if ($(id)) {
      $(id).disabled = true;
      $(id).title = "\u0414\u043E\u0441\u0442\u0443\u043F\u043D\u043E \u043D\u0430 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D\u043D\u043E\u043C \u0441\u043A\u043B\u0430\u0434\u0441\u043A\u043E\u043C \u043D\u043E\u0443\u0442\u0431\u0443\u043A\u0435";
    }
  }
  var unknown = unknownScans({ call: (a, p) => call(a, p), parts: () => parts, refresh: catalog, run, message, owner: () => ["owner", "developer"].includes(memberRole) });
  function message(v, error = false) {
    $("message").textContent = v;
    $("message").className = error ? "error" : "";
  }
  var scannerTest = null;
  installScannerDiagnostics({ parts: () => parts, report: async (extra) => {
    if (extra.scan_test) scannerTest = extra.scan_test;
    lastDeviceStatus = 0;
    await desktopStatus();
  } });
  if (!terminal) installPaymentScanner({ enabled: () => !!device && !busy && !nativeUpdatePending && document.body.dataset.readonly !== "true" && !["login", "connection", "connect", "setup", "basket", "manual-payment", "services"].includes(screen) && !document.querySelector("dialog[open]"), parts: () => parts, refresh: catalog, observed: (scan) => {
    scannerTest = { ...scan, source: "atol" };
    lastDeviceStatus = 0;
    void desktopStatus();
  }, error: (text) => message(text, true), accept: (scan) => run(async () => {
    if (job || screen === "repair" || !live.canPaymentScan()) throw Error("\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u0435 \u0438\u043B\u0438 \u043E\u0442\u043C\u0435\u043D\u0438\u0442\u0435 \u0442\u0435\u043A\u0443\u0449\u0443\u044E \u043E\u043F\u043B\u0430\u0442\u0443. \u0421\u043A\u0430\u043D \u043E\u0442\u043C\u0435\u043D\u0451\u043D.");
    if (scan.kind === "parts") {
      await live.issueParts(scan.code);
      return;
    }
    if (scan.kind === "repair") {
      if (live.hasDraft()) throw Error("\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u0435 \u0438\u043B\u0438 \u043E\u0442\u043C\u0435\u043D\u0438\u0442\u0435 \u0442\u0435\u043A\u0443\u0449\u0438\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u043F\u0435\u0440\u0435\u0434 \u043E\u043F\u043B\u0430\u0442\u043E\u0439 \u0440\u0435\u043C\u043E\u043D\u0442\u0430. \u0421\u043A\u0430\u043D \u043E\u0442\u043C\u0435\u043D\u0451\u043D.");
      const quote = await call("repair_quote", { code: scan.code });
      await repair.station(quote);
      return;
    }
    await live.acceptPaymentScan(scan.code);
  }) });
  async function run(fn) {
    if (busy) return;
    busy = true;
    document.querySelectorAll("button").forEach((x) => x.disabled = true);
    try {
      await fn();
    } catch (e) {
      message(e.message, true);
    } finally {
      busy = false;
      document.querySelectorAll("button").forEach((x) => x.disabled = x.dataset.unavailable === "true");
      applyReadOnly();
    }
  }
  for (const e of ["keydown", "pointerdown", "input", "change"]) window.addEventListener(e, () => lastActivity = Date.now(), true);
  window.warehouseUpdateSafe = (immediate = false) => {
    var _a3, _b, _c, _d;
    return !((_a3 = window.fastgoServiceCatalogDirty) == null ? void 0 : _a3.call(window)) && !((_c = (_b = load("manual-service-payment")) == null ? void 0 : _b.items) == null ? void 0 : _c.length) && !busy && !usbPolling && (["home", "inventory", "holdings", "preorders", "services", "report", "login", "connection"].includes(screen) || !terminal && screen === "live") && !job && (terminal || !draft && !live.hasDraft()) && !document.querySelector("#mirror-submit,dialog[open],.modal") && !(((_d = document.activeElement) == null ? void 0 : _d.matches("input:not([type=search]):not([data-payment-scan]),textarea,select,[contenteditable]")) && !document.activeElement.closest(".preorder-filters")) && ![...document.querySelectorAll("#login input")].some((input) => input.value) && (immediate || Date.now() - lastActivity > 15e3);
  };
  window.addEventListener("beforeunload", (e) => {
    var _a3, _b, _c;
    try {
      live.checkpoint();
    } catch (error) {
      message(error.message, true);
      e.preventDefault();
      e.returnValue = "";
      return;
    }
    if (((_a3 = window.fastgoServiceCatalogDirty) == null ? void 0 : _a3.call(window)) || ((_c = (_b = load("manual-service-payment")) == null ? void 0 : _b.items) == null ? void 0 : _c.length) || busy || screen === "basket" || screen === "checkout" || screen === "repair" || screen === "live" && live.hasDraft()) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  function shell(html) {
    var _a3;
    clearReceiptNotice();
    if (serviceView) {
      (_a3 = serviceView.dispose) == null ? void 0 : _a3.call(serviceView);
      serviceView = null;
    }
    if (preorderView) {
      preorderView.dispose();
      preorderView = null;
    }
    document.body.dataset.screen = screen;
    const section = document.getElementById("warehouse-section");
    if (section) section.textContent = { home: "\u0413\u043B\u0430\u0432\u043D\u0430\u044F", services: "\u0420\u0435\u043C\u043E\u043D\u0442\u043D\u044B\u0435 \u0440\u0430\u0431\u043E\u0442\u044B", "manual-payment": "\u0420\u0443\u0447\u043D\u0430\u044F \u043E\u043F\u043B\u0430\u0442\u0430", report: "\u0418\u0442\u043E\u0433\u043E\u0432\u044B\u0439 \u043E\u0442\u0447\u0451\u0442", preorders: "\u041F\u0440\u0435\u0434\u0437\u0430\u043A\u0430\u0437\u044B", inventory: "\u041E\u0441\u0442\u0430\u0442\u043A\u0438", holdings: "\u0417\u0430\u043F\u0447\u0430\u0441\u0442\u0438 \u043D\u0430 \u043C\u0430\u0441\u0442\u0435\u0440\u0430\u0445", shift: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0441\u043C\u0435\u043D\u0443", receipt: "\u041F\u0440\u0438\u0445\u043E\u0434", live: live.kind() === "receipt" ? "\u041F\u0440\u0438\u0445\u043E\u0434" : "\u041E\u043F\u043B\u0430\u0442\u0430", repair: "\u041E\u043F\u043B\u0430\u0442\u0430 \u0440\u0435\u043C\u043E\u043D\u0442\u0430" }[screen] || "";
    if (stopUSB) {
      stopUSB();
      stopUSB = null;
    }
    if (stopScanner) {
      stopScanner();
      stopScanner = null;
    }
    $("app").innerHTML = html;
    message("");
    if (!terminal) bindNav();
  }
  function nav() {
    if (!terminal) return "";
    return '<div class="subnav"><button id="back">\u2190 \u0413\u043B\u0430\u0432\u043D\u043E\u0435</button>' + (!terminal ? '<button id="inventory">\u041E\u0441\u0442\u0430\u0442\u043A\u0438</button><button id="shift">\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0441\u043C\u0435\u043D\u0443</button>' + (["owner", "developer"].includes(memberRole) ? '<button id="master-stock">\u0417\u0430\u043F\u0447\u0430\u0441\u0442\u0438 \u043D\u0430 \u043C\u0430\u0441\u0442\u0435\u0440\u0430\u0445</button>' : "") : "") + "</div>";
  }
  async function showServices() {
    var _a3;
    if ((_a3 = window.fastgoServiceCatalogDirty) == null ? void 0 : _a3.call(window)) throw Error("\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0438\u043B\u0438 \u043E\u0442\u043C\u0435\u043D\u0438\u0442\u0435 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435 \u043F\u0440\u0430\u0439\u0441\u0430");
    if (live.hasDraft() || job || draft) throw Error("\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u0435 \u0442\u0435\u043A\u0443\u0449\u0438\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442");
    screen = "services";
    shell('<div id="service-root"></div>');
    serviceView = mountServices({ root: $("service-root"), call, editor: ["owner", "developer", "admin"].includes(memberRole), message });
    await serviceView.ready;
  }
  async function showManualPayment() {
    if (terminal || document.body.dataset.readonly === "true") throw Error("\u041F\u0440\u0438\u0451\u043C \u043E\u043F\u043B\u0430\u0442\u044B \u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D \u043D\u0430 \u043A\u0430\u0441\u0441\u043E\u0432\u043E\u043C \u043D\u043E\u0443\u0442\u0431\u0443\u043A\u0435");
    if (live.hasDraft() || job || draft) throw Error("\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u0435 \u0442\u0435\u043A\u0443\u0449\u0438\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442");
    live.suspend();
    screen = "manual-payment";
    shell('<div id="service-payment-root"></div>');
    serviceView = mountManualPayment({ root: $("service-payment-root"), call, load, save: save2, home, message });
    await serviceView.ready;
  }
  async function showPreorders() {
    screen = "preorders";
    shell('<h1>\u041F\u0440\u0435\u0434\u0437\u0430\u043A\u0430\u0437\u044B</h1><div id="preorder-root"></div>');
    preorderView = mountPreorders({ root: $("preorder-root"), call: serviceApi, actor: userId() });
    await preorderView.ready;
  }
  async function showFinalReport() {
    var _a3, _b;
    if (terminal || document.body.dataset.readonly === "true") throw Error("\u041E\u0442\u0447\u0451\u0442 \u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D \u043D\u0430 \u043A\u0430\u0441\u0441\u043E\u0432\u043E\u043C \u043D\u043E\u0443\u0442\u0431\u0443\u043A\u0435");
    if (live.hasDraft() || job || draft || ((_b = (_a3 = load("manual-service-payment")) == null ? void 0 : _a3.items) == null ? void 0 : _b.length)) throw Error("\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u0435 \u0442\u0435\u043A\u0443\u0449\u0438\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u043F\u0435\u0440\u0435\u0434 \u043E\u0442\u043A\u0440\u044B\u0442\u0438\u0435\u043C \u043E\u0442\u0447\u0451\u0442\u0430");
    live.suspend();
    screen = "report";
    shell('<div id="final-report-root"></div>');
    serviceView = mountFinalReport({ root: $("final-report-root"), call });
    await serviceView.ready;
  }
  function bindNav() {
    if ($("final-report")) {
      $("final-report").hidden = terminal || document.body.dataset.readonly === "true";
      $("final-report").onclick = () => run(showFinalReport);
    }
    if ($("service-catalog")) {
      $("service-catalog").hidden = terminal;
      $("service-catalog").onclick = () => run(showServices);
    }
    if ($("preorders")) {
      $("preorders").hidden = !preorderAccess({ role: memberRole });
      $("preorders").onclick = () => run(showPreorders);
    }
    if ($("nav-receipt")) $("nav-receipt").onclick = () => run(() => live.open("receipt"));
    if ($("nav-pay")) $("nav-pay").onclick = () => run(() => live.open("sale"));
    if ($("master-stock")) $("master-stock").hidden = !["owner", "developer"].includes(memberRole);
    document.querySelectorAll(".warehouse-sidebar button").forEach((b) => b.classList.toggle("active", b.id === (screen === "report" ? "final-report" : screen === "services" ? "service-catalog" : screen === "inventory" ? "inventory" : screen === "holdings" ? "master-stock" : screen === "preorders" ? "preorders" : screen === "shift" ? "shift" : screen === "live" ? live.kind() === "receipt" ? "nav-receipt" : "nav-pay" : "back")));
    applyReadOnly();
    if ($("back")) $("back").onclick = home;
    if ($("inventory")) $("inventory").onclick = () => run(inventory);
    if ($("shift")) $("shift").onclick = shift;
    if ($("master-stock")) $("master-stock").onclick = () => run(holdings);
  }
  function notifications() {
    if (terminal) return;
    startNotifications({ actor: userId(), call: avitoApi, station: async () => device });
    const bell = document.querySelector(".fg-notice-bell");
    if (bell) document.querySelector("body > header").append(bell);
  }
  async function catalog() {
    const c = await call("catalog");
    parts = c.parts;
    staff = c.staff;
    try {
      save2("catalog:" + document.body.dataset.mode, { device_id: device == null ? void 0 : device.id, parts, staff, role: memberRole });
    } catch (e) {
      message("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043A\u0430\u0442\u0430\u043B\u043E\u0433 \u0434\u043B\u044F \u0440\u0430\u0431\u043E\u0442\u044B \u0431\u0435\u0437 \u0441\u0435\u0442\u0438.", true);
    }
  }
  function usbHelp() {
    return '<details class="panel"><summary>\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u043F\u043E USB</summary><p>\u041D\u0430 \u043D\u043E\u0443\u0442\u0431\u0443\u043A\u0435 \u043E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \xAB\u0421\u043A\u0430\u043D\u0435\u0440 \u043F\u043E USB\xBB \u0438 \u043D\u0430\u0436\u043C\u0438\u0442\u0435 \xAB\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0441\u043A\u0430\u043D\u0435\u0440 \u043D\u0430 \u0442\u0435\u0440\u043C\u0438\u043D\u0430\u043B\u0435\xBB. \u041D\u0430 iData \u0434\u043E\u043B\u0436\u0435\u043D \u043E\u0442\u043A\u0440\u044B\u0442\u044C\u0441\u044F \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u0439 \u044D\u043A\u0440\u0430\u043D \xABFastGo \xB7 USB\xBB \u0441 \u043A\u043D\u043E\u043F\u043A\u0430\u043C\u0438 \xAB\u041F\u0440\u0438\u0445\u043E\u0434\xBB \u0438 \xAB\u041E\u043F\u043B\u0430\u0442\u0430\xBB.</p><p>\u0414\u043B\u044F USB \u0438\u043D\u0442\u0435\u0440\u043D\u0435\u0442 \u043D\u0430 \u0442\u0435\u0440\u043C\u0438\u043D\u0430\u043B\u0435 \u043D\u0435 \u043D\u0443\u0436\u0435\u043D. \u0420\u0430\u0437\u0440\u0435\u0448\u0438\u0442\u0435 USB-\u043E\u0442\u043B\u0430\u0434\u043A\u0443 \u0438 \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0431\u0440\u0430\u0443\u0437\u0435\u0440, \u0435\u0441\u043B\u0438 Android \u0435\u0433\u043E \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0438\u0442.</p></details>';
  }
  async function connectTerminal() {
    screen = "connect";
    shell('<h1>\u0412\u044B\u0431\u043E\u0440 \u043D\u043E\u0443\u0442\u0431\u0443\u043A\u0430</h1><p>\u0418\u0449\u0435\u043C \u0441\u043A\u043B\u0430\u0434\u0441\u043A\u0438\u0435 \u0440\u0430\u0431\u043E\u0447\u0438\u0435 \u043C\u0435\u0441\u0442\u0430\u2026</p><button id="connect-retry">\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u0441\u043F\u0438\u0441\u043E\u043A</button>' + usbHelp());
    $("connect-retry").onclick = () => run(connectTerminal);
    const stations = await api("stations");
    const connect = async (station) => {
      let pending2 = load("terminal-connection");
      if (!pending2 || pending2.station_id !== station.id) {
        pending2 = { station_id: station.id, terminal_id: uuid(), token: uuid() + uuid() };
        save2("terminal-connection", pending2);
      }
      device = await api("connect_terminal", pending2);
      save2("terminal", device);
      save2("terminal-connection", null);
      await start();
    };
    if (stations.length === 1) return connect(stations[0]);
    shell("<h1>\u0412\u044B\u0431\u043E\u0440 \u043D\u043E\u0443\u0442\u0431\u0443\u043A\u0430</h1><p>" + (stations.length ? "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0440\u0430\u0431\u043E\u0447\u0435\u0435 \u043C\u0435\u0441\u0442\u043E, \u043D\u0430 \u043A\u043E\u0442\u043E\u0440\u043E\u0435 \u043F\u0435\u0440\u0435\u0434\u0430\u0432\u0430\u0442\u044C \u043A\u043E\u0440\u0437\u0438\u043D\u044B. \u041A\u043E\u0434 \u043D\u0435 \u043D\u0443\u0436\u0435\u043D." : "\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0432\u043E\u0439\u0434\u0438\u0442\u0435 \u0432 FastGo \u0421\u043A\u043B\u0430\u0434 \u043D\u0430 \u043D\u043E\u0443\u0442\u0431\u0443\u043A\u0435 \u0438 \u0441\u043E\u0437\u0434\u0430\u0439\u0442\u0435 \u0440\u0430\u0431\u043E\u0447\u0435\u0435 \u043C\u0435\u0441\u0442\u043E.") + '</p><div id="stations" class="panel"></div><button id="connect-retry">\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u0441\u043F\u0438\u0441\u043E\u043A</button>' + usbHelp());
    for (const station of stations) {
      const button = document.createElement("button");
      button.textContent = station.name + (stations.filter((x) => x.name === station.name).length > 1 ? " \xB7 " + new Date(station.created_at).toLocaleString("ru-RU") : "");
      button.onclick = () => run(() => connect(station));
      $("stations").append(button);
    }
    $("connect-retry").onclick = () => run(connectTerminal);
  }
  async function start() {
    if (!userId()) return signIn();
    device = load(terminal ? "terminal" : "station");
    draft = load("draft:" + document.body.dataset.mode);
    $("logout").hidden = false;
    if (!device) {
      if (!terminal && (new URLSearchParams(location.search).get("unified") === "1" || !window.warehouseDesktop)) {
        document.body.dataset.readonly = "true";
        memberRole = (await serviceApi("me")).role;
        if (memberRole === "mechanic") throw Error("\u042D\u0442\u043E\u0442 \u0440\u0430\u0437\u0434\u0435\u043B \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D \u0432\u0430\u0448\u0435\u0439 \u0440\u043E\u043B\u0438");
        await catalog();
        $("connection").textContent = "\u041A\u0430\u0442\u0430\u043B\u043E\u0433 \u0441\u043A\u043B\u0430\u0434\u0430 \xB7 \u043E\u0431\u0449\u0435\u0435 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435";
        home();
        await inventory();
        message("\u041F\u0440\u0438\u0445\u043E\u0434, \u043E\u043F\u043B\u0430\u0442\u0430 \u0438 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u0422\u0421\u0414 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B \u043D\u0430 \u0434\u0432\u0443\u0445 \u0440\u0430\u0437\u0440\u0435\u0448\u0451\u043D\u043D\u044B\u0445 \u043D\u043E\u0443\u0442\u0431\u0443\u043A\u0430\u0445. \u0426\u0435\u043D\u0443 \u0438 \u043E\u0441\u0442\u0430\u0442\u043E\u043A \u0432\u043B\u0430\u0434\u0435\u043B\u0435\u0446 \u043C\u043E\u0436\u0435\u0442 \u0438\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u0432 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0435 \u0442\u043E\u0432\u0430\u0440\u0430.");
        return;
      }
      if (!terminal) return setup();
      try {
        return await connectTerminal();
      } catch (e) {
        return connectionError(e);
      }
    }
    try {
      const info = await call("info");
      memberRole = info.member.role;
      notifications();
      $("connection").textContent = info.device.name + " \xB7 \u0438\u043D\u0442\u0435\u0440\u043D\u0435\u0442";
      await catalog();
      home();
      if (!terminal) {
        if (new URLSearchParams(location.search).get("section") === "inventory") await inventory();
        await live.restore();
      }
    } catch (e) {
      if (e.status === 401) {
        signIn();
        message("\u0412\u043E\u0439\u0434\u0438\u0442\u0435 \u0441\u043D\u043E\u0432\u0430. \u0421\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u043E\u0441\u0442\u0430\u043D\u0435\u0442\u0441\u044F \u043D\u0430 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0435.", true);
        return;
      }
      if (e.status !== 403) {
        const cached = load("catalog:" + document.body.dataset.mode);
        if ((cached == null ? void 0 : cached.device_id) === device.id && Array.isArray(cached.parts)) {
          parts = cached.parts;
          staff = cached.staff || [];
          memberRole = cached.role || "";
          home();
          if (!terminal) await live.restore();
          $("connection").textContent = "\u041D\u0435\u0442 \u0441\u0432\u044F\u0437\u0438 \xB7 \u0441\u043A\u0430\u043D\u044B \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u044E\u0442\u0441\u044F";
          message("\u041C\u043E\u0436\u043D\u043E \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0430\u0442\u044C \u0441\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u0442\u044C. \u041F\u0435\u0440\u0435\u0434\u0430\u0439\u0442\u0435 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u043F\u043E\u0441\u043B\u0435 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F \u0441\u0432\u044F\u0437\u0438.", true);
          return;
        }
      }
      connectionError(e);
    }
  }
  function connectionError(e) {
    screen = "connection";
    shell('<h1>\u041D\u0435\u0442 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F \u043A \u0441\u043A\u043B\u0430\u0434\u0443</h1><p>\u0421\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0435 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u044B \u043E\u0441\u0442\u0430\u044E\u0442\u0441\u044F \u043D\u0430 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0435.</p><button id="retry">\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u044C\u0441\u044F \u0441\u043D\u043E\u0432\u0430</button>' + (terminal ? '<button id="choose-station">\u0412\u044B\u0431\u0440\u0430\u0442\u044C \u043D\u043E\u0443\u0442\u0431\u0443\u043A</button>' : "") + usbHelp());
    $("retry").onclick = () => run(start);
    if ($("choose-station")) $("choose-station").onclick = () => run(connectTerminal);
    message(e.message, true);
  }
  function signIn() {
    var _a3;
    (_a3 = window.fastgoNotifications) == null ? void 0 : _a3.stop();
    screen = "login";
    $("logout").hidden = true;
    shell("<h1>" + (terminal ? "\u0422\u0435\u0440\u043C\u0438\u043D\u0430\u043B FastGo" : "FastGo \u0421\u043A\u043B\u0430\u0434") + '</h1><form id="login" class="panel" style="max-width:420px"><label>\u041F\u043E\u0447\u0442\u0430 \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0430<input name="email" type="email" autocomplete="username" required></label><label>\u041F\u0430\u0440\u043E\u043B\u044C<input name="password" type="password" autocomplete="current-password" required></label><button class="primary">\u0412\u043E\u0439\u0442\u0438</button></form>' + (terminal ? usbHelp() : ""));
    $("login").onsubmit = (e) => {
      e.preventDefault();
      const p = formValues(e.target);
      run(async () => {
        await login(p.email, p.password);
        await start();
      });
    };
  }
  function setup() {
    if (terminal) return connectTerminal();
    screen = "setup";
    shell('<h1>\u041D\u043E\u0432\u043E\u0435 \u0441\u043A\u043B\u0430\u0434\u0441\u043A\u043E\u0435 \u0440\u0430\u0431\u043E\u0447\u0435\u0435 \u043C\u0435\u0441\u0442\u043E</h1><form id="setup" class="panel"><label>\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u043A\u0430\u0441\u0441\u044B / \u043D\u043E\u0443\u0442\u0431\u0443\u043A\u0430<input name="value" required autocomplete="off"></label><button class="primary">\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u0440\u0430\u0431\u043E\u0447\u0435\u0435 \u043C\u0435\u0441\u0442\u043E</button></form>');
    $("setup").onsubmit = (e) => {
      e.preventDefault();
      const value = e.target.elements.value.value;
      run(async () => {
        let pending2 = load("station-registration");
        if (!pending2) {
          pending2 = { station_id: uuid(), token: uuid() + uuid() };
          save2("station-registration", pending2);
        }
        device = await api("register", { name: value, ...pending2 });
        save2("station", device);
        save2("station-registration", null);
        await start();
      });
    };
  }
  function home() {
    product.close();
    live.cleanup();
    screen = "home";
    job = null;
    shell((terminal ? "" : nav()) + "<h1>" + (terminal ? "\u0421\u043A\u043B\u0430\u0434\u0441\u043A\u043E\u0439 \u0442\u0435\u0440\u043C\u0438\u043D\u0430\u043B" : "\u0420\u0430\u0431\u043E\u0447\u0435\u0435 \u043C\u0435\u0441\u0442\u043E \u0441\u043A\u043B\u0430\u0434\u0430") + '</h1><div class="homebuttons"><button class="primary" id="receipt">\u041F\u0440\u0438\u0445\u043E\u0434</button><button class="primary" id="pay">\u041E\u043F\u043B\u0430\u0442\u0430</button></div>' + (terminal ? '<button class="primary" id="repair-scan">\u041E\u043F\u043B\u0430\u0442\u0430 \u0440\u0435\u043C\u043E\u043D\u0442\u0430</button>' : "") + (draft && !terminal ? '<div class="panel">\u0415\u0441\u0442\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442 <button id="resume">\u041F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C</button></div>' : "") + (!terminal ? '<section class="panel"><div id="live-terminal-panel"></div><div id="queue" aria-live="polite">\u041F\u0440\u043E\u0432\u0435\u0440\u044F\u0435\u043C\u2026</div><section id="unknown-scans"></section></section>' : usbHelp()));
    bindNav();
    $("receipt").onclick = () => run(() => live.open("receipt"));
    $("pay").onclick = () => run(() => live.open("sale"));
    if ($("repair-scan")) $("repair-scan").onclick = repairScan;
    if ($("resume")) $("resume").onclick = () => basket(draft.kind, true);
    if (!terminal) {
      void poll();
      void pollUSB();
    }
  }
  function repairScan() {
    screen = "repair-scan";
    shell(nav() + '<h1>\u041E\u043F\u043B\u0430\u0442\u0430 \u0440\u0435\u043C\u043E\u043D\u0442\u0430</h1><form id="repair-scan-form"><label>QR \u0440\u0435\u043C\u043E\u043D\u0442\u0430<input id="repair-code" autocomplete="off"></label><button>\u0421\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u0442\u044C</button></form>');
    const input = $("repair-code"), form = $("repair-scan-form");
    form.onsubmit = (e) => {
      e.preventDefault();
      const code = input.value.trim();
      input.value = "";
      const error = scanError("repair", code);
      if (error) {
        message(error, true);
        return;
      }
      void run(async () => {
        const quote = await call("repair_quote", { code });
        await repair.terminal(quote);
      });
    };
    stopScanner = bindScanner(input, form, () => !busy && screen === "repair-scan");
  }
  function basket(kind, resume = false) {
    if (terminal && draft && !resume && draft.kind === kind) resume = true;
    if (draft && !resume) {
      message("\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \xAB" + (draft.kind === "receipt" ? "\u041F\u0440\u0438\u0445\u043E\u0434" : "\u041E\u043F\u043B\u0430\u0442\u0430") + "\xBB \u0438 \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u0435 \u0438\u043B\u0438 \u043E\u0442\u043C\u0435\u043D\u0438\u0442\u0435 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442.", true);
      return;
    }
    screen = "basket";
    if (!resume) {
      draft = { id: uuid(), kind, items: [], note: "" };
      save2("draft:" + document.body.dataset.mode, draft);
    }
    shell(nav() + "<h1>" + (kind === "receipt" ? "\u041F\u0440\u0438\u0445\u043E\u0434" : "\u041E\u043F\u043B\u0430\u0442\u0430 \u2014 \u0441\u0431\u043E\u0440 \u043A\u043E\u0440\u0437\u0438\u043D\u044B") + '</h1><form id="scan"><label>\u0428\u0442\u0440\u0438\u0445\u043A\u043E\u0434 / \u0430\u0440\u0442\u0438\u043A\u0443\u043B<input id="barcode" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done"></label><button>\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C</button></form><div id="usb-inbox" class="actions"></div><div id="basket" class="panel ' + (kind === "receipt" ? "receipt" : "") + '"></div>' + (kind === "receipt" ? '<label>\u041F\u043E\u0441\u0442\u0430\u0432\u0449\u0438\u043A / \u043D\u043E\u043C\u0435\u0440 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430<input id="note" value="' + esc(draft.note) + '"></label>' : "") + '<div class="actions"><button class="primary" id="send">' + (kind === "receipt" ? "\u041F\u0440\u043E\u0432\u0435\u0441\u0442\u0438 \u043F\u0440\u0438\u0445\u043E\u0434" : "\u041F\u0435\u0440\u0435\u0434\u0430\u0442\u044C \u043D\u0430 \u043D\u043E\u0443\u0442\u0431\u0443\u043A") + '</button><button id="discard">\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442</button></div>');
    bindNav();
    drawBasket();
    $("scan").onsubmit = (e) => {
      e.preventDefault();
      if (!busy) {
        if (!terminal && draft.kind === "receipt") {
          message("\u0410\u0422\u041E\u041B \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u0442\u0441\u044F \u0434\u043B\u044F \u043E\u043F\u043B\u0430\u0442\u044B \u0438 \u0432\u044B\u0434\u0430\u0447\u0438 \u043C\u0430\u0441\u0442\u0435\u0440\u0443. \u0414\u043B\u044F \u043F\u0440\u0438\u0445\u043E\u0434\u0430 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439\u0442\u0435 \u0422\u0421\u0414.", true);
          $("barcode").value = "";
        } else addCode($("barcode").value.trim());
      }
    };
    if ($("note")) $("note").oninput = (e) => {
      draft.note = e.target.value;
      persist();
    };
    $("send").onclick = () => run(send);
    $("discard").onclick = () => {
      var _a3;
      if (confirm("\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C \u044D\u0442\u043E\u0442 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442? \u041E\u0441\u0442\u0430\u0442\u043A\u0438 \u043D\u0435 \u0438\u0437\u043C\u0435\u043D\u044F\u0442\u0441\u044F.")) {
        if ((_a3 = window.warehouseDesktop) == null ? void 0 : _a3.usbRelease) void window.warehouseDesktop.usbRelease(usbKey()).catch((e) => message(e.message, true));
        draft = null;
        save2("draft:" + document.body.dataset.mode, null);
        home();
      }
    };
    stopScanner = bindScanner($("barcode"), $("scan"), () => !busy && screen === "basket");
    stopUSB = bindUSBInbox({ key: usbKey(), label: kind === "receipt" ? "\u041F\u0440\u0438\u0445\u043E\u0434" : "\u041E\u043F\u043B\u0430\u0442\u0430", container: $("usb-inbox"), enabled: () => !busy && screen === "basket" && !document.activeElement.hasAttribute("data-qty"), add: (item) => addCode(item.code, item.id), error: (v) => message(v, true) });
  }
  function usbKey() {
    return userId() + ":" + draft.id;
  }
  function addCode(code, usbId) {
    var _a3;
    if (!code) return false;
    if (usbId && ((_a3 = draft.usb_ids) == null ? void 0 : _a3.includes(usbId))) return true;
    const found = matchBarcode(parts, code);
    if (found.length !== 1) {
      message(found.length ? "\u041A\u043E\u0434 \u043D\u0435\u043E\u0434\u043D\u043E\u0437\u043D\u0430\u0447\u0435\u043D. \u0423\u0442\u043E\u0447\u043D\u0438\u0442\u0435 \u0442\u043E\u0432\u0430\u0440 \u043D\u0430 \u043D\u043E\u0443\u0442\u0431\u0443\u043A\u0435." : "\u041A\u043E\u0434 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D. \u0421\u043E\u0437\u0434\u0430\u0439\u0442\u0435 \u0438\u043B\u0438 \u043F\u0440\u0438\u0432\u044F\u0436\u0438\u0442\u0435 \u0442\u043E\u0432\u0430\u0440 \u0432 \u043E\u0431\u0449\u0435\u0439 \u0431\u0430\u0437\u0435 FastGo.", true);
      if (!usbId) {
        $("barcode").focus();
        $("barcode").select();
      }
      return false;
    }
    const before = JSON.stringify(draft), old = draft.items.find((x) => x.part_id === found[0].id);
    if (old) old.quantity++;
    else draft.items.push({ part_id: found[0].id, quantity: 1 });
    if (usbId) (draft.usb_ids || (draft.usb_ids = [])).push(usbId);
    try {
      persist();
    } catch (e) {
      draft = JSON.parse(before);
      throw e;
    }
    if (!usbId) $("barcode").value = "";
    drawBasket();
    message("\u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u043E: " + found[0].name + " \xB7 " + draft.items.find((x) => x.part_id === found[0].id).quantity + " \u0448\u0442.");
    if (!usbId || !document.activeElement.matches("input,textarea,select")) $("barcode").focus();
    return true;
  }
  async function finishUSB() {
    var _a3;
    if ((_a3 = window.warehouseDesktop) == null ? void 0 : _a3.usbRelease) await window.warehouseDesktop.usbRelease(usbKey());
  }
  function persist() {
    save2("draft:" + document.body.dataset.mode, draft);
  }
  function drawBasket() {
    const target = $("basket");
    target.innerHTML = draft.items.length ? draft.items.map((x) => {
      var _a3;
      const p = parts.find((p2) => p2.id === x.part_id);
      return '<div class="row"><div>' + esc((p == null ? void 0 : p.name) || "\u0422\u043E\u0432\u0430\u0440 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D") + "<small>" + esc((p == null ? void 0 : p.barcode) || "") + " \xB7 \u043E\u0441\u0442\u0430\u0442\u043E\u043A " + ((_a3 = p == null ? void 0 : p.quantity) != null ? _a3 : "\u2014") + '</small></div><input type="number" min="1" max="1000" value="' + x.quantity + '" aria-label="\u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E" data-qty="' + x.part_id + '"><span class="price">' + money(p == null ? void 0 : p.retail_price) + '</span><button data-remove="' + x.part_id + '" aria-label="\u0423\u0434\u0430\u043B\u0438\u0442\u044C">\xD7</button></div>';
    }).join("") : terminal ? "\u041D\u0430\u0432\u0435\u0434\u0438\u0442\u0435 \u0441\u043A\u0430\u043D\u0435\u0440 \u043D\u0430 \u0448\u0442\u0440\u0438\u0445\u043A\u043E\u0434 \u0438 \u043D\u0430\u0436\u043C\u0438\u0442\u0435 \u0437\u0435\u043B\u0451\u043D\u0443\u044E \u043A\u043D\u043E\u043F\u043A\u0443 \u043D\u0430 \u0442\u0435\u0440\u043C\u0438\u043D\u0430\u043B\u0435. \u0422\u043E\u0432\u0430\u0440 \u0434\u043E\u0431\u0430\u0432\u0438\u0442\u0441\u044F \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438. \u0412\u0440\u0443\u0447\u043D\u0443\u044E \u043A\u043E\u0434 \u043C\u043E\u0436\u043D\u043E \u0432\u0432\u0435\u0441\u0442\u0438 \u0432 \u043F\u043E\u043B\u0435 \u0432\u044B\u0448\u0435." : "\u0421\u043A\u0430\u043D\u0438\u0440\u0443\u0439\u0442\u0435 \u0442\u043E\u0432\u0430\u0440 \u0438\u043B\u0438 \u0432\u0432\u0435\u0434\u0438\u0442\u0435 \u0448\u0442\u0440\u0438\u0445\u043A\u043E\u0434 / \u0430\u0440\u0442\u0438\u043A\u0443\u043B \u0438 \u043D\u0430\u0436\u043C\u0438\u0442\u0435 \xAB\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C\xBB.";
    target.querySelectorAll("[data-qty]").forEach((el) => el.onchange = () => {
      const n = Number(el.value);
      if (!Number.isInteger(n) || n < 1 || n > 1e3) {
        message("\u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u043E\u0442 1 \u0434\u043E 1000", true);
        return;
      }
      draft.items.find((x) => x.part_id === el.dataset.qty).quantity = n;
      persist();
    });
    target.querySelectorAll("[data-remove]").forEach((b) => b.onclick = () => {
      draft.items = draft.items.filter((x) => x.part_id !== b.dataset.remove);
      persist();
      drawBasket();
      $("barcode").focus();
    });
  }
  async function send() {
    var _a3;
    if ((_a3 = window.warehouseDesktop) == null ? void 0 : _a3.usbTarget) {
      await window.warehouseDesktop.usbTarget(null);
      if ((await window.warehouseDesktop.usbBatch(usbKey())).items.length) throw Error("\u0414\u043E\u0436\u0434\u0438\u0442\u0435\u0441\u044C \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0438\u044F USB-\u0441\u043A\u0430\u043D\u043E\u0432 \u0438\u043B\u0438 \u043F\u0440\u043E\u043F\u0443\u0441\u0442\u0438\u0442\u0435 \u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 \u043A\u043E\u0434.");
    }
    if (!draft.items.length) throw Error("\u0414\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u0442\u043E\u0432\u0430\u0440\u044B");
    if (draft.kind === "receipt") {
      if (!draft.note.trim()) throw Error("\u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u043F\u043E\u0441\u0442\u0430\u0432\u0449\u0438\u043A\u0430 / \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442");
      await call("receipt", { request_id: draft.id, items: draft.items, note: draft.note });
      await finishUSB();
      draft = null;
      save2("draft:" + document.body.dataset.mode, null);
      await catalog();
      home();
      message("\u041F\u0440\u0438\u0445\u043E\u0434 \u043F\u0440\u043E\u0432\u0435\u0434\u0451\u043D. \u041E\u0441\u0442\u0430\u0442\u043A\u0438 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u044B.");
      return;
    }
    const queued = await call("enqueue", { request_id: draft.id, items: draft.items });
    const queuedId = queued.id;
    await finishUSB();
    draft = null;
    save2("draft:" + document.body.dataset.mode, null);
    if (terminal) {
      screen = "sent";
      shell("<h1>\u041F\u0435\u0440\u0435\u0434\u0430\u043D\u043E \u043D\u0430 \u043D\u043E\u0443\u0442\u0431\u0443\u043A</h1><p>\u041E\u0436\u0438\u0434\u0430\u0435\u0442 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u044F \u043A\u0430\u0441\u0441\u0438\u0440\u043E\u043C.</p><p>\u041A\u043E\u0440\u0437\u0438\u043D\u0430 " + esc(queuedId.slice(0, 8)) + '</p><button id="sent-back">\u0413\u043B\u0430\u0432\u043D\u043E\u0435</button><button id="sent-status">\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u0441\u0442\u0430\u0442\u0443\u0441</button>');
      $("sent-back").onclick = home;
      $("sent-status").onclick = () => run(async () => {
        const r = await call("job", { id: queuedId });
        message((r == null ? void 0 : r.state) === "done" ? "\u041F\u0440\u043E\u0432\u0435\u0434\u0435\u043D\u043E" : (r == null ? void 0 : r.state) === "processing" ? "\u041A\u0430\u0441\u0441\u0438\u0440 \u0437\u0430\u0432\u0435\u0440\u0448\u0430\u0435\u0442 \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u044E" : "\u041E\u0436\u0438\u0434\u0430\u0435\u0442 \u043A\u0430\u0441\u0441\u0438\u0440\u0430");
      });
    } else await checkout(await call("job", { id: queuedId }));
  }
  function canReceiveIncoming() {
    var _a3;
    return !busy && !job && !draft && ["home", "live", "inventory", "holdings", "preorders"].includes(screen) && !document.querySelector("dialog[open]") && !((_a3 = document.activeElement) == null ? void 0 : _a3.matches("input:not(#live-code):not(#filter):not([data-payment-scan]),textarea,select"));
  }
  var autoQueueSeen = /* @__PURE__ */ new Set();
  async function poll() {
    var _a3, _b;
    if (terminal || !canReceiveIncoming() || !live.canAutoOpen() || polling || !device) return;
    polling = true;
    try {
      const jobs = await call("queue");
      if (!canReceiveIncoming() || !live.canAutoOpen()) return;
      const next = jobs.filter((x) => x.state !== "done" && !autoQueueSeen.has(x.id)).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
      if (next) {
        live.suspend();
        await checkout(next);
        autoQueueSeen.add(next.id);
        void ((_b = (_a3 = window.warehouseDesktop) == null ? void 0 : _a3.showIncoming) == null ? void 0 : _b.call(_a3));
        return;
      }
      await live.pollMirror();
      if (!$("queue")) return;
      $("queue").innerHTML = jobs.length ? jobs.map((x) => '<div class="job"><span>' + (x.payload.kind === "repair" ? "\u0420\u0435\u043C\u043E\u043D\u0442 \u2116 " + esc(x.payload.repair.number) + " \xB7 " + money(x.payload.repair.due) : "\u041A\u043E\u0440\u0437\u0438\u043D\u0430 " + esc(x.id.slice(0, 8)) + " \xB7 " + x.payload.items.reduce((n, i) => n + i.quantity, 0) + " \u0448\u0442.") + '<small style="display:block">' + new Date(x.created_at).toLocaleString("ru-RU") + " \xB7 " + (x.state === "processing" ? "\u0422\u0440\u0435\u0431\u0443\u0435\u0442 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u044F" : "\u041E\u0436\u0438\u0434\u0430\u0435\u0442 \u043E\u043F\u043B\u0430\u0442\u044B") + '</small></span><button data-job="' + x.id + '">\u041E\u0442\u043A\u0440\u044B\u0442\u044C</button></div>').join("") : "\u041D\u043E\u0432\u044B\u0445 \u043A\u043E\u0440\u0437\u0438\u043D \u043D\u0435\u0442";
      $("queue").querySelectorAll("[data-job]").forEach((b) => b.onclick = () => run(async () => checkout(jobs.find((x) => x.id === b.dataset.job))));
      $("connection").textContent = device.name + " \xB7 \u0435\u0441\u0442\u044C \u0441\u0432\u044F\u0437\u044C";
    } catch (e) {
      $("connection").textContent = "\u041D\u0435\u0442 \u0441\u0432\u044F\u0437\u0438";
      message(e.message, true);
    } finally {
      polling = false;
    }
  }
  async function checkout(value) {
    if (value.payload.kind === "repair") return repair.checkout(value);
    job = value;
    screen = "checkout";
    const state = await call("cash_state"), fixed = job.checkout;
    shell(nav() + "<h1>\u041E\u043F\u043B\u0430\u0442\u0430 \xB7 " + esc(job.id.slice(0, 8)) + '</h1><div class="twocol"><section class="panel"><h2>\u0422\u043E\u0432\u0430\u0440\u044B</h2>' + job.payload.items.map((x) => {
      var _a3, _b, _c;
      const p = parts.find((p2) => p2.id === x.part_id), price = (_c = (_b = (_a3 = fixed == null ? void 0 : fixed.items.find((i) => i.part_id === x.part_id)) == null ? void 0 : _a3.unit_price) != null ? _b : p == null ? void 0 : p.retail_price) != null ? _c : 0;
      return "<label>" + esc((p == null ? void 0 : p.name) || x.part_id) + " \xB7 " + x.quantity + ' \u0448\u0442.<input type="number" min="0" step="0.01" value="' + price + '" data-price="' + x.part_id + '" ' + (fixed ? "disabled" : "") + "></label>";
    }).join("") + '<div class="total"><span>\u0418\u0442\u043E\u0433\u043E</span><b id="total"></b></div></section><section class="panel"><label>\u041E\u043F\u0435\u0440\u0430\u0446\u0438\u044F<select id="mode" ' + (fixed ? "disabled" : "") + '><option value="sale">\u041F\u0440\u043E\u0434\u0430\u0436\u0430</option>' + ((fixed == null ? void 0 : fixed.mode) === "master" ? '<option value="master">\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u044C \u043F\u0440\u0435\u0436\u043D\u044E\u044E \u0432\u044B\u0434\u0430\u0447\u0443 \u043C\u0430\u0441\u0442\u0435\u0440\u0443 \xB7 0 \u20BD</option>' : "") + '</select></label><div id="sale-fields"><label>\u0421\u043C\u0435\u043D\u0430<select id="cash-shift">' + state.shifts.filter((x) => x.status === "open").map((x) => '<option value="' + x.id + '">' + esc(x.register) + " \xB7 \u2116 " + x.number + "</option>").join("") + '</select></label><label>\u041E\u043F\u043B\u0430\u0442\u0430<select id="method"><option value="cash">\u041D\u0430\u043B\u0438\u0447\u043D\u044B\u0435</option><option value="card">\u0411\u0435\u0437\u043D\u0430\u043B\u0438\u0447\u043D\u044B\u0435</option></select></label><p class="muted">\u041F\u0440\u043E\u0432\u043E\u0434\u0438\u043C \u0443\u0447\u0451\u0442 \u043F\u0440\u043E\u0434\u0430\u0436\u0438. \u0411\u0430\u043D\u043A\u043E\u0432\u0441\u043A\u0438\u0439 \u043F\u043B\u0430\u0442\u0451\u0436 \u0438 \u0444\u0438\u0441\u043A\u0430\u043B\u044C\u043D\u044B\u0439 \u0447\u0435\u043A \u0432\u044B\u043F\u043E\u043B\u043D\u044F\u044E\u0442\u0441\u044F \u043D\u0430 \u043A\u0430\u0441\u0441\u0435.</p></div><label id="master-fields" hidden>\u0412\u044B\u0431\u0440\u0430\u0442\u044C \u043C\u0430\u0441\u0442\u0435\u0440\u0430<select id="master">' + staff.map((x) => '<option value="' + x.profile_id + '">' + esc(x.name) + "</option>").join("") + '</select></label><button class="primary" id="checkout">\u041F\u0440\u043E\u0432\u0435\u0441\u0442\u0438</button><button type="button" class="live-cancel" id="checkout-cancel" ' + (fixed || job.state !== "queued" ? 'disabled data-unavailable="true"' : "") + '>\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C \u043E\u043F\u043B\u0430\u0442\u0443</button><p class="muted">\u0412\u044B\u0434\u0430\u0447\u0430 \u043C\u0430\u0441\u0442\u0435\u0440\u0443 \u0443\u043C\u0435\u043D\u044C\u0448\u0430\u0435\u0442 \u0441\u043A\u043B\u0430\u0434\u0441\u043A\u043E\u0439 \u043E\u0441\u0442\u0430\u0442\u043E\u043A \u0438 \u0437\u0430\u043F\u0438\u0441\u044B\u0432\u0430\u0435\u0442 \u0437\u0430\u043F\u0447\u0430\u0441\u0442\u0438 \u043D\u0430 \u043C\u0430\u0441\u0442\u0435\u0440\u0430, \u0431\u0435\u0437 \u0434\u0435\u043D\u0435\u0436\u043D\u043E\u0439 \u0432\u044B\u0440\u0443\u0447\u043A\u0438.</p></section></div>');
    bindNav();
    if (fixed) {
      $("mode").value = fixed.mode;
      $("method").value = fixed.payment_method;
      $("cash-shift").value = fixed.shift_id;
      $("master").value = fixed.master_id;
      for (const id of ["method", "cash-shift", "master"]) $(id).disabled = true;
    }
    $("checkout-cancel").onclick = () => run(async () => {
      if (fixed || job.state !== "queued") throw Error("\u041E\u043F\u043B\u0430\u0442\u0430 \u0443\u0436\u0435 \u043F\u0440\u043E\u0432\u043E\u0434\u0438\u0442\u0441\u044F. \u0414\u043E\u0436\u0434\u0438\u0442\u0435\u0441\u044C \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0430");
      if (!confirm("\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C \u043E\u043F\u043B\u0430\u0442\u0443? \u041F\u0440\u043E\u0434\u0430\u0436\u0430 \u043D\u0435 \u0431\u0443\u0434\u0435\u0442 \u043F\u0440\u043E\u0432\u0435\u0434\u0435\u043D\u0430, \u043E\u0441\u0442\u0430\u0442\u043A\u0438 \u0438 \u0440\u0430\u0441\u0447\u0451\u0442\u044B \u043D\u0435 \u0438\u0437\u043C\u0435\u043D\u044F\u0442\u0441\u044F.")) return;
      const currentId = job.id;
      const finish = (value2) => {
        var _a3;
        if ((value2 == null ? void 0 : value2.state) !== "done") throw Error("\u0421\u0435\u0440\u0432\u0435\u0440 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u043B \u043E\u0442\u043C\u0435\u043D\u0443. \u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0435");
        job = null;
        home();
        message(((_a3 = value2.result) == null ? void 0 : _a3.cancelled) ? "\u041E\u043F\u043B\u0430\u0442\u0430 \u043E\u0442\u043C\u0435\u043D\u0435\u043D\u0430" : "\u041E\u043F\u043B\u0430\u0442\u0430 \u0443\u0436\u0435 \u043F\u0440\u043E\u0432\u0435\u0434\u0435\u043D\u0430");
      };
      try {
        finish(await call("cancel_document", { id: currentId, kind: "sale", revision: job.payload.revision || 1 }));
      } catch (error) {
        const latest = await call("job", { id: currentId }).catch(() => null);
        if ((latest == null ? void 0 : latest.state) === "done") {
          finish(latest);
          return;
        }
        throw error;
      }
    });
    const calc = () => {
      $("sale-fields").hidden = $("mode").value === "master";
      $("master-fields").hidden = $("mode").value !== "master";
      $("total").textContent = money($("mode").value === "master" ? 0 : job.payload.items.reduce((n, x) => n + x.quantity * Number(document.querySelector('[data-price="' + x.part_id + '"]').value), 0));
    };
    $("mode").onchange = calc;
    document.querySelectorAll("[data-price]").forEach((x) => x.oninput = calc);
    calc();
    $("checkout").onclick = () => run(async () => {
      const p = { id: job.id, mode: $("mode").value, shift_id: $("cash-shift").value, payment_method: $("method").value, master_id: $("master").value, items: job.payload.items.map((x) => ({ ...x, unit_price: Number(document.querySelector('[data-price="' + x.part_id + '"]').value) })) };
      await call("checkout", p);
      job = null;
      await catalog();
      home();
      message(p.mode === "master" ? "\u0417\u0430\u043F\u0447\u0430\u0441\u0442\u0438 \u0432\u044B\u0434\u0430\u043D\u044B \u043C\u0430\u0441\u0442\u0435\u0440\u0443. \u041E\u043F\u043B\u0430\u0442\u0430 0 \u20BD." : "\u041F\u0440\u043E\u0434\u0430\u0436\u0430 \u043F\u0440\u043E\u0432\u0435\u0434\u0435\u043D\u0430.");
    });
  }
  function shift() {
    screen = "shift";
    shell(nav() + '<h1>\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0441\u043C\u0435\u043D\u0443</h1><form id="shift-form" class="panel"><label>\u041A\u0430\u0441\u0441\u0430<input name="register" value="' + esc(device.name) + '" required></label><label>\u041D\u0430\u043B\u0438\u0447\u043D\u044B\u0435 \u043D\u0430 \u043D\u0430\u0447\u0430\u043B\u043E, \u20BD<input name="opening_cash" type="number" min="0" step="0.01" value="0" required></label><button class="primary">\u041E\u0442\u043A\u0440\u044B\u0442\u044C</button></form>');
    bindNav();
    const request_id = uuid();
    $("shift-form").onsubmit = (e) => {
      e.preventDefault();
      const p = formValues(e.target);
      run(async () => {
        await call("shift_open", { ...p, request_id });
        home();
        message("\u0421\u043C\u0435\u043D\u0430 \u043E\u0442\u043A\u0440\u044B\u0442\u0430");
      });
    };
  }
  var drawInventory = () => {
  };
  var canManageParts = () => !terminal && ["owner", "developer", "admin"].includes(memberRole);
  var canReceiveParts = () => !terminal && (!!device && document.body.dataset.readonly !== "true" || canManageParts());
  var refreshParts = async () => {
    await catalog();
    drawInventory();
  };
  var photos = partPhotos({ api: serviceApi, editable: canManageParts, run, changed: refreshParts, message });
  var offerLabels = (part, quantity) => {
    if (mobileLabelOffer()) return offerLabelPrinting(part, quantity, { call: serviceApi, actor: userId() });
  };
  var product = productPanel({ parts: () => parts, editable: canManageParts, call: (a, p) => call(a, p), run, changed: () => drawInventory(), message, photos, offerLabels });
  var createPart = newPartForm({ actor: userId, api: serviceApi, photos, parts: () => parts, canReceive: canReceiveParts, run, refresh: refreshParts, openProduct: (p) => product.open(p), message, offerLabels });
  async function inventory() {
    await catalog();
    screen = "inventory";
    shell(nav() + '<div class="inventory-toolbar"><h1>\u041E\u0441\u0442\u0430\u0442\u043A\u0438 \u043E\u0431\u0449\u0435\u0439 \u0431\u0430\u0437\u044B</h1>' + (canManageParts() ? '<button id="new-part" class="primary">\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0437\u0430\u043F\u0447\u0430\u0441\u0442\u044C</button>' : "") + '</div><label class="inventory-search"><span class="sr-only">\u041F\u043E\u0438\u0441\u043A</span><input id="filter" type="search" placeholder="\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044E, \u0430\u0440\u0442\u0438\u043A\u0443\u043B\u0443 \u0438\u043B\u0438 \u0448\u0442\u0440\u0438\u0445\u043A\u043E\u0434\u0443\u2026"></label><div class="inventory-table"><div class="inventory-columns"><span>\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435</span><span>\u0410\u0440\u0442\u0438\u043A\u0443\u043B</span><span>\u041E\u0441\u0442\u0430\u0442\u043E\u043A</span><span>\u041F\u0440\u043E\u0434\u0430\u0436\u0430 / \u0437\u0430\u043A\u0443\u043F\u043A\u0430</span></div><div id="stock-list"></div></div>');
    bindNav();
    drawInventory = () => {
      if (!$("stock-list")) return;
      const q = $("filter").value.toLowerCase(), matches = parts.filter((x) => [x.name, x.barcode, x.sku, x.model].join(" ").toLowerCase().includes(q));
      $("stock-list").innerHTML = matches.slice(0, 100).map((x) => '<button type="button" class="inventory-item" data-part="' + esc(x.id) + '"><span class="inventory-name">' + photos.thumbnail(x) + "<strong>" + esc(x.name) + "</strong></span><span>" + esc(x.sku || "\u2014") + "</span><span>" + x.quantity + " \u0448\u0442.</span><span>" + money(x.retail_price) + '<small class="purchase-price">\u0417\u0430\u043A\u0443\u043F\u043A\u0430: ' + money(x.unit_cost) + "</small></span></button>").join("") + (matches.length ? "" : '<p class="muted inventory-empty">\u041D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E</p>');
      photos.bindThumbnails($("stock-list"), parts);
      $("stock-list").querySelectorAll("[data-part]").forEach((b) => b.onclick = () => {
        document.querySelectorAll(".inventory-item").forEach((x) => x.classList.toggle("selected", x === b));
        product.open(parts.find((x) => x.id === b.dataset.part));
      });
    };
    if ($("new-part")) $("new-part").onclick = createPart;
    $("filter").oninput = drawInventory;
    drawInventory();
  }
  async function holdings() {
    const rows = await api("holdings");
    screen = "holdings";
    shell(nav() + '<h1>\u0417\u0430\u043F\u0447\u0430\u0441\u0442\u0438 \u043D\u0430 \u043C\u0430\u0441\u0442\u0435\u0440\u0430\u0445</h1><div class="panel tablewrap"><table><thead><tr><th>\u041C\u0430\u0441\u0442\u0435\u0440</th><th>\u0417\u0430\u043F\u0447\u0430\u0441\u0442\u044C</th><th>\u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E</th><th>\u0421\u0435\u0431\u0435\u0441\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C</th><th></th></tr></thead><tbody>' + rows.map((x, i) => "<tr><td>" + esc(x.master_name) + "</td><td>" + esc(x.name) + "</td><td>" + x.quantity + " \u0448\u0442.</td><td>" + money(x.unit_cost * x.quantity) + '</td><td><button data-master-return="' + i + '">\u0412\u0435\u0440\u043D\u0443\u0442\u044C \u043D\u0430 \u0441\u043A\u043B\u0430\u0434</button></td></tr>').join("") + "</tbody></table>" + (rows.length ? "" : "\u0417\u0430\u043F\u0447\u0430\u0441\u0442\u0435\u0439 \u043D\u0430 \u043C\u0430\u0441\u0442\u0435\u0440\u0430\u0445 \u043D\u0435\u0442.") + "</div>");
    bindNav();
    document.querySelectorAll("[data-master-return]").forEach((button) => button.onclick = () => {
      const x = rows[Number(button.dataset.masterReturn)], request_id = crypto.randomUUID(), dialog = document.createElement("dialog");
      dialog.innerHTML = "<form><h2>\u0412\u043E\u0437\u0432\u0440\u0430\u0442 \u043D\u0430 \u0441\u043A\u043B\u0430\u0434</h2><p>" + esc(x.master_name) + " \xB7 " + esc(x.name) + '</p><label>\u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E<input name="quantity" type="number" min="1" max="' + x.quantity + '" step="1" value="1" required></label><p class="error" role="alert"></p><div class="actions"><button type="button" data-cancel>\u041E\u0442\u043C\u0435\u043D\u0430</button><button class="primary">\u0412\u0435\u0440\u043D\u0443\u0442\u044C \u043D\u0430 \u0441\u043A\u043B\u0430\u0434</button></div></form>';
      document.body.append(dialog);
      dialog.showModal();
      dialog.onclose = () => dialog.remove();
      dialog.querySelector("[data-cancel]").onclick = () => dialog.close();
      let pending2 = null;
      dialog.querySelector("form").onsubmit = async (e) => {
        e.preventDefault();
        const submit = dialog.querySelector(".primary"), input = dialog.querySelector("input");
        if (submit.disabled) return;
        pending2 = pending2 || { request_id, master_id: x.master_id, part_id: x.part_id, quantity: Number(input.value) };
        submit.disabled = true;
        input.disabled = true;
        try {
          await call("master_return", pending2);
          dialog.close();
          await holdings();
          message("\u0414\u0435\u0442\u0430\u043B\u044C \u0432\u043E\u0437\u0432\u0440\u0430\u0449\u0435\u043D\u0430 \u043D\u0430 \u0441\u043A\u043B\u0430\u0434. \u0417\u0430\u043F\u0430\u0441 \u043C\u0430\u0441\u0442\u0435\u0440\u0430 \u0443\u043C\u0435\u043D\u044C\u0448\u0435\u043D.");
        } catch (error) {
          dialog.querySelector("[role=alert]").textContent = error.message;
          submit.disabled = false;
        }
      };
    });
  }
  var lastDeviceStatus = 0;
  var nativeUpdatePending = false;
  async function desktopStatus() {
    var _a3, _b, _c, _d, _e, _f, _g, _h, _i, _j;
    const el = $("desktop-status");
    if (!el) return;
    if (((_a3 = window.fastgoInstalledApp) == null ? void 0 : _a3.platform) === "ios") {
      el.textContent = "FastGo \u0434\u043B\u044F iPhone \xB7 " + window.fastgoInstalledApp.version;
      return;
    }
    if (!((_b = window.warehouseDesktop) == null ? void 0 : _b.desktopStatus)) {
      el.textContent = window.warehouseDesktop ? "USB: \u043E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \xAB\u0421\u043A\u0430\u043D\u0435\u0440 \u043F\u043E USB\xBB \u0434\u043B\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F." : "\u041E\u0442\u043A\u0440\u044B\u0442\u0430 \u0432\u0435\u0431-\u0432\u0435\u0440\u0441\u0438\u044F. \u0414\u043B\u044F USB \u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0435 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0443 FastGo \u0421\u043A\u043B\u0430\u0434 \u043D\u0430 Windows.";
      return;
    }
    try {
      const s = await window.warehouseDesktop.desktopStatus(), update = s.update || {};
      nativeUpdatePending = ["ready", "preparing", "installing"].includes(update.status);
      if (device && userId() && Date.now() - lastDeviceStatus > 6e4) {
        lastDeviceStatus = Date.now();
        const printing = await ((_d = (_c = window.warehouseDesktop).printers) == null ? void 0 : _d.call(_c).catch(() => null)), scanner = await ((_f = (_e = window.warehouseDesktop).scannerStatus) == null ? void 0 : _f.call(_e).catch(() => null));
        void call("device_status", { app: window.fastgoDesktop ? "desktop" : "warehouse", version: s.version, host: s.host, background: s.background, update_status: update.status, latest_version: update.version, blocking_reason: update.waitReason, network: s.network, printing, scanner, scan_test: scannerTest }).catch(() => {
        });
      }
      let note = "";
      if (update.status === "downloading") note = " \xB7 \u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u0442\u0441\u044F " + update.version + ": " + update.progress + "%";
      if (update.status === "ready") note = " \xB7 \u041E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435 " + update.version + " \u0433\u043E\u0442\u043E\u0432\u043E \u2014 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u0441\u0430\u043C\u043E \u043F\u0435\u0440\u0435\u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0441\u044F \u043F\u043E\u0441\u043B\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u044F \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430";
      if (update.status === "error") note = " \xB7 \u041E\u0448\u0438\u0431\u043A\u0430 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F: " + update.error;
      if ((_g = s.terminalUpdate) == null ? void 0 : _g.message) note += " \xB7 \u0422\u0421\u0414: " + s.terminalUpdate.message;
      if (((_h = s.recovery) == null ? void 0 : _h.status) === "current") note += " \xB7 \u041A\u043E\u043F\u0438\u044F \u0431\u0430\u0437\u044B: " + s.recovery.media_present + "/" + s.recovery.media_expected + " \u0444\u0430\u0439\u043B\u043E\u0432";
      else if (((_i = s.recovery) == null ? void 0 : _i.status) === "copying") note += " \xB7 \u041A\u043E\u043F\u0438\u0440\u0443\u0435\u043C \u0431\u0430\u0437\u0443: " + s.recovery.media_present + "/" + s.recovery.media_expected + " \u0444\u0430\u0439\u043B\u043E\u0432";
      else if (((_j = s.recovery) == null ? void 0 : _j.status) === "error") note += " \xB7 \u0420\u0435\u0437\u0435\u0440\u0432\u043D\u0430\u044F \u043A\u043E\u043F\u0438\u044F: " + s.recovery.error;
      const value = "Windows " + s.version + " \xB7 " + s.usb.status + (s.usb.pending ? " \xB7 \u041E\u0436\u0438\u0434\u0430\u044E\u0442 \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0438\u044F: " + s.usb.pending : "") + note;
      if (el.textContent !== value) el.textContent = value;
    } catch (e) {
      el.textContent = "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C USB: " + e.message;
    }
  }
  if (!terminal) {
    void desktopStatus();
    setInterval(desktopStatus, 2500);
  }
  if ($("usb-scanner")) $("usb-scanner").onclick = () => {
    var _a3;
    if ((_a3 = window.warehouseDesktop) == null ? void 0 : _a3.openUSBScanner) void window.warehouseDesktop.openUSBScanner().catch((e) => message(e.message, true));
    else message("\u0421\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u043F\u043E USB \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E \u0432 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u043E\u0439 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0435 FastGo \u0421\u043A\u043B\u0430\u0434 \u0432\u0435\u0440\u0441\u0438\u0438 1.0.4 \u0438 \u043D\u043E\u0432\u0435\u0435.");
  };
  if ($("terminal-update")) $("terminal-update").onclick = async () => {
    var _a3;
    try {
      if ((_a3 = window.warehouseDesktop) == null ? void 0 : _a3.openTerminalUpdater) await window.warehouseDesktop.openTerminalUpdater();
      else $("terminal-help").showModal();
    } catch (e) {
      message("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0442\u043A\u0440\u044B\u0442\u044C \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435 \u0442\u0435\u0440\u043C\u0438\u043D\u0430\u043B\u0430: " + e.message, true);
    }
  };
  if ($("terminal-help")) $("terminal-help").onclick = (e) => {
    if (e.target !== e.currentTarget) return;
    const r = e.currentTarget.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) e.currentTarget.close();
  };
  $("logout").onclick = () => run(async () => {
    if ((draft || job) && !confirm("\u0414\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D. \u0412\u044B\u0439\u0442\u0438?")) return;
    await logout();
    device = null;
    parts = [];
    staff = [];
    draft = null;
    job = null;
    signIn();
  });
  setInterval(() => void poll(), 1e3);
  window.addEventListener("online", () => {
    if (terminal && screen === "connection") void run(start);
    else void poll();
  });
  void start();
  var webSafe = (immediate = false) => !polling && window.warehouseUpdateSafe(immediate);
  var webUpdater = window.warehouseDesktop || window.fastgoInstalledApp ? null : startWebUpdates({ canApply: async (immediate) => {
    var _a3, _b, _c, _d;
    if (!webSafe(immediate)) return false;
    if ((_a3 = window.warehouseDesktop) == null ? void 0 : _a3.desktopStatus) {
      const state = await window.warehouseDesktop.desktopStatus();
      if (((_b = state.usb) == null ? void 0 : _b.pending) || ((_c = state.usb) == null ? void 0 : _c.target) || ["downloading", "ready", "preparing", "installing"].includes((_d = state.update) == null ? void 0 : _d.status)) return false;
    }
    return webSafe(immediate);
  } });
  var updating = false;
  async function updateNow() {
    var _a3, _b;
    if (updating) return;
    updating = true;
    try {
      live.checkpoint();
      message("\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0432\u0435\u0440\u0441\u0438\u0438 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u044F\u2026");
      if ((_a3 = window.fastgoDesktop) == null ? void 0 : _a3.updateNow) {
        await window.fastgoDesktop.updateNow();
        await desktopStatus();
        return;
      }
      if ((_b = window.warehouseDesktop) == null ? void 0 : _b.checkUpdates) {
        const state = await window.warehouseDesktop.checkUpdates();
        await desktopStatus();
        if (["downloading", "ready", "preparing", "installing"].includes(state == null ? void 0 : state.status)) {
          message("\u041E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435 " + state.version + " \u0431\u0443\u0434\u0435\u0442 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E \u0441\u0440\u0430\u0437\u0443 \u043F\u043E\u0441\u043B\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438, \u043A\u043E\u0433\u0434\u0430 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u044B \u0437\u0430\u043A\u0440\u044B\u0442\u044B \u0438 USB \u0441\u0432\u043E\u0431\u043E\u0434\u0435\u043D.");
          return;
        }
        if ((state == null ? void 0 : state.status) === "error") {
          message("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435: " + state.error, true);
          return;
        }
      }
      await (webUpdater == null ? void 0 : webUpdater.now());
      message(window.warehouseUpdateSafe(true) ? "" : "\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u0430. \u041E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435 \u043F\u0440\u0438\u043C\u0435\u043D\u0438\u0442\u0441\u044F \u043F\u043E\u0441\u043B\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u044F \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430 \u043D\u0430 \u0433\u043B\u0430\u0432\u043D\u043E\u043C \u044D\u043A\u0440\u0430\u043D\u0435; \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D.");
    } catch (e) {
      message("\u041E\u0448\u0438\u0431\u043A\u0430 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F: " + e.message, true);
    } finally {
      updating = false;
    }
  }
  window.warehouseRequestUpdate = () => void updateNow();
  if ($("warehouse-update-now")) $("warehouse-update-now").onclick = () => void updateNow();
  window.fastgoWarehouseCanLeave = () => {
    var _a3, _b, _c;
    return !((_a3 = window.fastgoServiceCatalogDirty) == null ? void 0 : _a3.call(window)) && !((_c = (_b = load("manual-service-payment")) == null ? void 0 : _b.items) == null ? void 0 : _c.length) && !busy && !job && !live.hasDraft() && !draft && !document.querySelector("dialog[open]");
  };
  window.fastgoWarehouseOpenMode = async (kind) => {
    if (!["receipt", "sale"].includes(kind) || !window.fastgoWarehouseCanLeave() && !live.canUSB(kind)) return false;
    if (!live.active() || live.kind() !== kind) await live.open(kind);
    return true;
  };
  if (window.fastgoDesktop) {
    window.fastgoHasUnsavedChanges = () => !window.fastgoWarehouseCanLeave();
    window.fastgoUpdateBlockReason = (immediate) => {
      var _a3;
      return ((_a3 = window.warehouseUpdateSafe) == null ? void 0 : _a3.call(window, immediate)) ? "" : "\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u0435 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u0441\u043A\u043B\u0430\u0434\u0430";
    };
    window.fastgoLockForUpdate = (immediate) => {
      var _a3;
      if (!((_a3 = window.warehouseUpdateSafe) == null ? void 0 : _a3.call(window, immediate))) return false;
      document.body.inert = true;
      return true;
    };
    window.fastgoReleaseUpdateLock = () => {
      document.body.inert = false;
    };
  }
  window.addEventListener("keydown", (e) => {
    if (e.key === "F5" || (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r") {
      e.preventDefault();
      void updateNow();
    }
  }, true);
  if ($("screen-refresh")) $("screen-refresh").onclick = updateNow;
  if ($("terminal-refresh")) $("terminal-refresh").onclick = updateNow;
  var usbPolling = false;
  var usbRetryAfter = 0;
  async function pollUSB() {
    const bridge = window.warehouseDesktop;
    if (terminal || !device || !(bridge == null ? void 0 : bridge.usbInbox) || usbPolling || nativeUpdatePending || Date.now() < usbRetryAfter || busy || !["home", "live"].includes(screen)) return;
    usbPolling = true;
    try {
      const inbox = await bridge.usbInbox();
      for (const item of inbox.items) {
        if (busy || !["home", "live"].includes(screen)) break;
        if (!item.kind) continue;
        const problem = scanError(item.kind, item.code);
        if (problem) {
          await bridge.usbResult(item.id, { error: problem });
          continue;
        }
        if (item.kind === "repair") {
          if (!["home", "live"].includes(screen) || live.hasDraft()) break;
          try {
            const quote = await call("repair_quote", { code: item.code });
            await repair.station(quote, item.id);
            await bridge.usbResult(item.id, { name: "\u0420\u0435\u043C\u043E\u043D\u0442 \u2116 " + quote.number, price: quote.due });
          } catch (error) {
            usbRetryAfter = Date.now() + 5e3;
            await bridge.usbResult(item.id, { error: error.message, retry: !error.status || error.status >= 500 });
          }
          break;
        }
        if (!live.canUSB(item.kind)) break;
        try {
          const result = await live.acceptUSB(item);
          await bridge.usbResult(item.id, result);
        } catch (e) {
          usbRetryAfter = Date.now() + 5e3;
          await bridge.usbResult(item.id, { error: e.message, retry: !e.rejected });
          message(e.message, true);
          break;
        }
      }
    } catch (e) {
      usbRetryAfter = Date.now() + 5e3;
      message(e.message, true);
    } finally {
      usbPolling = false;
    }
  }
  setInterval(() => void pollUSB(), 400);
  setInterval(() => {
    if (!terminal && screen === "home" && !busy) void unknown.poll();
  }, 3e3);
  var _a2;
  (_a2 = document.querySelector(".warehouse-sidebar")) == null ? void 0 : _a2.addEventListener("click", (e) => {
    var _a3;
    if ((_a3 = window.fastgoServiceCatalogDirty) == null ? void 0 : _a3.call(window)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      message("\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0438\u043B\u0438 \u043E\u0442\u043C\u0435\u043D\u0438\u0442\u0435 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435 \u043F\u0440\u0430\u0439\u0441\u0430", true);
    }
  }, { capture: true });
})();
