import './build.mjs';
import {createLocalServer,LOCAL_HOST,LOCAL_PORT} from './local-server.mjs';
const {default:worker}=await import('../dist/server/index.js');
createLocalServer(worker).once('listening',()=>console.log('Local: http://'+LOCAL_HOST+':'+LOCAL_PORT));
