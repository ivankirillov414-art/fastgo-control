(() => {
  // warehouse/scanner.js
  function bindScanner(input2, form2, enabled) {
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
      if (live() && (!editable(document.activeElement) || document.activeElement === input2)) input2.focus();
    };
    const submit = () => {
      reset();
      if (live() && input2.value.trim()) form2.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    };
    const onInput = (e) => {
      clearTimeout(timer);
      if (!live() || e.isComposing) return reset();
      const value = input2.value, now = performance.now();
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
        if (live() && document.activeElement === input2 && input2.value === value) submit();
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
        input2.focus();
        input2.setRangeText(e.key, input2.selectionStart, input2.selectionEnd, "end");
        input2.dispatchEvent(new Event("input", { bubbles: true }));
      }
    };
    const onVisible = () => {
      if (!document.hidden) focus();
    };
    const onClick = (e) => {
      if (!editable(e.target) && !e.target.closest("button,a,label")) focus();
    };
    input2.addEventListener("input", onInput);
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
      form2.removeEventListener("submit", reset, true);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("click", onClick);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }

  // warehouse-desktop/usb-phone-source.js
  var input = document.getElementById("barcode");
  var form = document.getElementById("scan");
  var status = document.getElementById("state");
  var error = document.getElementById("error");
  var base = location.pathname.replace(/\/?$/, "/");
  var store = "fastgo-usb-outbox:" + base;
  var queue = [];
  var sending = false;
  var healthy = true;
  try {
    queue = JSON.parse(localStorage.getItem(store) || "[]");
    if (!Array.isArray(queue)) throw Error();
  } catch (e) {
    healthy = false;
    error.textContent = "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0435 \u0441\u043A\u0430\u043D\u044B. \u041D\u0435 \u043E\u0447\u0438\u0449\u0430\u0439\u0442\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0430.";
  }
  function persist() {
    localStorage.setItem(store, JSON.stringify(queue));
    document.getElementById("pending").textContent = queue.length ? "\u041E\u0436\u0438\u0434\u0430\u044E\u0442 \u043F\u0435\u0440\u0435\u0434\u0430\u0447\u0438: " + queue.length : "\u0412\u0441\u0435 \u0441\u043A\u0430\u043D\u044B \u043F\u0435\u0440\u0435\u0434\u0430\u043D\u044B \u043D\u0430 \u043D\u043E\u0443\u0442\u0431\u0443\u043A";
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
      while (queue.length) {
        const item = queue[0];
        await request("scan", item);
        queue.shift();
        try {
          persist();
        } catch (e) {
          queue.unshift(item);
          throw e;
        }
        document.getElementById("last").textContent = "\u041F\u0435\u0440\u0435\u0434\u0430\u043D\u043E: " + item.code;
      }
      const s = await request("status");
      status.textContent = !s.enabled ? "USB-\u0441\u043A\u0430\u043D\u0435\u0440 \u0432\u044B\u043A\u043B\u044E\u0447\u0435\u043D" : s.target ? "USB \xB7 " + s.target : "USB \xB7 \u0441\u043A\u0430\u043D\u044B \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u044E\u0442\u0441\u044F \u043D\u0430 \u043D\u043E\u0443\u0442\u0431\u0443\u043A\u0435";
      error.textContent = "";
    } catch (e) {
      status.textContent = "\u041E\u0436\u0438\u0434\u0430\u043D\u0438\u0435 \u043D\u043E\u0443\u0442\u0431\u0443\u043A\u0430";
      error.textContent = e.message === "Failed to fetch" ? "\u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 USB-\u043A\u0430\u0431\u0435\u043B\u044C. \u0421\u043A\u0430\u043D\u044B \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B \u043D\u0430 \u0442\u0435\u0440\u043C\u0438\u043D\u0430\u043B\u0435." : e.message;
    } finally {
      sending = false;
    }
  }
  form.onsubmit = (e) => {
    e.preventDefault();
    if (!healthy) return;
    const code = input.value.trim();
    if (!code) return;
    if (code.length > 256 || /[\x00-\x1f\x7f]/.test(code)) {
      error.textContent = "\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0448\u0442\u0440\u0438\u0445\u043A\u043E\u0434";
      return;
    }
    if (queue.length >= 1e3) {
      error.textContent = "\u041D\u0430\u043A\u043E\u043F\u043B\u0435\u043D\u043E 1000 \u0441\u043A\u0430\u043D\u043E\u0432. \u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u0435 \u043D\u043E\u0443\u0442\u0431\u0443\u043A.";
      return;
    }
    const item = { id: Date.now().toString(36) + "-" + Math.random().toString(36).slice(2) + "-" + Math.random().toString(36).slice(2), code };
    queue.push(item);
    try {
      persist();
      input.value = "";
      input.focus();
      void flush();
    } catch (e2) {
      queue.pop();
      error.textContent = "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0441\u043A\u0430\u043D. \u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0435 \u043F\u043E\u0441\u043B\u0435 \u043E\u0441\u0432\u043E\u0431\u043E\u0436\u0434\u0435\u043D\u0438\u044F \u043C\u0435\u0441\u0442\u0430.";
    }
  };
  bindScanner(input, form, () => healthy);
  if (healthy) {
    persist();
    void flush();
    setInterval(flush, 1500);
  }
})();
