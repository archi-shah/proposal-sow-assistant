/* =====================================================================
   ProposalForge — Proposal & Scope-of-Work Drafting Assistant
   Pure HTML/CSS/JS. Data persists in localStorage (no database needed).
   Rule #1: NEVER invent pricing. Only approved pricing lines from templates.
   ===================================================================== */
(() => {
'use strict';

const LS = { packages:'pf_packages', drafts:'pf_drafts', theme:'pf_theme', state:'pf_state' };
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2,9);
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------------- Approved company templates ---------------- */
const DEFAULT_PACKAGES = [
  { id:'web-redesign', cat:'Web', name:'Website Redesign', weeks:8,
    desc:'Full redesign of an existing marketing website with new UX, visual design and CMS build.',
    deliverables:['Discovery workshop & UX audit report','Sitemap and user flows','Wireframes for up to 8 page templates','High-fidelity visual design (desktop + mobile)','Front-end build on approved CMS','Content migration for up to 30 pages','Basic on-page SEO setup','QA, browser testing & launch support','2 rounds of revisions per phase'],
    assumptions:['Client provides all final copy, images and brand assets before design phase','Client consolidates feedback into a single response per review round','Hosting and domain are managed by the client','Stakeholders are available for weekly check-ins'],
    exclusions:['Copywriting and photography','Ongoing maintenance after 30-day post-launch window','Paid advertising setup','Custom integrations not listed in deliverables','Third-party licence fees'],
    milestones:[['Kickoff & discovery',1],['UX approved',3],['Visual design approved',5],['Build complete',7],['Launch',8]],
    price:'' },
  { id:'ecommerce', cat:'Web', name:'E-commerce Launch', weeks:10,
    desc:'Online store build with product catalogue, checkout, payments and marketing integrations.',
    deliverables:['Platform setup and theme customisation','Product catalogue structure (up to 100 SKUs)','Checkout, tax and shipping configuration','Payment gateway integration','Email marketing integration','Analytics & conversion tracking','Launch checklist & staff training session','30 days post-launch support'],
    assumptions:['Client has merchant/payment accounts in place','Product data is supplied in a structured spreadsheet','Client is responsible for legal/compliance pages content'],
    exclusions:['Product photography','Inventory/ERP sync unless listed','Marketplace (Amazon, etc.) listings','Ongoing subscription or platform fees'],
    milestones:[['Kickoff',1],['Store structure approved',3],['Design approved',5],['Integrations complete',8],['Launch',10]],
    price:'' },
  { id:'brand', cat:'Brand', name:'Brand Identity', weeks:6,
    desc:'Logo, visual system and brand guidelines for a new or refreshed brand.',
    deliverables:['Brand discovery workshop','3 initial logo concepts','Refinement of chosen concept (2 rounds)','Final logo files in all formats','Colour palette and typography system','Brand guidelines document (PDF)','Business card and letterhead templates'],
    assumptions:['Single decision-maker signs off each phase','Trademark search is handled by the client'],
    exclusions:['Trademark registration','Website or packaging design','Printing costs'],
    milestones:[['Discovery workshop',1],['Concepts presented',3],['Final logo approved',5],['Guidelines delivered',6]],
    price:'' },
  { id:'app-mvp', cat:'Product', name:'Mobile App MVP', weeks:12,
    desc:'Cross-platform MVP with core user flows, backend and app-store release.',
    deliverables:['Product scoping & user stories','Clickable prototype','UI design for core screens','Cross-platform app build (iOS + Android)','Backend API & authentication','QA & beta testing (TestFlight / Play beta)','App store submission support','Handover documentation'],
    assumptions:['Scope is limited to the agreed core user flows','Client provides developer accounts for Apple and Google','Third-party API costs are borne by the client'],
    exclusions:['Ongoing feature development after release','Marketing and ASO','Hardware-specific features (NFC, BLE) unless listed'],
    milestones:[['Scope locked',2],['Prototype approved',4],['Alpha build',8],['Beta release',10],['Store submission',12]],
    price:'' },
  { id:'retainer', cat:'Marketing', name:'Marketing Retainer', weeks:12,
    desc:'Monthly content, social and campaign support with reporting.',
    deliverables:['Monthly content calendar','8 social posts per month','2 blog articles per month','1 email campaign per month','Monthly performance report','Monthly strategy call'],
    assumptions:['Client approves calendar within 3 business days','Ad spend is paid directly by the client','3-month minimum term'],
    exclusions:['Paid media spend','Video production','Influencer fees'],
    milestones:[['Onboarding & strategy',1],['First calendar approved',2],['Month 1 report',4],['Month 2 report',8],['Quarterly review',12]],
    price:'' },
];

/* ---------------- State ---------------- */
let packages = load(LS.packages, DEFAULT_PACKAGES);
let drafts = load(LS.drafts, []);
let state = load(LS.state, { selectedPkg:null, notes:'', proposal:null, draftId:null });
let extracted = {};

function load(k, fb){ try{ const v = localStorage.getItem(k); return v?JSON.parse(v):fb; }catch{ return fb; } }
function save(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
function persistState(){ save(LS.state, state); }

/* ---------------- Toast ---------------- */
let toastT;
function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('show'),2200); }

/* ---------------- Theme ---------------- */
function applyTheme(t){ document.documentElement.dataset.theme=t; $('#themeToggle').textContent = t==='dark'?'☀️ Light mode':'🌙 Dark mode'; save(LS.theme,t); }
applyTheme(load(LS.theme,'light'));
$('#themeToggle').onclick=()=>applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');

/* ---------------- Navigation ---------------- */
function goto(view){
  $$('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  $$('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+view));
  if(view==='drafts') renderDrafts();
  if(view==='packages') renderPackages();
  window.scrollTo({top:0,behavior:'smooth'});
}
$$('.nav-btn').forEach(b=>b.onclick=()=>goto(b.dataset.view));
$$('[data-goto]').forEach(b=>b.onclick=()=>goto(b.dataset.goto));

function updateSteps(){
  $('#step-notes').classList.toggle('done', state.notes.trim().length>20);
  $('#step-package').classList.toggle('done', !!state.selectedPkg);
  $('#step-draft').classList.toggle('done', !!state.proposal);
}

/* =====================================================================
   DISCOVERY EXTRACTION
   Heuristic NLP over the notes: pulls out client, contact, goals, etc.
   ===================================================================== */
const MONTHS='jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec';
const INTEGRATIONS=['shopify','woocommerce','mailchimp','hubspot','salesforce','stripe','paypal','razorpay','zapier','slack','quickbooks','xero','google analytics','ga4','wordpress','webflow','squarespace','klaviyo','zoho','notion','airtable','sap','netsuite','twilio','sendgrid','intercom','zendesk','pipedrive','magento','bigcommerce','aws','firebase','supabase','figma'];

function extractFromNotes(text){
  const lines = text.split(/\n+/).map(l=>l.trim()).filter(Boolean);
  const low = text.toLowerCase();
  const out = { client:'', contact:'', goals:[], integrations:[], deadline:'', budget:'', stakeholders:[], uncertainties:[], constraints:[], existingAssets:[], raw:lines };

  for(const l of lines){
    const ll=l.toLowerCase();
    let m;
    if((m=l.match(/^(?:client|company|customer|organisation|organization)\s*[:\-–]\s*(.+)/i))) out.client = out.client || m[1].trim();
    if((m=l.match(/^(?:contact|primary contact|point of contact|poc)\s*[:\-–]\s*(.+)/i))) out.contact = out.contact || m[1].trim();
    if((m=l.match(/decision[- ]maker[s]?\s*[:\-–]?\s*(.+)/i))) out.stakeholders.push(m[1].trim());
    if((m=l.match(/(?:stakeholder|sign[- ]?off|approv(?:al|er))[s]?[^:]*[:\-–]?\s*(.+)/i)) && !/decision/i.test(l)) out.stakeholders.push(m[1].trim());
    if(/\b(want|wants|need|needs|goal|objective|looking for|would like|aim|aims|require)\b/.test(ll) && !/not sure|unsure|maybe|unclear|decision[- ]maker|sign[- ]?off|currently on|budget/.test(ll)) out.goals.push(l.replace(/^(goal|objective)s?\s*[:\-–]\s*/i,''));
    if(/\b(not sure|unsure|maybe|unclear|tbd|to be decided|undecided|might|possibly|haven't decided|open question)\b/.test(ll)) out.uncertainties.push(l);
    if(/\b(must|has to|have to|cannot|can't|only|strict|compliance|gdpr|accessib|wcag)\b/.test(ll) && !/integrat/.test(ll)) out.constraints.push(l);
    if(/\b(existing|already have|already has|current(ly)?|have a|has a)\b/.test(ll) && /\b(brand|guideline|logo|site|website|content|copy|photos|assets|design|cms|domain|hosting)\b/.test(ll)) out.existingAssets.push(l);
    if(!out.deadline){
      m = l.match(new RegExp(`\\b(before|by|launch(?:ing)?|deadline|due|go[- ]live)\\b[^.]*?\\b((?:${MONTHS})[a-z]*\\.?\\s*\\d{0,2}(?:,?\\s*\\d{4})?|q[1-4](?:\\s*\\d{4})?|end of (?:month|year|q[1-4])|holiday season|next (?:month|quarter|year)|\\d{1,2}\\s*weeks?|\\d{1,2}\\s*months?)`,'i'));
      if(m) out.deadline = l;
    }
    if(!out.budget && /\b(budget|spend|invest|afford|fee)\b/.test(ll)) out.budget = l;
  }
  for(const i of INTEGRATIONS){
    const inLine=lines.find(l=>l.toLowerCase().includes(i)); if(!inLine) continue;
    if(/\b(move away|migrate (?:away|off|from)|leaving|instead of|currently (?:on|using)|replace|away from)\b/i.test(inLine)) continue; // platform being left, not integrated
    out.integrations.push(i.replace(/\b\w/g,c=>c.toUpperCase()));
  }
  out.integrations=[...new Set(out.integrations)];
  // Infer client name if not labelled: "Client: X" absent -> look for capitalised company-ish phrase in first lines
  if(!out.client){ const m = text.match(/\b([A-Z][\w&']+(?:\s+[A-Z][\w&']+){1,4})\s+(?:is|are|wants?|needs?|runs?|owns?)\b/); if(m) out.client=m[1]; }
  if(!out.contact){ const m = text.match(/\b([A-Z][a-z]+\s+[A-Z][a-z]+)\s*\((?:owner|ceo|founder|cto|cmo|director|manager|head)[^)]*\)/i); if(m) out.contact=m[0]; }
  out.goals=[...new Set(out.goals)].slice(0,8);
  return out;
}

function renderExtract(){
  const e = extracted; const p = $('#extractPanel'); const items=[];
  const add=(k,v,missing=false)=>items.push(`<div class="extract-item ${missing?'missing':''}"><div class="k">${k}</div><div class="v">${v}</div></div>`);
  if(!state.notes.trim()){ p.innerHTML='<div class="empty">Start typing notes to see extracted details here.</div>'; $('#extractCount').textContent='0 items'; return; }
  add('Client', e.client?esc(e.client):'<i>Not detected — add "Client: …"</i>', !e.client);
  add('Contact', e.contact?esc(e.contact):'<i>Not detected</i>', !e.contact);
  add('Goals', e.goals.length?`<ul style="padding-left:16px">${e.goals.map(g=>`<li>${esc(g)}</li>`).join('')}</ul>`:'<i>No goals detected</i>', !e.goals.length);
  add('Integrations', e.integrations.length?e.integrations.map(i=>`<span class="badge soft">${esc(i)}</span> `).join(''):'<i>None mentioned</i>');
  add('Deadline', e.deadline?esc(e.deadline):'<i>Not stated → will be asked</i>', !e.deadline);
  add('Budget', e.budget?esc(e.budget)+' <span class="badge warn">reference only — no pricing generated</span>':'<i>Not stated → will be asked</i>', !e.budget);
  add('Stakeholders', e.stakeholders.length?e.stakeholders.map(esc).join('; '):'<i>Not stated → will be asked</i>', !e.stakeholders.length);
  if(e.constraints.length) add('Constraints', e.constraints.map(esc).join('<br>'));
  if(e.existingAssets.length) add('Existing assets', e.existingAssets.map(esc).join('<br>'));
  if(e.uncertainties.length) add('Open points', e.uncertainties.map(esc).join('<br>'), true);
  p.innerHTML=items.join('');
  $('#extractCount').textContent=`${items.length} items`;
  if(e.client && !$('#fClient').value) $('#fClient').value=e.client;
  if(e.contact && !$('#fContact').value) $('#fContact').value=e.contact;
}

const notesInput=$('#notesInput');
notesInput.value=state.notes||'';
let notesT;
notesInput.addEventListener('input',()=>{ state.notes=notesInput.value; clearTimeout(notesT); notesT=setTimeout(()=>{ extracted=extractFromNotes(state.notes); renderExtract(); updateSteps(); persistState(); },250); });
extracted=extractFromNotes(state.notes); renderExtract();

$('#loadSampleNotes').onclick=()=>{
  notesInput.value=`Client: Harbor Lane Coffee Roasters
Contact: Priya Nair (Owner)
They want a new e-commerce website to sell beans online and grow subscriptions.
Must integrate with Shopify for orders and Mailchimp for newsletters.
Want to launch before the holiday season, ideally by mid November.
Budget around $12k but flexible for the right partner.
Decision maker: Priya, but her partner Raj also needs to sign off.
Not sure if they want a blog yet — maybe later.
Existing brand guidelines and logo exist from 2024.
Site must be accessible (WCAG AA) because of a council grant requirement.
Currently on Squarespace, want to move away from it.
Need staff training so the team can manage products themselves.`;
  notesInput.dispatchEvent(new Event('input'));
  toast('Sample notes loaded');
};
$('#clearNotes').onclick=()=>{ notesInput.value=''; notesInput.dispatchEvent(new Event('input')); ['#fClient','#fContact'].forEach(s=>$(s).value=''); };
$('#fStart').value = $('#fStart').value || new Date(Date.now()+7*864e5).toISOString().slice(0,10);

/* =====================================================================
   PACKAGES
   ===================================================================== */
function renderPackages(){
  const g=$('#packageGrid');
  g.innerHTML=packages.map(p=>`
    <div class="pkg ${state.selectedPkg===p.id?'selected':''}" data-id="${p.id}">
      <div class="pkg-cat">${esc(p.cat||'General')}</div>
      <h3>${esc(p.name)}</h3>
      <p>${esc(p.desc)}</p>
      <div class="pkg-meta">
        <span class="badge soft">${p.deliverables.length} deliverables</span>
        <span class="badge soft">~${p.weeks} wks</span>
        ${p.price?'<span class="badge ok">Approved pricing</span>':'<span class="badge warn">Pricing TBC</span>'}
        <button class="pkg-edit" data-edit="${p.id}">Edit</button>
      </div>
    </div>`).join('');
  g.querySelectorAll('.pkg').forEach(el=>el.onclick=e=>{ if(e.target.dataset.edit) return; state.selectedPkg=el.dataset.id; persistState(); renderPackages(); updateSteps(); });
  g.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openPkgModal(b.dataset.edit));
}
let editingPkg=null;
function openPkgModal(id){
  editingPkg=id; const p = id?packages.find(x=>x.id===id):null;
  $('#pkgModalTitle').textContent=p?'Edit package':'New package';
  $('#pkgName').value=p?.name||''; $('#pkgDesc').value=p?.desc||''; $('#pkgWeeks').value=p?.weeks||6; $('#pkgCat').value=p?.cat||'';
  $('#pkgDeliverables').value=(p?.deliverables||[]).join('\n'); $('#pkgAssumptions').value=(p?.assumptions||[]).join('\n');
  $('#pkgExclusions').value=(p?.exclusions||[]).join('\n'); $('#pkgMilestones').value=(p?.milestones||[]).map(m=>`${m[0]} | ${m[1]}`).join('\n');
  $('#pkgPrice').value=p?.price||''; $('#pkgDelete').style.display=p?'inline-flex':'none';
  $('#pkgModal').classList.add('open');
}
const closePkg=()=>$('#pkgModal').classList.remove('open');
$('#pkgModalClose').onclick=closePkg; $('#pkgCancel').onclick=closePkg;
$('#pkgModal').addEventListener('click',e=>{ if(e.target.id==='pkgModal') closePkg(); });
$('#pkgSave').onclick=()=>{
  const lines=id=>$(id).value.split('\n').map(s=>s.trim()).filter(Boolean);
  const name=$('#pkgName').value.trim(); if(!name) return toast('Package name is required');
  const p={ id:editingPkg||('custom-'+uid()), name, desc:$('#pkgDesc').value.trim(), weeks:+$('#pkgWeeks').value||6, cat:$('#pkgCat').value.trim()||'Custom',
    deliverables:lines('#pkgDeliverables'), assumptions:lines('#pkgAssumptions'), exclusions:lines('#pkgExclusions'),
    milestones:lines('#pkgMilestones').map(l=>{const [n,w]=l.split('|').map(s=>s.trim()); return [n, parseInt(w)||1];}), price:$('#pkgPrice').value.trim() };
  const i=packages.findIndex(x=>x.id===p.id); if(i>=0) packages[i]=p; else packages.push(p);
  save(LS.packages,packages); closePkg(); renderPackages(); toast('Package saved');
};
$('#pkgDelete').onclick=()=>{ if(!confirm('Delete this package?')) return; packages=packages.filter(x=>x.id!==editingPkg); if(state.selectedPkg===editingPkg) state.selectedPkg=null; save(LS.packages,packages); persistState(); closePkg(); renderPackages(); updateSteps(); };
$('#newPackage').onclick=()=>openPkgModal(null);
$('#resetPackages').onclick=()=>{ if(!confirm('Reset all packages to company defaults? Custom packages will be removed.')) return; packages=JSON.parse(JSON.stringify(DEFAULT_PACKAGES)); save(LS.packages,packages); renderPackages(); toast('Packages reset'); };

/* =====================================================================
   PROPOSAL GENERATION
   ===================================================================== */
function addWeeks(d,w){ const x=new Date(d); x.setDate(x.getDate()+w*7); return x; }
const fmtDate=d=>new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});

function generateProposal(){
  const pkg=packages.find(p=>p.id===state.selectedPkg);
  if(!pkg){ toast('Select a service package first'); goto('packages'); return; }
  if(!state.notes.trim()){ toast('Add discovery notes first'); goto('discovery'); return; }
  const e=extracted=extractFromNotes(state.notes);
  const client=$('#fClient').value.trim()||e.client||'[Client name]';
  const contact=$('#fContact').value.trim()||e.contact||'[Primary contact]';
  const author=$('#fAuthor').value.trim()||'[Your company]';
  const start=$('#fStart').value||new Date().toISOString().slice(0,10);
  const valid=+$('#fValid').value||30;
  const currency=$('#fCurrency').value;

  const item=(text,src,confirm=false)=>({id:uid(),text,src,confirm});
  const deliverables=pkg.deliverables.map(d=>item(d,'template'));
  e.integrations.forEach(i=>{ if(!deliverables.some(d=>d.text.toLowerCase().includes(i.toLowerCase()))) deliverables.push(item(`${i} integration (as discussed in discovery)`,'notes')); });
  if(/training/i.test(state.notes) && !deliverables.some(d=>/training/i.test(d.text))) deliverables.push(item('Hands-on training session for client team','notes'));
  if(/(wcag|accessib)/i.test(state.notes) && !deliverables.some(d=>/accessib/i.test(d.text))) deliverables.push(item('Accessibility review against WCAG AA','notes'));
  if(/(seo)/i.test(state.notes) && !deliverables.some(d=>/seo/i.test(d.text))) deliverables.push(item('SEO setup and migration of existing rankings','notes'));
  e.uncertainties.forEach(u=>deliverables.push(item(`Possible: ${u.replace(/^(not sure if|maybe|unsure if|unclear if)\s*/i,'')}`,'notes',true)));

  const assumptions=pkg.assumptions.map(a=>item(a,'template'));
  e.existingAssets.forEach(a=>assumptions.push(item(`${a} — these will be supplied to us and reused where suitable`,'notes')));
  if(e.stakeholders.length) assumptions.push(item(`Approvals are provided by: ${e.stakeholders.join('; ')}`,'notes'));
  else assumptions.push(item('A single named decision-maker will provide approvals at each milestone','template',true));
  e.constraints.forEach(c=>assumptions.push(item(`Constraint noted: ${c}`,'notes')));

  const exclusions=pkg.exclusions.map(x=>item(x,'template'));
  exclusions.push(item('Any work not explicitly listed in Deliverables will be scoped and quoted separately','template'));

  const milestones=pkg.milestones.map(([name,week])=>({id:uid(),name,week,date:addWeeks(start,week).toISOString().slice(0,10)}));
  const endDate=milestones.length?milestones[milestones.length-1].date:addWeeks(start,pkg.weeks).toISOString().slice(0,10);

  const questions=[];
  if(!e.deadline) questions.push('What is the target launch / completion date, and is it fixed or flexible?');
  else questions.push(`You mentioned "${e.deadline}". Is this date fixed? Our standard ${pkg.weeks}-week timeline ends ${fmtDate(endDate)} — please confirm it works.`);
  if(!e.budget) questions.push('Is there an approved budget range we should align the scope to?');
  else questions.push(`Please confirm the budget indication ("${e.budget}") so we can align scope before final pricing.`);
  if(!e.stakeholders.length) questions.push('Who are the decision-makers and who gives final sign-off at each milestone?');
  else questions.push(`Confirm the approval process: ${e.stakeholders.join('; ')}. Are there any other approvers?`);
  e.uncertainties.forEach(u=>questions.push(`Please confirm whether this is in scope: "${u}"`));
  if(!e.integrations.length) questions.push('Are there any systems we need to integrate with (payments, CRM, email, analytics)?');
  else questions.push(`Do you have admin access to ${e.integrations.join(', ')} that you can share with us for setup?`);
  if(!e.existingAssets.length) questions.push('Do you have existing brand guidelines, content or assets we should reuse?');
  questions.push('Who will be our day-to-day point of contact and what is their availability for weekly check-ins?');

  state.proposal={
    id:state.draftId||uid(), title:`${pkg.name} Proposal for ${client}`, client, contact, author, date:new Date().toISOString().slice(0,10), validDays:valid, currency,
    pkgName:pkg.name, pkgId:pkg.id,
    overview:`${author} is pleased to present this proposal to ${client} for a ${pkg.name} engagement. ${pkg.desc} Based on our discovery conversation with ${contact}, this document outlines what we will deliver, how the work will be phased, and the points we need you to confirm before we finalise the agreement.`,
    objectives:(e.goals.length?e.goals:['[Objectives to be confirmed with client]']).map(g=>item(g.replace(/^(they|the client|client)\s+(want|wants|need|needs)\s+/i,''),e.goals.length?'notes':'template',!e.goals.length)),
    deliverables, assumptions, exclusions, milestones, startDate:start, endDate,
    pricing: pkg.price ? {approved:true,text:pkg.price} : {approved:false,text:''},
    questions:questions.map(q=>({id:uid(),text:q,resolved:false})),
    nextSteps:['Review this proposal and the open questions in Section 8','Schedule a 30-minute call to confirm scope and answers','We issue the final version with approved pricing and the agreement for signature',`Project kickoff on ${fmtDate(start)} (subject to signature)`]
  };
  state.draftId=state.proposal.id;
  persistState(); updateSteps(); renderProposal(); goto('proposal'); toast('Proposal draft generated');
}
$('#generateBtn').onclick=generateProposal;
$('#regenerateBtn').onclick=()=>{ if(!state.proposal||confirm('Regenerate from current notes and package? Manual edits to the draft will be replaced.')) generateProposal(); };

/* ---------------- Render editable proposal ---------------- */
function renderProposal(){
  const p=state.proposal; const doc=$('#proposalDoc');
  if(!p){ doc.innerHTML='<div class="empty big">No draft yet. Add discovery notes, pick a package, then click <b>Generate</b>.</div>'; $('#tocList').innerHTML=''; updateReadiness(); return; }
  const list=(key,cls='')=>`<ul class="item-list" data-key="${key}">${p[key].map(it=>`
      <li class="${it.confirm?'confirm':''} ${it.src==='notes'?'from-notes':''}" data-id="${it.id}">
        <span class="txt" contenteditable="true" data-field="text">${esc(it.text)}</span>
        ${it.confirm?'<span class="badge warn">needs confirmation</span>':''}
        <span class="source-tag">${it.src==='notes'?'from notes':'template'}</span>
        <button class="rm" title="Remove">✕</button></li>`).join('')}</ul>
    <button class="add-item" data-add="${key}">+ Add item</button>`;
  const sections=[
    ['overview','Overview',`<p contenteditable="true" data-text="overview">${esc(p.overview)}</p>`],
    ['objectives','Objectives',list('objectives')],
    ['deliverables','Deliverables & Scope of Work',list('deliverables')],
    ['assumptions','Assumptions',list('assumptions')],
    ['exclusions','Exclusions (Out of Scope)',list('exclusions')],
    ['milestones','Milestones & Timeline',`<p>Proposed start: <b>${fmtDate(p.startDate)}</b> · Proposed completion: <b>${fmtDate(p.endDate)}</b></p>
      <table class="milestone-table"><thead><tr><th>#</th><th>Milestone</th><th>Week</th><th>Target date</th><th></th></tr></thead><tbody>
      ${p.milestones.map((m,i)=>`<tr data-id="${m.id}"><td>${i+1}</td><td contenteditable="true" data-mfield="name">${esc(m.name)}</td><td contenteditable="true" data-mfield="week">${m.week}</td><td>${fmtDate(m.date)}</td><td><button class="rm" title="Remove">✕</button></td></tr>`).join('')}
      </tbody></table><button class="add-item" data-add="milestones">+ Add milestone</button>`],
    ['pricing','Investment',p.pricing.approved
      ?`<div class="pricing-box approved"><b>✓ Approved pricing (from template)</b>${esc(p.pricing.text)}<br><small>Currency: ${p.currency}</small></div>`
      :`<div class="pricing-box"><b>⚠ Pricing to be confirmed</b>This package has no approved pricing line. Pricing must be supplied from the approved rate card by Sales/Finance before this proposal is sent. The assistant does not generate or estimate prices.<br><small>Currency: ${p.currency} · Proposal valid for ${p.validDays} days from issue.</small></div>`],
    ['questions','Questions Requiring Client Confirmation',`<div id="qList">${p.questions.map(q=>`
      <div class="question-item ${q.resolved?'resolved':''}" data-id="${q.id}"><input type="checkbox" ${q.resolved?'checked':''} title="Mark as answered"><span class="txt" contenteditable="true" style="flex:1">${esc(q.text)}</span><button class="rm" title="Remove">✕</button></div>`).join('')}</div>
      <button class="add-item" data-add="questions">+ Add question</button>`],
    ['next','Next Steps',`<ol style="padding-left:20px;font-size:14px;display:flex;flex-direction:column;gap:6px">${p.nextSteps.map(n=>`<li contenteditable="true">${esc(n)}</li>`).join('')}</ol>`],
  ];
  doc.innerHTML=`<div class="doc-cover"><div class="eyebrow">Proposal &amp; Scope of Work</div><h1 contenteditable="true" data-text="title">${esc(p.title)}</h1>
    <div class="meta"><span>Prepared for <b>${esc(p.client)}</b> (${esc(p.contact)})</span><span>Prepared by <b>${esc(p.author)}</b></span><span>Date: ${fmtDate(p.date)}</span><span>Package: ${esc(p.pkgName)}</span></div></div>
    ${sections.map(([id,t,body],i)=>`<section class="doc-section" id="sec-${id}"><h2><span class="num">0${i+1}</span>${t}</h2>${body}</section>`).join('')}`;
  $('#tocList').innerHTML=sections.map(([id,t])=>{ const n = id==='questions'?p.questions.filter(q=>!q.resolved).length : (Array.isArray(p[id])?p[id].filter(x=>x.confirm).length:0); return `<li><a href="#sec-${id}">${t}${n?`<span class="badge warn">${n}</span>`:''}</a></li>`; }).join('');
  bindDocEvents(); updateReadiness();
}

function bindDocEvents(){
  const doc=$('#proposalDoc'); const p=state.proposal;
  doc.querySelectorAll('[data-text]').forEach(el=>el.addEventListener('input',()=>{ p[el.dataset.text]=el.textContent.trim(); persistState(); }));
  doc.querySelectorAll('.item-list').forEach(ul=>{
    const key=ul.dataset.key;
    ul.querySelectorAll('li').forEach(li=>{
      const it=p[key].find(x=>x.id===li.dataset.id);
      li.querySelector('[data-field=text]').addEventListener('input',e=>{ it.text=e.target.textContent.trim(); persistState(); });
      li.querySelector('.rm').onclick=()=>{ p[key]=p[key].filter(x=>x.id!==it.id); persistState(); renderProposal(); };
      if(it.confirm) li.querySelector('.badge').onclick=()=>{ it.confirm=false; persistState(); renderProposal(); };
    });
  });
  doc.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{
    const key=b.dataset.add;
    if(key==='milestones'){ const last=p.milestones[p.milestones.length-1]; const week=(last?last.week:0)+1; p.milestones.push({id:uid(),name:'New milestone',week,date:addWeeks(p.startDate,week).toISOString().slice(0,10)}); }
    else if(key==='questions') p.questions.push({id:uid(),text:'New question for the client…',resolved:false});
    else p[key].push({id:uid(),text:'New item…',src:'manual',confirm:false});
    persistState(); renderProposal();
    const el=doc.querySelector(`#sec-${key==='next'?'next':key} [contenteditable]:last-of-type`); el&&el.focus();
  });
  doc.querySelectorAll('.milestone-table tr[data-id]').forEach(tr=>{
    const m=p.milestones.find(x=>x.id===tr.dataset.id);
    tr.querySelector('[data-mfield=name]').addEventListener('input',e=>{ m.name=e.target.textContent.trim(); persistState(); });
    tr.querySelector('[data-mfield=week]').addEventListener('blur',e=>{ m.week=parseInt(e.target.textContent)||m.week; m.date=addWeeks(p.startDate,m.week).toISOString().slice(0,10); p.milestones.sort((a,b)=>a.week-b.week); p.endDate=p.milestones[p.milestones.length-1].date; persistState(); renderProposal(); });
    tr.querySelector('.rm').onclick=()=>{ p.milestones=p.milestones.filter(x=>x.id!==m.id); persistState(); renderProposal(); };
  });
  doc.querySelectorAll('.question-item').forEach(q=>{
    const it=p.questions.find(x=>x.id===q.dataset.id);
    q.querySelector('input').onchange=e=>{ it.resolved=e.target.checked; persistState(); renderProposal(); };
    q.querySelector('.txt').addEventListener('input',e=>{ it.text=e.target.textContent.trim(); persistState(); });
    q.querySelector('.rm').onclick=()=>{ p.questions=p.questions.filter(x=>x.id!==it.id); persistState(); renderProposal(); };
  });
  doc.querySelectorAll('#sec-next li').forEach((li,i)=>li.addEventListener('input',()=>{ p.nextSteps[i]=li.textContent.trim(); persistState(); }));
}

function updateReadiness(){
  const p=state.proposal; const ring=$('#readinessRing');
  if(!p){ ring.style.background='conic-gradient(var(--accent) 0%,var(--border) 0)'; $('#readinessPct').textContent='0%'; $('#readinessText').textContent='Generate a draft to see readiness.'; return; }
  const open=p.questions.filter(q=>!q.resolved).length;
  const confirms=['objectives','deliverables','assumptions','exclusions'].reduce((n,k)=>n+p[k].filter(x=>x.confirm).length,0);
  const placeholders=[p.client,p.contact,p.author].filter(v=>/^\[/.test(v)).length;
  let score=100; score-=open*6; score-=confirms*8; score-=placeholders*10; if(!p.pricing.approved) score-=20; score=Math.max(0,Math.min(100,score));
  ring.style.background=`conic-gradient(${score>=80?'var(--ok)':score>=50?'var(--warn)':'var(--danger)'} ${score}%,var(--border) 0)`;
  $('#readinessPct').textContent=score+'%';
  const bits=[]; if(open) bits.push(`${open} open question${open>1?'s':''}`); if(confirms) bits.push(`${confirms} item${confirms>1?'s':''} to confirm`); if(!p.pricing.approved) bits.push('pricing not approved'); if(placeholders) bits.push(`${placeholders} placeholder${placeholders>1?'s':''}`);
  $('#readinessText').textContent=bits.length?'Blocked by: '+bits.join(', '):'Ready to send ✔';
}

/* =====================================================================
   EXPORTS
   ===================================================================== */
function toMarkdown(p){
  const L=a=>a.map(x=>`- ${x.text}${x.confirm?' **(needs confirmation)**':''}`).join('\n');
  return `# ${p.title}

**Prepared for:** ${p.client} (${p.contact})
**Prepared by:** ${p.author}
**Date:** ${fmtDate(p.date)} · Valid ${p.validDays} days
**Package:** ${p.pkgName}

## 1. Overview
${p.overview}

## 2. Objectives
${L(p.objectives)}

## 3. Deliverables & Scope of Work
${L(p.deliverables)}

## 4. Assumptions
${L(p.assumptions)}

## 5. Exclusions (Out of Scope)
${L(p.exclusions)}

## 6. Milestones & Timeline
Start: ${fmtDate(p.startDate)} · Completion: ${fmtDate(p.endDate)}

| # | Milestone | Week | Target date |
|---|-----------|------|-------------|
${p.milestones.map((m,i)=>`| ${i+1} | ${m.name} | ${m.week} | ${fmtDate(m.date)} |`).join('\n')}

## 7. Investment
${p.pricing.approved?`${p.pricing.text} (${p.currency})`:`**PRICING TO BE CONFIRMED** — to be supplied from the approved rate card by Sales/Finance. (${p.currency})`}

## 8. Questions Requiring Client Confirmation
${p.questions.map(q=>`- [${q.resolved?'x':' '}] ${q.text}`).join('\n')}

## 9. Next Steps
${p.nextSteps.map((n,i)=>`${i+1}. ${n}`).join('\n')}
`;
}
function toHTML(p){
  const md=toMarkdown(p);
  const body=esc(md).replace(/^# (.*)$/gm,'<h1>$1</h1>').replace(/^## (.*)$/gm,'<h2>$1</h2>').replace(/\*\*(.+?)\*\*/g,'<b>$1</b>')
    .replace(/^- \[(x| )\] (.*)$/gm,(m,c,t)=>`<li>${c==='x'?'☑':'☐'} ${t}</li>`).replace(/^- (.*)$/gm,'<li>$1</li>').replace(/^(\d+)\. (.*)$/gm,'<li>$2</li>')
    .replace(/^\|(.+)\|$/gm,r=>{ const cells=r.split('|').slice(1,-1).map(c=>c.trim()); if(cells.every(c=>/^-+$/.test(c))) return ''; return `<tr>${cells.map(c=>`<td>${c}</td>`).join('')}</tr>`; })
    .replace(/(<tr>[\s\S]*?<\/tr>\s*)+/g,m=>`<table>${m}</table>`).replace(/(<li>[\s\S]*?<\/li>\s*)+/g,m=>`<ul>${m}</ul>`).replace(/\n{2,}/g,'<br>');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(p.title)}</title><style>body{font-family:Segoe UI,system-ui,sans-serif;max-width:820px;margin:40px auto;padding:0 24px;color:#111;line-height:1.55}h1{color:#2f5d8a;border-bottom:2px solid #2f5d8a;padding-bottom:8px}h2{margin-top:28px;font-size:18px}table{border-collapse:collapse;width:100%}td{border:1px solid #ddd;padding:8px}ul{padding-left:20px}</style></head><body>${body}</body></html>`;
}
function download(name,content,type){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([content],{type})); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
$('#exportMenuBtn').onclick=e=>{ e.stopPropagation(); $('#exportMenu').classList.toggle('open'); };
document.addEventListener('click',()=>$('#exportMenu').classList.remove('open'));
$$('#exportMenu button').forEach(b=>b.onclick=async()=>{
  const p=state.proposal; if(!p) return toast('Nothing to export yet');
  const base=p.title.replace(/[^\w]+/g,'-').toLowerCase();
  switch(b.dataset.export){
    case 'md': download(base+'.md',toMarkdown(p),'text/markdown'); break;
    case 'html': download(base+'.html',toHTML(p),'text/html'); break;
    case 'json': download(base+'.json',JSON.stringify(p,null,2),'application/json'); break;
    case 'copy': try{ await navigator.clipboard.writeText(toMarkdown(p)); toast('Copied as Markdown'); }catch{ toast('Clipboard blocked by browser'); } break;
    case 'print': window.print(); break;
  }
});

/* =====================================================================
   DRAFTS
   ===================================================================== */
$('#saveDraftBtn').onclick=()=>{
  const p=state.proposal; if(!p) return toast('Generate a draft first');
  const d={ id:p.id, title:p.title, client:p.client, pkgName:p.pkgName, savedAt:new Date().toISOString(), proposal:p, notes:state.notes, selectedPkg:state.selectedPkg };
  const i=drafts.findIndex(x=>x.id===d.id); if(i>=0) drafts[i]=d; else drafts.unshift(d);
  save(LS.drafts,drafts); toast('Draft saved');
};
function renderDrafts(){
  const q=($('#draftSearch').value||'').toLowerCase();
  const list=drafts.filter(d=>(d.title+d.client+d.pkgName).toLowerCase().includes(q));
  $('#draftList').innerHTML=list.length?list.map(d=>`<div class="draft-card"><h3>${esc(d.title)}</h3><div class="meta">${esc(d.client)} · ${esc(d.pkgName)}<br>Saved ${new Date(d.savedAt).toLocaleString()}</div>
    <div class="meta"><span class="badge warn">${d.proposal.questions.filter(x=>!x.resolved).length} open questions</span> ${d.proposal.pricing.approved?'<span class="badge ok">pricing approved</span>':'<span class="badge warn">pricing TBC</span>'}</div>
    <div class="actions"><button class="btn primary small" data-open="${d.id}">Open</button><button class="btn ghost small" data-dup="${d.id}">Duplicate</button><button class="btn ghost danger small" data-del="${d.id}">Delete</button></div></div>`).join('')
    :'<div class="empty big">No saved drafts yet.</div>';
  $$('[data-open]').forEach(b=>b.onclick=()=>{ const d=drafts.find(x=>x.id===b.dataset.open); state.proposal=JSON.parse(JSON.stringify(d.proposal)); state.notes=d.notes; state.selectedPkg=d.selectedPkg; state.draftId=d.id; notesInput.value=d.notes; extracted=extractFromNotes(d.notes); renderExtract(); persistState(); updateSteps(); renderProposal(); goto('proposal'); });
  $$('[data-dup]').forEach(b=>b.onclick=()=>{ const d=JSON.parse(JSON.stringify(drafts.find(x=>x.id===b.dataset.dup))); d.id=uid(); d.proposal.id=d.id; d.title+=' (copy)'; d.proposal.title=d.title; d.savedAt=new Date().toISOString(); drafts.unshift(d); save(LS.drafts,drafts); renderDrafts(); });
  $$('[data-del]').forEach(b=>b.onclick=()=>{ if(!confirm('Delete this draft?')) return; drafts=drafts.filter(x=>x.id!==b.dataset.del); save(LS.drafts,drafts); renderDrafts(); });
}
$('#draftSearch').addEventListener('input',renderDrafts);

/* ---------------- Init ---------------- */
renderPackages(); renderProposal(); updateSteps();
})();
