import {createServer} from 'node:http';
export const LOCAL_HOST='127.0.0.1';
export const LOCAL_PORT=4173;
export function createLocalServer(worker,port=LOCAL_PORT){
 const server=createServer(async(req,res)=>{try{
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  const bound=server.address();
  const request=new Request('http://'+LOCAL_HOST+':'+(bound?.port||port)+req.url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})});
  const response=await worker.fetch(request,{});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(500);res.end('Error interno');}});
 server.listen(port,LOCAL_HOST);
 return server;
}
