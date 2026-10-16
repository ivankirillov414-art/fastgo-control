// Keyboard-wedge scanners can send Enter, Tab, or only the decoded text.
// Keep capture scoped to a basket; never intercept a note, quantity or password.
export function bindScanner(input, form, enabled, {silent=false}={}) {
  let timer, previous = '', lastAt = 0, burst = 0, disposed = false;
  const editable = el => el && (el.matches('input,textarea,select') || el.isContentEditable);
  const reset = () => { clearTimeout(timer); previous = ''; lastAt = 0; burst = 0; };
  const live = () => !disposed && input.isConnected && enabled();
  const focus = () => {
    if (live() && (!editable(document.activeElement) || document.activeElement === input)) {
      // Focus a readonly sink first so older Android WebViews do not open the IME.
      // Restore text input afterwards for scanner services that inject decoded text.
      if(silent){input.readOnly=true;input.blur();}
      input.focus({preventScroll:true});
      if(silent)input.readOnly=false;
    }
  };
  if(silent){input.setAttribute('inputmode','none');input.tabIndex=-1;}
  const submit = () => {
    reset();
    if (live() && input.value.trim()) form.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
  };
  const onInput = e => {
    if (!live() || e.isComposing) return reset();
    const value = input.value, now = performance.now();
    if(value===previous)return;
    clearTimeout(timer);
    const appended = value.startsWith(previous), added = appended ? value.length - previous.length : value.length;
    if (added <= 0) { reset(); previous = value; return; }
    burst = appended && now - lastAt <= 65 ? burst + added : added;
    previous = value; lastAt = now;
    // A whole decoded value or a rapid run of keys is a scan. Slow manual
    // entry still waits for the existing Add button / Enter confirmation.
    if (added >= 4 || burst >= 4) timer = setTimeout(() => {
      if (live() && (silent || document.activeElement === input) && input.value === value) submit();
    }, 200);
  };
  const onKey = e => {
    if (!live() || e.isComposing || e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.target === input && (e.key === 'Enter' || e.key === 'Tab') && input.value.trim()) {
      e.preventDefault(); submit(); return;
    }
    // Recover from a tap on the page or a basket button. Preserve the first
    // character, which would otherwise be delivered to that old focus target.
    if (!editable(e.target) && e.key && e.key.length === 1) {
      e.preventDefault(); focus();
      input.setRangeText(e.key, input.selectionStart, input.selectionEnd, 'end');
      input.dispatchEvent(new Event('input', {bubbles: true}));
    }
  };
  const onPaste = () => { setTimeout(()=>{if(live())onInput({isComposing:false});},0); };
  const suspend = () => { if(silent){reset();input.readOnly=true;input.blur();} };
  const onVisible = () => { if (document.hidden) suspend();else focus(); };
  const onClick = e => {
    if (!editable(e.target) && !e.target.closest('button,a,label')) focus();
  };
  input.addEventListener('input', onInput);
  input.addEventListener('change', onInput);
  input.addEventListener('compositionend', onInput);
  input.addEventListener('paste', onPaste);
  form.addEventListener('submit', reset, true);
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('click', onClick);
  window.addEventListener('focus', focus);
  document.addEventListener('visibilitychange', onVisible);
  focus();
  // Older WebViews may not honour focus until the new screen has painted.
  const paint = requestAnimationFrame(focus);
  return () => {
    disposed = true; reset(); cancelAnimationFrame(paint);
    input.removeEventListener('input', onInput);
    input.removeEventListener('change', onInput);
    input.removeEventListener('compositionend', onInput);
    input.removeEventListener('paste', onPaste);
    form.removeEventListener('submit', reset, true);
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('click', onClick);
    window.removeEventListener('focus', focus);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
