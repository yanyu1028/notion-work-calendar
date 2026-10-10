import {json,failure,AppError} from '../lib/config.mjs';import {validSnapshot} from '../lib/sync.mjs';
export default async function handler(req,res){try{if(req.method!=='GET')throw new AppError('METHOD_NOT_ALLOWED',405);const snap=await validSnapshot();if(!snap)return json(res,409,{error:'BOOTSTRAP_REQUIRED'});json(res,200,snap.payload);}catch(e){failure(res,e);}}
