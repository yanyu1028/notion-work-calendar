// No application login or password. Public reads are intentional.
// These checks limit browser cross-origin sync and protect optional Cron, not data access.
import {timingSafeEqual} from 'node:crypto';
import {allowedOrigins,AppError} from './config.mjs';
export const equal=(a,b)=>{const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&timingSafeEqual(x,y);};
export function checkOrigin(req){if(!allowedOrigins().includes(req.headers.origin))throw new AppError('ORIGIN_REJECTED',403);}
export function requireMutation(req){if(req.method!=='POST')throw new AppError('METHOD_NOT_ALLOWED',405);checkOrigin(req);if(req.headers['x-calendar-request']!=='1')throw new AppError('REQUEST_HEADER_REQUIRED',403);}
export function cron(req){const value=process.env.CRON_SECRET;if(!value||value.length<32||!equal(req.headers.authorization||'',`Bearer ${value}`))throw new AppError('CRON_UNAUTHORIZED',401);}
