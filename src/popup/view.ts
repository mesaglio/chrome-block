export function statusFor(state: any): { tone: string; title: string; description: string } {
  if (!state.host) return { tone: 'off', title: 'Página no compatible', description: 'Abrí una página web para elegir dónde bloquear pestañas.' };
  if (state.error) return { tone: 'warning', title: 'No se pudo aplicar el cambio', description: state.error };
  if (state.pending) return { tone: 'warning', title: 'Recarga pendiente', description: 'La página conserva su estado anterior hasta terminar de recargarse.' };
  if (!state.settings.enabled) return { tone: 'off', title: 'Protección general apagada', description: 'Tus sitios quedan guardados para cuando la vuelvas a prender.' };
  if (!state.selected) return { tone: 'off', title: 'Este sitio está sin protección', description: 'Activá el interruptor de abajo cuando quieras frenar sus nuevas pestañas.' };
  if (!state.permission) return { tone: 'warning', title: 'Falta el permiso del sitio', description: 'Autorizá el acceso para aplicar el bloqueo. Si antes estaba activo, recargá para quitar la restricción anterior.' };
  if (!state.configured) return { tone: 'warning', title: 'Configuración pendiente', description: 'Reintentá aplicar la protección antes de seguir.' };
  if (state.controlled) return { tone: 'warning', title: 'Cobertura parcial', description: 'Esta página carga contenido de una forma que puede eludir el bloqueo del navegador. Algunos intentos pueden pasar.' };
  return { tone: 'on', title: 'Bloqueo configurado', description: 'Las nuevas pestañas de este sitio quedan restringidas al cargar la página.' };
}
