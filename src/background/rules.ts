import type { Settings } from '../shared/policy.ts';

// Append rather than replace: the website's CSP must keep its restrictions.
// Omitting allow-popups makes the browser enforce this in descendant frames too.
export const POPUP_SANDBOX = 'sandbox allow-same-origin allow-scripts allow-forms allow-downloads allow-modals allow-orientation-lock allow-pointer-lock allow-presentation allow-top-navigation allow-storage-access-by-user-activation';

export function createRules(settings: Settings, granted: string[]) {
  if (!settings.enabled) return [];
  return settings.sites.filter(host => granted.includes(host)).map((host, index) => ({
    id: index + 1,
    priority: 1,
    action: {
      type: 'modifyHeaders',
      responseHeaders: [{ header: 'content-security-policy', operation: 'append', value: POPUP_SANDBOX }],
    },
    condition: {
      regexFilter: `^https?://${host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?::[0-9]+)?/`,
      resourceTypes: ['main_frame'],
    },
  }));
}
