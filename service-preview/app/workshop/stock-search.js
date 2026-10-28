// A bounded picker anchored to the stock input, including the visible area above
// the phone keyboard. Other autocomplete fields keep their existing behaviour.
let nextId = 0;
export function attachStockSearch(input, source, onSelect) {
  if (!input || input.dataset.suggestions) return;
  input.dataset.suggestions = 'true';
  input.autocomplete = 'off';
  input.enterKeyHint = 'search';
  const field = document.createElement('div');
  field.className = 'stock-search-field';
  input.before(field);
  field.append(input);
  const box = document.createElement('div');
  box.className = 'fg-suggestions stock-suggestions';
  box.id = 'stock-suggestions-' + (++nextId);
  box.hidden = true;
  box.setAttribute('role', 'listbox');
  box.setAttribute('aria-label', 'Найденные запчасти');
  field.append(box);
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', box.id);
  input.setAttribute('aria-expanded', 'false');
  let items = [], active = -1, version = 0, timer, listeners, touching = false;

  function close() {
    ++version;
    clearTimeout(timer);
    listeners?.abort();
    listeners = null;
    box.hidden = true;
    active = -1;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }
  function position() {
    if (!input.isConnected) return close();
    const rect = input.getBoundingClientRect(), viewport = window.visualViewport;
    const top = viewport?.offsetTop || 0;
    let bottom = top + (viewport?.height || window.innerHeight);
    const nav = document.querySelector('.mobile-nav')?.getBoundingClientRect();
    if (nav?.height && nav.top > rect.bottom && nav.top < bottom) bottom = nav.top;
    const below = bottom - rect.bottom - 12, above = rect.top - top - 12;
    const upwards = below < 144 && above > below;
    const height = Math.min(208, upwards ? above : below);
    if (height < 44) return close();
    box.dataset.side = upwards ? 'above' : 'below';
    box.style.maxHeight = height + 'px';
  }
  function watch() {
    if (listeners) return;
    listeners = new AbortController();
    const options = {signal: listeners.signal, passive: true};
    window.addEventListener('resize', position, options);
    window.addEventListener('hashchange', close, options);
    window.addEventListener('scroll', position, {...options, capture: true});
    window.visualViewport?.addEventListener('resize', position, options);
    window.visualViewport?.addEventListener('scroll', position, options);
    document.addEventListener('pointerdown', e => { if (!field.contains(e.target)) close(); }, {...options, capture: true});
    document.addEventListener('focusin', e => { if (!field.contains(e.target)) close(); }, options);
  }
  function choose(index) {
    const item = items[index];
    if (!item || input.disabled) return;
    close();
    input.value = item.value ?? item.label;
    // Dismiss the phone keyboard before the filtered stock view is mounted.
    input.blur();
    onSelect(item);
  }
  async function show() {
    const current = ++version, query = input.value.trim();
    if (!query || input.disabled || !input.isConnected) return close();
    try {
      const results = await source(query);
      if (current !== version || !input.isConnected || document.activeElement !== input) return;
      items = results || [];
      active = -1;
      input.removeAttribute('aria-activedescendant');
      box.replaceChildren();
      for (const [index, item] of items.entries()) {
        const button = document.createElement('button');
        button.type = 'button';
        button.id = box.id + '-' + index;
        button.setAttribute('role', 'option');
        button.setAttribute('aria-selected', 'false');
        button.setAttribute('aria-label', item.label || item.value);
        const name = document.createElement('span'), detail = document.createElement('small');
        name.textContent = [item.item?.name || item.value, item.item?.model].filter(Boolean).join(' · ');
        detail.textContent = item.item?.sku || item.item?.barcode || item.item?.category || '';
        button.title = item.label || item.value;
        button.append(name);
        if (detail.textContent) button.append(detail);
        button.addEventListener('pointerdown', e => {
          if (e.pointerType === 'mouse') e.preventDefault();
          else touching = true;
        });
        button.onclick = () => choose(index);
        box.append(button);
      }
      box.scrollTop = 0;
      box.hidden = !items.length;
      input.setAttribute('aria-expanded', String(!!items.length));
      if (items.length) { watch(); position(); } else close();
    } catch { if (current === version) close(); }
  }
  function schedule() {
    close();
    if (input.value.trim()) timer = setTimeout(show, 150);
  }
  input.addEventListener('input', schedule);
  input.addEventListener('focus', show);
  // Safari may keep focus after a tap on non-focusable text outside the field.
  // A second tap on the input must reopen suggestions even without a focus event.
  input.addEventListener('click', () => { if (box.hidden) show(); });
  input.addEventListener('blur', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { if (!touching && !field.contains(document.activeElement)) close(); }, 120);
  });
  for (const event of ['pointerup', 'pointercancel']) box.addEventListener(event, () => { touching = false; });
  field.addEventListener('keydown', e => {
    if (e.key === 'Escape') { close(); return; }
    if (box.hidden) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      active = active < 0 ? (e.key === 'ArrowDown' ? 0 : items.length - 1) : (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      [...box.children].forEach((button, index) => button.setAttribute('aria-selected', String(index === active)));
      const option = box.children[active];
      input.setAttribute('aria-activedescendant', option.id);
      // Scroll only the list, keeping the input and page stationary.
      if (option.offsetTop < box.scrollTop) box.scrollTop = option.offsetTop;
      else if (option.offsetTop + option.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = option.offsetTop + option.offsetHeight - box.clientHeight;
    } else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choose(active); }
  });
  input.form?.addEventListener('submit', close);
}
