import { normalizeSettings, type Settings } from '../shared/policy.ts';

type Storage = { get(key: string): Promise<Record<string, unknown>>; set(value: Record<string, unknown>): Promise<void> };
export function createSettingsStore(storage: Storage, apply: (next: Settings) => Promise<void>) {
  let queue: Promise<unknown> = Promise.resolve();
  const readSettings = async (): Promise<Settings> => normalizeSettings((await storage.get('settings')).settings);
  return {
    readSettings,
    updateSettings(mutate: (settings: Settings) => Settings): Promise<Settings> {
      const update = queue.then(async () => {
        const previous = await readSettings();
        const next = normalizeSettings(mutate(structuredClone(previous)));
        if (next.sites.length > 500) throw Error('Podés proteger hasta 500 sitios.');
        await apply(next);
        try { await storage.set({ settings: next }); }
        catch (error) {
          try { await apply(previous); }
          catch { throw Error('No se pudo guardar ni restaurar la configuración. Abrí el menú para reintentar.'); }
          throw error;
        }
        return next;
      });
      queue = update.catch(() => {});
      return update;
    },
  };
}
