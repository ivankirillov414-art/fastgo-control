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
      for (let key2 of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key2) && key2 !== except)
          __defProp(to, key2, { get: () => from[key2], enumerable: !(desc = __getOwnPropDesc(from, key2)) || desc.enumerable });
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
    const j = await r.json();
    if (!r.ok) throw Object.assign(Error(j.error || j.error_description || j.message || "\u041E\u0448\u0438\u0431\u043A\u0430 \u0441\u0435\u0440\u0432\u0438\u0441\u0430"), { status: r.status });
    return j;
  }
  function save(j) {
    var _a;
    session = { access_token: j.access_token, refresh_token: j.refresh_token, user_id: ((_a = j.user) == null ? void 0 : _a.id) || (session == null ? void 0 : session.user_id), expires_at: j.expires_at || Math.floor(Date.now() / 1e3) + j.expires_in };
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
  var serviceActions = /* @__PURE__ */ new Set(["catalog", "me", "part_save", "stock", "part_photos", "part_photo_url", "part_photo_upload", "part_photo_primary"]);
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
      const operation = action.slice(8);
      if (!serviceActions.has(operation)) throw Error("\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u044F \u043A\u0430\u0442\u0430\u043B\u043E\u0433\u0430");
      return (await request("/functions/v1/fastgo-workshop-api", { action: operation, params }, session.access_token)).data;
    }
    return (await request("/functions/v1/fastgo-warehouse", { ...params, action }, session.access_token)).data;
  }
  var uuid = () => crypto.randomUUID ? crypto.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (Number(c) ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> Number(c) / 4).toString(16));
  function matchBarcode(parts2, value) {
    const code = String(value).trim().toUpperCase();
    return parts2.filter((x) => String(x.barcode || "").toUpperCase() === code || String(x.sku || "").toUpperCase() === code || x.id.toUpperCase() === code);
  }

  // warehouse/unknown-scans.js
  function unknownScans({ call: call2, parts: parts2, refresh, run: run2, owner, message: message2 }) {
    let loading = false;
    async function poll2() {
      const host = document.getElementById("unknown-scans");
      if (!host || loading) return;
      loading = true;
      try {
        const rows = await call2("unknown_scans");
        if (!host.isConnected) return;
        host.innerHTML = rows.length ? "<h2>\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0435 \u043A\u043E\u0434\u044B \u0441 \u0422\u0421\u0414</h2>" + rows.map((x) => '<button data-unknown="' + esc(x.id) + '">' + esc(x.payload.code) + " \xB7 " + (x.payload.document_kind === "receipt" ? "\u041F\u0440\u0438\u0445\u043E\u0434" : "\u041F\u0440\u043E\u0434\u0430\u0436\u0430") + "</button>").join("") : "";
        host.querySelectorAll("[data-unknown]").forEach((b) => b.onclick = () => open(rows.find((x) => x.id === b.dataset.unknown)));
      } catch (e) {
        if (host.isConnected) host.textContent = "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0435 \u043A\u043E\u0434\u044B: " + e.message;
      } finally {
        loading = false;
      }
    }
    function open(row) {
      var _a, _b, _c, _d, _e, _f, _g;
      const dialog = document.createElement("dialog");
      dialog.className = "unknown-dialog";
      const creating = !!row.checkout;
      dialog.innerHTML = "<h2>\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 \u043A\u043E\u0434</h2><p>" + esc(row.payload.code) + '</p><form><label>\u041D\u0430\u0439\u0442\u0438 \u0442\u043E\u0432\u0430\u0440<input id="unknown-filter" placeholder="\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0438\u043B\u0438 \u0430\u0440\u0442\u0438\u043A\u0443\u043B"></label><label>\u0421\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0430\u044F \u043F\u043E\u0437\u0438\u0446\u0438\u044F<select id="unknown-part"><option value="">\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0442\u043E\u0432\u0430\u0440</option></select></label><button class="primary" type="submit">\u0421\u0432\u044F\u0437\u0430\u0442\u044C \u0441 \u0442\u043E\u0432\u0430\u0440\u043E\u043C</button></form>' + (owner() ? "<details " + (creating ? "open" : "") + '><summary>\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043D\u043E\u0432\u0443\u044E \u043F\u043E\u0437\u0438\u0446\u0438\u044E</summary><form id="unknown-create"><label>\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435<input name="name" required value="' + esc(((_b = (_a = row.checkout) == null ? void 0 : _a.create) == null ? void 0 : _b.name) || "") + '"></label><label>\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F<input name="category" required value="' + esc(((_d = (_c = row.checkout) == null ? void 0 : _c.create) == null ? void 0 : _d.category) || "") + '"></label><label>\u0426\u0435\u043D\u0430, \u20BD<input name="retail_price" type="number" min="0" max="100000000" step="0.01" required value="' + esc((_g = (_f = (_e = row.checkout) == null ? void 0 : _e.create) == null ? void 0 : _f.retail_price) != null ? _g : "") + '"></label><button class="primary">\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u0438 \u0441\u0432\u044F\u0437\u0430\u0442\u044C</button></form></details>' : "") + '<p class="error" role="status"></p><button data-close>\u0417\u0430\u043A\u0440\u044B\u0442\u044C</button>';
      document.body.append(dialog);
      dialog.showModal();
      dialog.querySelector("[data-close]").onclick = () => dialog.close();
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

  // warehouse/barcode-print.js
  function printBarcode(part) {
    const dialog = document.createElement("dialog");
    dialog.setAttribute("aria-label", "\u041F\u0435\u0447\u0430\u0442\u044C \u0448\u0442\u0440\u0438\u0445\u043A\u043E\u0434\u043E\u0432");
    dialog.className = "barcode-print-dialog";
    dialog.innerHTML = "<form><h2>\u041F\u0435\u0447\u0430\u0442\u044C \u0448\u0442\u0440\u0438\u0445\u043A\u043E\u0434\u043E\u0432</h2><p>" + esc(part.name) + '</p><label>\u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u044D\u0442\u0438\u043A\u0435\u0442\u043E\u043A<input name="quantity" type="number" min="1" max="1000" step="1" value="1" required></label><label>\u0424\u043E\u0440\u043C\u0430\u0442<select name="format"><option value="label">\u042D\u0442\u0438\u043A\u0435\u0442\u043A\u0430 58 \xD7 30 \u043C\u043C</option><option value="a4">\u041B\u0438\u0441\u0442 A4</option></select></label><p role="alert" class="error"></p><div class="actions"><button type="button" data-close>\u041E\u0442\u043C\u0435\u043D\u0430</button><button type="submit" class="primary">\u041F\u0435\u0447\u0430\u0442\u044C</button></div></form>';
    document.body.append(dialog);
    dialog.showModal();
    dialog.onclose = () => dialog.remove();
    dialog.querySelector("[data-close]").onclick = () => dialog.close();
    dialog.querySelector("input").focus();
    dialog.querySelector("input").select();
    dialog.querySelector("form").onsubmit = async (event) => {
      var _a;
      event.preventDefault();
      const button = dialog.querySelector("[type=submit]"), quantity = Number(dialog.querySelector("input").value), format = dialog.querySelector("select").value;
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1e3) return;
      try {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        window.JsBarcode(svg, String(part.barcode), { format: "CODE128", displayValue: false, width: 2, height: 72, margin: 8, background: "#ffffff", lineColor: "#000000" });
        const payload = { name: part.name, barcode: String(part.barcode), svg: svg.outerHTML, quantity, format };
        if ((_a = window.warehouseDesktop) == null ? void 0 : _a.printBarcode) {
          button.disabled = true;
          await window.warehouseDesktop.printBarcode(payload);
          dialog.close();
          return;
        }
        const label = '<section class="label"><strong>' + esc(part.name) + "</strong>" + svg.outerHTML + "<small>" + esc(part.barcode) + "</small></section>", frame = document.createElement("iframe");
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
    return '<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>\u042D\u0442\u0438\u043A\u0435\u0442\u043A\u0438 FastGo</title><style>@page{size:' + (format === "a4" ? "A4;margin:10mm" : "58mm 30mm;margin:0") + "}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:black;background:white;" + (format === "a4" ? "display:grid;grid-template-columns:repeat(3,58mm);grid-auto-rows:30mm;gap:2mm;" : "") + "}.label{width:58mm;height:30mm;padding:2mm;display:flex;flex-direction:column;justify-content:center;align-items:center;overflow:hidden;break-inside:avoid;" + (format === "a4" ? "" : "break-after:page;") + "}.label:last-child{break-after:auto}strong{font-size:9pt;line-height:1.1;max-height:8mm;overflow:hidden;text-align:center}small{font-size:7pt}svg{width:54mm;height:15mm;flex-shrink:0}</style></head><body>" + label.repeat(quantity) + "</body></html>";
  }

  // warehouse/product-panel.js
  var pencil = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m15 4 5 5M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z"/></svg>';
  function productPanel({ parts: parts2, editable, call: call2, run: run2, changed, message: message2, photos: photos2 }) {
    let dialog, selected, editing = "", pending, stopPhotos;
    function close() {
      if ((dialog == null ? void 0 : dialog.dataset.uploading) === "true") return;
      stopPhotos == null ? void 0 : stopPhotos();
      stopPhotos = null;
      if (dialog == null ? void 0 : dialog.open) dialog.close();
      dialog == null ? void 0 : dialog.remove();
      dialog = null;
      selected = null;
      editing = "";
      pending = null;
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
      return '<section class="product-metric" data-metric="' + field + '"><div class="metric-label">' + label + (editable() ? '<button type="button" class="pencil" data-edit="' + field + '" aria-label="\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C ' + (field === "quantity" ? "\u043E\u0441\u0442\u0430\u0442\u043E\u043A" : "\u0446\u0435\u043D\u0443") + '">' + pencil + "</button>" : "") + "</div><strong>" + value + "</strong><div data-editor></div></section>";
    }
    function draw() {
      if (!dialog || !selected) return;
      dialog.innerHTML = '<button class="product-close" type="button" data-close aria-label="\u0417\u0430\u043A\u0440\u044B\u0442\u044C \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0443">\xD7</button><div class="product-main"><h2>' + esc(selected.name) + '</h2><div class="product-metrics">' + metric("quantity", "\u041E\u0441\u0442\u0430\u0442\u043E\u043A", selected.quantity + " <span>\u0448\u0442.</span>") + metric("retail_price", "\u0426\u0435\u043D\u0430", money(selected.retail_price)) + '</div><div class="product-sku"><span>\u0410\u0440\u0442\u0438\u043A\u0443\u043B</span><b>' + esc(selected.sku || "\u041D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D") + '</b></div></div><div class="product-barcode"><span>\u0428\u0442\u0440\u0438\u0445\u043A\u043E\u0434</span>' + (selected.barcode ? '<svg id="product-barcode" role="img" aria-label="\u0428\u0442\u0440\u0438\u0445\u043A\u043E\u0434 ' + esc(selected.barcode) + '"></svg>' : "<p>\u041D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D</p>") + "<b>" + esc(selected.barcode || "") + "</b>" + (selected.barcode ? '<button type="button" class="primary" data-print-barcode>\u041F\u0435\u0447\u0430\u0442\u044C \u0448\u0442\u0440\u0438\u0445\u043A\u043E\u0434\u043E\u0432</button>' : "") + '</div><p class="product-error" role="alert"></p>';
      stopPhotos == null ? void 0 : stopPhotos();
      const gallery = document.createElement("section");
      gallery.className = "product-photos";
      dialog.querySelector(".product-error").before(gallery);
      stopPhotos = photos2 == null ? void 0 : photos2.mount(gallery, selected);
      if (dialog.querySelector("[data-print-barcode]")) dialog.querySelector("[data-print-barcode]").onclick = () => printBarcode(selected);
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
      editing = field;
      pending = null;
      draw();
      const host = dialog.querySelector('[data-metric="' + field + '"] [data-editor]');
      host.innerHTML = '<form class="metric-editor"><label>' + (field === "quantity" ? "\u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E, \u0448\u0442." : "\u0426\u0435\u043D\u0430, \u20BD") + '<input type="number" min="0" max="' + (field === "quantity" ? "1000000" : "100000000") + '" step="' + (field === "quantity" ? "1" : "0.01") + '" value="' + selected[field] + '" required aria-label="' + (field === "quantity" ? "\u041D\u043E\u0432\u044B\u0439 \u043E\u0441\u0442\u0430\u0442\u043E\u043A" : "\u041D\u043E\u0432\u0430\u044F \u0446\u0435\u043D\u0430") + '"></label><div><button class="primary" type="submit">\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C</button><button type="button" data-cancel>\u041E\u0442\u043C\u0435\u043D\u0430</button></div></form>';
      const input = host.querySelector("input");
      input.focus();
      input.select();
      host.querySelector("[data-cancel]").onclick = () => {
        editing = "";
        pending = null;
        draw();
      };
      host.querySelector("form").onsubmit = (e) => {
        e.preventDefault();
        const part = selected, value = Number(input.value), field2 = editing;
        if (input.value.trim() === "" || !Number.isFinite(value) || value < 0 || field2 === "quantity" && !Number.isInteger(value) || field2 === "retail_price" && Math.abs(value * 100 - Math.round(value * 100)) > 1e-5) {
          dialog.querySelector(".product-error").textContent = "\u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435";
          return;
        }
        if (!pending || pending.value !== value) pending = { request_id: uuid(), part_id: part.id, field: field2, value, expected: part[field2] };
        const payload = { ...pending };
        void run2(async () => {
          input.disabled = true;
          dialog.querySelector(".product-error").textContent = "\u0421\u043E\u0445\u0440\u0430\u043D\u044F\u0435\u043C\u2026";
          try {
            const updated = await call2("inventory_edit", payload);
            const index = parts2().findIndex((x) => x.id === updated.id);
            if (index >= 0) parts2()[index] = updated;
            selected = updated;
            editing = "";
            pending = null;
            changed();
            draw();
            message2("\u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E \u0432 \u043E\u0431\u0449\u0435\u0439 \u0431\u0430\u0437\u0435");
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

  // workshop/private-photo.js
  function displayPrivatePhoto(img, { getUrl, url, isCurrent = () => img.isConnected, onLoad = () => {
  }, onError = () => {
  } }) {
    let retries = 0, stopped = false, refreshing2 = false;
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
        const next = await getUrl();
        if (!next) throw new Error("Missing photo URL");
        if (current()) img.src = next;
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
    if (url) img.src = url;
    else refresh();
    return () => {
      stopped = true;
      img.onload = img.onerror = null;
    };
  }

  // warehouse/part-photos.js
  function partPhotos({ api: api2, editable, run: run2, changed, message: message2 }) {
    let observer;
    const placeholder = '<span aria-hidden="true">\u25A7</span>';
    function thumbnail(part) {
      return '<span class="inventory-photo" data-photo="' + esc(part.id) + '">' + (part.primary_photo_path ? '<img alt="\u0424\u043E\u0442\u043E: ' + esc(part.name) + '">' : placeholder) + "</span>";
    }
    function bindThumbnails(host, parts2) {
      observer == null ? void 0 : observer.disconnect();
      const load2 = (el) => {
        const part = parts2.find((p) => p.id === el.dataset.photo), img = el.querySelector("img");
        if (!img || !part) return;
        displayPrivatePhoto(img, { getUrl: async () => (await api2("part_photo_url", { part_id: part.id })).url, onError: () => {
          if (el.isConnected) {
            el.innerHTML = placeholder;
            el.title = "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0444\u043E\u0442\u043E. \u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0443 \u0434\u043B\u044F \u043F\u043E\u0432\u0442\u043E\u0440\u0430.";
          }
        } });
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
      let pending = null, saving = false, stopped = false;
      const cleanups = [];
      host.innerHTML = '<div class="product-photo-heading"><h3>\u0424\u043E\u0442\u043E\u0433\u0440\u0430\u0444\u0438\u0438</h3>' + (editable() ? '<label class="photo-upload-button">\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0444\u043E\u0442\u043E\u0433\u0440\u0430\u0444\u0438\u044E<input type="file" accept="image/jpeg,image/png,image/webp" aria-label="\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0444\u043E\u0442\u043E\u0433\u0440\u0430\u0444\u0438\u044E \u0437\u0430\u043F\u0447\u0430\u0441\u0442\u0438"></label>' : "") + '</div><div class="product-photo-gallery">\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u0444\u043E\u0442\u043E\u0433\u0440\u0430\u0444\u0438\u0438\u2026</div><p class="photo-status" role="status" aria-live="polite"></p><button type="button" class="photo-retry" hidden>\u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0443</button>';
      const gallery = host.querySelector(".product-photo-gallery"), status = host.querySelector(".photo-status"), input = host.querySelector("input"), retry = host.querySelector(".photo-retry");
      const current = () => !stopped && host.isConnected;
      const busy2 = (value) => {
        saving = value;
        host.closest("dialog").dataset.uploading = String(value);
        if (input) input.disabled = value;
        gallery.querySelectorAll("button").forEach((b) => b.disabled = value || b.dataset.unavailable === "true");
        retry.disabled = value;
      };
      async function save3() {
        if (saving || !pending) return;
        await run2(async () => {
          busy2(true);
          retry.hidden = true;
          try {
            if (pending.file) await upload(part, pending.file, pending.id, false, (text) => {
              if (current()) status.textContent = text;
            });
            else {
              status.textContent = "\u0421\u043E\u0445\u0440\u0430\u043D\u044F\u0435\u043C \u043E\u0441\u043D\u043E\u0432\u043D\u0443\u044E \u0444\u043E\u0442\u043E\u0433\u0440\u0430\u0444\u0438\u044E\u2026";
              const result = await api2("part_photo_primary", { part_id: part.id, photo_id: pending.photo.id, request_id: pending.id });
              part.primary_photo_path = result.path;
            }
            pending = null;
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
        try {
          const photos2 = await api2("part_photos", { part_id: part.id });
          if (!current()) return;
          cleanups.splice(0).forEach((stop) => stop());
          gallery.textContent = photos2.length ? "" : "\u0424\u043E\u0442\u043E\u0433\u0440\u0430\u0444\u0438\u0439 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442";
          for (const photo of photos2) {
            const card = document.createElement("div");
            card.className = "product-photo-card";
            card.innerHTML = '<img alt="' + esc(part.name) + '">' + (editable() ? '<button type="button" ' + (photo.primary ? "disabled" : "") + ">" + (photo.primary ? "\u041E\u0441\u043D\u043E\u0432\u043D\u043E\u0435 \u0444\u043E\u0442\u043E" : "\u0421\u0434\u0435\u043B\u0430\u0442\u044C \u043E\u0441\u043D\u043E\u0432\u043D\u044B\u043C") + "</button>" : "");
            gallery.append(card);
            cleanups.push(displayPrivatePhoto(card.querySelector("img"), { isCurrent: () => current() && card.isConnected, getUrl: async () => (await api2("part_photo_url", { part_id: part.id, photo_id: photo.id })).url, onError: () => {
              card.querySelector("img").alt = "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0444\u043E\u0442\u043E";
            } }));
            const choose = card.querySelector("button");
            if (choose) {
              choose.dataset.unavailable = String(!!photo.primary);
              choose.onclick = () => {
                pending = { photo, id: uuid() };
                void save3();
              };
            }
          }
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
          pending = { file, id: uuid() };
          void save3();
        }
      };
      retry.onclick = () => void save3();
      void load2();
      return () => {
        stopped = true;
        cleanups.forEach((stop) => stop());
      };
    }
    return { thumbnail, bindThumbnails, mount, upload };
  }

  // workshop/product-intake.js
  var keyFor = (actor) => "fastgo_product_intake_v1:" + actor;
  var write = (storage, key2, value) => {
    const encoded = JSON.stringify(value);
    storage.setItem(key2, encoded);
    if (storage.getItem(key2) !== encoded) throw new Error("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0445\u043E\u0434 \u043F\u0440\u0438\u0451\u043C\u043A\u0438 \u0432 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0435.");
  };
  function loadProductIntake(storage, actor) {
    var _a, _b, _c;
    const raw = storage.getItem(keyFor(actor));
    if (!raw) return null;
    let value;
    try {
      value = JSON.parse(raw);
    } catch (e) {
      throw new Error("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C \u043D\u0435\u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043D\u043D\u0443\u044E \u043F\u0440\u0438\u0451\u043C\u043A\u0443. \u041D\u0435 \u0441\u043E\u0437\u0434\u0430\u0432\u0430\u0439\u0442\u0435 \u0435\u0451 \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u043E; \u0441\u0432\u0435\u0440\u044C\u0442\u0435 \u0441\u043A\u043B\u0430\u0434.");
    }
    if (value.version !== 1 || !value.product || !((_a = value.ids) == null ? void 0 : _a.product) || !((_b = value.ids) == null ? void 0 : _b.stock) || !((_c = value.ids) == null ? void 0 : _c.photo)) throw new Error("\u041D\u0435\u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043D\u043D\u0430\u044F \u043F\u0440\u0438\u0451\u043C\u043A\u0430 \u0442\u0440\u0435\u0431\u0443\u0435\u0442 \u0441\u0432\u0435\u0440\u043A\u0438 \u0441\u043A\u043B\u0430\u0434\u0430.");
    return value;
  }
  function startProductIntake(storage, actor, { product: product2, quantity, photo = null }) {
    const existing = loadProductIntake(storage, actor);
    if (existing) return existing;
    if (!String(product2.name || "").trim() || !String(product2.category || "").trim() || !Number.isInteger(quantity) || quantity < 0 || quantity > 1e5) throw new Error("\u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u043D\u0430\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u0438\u0435, \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044E \u0438 \u043A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E (\u043E\u0442 0 \u0434\u043E 100000).");
    for (const name of ["unit_cost", "retail_price"]) if (!Number.isFinite(product2[name]) || product2[name] < 0 || product2[name] > 1e9) throw new Error("\u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0446\u0435\u043D\u0443 \u0442\u043E\u0432\u0430\u0440\u0430.");
    const state = { version: 1, product: product2, quantity, photo, ids: { product: crypto.randomUUID(), stock: crypto.randomUUID(), photo: crypto.randomUUID() }, part: null, received: false, photoSaved: false };
    write(storage, keyFor(actor), state);
    return state;
  }
  async function continueProductIntake(storage, actor, { api: api2, uploadPhoto, onProgress = () => {
  } }) {
    const key2 = keyFor(actor), state = loadProductIntake(storage, actor);
    if (!state) throw new Error("\u041D\u0435\u0442 \u043D\u0435\u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043D\u043D\u043E\u0439 \u043F\u0440\u0438\u0451\u043C\u043A\u0438.");
    if (!state.part) {
      onProgress("\u0421\u043E\u0445\u0440\u0430\u043D\u044F\u0435\u043C \u0442\u043E\u0432\u0430\u0440\u2026");
      try {
        state.part = await api2("part_save", { ...state.product, request_id: state.ids.product });
      } catch (error) {
        if ([400, 403, 404, 409, 413, 422].includes(error.status)) storage.removeItem(key2);
        throw error;
      }
      write(storage, key2, state);
    }
    if (state.quantity > 0 && !state.received) {
      onProgress("\u0422\u043E\u0432\u0430\u0440 \u0441\u043E\u0437\u0434\u0430\u043D. \u0417\u0430\u043F\u0438\u0441\u044B\u0432\u0430\u0435\u043C \u043F\u0440\u0438\u0445\u043E\u0434\u2026");
      await api2("stock", { part_id: state.part.id, movement_type: "receipt", quantity: state.quantity, note: "\u041F\u0435\u0440\u0432\u0438\u0447\u043D\u0430\u044F \u0440\u0443\u0447\u043D\u0430\u044F \u043F\u0440\u0438\u0451\u043C\u043A\u0430", request_id: state.ids.stock });
      state.received = true;
      write(storage, key2, state);
    }
    if (state.photo && !state.photoSaved) {
      onProgress("\u0422\u043E\u0432\u0430\u0440 \u0438 \u043F\u0440\u0438\u0445\u043E\u0434 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B. \u0421\u043E\u0445\u0440\u0430\u043D\u044F\u0435\u043C \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u043E\u0435 \u0444\u043E\u0442\u043E\u2026");
      await uploadPhoto(state.part, state.photo, state.ids.photo);
      state.photoSaved = true;
      write(storage, key2, state);
    }
    storage.removeItem(key2);
    return state.part;
  }

  // warehouse/new-part.js
  function newPartForm({ actor, api: api2, photos: photos2, parts: parts2, canReceive, run: run2, refresh, openProduct, message: message2 }) {
    return function open() {
      const dialog = document.createElement("dialog");
      dialog.className = "new-part-dialog";
      dialog.setAttribute("aria-label", "\u041D\u043E\u0432\u0430\u044F \u0437\u0430\u043F\u0447\u0430\u0441\u0442\u044C");
      const categories = [...new Set(parts2().map((p) => p.category).filter(Boolean))].sort();
      dialog.innerHTML = '<form><h2>\u041D\u043E\u0432\u0430\u044F \u0437\u0430\u043F\u0447\u0430\u0441\u0442\u044C</h2><div class="new-part-fields"><label>\u041D\u0430\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u0438\u0435<input name="name" required maxlength="200"></label><label>\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F<input name="category" required maxlength="100" list="new-part-categories"><datalist id="new-part-categories">' + categories.map((c) => '<option value="' + esc(c) + '">').join("") + '</datalist></label><label>\u041C\u043E\u0434\u0435\u043B\u044C / \u0440\u0430\u0437\u043C\u0435\u0440<input name="model" maxlength="120"></label><label>\u0410\u0440\u0442\u0438\u043A\u0443\u043B / SKU<input name="sku" maxlength="100"></label><label>\u0417\u0430\u043A\u0443\u043F\u043A\u0430, \u20BD<input name="unit_cost" type="number" min="0" max="1000000000" step="0.01" value="0" required></label><label>\u041F\u0440\u043E\u0434\u0430\u0436\u0430, \u20BD<input name="retail_price" type="number" min="0" max="1000000000" step="0.01" value="0" required></label><label>\u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u043F\u0440\u0438 \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u0438<input name="initial_quantity" type="number" min="0" max="100000" step="1" value="0" ' + (canReceive() ? "" : "disabled") + '></label><label>\u0415\u0434\u0438\u043D\u0438\u0446\u0430 \u0438\u0437\u043C\u0435\u0440\u0435\u043D\u0438\u044F<input name="unit" value="\u0448\u0442" maxlength="20" required></label></div><p class="muted">\u0428\u0442\u0440\u0438\u0445\u043A\u043E\u0434 FastGo \u043F\u0440\u0438\u0441\u0432\u043E\u0438\u0442\u0441\u044F \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438.' + (canReceive() ? " \u041D\u0430\u0447\u0430\u043B\u044C\u043D\u043E\u0435 \u043A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u043E\u0444\u043E\u0440\u043C\u0438\u0442\u0441\u044F \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u043C \u043F\u0440\u0438\u0445\u043E\u0434\u043E\u043C." : " \u041F\u0440\u0438\u0445\u043E\u0434 \u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D \u043D\u0430 \u0434\u0432\u0443\u0445 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D\u043D\u044B\u0445 \u043D\u043E\u0443\u0442\u0431\u0443\u043A\u0430\u0445.") + '</p><label>\u0424\u043E\u0442\u043E\u0433\u0440\u0430\u0444\u0438\u044F \u0437\u0430\u043F\u0447\u0430\u0441\u0442\u0438<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"></label><img class="new-part-preview" alt="\u0412\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0435 \u0444\u043E\u0442\u043E" hidden><label class="new-part-category-photo"><input name="category_primary" type="checkbox"> \u0421\u0434\u0435\u043B\u0430\u0442\u044C \u0444\u043E\u0442\u043E \u043E\u0441\u043D\u043E\u0432\u043D\u044B\u043C \u0434\u043B\u044F \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438</label><p class="new-part-status" role="status" aria-live="polite"></p><div class="actions"><button type="button" data-close>\u0417\u0430\u043A\u0440\u044B\u0442\u044C</button><button class="primary" type="submit">\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u0437\u0430\u043F\u0447\u0430\u0441\u0442\u044C</button></div></form>';
      document.body.append(dialog);
      dialog.showModal();
      const form = dialog.querySelector("form"), submit = dialog.querySelector("[type=submit]"), status = dialog.querySelector("[role=status]"), close = dialog.querySelector("[data-close]"), fileInput = form.elements.photo;
      let preview = "", saving = false;
      const restore = () => {
        var _a;
        const state = loadProductIntake(localStorage, actor());
        if (!state) return null;
        for (const [name, value] of Object.entries({ ...state.product, initial_quantity: state.quantity })) {
          const input = form.elements.namedItem(name);
          if (input) {
            input.value = value;
            input.disabled = true;
          }
        }
        form.elements.category_primary.checked = !!((_a = state.photo) == null ? void 0 : _a.primary);
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
            await refresh();
            dialog.close();
            openProduct(parts2().find((p) => p.id === part.id) || part);
            message2("\u0417\u0430\u043F\u0447\u0430\u0441\u0442\u044C \u0441\u043E\u0437\u0434\u0430\u043D\u0430. " + (state.quantity > 0 ? "\u041F\u0440\u0438\u0445\u043E\u0434 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D. " : "") + (state.photo ? "\u0424\u043E\u0442\u043E\u0433\u0440\u0430\u0444\u0438\u044F \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0430." : ""));
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

  // warehouse/web-update.js
  var import_update_clock = __toESM(require_update_clock());
  function createWebUpdater({ version, fetchVersion, fetchPage, canApply, apply, notify = () => {
  } }) {
    let pending = null, checking = false, applying = false, immediate = false;
    async function tick() {
      if (!pending || applying) return;
      applying = true;
      try {
        if (!await canApply(immediate)) {
          notify("\u041E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435 \u044D\u043A\u0440\u0430\u043D\u0430 \u0433\u043E\u0442\u043E\u0432\u043E \xB7 \u043F\u0440\u0438\u043C\u0435\u043D\u0438\u0442\u0441\u044F \u043F\u043E\u0441\u043B\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u044F \u0440\u0430\u0431\u043E\u0442\u044B");
          return;
        }
        apply(pending);
        pending = null;
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
            pending = null;
            if (immediate) notify("\u0423\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0430 \u0430\u043A\u0442\u0443\u0430\u043B\u044C\u043D\u0430\u044F \u0432\u0435\u0440\u0441\u0438\u044F \u044D\u043A\u0440\u0430\u043D\u0430 \xB7 " + version);
            immediate = false;
          }
          return;
        }
        if (await fetchPage(next) !== next) {
          notify("\u041F\u0443\u0431\u043B\u0438\u043A\u0430\u0446\u0438\u044F \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F \u0435\u0449\u0451 \u0438\u0434\u0451\u0442. \u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0443 \u043F\u043E\u0437\u0436\u0435.");
          return;
        }
        pending = next;
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
    var _a;
    const version = (_a = document.querySelector('meta[name="warehouse-web-version"]')) == null ? void 0 : _a.content;
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
        var _a2;
        const u = new URL(location.href);
        u.searchParams.set("ui", next);
        const html = await (await get(u)).text();
        return (_a2 = new DOMParser().parseFromString(html, "text/html").querySelector('meta[name="warehouse-web-version"]')) == null ? void 0 : _a2.content;
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
    var _a;
    const cents = Math.round(base * 100);
    if (!edit) return cents / 100;
    const raw = String((_a = edit.value) != null ? _a : "").trim().replace(",", ".");
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
      var _a;
      if (!$2("total")) return;
      const edit = read(), value = total(), discount = (edit == null ? void 0 : edit.mode) === "discount";
      $2("total").textContent = value === null ? "\u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0441\u0443\u043C\u043C\u0443" : money2(value);
      $2("total-field").hidden = !edit || discount;
      $2("discount-field").hidden = !discount;
      $2("total-reset").hidden = !edit;
      for (const [name, v] of [["total-input", discount ? "" : (_a = edit == null ? void 0 : edit.value) != null ? _a : ""], ["discount-input", discount ? edit.value : ""], ["discount-unit", (edit == null ? void 0 : edit.unit) || "rub"]]) if (document.activeElement !== $2(name)) $2(name).value = v;
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
        var _a;
        if (locked()) return;
        update({ mode: "total", value: String((_a = total()) != null ? _a : base()) });
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
      let pending = load2(cacheKey);
      if (!pending || pending.repair_id !== q.id) {
        pending = { request_id: uuid(), repair_id: q.id };
        save3(cacheKey, pending);
      }
      const result = await call2("enqueue_repair", pending);
      return { pending, result };
    }
    async function terminal2(q) {
      render('<div class="live-heading"><button id="repair-back" aria-label="\u041D\u0430\u0437\u0430\u0434">\u2190</button><h1>\u041E\u043F\u043B\u0430\u0442\u0430</h1></div>' + summary(q) + '<p id="repair-status" role="status">\u041F\u0435\u0440\u0435\u0434\u0430\u0451\u043C \u043D\u0430 \u043D\u043E\u0443\u0442\u0431\u0443\u043A\u2026</p>');
      $2("repair-back").onclick = home2;
      let jobId = "", polling2 = false;
      async function poll2() {
        var _a;
        if (polling2 || !$2("repair-status")) return;
        polling2 = true;
        try {
          if (!jobId) {
            const { pending } = await enqueue(q);
            jobId = pending.request_id;
          }
          const r = await call2("job", { id: jobId });
          if (!$2("repair-status")) return;
          if ((r == null ? void 0 : r.state) === "done") {
            save3("repair:terminal", null);
            home2();
            message2(((_a = r.result) == null ? void 0 : _a.cancelled) ? "\u0421\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u043E\u043F\u043B\u0430\u0442\u044B \u043E\u0442\u043C\u0435\u043D\u0435\u043D\u043E" : "\u041E\u043F\u043B\u0430\u0442\u0430 \u043F\u0440\u0438\u043D\u044F\u0442\u0430");
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
      const { pending } = await enqueue(q, usbId);
      await checkout2(await call2("job", { id: pending.request_id }));
    }
    async function checkout2(job2) {
      var _a, _b;
      const latest = await call2("job", { id: job2.id });
      if (!latest) throw Error("\u0414\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D");
      if (latest.state === "done") {
        home2();
        message2(((_a = latest.result) == null ? void 0 : _a.cancelled) ? "\u0421\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u043E\u043F\u043B\u0430\u0442\u044B \u043E\u0442\u043C\u0435\u043D\u0435\u043D\u043E" : "\u041E\u043F\u043B\u0430\u0442\u0430 \u0443\u0436\u0435 \u043F\u0440\u043E\u0432\u0435\u0434\u0435\u043D\u0430");
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
      render('<div class="live-heading"><button id="repair-back" aria-label="\u041D\u0430\u0437\u0430\u0434">\u2190</button><h1>\u041E\u043F\u043B\u0430\u0442\u0430 \u0440\u0435\u043C\u043E\u043D\u0442\u0430</h1></div><section class="panel"><h2>\u0420\u0435\u043C\u043E\u043D\u0442 \u2116 ' + esc(q.number) + "</h2><p>" + esc(q.vehicle) + "</p>" + price.markup() + '<div class="total"><span>\u0423\u0436\u0435 \u043E\u043F\u043B\u0430\u0447\u0435\u043D\u043E</span><b>' + money(q.paid) + '</b></div><div class="total"><span>\u041A \u043E\u043F\u043B\u0430\u0442\u0435</span><b id="repair-due"></b></div></section><fieldset class="payment-options"><legend>\u0421\u043F\u043E\u0441\u043E\u0431 \u043E\u043F\u043B\u0430\u0442\u044B</legend>' + [["cash", "\u041D\u0430\u043B\u0438\u0447\u043D\u044B\u0435"], ["card", "\u0411\u0435\u0437\u043D\u0430\u043B\u0438\u0447\u043D\u044B\u0439 \u0440\u0430\u0441\u0447\u0451\u0442"], ["transfer", "\u041F\u0435\u0440\u0435\u0432\u043E\u0434"]].map(([value, label]) => '<label><input type="radio" name="repair-method" value="' + value + '">' + label + "</label>").join("") + '</fieldset><p id="repair-state" class="muted" role="status"></p><button type="button" id="repair-refresh" hidden>\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u0441\u0443\u043C\u043C\u0443 \u0440\u0435\u043C\u043E\u043D\u0442\u0430</button><button class="primary" id="repair-pay">\u041F\u0440\u0438\u043D\u044F\u0442\u044C \u043E\u043F\u043B\u0430\u0442\u0443</button>');
      function drawBalance() {
        if (!$2("repair-pay")) return;
        const total = price.total(), due = total === null ? null : (Math.round(total * 100) - Math.round(q.paid * 100)) / 100;
        $2("repair-due").textContent = due === null || due < 0 ? "\u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0441\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C" : money(due);
        const disabled = stale || submitting || !fixed && (!editable || due === null || due <= 0);
        $2("repair-pay").disabled = disabled;
        $2("repair-pay").dataset.unavailable = String(disabled);
        $2("repair-pay").textContent = read() && !fixed ? "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0446\u0435\u043D\u0443 \u0438 \u043F\u0440\u0438\u043D\u044F\u0442\u044C \u043E\u043F\u043B\u0430\u0442\u0443" : "\u041F\u0440\u0438\u043D\u044F\u0442\u044C \u043E\u043F\u043B\u0430\u0442\u0443";
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
        var _a2;
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
            message2(((_a2 = status.result) == null ? void 0 : _a2.cancelled) ? "\u0421\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u043E\u043F\u043B\u0430\u0442\u044B \u043E\u0442\u043C\u0435\u043D\u0435\u043D\u043E \u043D\u0430 \u0422\u0421\u0414" : "\u041E\u043F\u043B\u0430\u0442\u0430 \u0440\u0435\u043C\u043E\u043D\u0442\u0430 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0430");
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
      $2("repair-pay").onclick = () => run2(async () => {
        var _a2, _b2, _c;
        const method2 = (fixed == null ? void 0 : fixed.method) || ((_a2 = document.querySelector('input[name="repair-method"]:checked')) == null ? void 0 : _a2.value);
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

  // warehouse/live-basket.js?v=20261016-scan-2
  function liveBasket({ terminal: terminal2, call: call2, parts: parts2, render, home: home2, run: run2, message: message2, load: load2, save: save3, refresh, repair: repair2, stationRepair, canOpen = () => true }) {
    const $2 = (id) => document.getElementById(id), key2 = (kind2) => "live:" + kind2 + ":" + (terminal2 ? "terminal" : "station");
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
      var _a;
      return { ...x, quantity: x.quantity - (((_a = job2.payload.items.find((y) => y.part_id === x.part_id)) == null ? void 0 : _a.quantity) || 0) };
    }).filter((x) => x.quantity > 0) : [];
    function rememberUSB(local) {
      var _a;
      if ((_a = local == null ? void 0 : local.usb_ids) == null ? void 0 : _a.length) save3("usb:accepted", [...load2("usb:accepted") || [], ...local.usb_ids].slice(-1e4));
    }
    const cache = () => {
      if (draft2) save3(key2(draft2.kind), draft2);
    };
    function checkpoint() {
      if (terminal2) return;
      cache();
      if (current || (draft2 == null ? void 0 : draft2.items.length)) save3("live:resume:station", { kind, current: current ? JSON.parse(JSON.stringify(current)) : null, draft_id: (draft2 == null ? void 0 : draft2.id) || null });
    }
    async function restore() {
      var _a;
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
      if (((_a = load2(key2(saved.kind))) == null ? void 0 : _a.id) === saved.draft_id) {
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
      var _a;
      return ((_a = current == null ? void 0 : current.checkout) == null ? void 0 : _a.total_override) !== void 0 ? { value: String(current.checkout.total_override) } : totalEdit();
    }, write: (edit) => save3("live-total:" + documentId(), edit ? { ...edit, signature: signature() } : null), locked: () => locked || !!(current == null ? void 0 : current.checkout) });
    const totalValue = () => price.total();
    const amount = (x) => {
      var _a;
      return x.custom_price ? Number(x.unit_price) : Number(((_a = product2(x)) == null ? void 0 : _a.retail_price) || 0);
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
      var _a;
      if (!active) return;
      const local = draft2 || load2(key2(job2.payload.kind)), extra = remaining(local, job2);
      if (!terminal2) {
        save3("live:resume:station", null);
        save3("live-method:" + job2.id, null);
      }
      if ((local == null ? void 0 : local.id) === job2.id) {
        rememberUSB(local);
        save3(key2(local.kind), null);
      }
      if (draft2) {
        save3(key2(draft2.kind), null);
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
      message2(((_a = job2.result) == null ? void 0 : _a.cancelled) ? job2.payload.kind === "receipt" ? "\u041F\u0440\u0438\u0445\u043E\u0434 \u043E\u0442\u043C\u0435\u043D\u0451\u043D" : "\u0414\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u043E\u0442\u043C\u0435\u043D\u0451\u043D" : kind === "receipt" ? "\u041F\u0440\u0438\u0445\u043E\u0434 \u043E\u0444\u043E\u0440\u043C\u043B\u0435\u043D" : "\u041E\u043F\u043B\u0430\u0442\u0430 \u043F\u0440\u0438\u043D\u044F\u0442\u0430");
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
        save3(key2(local.kind), local);
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
      var _a, _b;
      if (!active || !$2("live-items")) return;
      const value = source(), items = value.items.filter((x) => {
        var _a2;
        return !((_a2 = overrides[x.part_id]) == null ? void 0 : _a2.removed) || qty(x) > 0;
      });
      if (terminal2) {
        const x = items.find((x2) => x2.part_id === (draft2 == null ? void 0 : draft2.last_part_id)) || items[items.length - 1];
        $2("live-items").innerHTML = x ? '<article class="last-scan"><small>\u041E\u0442\u0441\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u043E</small><h2>' + esc(((_a = product2(x)) == null ? void 0 : _a.name) || x.part_id) + "</h2><p>" + x.quantity + " \u0448\u0442.</p></article>" : "";
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
      if ($2("live-cancel")) $2("live-cancel").disabled = locked;
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
      return '<div class="live-heading"><button id="live-back" aria-label="\u0417\u0430\u043A\u0440\u044B\u0442\u044C \u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0447\u0435\u0440\u043D\u043E\u0432\u0438\u043A">' + (terminal2 ? "\u2190" : "\u2190 \u041A \u0441\u043F\u0438\u0441\u043A\u0443") + "</button><h1>" + (k === "receipt" ? "\u041F\u0440\u0438\u0445\u043E\u0434" : "\u041E\u043F\u043B\u0430\u0442\u0430") + '</h1></div><small id="live-sync"></small><form id="live-scan" class="scanner-sink" aria-hidden="true"><input id="live-code" inputmode="none" tabindex="-1" autocomplete="off" autocapitalize="off" spellcheck="false"></form><p id="scan-empty" class="scan-empty">\u041E\u0436\u0438\u0434\u0430\u0435\u043C \u0441\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435</p><div id="live-items" aria-live="polite"></div><p id="scan-feedback" role="status"></p>' + (terminal2 ? '<button id="scanner-compat">\u0421\u043A\u0430\u043D\u0435\u0440 \u043D\u0435 \u0432\u0432\u043E\u0434\u0438\u0442 \u043A\u043E\u0434?</button><small id="scan-received" role="status"></small>' : "") + (terminal2 ? "" : '<section id="live-payment" hidden>' + price.markup() + '<fieldset class="payment-options"><legend>\u0421\u043F\u043E\u0441\u043E\u0431 \u043E\u043F\u043B\u0430\u0442\u044B</legend>' + [["cash", "\u041D\u0430\u043B\u0438\u0447\u043D\u044B\u0435"], ["card", "\u0411\u0435\u0437\u043D\u0430\u043B\u0438\u0447\u043D\u044B\u0439 \u0440\u0430\u0441\u0447\u0451\u0442"], ["transfer", "\u041F\u0435\u0440\u0435\u0432\u043E\u0434"]].map(([v, label]) => '<label><input type="radio" name="live-method" value="' + v + '">' + label + "</label>").join("") + '</fieldset></section><button class="primary" id="live-submit" hidden>' + (k === "receipt" ? "\u041E\u0444\u043E\u0440\u043C\u0438\u0442\u044C \u043F\u0440\u0438\u0445\u043E\u0434" : "\u041F\u0440\u0438\u043D\u044F\u0442\u044C \u043E\u043F\u043B\u0430\u0442\u0443") + "</button>" + (k === "receipt" ? '<button type="button" class="live-cancel" id="live-cancel">\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C \u0432\u0435\u0441\u044C \u043F\u0440\u0438\u0445\u043E\u0434</button>' : ""));
    }
    function mount() {
      var _a;
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
      stop = bindScanner($2("live-code"), $2("live-scan"), () => active && !locked, { silent: true });
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
        if ($2("live-cancel")) $2("live-cancel").onclick = () => run2(cancelReceipt);
        $2("live-submit").onclick = () => run2(finish);
        price.bind();
        const method = ((_a = current == null ? void 0 : current.checkout) == null ? void 0 : _a.payment_method) || load2("live-method:" + documentId());
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
      draft2 = load2(key2(kind)) || (terminal2 ? load2("live:" + kind) : null);
      if (draft2) {
        const r = await call2("job", { id: draft2.id }).catch(() => null);
        if ((r == null ? void 0 : r.state) === "done") {
          const extra = remaining(draft2, r);
          rememberUSB(draft2);
          save3(key2(kind), null);
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
      if (draft2) void sync().catch((e) => feedback(e.message, true));
    }
    async function openMirror(value) {
      var _a;
      cleanup();
      kind = value.payload.kind;
      draft2 = null;
      current = value;
      shown.set(value.id, value.payload.revision);
      locked = value.state === "processing";
      overrides = load2("live-edits:" + value.id) || {};
      active = true;
      mount();
      if ((_a = value.checkout) == null ? void 0 : _a.payment_method) {
        const el = document.querySelector('input[name="live-method"][value="' + value.checkout.payment_method + '"]');
        if (el) el.checked = true;
      }
    }
    async function addCode2(code, usbId) {
      var _a, _b;
      if (!code) return;
      if (!active || locked) throw Error("\u0414\u043E\u0436\u0434\u0438\u0442\u0435\u0441\u044C \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u044F \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u0438");
      if (usbId && (((_a = draft2 == null ? void 0 : draft2.usb_ids) == null ? void 0 : _a.includes(usbId)) || (load2("usb:accepted") || []).includes(usbId))) {
        const p = matchBarcode(parts2(), code)[0];
        return { name: (p == null ? void 0 : p.name) || code, price: p == null ? void 0 : p.retail_price, quantity: ((_b = draft2 == null ? void 0 : draft2.items.find((x) => x.part_id === (p == null ? void 0 : p.id))) == null ? void 0 : _b.quantity) || 1 };
      }
      if (current) throw Error("\u0421\u0435\u0439\u0447\u0430\u0441 \u043E\u0442\u043A\u0440\u044B\u0442 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u0434\u0440\u0443\u0433\u043E\u0433\u043E \u0442\u0435\u0440\u043C\u0438\u043D\u0430\u043B\u0430");
      if (/^https?:\/\//i.test(code)) {
        if (kind !== "sale") throw rejected("QR \u0440\u0435\u043C\u043E\u043D\u0442\u0430 \u0441\u043A\u0430\u043D\u0438\u0440\u0443\u0435\u0442\u0441\u044F \u0432 \xAB\u041E\u043F\u043B\u0430\u0442\u0435\xBB");
        if (draft2 == null ? void 0 : draft2.items.length) throw Error("\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u0435 \u043E\u043F\u043B\u0430\u0442\u0443 \u0442\u043E\u0432\u0430\u0440\u043E\u0432 \u043F\u0435\u0440\u0435\u0434 \u0441\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435\u043C \u0440\u0435\u043C\u043E\u043D\u0442\u0430");
        const quote = await call2("repair_quote", { code });
        if (draft2) {
          await sync();
          await call2("draft_close", { id: draft2.id });
          save3(key2(kind), null);
          draft2 = null;
        }
        cleanup();
        await (terminal2 ? repair2(quote) : stationRepair(quote, usbId));
        return { name: "\u0420\u0435\u043C\u043E\u043D\u0442 \u2116 " + quote.number + " \xB7 " + quote.vehicle, price: quote.due };
      }
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
      var _a, _b;
      if (terminal2 || !canOpen() || active && (locked || (draft2 == null ? void 0 : draft2.items.length))) return;
      const jobs = await call2("live_jobs");
      if (!canOpen() || active && (locked || (draft2 == null ? void 0 : draft2.items.length))) return;
      const candidates = jobs.filter((j) => j.state !== "done").sort((a, b) => String(b.payload.updated_at || b.created_at).localeCompare(String(a.payload.updated_at || a.created_at)));
      const found = candidates.find((j) => (!j.station_id || j.terminal_id !== j.station_id) && j.id !== (current == null ? void 0 : current.id) && shown.get(j.id) !== j.payload.revision && j.id + ":" + j.payload.revision !== dismissed && (!active || !current || jobStamp(j) > jobStamp(current)));
      if (found) {
        suspend();
        await openMirror(found);
        void ((_b = (_a = window.warehouseDesktop) == null ? void 0 : _a.showIncoming) == null ? void 0 : _b.call(_a));
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
    async function cancelReceipt() {
      if (terminal2 || kind !== "receipt") return;
      if (locked) throw Error("\u041F\u0440\u0438\u0445\u043E\u0434 \u0443\u0436\u0435 \u043F\u0440\u043E\u0432\u043E\u0434\u0438\u0442\u0441\u044F. \u0414\u043E\u0436\u0434\u0438\u0442\u0435\u0441\u044C \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0430");
      if (!confirm("\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C \u0432\u0435\u0441\u044C \u043F\u0440\u0438\u0445\u043E\u0434? \u0421\u043A\u043B\u0430\u0434\u0441\u043A\u0438\u0435 \u043E\u0441\u0442\u0430\u0442\u043A\u0438 \u043D\u0435 \u0438\u0437\u043C\u0435\u043D\u044F\u0442\u0441\u044F.")) return;
      await scanChain;
      if (draft2) await sync();
      const id = documentId(), value = source();
      if (!id) {
        cleanup();
        home2();
        message2("\u041F\u0443\u0441\u0442\u043E\u0439 \u043F\u0440\u0438\u0445\u043E\u0434 \u0437\u0430\u043A\u0440\u044B\u0442");
        return;
      }
      locked = true;
      draw();
      try {
        const result = await call2("draft_close", { id, revision: value.revision });
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
      var _a, _b, _c;
      if (terminal2) return;
      await scanChain;
      if (draft2) await sync();
      const value = source(), id = documentId();
      if (!value.items.length) throw Error("\u041D\u0435\u0442 \u043E\u0442\u0441\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0445 \u0442\u043E\u0432\u0430\u0440\u043E\u0432");
      const method = ((_a = current == null ? void 0 : current.checkout) == null ? void 0 : _a.payment_method) || ((_b = document.querySelector('input[name="live-method"]:checked')) == null ? void 0 : _b.value);
      if (kind === "sale" && !method) throw Error("\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u043F\u043E\u0441\u043E\u0431 \u043E\u043F\u043B\u0430\u0442\u044B");
      let chosen;
      if (kind === "receipt") {
        chosen = value.items.filter((x) => {
          var _a2;
          return !((_a2 = overrides[x.part_id]) == null ? void 0 : _a2.removed) || qty(x) > 0;
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
    return { open, cleanup, suspend, checkpoint, restore, pollMirror, hasDraft: () => active && (!!current || locked) || !!(draft2 == null ? void 0 : draft2.items.length), active: () => active, kind: () => kind, canAutoOpen: () => !active || !locked && !(draft2 == null ? void 0 : draft2.items.length) && !(current == null ? void 0 : current.checkout), canUSB: (k) => !active || !current && !locked && kind === k, acceptUSB: async (item) => {
      if (!active) await open(item.kind);
      if (kind !== item.kind) throw Error("\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u0435 \u0442\u0435\u043A\u0443\u0449\u0438\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442");
      return add(item.code, item.id);
    } };
  }

  // warehouse/usb-client.js
  function bindUSBInbox({ key: key2, label, container, enabled, add, error, bridge = window.warehouseDesktop }) {
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
      if (unassigned) button("\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u043D\u0430\u043A\u043E\u043F\u043B\u0435\u043D\u043D\u044B\u0435 \u0441\u043A\u0430\u043D\u044B (" + unassigned + ")", () => bridge.usbClaim(key2));
      if (blocked) button("\u041F\u0440\u043E\u043F\u0443\u0441\u0442\u0438\u0442\u044C \u044D\u0442\u043E\u0442 \u0441\u043A\u0430\u043D", () => bridge.usbAck(key2, [blocked.id]));
    }
    async function poll2() {
      if (!live2() || working) return;
      working = true;
      try {
        await bridge.usbTarget({ key: key2, label });
        if (!live2()) return;
        const batch = await bridge.usbBatch(key2);
        if (!live2()) return;
        let blocked;
        for (const item of batch.items) {
          if (!live2()) break;
          if (!add(item)) {
            blocked = item;
            break;
          }
          await bridge.usbAck(key2, [item.id]);
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

  // warehouse/app.js
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
  var serviceLink = $("warehouse-service");
  if (serviceLink) serviceLink.hidden = !(window.fastgoDesktop || new URLSearchParams(location.search).get("unified") === "1");
  serviceLink == null ? void 0 : serviceLink.addEventListener("click", (e) => {
    var _a;
    if (!((_a = window.fastgoWarehouseCanLeave) == null ? void 0 : _a.call(window))) {
      e.preventDefault();
      message("\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u0435 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u043F\u0435\u0440\u0435\u0434 \u043F\u0435\u0440\u0435\u0445\u043E\u0434\u043E\u043C \u0432 \u0441\u0435\u0440\u0432\u0438\u0441", true);
    }
  });
  var key = (n) => "fgwarehouse:" + userId() + ":" + n;
  var load = (n) => {
    try {
      return JSON.parse(localStorage.getItem(key(n)) || "null");
    } catch (e) {
      throw Error("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442");
    }
  };
  var save2 = (n, v) => localStorage.setItem(key(n), JSON.stringify(v));
  var repair = repairPayment({ call: (a, p) => call(a, p), render: (html) => {
    live.cleanup();
    screen = "repair";
    shell(html);
  }, home, run, message, load, save: save2 });
  var live = liveBasket({ terminal, call: (a, p) => call(a, p), parts: () => parts, render: (html) => {
    screen = "live";
    shell(html);
  }, home, run, message, load, save: save2, refresh: catalog, repair: (q) => repair.terminal(q), stationRepair: (q, id) => repair.station(q, id), canOpen: canReceiveIncoming });
  var call = (action, p = {}) => {
    if (!device && document.body.dataset.readonly === "true") {
      if (action === "catalog") return api("service_catalog");
      throw Error("\u041F\u0440\u0438\u0445\u043E\u0434, \u043E\u043F\u043B\u0430\u0442\u0430 \u0438 \u0422\u0421\u0414 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B \u043D\u0430 \u0434\u0432\u0443\u0445 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D\u043D\u044B\u0445 \u043D\u043E\u0443\u0442\u0431\u0443\u043A\u0430\u0445. \u0417\u0434\u0435\u0441\u044C \u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D \u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440 \u0441\u043A\u043B\u0430\u0434\u0430.");
    }
    return api(action, { device_id: device == null ? void 0 : device.id, device_token: device == null ? void 0 : device.token, ...p });
  };
  function applyReadOnly() {
    if (document.body.dataset.readonly !== "true") return;
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
    var _a;
    return !busy && ["home", "inventory", "holdings"].includes(screen) && !job && (terminal || !draft && !live.hasDraft()) && !document.querySelector("#mirror-submit,dialog[open],.modal") && !((_a = document.activeElement) == null ? void 0 : _a.matches("input:not([type=search]),textarea,select,[contenteditable]")) && (immediate || Date.now() - lastActivity > 15e3);
  };
  window.addEventListener("beforeunload", (e) => {
    try {
      live.checkpoint();
    } catch (error) {
      message(error.message, true);
      e.preventDefault();
      e.returnValue = "";
      return;
    }
    if (busy || screen === "basket" || screen === "checkout" || screen === "live" || screen === "repair") {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  function shell(html) {
    document.body.dataset.screen = screen;
    const section = document.getElementById("warehouse-section");
    if (section) section.textContent = { home: "\u0413\u043B\u0430\u0432\u043D\u0430\u044F", inventory: "\u041E\u0441\u0442\u0430\u0442\u043A\u0438", receipt: "\u041F\u0440\u0438\u0445\u043E\u0434", live: "\u041E\u043F\u043B\u0430\u0442\u0430", repair: "\u041E\u043F\u043B\u0430\u0442\u0430 \u0440\u0435\u043C\u043E\u043D\u0442\u0430" }[screen] || "";
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
  function bindNav() {
    if ($("nav-receipt")) $("nav-receipt").onclick = () => run(() => live.open("receipt"));
    if ($("nav-pay")) $("nav-pay").onclick = () => run(() => live.open("sale"));
    if ($("master-stock")) $("master-stock").hidden = !["owner", "developer"].includes(memberRole);
    document.querySelectorAll(".warehouse-sidebar button").forEach((b) => b.classList.toggle("active", b.id === (screen === "inventory" ? "inventory" : screen === "holdings" ? "master-stock" : screen === "shift" ? "shift" : screen === "live" ? live.kind() === "receipt" ? "nav-receipt" : "nav-pay" : "back")));
    applyReadOnly();
    if ($("back")) $("back").onclick = home;
    if ($("inventory")) $("inventory").onclick = () => run(inventory);
    if ($("shift")) $("shift").onclick = shift;
    if ($("master-stock")) $("master-stock").onclick = () => run(holdings);
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
      let pending = load("terminal-connection");
      if (!pending || pending.station_id !== station.id) {
        pending = { station_id: station.id, terminal_id: uuid(), token: uuid() + uuid() };
        save2("terminal-connection", pending);
      }
      device = await api("connect_terminal", pending);
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
      if (!terminal && new URLSearchParams(location.search).get("unified") === "1") {
        document.body.dataset.readonly = "true";
        memberRole = (await serviceApi("me")).role;
        await catalog();
        $("connection").textContent = "\u041A\u0430\u0442\u0430\u043B\u043E\u0433 \u0441\u043A\u043B\u0430\u0434\u0430 \xB7 \u043E\u0431\u0449\u0435\u0435 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435";
        home();
        await inventory();
        message("\u041F\u0440\u0438\u0445\u043E\u0434, \u043E\u043F\u043B\u0430\u0442\u0430 \u0438 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u0422\u0421\u0414 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B \u043D\u0430 \u0434\u0432\u0443\u0445 \u0440\u0430\u0437\u0440\u0435\u0448\u0451\u043D\u043D\u044B\u0445 \u043D\u043E\u0443\u0442\u0431\u0443\u043A\u0430\u0445.");
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
        let pending = load("station-registration");
        if (!pending) {
          pending = { station_id: uuid(), token: uuid() + uuid() };
          save2("station-registration", pending);
        }
        device = await api("register", { name: value, ...pending });
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
    shell((terminal ? "" : nav()) + "<h1>" + (terminal ? "\u0421\u043A\u043B\u0430\u0434\u0441\u043A\u043E\u0439 \u0442\u0435\u0440\u043C\u0438\u043D\u0430\u043B" : "\u0420\u0430\u0431\u043E\u0447\u0435\u0435 \u043C\u0435\u0441\u0442\u043E \u0441\u043A\u043B\u0430\u0434\u0430") + '</h1><div class="homebuttons"><button class="primary" id="receipt">\u041F\u0440\u0438\u0445\u043E\u0434</button><button class="primary" id="pay">\u041E\u043F\u043B\u0430\u0442\u0430</button></div>' + (draft && !terminal ? '<div class="panel">\u0415\u0441\u0442\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442 <button id="resume">\u041F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C</button></div>' : "") + (!terminal ? '<section class="panel"><div id="live-terminal-panel"></div><div id="queue" aria-live="polite">\u041F\u0440\u043E\u0432\u0435\u0440\u044F\u0435\u043C\u2026</div><section id="unknown-scans"></section></section>' : usbHelp()));
    bindNav();
    $("receipt").onclick = () => run(() => live.open("receipt"));
    $("pay").onclick = () => run(() => live.open("sale"));
    if ($("resume")) $("resume").onclick = () => basket(draft.kind, true);
    if (!terminal) {
      void poll();
      void pollUSB();
    }
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
      if (!busy) addCode($("barcode").value.trim());
    };
    if ($("note")) $("note").oninput = (e) => {
      draft.note = e.target.value;
      persist();
    };
    $("send").onclick = () => run(send);
    $("discard").onclick = () => {
      var _a;
      if (confirm("\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C \u044D\u0442\u043E\u0442 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442? \u041E\u0441\u0442\u0430\u0442\u043A\u0438 \u043D\u0435 \u0438\u0437\u043C\u0435\u043D\u044F\u0442\u0441\u044F.")) {
        if ((_a = window.warehouseDesktop) == null ? void 0 : _a.usbRelease) void window.warehouseDesktop.usbRelease(usbKey()).catch((e) => message(e.message, true));
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
    var _a;
    if (!code) return false;
    if (usbId && ((_a = draft.usb_ids) == null ? void 0 : _a.includes(usbId))) return true;
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
    var _a;
    if ((_a = window.warehouseDesktop) == null ? void 0 : _a.usbRelease) await window.warehouseDesktop.usbRelease(usbKey());
  }
  function persist() {
    save2("draft:" + document.body.dataset.mode, draft);
  }
  function drawBasket() {
    const target = $("basket");
    target.innerHTML = draft.items.length ? draft.items.map((x) => {
      var _a;
      const p = parts.find((p2) => p2.id === x.part_id);
      return '<div class="row"><div>' + esc((p == null ? void 0 : p.name) || "\u0422\u043E\u0432\u0430\u0440 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D") + "<small>" + esc((p == null ? void 0 : p.barcode) || "") + " \xB7 \u043E\u0441\u0442\u0430\u0442\u043E\u043A " + ((_a = p == null ? void 0 : p.quantity) != null ? _a : "\u2014") + '</small></div><input type="number" min="1" max="1000" value="' + x.quantity + '" aria-label="\u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E" data-qty="' + x.part_id + '"><span class="price">' + money(p == null ? void 0 : p.retail_price) + '</span><button data-remove="' + x.part_id + '" aria-label="\u0423\u0434\u0430\u043B\u0438\u0442\u044C">\xD7</button></div>';
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
    var _a;
    if ((_a = window.warehouseDesktop) == null ? void 0 : _a.usbTarget) {
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
    var _a;
    return !busy && !job && !draft && ["home", "live", "inventory", "holdings"].includes(screen) && !document.querySelector("dialog[open]") && !((_a = document.activeElement) == null ? void 0 : _a.matches("input:not(#live-code):not(#filter),textarea,select"));
  }
  var autoQueueSeen = /* @__PURE__ */ new Set();
  async function poll() {
    var _a, _b;
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
        void ((_b = (_a = window.warehouseDesktop) == null ? void 0 : _a.showIncoming) == null ? void 0 : _b.call(_a));
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
      var _a, _b, _c;
      const p = parts.find((p2) => p2.id === x.part_id), price = (_c = (_b = (_a = fixed == null ? void 0 : fixed.items.find((i) => i.part_id === x.part_id)) == null ? void 0 : _a.unit_price) != null ? _b : p == null ? void 0 : p.retail_price) != null ? _c : 0;
      return "<label>" + esc((p == null ? void 0 : p.name) || x.part_id) + " \xB7 " + x.quantity + ' \u0448\u0442.<input type="number" min="0" step="0.01" value="' + price + '" data-price="' + x.part_id + '" ' + (fixed ? "disabled" : "") + "></label>";
    }).join("") + '<div class="total"><span>\u0418\u0442\u043E\u0433\u043E</span><b id="total"></b></div></section><section class="panel"><label>\u041E\u043F\u0435\u0440\u0430\u0446\u0438\u044F<select id="mode" ' + (fixed ? "disabled" : "") + '><option value="sale">\u041F\u0440\u043E\u0434\u0430\u0436\u0430</option>' + ((fixed == null ? void 0 : fixed.mode) === "master" ? '<option value="master">\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u044C \u043F\u0440\u0435\u0436\u043D\u044E\u044E \u0432\u044B\u0434\u0430\u0447\u0443 \u043C\u0430\u0441\u0442\u0435\u0440\u0443 \xB7 0 \u20BD</option>' : "") + '</select></label><div id="sale-fields"><label>\u0421\u043C\u0435\u043D\u0430<select id="cash-shift">' + state.shifts.filter((x) => x.status === "open").map((x) => '<option value="' + x.id + '">' + esc(x.register) + " \xB7 \u2116 " + x.number + "</option>").join("") + '</select></label><label>\u041E\u043F\u043B\u0430\u0442\u0430<select id="method"><option value="cash">\u041D\u0430\u043B\u0438\u0447\u043D\u044B\u0435</option><option value="card">\u0411\u0435\u0437\u043D\u0430\u043B\u0438\u0447\u043D\u044B\u0435</option></select></label><p class="muted">\u041F\u0440\u043E\u0432\u043E\u0434\u0438\u043C \u0443\u0447\u0451\u0442 \u043F\u0440\u043E\u0434\u0430\u0436\u0438. \u0411\u0430\u043D\u043A\u043E\u0432\u0441\u043A\u0438\u0439 \u043F\u043B\u0430\u0442\u0451\u0436 \u0438 \u0444\u0438\u0441\u043A\u0430\u043B\u044C\u043D\u044B\u0439 \u0447\u0435\u043A \u0432\u044B\u043F\u043E\u043B\u043D\u044F\u044E\u0442\u0441\u044F \u043D\u0430 \u043A\u0430\u0441\u0441\u0435.</p></div><label id="master-fields" hidden>\u0412\u044B\u0431\u0440\u0430\u0442\u044C \u043C\u0430\u0441\u0442\u0435\u0440\u0430<select id="master">' + staff.map((x) => '<option value="' + x.profile_id + '">' + esc(x.name) + "</option>").join("") + '</select></label><button class="primary" id="checkout">\u041F\u0440\u043E\u0432\u0435\u0441\u0442\u0438</button><p class="muted">\u0412\u044B\u0434\u0430\u0447\u0430 \u043C\u0430\u0441\u0442\u0435\u0440\u0443 \u0443\u043C\u0435\u043D\u044C\u0448\u0430\u0435\u0442 \u0441\u043A\u043B\u0430\u0434\u0441\u043A\u043E\u0439 \u043E\u0441\u0442\u0430\u0442\u043E\u043A \u0438 \u0437\u0430\u043F\u0438\u0441\u044B\u0432\u0430\u0435\u0442 \u0437\u0430\u043F\u0447\u0430\u0441\u0442\u0438 \u043D\u0430 \u043C\u0430\u0441\u0442\u0435\u0440\u0430, \u0431\u0435\u0437 \u0434\u0435\u043D\u0435\u0436\u043D\u043E\u0439 \u0432\u044B\u0440\u0443\u0447\u043A\u0438.</p></section></div>');
    bindNav();
    if (fixed) {
      $("mode").value = fixed.mode;
      $("method").value = fixed.payment_method;
      $("cash-shift").value = fixed.shift_id;
      $("master").value = fixed.master_id;
      for (const id of ["method", "cash-shift", "master"]) $(id).disabled = true;
    }
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
  var canReceiveParts = () => !terminal && !!device && document.body.dataset.readonly !== "true";
  var refreshParts = async () => {
    await catalog();
    drawInventory();
  };
  var photos = partPhotos({ api: serviceApi, editable: canManageParts, run, changed: refreshParts, message });
  var product = productPanel({ parts: () => parts, editable: () => !!device && ["owner", "developer"].includes(memberRole), call: (a, p) => call(a, p), run, changed: () => drawInventory(), message, photos });
  var createPart = newPartForm({ actor: userId, api: serviceApi, photos, parts: () => parts, canReceive: canReceiveParts, run, refresh: refreshParts, openProduct: (p) => product.open(p), message });
  async function inventory() {
    await catalog();
    screen = "inventory";
    shell(nav() + '<div class="inventory-toolbar"><h1>\u041E\u0441\u0442\u0430\u0442\u043A\u0438 \u043E\u0431\u0449\u0435\u0439 \u0431\u0430\u0437\u044B</h1>' + (canManageParts() ? '<button id="new-part" class="primary">\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0437\u0430\u043F\u0447\u0430\u0441\u0442\u044C</button>' : "") + '</div><label class="inventory-search"><span class="sr-only">\u041F\u043E\u0438\u0441\u043A</span><input id="filter" type="search" placeholder="\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044E, \u0430\u0440\u0442\u0438\u043A\u0443\u043B\u0443 \u0438\u043B\u0438 \u0448\u0442\u0440\u0438\u0445\u043A\u043E\u0434\u0443\u2026"></label><div class="inventory-table"><div class="inventory-columns"><span>\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435</span><span>\u0410\u0440\u0442\u0438\u043A\u0443\u043B</span><span>\u041E\u0441\u0442\u0430\u0442\u043E\u043A</span><span>\u0426\u0435\u043D\u0430</span></div><div id="stock-list"></div></div>');
    bindNav();
    drawInventory = () => {
      if (!$("stock-list")) return;
      const q = $("filter").value.toLowerCase(), matches = parts.filter((x) => [x.name, x.barcode, x.sku, x.model].join(" ").toLowerCase().includes(q));
      $("stock-list").innerHTML = matches.slice(0, 100).map((x) => '<button type="button" class="inventory-item" data-part="' + esc(x.id) + '"><span class="inventory-name">' + photos.thumbnail(x) + "<strong>" + esc(x.name) + "</strong></span><span>" + esc(x.sku || "\u2014") + "</span><span>" + x.quantity + " \u0448\u0442.</span><span>" + money(x.retail_price) + "</span></button>").join("") + (matches.length ? "" : '<p class="muted inventory-empty">\u041D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E</p>');
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
      let pending = null;
      dialog.querySelector("form").onsubmit = async (e) => {
        e.preventDefault();
        const submit = dialog.querySelector(".primary"), input = dialog.querySelector("input");
        if (submit.disabled) return;
        pending = pending || { request_id, master_id: x.master_id, part_id: x.part_id, quantity: Number(input.value) };
        submit.disabled = true;
        input.disabled = true;
        try {
          await call("master_return", pending);
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
  async function desktopStatus() {
    var _a, _b, _c;
    const el = $("desktop-status");
    if (!el) return;
    if (((_a = window.fastgoInstalledApp) == null ? void 0 : _a.platform) === "ios") {
      el.textContent = "FastGo \u0434\u043B\u044F iPhone \xB7 " + window.fastgoInstalledApp.version;
      return;
    }
    if (!((_b = window.warehouseDesktop) == null ? void 0 : _b.desktopStatus)) {
      el.textContent = window.warehouseDesktop ? "USB: \u043E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \xAB\u0421\u043A\u0430\u043D\u0435\u0440 \u043F\u043E USB\xBB \u0434\u043B\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F." : "\u041E\u0442\u043A\u0440\u044B\u0442\u0430 \u0432\u0435\u0431-\u0432\u0435\u0440\u0441\u0438\u044F. \u0414\u043B\u044F USB \u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0435 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0443 FastGo \u0421\u043A\u043B\u0430\u0434 \u043D\u0430 Windows.";
      return;
    }
    try {
      const s = await window.warehouseDesktop.desktopStatus(), update = s.update || {};
      if (device && userId() && Date.now() - lastDeviceStatus > 6e4) {
        lastDeviceStatus = Date.now();
        void call("device_status", { app: window.fastgoDesktop ? "desktop" : "warehouse", version: s.version, host: s.host, background: s.background, update_status: update.status, latest_version: update.version, blocking_reason: update.waitReason }).catch(() => {
        });
      }
      let note = "";
      if (update.status === "downloading") note = " \xB7 \u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u0442\u0441\u044F " + update.version + ": " + update.progress + "%";
      if (update.status === "ready") note = " \xB7 \u041E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435 " + update.version + " \u0433\u043E\u0442\u043E\u0432\u043E \u2014 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u0441\u0430\u043C\u043E \u043F\u0435\u0440\u0435\u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0441\u044F \u043F\u043E\u0441\u043B\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u044F \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430";
      if (update.status === "error") note = " \xB7 \u041E\u0448\u0438\u0431\u043A\u0430 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F: " + update.error;
      if ((_c = s.terminalUpdate) == null ? void 0 : _c.message) note += " \xB7 \u0422\u0421\u0414: " + s.terminalUpdate.message;
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
    var _a;
    if ((_a = window.warehouseDesktop) == null ? void 0 : _a.openUSBScanner) void window.warehouseDesktop.openUSBScanner().catch((e) => message(e.message, true));
    else message("\u0421\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u043F\u043E USB \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E \u0432 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u043E\u0439 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0435 FastGo \u0421\u043A\u043B\u0430\u0434 \u0432\u0435\u0440\u0441\u0438\u0438 1.0.4 \u0438 \u043D\u043E\u0432\u0435\u0435.");
  };
  if ($("terminal-update")) $("terminal-update").onclick = async () => {
    var _a;
    try {
      if ((_a = window.warehouseDesktop) == null ? void 0 : _a.openTerminalUpdater) await window.warehouseDesktop.openTerminalUpdater();
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
    var _a, _b, _c, _d;
    if (!webSafe(immediate)) return false;
    if ((_a = window.warehouseDesktop) == null ? void 0 : _a.desktopStatus) {
      const state = await window.warehouseDesktop.desktopStatus();
      if (((_b = state.usb) == null ? void 0 : _b.pending) || ((_c = state.usb) == null ? void 0 : _c.target) || ["downloading", "ready", "preparing", "installing"].includes((_d = state.update) == null ? void 0 : _d.status)) return false;
    }
    return webSafe(immediate);
  } });
  var updating = false;
  async function updateNow() {
    var _a;
    if (updating) return;
    updating = true;
    try {
      live.checkpoint();
      message("\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0432\u0435\u0440\u0441\u0438\u0438 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u044F\u2026");
      if ((_a = window.warehouseDesktop) == null ? void 0 : _a.checkUpdates) {
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
  window.fastgoWarehouseCanLeave = () => !busy && !job && !live.hasDraft() && !draft && !document.querySelector("dialog[open]");
  window.fastgoWarehouseOpenMode = async (kind) => {
    if (!["receipt", "sale"].includes(kind) || !window.fastgoWarehouseCanLeave() && !live.canUSB(kind)) return false;
    if (!live.active() || live.kind() !== kind) await live.open(kind);
    return true;
  };
  if (window.fastgoDesktop) {
    window.fastgoHasUnsavedChanges = () => !window.fastgoWarehouseCanLeave();
    window.fastgoUpdateBlockReason = (immediate) => {
      var _a;
      return ((_a = window.warehouseUpdateSafe) == null ? void 0 : _a.call(window, immediate)) ? "" : "\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u0435 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u0441\u043A\u043B\u0430\u0434\u0430";
    };
    window.fastgoLockForUpdate = (immediate) => {
      var _a;
      if (!((_a = window.warehouseUpdateSafe) == null ? void 0 : _a.call(window, immediate))) return false;
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
  async function pollUSB() {
    const bridge = window.warehouseDesktop;
    if (terminal || !device || !(bridge == null ? void 0 : bridge.usbInbox) || usbPolling || busy || !["home", "live"].includes(screen)) return;
    usbPolling = true;
    try {
      const inbox = await bridge.usbInbox();
      for (const item of inbox.items) {
        if (busy || !["home", "live"].includes(screen)) break;
        if (!item.kind) continue;
        if (!live.canUSB(item.kind)) break;
        try {
          const result = await live.acceptUSB(item);
          await bridge.usbResult(item.id, result);
        } catch (e) {
          await bridge.usbResult(item.id, { error: e.message, retry: !e.rejected });
          message(e.message, true);
          break;
        }
      }
    } catch (e) {
      message(e.message, true);
    } finally {
      usbPolling = false;
    }
  }
  setInterval(() => void pollUSB(), 400);
  setInterval(() => {
    if (!terminal && screen === "home" && !busy) void unknown.poll();
  }, 3e3);
})();
