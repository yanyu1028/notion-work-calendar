import {AppError,fingerprint} from './config.mjs';
export const MAPPING_VERSION=2;
export const id=v=>String(v||'').replaceAll('-','').toLowerCase();
export const pageUrl=value=>'https://www.notion.so/'+id(value);
const pick=(page,names)=>{for(const name of names)if(page.properties?.[name])return {name,p:page.properties[name]};return {name:names[0],p:null};};
const plain=items=>(Array.isArray(items)?items:[]).map(x=>x.plain_text||x.text?.content||'').join('');
const infer=p=>p?.type||['title','rich_text','multi_select','people','select','status','date','formula','rollup','number','relation','files','created_time'].find(k=>p&&Object.hasOwn(p,k))||'unknown';
const empty=v=>v===null||v===undefined||v===''||Array.isArray(v)&&!v.length;
const safeUrl=v=>{try{const u=new URL(v);return u.protocol==='https:'?u.href:null;}catch{return null;}};
const users=p=>(p||[]).map(x=>({id:x.id||null,name:x.name||null}));
export function dateOnly(value){if(!value)return null;if(/^\d{4}-\d{2}-\d{2}$/.test(value)){const d=new Date(value+'T00:00:00Z');return !Number.isNaN(+d)&&d.toISOString().slice(0,10)===value?value:null;}const date=new Date(value);if(Number.isNaN(+date))return null;return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
function date(page,names){const p=pick(page,names).p;return p?.date||p?.formula?.date||(p?.created_time?{start:p.created_time}:{});}
const aliases={projects:['项目关联','所属项目','关联项目'],tasks:['任务关联','关联任务'],notes:['笔记关联','关联笔记']};
export function normalize(page,kind){
 if(!/^[a-f0-9]{32}$/.test(id(page.id)))throw new AppError('INVALID_NOTION_RECORD');
 const states={},issues=[],pending=[];
 function read(key,names,parse){const {name,p}=pick(page,names);if(!p){states[key]='missing';return null;}const type=infer(p);let value;try{value=parse(p,type);}catch{value=undefined;}
  if(value===undefined){states[key]='unsupported';issues.push({field:key,property:name,type,reason:'unsupported_type'});return null;}states[key]=empty(value)?'empty':'ok';return value;}
 function words(key,names){const value=read(key,names,(p,t)=>t==='title'?plain(p.title):t==='rich_text'?plain(p.rich_text):t==='select'?p.select?.name||null:t==='status'?p.status?.name||null:t==='formula'&&(!p.formula?.type||p.formula.type==='string')?p.formula?.string||null:undefined);const {p}=pick(page,names),type=infer(p);if(['title','rich_text'].includes(type)&&p.id&&(p.has_more||(p[type]||[]).length>=25)){pending.push({recordId:id(page.id),key,propertyId:p.id,cursor:null,type,items:[]});states[key]='partial';}return value;}
 function participants(key,names){const list=read(key,names,(p,t)=>t==='multi_select'?(p.multi_select||[]).map(x=>({id:x.id||null,name:x.name||null})):t==='people'?users(p.people):['rich_text','title'].includes(t)?(plain(p[t])?[{id:null,name:plain(p[t])}]:[]):undefined)||[];const {p,name}=pick(page,names);
  if(list.some(x=>!x.name)){states[key]='partial';issues.push({field:key,property:name,type:infer(p),reason:'name_unavailable'});}
  if(infer(p)==='people'&&(p.has_more||list.length>=25)&&p.id){pending.push({recordId:id(page.id),key,propertyId:p.id,cursor:null,type:'people',propertyName:name,items:[]});states[key]='partial';}return list;}
 const range=date(page,['任务周期','日期']);const start=kind==='note'?date(page,[process.env.NOTE_DATE_PROPERTY||'创建日期']).start:date(page,['开始日期','起始日期']).start||range.start;
 const due=kind==='note'?null:date(page,['截止日期','到期日期']).start||range.end;
 const peopleList=kind==='task'?participants('people',['人员安排','执行人']):[];
 const owners=kind!=='note'?participants('owners',['负责人']):[];
 const record={id:id(page.id),kind,url:pageUrl(page.id),mapping_version:MAPPING_VERSION,
  title:words('title',[kind==='project'?'项目名称':kind==='task'?'任务名称':'笔记名称','名称','Name'])||'未命名',
  start_date:dateOnly(start),due_date:dateOnly(due),status:kind==='note'?null:words('status',['状态'])||'未设置',priority:kind==='note'?null:words('priority',['优先级']),
  category:words('category',[kind==='project'?'项目类别':kind==='task'?'任务类别':'笔记类型','类别'])||'未设置',
  description:kind==='note'?null:words('description',[kind==='project'?'项目描述':'任务描述','描述']),remark:kind==='note'?null:words('remark',['备注']),
  summary:kind==='note'?words('summary',['摘要','笔记摘要','内容摘要']):null,note_content:kind==='note'?words('note_content',['笔记内容']):null,
  requester:kind==='task'?words('requester',['需求人','需求方','发起人']):null,
  people:peopleList.map(x=>x.name||'姓名未提供'),personnel:peopleList,owners,
  quadrant:kind==='task'?words('quadrant',['四象限']):null,remaining_source:kind==='task'?words('remaining_source',['剩余天数']):null,
  task_status:kind==='project'?words('task_status',['任务状态']):null,
  created_time:read('created_time',['创建时间'],(p,t)=>t==='created_time'?p.created_time:undefined)||page.created_time||null,
  last_edited_time:page.last_edited_time||'',
  completion:kind==='project'?read('completion',['完成度','进度'],(p,t)=>{let n=t==='number'?p.number:t==='formula'&&(!p.formula?.type||p.formula.type==='number')?p.formula?.number:t==='rollup'&&(!p.rollup?.type||p.rollup.type==='number')?p.rollup?.number:undefined;return n===null?null:typeof n==='number'&&Number.isFinite(n)?n:undefined;}):null,
  attachments:kind!=='note'?read('attachments',['附件'],(p,t)=>t==='files'?(p.files||[]).map(x=>({name:x.name||'附件',url:safeUrl(x.file?.url||x.external?.url),expiry_time:x.file?.expiry_time||null})):undefined)||[]:[],
  field_states:states,_field_issues:issues,_relations:{},_invalid_dates:Number(Boolean(start)&&!dateOnly(start))+Number(Boolean(due)&&!dateOnly(due))};
 for(const [key,names]of Object.entries(aliases)){const p=pick(page,names).p;record._relations[key]=(p?.relation||[]).map(x=>id(x.id));if(p?.has_more){if(!p.id)throw new AppError('RELATION_PROPERTY_ID_MISSING');pending.push({recordId:record.id,key,propertyId:p.id,cursor:null,type:'relation',ids:[]});}}
 for(const [key,names] of [['start_date',kind==='note'?[process.env.NOTE_DATE_PROPERTY||'创建日期']:['开始日期','起始日期']],['due_date',['截止日期','到期日期']]]){if(kind==='note'&&key==='due_date')continue;const {p,name}=pick(page,names),raw=key==='start_date'?start:due;states[key]=raw?record[key]?'ok':'invalid':p?'empty':'missing';if(raw&&!record[key])issues.push({field:key,property:name,type:infer(p),reason:'invalid_date'});else if(p&&!['date','formula','created_time'].includes(infer(p))) {states[key]='unsupported';issues.push({field:key,property:name,type:infer(p),reason:'unsupported_type'});}}
 if(kind==='project'){const {p,name}=pick(page,['完成度','进度']);if(infer(p)==='rollup'&&p.rollup?.type==='incomplete'&&p.id){pending.push({recordId:record.id,key:'completion',propertyId:p.id,cursor:null,type:'rollup'});states.completion='partial';record._field_issues=issues.filter(x=>x.field!=='completion');}else if(record.completion!==null&&(record.completion<0||record.completion>1)){states.completion='invalid';issues.push({field:'completion',property:name,type:infer(p),reason:'outside_percent_range'});}}
 if(record.created_time&&states.created_time==='missing')states.created_time='ok';
 record.invalid_range=!!(record.start_date&&record.due_date&&record.start_date>record.due_date);return{record,pending};
}
export function hydrateProperty(record,task,body){
 if(['title','rich_text'].includes(task.type)){if(!Array.isArray(body.results))throw new AppError('INVALID_NOTION_RESPONSE');task.items.push(...body.results.map(x=>x[task.type]).filter(Boolean));if(!body.has_more){record[task.key]=plain(task.items)||null;record.field_states[task.key]=record[task.key]?'ok':'empty';}}
 else if(task.type==='people'){if(!Array.isArray(body.results))throw new AppError('INVALID_NOTION_RESPONSE');task.items.push(...body.results.map(x=>x.people).filter(Boolean));if(!body.has_more){const list=users(task.items);if(task.key==='people'){record.personnel=list;record.people=list.map(x=>x.name||'姓名未提供');}else record[task.key]=list;record.field_states[task.key]=list.some(x=>!x.name)?'partial':list.length?'ok':'empty';record._field_issues=(record._field_issues||[]).filter(x=>x.field!==task.key);if(list.some(x=>!x.name))record._field_issues.push({field:task.key,property:task.propertyName||'负责人',type:'people',reason:'name_unavailable'});}}
 else if(task.type==='rollup'){if(!body.has_more){const p=body.property_item?.rollup||body.rollup;const value=p?.type==='number'?p.number:null;if(typeof value!=='number'||!Number.isFinite(value))throw new AppError('INCOMPLETE_NOTION_PROPERTY');record.completion=value;record.field_states.completion=value>=0&&value<=1?'ok':'invalid';if(value<0||value>1)record._field_issues.push({field:'completion',property:'完成度',type:'rollup',reason:'outside_percent_range'});}}
 else {if(!Array.isArray(body.results))throw new AppError('INVALID_NOTION_RESPONSE');task.ids.push(...body.results.map(x=>id(x.relation?.id)).filter(Boolean));if(!body.has_more)record._relations[task.key]=[...new Set(task.ids)];}
}
export function materialize(records,generatedAt){
 const result=Object.values(records).map(raw=>{const {_relations,_invalid_dates,_field_issues,...record}=raw;return{...record,projects:(_relations.projects||[]).map(pageUrl),related:[...new Set([...(_relations.tasks||[]),...(_relations.notes||[])])].map(pageUrl),effective_projects:[],inherited_projects:[]};});
 const byId=new Map(result.map(r=>[r.id,r]));
 for(const r of result)if(r.kind==='project'){for(const target of r.related){const t=byId.get(target.split('/').pop());if(['task','note'].includes(t?.kind)&&!t.projects.includes(r.url))t.projects.push(r.url);}}
 for(const r of result)if(r.kind==='task'){for(const target of r.related){const n=byId.get(target.split('/').pop());if(n?.kind==='note'&&!n.related.includes(r.url))n.related.push(r.url);}}
 for(const r of result){const inherited=r.kind==='note'?r.related.flatMap(url=>{const t=byId.get(url.split('/').pop());return t?.kind==='task'?t.projects:[];}):[];r.inherited_projects=[...new Set(inherited)].filter(url=>!r.projects.includes(url));r.effective_projects=[...new Set([...r.projects,...inherited])];}
 const local=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(generatedAt));
 const time=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(generatedAt));
 const counts=Object.fromEntries(['project','task','note'].map(k=>[k,result.filter(r=>r.kind===k).length]));
 const fields={};for(const r of result){fields[r.kind]??={};for(const [field,state]of Object.entries(r.field_states||{})){fields[r.kind][field]??={ok:0,empty:0,missing:0,unsupported:0,partial:0,invalid:0};fields[r.kind][field][state]=(fields[r.kind][field][state]||0)+1;}}
 const issues=Object.values(records).flatMap(r=>(r._field_issues||[]).map(issue=>({recordId:r.id,kind:r.kind,...issue})));
 return{records:result,meta:{snapshot_date:local,snapshot_time:time,timezone:'Asia/Shanghai',counts,generatedAt,sourceFingerprint:fingerprint(),version:'online-1.4.1',mappingVersion:MAPPING_VERSION,fieldDiagnostics:{counts:fields,issueCount:issues.length,issues},date_anomalies:result.filter(r=>r.invalid_range).length,missing_start:result.filter(r=>!r.start_date).length,missing_due:result.filter(r=>r.kind!=='note'&&!r.due_date).length,invalid_date_values:Object.values(records).reduce((n,r)=>n+(r._invalid_dates||0),0),unknown_statuses:[...new Set(result.filter(r=>r.kind!=='note'&&!['进行中','未开始','已归档'].includes(r.status)).map(r=>r.status))]}};
}
