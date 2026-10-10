import {AppError} from './config.mjs';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function notion(path,body,deadline=Date.now()+30000){
 const token=process.env.NOTION_API_TOKEN;if(!token)throw new AppError('NOTION_TOKEN_REQUIRED');
 for(let attempt=0;attempt<3;attempt++){
  if(deadline-Date.now()<3000)throw new AppError('SYNC_PAUSED');
  let response;try{response=await fetch('https://api.notion.com/v1'+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Notion-Version':'2025-09-03','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(Math.min(12000,deadline-Date.now()-500))});}catch{if(attempt===2)throw new AppError('NOTION_NETWORK_ERROR');await sleep(350*2**attempt);continue;}
  if(response.ok)return response.json();
  if([429,500,502,503,504].includes(response.status)&&attempt<2){const wait=Math.min(5000,Math.max(350,Number(response.headers.get('retry-after')||1)*1000));if(deadline-Date.now()<wait+3000)throw new AppError('SYNC_PAUSED');await sleep(wait);continue;}
  throw new AppError(`NOTION_HTTP_${response.status}`);
 }
 throw new AppError('NOTION_NETWORK_ERROR');
}
