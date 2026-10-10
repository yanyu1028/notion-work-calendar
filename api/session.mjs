import {requireUser} from '../lib/auth.mjs';import {json,failure,AppError} from '../lib/config.mjs';
export default async function handler(req,res){try{if(req.method!=='GET')throw new AppError('METHOD_NOT_ALLOWED',405);const value=requireUser(req);json(res,200,{csrf:value.csrf,expiresAt:value.exp});}catch(e){failure(res,e);}}
