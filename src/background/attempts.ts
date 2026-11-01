import { recoverableUrl } from '../shared/policy.ts';
export type Attempt = { id: string; url: string | null; kind: 'window' | 'link' | 'form'; recoverable: boolean };
export type AttemptLog = { count: number; recent: Attempt[] };
export function addAttempt(log: AttemptLog, raw: unknown, id: string): AttemptLog {
  if (!raw || typeof raw !== 'object' || !('kind' in raw) || !['window', 'link', 'form'].includes(String(raw.kind))) return log;
  const input = raw as { kind: Attempt['kind']; url?: unknown };
  const url = recoverableUrl(input.url);
  const entry: Attempt = { id, url, kind: input.kind, recoverable: input.kind !== 'form' && url !== null };
  return { count: Math.min(log.count + 1, 999999), recent: [entry, ...log.recent].slice(0, 20) };
}
