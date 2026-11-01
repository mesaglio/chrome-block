declare const chrome: any;
(() => {
  let active = false;
  let since = 0;
  let count = 0;
  const sync = () => window.dispatchEvent(new CustomEvent('chrome-block:state', { detail: active }));
  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window || event.data?.channel !== 'chrome-block-v1') return;
    if (event.data.type === 'hook-ready') { sync(); return; }
    if (!active || event.data.type !== 'attempt') return;
    const attempt = event.data.attempt;
    if (!attempt || !['window', 'link', 'form'].includes(attempt.kind) ||
      (attempt.url !== null && (typeof attempt.url !== 'string' || attempt.url.length > 8192))) return;
    if (Date.now() - since > 5000) { since = Date.now(); count = 0; }
    if (++count > 100) return;
    chrome.runtime.sendMessage({ type: 'ATTEMPT', attempt }).catch(() => {});
  });
  function hello() {
    let controlled = false;
    try { controlled = Boolean(navigator.serviceWorker?.controller); } catch { /* Opaque origin. */ }
    chrome.runtime.sendMessage({ type: 'HELLO', controlled }).then((reply: any) => {
      active = reply?.ok === true && reply.data?.protected === true;
      sync();
    }).catch(() => { active = false; sync(); });
  }
  chrome.storage.onChanged.addListener((_changes: unknown, area: string) => {
    if (area === 'local') hello();
  });
  window.addEventListener('pageshow', hello);
  try { navigator.serviceWorker?.addEventListener('controllerchange', hello); } catch { /* Opaque origin. */ }
  hello();
})();
