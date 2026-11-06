import './build.mjs';
import {createServer} from 'node:http';
const {default:worker}=await import('../dist/server/index.js');
createServer(async(req,res)=>{try{
 const chunks=[];for await(const chunk of req) chunks.push(chunk);
 const request=new Request('http://localhost:4173'+req.url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})});
 const response=await worker.fetch(request,{});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
}catch{res.writeHead(500);res.end('Error interno');}}).listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173'));
