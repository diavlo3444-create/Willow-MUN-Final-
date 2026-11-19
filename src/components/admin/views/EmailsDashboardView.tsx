import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Mail, RefreshCw, Save, Send, XCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAdminStore } from '../../../context/AdminStoreContext';

type Delivery = { id:string; application_id:string; recipient_email:string; recipient_name:string; decision_status:string; subject:string; status:string; attempts:number; error_message:string|null; sent_at:string|null; created_at:string; updated_at:string };
type Template = { template_key:'accepted'|'rejected'; name:string; subject:string; body_text:string; updated_at:string };
type DashboardData = { deliveries:Delivery[]; templates:Template[] };
const tokens = ['{{applicant_name}}','{{department}}','{{position}}','{{signup_link}}'];
const LIMIT_ESTIMATE = 500;

export function EmailsDashboardView() {
  const { currentUser, pushToast } = useAdminStore();
  const [data,setData] = useState<DashboardData>({deliveries:[],templates:[]});
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [tab,setTab] = useState<'overview'|'history'|'failed'|'templates'>('overview');
  const [templateKey,setTemplateKey] = useState<'accepted'|'rejected'>('accepted');
  const [subject,setSubject] = useState('');
  const [body,setBody] = useState('');
  const [saving,setSaving] = useState(false);
  const [retrying,setRetrying] = useState<string|null>(null);
  const [filter,setFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const {data:result,error:invokeError}=await supabase.functions.invoke('willow-email-management',{body:{action:'dashboard'}});
    if(invokeError || result?.error){setError(result?.error||invokeError?.message||'Could not load email dashboard.');setLoading(false);return;}
    setData({deliveries:result.deliveries||[],templates:result.templates||[]});
    setLoading(false);
  },[]);
  useEffect(()=>{void load();},[load]);
  const activeTemplate=data.templates.find(t=>t.template_key===templateKey);
  useEffect(()=>{if(activeTemplate){setSubject(activeTemplate.subject);setBody(activeTemplate.body_text);}},[activeTemplate]);
  const sent=data.deliveries.filter(x=>x.status==='sent');
  const failed=data.deliveries.filter(x=>x.status==='failed');
  const pending=data.deliveries.filter(x=>x.status==='pending'||x.status==='sending');
  const today=new Date().toLocaleDateString();
  const todaySent=sent.filter(x=>x.sent_at&&new Date(x.sent_at).toLocaleDateString()===today).length;
  const quota=Math.min(todaySent,LIMIT_ESTIMATE), percent=Math.round(quota/LIMIT_ESTIMATE*100);
  const visible=(tab==='failed'?failed:data.deliveries).filter(x=>filter==='all'||x.decision_status===filter);
  const save=async()=>{
    setSaving(true);
    const {data:result,error:invokeError}=await supabase.functions.invoke('willow-email-management',{body:{action:'save_template',template_key:templateKey,subject,body_text:body}});
    setSaving(false);
    if(invokeError||result?.error){pushToast({tone:'error',title:'Template not saved',description:result?.error||invokeError?.message});return;}
    pushToast({tone:'success',title:'Email template saved'});
    await load();
  };
  const retry=async(id:string,decision:string)=>{
    setRetrying(id);
    const {data:result,error:invokeError}=await supabase.functions.invoke('willow-email-management',{body:{action:'retry',delivery_id:id}});
    setRetrying(null);
    if(invokeError||result?.error){pushToast({tone:'error',title:'Retry failed',description:result?.error||invokeError?.message});return;}
    pushToast({tone:'success',title:'Retry queued'});
    await load();
  };
  const tabs=[['overview','Overview'],['history','Email history'],['failed','Failed'],['templates','Templates']] as const;
  return <div className="space-y-5">
    <div className="wm-surface-panel flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <div className="flex items-center gap-2.5"><Mail className="h-4 w-4 text-[color:var(--wm-accent)]"/><div><p className="text-sm font-semibold text-[color:var(--wm-ink)]">Email operations</p><p className="text-xs text-[color:var(--wm-ink-muted)]">Automatic decision emails · Willow Gmail</p></div></div>
      <button type="button" onClick={()=>void load()} className="inline-flex h-9 items-center gap-2 rounded border border-[color:var(--wm-hairline-strong)] px-3 text-xs text-[color:var(--wm-ink)]"><RefreshCw className="h-3.5 w-3.5"/>Refresh</button>
    </div>
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      {[
        {label:'Delivered total',value:sent.length,icon:CheckCircle2},
        {label:'Sent today',value:todaySent,icon:Send},
        {label:'Failed',value:failed.length,icon:XCircle},
        {label:'Pending / sending',value:pending.length,icon:Clock3},
      ].map(card=>{const Icon=card.icon;return <div key={card.label} className="wm-surface-panel p-4"><div className="flex items-center justify-between"><p className="text-[11px] text-[color:var(--wm-ink-muted)]">{card.label}</p><Icon className="h-4 w-4 text-[color:var(--wm-accent)]"/></div><p className="mt-2 text-2xl font-semibold tabular-nums text-[color:var(--wm-ink)]">{card.value}</p></div>})}
    </div>
    <section className="wm-surface-panel p-5 space-y-3">
      <div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-[color:var(--wm-ink)]">Daily sending estimate</h2><p className="text-xs text-[color:var(--wm-ink-muted)]">Gmail personal-account limit is an estimate, not live quota verification.</p></div><p className="font-mono text-sm tabular-nums text-[color:var(--wm-ink)]">{todaySent} / {LIMIT_ESTIMATE}</p></div>
      <div className="h-2.5 rounded-full bg-[color:var(--wm-inset)] overflow-hidden"><div className="h-full rounded-full bg-[color:var(--wm-accent)]" style={{width:percent+'%'}}/></div>
      <p className="text-xs text-[color:var(--wm-ink-secondary)]">{percent}% estimated usage · {Math.max(0,LIMIT_ESTIMATE-todaySent)} estimated remaining</p>
    </section>
    <div className="flex flex-wrap gap-1.5">{tabs.map(([key,label])=><button key={key} type="button" onClick={()=>setTab(key)} className={`rounded px-3 py-2 text-xs font-medium ${tab===key?'bg-[color:var(--wm-focal)] text-[#12170c]':'wm-surface-panel text-[color:var(--wm-ink-secondary)]'}`}>{label}{key==='failed'&&failed.length>0?' ('+failed.length+')':''}</button>)}</div>
    {loading?<div className="wm-surface-panel p-8 text-center text-xs text-[color:var(--wm-ink-muted)]">Loading email records…</div>:error?<div className="wm-surface-panel p-6 text-sm text-rose-300">{error}</div>:tab==='templates'?<section className="wm-surface-panel p-5 space-y-4">
      <div className="flex flex-wrap gap-2">{(['accepted','rejected'] as const).map(k=><button key={k} onClick={()=>setTemplateKey(k)} className={`rounded px-3 py-2 text-xs ${templateKey===k?'bg-[color:var(--wm-focal)] text-[#12170c]':'border border-[color:var(--wm-hairline)] text-[color:var(--wm-ink-secondary)]'}`}>{k==='accepted'?'Acceptance':'Rejection'}</button>)}</div>
      <label className="block text-xs text-[color:var(--wm-ink-secondary)]">Subject<input value={subject} onChange={e=>setSubject(e.target.value)} className="mt-1 block w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] p-2 text-sm text-[color:var(--wm-ink)]"/></label>
      <label className="block text-xs text-[color:var(--wm-ink-secondary)]">Message body<textarea rows={10} value={body} onChange={e=>setBody(e.target.value)} className="mt-1 block w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] p-3 text-sm text-[color:var(--wm-ink)]"/></label>
      <div className="rounded border border-[color:var(--wm-hairline)] p-3"><p className="text-[11px] font-medium text-[color:var(--wm-ink-secondary)]">Available placeholders</p><div className="mt-2 flex flex-wrap gap-1">{tokens.map(t=><code key={t} className="rounded bg-[color:var(--wm-inset)] px-2 py-1 text-[11px]">{t}</code>)}</div></div>
      <button type="button" onClick={()=>void save()} disabled={saving||!subject.trim()||!body.trim()} className="inline-flex h-9 items-center gap-2 rounded bg-[color:var(--wm-focal)] px-4 text-xs font-semibold text-[#12170c] disabled:opacity-40"><Save className="h-3.5 w-3.5"/>{saving?'Saving…':'Save template'}</button>
      <p className="text-xs text-[color:var(--wm-ink-muted)]">Saved templates are managed in Willow’s database. They become the outgoing decision email content after the sender integration is wired to use template overrides.</p>
    </section>:<section className="wm-surface-panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--wm-hairline)] p-4"><h2 className="text-sm font-semibold text-[color:var(--wm-ink)]">{tab==='overview'?'Recent email activity':tab==='failed'?'Failed email queue':'Email history'}</h2><select value={filter} onChange={e=>setFilter(e.target.value)} className="h-8 rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-2 text-xs text-[color:var(--wm-ink)]"><option value="all">All decisions</option><option value="accepted">Acceptance</option><option value="rejected">Rejection</option></select></div>
      {visible.length===0?<div className="p-8 text-center text-xs text-[color:var(--wm-ink-muted)]">No email records found.</div>:<div className="divide-y divide-[color:var(--wm-hairline)]">{visible.slice(0,tab==='overview'?12:100).map(m=><article key={m.id} className="flex flex-wrap items-start justify-between gap-3 p-4 text-xs"><div className="min-w-0"><p className="font-semibold text-[color:var(--wm-ink)]">{m.recipient_name||m.recipient_email} <span className="font-normal text-[color:var(--wm-ink-muted)]">{m.recipient_email}</span></p><p className="mt-1 text-[color:var(--wm-accent)]">{m.subject||'Decision email'} · {m.decision_status}</p><p className="mt-1 text-[color:var(--wm-ink-muted)]">Attempts: {m.attempts} · {m.sent_at?new Date(m.sent_at).toLocaleString():new Date(m.created_at).toLocaleString()}</p>{m.error_message&&<p className="mt-1 text-rose-300"><AlertTriangle className="mr-1 inline h-3 w-3"/>{m.error_message}</p>}</div><div className="flex items-center gap-2"><span className={`rounded px-2 py-1 text-[10px] uppercase ${m.status==='sent'?'text-emerald-300 bg-emerald-500/10':m.status==='failed'?'text-rose-300 bg-rose-500/10':'text-amber-300 bg-amber-500/10'}`}>{m.status}</span>{m.status==='failed'&&<button type="button" disabled={retrying===m.id} onClick={()=>void retry(m.id,m.decision_status)} className="inline-flex h-8 items-center gap-1 rounded border border-[color:var(--wm-hairline-strong)] px-2 text-xs disabled:opacity-40"><RefreshCw className="h-3 w-3"/>{retrying===m.id?'Retrying':'Retry'}</button>}</div></article>)}</div>}
    </section>}
  </div>;
}
