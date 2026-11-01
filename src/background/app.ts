import { siteHostname, isProtected, recoverableUrl, type Settings } from '../shared/policy.ts';
import { isPopupSender, isContentSender } from '../shared/messages.ts';
import { siteOrigins } from '../shared/permissions.ts';
import { createSettingsStore } from './settings.ts';
import { createEngine } from './engine.ts';
import { addAttempt, type AttemptLog } from './attempts.ts';

export function createApp(api: any) {
  const engine = createEngine(api);
  const store = createSettingsStore(api.storage.local, engine.apply);
  const session = api.storage.session;
  let queue: Promise<unknown> = Promise.resolve();
  const bursts = new Map<number, { since: number; count: number }>();
  const emptyLog = (): AttemptLog => ({ count: 0, recent: [] });
  const serial = <T>(work: () => Promise<T>): Promise<T> => {
    const result = queue.then(work);
    queue = result.catch(() => {});
    return result;
  };
  async function read(key: string) { return (await session.get(key))[key]; }
  async function hasAccess(host: string | null): Promise<boolean> {
    return host !== null && await api.permissions.contains({ origins: siteOrigins(host) });
  }
  async function getState(tabId: number) {
    if (!Number.isInteger(tabId) || tabId < 0) throw Error('Pestaña no disponible.');
    const tab = await api.tabs.get(tabId);
    const settings = await store.readSettings();
    const host = siteHostname(tab.url);
    const permission = await hasAccess(host);
    const rules = await api.declarativeNetRequest.getDynamicRules();
    const configured = permission && rules.some((rule: any) => rule.condition?.resourceTypes?.includes('main_frame') &&
      rule.action?.type === 'modifyHeaders' && rule.condition.regexFilter && new RegExp(rule.condition.regexFilter).test(tab.url));
    return {
      host, settings, selected: host !== null && settings.sites.includes(host), permission, configured,
      pending: Boolean(await read(`pending:${tabId}`)), controlled: Boolean((await read(`page:${tabId}`))?.controlled),
      log: await read(`log:${tabId}`) || emptyLog(), error: await read('engineError') || null,
    };
  }
  async function updateBadge(tabId: number) {
    try {
      const state = await getState(tabId);
      const on = state.settings.enabled && state.selected && state.configured;
      const text = state.pending ? '…' : on ? (state.log.count ? String(Math.min(state.log.count, 999)) : 'ON') : '';
      await api.action.setBadgeText({ tabId, text });
      await api.action.setBadgeBackgroundColor({ tabId, color: state.pending ? '#b66a16' : '#236d55' });
      await api.action.setTitle({ tabId, title: state.pending ? 'Chrome Block · recarga pendiente' : `Chrome Block · ${on ? 'protección configurada' : 'sin protección activa'}` });
    } catch { /* The tab may have closed during the operation. */ }
  }
  async function reloadSites(hosts: string[]) {
    const errors: number[] = [];
    const tabs = await api.tabs.query({});
    for (const tab of tabs) {
      if (!hosts.includes(siteHostname(tab.url) || '')) continue;
      await session.set({ [`pending:${tab.id}`]: { loading: false } });
      await updateBadge(tab.id);
      try { await api.tabs.reload(tab.id, { bypassCache: true }); }
      catch { errors.push(tab.id); }
    }
    return errors;
  }
  async function changeSettings(mutate: (settings: Settings) => Settings) {
    const previous = await store.readSettings();
    try {
      const settings = await store.updateSettings(mutate);
      await session.remove('engineError');
      const affected = [...new Set([...previous.sites, ...settings.sites])].filter(host =>
        (previous.enabled && previous.sites.includes(host)) !== (settings.enabled && settings.sites.includes(host)));
      return { settings, reloadErrors: await reloadSites(affected) };
    } catch (error) {
      await session.set({ engineError: error instanceof Error ? error.message : 'No se pudo aplicar la protección.' });
      throw error;
    }
  }
  async function handleContent(message: any, sender: any) {
    const tabId = sender.tab.id;
    const tab = await api.tabs.get(tabId);
    const settings = await store.readSettings();
    const protectedPage = isProtected(settings, tab.url) && await hasAccess(siteHostname(tab.url));
    if (message.type === 'HELLO') {
      if (sender.frameId === 0) await session.set({ [`page:${tabId}`]: { controlled: message.controlled === true } });
      return { protected: protectedPage };
    }
    if (!protectedPage || sender.documentLifecycle === 'prerender' || sender.documentLifecycle === 'cached') return {};
    let burst = bursts.get(tabId);
    if (!burst || Date.now() - burst.since > 5000) { burst = { since: Date.now(), count: 0 }; bursts.set(tabId, burst); }
    if (++burst.count > 200) return {};
    const log = await read(`log:${tabId}`) || emptyLog();
    const next = addAttempt(log, message.attempt, crypto.randomUUID());
    await session.set({ [`log:${tabId}`]: next });
    await updateBadge(tabId);
    return {};
  }
  async function handlePopup(message: any) {
    switch (message.type) {
      case 'GET_STATE': return getState(message.tabId);
      case 'SET_ENABLED':
        if (typeof message.enabled !== 'boolean') throw Error('Estado inválido.');
        return changeSettings(settings => ({ ...settings, enabled: message.enabled }));
      case 'SET_SITE': {
        if (typeof message.enabled !== 'boolean') throw Error('Estado inválido.');
        const tab = await api.tabs.get(message.tabId);
        const host = siteHostname(tab.url);
        if (!host || host !== message.host) throw Error('La página cambió. Volvé a abrir el menú.');
        if (message.enabled && !await hasAccess(host)) throw Error('Falta el permiso para proteger este sitio.');
        return changeSettings(settings => ({ ...settings,
          sites: message.enabled ? [...settings.sites, host] : settings.sites.filter(value => value !== host),
        }));
      }
      case 'OPEN_ATTEMPT': {
        const log: AttemptLog = await read(`log:${message.tabId}`) || emptyLog();
        const attempt = log.recent.find(item => item.id === message.id);
        const url = attempt?.recoverable && recoverableUrl(attempt.url);
        if (!url) throw Error('Este destino ya no está disponible o no se puede recuperar.');
        await api.tabs.create({ url });
        return {};
      }
      case 'RELOAD_TAB': {
        const tab = await api.tabs.get(message.tabId);
        if (!siteHostname(tab.url)) throw Error('No se puede recargar esta página desde la extensión.');
        await session.set({ [`pending:${tab.id}`]: { loading: false } });
        await api.tabs.reload(tab.id, { bypassCache: true });
        return {};
      }
      case 'RETRY': {
        const settings = await store.updateSettings(settings => settings);
        await session.remove('engineError');
        return { reloadErrors: await reloadSites(settings.sites) };
      }
      default: throw Error('Acción desconocida.');
    }
  }
  return {
    onMessage(message: any, sender: any): Promise<any> {
      return serial(async () => {
        if (!message || typeof message.type !== 'string') throw Error('Mensaje inválido.');
        if (isPopupSender(sender, api.runtime.id)) return handlePopup(message);
        if (isContentSender(sender, api.runtime.id) && ['HELLO', 'ATTEMPT'].includes(message.type)) return handleContent(message, sender);
        throw Error('Mensaje no autorizado.');
      });
    },
    onUpdated(id: number, change: any, _tab: any): Promise<void> {
      return serial(async () => {
        if (change.status === 'loading') {
          await session.remove([`log:${id}`, `page:${id}`]);
          bursts.delete(id);
          if (await read(`pending:${id}`)) await session.set({ [`pending:${id}`]: { loading: true } });
        }
        if (change.status === 'complete' && (await read(`pending:${id}`))?.loading) await session.remove(`pending:${id}`);
        if (change.status || change.url) await updateBadge(id);
      });
    },
    onRemoved(id: number): Promise<void> {
      return serial(async () => { bursts.delete(id); await session.remove([`log:${id}`, `pending:${id}`, `page:${id}`]); });
    },
    reconcile(): Promise<void> {
      return serial(async () => {
        try {
          const before = await api.declarativeNetRequest.getDynamicRules();
          const settings = await store.updateSettings(settings => settings);
          const after = await api.declarativeNetRequest.getDynamicRules();
          const signature = (rules: any[], host: string) => JSON.stringify(rules
            .filter(rule => rule.condition?.resourceTypes?.includes('main_frame') && rule.condition.regexFilter &&
              new RegExp(rule.condition.regexFilter).test(`https://${host}/`))
            .map(rule => rule.action));
          const changed = settings.sites.filter(host => signature(before, host) !== signature(after, host));
          await session.remove('engineError');
          if (changed.length) await reloadSites(changed);
          const tabs = await api.tabs.query({});
          const ids = new Set(tabs.map((tab: any) => tab.id));
          const stale = Object.keys(await session.get(null)).filter(key => /^(log|pending|page):\d+$/.test(key) && !ids.has(Number(key.split(':')[1])));
          if (stale.length) await session.remove(stale);
          for (const tab of tabs) await updateBadge(tab.id);
        } catch (error) {
          await session.set({ engineError: error instanceof Error ? error.message : 'No se pudo iniciar la protección.' });
        }
      });
    },
  };
}
