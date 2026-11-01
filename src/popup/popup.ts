import { statusFor } from './view.ts';
import { siteOrigins } from '../shared/permissions.ts';
declare const chrome: any;
const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const globalSwitch = $<HTMLInputElement>('globalSwitch');
const siteSwitch = $<HTMLInputElement>('siteSwitch');
let tabId: number | null = null;
let state: any = null;
let busy = false;
let refreshNumber = 0;
let refreshTimer: ReturnType<typeof setTimeout>;

async function request(message: any) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) throw Error(response?.error || 'No se pudo conectar con la extensión.');
  return response.data;
}
function notice(text: string) { $('message').textContent = text; $('message').hidden = !text; }
function setBusy(value: boolean) {
  busy = value;
  globalSwitch.disabled = value || !state;
  siteSwitch.disabled = value || !state?.host;
  for (const button of document.querySelectorAll<HTMLButtonElement>('button')) button.disabled = value;
}
function render() {
  const status = statusFor(state);
  $('statusCard').className = `status-card ${status.tone}`;
  $('hostname').textContent = state.host || 'Esta página';
  $('statusTitle').textContent = status.title;
  $('statusDescription').textContent = status.description;
  globalSwitch.checked = state.settings.enabled;
  siteSwitch.checked = state.selected;
  $('siteDescription').textContent = state.selected && !state.settings.enabled ? 'Guardado. Se aplicará al prender la protección general.' : 'Incluye los reproductores de esta página.';
  $('permissionButton').hidden = !state.host || !state.selected || state.permission;
  $('retryButton').hidden = !state.error && (!state.selected || !state.permission || state.configured || !state.settings.enabled);
  $('reloadButton').hidden = !state.host || (!state.pending && !(state.selected && !state.permission));
  $('count').textContent = String(state.log.count);
  $('empty').hidden = state.log.recent.length > 0;
  $('attempts').replaceChildren();
  for (const attempt of state.log.recent) {
    const row = document.createElement('li');
    const destination = document.createElement('div'); destination.className = 'destination';
    const title = document.createElement('strong');
    const subtitle = document.createElement('small');
    let url: URL | null = null;
    try { if (attempt.url) url = new URL(attempt.url); } catch { /* Display the unavailable state. */ }
    title.textContent = url?.hostname || 'Destino no recuperable';
    subtitle.textContent = attempt.kind === 'form' ? 'Formulario · no se reproducen sus datos' : url?.pathname || 'Ventana sin dirección HTTP(S)';
    destination.append(title, subtitle); row.append(destination);
    if (attempt.recoverable) {
      const button = document.createElement('button'); button.className = 'attempt-action'; button.textContent = 'Permitir una vez';
      button.setAttribute('aria-label', `Abrir ${url?.hostname || 'este destino'} una vez`);
      button.addEventListener('click', () => { perform(() => request({ type: 'OPEN_ATTEMPT', tabId, id: attempt.id })); });
      row.append(button);
    }
    $('attempts').append(row);
  }
  setBusy(busy);
}
async function refresh() {
  if (tabId === null) return;
  const number = ++refreshNumber;
  const next = await request({ type: 'GET_STATE', tabId });
  if (number !== refreshNumber) return;
  state = next; render();
}
async function perform(action: () => Promise<any>) {
  if (busy) return;
  setBusy(true); notice('');
  try {
    const result = await action();
    if (result?.reloadErrors?.length) notice('La configuración se guardó, pero alguna pestaña no pudo recargarse. Recargala para completar el cambio.');
  } catch (error) { notice(error instanceof Error ? error.message : 'No se pudo aplicar el cambio.'); }
  finally {
    try { await refresh(); } catch (error) { notice(error instanceof Error ? error.message : 'No se pudo actualizar el estado.'); }
    setBusy(false);
  }
}
function authorizeSite(enable: boolean) {
  if (!state?.host || busy) return;
  const host = state.host;
  // The permission request must be invoked directly in the user's gesture,
  // before awaiting messaging or a refresh.
  const permission = !state.permission ? chrome.permissions.request({ origins: siteOrigins(host) }) : Promise.resolve(true);
  perform(async () => {
    if (!await permission) throw Error('No se activó el sitio: falta autorizar su acceso en Chrome.');
    return request(enable ? { type: 'SET_SITE', tabId, host, enabled: true } : { type: 'RETRY' });
  });
}
globalSwitch.addEventListener('change', () => {
  const enabled = globalSwitch.checked;
  perform(() => request({ type: 'SET_ENABLED', enabled }));
});
siteSwitch.addEventListener('change', () => {
  if (siteSwitch.checked) authorizeSite(true);
  else { const host = state?.host; perform(() => request({ type: 'SET_SITE', tabId, host, enabled: false })); }
});
$('permissionButton').addEventListener('click', () => authorizeSite(false));
$('retryButton').addEventListener('click', () => { perform(() => request({ type: 'RETRY' })); });
$('reloadButton').addEventListener('click', () => { perform(() => request({ type: 'RELOAD_TAB', tabId })); });
function scheduleRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => { refresh().catch(() => {}); }, 100);
}
chrome.storage.onChanged.addListener(scheduleRefresh);
chrome.tabs.onUpdated.addListener((id: number) => { if (id === tabId) scheduleRefresh(); });
(async () => {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!Number.isInteger(tabs[0]?.id)) throw Error('No hay una pestaña disponible.');
    tabId = tabs[0].id;
    await refresh();
  } catch (error) { notice(error instanceof Error ? error.message : 'No se pudo abrir el menú.'); }
})();
