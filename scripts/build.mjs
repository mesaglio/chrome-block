import { readdir, readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { resolve, relative, dirname, join } from 'node:path';
import { stripTypeScriptTypes } from 'node:module';

const root=resolve(import.meta.dirname,'..');
const dist=join(root,'dist');
await rm(dist,{recursive:true,force:true});
await mkdir(dist,{recursive:true});
await cp(join(root,'extension'),dist,{recursive:true});
async function compile(directory) {
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const source=join(directory,entry.name);
    if(entry.isDirectory()){await compile(source);continue;}
    const target=join(dist,relative(join(root,'src'),source).replace(/\.ts$/,'.js'));
    await mkdir(dirname(target),{recursive:true});
    if(entry.name.endsWith('.ts')){
      let code=stripTypeScriptTypes(await readFile(source,'utf8'),{mode:'strip'});
      code=code.replace(/(from\s+['"][^'"]+)\.ts(['"])/g,'$1.js$2');
      await writeFile(target,code);
    }else await cp(source,target);
  }
}
await compile(join(root,'src'));
console.log('Extensión compilada en dist/ (sin dependencias externas).');
