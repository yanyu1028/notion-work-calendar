import {json} from '../lib/config.mjs';
// Tombstone endpoint retained so replacing existing GitHub files is enough.
export default function handler(req,res){json(res,410,{error:'LOGIN_REMOVED',message:'应用登录已移除，请直接打开首页。'});}
