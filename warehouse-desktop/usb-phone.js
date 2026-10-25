(() => {
  // warehouse/scan-policy.js
  function scanError(kind2, code) {
    if (!kind2) return "\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0440\u0430\u0437\u0434\u0435\u043B \u0441\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F";
    const value = String(code || "").trim(), link = /^[a-z][a-z0-9+.-]*:/i.test(value) || /^www\./i.test(value), pickup = value.startsWith("FGPARTS1.");
    if (!value) return "\u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u043A\u043E\u0434";
    if (kind2 === "repair") {
      try {
        const u = new URL(value);
        if (u.protocol === "https:" && u.hostname === "ivankirillov414-art.github.io" && !u.username && !u.password && (u.pathname === "/fastgo-control/repair-status.html" || u.pathname === "/fastgo-control/workshop.html" && u.hash.startsWith("#order?") && u.hash.includes("kind=repair"))) return "";
      } catch (e) {
      }
      return "\u0412 \u043E\u043F\u043B\u0430\u0442\u0435 \u0440\u0435\u043C\u043E\u043D\u0442\u0430 \u0441\u043A\u0430\u043D\u0438\u0440\u0443\u0439\u0442\u0435 \u0442\u043E\u043B\u044C\u043A\u043E QR \u0440\u0435\u043C\u043E\u043D\u0442\u0430";
    }
    if (kind2 === "parts") return pickup || !link ? "" : "\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0440\u0430\u0437\u0434\u0435\u043B \xAB\u041E\u043F\u043B\u0430\u0442\u0430 \u0440\u0435\u043C\u043E\u043D\u0442\u0430\xBB";
    if (!["receipt", "sale"].includes(kind2)) return "\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0440\u0430\u0437\u0434\u0435\u043B \u0441\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F";
    return pickup ? "QR \u043C\u0430\u0441\u0442\u0435\u0440\u0430 \u043F\u0440\u0438\u043D\u0438\u043C\u0430\u0435\u0442\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u0432 \u0432\u044B\u0434\u0430\u0447\u0435 \u0437\u0430\u043F\u0447\u0430\u0441\u0442\u0435\u0439" : link ? "\u0412 \u044D\u0442\u043E\u043C \u0440\u0430\u0437\u0434\u0435\u043B\u0435 \u0441\u043A\u0430\u043D\u0438\u0440\u0443\u0439\u0442\u0435 \u0448\u0442\u0440\u0438\u0445\u043A\u043E\u0434 \u0442\u043E\u0432\u0430\u0440\u0430. \u0414\u043B\u044F QR \u0440\u0435\u043C\u043E\u043D\u0442\u0430 \u043E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \xAB\u041E\u043F\u043B\u0430\u0442\u0430 \u0440\u0435\u043C\u043E\u043D\u0442\u0430\xBB" : "";
  }

  // warehouse/scanner.js
  function bindScanner(input2, form2, enabled, { silent = false } = {}) {
    let timer, previous = "", lastAt = 0, burst = 0, disposed = false;
    const editable = (el) => el && (el.matches("input,textarea,select") || el.isContentEditable);
    const reset = () => {
      clearTimeout(timer);
      previous = "";
      lastAt = 0;
      burst = 0;
    };
    const live = () => !disposed && input2.isConnected && enabled();
    const focus = () => {
      if (live() && (!editable(document.activeElement) || document.activeElement === input2)) {
        input2.focus({ preventScroll: true });
      }
    };
    if (silent) {
      input2.setAttribute("inputmode", "none");
      input2.tabIndex = -1;
    }
    const submit = () => {
      reset();
      if (live() && input2.value.trim()) form2.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    };
    const onInput = (e) => {
      if (!live() || e.isComposing) return reset();
      const value = input2.value, now = performance.now();
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
        if (live() && (silent || document.activeElement === input2) && input2.value === value) submit();
      }, 200);
    };
    const onKey = (e) => {
      if (!live() || e.isComposing || e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.target === input2 && (e.key === "Enter" || e.key === "Tab") && input2.value.trim()) {
        e.preventDefault();
        submit();
        return;
      }
      if (!editable(e.target) && e.key && e.key.length === 1) {
        e.preventDefault();
        focus();
        input2.setRangeText(e.key, input2.selectionStart, input2.selectionEnd, "end");
        input2.dispatchEvent(new Event("input", { bubbles: true }));
      }
    };
    const onPaste = () => {
      setTimeout(() => {
        if (live()) onInput({ isComposing: false });
      }, 0);
    };
    const suspend = () => {
      if (silent) {
        reset();
        input2.blur();
      }
    };
    const onVisible = () => {
      if (document.hidden) suspend();
      else focus();
    };
    const onClick = (e) => {
      if (!editable(e.target) && !e.target.closest("button,a,label")) focus();
    };
    input2.addEventListener("input", onInput);
    input2.addEventListener("change", onInput);
    input2.addEventListener("compositionend", onInput);
    input2.addEventListener("paste", onPaste);
    form2.addEventListener("submit", reset, true);
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
      input2.removeEventListener("input", onInput);
      input2.removeEventListener("change", onInput);
      input2.removeEventListener("compositionend", onInput);
      input2.removeEventListener("paste", onPaste);
      form2.removeEventListener("submit", reset, true);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("click", onClick);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }

  // warehouse-desktop/usb-phone-source.js
  var $ = (id) => document.getElementById(id);
  var input = $("barcode");
  var form = $("scan");
  var status = $("state");
  var error = $("error");
  var base = location.pathname.replace(/\/?$/, "/");
  var store = "fastgo-usb-outbox:" + base;
  var queue = [];
  var sending = false;
  var healthy = true;
  var kind = "";
  var stop = null;
  var lastSeen = "";
  var modePending = false;
  try {
    queue = JSON.parse(localStorage.getItem(store) || "[]");
    if (!Array.isArray(queue)) throw Error();
  } catch (e) {
    healthy = false;
    error.textContent = "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0435 \u0441\u043A\u0430\u043D\u044B. \u041D\u0435 \u043E\u0447\u0438\u0449\u0430\u0439\u0442\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0430.";
  }
  function persist() {
    localStorage.setItem(store, JSON.stringify(queue));
    $("pending").textContent = queue.length ? "\u041E\u0436\u0438\u0434\u0430\u044E\u0442 \u043F\u0435\u0440\u0435\u0434\u0430\u0447\u0438: " + queue.length : "";
  }
  async function request(route, data) {
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 5e3) : null;
    try {
      const r = await fetch(base + route, { method: data ? "POST" : "GET", headers: data ? { "Content-Type": "application/json" } : {}, body: data ? JSON.stringify(data) : void 0, signal: controller ? controller.signal : void 0 });
      const body = await r.json();
      if (!r.ok) throw Error(body.error || "\u041D\u0435\u0442 \u0441\u0432\u044F\u0437\u0438");
      return body;
    } finally {
      clearTimeout(timer);
    }
  }
  async function flush() {
    if (sending || !healthy) return;
    sending = true;
    try {
      if (modePending) {
        await request("mode", { kind });
        modePending = false;
      }
      while (queue.length) {
        const item = queue[0];
        const result = await request("scan", item);
        if (result.rejected) error.textContent = result.error;
        queue.shift();
        try {
          persist();
        } catch (e) {
          queue.unshift(item);
          throw e;
        }
      }
      const s = await request("status");
      status.textContent = kind ? "" : "\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u043E \u043F\u043E USB";
      if (s.last && s.last.id !== lastSeen && s.last.kind === kind) {
        lastSeen = s.last.id;
        if (s.last.error) {
          error.textContent = s.last.error;
          $("last").textContent = "";
        } else {
          error.textContent = "";
          $("last").textContent = s.last.name + (s.last.quantity ? " \xB7 " + s.last.quantity + " \u0448\u0442." : "");
        }
      }
    } catch (e) {
      status.textContent = "\u041E\u0436\u0438\u0434\u0430\u043D\u0438\u0435 \u043D\u043E\u0443\u0442\u0431\u0443\u043A\u0430";
      error.textContent = e.message === "Failed to fetch" ? "\u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 USB-\u043A\u0430\u0431\u0435\u043B\u044C. \u0421\u043A\u0430\u043D\u044B \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B." : e.message;
    } finally {
      sending = false;
    }
  }
  function open(value) {
    kind = value;
    $("home").hidden = true;
    $("work").hidden = false;
    $("title").textContent = value === "receipt" ? "\u041F\u0440\u0438\u0445\u043E\u0434" : value === "repair" ? "\u041E\u043F\u043B\u0430\u0442\u0430 \u0440\u0435\u043C\u043E\u043D\u0442\u0430" : "\u041F\u0440\u043E\u0434\u0430\u0436\u0430";
    $("last").textContent = "";
    error.textContent = "";
    stop == null ? void 0 : stop();
    stop = bindScanner(input, form, () => healthy && !!kind, { silent: true });
    modePending = true;
    void flush();
  }
  for (const button of document.querySelectorAll("[data-kind]")) button.onclick = () => open(button.dataset.kind);
  $("back").onclick = () => {
    stop == null ? void 0 : stop();
    stop = null;
    kind = "";
    modePending = true;
    void flush();
    $("home").hidden = false;
    $("work").hidden = true;
  };
  form.onsubmit = (e) => {
    e.preventDefault();
    if (!healthy || !kind) return;
    const code = input.value.trim();
    input.value = "";
    if (!code) return;
    const problem = scanError(kind, code);
    if (problem) {
      error.textContent = problem;
      return;
    }
    if (code.length > 256 || /[\x00-\x1f\x7f]/.test(code)) {
      error.textContent = "\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0448\u0442\u0440\u0438\u0445\u043A\u043E\u0434";
      return;
    }
    if (queue.length >= 1e3) {
      error.textContent = "\u041D\u0430\u043A\u043E\u043F\u043B\u0435\u043D\u043E 1000 \u0441\u043A\u0430\u043D\u043E\u0432. \u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u0435 \u043D\u043E\u0443\u0442\u0431\u0443\u043A.";
      return;
    }
    const item = { id: Date.now().toString(36) + "-" + Math.random().toString(36).slice(2) + "-" + Math.random().toString(36).slice(2), code, kind };
    queue.push(item);
    try {
      persist();
      error.textContent = "";
      status.textContent = "\u0421\u043A\u0430\u043D \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u2026";
      void flush();
    } catch (e2) {
      queue.pop();
      error.textContent = "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0441\u043A\u0430\u043D. \u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0435 \u043F\u043E\u0441\u043B\u0435 \u043E\u0441\u0432\u043E\u0431\u043E\u0436\u0434\u0435\u043D\u0438\u044F \u043C\u0435\u0441\u0442\u0430.";
    }
  };
  if (healthy) {
    persist();
    void flush();
    setInterval(flush, 400);
  }
})();
