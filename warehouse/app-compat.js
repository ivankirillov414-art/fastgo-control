(() => {
  // warehouse/usb-client.js
  function bindUSBInbox({ key: key2, label, container, enabled, add, error, bridge = window.warehouseDesktop }) {
    if (!(bridge == null ? void 0 : bridge.usbTarget)) {
      container.hidden = true;
      return () => {
      };
    }
    let stopped = false, working = false, rendered = "";
    const live = () => !stopped && container.isConnected && enabled();
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
      if (!live() || working) return;
      working = true;
      try {
        await bridge.usbTarget({ key: key2, label });
        if (!live()) return;
        const batch = await bridge.usbBatch(key2);
        if (!live()) return;
        let blocked;
        for (const item of batch.items) {
          if (!live()) break;
          if (!add(item)) {
            blocked = item;
            break;
          }
          await bridge.usbAck(key2, [item.id]);
        }
        if (live()) render(batch.unassigned, blocked);
      } catch (e) {
        if (live()) error(e.message);
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

  // warehouse/scanner.js
  function bindScanner(input, form, enabled) {
    let timer, previous = "", lastAt = 0, burst = 0, disposed = false;
    const editable = (el) => el && (el.matches("input,textarea,select") || el.isContentEditable);
    const reset = () => {
      clearTimeout(timer);
      previous = "";
      lastAt = 0;
      burst = 0;
    };
    const live = () => !disposed && input.isConnected && enabled();
    const focus = () => {
      if (live() && (!editable(document.activeElement) || document.activeElement === input)) input.focus();
    };
    const submit = () => {
      reset();
      if (live() && input.value.trim()) form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    };
    const onInput = (e) => {
      clearTimeout(timer);
      if (!live() || e.isComposing) return reset();
      const value = input.value, now = performance.now();
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
        if (live() && document.activeElement === input && input.value === value) submit();
      }, 200);
    };
    const onKey = (e) => {
      if (!live() || e.isComposing || e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.target === input && (e.key === "Enter" || e.key === "Tab") && input.value.trim()) {
        e.preventDefault();
        submit();
        return;
      }
      if (!editable(e.target) && e.key && e.key.length === 1) {
        e.preventDefault();
        input.focus();
        input.setRangeText(e.key, input.selectionStart, input.selectionEnd, "end");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    };
    const onVisible = () => {
      if (!document.hidden) focus();
    };
    const onClick = (e) => {
      if (!editable(e.target) && !e.target.closest("button,a,label")) focus();
    };
    input.addEventListener("input", onInput);
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
      form.removeEventListener("submit", reset, true);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("click", onClick);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }

  // warehouse/client.js
  var BASE = "https://oqgpjfikjpcplnxueoki.supabase.co";
  var KEY = "sb_publishable_-aVkOpeHXncVZhF2jPuG5w_4DkRYqji";
  var STORE = "fastgo_warehouse_session_v1";
  var session;
  try {
    session = JSON.parse(localStorage.getItem(STORE) || "null");
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
    localStorage.setItem(STORE, JSON.stringify(session));
  }
  async function login(email, password) {
    save(await request("/auth/v1/token?grant_type=password", { email, password }));
  }
  async function logout() {
    const token = session == null ? void 0 : session.access_token;
    session = null;
    localStorage.removeItem(STORE);
    if (token) await request("/auth/v1/logout?scope=local", {}, token).catch(() => {
    });
  }
  async function api(action, params = {}) {
    if (!session) throw Object.assign(Error("\u0412\u043E\u0439\u0434\u0438\u0442\u0435 \u0432 FastGo"), { status: 401 });
    if (session.expires_at * 1e3 < Date.now() + 6e4) {
      if (!refreshing) refreshing = request("/auth/v1/token?grant_type=refresh_token", { refresh_token: session.refresh_token }).then(save).finally(() => refreshing = null);
      await refreshing;
    }
    return (await request("/functions/v1/fastgo-warehouse", { ...params, action }, session.access_token)).data;
  }
  var uuid = () => crypto.randomUUID ? crypto.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (Number(c) ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> Number(c) / 4).toString(16));
  function matchBarcode(parts2, value) {
    const code = String(value).trim().toUpperCase();
    return parts2.filter((x) => String(x.barcode || "").toUpperCase() === code || String(x.sku || "").toUpperCase() === code || x.id.toUpperCase() === code);
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
  var key = (n) => "fgwarehouse:" + userId() + ":" + n;
  var load = (n) => {
    try {
      return JSON.parse(localStorage.getItem(key(n)) || "null");
    } catch (e) {
      throw Error("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442");
    }
  };
  var save2 = (n, v) => localStorage.setItem(key(n), JSON.stringify(v));
  var call = (action, p = {}) => api(action, { device_id: device == null ? void 0 : device.id, device_token: device == null ? void 0 : device.token, ...p });
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
      document.querySelectorAll("button").forEach((x) => x.disabled = false);
    }
  }
  for (const e of ["keydown", "pointerdown", "input", "change"]) window.addEventListener(e, () => lastActivity = Date.now(), true);
  window.warehouseUpdateSafe = () => {
    var _a;
    return !busy && screen === "home" && !draft && !job && !((_a = $("terminal-help")) == null ? void 0 : _a.open) && Date.now() - lastActivity > 12e4;
  };
  window.addEventListener("beforeunload", (e) => {
    if (busy || screen === "basket" || screen === "checkout") {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  function shell(html) {
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
  }
  function nav() {
    return '<div class="subnav"><button id="back">\u2190 \u0413\u043B\u0430\u0432\u043D\u043E\u0435</button>' + (!terminal ? '<button id="inventory">\u041E\u0441\u0442\u0430\u0442\u043A\u0438</button><button id="pair-code">\u041F\u0440\u0438\u0432\u044F\u0437\u0430\u0442\u044C \u0442\u0435\u0440\u043C\u0438\u043D\u0430\u043B</button><button id="shift">\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0441\u043C\u0435\u043D\u0443</button>' + (["owner", "developer"].includes(memberRole) ? '<button id="master-stock">\u0417\u0430\u043F\u0447\u0430\u0441\u0442\u0438 \u043D\u0430 \u043C\u0430\u0441\u0442\u0435\u0440\u0430\u0445</button>' : "") : "") + "</div>";
  }
  function bindNav() {
    if ($("back")) $("back").onclick = home;
    if ($("inventory")) $("inventory").onclick = () => run(inventory);
    if ($("pair-code")) $("pair-code").onclick = () => run(async () => {
      const r = await call("pair_code");
      message("\u041A\u043E\u0434 \u0434\u043B\u044F \u0442\u0435\u0440\u043C\u0438\u043D\u0430\u043B\u0430 (10 \u043C\u0438\u043D\u0443\u0442): " + r.code);
    });
    if ($("shift")) $("shift").onclick = shift;
    if ($("master-stock")) $("master-stock").onclick = () => run(holdings);
  }
  async function catalog() {
    const c = await call("catalog");
    parts = c.parts;
    staff = c.staff;
  }
  async function start() {
    if (!userId()) return signIn();
    device = load(terminal ? "terminal" : "station");
    $("logout").hidden = false;
    if (!device) return setup();
    try {
      const info = await call("info");
      memberRole = info.member.role;
      $("connection").textContent = info.device.name;
      await catalog();
      draft = load("draft:" + document.body.dataset.mode);
      home();
    } catch (e) {
      shell('<h1>\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u0441\u043A\u043B\u0430\u0434\u0430</h1><button id="retry">\u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C</button><button id="rebind">\u0421\u043C\u0435\u043D\u0438\u0442\u044C \u043F\u0440\u0438\u0432\u044F\u0437\u043A\u0443</button>');
      $("retry").onclick = () => run(start);
      $("rebind").onclick = () => {
        device = null;
        setup();
      };
      message(e.message, true);
    }
  }
  function signIn() {
    screen = "login";
    $("logout").hidden = true;
    shell("<h1>" + (terminal ? "\u0422\u0435\u0440\u043C\u0438\u043D\u0430\u043B FastGo" : "FastGo \u0421\u043A\u043B\u0430\u0434") + '</h1><form id="login" class="panel" style="max-width:420px"><label>\u041F\u043E\u0447\u0442\u0430 \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0430<input name="email" type="email" autocomplete="username" required></label><label>\u041F\u0430\u0440\u043E\u043B\u044C<input name="password" type="password" autocomplete="current-password" required></label><button class="primary">\u0412\u043E\u0439\u0442\u0438</button></form>');
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
    screen = "setup";
    shell("<h1>" + (terminal ? "\u041F\u0440\u0438\u0432\u044F\u0437\u0430\u0442\u044C \u043A \u0441\u043A\u043B\u0430\u0434\u0441\u043A\u043E\u043C\u0443 \u043D\u043E\u0443\u0442\u0431\u0443\u043A\u0443" : "\u041D\u043E\u0432\u043E\u0435 \u0441\u043A\u043B\u0430\u0434\u0441\u043A\u043E\u0435 \u0440\u0430\u0431\u043E\u0447\u0435\u0435 \u043C\u0435\u0441\u0442\u043E") + '</h1><form id="setup" class="panel"><label>' + (terminal ? "\u041A\u043E\u0434 \u0441 \u043D\u043E\u0443\u0442\u0431\u0443\u043A\u0430" : "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u043A\u0430\u0441\u0441\u044B / \u043D\u043E\u0443\u0442\u0431\u0443\u043A\u0430") + '<input name="value" required autocomplete="off"></label><button class="primary">' + (terminal ? "\u041F\u0440\u0438\u0432\u044F\u0437\u0430\u0442\u044C" : "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u0440\u0430\u0431\u043E\u0447\u0435\u0435 \u043C\u0435\u0441\u0442\u043E") + "</button></form>");
    $("setup").onsubmit = (e) => {
      e.preventDefault();
      const value = e.target.elements.value.value;
      run(async () => {
        device = await api(terminal ? "pair" : "register", terminal ? { code: value } : { name: value });
        save2(terminal ? "terminal" : "station", device);
        const code = device.pair_code;
        await start();
        if (code) message("\u041A\u043E\u0434 \u043F\u0440\u0438\u0432\u044F\u0437\u043A\u0438 \u0442\u0435\u0440\u043C\u0438\u043D\u0430\u043B\u0430 (10 \u043C\u0438\u043D\u0443\u0442): " + code);
      });
    };
  }
  function home() {
    screen = "home";
    job = null;
    shell(nav() + "<h1>" + (terminal ? "\u0421\u043A\u043B\u0430\u0434\u0441\u043A\u043E\u0439 \u0442\u0435\u0440\u043C\u0438\u043D\u0430\u043B" : "\u0420\u0430\u0431\u043E\u0447\u0435\u0435 \u043C\u0435\u0441\u0442\u043E \u0441\u043A\u043B\u0430\u0434\u0430") + '</h1><div class="homebuttons"><button class="primary" id="receipt">\u041F\u0440\u0438\u0445\u043E\u0434</button><button class="primary" id="pay">\u041E\u043F\u043B\u0430\u0442\u0430</button></div>' + (draft ? '<div class="panel">\u0415\u0441\u0442\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442 <button id="resume">\u041F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C</button></div>' : "") + (!terminal ? '<section class="panel"><h2>\u041A\u043E\u0440\u0437\u0438\u043D\u044B \u0441 \u0442\u0435\u0440\u043C\u0438\u043D\u0430\u043B\u0430</h2><div id="queue" aria-live="polite">\u041F\u0440\u043E\u0432\u0435\u0440\u044F\u0435\u043C\u2026</div></section>' : ""));
    bindNav();
    $("receipt").onclick = () => basket("receipt");
    $("pay").onclick = () => basket("sale");
    if ($("resume")) $("resume").onclick = () => basket(draft.kind, true);
    if (!terminal) void poll();
  }
  function basket(kind, resume = false) {
    if (draft && !resume) {
      message("\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u0435 \u0438\u043B\u0438 \u043E\u0442\u043C\u0435\u043D\u0438\u0442\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442.", true);
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
  async function poll() {
    if (terminal || screen !== "home" || polling || busy || !device) return;
    polling = true;
    try {
      const jobs = await call("queue");
      if (screen !== "home" || !$("queue")) return;
      $("queue").innerHTML = jobs.length ? jobs.map((x) => '<div class="job"><span>\u041A\u043E\u0440\u0437\u0438\u043D\u0430 ' + esc(x.id.slice(0, 8)) + " \xB7 " + x.payload.items.reduce((n, i) => n + i.quantity, 0) + ' \u0448\u0442.<small style="display:block">' + new Date(x.created_at).toLocaleString("ru-RU") + " \xB7 " + (x.state === "processing" ? "\u0422\u0440\u0435\u0431\u0443\u0435\u0442 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u044F" : "\u041E\u0436\u0438\u0434\u0430\u0435\u0442 \u043E\u043F\u043B\u0430\u0442\u044B") + '</small></span><button data-job="' + x.id + '">\u041E\u0442\u043A\u0440\u044B\u0442\u044C</button></div>').join("") : "\u041D\u043E\u0432\u044B\u0445 \u043A\u043E\u0440\u0437\u0438\u043D \u043D\u0435\u0442";
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
    job = value;
    screen = "checkout";
    const state = await call("cash_state"), fixed = job.checkout;
    shell(nav() + "<h1>\u041E\u043F\u043B\u0430\u0442\u0430 \xB7 " + esc(job.id.slice(0, 8)) + '</h1><div class="twocol"><section class="panel"><h2>\u0422\u043E\u0432\u0430\u0440\u044B</h2>' + job.payload.items.map((x) => {
      var _a, _b, _c;
      const p = parts.find((p2) => p2.id === x.part_id), price = (_c = (_b = (_a = fixed == null ? void 0 : fixed.items.find((i) => i.part_id === x.part_id)) == null ? void 0 : _a.unit_price) != null ? _b : p == null ? void 0 : p.retail_price) != null ? _c : 0;
      return "<label>" + esc((p == null ? void 0 : p.name) || x.part_id) + " \xB7 " + x.quantity + ' \u0448\u0442.<input type="number" min="0" step="0.01" value="' + price + '" data-price="' + x.part_id + '" ' + (fixed ? "disabled" : "") + "></label>";
    }).join("") + '<div class="total"><span>\u0418\u0442\u043E\u0433\u043E</span><b id="total"></b></div></section><section class="panel"><label>\u041E\u043F\u0435\u0440\u0430\u0446\u0438\u044F<select id="mode" ' + (fixed ? "disabled" : "") + '><option value="sale">\u041F\u0440\u043E\u0434\u0430\u0436\u0430</option><option value="master">\u0412\u044B\u0434\u0430\u0442\u044C \u043C\u0430\u0441\u0442\u0435\u0440\u0443 \xB7 0 \u20BD</option></select></label><div id="sale-fields"><label>\u0421\u043C\u0435\u043D\u0430<select id="cash-shift">' + state.shifts.filter((x) => x.status === "open").map((x) => '<option value="' + x.id + '">' + esc(x.register) + " \xB7 \u2116 " + x.number + "</option>").join("") + '</select></label><label>\u041E\u043F\u043B\u0430\u0442\u0430<select id="method"><option value="cash">\u041D\u0430\u043B\u0438\u0447\u043D\u044B\u0435</option><option value="card">\u0411\u0435\u0437\u043D\u0430\u043B\u0438\u0447\u043D\u044B\u0435</option></select></label><p class="muted">\u041F\u0440\u043E\u0432\u043E\u0434\u0438\u043C \u0443\u0447\u0451\u0442 \u043F\u0440\u043E\u0434\u0430\u0436\u0438. \u0411\u0430\u043D\u043A\u043E\u0432\u0441\u043A\u0438\u0439 \u043F\u043B\u0430\u0442\u0451\u0436 \u0438 \u0444\u0438\u0441\u043A\u0430\u043B\u044C\u043D\u044B\u0439 \u0447\u0435\u043A \u0432\u044B\u043F\u043E\u043B\u043D\u044F\u044E\u0442\u0441\u044F \u043D\u0430 \u043A\u0430\u0441\u0441\u0435.</p></div><label id="master-fields" hidden>\u0412\u044B\u0431\u0440\u0430\u0442\u044C \u043C\u0430\u0441\u0442\u0435\u0440\u0430<select id="master">' + staff.map((x) => '<option value="' + x.profile_id + '">' + esc(x.name) + "</option>").join("") + '</select></label><button class="primary" id="checkout">\u041F\u0440\u043E\u0432\u0435\u0441\u0442\u0438</button><p class="muted">\u0412\u044B\u0434\u0430\u0447\u0430 \u043C\u0430\u0441\u0442\u0435\u0440\u0443 \u0443\u043C\u0435\u043D\u044C\u0448\u0430\u0435\u0442 \u0441\u043A\u043B\u0430\u0434\u0441\u043A\u043E\u0439 \u043E\u0441\u0442\u0430\u0442\u043E\u043A \u0438 \u0437\u0430\u043F\u0438\u0441\u044B\u0432\u0430\u0435\u0442 \u0437\u0430\u043F\u0447\u0430\u0441\u0442\u0438 \u043D\u0430 \u043C\u0430\u0441\u0442\u0435\u0440\u0430, \u0431\u0435\u0437 \u0434\u0435\u043D\u0435\u0436\u043D\u043E\u0439 \u0432\u044B\u0440\u0443\u0447\u043A\u0438.</p></section></div>');
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
  async function inventory() {
    await catalog();
    screen = "inventory";
    shell(nav() + '<h1>\u041E\u0441\u0442\u0430\u0442\u043A\u0438 \u043E\u0431\u0449\u0435\u0439 \u0431\u0430\u0437\u044B</h1><label>\u041F\u043E\u0438\u0441\u043A<input id="filter" placeholder="\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435, \u0448\u0442\u0440\u0438\u0445\u043A\u043E\u0434, \u0430\u0440\u0442\u0438\u043A\u0443\u043B"></label><div id="stock-list" class="panel"></div>');
    bindNav();
    const draw = () => {
      $("stock-list").innerHTML = parts.filter((x) => (x.name + " " + x.barcode + " " + x.sku).toLowerCase().includes($("filter").value.toLowerCase())).slice(0, 100).map((x) => '<div class="job"><span>' + esc(x.name) + '<small style="display:block">' + esc(x.barcode) + "</small></span><b>" + x.quantity + " \u0448\u0442.</b><span>" + money(x.retail_price) + "</span></div>").join("");
    };
    $("filter").oninput = draw;
    draw();
  }
  async function holdings() {
    const rows = await api("holdings");
    screen = "holdings";
    shell(nav() + '<h1>\u0417\u0430\u043F\u0447\u0430\u0441\u0442\u0438 \u043D\u0430 \u043C\u0430\u0441\u0442\u0435\u0440\u0430\u0445</h1><div class="panel tablewrap"><table><thead><tr><th>\u041C\u0430\u0441\u0442\u0435\u0440</th><th>\u0417\u0430\u043F\u0447\u0430\u0441\u0442\u044C</th><th>\u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E</th><th>\u0421\u0435\u0431\u0435\u0441\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C</th><th>\u0412\u044B\u0434\u0430\u043D\u043E</th></tr></thead><tbody>' + rows.map((x) => "<tr><td>" + esc(x.master_name) + "</td><td>" + esc(x.name) + "</td><td>" + x.quantity + "</td><td>" + money(x.unit_cost * x.quantity) + "</td><td>" + new Date(x.created_at).toLocaleString("ru-RU") + "</td></tr>").join("") + "</tbody></table>" + (rows.length ? "" : "\u041F\u043E\u043A\u0430 \u0432\u044B\u0434\u0430\u0447 \u043D\u0435\u0442.") + "</div>");
    bindNav();
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
  setInterval(() => void poll(), 3e3);
  window.addEventListener("online", () => void poll());
  void start();
})();
