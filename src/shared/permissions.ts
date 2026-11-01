export function siteOrigins(host: string): string[] {
  // Keep each request under one explicitly declared manifest scheme. A single
  // wildcard-scheme request is not a substitute for these two grants.
  return [`http://${host}/*`, `https://${host}/*`];
}
