# Chrome Block

Una extensión de Chrome para frenar nuevas pestañas en los sitios que elijas. No protege ningún sitio al instalarla.

## Instalar para probar

La carpeta `dist/` es la extensión lista para cargar, después de compilar:

1. Abrí `chrome://extensions` y activá **Modo de desarrollador**.
2. Elegí **Cargar descomprimida** y seleccioná la carpeta `dist` de este proyecto.
3. Fijá Chrome Block en la barra de extensiones.
4. Visitá una página, abrí el menú de Chrome Block y prendé **Proteger este sitio**.
5. Aceptá el acceso a ese sitio. Sus pestañas abiertas se recargarán para aplicar la restricción.

El permiso cubre HTTP y HTTPS del hostname elegido; no se pide acceso a todos los sitios. Los subdominios se activan por separado. Los reproductores externos heredan la restricción de la página principal cuando Chrome aplica la política a su respuesta.

## Uso

- **Protección general:** pausa o reactiva los sitios guardados. Recarga sus pestañas abiertas; puede reiniciar un video o perder cambios sin guardar.
- **Proteger este sitio:** recuerda el hostname de la página actual. Incluye la página y sus reproductores cuando la restricción de navegador está aplicada.
- **Permitir una vez:** abre manualmente una dirección HTTP(S) del registro. No crea una excepción permanente. Formularios y ventanas sin una URL recuperable quedan excluidos.
- **Recarga pendiente / falta permiso:** la preferencia no equivale a protección aplicada. Usá la acción indicada en el menú.

El contador muestra **intentos registrados**, no un total auditado de todas las aperturas. Los frames de terceros y los intentos tempranos pueden quedar bloqueados sin aparecer en el registro. Los últimos 20 destinos de cada pestaña se guardan en `chrome.storage.session`, memoria de la sesión de Chrome; se borran al navegar o cerrar la pestaña. Las preferencias usan `chrome.storage.local`. No hay telemetría, servidores ni cuentas.

## Desarrollo

Requiere Node **24 o posterior**. No usa dependencias de npm ni instalación de paquetes.

```sh
node --run test
node --run build
node --run check
```

`build` elimina y vuelve a crear `dist/`, copia los recursos y elimina la sintaxis de tipos con el soporte nativo de Node. `check` compila, comprueba la sintaxis de JavaScript y los archivos del manifiesto; **no es un chequeo de tipos con tsc ni una validación dentro de Chrome**. Node puede emitir una advertencia experimental por su API de eliminación de tipos.

En la máquina de esta sesión, Node está disponible en:

```sh
node --test tests/*.test.mjs
node scripts/build.mjs
node scripts/check.mjs
```

Para regenerar los iconos: `python3 scripts/icons.py`. Los PNG están incluidos, no es necesario hacerlo para compilar.

### Organización

- `src/background/`: reglas, preferencias, mensajes, recarga y registros por pestaña.
- `src/content/`: interceptación de aperturas y registro en documentos con acceso concedido.
- `src/popup/`: menú accesible en español.
- `tests/`: pruebas de política, aplicación, recuperación, persistencia y fallback. Las APIs externas de Chrome y el DOM se simulan en las pruebas que las necesitan.
- `tests/fixtures/sandbox.html`: prueba manual de herencia de sandbox; no valida DNR ni la extensión instalada.
- `scripts/fixture-server.mjs`: servidor para comprobar una respuesta real con CSP y frames de otro origen. Con `node --run fixtures`, visitá `http://localhost:8765/protected`.

## Cómo bloquea y límites

La defensa principal agrega una cabecera `Content-Security-Policy: sandbox …` a las respuestas del documento principal de los sitios activados, mediante `declarativeNetRequest`. Conserva las cabeceras CSP del sitio y permite scripts, formularios, origen, descargas, presentación y navegación normal; no concede `allow-popups`. La restricción de navegador se hereda a frames descendientes y no depende de que el service worker de la extensión responda antes de cada apertura. Quitarla requiere recargar la página; por eso los interruptores recargan las pestañas afectadas.

Un hook en el contexto MAIN sirve de respaldo y registra aperturas de `window.open`, enlaces a nuevas ventanas, clics modificados y formularios en los documentos donde se concedió acceso. Esa parte se inicializa de forma asíncrona, puede ser manipulada por una página y no garantiza protección temprana por sí sola. Nunca autoriza acciones privilegiadas: abrir un destino requiere un clic en el menú de la extensión.

**Limitaciones relevantes:**

- Una página servida por su propio service worker o CacheStorage puede evitar que Chrome modifique la respuesta. El menú muestra cobertura parcial cuando detecta un controlador de ese tipo. No se garantiza bloquear todo intento.
- La restricción puede afectar aperturas legítimas, logins, pagos o ciertas funciones del sitio. Apagá la protección del sitio si necesitás recuperarlas.
- No se eliminan capas publicitarias invisibles ni se garantiza que el primer clic llegue al reproductor.
- No se interceptan los controles propios de Chrome, extensiones ajenas ni redirecciones ordinarias de la misma pestaña.
- Si Chrome revoca un permiso, una página ya cargada puede conservar la restricción anterior hasta recargarla.
- Requiere Chrome 120+. No se publicó en Chrome Web Store.

## Estado de validación

Las pruebas automatizadas de Node y el chequeo del paquete son ejecutables con los comandos anteriores. La carga de la extensión, las reglas DNR efectivas, reproducción/pantalla completa, los permisos reales y la revisión visual del menú **requieren prueba manual en Chrome**. El entorno de ejecución de esta sesión bloqueó el inicio de Chrome headless y el servidor local; la política del navegador conectado también bloqueó abrir archivos `file:`. No se afirma que esas pruebas de navegador hayan pasado.

Ver detalles en `docs/research/chrome-feasibility.md`.
