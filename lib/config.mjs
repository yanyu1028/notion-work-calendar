import {createHash} from 'node:crypto';
export const sources=()=>[
 ['project',process.env.PROJECT_DATA_SOURCE_ID],['task',process.env.TASK_DATA_SOURCE_ID],['note',process.env.NOTE_DATA_SOURCE_ID]
];
export const fingerprint=()=>createHash('sha256').update(JSON.stringify([sources(),process.env.NOTE_DATE_PROPERTY||'创建日期','Asia/Shanghai','mapping-v1'])).digest('hex');
export const prefix=()=>{const key=process.env.CALENDAR_CACHE_KEY||'notion-calendar:v1:snapshot';if(!/^notion-calendar:[\w:-]+$/.test(key))throw new Error('INVALID_CALENDAR_CACHE_KEY');return key;};
function validOrigin(value){const url=new URL(value);if(url.username||url.password||!['http:','https:'].includes(url.protocol)||url.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.pathname!=='/'||url.search||url.hash)throw new Error('APP_URL_MUST_BE_ORIGIN');return url.origin;}
export const allowedOrigins=()=>{if(process.env.APP_URL)return [validOrigin(process.env.APP_URL)];const hosts=[process.env.VERCEL_URL,...(process.env.VERCEL_ENV==='production'?[process.env.VERCEL_PROJECT_PRODUCTION_URL]:[])].filter(Boolean);if(!hosts.length)throw new Error('APP_URL_REQUIRED');return [...new Set(hosts.map(host=>validOrigin('https://'+host)))];};
export const origin=()=>allowedOrigins().at(-1);
export const development=()=>process.env.NODE_ENV==='development'&&process.env.ALLOW_MEMORY_CACHE==='true'&&!process.env.VERCEL;
export class AppError extends Error{constructor(code,status=503){super(code);this.status=status;}}
export function json(res,status,value){res.setHeader('Cache-Control','private, no-store');res.setHeader('Content-Type','application/json; charset=utf-8');res.statusCode=status;res.end(JSON.stringify(value));}
export function failure(res,error){json(res,error.status||503,{error:error instanceof AppError?error.message:'SERVICE_UNAVAILABLE'});}
