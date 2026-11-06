import {mkdir,readFile,rename,writeFile} from 'node:fs/promises';

export const localRuntime=new URL('../runtime/',import.meta.url);
const bundled=new URL('../data/dia-latest.json',import.meta.url);
// User-specific observations never overwrite the distributable public sample.
export async function readLocalSnapshot({directory=localRuntime,seed=bundled}={}){
 try{return JSON.parse(await readFile(new URL('snapshot.json',directory),'utf8'));}
 catch(error){if(error.code!=='ENOENT')throw error;return JSON.parse(await readFile(seed,'utf8'));}
}
export async function writeLocalSnapshot(snapshot,{directory=localRuntime}={}){
 await mkdir(directory,{recursive:true});
 const temporary=new URL('snapshot.tmp',directory);
 await writeFile(temporary,JSON.stringify(snapshot,null,2)+'\n');
 await rename(temporary,new URL('snapshot.json',directory));
}
