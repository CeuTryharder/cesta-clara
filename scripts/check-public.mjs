import {readdir,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve,relative,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertPublicSnapshot} from '../collectors/public-snapshot.js';

const skipped=new Set(['.git','node_modules','dist','runtime','coverage','.openai','.codex','.agents','.vscode','.idea']);
export function privateFile(path){
 const parts=path.replaceAll('\\','/').split('/'),name=parts.at(-1);
 return parts.some(p=>skipped.has(p))||name!=='.env.example'&&name.startsWith('.env')||/^browser-observed.*\.json$/.test(name)||/(?:diagnostic|diagnostico).*\.json$/i.test(name)||/\.(?:sqlite(?:-wal|-shm)?|db|pem|key|p12|pfx|har|mp4|webm|zip|log|tmp)$/i.test(name)||['.npmrc','Thumbs.db','.DS_Store'].includes(name);
}
const rules=[
 ['private-key',/-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g],
 ['provider-token',/\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|sk-(?:proj-)?[A-Za-z0-9_-]{35,}|xox[baprs]-[A-Za-z0-9-]{25,}|(?:AKIA|ASIA)[A-Z0-9]{16})\b/g],
 ['jwt',/\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g],
 ['secret-literal',/["']?(?:api[_-]?key|access[_-]?token|secret|password|authorization)["']?\s*[:=]\s*["'][^"'\n]{12,}["']/gi],
 ['personal-path',/(?:[A-Z]:[/\\]+Users[/\\]+[^/\\\s"']+|\/Users\/[^/\s"']+)/gi],
 ['personal-deployment',/appgprj_[A-Za-z0-9]+|[A-Za-z0-9.-]+\.chatgpt\.site/g],
 ['email',/[\w.+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g]
];
export function scanText(text,path){
 const findings=[];
 for(const [type,pattern] of rules){
  for(const match of text.matchAll(pattern)){
   if(type==='email'&&/@(?:users\.noreply\.github\.com|example\.(?:com|org|test))$/i.test(match[0]))continue;
   findings.push({path,type,line:text.slice(0,match.index).split('\n').length});
  }
 }
 return findings;
}
async function files(root,current=root){
 const result=[];
 for(const entry of await readdir(current,{withFileTypes:true})){
  const path=resolve(current,entry.name),rel=relative(root,path).replaceAll('\\','/');
  if(privateFile(rel))continue;
  if(entry.isSymbolicLink())throw new Error('No se permiten enlaces simbólicos en la distribución: '+rel);
  if(entry.isDirectory())result.push(...await files(root,path));else if(entry.isFile())result.push(path);
 }
 return result;
}
export async function checkPublic(root,{history=false}={}){
 root=resolve(root);let findings=[],count=0,blobs=0,commits=0;
 for(const file of await files(root)){if(file.endsWith('.png'))continue;findings.push(...scanText(await readFile(file,'utf8'),relative(root,file)));count++;}
 const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024,stdio:['pipe','pipe','pipe']});
 let ownRepo=false;try{ownRepo=resolve(git('rev-parse','--show-toplevel').trim())===root;}catch{}
 if(ownRepo){
  for(const file of git('ls-files','-z').split('\0').filter(Boolean))if(privateFile(file))findings.push({path:file,type:'private-tracked-file'});
  if(history){
   for(const line of git('rev-list','--objects','--all').trim().split('\n').filter(Boolean)){
    const space=line.indexOf(' ');if(space<0)continue;
    const sha=line.slice(0,space),path=line.slice(space+1);
    if(git('cat-file','-t',sha).trim()!=='blob')continue;
    blobs++;if(privateFile(path))findings.push({path:sha.slice(0,10)+':'+path,type:'private-historical-file'});
    if(!path.endsWith('.png'))findings.push(...scanText(git('cat-file','blob',sha),sha.slice(0,10)+':'+path));
   }
   for(const sha of git('rev-list','--all').trim().split('\n').filter(Boolean)){commits++;findings.push(...scanText(git('show','-s','--format=%an <%ae>%n%cn <%ce>%n%B',sha),'commit:'+sha.slice(0,10)));}
  }
 }else if(history)throw new Error('La revisión del historial requiere la raíz de su propio repositorio.');
 assertPublicSnapshot(JSON.parse(await readFile(resolve(root,'data/dia-latest.json'),'utf8')));
 return {files:count,historyBlobs:blobs,commits,findings};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const report=await checkPublic(process.cwd(),{history:process.argv.includes('--history')});console.log(JSON.stringify(report,null,2));if(report.findings.length)process.exitCode=1;}
 catch(error){console.error(error.message);process.exitCode=1;}
}
