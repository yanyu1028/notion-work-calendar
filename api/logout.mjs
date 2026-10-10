import {requireMutation,clearSession} from '../lib/auth.mjs';import {json,failure} from '../lib/config.mjs';
export default async function handler(req,res){try{requireMutation(req);clearSession(res);json(res,200,{ok:true});}catch(e){failure(res,e);}}
