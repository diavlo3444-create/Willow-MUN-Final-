import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, FileCode2, History, Info, Mail, Send, Users, XCircle } from 'lucide-react';
import { useAdminStore } from '../../../context/AdminStoreContext';
import { supabase } from '../../../lib/supabase';
import { ApplicantsBulkTab } from './emails/ApplicantsBulkTab';
import { BulkSendConfirmModal } from './emails/BulkSendConfirmModal';
import { EmailHistoryTab } from './emails/EmailHistoryTab';
import { EmailTemplatesTab } from './emails/EmailTemplatesTab';
import { SendingQueueTab } from './emails/SendingQueueTab';
import { DEFAULT_EMAIL_TEMPLATES, ESTIMATED_DAILY_CAPACITY, renderEmailPreview } from './emails/sampleData';
import type { BulkSendConfirmState, EmailApplicantRecord, EmailDecisionType, EmailHistoryRecord, EmailQueueItem, EmailTemplateRecord } from './emails/types';

type Tab = 'applicants' | 'queue' | 'history' | 'templates';
type Row = Record<string, any>;
const deptLabel=(v:unknown)=>String(v||'General').replace(/[-_]/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
const applicantMap=(r:Row):EmailApplicantRecord=>({id:String(r.id),applicationCode:String(r.application_code||r.id).slice(0,8),applicantName:String(r.applicant_name||'Applicant'),email:String(r.email||''),department:deptLabel(r.department_id||r.application_type),departmentSlug:String(r.department_id||r.application_type||'').toLowerCase(),appliedPosition:String(r.position||r.application_type||'Applicant'),applicationStatus:r.status==='accepted'||r.status==='rejected'?r.status:'pending',emailStatus:'not_sent',applicationDate:String(r.created_at||'')});
const historyMap=(r:Row):EmailHistoryRecord=>({id:String(r.id),applicantId:String(r.application_id),recipientName:String(r.recipient_name||''),recipientEmail:String(r.recipient_email||''),department:'—',emailType:r.decision_status==='rejected'?'rejected':'accepted',subject:String(r.subject||''),status:r.status==='sent'?'sent':r.status==='failed'?'failed':'pending',attemptCount:Number(r.attempts||0),sentAt:r.sent_at||null,lastAttemptAt:String(r.updated_at||r.created_at||''),errorDetails:r.error_message||null});
const templateMap=(r:Row):EmailTemplateRecord=>({key:r.template_key,label:r.name||r.template_key,subject:String(r.subject||''),body:String(r.body_text||''),updatedAt:String(r.updated_at||'')});

export function EmailsDashboardView(){
 const {pushToast}=useAdminStore();
 const [applicants,setApplicants]=useState<EmailApplicantRecord[]>([]);
 const [history,setHistory]=useState<EmailHistoryRecord[]>([]);
 const [queue,setQueue]=useState<EmailQueueItem[]>([]);
 const [templates,setTemplates]=useState(DEFAULT_EMAIL_TEMPLATES);
 const [activeTab,setActiveTab]=useState<Tab>('applicants');
 const [selectedIds,setSelectedIds]=useState<string[]>([]);
 const [confirmState,setConfirmState]=useState<BulkSendConfirmState|null>(null);
 const [loading,setLoading]=useState(true),[sending,setSending]=useState(false);
 const [progress,setProgress]=useState({done:0,total:0});

 const refresh=useCallback(async()=>{
  setLoading(true);
  try{
   const [a,d]=await Promise.all([
    supabase.functions.invoke('willow-applications',{body:{action:'list'}}),
    supabase.functions.invoke('willow-email-management',{body:{action:'dashboard'}})
   ]);
   if(a.error)throw a.error;if(d.error)throw d.error;
   const apps=(a.data?.applications||[]).map(applicantMap) as EmailApplicantRecord[];
   const logs=(d.data?.deliveries||[]).map(historyMap) as EmailHistoryRecord[];
   const latest=new Map<string,EmailHistoryRecord>();
   logs.forEach(l=>{const k=l.applicantId+'|'+l.emailType,old=latest.get(k);if(!old||l.lastAttemptAt>old.lastAttemptAt)latest.set(k,l)});
   setApplicants(apps.map(x=>{const accepted=latest.get(x.id+'|accepted'),rejected=latest.get(x.id+'|rejected'),record=x.applicationStatus==='accepted'?accepted:x.applicationStatus==='rejected'?rejected:accepted||rejected;return {...x,emailStatus:record?.status==='sent'?'sent':record?.status==='failed'?'failed':'not_sent'}}));
   setHistory(logs);
   const t=(d.data?.templates||[]).map(templateMap) as EmailTemplateRecord[];setTemplates(prev=>{const n={...prev};t.forEach(x=>{if(x.key==='accepted'||x.key==='rejected')n[x.key]=x});return n});
  }catch(err){pushToast({tone:'error',title:'Email dashboard load failed',description:err instanceof Error?err.message:'Verify your HR/Admin login.'})}
  finally{setLoading(false)}
 },[pushToast]);
 useEffect(()=>{void refresh()},[refresh]);

 const total=applicants.length,accepted=applicants.filter(a=>a.applicationStatus==='accepted').length,rejected=applicants.filter(a=>a.applicationStatus==='rejected').length;
 const sent=history.filter(h=>h.status==='sent').length,failed=history.filter(h=>h.status==='failed').length,remaining=Math.max(0,ESTIMATED_DAILY_CAPACITY-sent),percent=Math.min(100,Math.round(sent/ESTIMATED_DAILY_CAPACITY*100));
 const acceptedPending=useMemo(()=>applicants.filter(a=>a.applicationStatus==='accepted'&&a.emailStatus!=='sent'),[applicants]);
 const rejectedPending=useMemo(()=>applicants.filter(a=>a.applicationStatus==='rejected'&&a.emailStatus!=='sent'),[applicants]);
 const selected=useMemo(()=>applicants.filter(a=>selectedIds.includes(a.id)),[applicants,selectedIds]);
 const activeQueue=queue.filter(q=>q.status==='waiting'||q.status==='processing').length;
 const openAll=(type:EmailDecisionType)=>{const eligible=type==='accepted'?acceptedPending:rejectedPending;const rec=eligible.filter(a=>a.email.trim()&&a.emailStatus!=='sent');const staged=rec.map((r,i):EmailQueueItem=>({id:`q-${Date.now()}-${i}-${r.id}`,applicantId:r.id,recipientName:r.applicantName,recipientEmail:r.email,department:r.department,emailType:type,subject:renderEmailPreview(templates[type].subject,r,type),status:'waiting',queuedAt:new Date().toISOString()}));setQueue(prev=>[...staged,...prev]);void sendBatch(staged);};
 const openSelected=(list:EmailApplicantRecord[],type?:EmailDecisionType)=>{if(list.length)setConfirmState({mode:'selected',emailType:type||(list.every(a=>a.applicationStatus==='rejected')?'rejected':'accepted'),recipients:list,skippedAlreadySentCount:0,skippedIneligibleCount:0})};
 const sendBatch=async(items:EmailQueueItem[])=>{
  if(sending||!items.length)return;
  setSending(true);setProgress({done:0,total:items.length});let done=0;
  for(const item of items){
   setQueue(q=>q.map(x=>x.id===item.id?{...x,status:'processing'}:x));
   try{
    const {data,error}=await supabase.functions.invoke('willow-application-email',{body:{application_id:item.applicantId,decision:item.emailType}});
    if(error||data?.error)throw new Error(data?.error||error?.message||'Send error');
    setQueue(q=>q.map(x=>x.id===item.id?{...x,status:data?.status==='failed'?'failed':'sent',errorDetails:data?.status==='failed'?'Delivery marked failed':null}:x));
   }catch(e){setQueue(q=>q.map(x=>x.id===item.id?{...x,status:'failed',errorDetails:e instanceof Error?e.message:'Delivery failed'}:x))}
   done++;setProgress({done,total:items.length});
  }
  setSending(false);await refresh();pushToast({tone:'info',title:'Bulk send complete',description:'Review any failed deliveries in Email History.'});
 };
 const confirmSend=(type:EmailDecisionType)=>{
  if(!confirmState||sending)return;
  const rec=confirmState.recipients.filter(a=>a.applicationStatus===type&&a.email.trim()&&a.emailStatus!=='sent');
  const staged=rec.map((r,i):EmailQueueItem=>({id:`q-${Date.now()}-${i}-${r.id}`,applicantId:r.id,recipientName:r.applicantName,recipientEmail:r.email,department:r.department,emailType:type,subject:renderEmailPreview(templates[type].subject,r,type),status:'waiting',queuedAt:new Date().toISOString()}));
  setQueue(prev=>[...staged,...prev]);if(confirmState.mode==='selected')setSelectedIds([]);setConfirmState(null);
  void sendBatch(staged);
 };
 const sendQueue=async()=>{
  const pending=queue.filter(q=>q.status==='waiting');if(!pending.length||sending)return;
  void sendBatch(pending);
 };
 const resendApplicant=async(applicant:EmailApplicantRecord)=>{
  if(sending)return;
  const decision=applicant.applicationStatus;
  if(decision!=='accepted'&&decision!=='rejected')return;
  try{
   const {data,error}=await supabase.functions.invoke('willow-application-email',{body:{application_id:applicant.id,decision,force_resend:true}});
   if(error||data?.error)throw new Error(data?.error||error?.message||'Email send failed');
   pushToast({tone:'success',title:'Email resent',description:`A fresh ${decision} email was sent to ${applicant.email}.`});
   await refresh();
  }catch(e){pushToast({tone:'error',title:'Resend failed',description:e instanceof Error?e.message:'Email could not be sent.'})}
 };
 const retry=async(id:string)=>{try{const {data,error}=await supabase.functions.invoke('willow-email-management',{body:{action:'retry',delivery_id:id}});if(error||data?.error)throw new Error(data?.error||error?.message);pushToast({tone:'success',title:'Retry request sent'});await refresh()}catch(e){pushToast({tone:'error',title:'Retry failed',description:e instanceof Error?e.message:'Request failed'})}};
 const saveTemplate=async(key:EmailDecisionType,subject:string,body:string)=>{try{const {data,error}=await supabase.functions.invoke('willow-email-management',{body:{action:'save_template',template_key:key,subject,body_text:body}});if(error||data?.error)throw new Error(data?.error||error?.message);if(data?.template)setTemplates(p=>({...p,[key]:templateMap(data.template)}));pushToast({tone:'success',title:'Template saved to Supabase'})}catch(e){pushToast({tone:'error',title:'Template save failed',description:e instanceof Error?e.message:'Request failed'})}};
 const resetTemplate=(key:EmailDecisionType)=>void saveTemplate(key,DEFAULT_EMAIL_TEMPLATES[key].subject,DEFAULT_EMAIL_TEMPLATES[key].body);
 const toggle=(id:string)=>setSelectedIds(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
 const tabs:{id:Tab;label:string;Icon:any;badge?:number}[]=[{id:'applicants',label:'Applicants & Bulk Send',Icon:Users},{id:'queue',label:'Sending Queue',Icon:Clock3,badge:activeQueue||undefined},{id:'history',label:'Email History',Icon:History,badge:failed||undefined},{id:'templates',label:'Templates',Icon:FileCode2}];

 return <div className="space-y-5">
  <header className="flex flex-col gap-3 border-b border-[color:var(--wm-hairline)] pb-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[color:var(--wm-accent)]">Admin &amp; HR Communications</p><h1 className="wm-serif mt-1.5 text-3xl text-[color:var(--wm-ink)]">Email Management Center</h1><p className="mt-1 max-w-2xl text-xs text-[color:var(--wm-ink-secondary)]">Live applicant records, bulk decision mail, delivery tracking, and templates.</p></div><div className="inline-flex items-center gap-2 self-start rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3 py-2 text-[11px] text-[color:var(--wm-ink-secondary)]"><Info className="h-3.5 w-3.5 text-[color:var(--wm-accent)]"/><span>Supabase connected · Gmail delivery active</span></div></header>
  <section className="wm-surface-panel overflow-hidden"><div className="grid grid-cols-2 divide-y sm:grid-cols-3 lg:grid-cols-6 sm:divide-y-0 sm:divide-x divide-[color:var(--wm-hairline)]">{[['Applications',total,Users],['Accepted',accepted,CheckCircle2],['Rejected',rejected,XCircle],['Emails Sent',sent,Mail],['Capacity Left',remaining,Send],['Failed',failed,XCircle]].map(([label,value,Icon]:any)=><div key={label} className="px-4 py-3"><p className="text-[11px] text-[color:var(--wm-ink-muted)] flex justify-between">{label}<Icon className="h-3.5 w-3.5"/></p><p className="mt-1.5 text-2xl font-serif">{loading?'…':value}</p></div>)}</div><div className="flex flex-wrap justify-between gap-3 border-t border-[color:var(--wm-hairline)] px-4 py-2 text-[11px] text-[color:var(--wm-ink-muted)]"><span>Willow delivery estimate: {sent}/{ESTIMATED_DAILY_CAPACITY} logged ({percent}%)</span><div className="h-1.5 w-full max-w-xs rounded-full bg-[color:var(--wm-canvas)]"><div className="h-full rounded-full bg-[color:var(--wm-accent)]" style={{width:`${percent}%`}}/></div></div></section>
  <section className="wm-surface-panel flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="text-xs font-semibold uppercase">Bulk Dispatch</h2><p className="text-[11px] text-[color:var(--wm-ink-muted)]">Verify the recipient batch before staging.</p></div><div className="flex flex-wrap gap-2"><button onClick={()=>openAll('accepted')} className="rounded-md bg-[color:var(--wm-emerald)] px-3 py-2 text-xs font-semibold">Send All Accepted ({acceptedPending.length})</button><button onClick={()=>openAll('rejected')} className="rounded-md border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">Send All Rejected ({rejectedPending.length})</button><button disabled={!selected.length} onClick={()=>openSelected(selected)} className="rounded-md border px-3 py-2 text-xs disabled:opacity-40">Send Selected ({selected.length})</button></div></section>
  <nav className="flex flex-wrap gap-1.5 border-b border-[color:var(--wm-hairline)] pb-3">{tabs.map(t=>{const I=t.Icon;return <button key={t.id} onClick={()=>setActiveTab(t.id)} className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs ${activeTab===t.id?'bg-[color:var(--wm-focal)] text-[#12170c]':'border bg-[color:var(--wm-surface)] text-[color:var(--wm-ink-secondary)]'}`}><I className="h-3.5 w-3.5"/>{t.label}{t.badge? <span>{t.badge}</span>:null}</button>})}</nav>
  {loading&&<div className="wm-surface-panel p-4 text-sm">Loading live records…</div>}
  {activeTab==='applicants'&&<ApplicantsBulkTab applicants={applicants} selectedIds={selectedIds} onToggleOne={toggle} onSelectMany={setSelectedIds} onClearSelection={()=>setSelectedIds([])} onRequestSendSelected={openSelected} onResend={resendApplicant}/>}
  {activeTab==='queue'&&<SendingQueueTab queue={queue} simulationRunning={sending} onStartSimulation={sendQueue} onPauseSimulation={()=>{}} onRetryItem={id=>setQueue(q=>q.map(x=>x.id===id?{...x,status:'waiting',errorDetails:null}:x))} onRemoveItem={id=>setQueue(q=>q.filter(x=>x.id!==id))} onClearCompleted={()=>setQueue(q=>q.filter(x=>x.status!=='sent'))}/>}
  {activeTab==='history'&&<EmailHistoryTab history={history} onRetryHistoryItem={retry}/>}
  {activeTab==='templates'&&<EmailTemplatesTab templates={templates} applicants={applicants} onSaveTemplate={saveTemplate} onResetTemplate={resetTemplate}/>}
  {sending&&<div className="wm-surface-panel p-3 text-xs">Sending real email batch: {progress.done}/{progress.total}. Keep this page open until finished.</div>}
  <BulkSendConfirmModal request={confirmState} templates={templates} onChangeType={t=>setConfirmState(p=>p?{...p,emailType:t}:null)} onConfirm={confirmSend} onCancel={()=>setConfirmState(null)}/>
 </div>;
}