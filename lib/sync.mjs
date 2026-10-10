import {sources,fingerprint,AppError} from './config.mjs';import {get,lock,commit,unlock,finalize} from './store.mjs';import {notion} from './notion.mjs';import {normalize,materialize,id} from './calendar-data.mjs';
export async function validSnapshot(){const snap=await get('data');return snap?.schemaVersion===1&&snap.fingerprint===fingerprint()?snap:null;}
export async function synchronize({full=false,auto=false,budgetMs=40000,request=notion}={}){
 const owner=await lock();if(!owner)return{status:'busy'};
 let job;
 try{
  const cached=await validSnapshot();job=await get('job');
  if(job?.schemaVersion!==1||job?.fingerprint!==fingerprint()||job?.status==='complete'||full&&job?.mode==='incremental')job=null;
  if(!job&&auto&&cached&&Date.now()-Date.parse(cached.lastCheckedAt)<300000)return{status:'skipped',lastCheckedAt:cached.lastCheckedAt};
  if(!job){const startedAt=new Date().toISOString();const reconcile=full||!cached||Date.now()-Date.parse(cached.lastReconciledAt||0)>21600000;
   if(sources().some(([,v])=>!/^[a-f0-9]{32}$/.test(id(v))))throw new AppError('DATA_SOURCE_IDS_REQUIRED');
   job={schemaVersion:1,fingerprint:fingerprint(),startedAt,mode:reconcile?'full':'incremental',kindIndex:0,cursor:null,pending:[],records:reconcile?{}:structuredClone(cached.rawRecords),lastReconciledAt:cached?.lastReconciledAt||null,watermark:cached?.watermark||null,status:'running',pages:0,error:null};await commit(owner,'job',job);
  }
  const deadline=Date.now()+Math.min(40000,budgetMs);job.status='running';job.error=null;
  while(Date.now()<deadline-3500){
   if(job.pending.length){const task=job.pending[0];const qs=new URLSearchParams({page_size:'100',...(task.cursor?{start_cursor:task.cursor}:{})});const body=await request(`/pages/${task.recordId}/properties/${encodeURIComponent(decodeURIComponent(task.propertyId))}?${qs}`,null,deadline);if(!Array.isArray(body.results)||typeof body.has_more!=='boolean'||body.has_more&&!body.next_cursor)throw new AppError('INVALID_NOTION_RESPONSE');task.ids.push(...body.results.map(x=>id(x.relation?.id)).filter(Boolean));if(body.has_more)task.cursor=body.next_cursor;else{job.records[task.recordId]._relations[task.key]=[...new Set(task.ids)];job.pending.shift();}await commit(owner,'job',job);continue;}
   if(job.kindIndex>=sources().length){
    const finishedAt=new Date().toISOString();const payload=materialize(job.records,finishedAt);const before=cached?.payload.records||[];const added=payload.records.filter(r=>!before.some(x=>x.id===r.id)).length,deleted=before.filter(r=>!job.records[r.id]).length;
    const snapshot={schemaVersion:1,fingerprint:fingerprint(),watermark:job.startedAt,lastCheckedAt:finishedAt,lastReconciledAt:job.mode==='full'?finishedAt:job.lastReconciledAt,rawRecords:job.records,payload};
    const completedJob={...job,status:'complete',completedAt:finishedAt,records:{},error:null};await finalize(owner,snapshot,completedJob);job=completedJob;return{status:'complete',added,deleted,counts:payload.meta.counts,lastCheckedAt:finishedAt};
   }
   const [kind,source]=sources()[job.kindIndex];const filter=job.mode==='incremental'&&job.watermark?{timestamp:'last_edited_time',last_edited_time:{after:new Date(Date.parse(job.watermark)-2000).toISOString()}}:null;
   const body=await request(`/data_sources/${source}/query`,{page_size:100,...(filter?{filter}:{}),...(job.cursor?{start_cursor:job.cursor}:{})},deadline);
   if(!Array.isArray(body.results)||typeof body.has_more!=='boolean'||body.has_more&&!body.next_cursor)throw new AppError('INVALID_NOTION_RESPONSE');
   const updates=body.results.map(page=>page.archived||page.in_trash?{deleted:id(page.id)}:normalize(page,kind));
   for(const item of updates){if(item.deleted)delete job.records[item.deleted];else{job.records[item.record.id]=item.record;job.pending.push(...item.pending);}}
   job.pages++;if(body.has_more)job.cursor=body.next_cursor;else{job.kindIndex++;job.cursor=null;}await commit(owner,'job',job);
  }
  job.status='paused';await commit(owner,'job',job);return{status:'paused',sourceIndex:job.kindIndex,pages:job.pages,pendingRelations:job.pending.length};
 }catch(error){if(job){job.status=error.message==='SYNC_PAUSED'?'paused':'error';job.error=error instanceof AppError?error.message:'SYNC_FAILED';try{await commit(owner,'job',job);}catch{}if(job.status==='paused')return{status:'paused',sourceIndex:job.kindIndex,pages:job.pages};}throw error;
 }finally{try{await unlock(owner);}catch{}}
}
