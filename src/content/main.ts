(() => {
  const marker = Symbol.for('chrome-block-monitor-v1');
  if ((window as any)[marker]) return;
  Object.defineProperty(window, marker, { value: true });
  let active = false;
  const channel = 'chrome-block-v1';
  const post = window.postMessage.bind(window);
  window.addEventListener('chrome-block:state', (event: Event) => {
    // This only controls the fallback/recorder. Browser-enforced CSP is not
    // switchable from the page or this untrusted MAIN-world event channel.
    active = (event as CustomEvent).detail === true;
  });
  function resolved(value: unknown): string | null {
    if (typeof value !== 'string' || !value) return null;
    try { return new URL(value, document.baseURI).href; } catch { return null; }
  }
  function report(kind: string, value: unknown) {
    try { post({ channel, type: 'attempt', attempt: { kind, url: resolved(value) } }, '*'); }
    catch { /* Recording must not throw into the host application. */ }
  }
  function targetOf(element: Element): string {
    const explicit = element.getAttribute('target');
    if (explicit !== null) return explicit || '_self';
    return document.querySelector('base[target]')?.getAttribute('target') || '_self';
  }
  function opensWindow(value: unknown): boolean {
    const target = typeof value === 'string' ? value : '_blank';
    if (target === '') return true; // window.open(url, '') uses a new context.
    if (['_self', '_top', '_parent', '_unfencedtop'].includes(target.toLowerCase())) return false;
    if (target === window.name) return false;
    // Existing frames are navigation targets, not new advertising windows.
    for (const frame of document.querySelectorAll('iframe[name], frame[name]')) {
      if (frame.getAttribute('name') === target) return false;
    }
    return true;
  }
  const nativeOpen = window.open;
  window.open = new Proxy(nativeOpen, {
    apply(target, receiver, args) {
      if (active && opensWindow(args.length < 2 ? '_blank' : args[1])) {
        report('window', args[0]);
        return null;
      }
      return Reflect.apply(target, receiver, args);
    },
  });
  for (const type of ['click', 'auxclick']) {
    document.addEventListener(type, (event: Event) => {
      if (!active || event.defaultPrevented) return;
      const mouse = event as MouseEvent;
      if (type === 'auxclick' && mouse.button !== 1) return;
      const link = event.composedPath().find(node => node instanceof HTMLAnchorElement || node instanceof HTMLAreaElement) as HTMLAnchorElement | undefined;
      if (!link || !link.getAttribute('href') || link.hasAttribute?.('download')) return;
      if (!opensWindow(targetOf(link)) && !mouse.ctrlKey && !mouse.metaKey && !mouse.shiftKey && mouse.button !== 1) return;
      event.preventDefault();
      report('link', link.href);
    }, true);
  }
  document.addEventListener('submit', (event: Event) => {
    if (!active || event.defaultPrevented || !(event.target instanceof HTMLFormElement)) return;
    const form = event.target;
    const submitter = (event as SubmitEvent).submitter;
    const method = submitter?.getAttribute('formmethod') || form.method;
    const overrideTarget = submitter?.getAttribute('formtarget');
    const target = overrideTarget === null || overrideTarget === undefined ? targetOf(form) : overrideTarget || '_self';
    if (method.toLowerCase() === 'dialog' || !opensWindow(target)) return;
    event.preventDefault();
    report('form', submitter?.getAttribute('formaction') || form.action);
  }, true);
  const nativeSubmit = HTMLFormElement.prototype.submit;
  HTMLFormElement.prototype.submit = new Proxy(nativeSubmit, {
    apply(target, form, args) {
      if (active && form.method.toLowerCase() !== 'dialog' && opensWindow(targetOf(form))) {
        report('form', form.action);
        return;
      }
      return Reflect.apply(target, form, args);
    },
  });
  post({ channel, type: 'hook-ready' }, '*');
})();
