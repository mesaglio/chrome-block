import { readdir, readFile, access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..');
const build=spawnSync(process.execPath,['scripts/build.mjs'],{cwd:root,stdio:'inherit'});
if(build.status!==0)process.exit(1);
async function check(directory){
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const file=join(directory,entry.name);
    if(entry.isDirectory())await check(file);
    else if(entry.name.endsWith('.js')){
      if(spawnSync(process.execPath,['--check',file],{stdio:'inherit'}).status!==0)process.exit(1);
    }
  }
}
await check(join(root,'dist'));
const manifest=JSON.parse(await readFile(join(root,'dist/manifest.json'),'utf8'));
assert.equal(manifest.manifest_version,3);
for(const file of [manifest.background.service_worker,manifest.action.default_popup,...Object.values(manifest.icons)])await access(join(root,'dist',file));
assert.equal(manifest.host_permissions,undefined);
assert.equal(manifest.content_scripts,undefined);
console.log('Sintaxis JavaScript y archivos del manifiesto verificados. Esto no reemplaza tsc ni la validación de Chrome.');
