import {randomUUID} from 'node:crypto';
import {prefix,development,AppError} from './config.mjs';
const mem=new Map();const clean=k=>{const x=mem.get(k);if(x?.expires&&x.expires<=Date.now())mem.delete(k);return mem.get(k)?.value??null;};
export async function command(args){
 const url=process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL;
 const token=process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN;
 if(url&&token){try{const r=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error();const body=await r.json();if(body.error)throw Error();return body.result;}catch{throw new AppError('CACHE_UNAVAILABLE');}}
 if(!development())throw new AppError('PERSISTENT_CACHE_REQUIRED');
 const [op,key,...rest]=args;if(op==='GET')return clean(key);if(op==='DEL')return mem.delete(key)?1:0;
 if(op==='SET'){if(rest.includes('NX')&&clean(key)!==null)return null;const px=rest.indexOf('PX'),ex=rest.indexOf('EX');mem.set(key,{value:rest[0],expires:px>=0?Date.now()+Number(rest[px+1]):ex>=0?Date.now()+Number(rest[ex+1])*1000:0});return 'OK';}
 if(op==='INCR'){const n=Number(clean(key)||0)+1,old=mem.get(key);mem.set(key,{value:String(n),expires:old?.expires||0});return n;}
 if(op==='EXPIRE'){const old=mem.get(key);if(old)old.expires=Date.now()+Number(rest[0])*1000;return old?1:0;}
 throw new AppError('UNSUPPORTED_LOCAL_STORE_COMMAND');
}
export const get=async suffix=>{const text=await command(['GET',prefix()+':'+suffix]);return text===null?null:JSON.parse(text);};
export const put=async(suffix,value)=>command(['SET',prefix()+':'+suffix,JSON.stringify(value)]);
export const lock=async()=>{const owner=randomUUID();return await command(['SET',prefix()+':lock',owner,'NX','PX',75000])==='OK'?owner:null;};
export async function commit(owner,suffix,value){
 const key=prefix();if(development()&&!(process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL)){if(clean(key+':lock')!==owner)throw new AppError('LOCK_LOST',409);await put(suffix,value);await command(['SET',key+':lock',owner,'PX',75000]);return;}
 const ok=await command(['EVAL',"if redis.call('GET',KEYS[1]) == ARGV[1] then redis.call('SET',KEYS[2],ARGV[2]);redis.call('PEXPIRE',KEYS[1],75000);return 1 else return 0 end",2,key+':lock',key+':'+suffix,owner,JSON.stringify(value)]);if(ok!==1)throw new AppError('LOCK_LOST',409);
}
export async function unlock(owner){if(!owner)return;const key=prefix()+':lock';if(development()&&!(process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL)){if(clean(key)===owner)mem.delete(key);return;}await command(['EVAL',"if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end",1,key,owner]);}
export async function rateLimit(key,limit,seconds){const full=prefix()+':rate:'+key;let n;if(development()&&!(process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL)){n=await command(['INCR',full]);if(n===1)await command(['EXPIRE',full,seconds]);}else{n=await command(['EVAL',"local n=redis.call('INCR',KEYS[1]);if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end;return n",1,full,seconds]);}if(n>limit)throw new AppError('RATE_LIMITED',429);}

export async function finalize(owner,snapshot,job){
 const key=prefix();if(development()&&!(process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL)){if(clean(key+':lock')!==owner)throw new AppError('LOCK_LOST',409);await put('data',snapshot);await put('job',job);return;}
 const ok=await command(['EVAL',"if redis.call('GET',KEYS[1]) == ARGV[1] then redis.call('SET',KEYS[2],ARGV[2]);redis.call('SET',KEYS[3],ARGV[3]);return 1 else return 0 end",3,key+':lock',key+':data',key+':job',owner,JSON.stringify(snapshot),JSON.stringify(job)]);if(ok!==1)throw new AppError('LOCK_LOST',409);
}
