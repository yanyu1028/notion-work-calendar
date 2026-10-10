import {AppError,fingerprint} from './config.mjs';
export const id=v=>String(v||'').replaceAll('-','').toLowerCase();
export const pageUrl=value=>'https://www.notion.so/'+id(value);
const property=(page,names)=>names.map(n=>page.properties?.[n]).find(Boolean);
const plain=items=>(Array.isArray(items)?items:[]).map(x=>x.plain_text||x.text?.content||'').join('');
const text=(page,names)=>{const p=property(page,names);if(!p)return '';if(p.people)return p.people.map(x=>x.name||'未设置').join('、');return plain(p.title||p.rich_text)||p.select?.name||p.status?.name||p.formula?.string||'';};
export function dateOnly(value){if(!value)return null;if(/^\d{4}-\d{2}-\d{2}$/.test(value)){const d=new Date(value+'T00:00:00Z');return !Number.isNaN(+d)&&d.toISOString().slice(0,10)===value?value:null;}const date=new Date(value);if(Number.isNaN(+date))return null;return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
function date(page,names){const p=property(page,names);return p?.date||p?.formula?.date||(p?.created_time?{start:p.created_time}:{});}
const aliases={projects:['项目关联','所属项目','关联项目'],tasks:['任务关联','关联任务'],notes:['笔记关联','关联笔记']};
export function normalize(page,kind){
 if(!/^[a-f0-9]{32}$/.test(id(page.id)))throw new AppError('INVALID_NOTION_RECORD');
 const range=date(page,['任务周期','日期']);const start=kind==='note'?date(page,[process.env.NOTE_DATE_PROPERTY||'创建日期']).start:date(page,['开始日期','起始日期']).start||range.start;
 const due=kind==='note'?null:date(page,['截止日期','到期日期']).start||range.end;
 const record={id:id(page.id),kind,url:pageUrl(page.id),title:text(page,[kind==='project'?'项目名称':kind==='task'?'任务名称':'笔记名称','名称','Name'])||'未命名',start_date:dateOnly(start),due_date:dateOnly(due),status:kind==='note'?null:text(page,['状态'])||'未设置',priority:kind==='note'?null:text(page,['优先级'])||null,category:text(page,[kind==='project'?'项目类别':kind==='task'?'任务类别':'笔记类型','类别'])||'未设置',description:text(page,[kind==='project'?'项目描述':'任务描述','描述'])||null,remark:text(page,['备注'])||null,summary:kind==='note'?text(page,['摘要','笔记摘要','内容摘要'])||null:null,requester:text(page,['需求人','需求方','发起人'])||null,people:text(page,['人员安排','负责人','执行人']).split('、').filter(Boolean),last_edited_time:page.last_edited_time||'',completion:property(page,['完成度','进度'])?.number??null,_relations:{},_invalid_dates:Number(Boolean(start)&&!dateOnly(start))+Number(Boolean(due)&&!dateOnly(due))};
 const pending=[];for(const [key,names]of Object.entries(aliases)){const p=property(page,names);record._relations[key]=(p?.relation||[]).map(x=>id(x.id));if(p?.has_more){if(!p.id)throw new AppError('RELATION_PROPERTY_ID_MISSING');pending.push({recordId:record.id,key,propertyId:p.id,cursor:null,ids:[]});}}
 record.invalid_range=!!(record.start_date&&record.due_date&&record.start_date>record.due_date);return{record,pending};
}
export function materialize(records,generatedAt){
 const result=Object.values(records).map(raw=>{const {_relations,_invalid_dates,...record}=raw;return{...record,projects:(_relations.projects||[]).map(pageUrl),related:[...new Set([...(_relations.tasks||[]),...(_relations.notes||[])])].map(pageUrl),effective_projects:[],inherited_projects:[]};});
 const byId=new Map(result.map(r=>[r.id,r]));
 for(const r of result)if(r.kind==='project'){for(const target of r.related){const t=byId.get(target.split('/').pop());if(['task','note'].includes(t?.kind)&&!t.projects.includes(r.url))t.projects.push(r.url);}}
 for(const r of result)if(r.kind==='task'){for(const target of r.related){const n=byId.get(target.split('/').pop());if(n?.kind==='note'&&!n.related.includes(r.url))n.related.push(r.url);}}
 for(const r of result){const inherited=r.kind==='note'?r.related.flatMap(url=>{const t=byId.get(url.split('/').pop());return t?.kind==='task'?t.projects:[];}):[];r.inherited_projects=[...new Set(inherited)].filter(url=>!r.projects.includes(url));r.effective_projects=[...new Set([...r.projects,...inherited])];}
 const local=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(generatedAt));
 const time=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(generatedAt));
 const counts=Object.fromEntries(['project','task','note'].map(k=>[k,result.filter(r=>r.kind===k).length]));
 return{records:result,meta:{snapshot_date:local,snapshot_time:time,timezone:'Asia/Shanghai',counts,generatedAt,sourceFingerprint:fingerprint(),version:'online-1.0.0',date_anomalies:result.filter(r=>r.invalid_range).length,missing_start:result.filter(r=>!r.start_date).length,missing_due:result.filter(r=>r.kind!=='note'&&!r.due_date).length,invalid_date_values:Object.values(records).reduce((n,r)=>n+(r._invalid_dates||0),0),unknown_statuses:[...new Set(result.filter(r=>r.kind!=='note'&&!['进行中','未开始','已归档'].includes(r.status)).map(r=>r.status))]}};
}
