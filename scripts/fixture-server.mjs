import http from 'node:http';
const html = `<!doctype html><meta charset="utf-8"><title>Chrome Block · prueba de navegador</title>
<style>body{font:16px system-ui;max-width:850px;margin:40px auto;padding:20px}li{margin:10px 0}iframe{width:100%;height:200px}button,a{margin:8px}</style>
<h1>Prueba de aperturas</h1><p id="status">Preparando…</p><ul id="results"></ul>
<button id="open" onclick="window.open('/destination','_blank')">Abrir ventana</button>
<a href="/destination" target="_blank">Abrir enlace</a>
<form action="/destination" target="_blank"><button>Enviar formulario</button></form>
<iframe src="http://127.0.0.1:8765/frame"></iframe>
<iframe srcdoc="<button onclick=&quot;parent.postMessage({result:window.open('/destination')===null},'*')&quot;>Abrir desde srcdoc</button>"></iframe>
<script>
function result(name,ok){const li=document.createElement('li');li.textContent=(ok?'PASS ':'FAIL ')+name;document.querySelector('#results').append(li)}
const restricted=location.pathname==='/protected';
if(restricted){result('window.open temprano bloqueado',window.open('/destination')===null);}
window.addEventListener('message',e=>{if(typeof e.data?.result==='boolean')result('Frame: '+(e.data.name||'srcdoc'),e.data.result)});
document.querySelector('#status').textContent=restricted?'CSP de bloqueo activa.':'Sin protección: las aperturas deben funcionar.';
</script>`;
const server=http.createServer((req,res)=>{
  res.setHeader('content-type','text/html; charset=utf-8');
  res.setHeader('cache-control','no-store');
  if(req.url==='/protected')res.setHeader('content-security-policy','sandbox allow-same-origin allow-scripts allow-forms allow-downloads allow-modals allow-orientation-lock allow-pointer-lock allow-presentation allow-top-navigation allow-storage-access-by-user-activation');
  if(req.url==='/frame')res.end(`<button onclick="parent.postMessage({name:'cross-origin con clic',result:window.open('/destination')===null},'*')">Abrir desde frame externo</button><iframe srcdoc="<script>parent.parent.postMessage({name:'frame anidado temprano',result:window.open('/destination')===null},'*')<\/script>"></iframe><script>parent.postMessage({name:'cross-origin temprano',result:window.open('/destination')===null},'*')</script>`);
  else if(req.url==='/destination')res.end('<title>Destino de prueba</title><h1>Destino de prueba</h1>');
  else res.end(html);
});
server.listen(8765,'0.0.0.0',()=>console.log('Fixtures: http://localhost:8765/protected'));
