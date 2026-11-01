import { createApp } from './app.ts';
declare const chrome: any;
const app = createApp(chrome);
chrome.runtime.onMessage.addListener((message: unknown, sender: unknown, respond: (value: unknown) => void) => {
  app.onMessage(message, sender).then(
    data => respond({ ok: true, data }),
    error => respond({ ok: false, error: error instanceof Error ? error.message : 'Ocurrió un error.' }),
  );
  return true;
});
const report = (error: unknown) => console.error('Chrome Block:', error instanceof Error ? error.message : 'Error interno.');
chrome.tabs.onUpdated.addListener((id: number, change: unknown, tab: unknown) => { app.onUpdated(id, change, tab).catch(report); });
chrome.tabs.onRemoved.addListener((id: number) => { app.onRemoved(id).catch(report); });
chrome.runtime.onInstalled.addListener(() => { app.reconcile().catch(report); });
chrome.runtime.onStartup.addListener(() => { app.reconcile().catch(report); });
chrome.permissions.onAdded.addListener(() => { app.reconcile().catch(report); });
chrome.permissions.onRemoved.addListener(() => { app.reconcile().catch(report); });
