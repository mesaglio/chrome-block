export type Settings = { enabled: boolean; sites: string[] };
export function siteHostname(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (url.hostname === 'chromewebstore.google.com' ||
        (url.hostname === 'chrome.google.com' && url.pathname.startsWith('/webstore'))) return null;
    return url.hostname.toLowerCase();
  } catch { return null; }
}

export function normalizeSettings(value: unknown): Settings {
  const input = value && typeof value === 'object' ? value as Partial<Settings> : {};
  const hosts = Array.isArray(input.sites) ? input.sites : [];
  const sites = hosts.filter((host): host is string => {
    if (typeof host !== 'string') return false;
    const candidate = host.toLowerCase();
    if (!/^(?:[a-z0-9.-]+|\[[a-f0-9:]+\])$/.test(candidate)) return false;
    return siteHostname(`https://${candidate}/`) === candidate;
  }).map(host => host.toLowerCase());
  return { enabled: typeof input.enabled === 'boolean' ? input.enabled : true, sites: [...new Set(sites)].sort() };
}

export function isProtected(settings: Settings, url: unknown): boolean {
  const host = siteHostname(url);
  return settings.enabled && host !== null && settings.sites.includes(host);
}

export function recoverableUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 8192 || /[\u0000-\u0020\u007f]/.test(value) || !/^https?:\/\//i.test(value)) return null;
  try {
    const url = new URL(value);
    return url.username || url.password ? null : url.href;
  } catch { return null; }
}
