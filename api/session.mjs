import {json,failure,AppError} from '../lib/config.mjs';
export default async function handler(req,res){try{if(req.method!=='GET')throw new AppError('METHOD_NOT_ALLOWED',405);json(res,200,{authMode:'public',requiresLogin:false});}catch(e){failure(res,e);}}
