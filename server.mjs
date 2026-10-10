import http from 'node:http';import {fileURLToPath} from 'node:url';import {resolve} from 'node:path';
import site from './api/site.mjs';import calendar from './api/calendar.mjs';import sync from './api/sync.mjs';import session from './api/session.mjs';import login from './api/login.mjs';import logout from './api/logout.mjs';import diagnostics from './api/diagnostics.mjs';
const handlers={'/api/calendar':calendar,'/api/sync':sync,'/api/session':session,'/api/login':login,'/api/logout':logout,'/api/diagnostics':diagnostics};
export const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://local');(handlers[url.pathname]||site)(req,res);});
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))server.listen(Number(process.env.PORT||3000),process.env.HOST||'127.0.0.1',()=>console.log('Calendar server ready; private data endpoints require login.'));
