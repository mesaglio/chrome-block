import type { Settings } from '../shared/policy.ts';
import { createRules } from './rules.ts';
import { siteOrigins } from '../shared/permissions.ts';

const SCRIPT_IDS = ['chrome-block-main', 'chrome-block-controller'];

export function createEngine(api: any) {
  async function grantedHosts(sites: string[]): Promise<string[]> {
    const results = await Promise.all(sites.map(async host =>
      await api.permissions.contains({ origins: siteOrigins(host) }) ? host : null));
    return results.filter((host): host is string => host !== null);
  }
  async function replaceScripts(scripts: any[]) {
    const registered = await api.scripting.getRegisteredContentScripts();
    const ids = registered.filter((script: any) => SCRIPT_IDS.includes(script.id)).map((script: any) => script.id);
    if (ids.length) await api.scripting.unregisterContentScripts({ ids });
    if (scripts.length) await api.scripting.registerContentScripts(scripts);
  }
  async function replaceRules(rules: any[]) {
    const current = await api.declarativeNetRequest.getDynamicRules();
    await api.declarativeNetRequest.updateDynamicRules({ removeRuleIds: current.map((rule: any) => rule.id), addRules: rules });
  }
  return {
    grantedHosts,
    async apply(settings: Settings): Promise<void> {
      const granted = await grantedHosts(settings.sites);
      const matches = settings.enabled ? granted.flatMap(siteOrigins) : [];
      const rules = createRules(settings, granted);
      const scripts = matches.length ? SCRIPT_IDS.map((id, index) => ({
        id, matches, js: [`content/${index === 0 ? 'main' : 'controller'}.js`],
        world: index === 0 ? 'MAIN' : 'ISOLATED',
        runAt: 'document_start', allFrames: true, matchOriginAsFallback: true, persistAcrossSessions: true,
      })) : [];
      const previousRules = await api.declarativeNetRequest.getDynamicRules();
      const previousScripts = (await api.scripting.getRegisteredContentScripts()).filter((s: any) => SCRIPT_IDS.includes(s.id));
      try {
        await replaceRules(rules);
        await replaceScripts(scripts);
      } catch (error) {
        try { await replaceRules(previousRules); await replaceScripts(previousScripts); }
        catch { throw Error('Chrome no pudo aplicar ni restaurar la protección. Reintentá desde el menú.'); }
        throw error;
      }
    },
  };
}
