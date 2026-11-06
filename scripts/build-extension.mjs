import {mkdir,copyFile,readFile,writeFile,cp} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {assertPublicSnapshot} from '../collectors/public-snapshot.js';
const root=new URL('../',import.meta.url);
const args=process.argv.slice(2);
if(args.length&&!(args.length===2&&args[0]==='--out'))throw new Error('Uso: node scripts/build-extension.mjs [--out directorio]');
const target=args.length?pathToFileURL(resolve(args[1])+'/'):new URL('dist/extension/',root);
const snapshot=assertPublicSnapshot(JSON.parse(await readFile(new URL('data/dia-latest.json',root),'utf8')));
await mkdir(target,{recursive:true});await cp(new URL('extension/',root),target,{recursive:true});
for(const file of ['delivery.js','engine.js','matching.js','observed.js','collectors/discovery.js','collectors/query.js','collectors/catalog-index.js','collectors/eroski-categories.js','collectors/lidl-categories.js','collectors/dia-categories.js','collectors/dia.js','collectors/sample.js','collectors/registry.js','collectors/normalize.js','collectors/retail-html.js','collectors/multi.js','collectors/browser-page.js']){
 const dest=new URL('shared/'+file,target);await mkdir(new URL('./',dest),{recursive:true});await copyFile(new URL(file,root),dest);
}
await mkdir(new URL('data/',target),{recursive:true});await writeFile(new URL('data/dia-latest.json',target),JSON.stringify(snapshot,null,2)+'\n');
const manifest=JSON.parse(await readFile(new URL('manifest.json',target)));
if(manifest.manifest_version!==3)throw new Error('Se requiere Manifest V3.');
for(const file of ['REVISION-'+manifest.version+'.md','CONSUMO.md','PRODUCT.md','DESIGN.md','LICENSE','PRIVACY.md','SECURITY.md','NOTICE.md'])await copyFile(new URL(file,root),new URL(file,target));
await copyFile(new URL('CHROME.md',root),new URL('INSTALAR.md',target));
console.log('Extensión preparada: '+fileURLToPath(target));
