const App = (() => {
  const LS_CFG='av_supabase_config_v51';
  let sb=null, user=null, profile=null, active='dashboard', searchTerm='', selectedPhotoFiles=[], selectedPlanFiles=[], bidFilters={project_id:'',trade:'',status:''}, cache={projects:[],site_reports:[],plans:[],plan_files:[],tasks:[],photos:[],daily_logs:[],rfis:[],subcontractors:[],bid_tracker:[]};
  const statuses=['Open','In Progress','Ready for Review','Done','Blocked'];
  const bidTrades=['Site Preparation','Foundation','Framing','Plumbing','HVAC','Electrical','Roofing','Drywall','Paint','Flooring','Cabinets','Countertops','Landscaping'];
  const bidStatuses=['Not Contacted','Email Sent','Followed Up','Site Visit Scheduled','Quote Received','Need Clarification','Shortlisted','Selected','Rejected','Contract Signed'];
  const bidBooleanFields=['site_visit_needed','quote_received','turnkey','labor_included','materials_included','equipment_included','cleanup_included','permits_included','inspections_included'];
  const priorities=['Low','Medium','High','Critical'];
  const roles=['admin','project_manager','superintendent','subcontractor','client'];
  const LS_IMPORT_HISTORY='av_spreadsheet_import_history_v1';
  const importTargets={
    projects:{label:'Projects',table:'projects',fields:['name','address','status'],required:['name'],defaults:{status:'Active'},duplicate:['name','address']},
    subcontractors:{label:'Subcontractors',table:'subcontractors',fields:['company','trade','contact_name','phone','email','website','notes'],required:['company','trade'],duplicate:['company','email']},
    bid_tracker:{label:'Preconstruction / Bids',table:'bid_tracker',fields:['project_id','trade','company','contact_name','email','phone','website','email_sent_date','follow_up_date','site_visit_needed','site_visit_date','quote_received','quote_amount','turnkey','labor_included','materials_included','equipment_included','cleanup_included','permits_included','inspections_included','missing_scope_items','status','notes'],required:['project_id','trade','company'],defaults:{status:'Not Contacted'},duplicate:['project_id','trade','company']},
    tasks:{label:'Tasks / Punch List',table:'tasks',fields:['project_id','title','location','status','notes'],required:['project_id','title'],defaults:{status:'Open'},duplicate:['project_id','title','location']},
    daily_logs:{label:'Daily Logs',table:'daily_logs',fields:['project_id','log_date','delays'],required:['project_id','log_date'],duplicate:['project_id','log_date']},
    rfis:{label:'RFIs',table:'rfis',fields:['project_id','title','question','response','status','due_date'],required:['project_id','title','question'],defaults:{status:'Open'},duplicate:['project_id','title']},
    plans:{label:'Plans',table:'plans',fields:['project_id','sheet_no','title','revision'],required:['project_id'],duplicate:['project_id','sheet_no','revision'],requiresOneOf:[['sheet_no','title']]}
  };
  const importBooleanFields=['site_visit_needed','quote_received','turnkey','labor_included','materials_included','equipment_included','cleanup_included','permits_included','inspections_included'];
  const importDateFields=['email_sent_date','follow_up_date','site_visit_date','log_date','due_date'];
  const importAmountFields=['quote_amount'];
  const importFieldAliases={
    name:['project name','project','job','job name','name'],
    project_id:['project id','project_id','project name','project','job','job name'],
    address:['address','project address','job address','site address'],
    company:['company','company name','vendor','subcontractor','subcontractor name'],
    trade:['trade','scope','division','category'],
    contact_name:['contact','contact name','name','primary contact'],
    phone:['phone','phone number','mobile','cell','telephone'],
    email:['email','email address','e-mail'],
    website:['website','url','web site'],
    notes:['notes','note','comment','comments'],
    title:['title','task','task title','punch item','rfi title','plan title','sheet title'],
    location:['location','area','room'],
    log_date:['log date','date','daily log date'],
    delays:['delays','daily notes','notes','work completed','field notes'],
    question:['question','rfi question','request','issue'],
    response:['response','answer'],
    due_date:['due date','due','deadline'],
    sheet_no:['sheet no','sheet #','sheet number','sheet','drawing no','drawing number'],
    revision:['revision','rev'],
    quote_amount:['quote amount','amount','price','bid','bid amount','cost'],
    email_sent_date:['email sent','email sent date','sent date'],
    follow_up_date:['follow up','follow-up','follow-up date','follow up date'],
    site_visit_needed:['site visit needed','site visit required','needs site visit'],
    site_visit_date:['site visit','site visit date'],
    quote_received:['quote received','bid received','proposal received'],
    turnkey:['turnkey','turn key'],
    labor_included:['labor included','labor'],
    materials_included:['materials included','materials'],
    equipment_included:['equipment included','equipment'],
    cleanup_included:['cleanup included','cleanup'],
    permits_included:['permits included','permits'],
    inspections_included:['inspections included','inspections'],
    missing_scope_items:['missing scope','exclusions','missing items','missing scope items'],
    status:['status','stage']
  };
  let importState={target:'projects',sourceType:'upload',sourceName:'',headers:[],rows:[],mappings:{},validation:null,readyRows:[],errorRows:[],importResult:null,warnings:[],duplicateMode:'insert',createMissingProjects:false};
  const $=s=>document.querySelector(s);
  const id=()=>crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  const esc=v=>String(v??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
  const date=()=>new Date().toISOString().slice(0,10);
  const DEFAULT_SUPABASE={url:'https://evmmynvjubnglwzxahbj.supabase.co',anonKey:'sb_publishable_4-vsBFuSBPs10aXL5HyW2Q_Y6yNd009'};
  const cfg=()=>{try{const saved=JSON.parse(localStorage.getItem(LS_CFG)||'null')||{}; return {url:saved.url||DEFAULT_SUPABASE.url, anonKey:saved.anonKey||DEFAULT_SUPABASE.anonKey}}catch{return DEFAULT_SUPABASE}};
  const setCfg=c=>localStorage.setItem(LS_CFG,JSON.stringify(c));
  const initSb=()=>{const c=cfg(); if(!c?.url||!c?.anonKey)return false; sb=window.supabase.createClient(c.url,c.anonKey); return true};
  const toast=(msg)=>alert(msg);
  const canEdit=()=>['admin','project_manager','superintendent'].includes(profile?.role);
  const canAdmin=()=>['admin','project_manager'].includes(profile?.role);

  async function start(){
    if('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js').catch(()=>{});
    if(!initSb()) return renderSetup();
    const {data}=await sb.auth.getUser(); user=data.user;
    if(!user) return renderLogin();
    await loadProfile(); await loadAll(); renderShell();
  }
  async function loadProfile(){
    const {data,error}=await sb.from('profiles').select('*').eq('id',user.id).single();
    if(error||!data){
      const fallback={id:user.id,email:user.email,full_name:user.email?.split('@')[0]||'User',role:'admin'};
      await sb.from('profiles').upsert(fallback); profile=fallback;
    } else profile=data;
  }
  async function loadAll(){
    for(const t of Object.keys(cache)){
      const {data,error}=await sb.from(t).select('*').order('created_at',{ascending:false});
      if(!error) cache[t]=data||[];
    }
  }
  function renderSetup(){
    document.body.innerHTML=`<div id="app"><div class="setupwrap"><div class="loginbox"><div class="logo"><img class="brandLogo" src="assets/amin-logo-full.png" alt="Amin Ventures full logo"></div><h1>Cloud Setup</h1><p class="muted">Paste your Supabase Project URL and anon public key once. Then deploy this folder with GitHub Pages and use the app as a field PWA.</p><div class="alert"><b>Before this:</b> create a Supabase project, run <b>supabase_schema.sql</b>, and create the storage bucket named <b>jobsite-photos</b>.</div><br><div class="field"><label>Supabase Project URL</label><input id="url" placeholder="https://xxxx.supabase.co"></div><br><div class="field"><label>Supabase anon public key</label><textarea id="key" placeholder="eyJhbGci..."></textarea></div><br><button class="btn gold" id="saveCfg">Save Cloud Settings</button></div></div></div>`;
    $('#saveCfg').onclick=()=>{setCfg({url:$('#url').value.trim(),anonKey:$('#key').value.trim()}); location.reload()};
  }
  function renderLogin(){
    document.body.innerHTML=`<div id="app"><div class="loginwrap"><div class="loginbox"><div class="logo"><img class="brandLogo" src="assets/amin-logo-full.png" alt="Amin Ventures full logo"></div><h1>Sign in</h1><p class="muted">Sign in with your Amin Ventures field account.</p><div class="field"><label>Email</label><input id="email" type="email" placeholder="you@aminventures.com"></div><br><div class="field"><label>Password</label><input id="password" type="password"></div><br><div class="row"><button class="btn gold" id="signin">Sign In</button><button class="btn" id="signup">Create First Admin</button></div><br><div class="alert">For first use only: create the first admin account. After that, sign in with email and password.</div></div></div></div>`;
    $('#signin').onclick=async()=>{const {error}=await sb.auth.signInWithPassword({email:$('#email').value,password:$('#password').value}); if(error) return toast(error.message); location.reload()};
    $('#signup').onclick=async()=>{const email=$('#email').value,password=$('#password').value; const {data,error}=await sb.auth.signUp({email,password}); if(error)return toast(error.message); if(data.user){await sb.from('profiles').upsert({id:data.user.id,email,full_name:email.split('@')[0],role:'admin'}); toast('Account created. Check email if Supabase requires confirmation, then sign in.')}};
  }
  function renderShell(){
    document.body.innerHTML=`<div class="app"><aside class="sidebar" id="side"><div class="logo"><img class="brandLogo" src="assets/amin-logo-full.png" alt="Amin Ventures full logo"></div><nav class="nav">${navBtn('dashboard','⌂','Dashboard')}${navBtn('projects','▣','Projects')}${navBtn('site_reports','◷','Site Reports')}${navBtn('plans','▤','Plans')}${navBtn('tasks','☑','Punch List')}${navBtn('photos','▧','Photos')}${navBtn('daily_logs','◷','Daily Logs')}${navBtn('rfis','?','RFIs')}${navBtn('subcontractors','♟','Subcontractors')}${navBtn('bid_tracker','◫','Preconstruction / Bids')}${navBtn('import_center','⇪','Spreadsheet Import Center')}${navBtn('reports','▥','Reports')}${navBtn('users','◉','Team / Roles')}</nav><div class="userbox"><b>${esc(profile.full_name||profile.email)}</b><br>${esc(profile.role)}<br><span class="muted">${esc(profile.email)}</span><br><br><div class="muted" style="margin-top:10px">AV Field v5.32 - Connected</div><button class="btn ghost" id="signout">Sign out</button></div></aside><button class="navScrim" id="navScrim" aria-label="Close menu"></button><main class="main"><header class="topbar"><button class="btn mobileMenu" id="menu">☰</button><input class="search" id="search" value="${esc(searchTerm)}" placeholder="Search projects, bids, tasks, plans..."><div class="top-actions"><button class="btn" id="sync">Sync</button><button class="btn gold" id="quickTask">Site Report</button></div></header><section class="content" id="view"></section></main></div>`;
    $('#signout').onclick=async()=>{await sb.auth.signOut();location.reload()}; $('#sync').onclick=async()=>{await loadAll(); renderView();}; $('#quickTask').onclick=()=>openForm('site_reports'); $('#menu').onclick=()=>$('#side').classList.toggle('open'); $('#navScrim').onclick=()=>$('#side').classList.remove('open'); $('#search').oninput=e=>{searchTerm=e.target.value.trim(); renderView();}; document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>{active=b.dataset.nav;searchTerm='';renderShell()}); renderView();
  }
  function navBtn(k,i,l){return `<button data-nav="${k}" class="${active===k?'active':''}">${l}</button>`}
  function renderView(){
    const v=$('#view'); if(!v)return; document.querySelectorAll('[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===active));
    if(searchTerm) v.innerHTML=searchPage();
    else if(active==='dashboard') v.innerHTML=dashboard();
    else if(active==='import_center') v.innerHTML=renderImportCenter();
    else if(active==='reports') v.innerHTML=reports();
    else if(active==='users') v.innerHTML=usersPage();
    else if(active==='cloud') v.innerHTML=cloudSetupPage();
    else v.innerHTML=listPage(active);
    bindActions();
  }
  function dashboard(){
    const open=cache.tasks.filter(t=>t.status!=='Done').length, critical=cache.tasks.filter(t=>t.status==='Blocked').length;
    const quotes=cache.bid_tracker.filter(b=>b.quote_received).length, clarify=cache.bid_tracker.filter(b=>b.status==='Need Clarification').length, selected=cache.bid_tracker.filter(b=>b.status==='Selected').length;
    return `<div class="between"><div><h1>Field Dashboard</h1><p class="muted">Projects, punch items, field photos, bids, daily logs, and reports in one place.</p></div><button class="btn gold no-print heroAction" data-add="site_reports">Site Report</button></div><div class="grid stats"><div class="card stat"><div class="label">Active Projects</div><div class="value">${cache.projects.length}</div><div class="sub">Current jobs</div></div><div class="card stat"><div class="label">Open Tasks</div><div class="value">${open}</div><div class="sub">Assigned work</div></div><div class="card stat"><div class="label">Critical Items</div><div class="value">${critical}</div><div class="sub">Needs attention</div></div><div class="card stat"><div class="label">Site Reports</div><div class="value">${cache.site_reports.length}</div><div class="sub">Submitted reports</div></div></div><div class="grid stats bidStats"><div class="card stat"><div class="label">Total Bids</div><div class="value">${cache.bid_tracker.length}</div><div class="sub">Bid tracker records</div></div><div class="card stat"><div class="label">Quotes Received</div><div class="value">${quotes}</div><div class="sub">Pricing in hand</div></div><div class="card stat"><div class="label">Need Clarification</div><div class="value">${clarify}</div><div class="sub">Open scope questions</div></div><div class="card stat"><div class="label">Selected</div><div class="value">${selected}</div><div class="sub">Chosen vendors</div></div></div><div class="grid dashboardGrid">${recentProjects()}${recentTasks()}</div><br><div class="grid dashboardGrid">${recentSiteReports()}${recentPhotos()}</div>`;
  }
  const projectName=id=>cache.projects.find(p=>p.id===id)?.name||'—';
  function recentProjects(){return `<div class="card"><div class="between"><h2>Project Progress</h2></div>${cache.projects.slice(0,5).map(p=>`<div class="between" style="border-top:1px solid rgba(255,255,255,.07);padding:12px 0"><div><b>${esc(p.name)}</b><div class="muted">${esc(p.address||'')}</div></div><span class="pill green">${esc(p.status||'Active')}</span></div>`).join('')||'<p class="muted">No projects yet.</p>'}</div>`}
  function recentTasks(){return `<div class="card"><div class="between"><h2>Open Punch List</h2></div>${cache.tasks.slice(0,6).map(t=>`<div class="between" style="border-top:1px solid rgba(255,255,255,.07);padding:12px 0"><div><b>${esc(t.title)}</b><div class="muted">${esc(projectName(t.project_id))} - ${esc(t.location||'')}</div></div><span class="pill ${t.status==='Blocked'?'red':t.status==='Done'?'green':''}">${esc(t.status||'Open')}</span></div>`).join('')||'<p class="muted">No punch items yet.</p>'}</div>`}
  function recentSiteReports(){return `<div class="card"><div class="between"><h2>Recent Site Reports</h2></div>${cache.site_reports.slice(0,5).map(r=>siteReportRow(r)).join('')||'<p class="muted">No site reports yet.</p>'}</div>`}
  function recentPhotos(){return `<div class="card"><div class="between"><h2>Recent Photos</h2></div><div class="photos">${cache.photos.slice(0,6).map(p=>photoCard(p,false)).join('')||'<p class="muted">No photos yet.</p>'}</div></div>`}
  function recentLogs(){return `<div class="card"><div class="between"><h2>Daily Logs</h2></div>${cache.daily_logs.slice(0,5).map(l=>`<div style="border-top:1px solid rgba(255,255,255,.07);padding:12px 0"><b>${esc(projectName(l.project_id))}</b><div class="muted">${esc(l.log_date)}</div><div>${esc(l.delays||'')}</div></div>`).join('')||'<p class="muted">No logs yet.</p>'}</div>`}
  function filteredRows(t){
    let rows=cache[t]||[];
    if(t==='bid_tracker'){
      rows=rows.filter(r=>(!bidFilters.project_id||r.project_id===bidFilters.project_id)&&(!bidFilters.trade||r.trade===bidFilters.trade)&&(!bidFilters.status||r.status===bidFilters.status));
    }
    const q=searchTerm.toLowerCase();
    if(!q) return rows;
    return rows.filter(r=>[...Object.values(r), projectName(r.project_id)].some(v=>String(v??'').toLowerCase().includes(q)));
  }
  function searchPage(){
    const tables=['projects','site_reports','tasks','plans','photos','daily_logs','rfis','subcontractors','bid_tracker'];
    const counts=tables.map(t=>[t,filteredRows(t).length]).filter(([,n])=>n);
    return `<div class="between"><div><h1>Search Results</h1><p class="muted">Showing matches for "${esc(searchTerm)}".</p></div><button class="btn ghost" id="clearSearch">Clear</button></div><br><div class="grid searchGrid">${counts.map(([t,n])=>`<button class="card searchHit" data-go="${t}"><b>${esc(label(t))}</b><span>${n}</span></button>`).join('')||'<div class="card muted">No matching records.</div>'}</div><br>${counts[0]?`<div class="card">${tableFor(counts[0][0])}</div>`:''}`;
  }
  function listPage(t){
    const titles={projects:'Projects',site_reports:'Site Reports',plans:'Plans / Sheets',tasks:'Punch List',photos:'Photos',daily_logs:'Daily Logs',rfis:'RFIs',subcontractors:'Subcontractors',bid_tracker:'Preconstruction / Bids'};
    const descriptions={bid_tracker:'Track bid outreach, site visits, quotes, scope inclusions, and vendor status.'};
    return `<div class="between"><div><h1>${titles[t]}</h1><p class="muted">${descriptions[t]||'Create, edit, delete, and keep field records current.'}</p></div>${canEdit()?`<button class="btn gold no-print" data-add="${t}">+ Add</button>`:''}</div>${t==='bid_tracker'?bidFiltersHtml():''}<br><div class="card">${tableFor(t)}</div>`;
  }
  function tableFor(t){
    if(t==='site_reports') return siteReportsCards();
    if(t==='photos') return `<div class="photos">${filteredRows('photos').map(p=>photoCard(p,true)).join('')||'<p class="muted">No photos.</p>'}</div>`;
    const rows=filteredRows(t); const cols={projects:['name','address','status'],plans:['sheet_no','title','revision','project_id'],tasks:['title','project_id','location','status'],daily_logs:['log_date','project_id','delays'],rfis:['title','project_id','status','due_date'],subcontractors:['company','trade','contact_name','phone','email'],bid_tracker:['project_id','trade','company','email_sent_date','follow_up_date','quote_received','quote_amount','status']}[t];
    return `<table class="table"><thead><tr>${cols.map(c=>`<th>${label(c)}</th>`).join('')}<th class="no-print">Actions</th></tr></thead><tbody>${rows.map(r=>`<tr>${cols.map(c=>`<td>${esc(cellValue(r,c))}</td>`).join('')}<td class="no-print"><button class="btn" data-edit="${t}" data-id="${r.id}">Edit</button> ${canEdit()?`<button class="btn danger" data-del="${t}" data-id="${r.id}">Delete</button>`:''}</td></tr>`).join('')||`<tr><td colspan="${cols.length+1}" class="muted">No records yet.</td></tr>`}</tbody></table>`;
  }
  function cellValue(r,c){
    if(c==='project_id') return projectName(r[c]);
    if(c==='quote_received') return r[c]?'Yes':'No';
    if(c==='quote_amount') return r[c]===null||r[c]===undefined||r[c]===''?'':`$${Number(r[c]).toLocaleString()}`;
    return r[c];
  }
  function bidFiltersHtml(){
    return `<br><div class="card"><div class="bidFilters"><div class="field"><label>Project</label><select id="bidFilterProject"><option value="">All Projects</option>${projectOptions(bidFilters.project_id)}</select></div><div class="field"><label>Trade</label><select id="bidFilterTrade"><option value="">All Trades</option>${bidTrades.map(x=>`<option ${bidFilters.trade===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Status</label><select id="bidFilterStatus"><option value="">All Statuses</option>${bidStatuses.map(x=>`<option ${bidFilters.status===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="bidFilterActions"><button class="btn" id="clearBidFilters">Clear Filters</button></div></div></div>`;
  }
  function label(c){return ({site_reports:'Site Reports',bid_tracker:'Preconstruction / Bids',project_id:'Project',report_date:'Date',sheet_no:'Sheet #',due_date:'Due Date',log_date:'Date',email_sent_date:'Email Sent Date',follow_up_date:'Follow-up Date',site_visit_needed:'Site Visit Needed',site_visit_date:'Site Visit Date',quote_received:'Quote Received',quote_amount:'Quote Amount',contact_name:'Contact'}[c]||c).replaceAll('_',' ').replace(/^./,m=>m.toUpperCase())}
  function reportPhotos(reportId){return cache.photos.filter(p=>p.report_id===reportId)}
  function reportSubmitter(r){return r.submitted_by_name||r.submitted_by_email||'Field team'}
  function siteReportRow(r){
    const photos=reportPhotos(r.id).length;
    return `<div class="reportLine"><div><b>${esc(projectName(r.project_id))}</b><div class="muted">${esc(r.report_date||'')} - ${esc(reportSubmitter(r))} - ${photos} photo${photos===1?'':'s'}</div><div>${esc(r.issues||r.delays||'')}</div></div><button class="btn" data-view-report="${r.id}">Open</button></div>`;
  }
  function siteReportsCards(){
    const rows=filteredRows('site_reports');
    return `<div class="reportCards">${rows.map(r=>{const photos=reportPhotos(r.id);return `<div class="reportCard"><div class="between"><div><h2>${esc(projectName(r.project_id))}</h2><p class="muted">${esc(r.report_date||'')} - ${esc(reportSubmitter(r))}</p></div><span class="pill green">${photos.length} photo${photos.length===1?'':'s'}</span></div><div class="reportSummary"><b>Issues / Delays</b><p>${esc(r.issues||r.delays||'None reported.')}</p></div><div class="reportThumbs">${photos.slice(0,4).map(p=>`<img src="${esc(p.url)}" alt="${esc(p.location||'Report photo')}">`).join('')}</div><div class="row no-print"><button class="btn" data-view-report="${r.id}">Open</button><button class="btn" data-edit="site_reports" data-id="${r.id}">Edit</button>${canEdit()?`<button class="btn danger" data-del="site_reports" data-id="${r.id}">Delete</button>`:''}</div></div>`}).join('')||'<p class="muted">No site reports yet.</p>'}</div>`;
  }
  function openSiteReport(id){
    const r=cache.site_reports.find(x=>x.id===id);
    if(!r)return;
    const photos=reportPhotos(id);
    document.body.insertAdjacentHTML('beforeend',`<div class="modal"><div class="modalbox"><div class="between"><div><h1>Site Report</h1><p class="muted">${esc(projectName(r.project_id))} - ${esc(r.report_date||'')} - ${esc(reportSubmitter(r))}</p></div><button class="btn" data-close>Close</button></div><div class="reportDetail"><div class="card"><h2>Field Notes</h2><p><b>Issues / Delays:</b><br>${esc(r.issues||r.delays||'')}</p></div><div class="card"><h2>Photos</h2><div class="photos">${photos.map(p=>photoCard(p,false)).join('')||'<p class="muted">No photos attached.</p>'}</div></div></div></div></div>`);
    $('[data-close]').onclick=()=>$('.modal').remove();
  }
  function photoCard(p,actions){const title=p.location||p.notes||`${p.category||'Progress'} Photo`; return `<div class="photo"><img src="${esc(p.url)}" alt="${esc(title)}"><div class="pbody"><b>${esc(title)}</b><div class="muted">${esc(projectName(p.project_id))}<br>${esc(p.category||'Progress')} - ${esc(new Date(p.created_at).toLocaleString())}</div>${actions&&canEdit()?`<br><button class="btn danger" data-del="photos" data-id="${p.id}">Delete</button>`:''}</div></div>`}
  function reports(){return `<div class="between"><div><h1>Reports</h1><p class="muted">Direct PDF creator. Does not rely on browser print layout. US Letter size built into the PDF.</p></div></div><br><div class="grid reportGrid"><div class="card"><h2>Site Report Package</h2><p class="muted">Submitted report notes with attached field photos.</p><button class="btn gold" data-pdf="site_reports">Download Exact PDF</button></div><div class="card"><h2>Daily Field Report</h2><p class="muted">Daily notes with attached field photos.</p><button class="btn gold" data-pdf="daily">Download Exact PDF</button></div><div class="card"><h2>Punch List Report</h2><p class="muted">Open punch items with notes and photos.</p><button class="btn gold" data-pdf="tasks">Download Exact PDF</button></div><div class="card"><h2>Photo Report</h2><p class="muted">Cloud photos with project, location, category, and notes.</p><button class="btn gold" data-pdf="photos">Download Exact PDF</button></div></div><br><div class="card"><h2>Export Data</h2><button class="btn" data-csv="projects">Export Projects CSV</button> <button class="btn" data-csv="subcontractors">Export Subcontractors CSV</button> <button class="btn" data-csv="bid_tracker">Export Bid Tracker CSV</button> <button class="btn" data-csv="tasks">Export Tasks CSV</button> <button class="btn" data-csv="daily_logs">Export Daily Logs CSV</button> <button class="btn" data-csv="rfis">Export RFIs CSV</button> <button class="btn" data-csv="plans">Export Plans CSV</button> <button class="btn" data-csv="site_reports">Export Site Reports CSV</button> <button class="btn" data-csv="photos">Export Photos CSV</button></div>`}

  function cloudSetupPage(){
    const c=cfg()||{};
    return `<div class="between"><div><h1>Cloud Setup</h1><p class="muted">Supabase is pre-configured for Amin Ventures. You can update or verify the connection here if needed.</p></div></div><br><div class="card"><div class="alert"><b>Status:</b> AV Field v5.20 package. Photos use Supabase Storage bucket <b>jobsite-photos</b>. Data uses Supabase database tables.</div><br><div class="field"><label>Supabase Project URL</label><input id="cloud_url" value="${esc(c.url||'')}" placeholder="https://xxxx.supabase.co"></div><br><div class="field"><label>Supabase Publishable / anon public key</label><textarea id="cloud_key" placeholder="sb_publishable_... or eyJ...">${esc(c.anonKey||'')}</textarea></div><br><button class="btn gold" id="saveCloud">Save Cloud Settings</button> <button class="btn ghost" id="resetCloud">Reset Cloud Settings</button><br><br><p class="muted">After saving, the app refreshes and reconnects to Supabase. Do not use the secret/service_role key.</p></div>`
  }

  function renderImportCenter(){
    const cfg=importTargets[importState.target];
    return `<div class="between"><div><h1>Spreadsheet Import Center</h1><p class="muted">Import CSV files or Google Sheets data into Amin Ventures Field App.</p></div></div><br><div class="grid importGrid"><div class="card"><h2>Choose Import Target</h2><div class="field"><label>Import Target</label><select id="importTarget">${Object.entries(importTargets).map(([k,t])=>`<option value="${k}" ${importState.target===k?'selected':''}>${esc(t.label)}</option>`).join('')}</select></div><br><div class="field"><label>Duplicate Handling</label><select id="importDuplicateMode"><option value="insert" ${importState.duplicateMode==='insert'?'selected':''}>Insert all rows</option><option value="skip" ${importState.duplicateMode==='skip'?'selected':''}>Skip possible duplicates</option><option value="upsert" ${importState.duplicateMode==='upsert'?'selected':''}>Upsert / update existing when possible</option></select></div>${cfg.fields.includes('project_id')?`<br><label class="checkRow"><input id="importCreateProjects" type="checkbox" ${importState.createMissingProjects?'checked':''}> Create missing projects automatically</label>`:''}</div><div class="card"><h2>Choose Import Source</h2><div class="field"><label>Import Source</label><select id="importSourceType"><option value="upload" ${importState.sourceType==='upload'?'selected':''}>Upload CSV</option><option value="url" ${importState.sourceType==='url'?'selected':''}>Paste Google Sheets CSV URL</option><option value="text" ${importState.sourceType==='text'?'selected':''}>Paste CSV text</option></select></div><div class="importSourcePanel ${importState.sourceType==='upload'?'':'hidden'}"><div class="field"><label>CSV File</label><input id="importFile" type="file" accept=".csv,text/csv"></div></div><div class="importSourcePanel ${importState.sourceType==='url'?'':'hidden'}"><div class="field"><label>Google Sheets CSV Export URL</label><input id="importUrl" value="${esc(importState.sourceUrl||'')}" placeholder="https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/export?format=csv&gid=SHEET_GID"></div><p class="muted">Private Sheets cannot be read directly. Export as CSV, publish as CSV, or upload the CSV manually.</p></div><div class="importSourcePanel ${importState.sourceType==='text'?'':'hidden'}"><div class="field"><label>Raw CSV Text</label><textarea id="importText" placeholder="Paste spreadsheet CSV text here">${esc(importState.csvText||'')}</textarea></div></div><br><div class="row"><button class="btn gold" id="importLoadPreview">Load Preview</button><button class="btn" id="importClear">Clear Import</button></div></div></div><br>${renderImportWarnings()}<div class="card"><div class="between"><h2>Preview Data</h2><span class="pill">${importState.rows.length} loaded row${importState.rows.length===1?'':'s'}</span></div>${renderImportPreview()}</div><br><div class="card"><div class="between"><h2>Map Columns</h2><button class="btn" id="importAutoMap" ${importState.rows.length?'':'disabled'}>Auto Map Columns</button></div>${renderColumnMapping()}</div><br><div class="grid importGrid"><div class="card"><div class="between"><h2>Validation Results</h2><button class="btn" id="importValidate" ${importState.rows.length?'':'disabled'}>Validate Rows</button></div>${renderImportValidation()}</div><div class="card"><div class="between"><h2>Import Results</h2><button class="btn gold" id="importRun" ${importState.readyRows.length&&canEdit()?'':'disabled'}>Import to App</button></div>${canEdit()?'':'<p class="dangerText">Your role does not allow importing records.</p>'}${renderImportResult()}<br><button class="btn" id="importDownloadErrors" ${importErrorRows().length?'':'disabled'}>Download Error CSV</button></div></div><br><div class="card"><h2>Import History</h2>${renderImportHistory()}</div>`;
  }
  function renderImportWarnings(){
    return importState.warnings.length?`<div class="alert importWarning">${importState.warnings.map(esc).join('<br>')}</div><br>`:'';
  }
  function renderImportPreview(){
    if(!importState.rows.length) return '<p class="muted">Load a CSV file, Google Sheets CSV link, or pasted CSV text to preview the first 20 rows.</p>';
    const headers=importState.headers;
    return `<div class="tableWrap"><table class="table"><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${importState.rows.slice(0,20).map(r=>`<tr>${headers.map(h=>`<td>${esc(r[h])}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="muted">Showing first 20 rows only.</p>`;
  }
  function renderColumnMapping(){
    if(!importState.headers.length) return '<p class="muted">No columns loaded yet.</p>';
    const cfg=importTargets[importState.target];
    const options=`<option value="">Do not import</option>`+importState.headers.map(h=>`<option value="${esc(h)}">${esc(h)}</option>`).join('');
    return `<div class="tableWrap"><table class="table"><thead><tr><th>App Field</th><th>Spreadsheet Column</th><th>Required?</th><th>Sample Value</th></tr></thead><tbody>${cfg.fields.map(f=>{const mapped=importState.mappings[f]||'';return `<tr><td><b>${esc(importFieldLabel(f))}</b></td><td><select data-import-map="${f}">${options.replace(`value="${esc(mapped)}"`,`value="${esc(mapped)}" selected`)}</select></td><td>${esc(importRequiredText(cfg,f))}</td><td class="muted">${esc(sampleForMappedColumn(mapped))}</td></tr>`}).join('')}</tbody></table></div>`;
  }
  function renderImportValidation(){
    const v=importState.validation;
    if(!v) return '<p class="muted">Validate rows after loading and mapping columns.</p>';
    return `<div class="grid importStats"><div><b>${v.total}</b><span>Total rows</span></div><div><b>${v.ready}</b><span>Ready rows</span></div><div><b>${v.blank}</b><span>Skipped blank rows</span></div><div><b>${v.errors}</b><span>Rows with errors</span></div></div>${renderImportErrorPanel()}`;
  }
  function renderImportErrorPanel(){
    const rows=importErrorRows().slice(0,80);
    if(!rows.length) return '<p class="muted">No row errors.</p>';
    return `<div class="importErrors"><h2>Error Panel</h2><div class="tableWrap"><table class="table"><thead><tr><th>Row</th><th>Project</th><th>Company / Title</th><th>Reason</th></tr></thead><tbody>${rows.map(e=>`<tr><td>${esc(e.rowNumber)}</td><td>${esc(e.project_name||'')}</td><td>${esc(e.name||'')}</td><td class="dangerText">${esc(e.error_reason)}</td></tr>`).join('')}</tbody></table></div>${importErrorRows().length>80?'<p class="muted">Showing first 80 errors.</p>':''}</div>`;
  }
  function renderImportResult(){
    const r=importState.importResult;
    if(!r) return '<p class="muted">Validated rows will be inserted or upserted into Supabase.</p>';
    return `<div class="grid importStats"><div><b>${r.inserted}</b><span>Inserted rows</span></div><div><b>${r.updated}</b><span>Updated rows</span></div><div><b>${r.skipped}</b><span>Skipped rows</span></div><div><b>${r.errors.length}</b><span>Error rows</span></div></div>${r.warnings.length?`<div class="alert">${r.warnings.map(esc).join('<br>')}</div>`:''}`;
  }
  function renderImportHistory(){
    const rows=loadImportHistory();
    if(!rows.length) return '<p class="muted">No imports yet on this device.</p>';
    return `<div class="tableWrap"><table class="table"><thead><tr><th>Date</th><th>Target</th><th>Source</th><th>Total</th><th>Imported</th><th>Errors</th></tr></thead><tbody>${rows.map(h=>`<tr><td>${esc(h.date)}</td><td>${esc(h.target)}</td><td>${esc(h.source)}</td><td>${esc(h.total)}</td><td>${esc(h.imported)}</td><td>${esc(h.errors)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function bindImportCenterActions(){
    const target=$('#importTarget'), source=$('#importSourceType'), dup=$('#importDuplicateMode'), create=$('#importCreateProjects');
    if(target) target.onchange=()=>{readImportInputs(); importState.target=target.value; importState.mappings={}; importState.validation=null; importState.readyRows=[]; importState.errorRows=[]; importState.importResult=null; autoMapColumns(); renderView()};
    if(source) source.onchange=()=>{readImportInputs(); importState.sourceType=source.value; renderView()};
    if(dup) dup.onchange=()=>{importState.duplicateMode=dup.value};
    if(create) create.onchange=()=>{importState.createMissingProjects=create.checked; importState.validation=null; importState.readyRows=[]; importState.errorRows=[]};
    const load=$('#importLoadPreview'); if(load) load.onclick=loadImportPreview;
    const auto=$('#importAutoMap'); if(auto) auto.onclick=()=>{readImportInputs(); autoMapColumns(); importState.validation=null; importState.importResult=null; renderView()};
    const validate=$('#importValidate'); if(validate) validate.onclick=()=>{readImportInputs(); validateImportRows(true)};
    const run=$('#importRun'); if(run) run.onclick=importRowsToSupabase;
    const dl=$('#importDownloadErrors'); if(dl) dl.onclick=downloadImportErrorsCSV;
    const clear=$('#importClear'); if(clear) clear.onclick=()=>{clearImportState(); renderView()};
    document.querySelectorAll('[data-import-map]').forEach(sel=>sel.onchange=()=>{importState.mappings[sel.dataset.importMap]=sel.value; importState.validation=null; importState.readyRows=[]; importState.errorRows=[]; importState.importResult=null; renderView()});
  }
  function readImportInputs(){
    const url=$('#importUrl'), text=$('#importText'), dup=$('#importDuplicateMode'), create=$('#importCreateProjects');
    if(url) importState.sourceUrl=url.value.trim();
    if(text) importState.csvText=text.value;
    if(dup) importState.duplicateMode=dup.value;
    if(create) importState.createMissingProjects=create.checked;
  }
  function clearImportState(){
    importState={target:importState.target,sourceType:'upload',sourceName:'',headers:[],rows:[],mappings:{},validation:null,readyRows:[],errorRows:[],importResult:null,warnings:[],duplicateMode:'insert',createMissingProjects:false};
  }
  async function loadImportPreview(){
    readImportInputs();
    try{
      let parsed;
      if(importState.sourceType==='upload') parsed=await handleCSVUpload($('#importFile')?.files?.[0]);
      if(importState.sourceType==='url') parsed=await loadCSVFromUrl(importState.sourceUrl);
      if(importState.sourceType==='text') parsed=parseCSVInput(importState.csvText,'Pasted CSV text');
      importState.headers=parsed.headers;
      importState.rows=parsed.rows;
      importState.sourceName=parsed.sourceName;
      importState.validation=null;
      importState.readyRows=[];
      importState.errorRows=[];
      importState.importResult=null;
      autoMapColumns();
      renderView();
    }catch(err){
      importState.warnings=[err.message||String(err)];
      renderView();
    }
  }
  function parseCSVInput(csvText,sourceName='CSV input'){
    if(!window.Papa) throw new Error('CSV parser did not load. Check your internet connection and refresh the app.');
    if(!String(csvText||'').trim()) throw new Error('No CSV data found.');
    importState.warnings=[];
    const parsed=Papa.parse(String(csvText).replace(/^\uFEFF/,''),{header:true,skipEmptyLines:false,transformHeader:h=>String(h||'').replace(/^\uFEFF/,'').trim()});
    if(parsed.errors?.length) importState.warnings=parsed.errors.slice(0,3).map(e=>`CSV warning on row ${e.row||'?'}: ${e.message}`);
    const headers=(parsed.meta.fields||[]).filter(Boolean);
    const rows=(parsed.data||[]).filter(r=>r&&typeof r==='object');
    if(!headers.length) throw new Error('No header row was found. The first row must contain column names.');
    return {headers,rows,sourceName};
  }
  async function loadCSVFromUrl(url){
    if(!url) throw new Error('Paste a Google Sheets CSV export URL first.');
    const isGoogle=/docs\.google\.com\/spreadsheets/i.test(url);
    const looksCsv=/format=csv|output=csv/i.test(url);
    if(isGoogle&&!looksCsv) importState.warnings=['This Google Sheets link does not look like a CSV export link. Use File > Share > Publish to web as CSV or the /export?format=csv&gid= link.'];
    let res;
    try{res=await fetch(url,{cache:'no-store'});}catch{
      throw new Error('Could not load the CSV URL. If the Google Sheet is private, export it as CSV, publish it as CSV, or upload the CSV manually.');
    }
    if(!res.ok) throw new Error(`CSV URL returned ${res.status}. If the Google Sheet is private, export it as CSV, publish it as CSV, or upload the CSV manually.`);
    const text=await res.text();
    if(/^\s*</.test(text)) throw new Error('The URL returned a web page instead of CSV. If the Google Sheet is private, export it as CSV, publish it as CSV, or upload the CSV manually.');
    const priorWarnings=[...importState.warnings];
    const parsed=parseCSVInput(text,url);
    importState.warnings=[...priorWarnings,...importState.warnings];
    return parsed;
  }
  async function handleCSVUpload(file){
    if(!file) throw new Error('Choose a CSV file first.');
    return parseCSVInput(await file.text(),file.name);
  }
  function autoMapColumns(){
    const used=new Set();
    const mappings={};
    const headerNorms=importState.headers.map(h=>({raw:h,norm:normalizeHeader(h)}));
    const fields=importTargets[importState.target].fields;
    fields.forEach(field=>{
      const aliases=aliasesForField(field,importState.target).map(normalizeHeader);
      let found=headerNorms.find(h=>!used.has(h.raw)&&aliases.includes(h.norm));
      if(!found) found=headerNorms.find(h=>!used.has(h.raw)&&aliases.some(a=>headerAliasLooseMatch(h.norm,a)));
      if(found){mappings[field]=found.raw; used.add(found.raw);}
    });
    importState.mappings=mappings;
    return mappings;
  }
  function headerAliasLooseMatch(header,alias){
    if(!header||!alias||header===alias) return header===alias;
    const headerTokens=header.split(' '), aliasTokens=alias.split(' ');
    if(aliasTokens.length>1) return header.includes(alias)||alias.includes(header);
    if(alias.length<3) return false;
    return headerTokens.includes(alias)&&headerTokens.length<=2;
  }
  function aliasesForField(field,targetKey){
    if(field==='title'&&targetKey==='tasks') return ['title','task','task title','punch item','item'];
    if(field==='title'&&targetKey==='rfis') return ['title','rfi title','subject'];
    if(field==='title'&&targetKey==='plans') return ['title','plan title','sheet title','drawing title'];
    return importFieldAliases[field]||[field];
  }
  function normalizeHeader(v){return String(v??'').trim().toLowerCase().replace(/[_/#-]+/g,' ').replace(/\s+/g,' ')}
  function sampleForMappedColumn(col){
    if(!col) return '';
    const row=importState.rows.find(r=>String(r[col]??'').trim());
    return row?String(row[col]??'').slice(0,80):'';
  }
  function importRequiredText(cfg,field){
    if(cfg.required.includes(field)) return 'Required';
    if((cfg.requiresOneOf||[]).some(group=>group.includes(field))) return `One of: ${cfg.requiresOneOf.find(group=>group.includes(field)).map(importFieldLabel).join(' / ')}`;
    return 'Optional';
  }
  function importFieldLabel(field){return ({project_id:'Project / Project ID',sheet_no:'Sheet #',quote_amount:'Quote Amount',email_sent_date:'Email Sent Date',follow_up_date:'Follow-up Date',site_visit_needed:'Site Visit Needed',site_visit_date:'Site Visit Date',quote_received:'Quote Received',contact_name:'Contact Name',missing_scope_items:'Missing Scope Items'}[field]||label(field))}
  function normalizeBoolean(v){
    const s=String(v??'').trim().toLowerCase();
    if(!s) return null;
    if(['yes','y','true','t','1','x','checked'].includes(s)) return true;
    if(['no','n','false','f','0','unchecked'].includes(s)) return false;
    return null;
  }
  function normalizeDate(v){
    const s=String(v??'').trim();
    if(!s) return null;
    let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if(m) return dateParts(m[1],m[2],m[3]);
    m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
    if(m){const y=Number(m[3])<100?2000+Number(m[3]):Number(m[3]); return dateParts(y,m[1],m[2]);}
    const d=new Date(s);
    if(Number.isNaN(d.getTime())) return null;
    return dateParts(d.getFullYear(),d.getMonth()+1,d.getDate());
  }
  function dateParts(y,m,d){
    const yy=String(y).padStart(4,'0'), mm=String(m).padStart(2,'0'), dd=String(d).padStart(2,'0');
    const check=new Date(`${yy}-${mm}-${dd}T00:00:00`);
    if(Number.isNaN(check.getTime())||check.getMonth()+1!==Number(mm)||check.getDate()!==Number(dd)) return null;
    return `${yy}-${mm}-${dd}`;
  }
  function normalizeAmount(v){
    const s=String(v??'').trim();
    if(!s) return null;
    const n=Number(s.replace(/[$,\s]/g,''));
    return Number.isFinite(n)?n:null;
  }
  function normalizeStatus(targetKey,v){
    const s=String(v??'').trim();
    if(!s) return importTargets[targetKey].defaults?.status||null;
    const n=normalizeHeader(s);
    const maps={
      projects:{active:'Active',planning:'Planning',permitting:'Permitting',permit:'Permitting','on hold':'On Hold',hold:'On Hold',punch:'Punch',closed:'Closed',complete:'Closed',completed:'Closed'},
      bid_tracker:{'not contacted':'Not Contacted',new:'Not Contacted','email sent':'Email Sent',sent:'Email Sent','followed up':'Followed Up','follow up':'Followed Up','site visit':'Site Visit Scheduled','site visit scheduled':'Site Visit Scheduled','quote received':'Quote Received','bid received':'Quote Received','need clarification':'Need Clarification',clarification:'Need Clarification',shortlisted:'Shortlisted',selected:'Selected',rejected:'Rejected','contract signed':'Contract Signed'},
      tasks:{open:'Open','in progress':'In Progress',progress:'In Progress','ready for review':'Ready for Review',review:'Ready for Review',done:'Done',complete:'Done',completed:'Done',blocked:'Blocked'},
      rfis:{open:'Open',answered:'Answered',closed:'Closed',complete:'Closed',completed:'Closed'}
    };
    return maps[targetKey]?.[n]||s;
  }
  function normalizeImportRow(targetKey,raw,rowNumber){
    const cfg=importTargets[targetKey], errors=[], record={};
    if(isBlankSpreadsheetRow(raw)) return {blank:true,rowNumber,raw,errors};
    cfg.fields.forEach(field=>{
      const col=importState.mappings[field];
      if(!col) return;
      const original=raw[col];
      let value=typeof original==='string'?original.trim():original;
      if(importBooleanFields.includes(field)) value=normalizeBoolean(value);
      else if(importDateFields.includes(field)){const normalized=normalizeDate(value); if(String(value??'').trim()&&!normalized) errors.push(`${importFieldLabel(field)} has an invalid date`); value=normalized;}
      else if(importAmountFields.includes(field)){const normalized=normalizeAmount(value); if(String(value??'').trim()&&normalized===null) errors.push(`${importFieldLabel(field)} must be a number`); value=normalized;}
      else if(field==='status') value=normalizeStatus(targetKey,value);
      else value=String(value??'').trim()||null;
      record[field]=value;
    });
    Object.entries(cfg.defaults||{}).forEach(([k,v])=>{if(record[k]===null||record[k]===undefined||record[k]==='') record[k]=v});
    let project_name='', projectNameToCreate='';
    if(cfg.fields.includes('project_id')){
      const lookup=record.project_id;
      project_name=String(lookup||'').trim();
      const resolved=resolveProjectId(lookup,importState.createMissingProjects);
      if(resolved.error) errors.push(resolved.error);
      else if(resolved.project_id){record.project_id=resolved.project_id; project_name=resolved.project_name;}
      else if(resolved.project_name){record.project_id=null; projectNameToCreate=resolved.project_name; project_name=resolved.project_name;}
    }
    cfg.required.forEach(field=>{
      if(field==='project_id'&&projectNameToCreate) return;
      if(record[field]===null||record[field]===undefined||record[field]==='') errors.push(`${importFieldLabel(field)} is required`);
    });
    (cfg.requiresOneOf||[]).forEach(group=>{
      if(!group.some(field=>String(record[field]??'').trim())) errors.push(`${group.map(importFieldLabel).join(' or ')} is required`);
    });
    return {blank:false,rowNumber,raw,record,errors,project_name,projectNameToCreate,name:record.company||record.title||record.name||record.sheet_no||''};
  }
  function validateImportRow(targetKey,raw,rowNumber){
    return normalizeImportRow(targetKey,raw,rowNumber);
  }
  function validateImportRows(shouldRender=true){
    const readyRows=[], errorRows=[];
    let blank=0;
    importState.rows.forEach((raw,i)=>{
      const row=validateImportRow(importState.target,raw,i+2);
      if(row.blank){blank++; return;}
      if(row.errors.length) errorRows.push({...row,error_reason:row.errors.join('; ')});
      else readyRows.push(row);
    });
    importState.readyRows=readyRows;
    importState.errorRows=errorRows;
    importState.validation={total:importState.rows.length,ready:readyRows.length,blank,errors:errorRows.length};
    importState.importResult=null;
    if(shouldRender) renderView();
    return importState.validation;
  }
  function isBlankSpreadsheetRow(row){
    return !Object.values(row||{}).some(v=>String(v??'').trim());
  }
  function resolveProjectId(value,allowCreate=false){
    const raw=String(value??'').trim();
    if(!raw) return {error:'Project is required'};
    const direct=cache.projects.find(p=>p.id===raw);
    if(direct) return {project_id:direct.id,project_name:direct.name};
    const match=cache.projects.find(p=>normalizeLoose(p.name)===normalizeLoose(raw));
    if(match) return {project_id:match.id,project_name:match.name};
    if(allowCreate) return {project_id:null,project_name:raw};
    return {error:'Project not found'};
  }
  async function createMissingProjectsIfNeeded(rows){
    const names=[...new Map(rows.filter(r=>r.projectNameToCreate).map(r=>[normalizeLoose(r.projectNameToCreate),r.projectNameToCreate])).values()];
    if(!names.length) return {created:0,error:null};
    const stillMissing=names.filter(name=>!cache.projects.some(p=>normalizeLoose(p.name)===normalizeLoose(name)));
    if(stillMissing.length){
      const {data,error}=await sb.from('projects').insert(stillMissing.map(name=>({name,status:'Active'}))).select();
      if(error) return {created:0,error};
      cache.projects=[...(data||[]),...cache.projects];
    }
    rows.forEach(r=>{
      if(!r.projectNameToCreate) return;
      const resolved=resolveProjectId(r.projectNameToCreate,false);
      if(resolved.project_id){r.record.project_id=resolved.project_id; r.project_name=resolved.project_name;}
      else r.errors.push('Project could not be created');
    });
    return {created:stillMissing.length,error:null};
  }
  function detectDuplicate(targetKey,record){
    const cfg=importTargets[targetKey], key=duplicateKey(targetKey,record);
    if(!key) return false;
    return (cache[cfg.table]||[]).some(existing=>duplicateKey(targetKey,existing)===key);
  }
  function duplicateKey(targetKey,record){
    const fields=importTargets[targetKey].duplicate||[];
    return fields.map(f=>normalizeLoose(record[f])).join('||');
  }
  function normalizeLoose(v){return String(v??'').trim().replace(/\s+/g,' ').toLowerCase()}
  async function importRowsToSupabase(){
    if(!canEdit()) return toast('Your role does not allow importing records.');
    readImportInputs();
    if(!importState.validation) validateImportRows(false);
    const cfg=importTargets[importState.target];
    const result={inserted:0,updated:0,skipped:0,errors:[],warnings:[]};
    if(!importState.readyRows.length){importState.importResult=result; renderView(); return toast('No ready rows to import.');}
    const created=await createMissingProjectsIfNeeded(importState.readyRows);
    if(created.error){
      result.warnings.push(`Could not create missing projects: ${created.error.message}`);
      importState.readyRows.filter(r=>r.projectNameToCreate).forEach(r=>{r.errors.push(created.error.message); result.errors.push(importErrorObject(r,created.error.message));});
    } else if(created.created) result.warnings.push(`Created ${created.created} missing project${created.created===1?'':'s'} before import.`);
    const rows=importState.readyRows.filter(r=>!r.errors.length).map(r=>({...r,record:cleanRecordForTable(cfg.table,r.record)}));
    if(importState.duplicateMode==='upsert'&&rows.length){
      const beforeDuplicates=rows.filter(r=>detectDuplicate(importState.target,r.record)).length;
      const {error}=await sb.from(cfg.table).upsert(rows.map(r=>r.record),{onConflict:(cfg.duplicate||[]).join(','),ignoreDuplicates:false}).select();
      if(!error){
        result.updated=beforeDuplicates;
        result.inserted=rows.length-beforeDuplicates;
        await loadAll();
        saveImportHistory({date:new Date().toLocaleString(),target:cfg.label,source:importState.sourceName||importState.sourceType,total:importState.rows.length,imported:result.inserted+result.updated,errors:importState.errorRows.length});
        importState.importResult=result;
        renderView();
        return;
      }
      result.warnings.push(`Upsert failed and the app fell back to insert: ${error.message}`);
    }
    for(const row of rows){
      if(importState.duplicateMode==='skip'&&detectDuplicate(importState.target,row.record)){result.skipped++; continue;}
      const {data,error}=await sb.from(cfg.table).insert(row.record).select().single();
      if(error){result.errors.push(importErrorObject(row,error.message)); continue;}
      result.inserted++;
      cache[cfg.table]=[data||row.record,...(cache[cfg.table]||[])];
    }
    await loadAll();
    saveImportHistory({date:new Date().toLocaleString(),target:cfg.label,source:importState.sourceName||importState.sourceType,total:importState.rows.length,imported:result.inserted+result.updated,errors:importState.errorRows.length+result.errors.length});
    importState.importResult=result;
    renderView();
  }
  function importErrorObject(row,reason){
    return {rowNumber:row.rowNumber,project_name:row.project_name||'',name:row.name||'',raw:row.raw,error_reason:reason};
  }
  function importErrorRows(){
    const validation=importState.errorRows.map(r=>({rowNumber:r.rowNumber,project_name:r.project_name||'',name:r.name||'',raw:r.raw,error_reason:r.error_reason}));
    const importing=importState.importResult?.errors||[];
    return [...validation,...importing];
  }
  function downloadImportErrorsCSV(){
    const rows=importErrorRows();
    if(!rows.length) return toast('No import errors to download.');
    const flat=rows.map(r=>({...r.raw,error_reason:r.error_reason}));
    const csv=window.Papa?Papa.unparse(flat):csvFromObjects(flat);
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
    a.download=`amin_import_errors_${importState.target}_${date()}.csv`;
    a.click();
  }
  function csvFromObjects(rows){
    const cols=[...new Set(rows.flatMap(r=>Object.keys(r)))];
    return [cols.join(','),...rows.map(r=>cols.map(c=>`"${String(r[c]??'').replaceAll('"','""')}"`).join(','))].join('\n');
  }
  function loadImportHistory(){
    try{return JSON.parse(localStorage.getItem(LS_IMPORT_HISTORY)||'[]')}catch{return []}
  }
  function saveImportHistory(entry){
    const rows=[entry,...loadImportHistory()].slice(0,20);
    localStorage.setItem(LS_IMPORT_HISTORY,JSON.stringify(rows));
  }

  function usersPage(){return `<div class="between"><div><h1>Team / Roles</h1><p class="muted">Review users and update field access roles.</p></div></div><br><div class="card" id="usersBox"><button class="btn" id="loadUsers">Load Profiles</button></div>`}
  function bindActions(){
    document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{active=b.dataset.go;renderShell()});
    document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>openForm(b.dataset.add));
    document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openForm(b.dataset.edit,cache[b.dataset.edit].find(x=>x.id===b.dataset.id)));
    document.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>delRecord(b.dataset.del,b.dataset.id));
    document.querySelectorAll('[data-pdf]').forEach(b=>b.onclick=()=>makePDF(b.dataset.pdf));
    document.querySelectorAll('[data-csv]').forEach(b=>b.onclick=()=>exportCSV(b.dataset.csv));
    document.querySelectorAll('[data-view-report]').forEach(b=>b.onclick=()=>openSiteReport(b.dataset.viewReport));
    if(active==='import_center') bindImportCenterActions();
    const bp=$('#bidFilterProject'), bt=$('#bidFilterTrade'), bs=$('#bidFilterStatus'), cb=$('#clearBidFilters');
    if(bp) bp.onchange=()=>{bidFilters.project_id=bp.value; renderView()};
    if(bt) bt.onchange=()=>{bidFilters.trade=bt.value; renderView()};
    if(bs) bs.onchange=()=>{bidFilters.status=bs.value; renderView()};
    if(cb) cb.onclick=()=>{bidFilters={project_id:'',trade:'',status:''}; renderView()};
    const clear=$('#clearSearch'); if(clear) clear.onclick=()=>{searchTerm=''; renderShell();}; const lu=$('#loadUsers'); if(lu) lu.onclick=loadUsers; const sc=$('#saveCloud'); if(sc) sc.onclick=()=>{setCfg({url:$('#cloud_url').value.trim(),anonKey:$('#cloud_key').value.trim()}); location.reload()}; const rc=$('#resetCloud'); if(rc) rc.onclick=()=>{localStorage.removeItem(LS_CFG); location.reload()};
  }
  async function loadUsers(){const {data,error}=await sb.from('profiles').select('*').order('email'); if(error)return toast(error.message); $('#usersBox').innerHTML=`<table class="table"><tr><th>Email</th><th>Name</th><th>Role</th><th>Action</th></tr>${data.map(u=>`<tr><td>${esc(u.email)}</td><td>${esc(u.full_name||'')}</td><td><select data-role-id="${u.id}">${roles.map(r=>`<option ${u.role===r?'selected':''}>${r}</option>`).join('')}</select></td><td><button class="btn" data-save-role="${u.id}">Save</button></td></tr>`).join('')}</table>`; document.querySelectorAll('[data-save-role]').forEach(b=>b.onclick=async()=>{if(!canAdmin())return toast('Admin or PM only.'); const role=document.querySelector(`[data-role-id="${b.dataset.saveRole}"]`).value; const {error}=await sb.from('profiles').update({role}).eq('id',b.dataset.saveRole); if(error)toast(error.message); else toast('Role updated.')})}
  function projectOptions(sel){return cache.projects.map(p=>`<option value="${p.id}" ${sel===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}
  function taskOptions(sel){return `<option value="">None</option>`+cache.tasks.map(t=>`<option value="${t.id}" ${sel===t.id?'selected':''}>${esc(t.title)}</option>`).join('')}
  function photoChooser(labelText){return `<div class="field" style="grid-column:1/-1"><label>${labelText}</label><div class="photoChoiceRow"><label class="btn photoChoiceBtn" for="files_library">Photo Library</label><label class="btn gold photoChoiceBtn" for="files_camera">Take Photo</label></div><input class="photoInputHidden" id="files_library" type="file" accept="image/*" multiple><input class="photoInputHidden" id="files_camera" type="file" accept="image/*" capture="environment" multiple><small class="muted">Use Photo Library for saved photos, or Take Photo to open the device camera.</small><div id="previews" class="photos" style="margin-top:12px"></div></div>`}
  function openForm(t,r={}){
    if(!canEdit())return toast('Your role does not allow editing.');
    const forms={
      projects:`${field('name','Project Name',r.name)}${field('address','Address',r.address)}${select('status','Status',['Active','Planning','Permitting','On Hold','Punch','Closed'],r.status)}`,
      site_reports:`${selectHtml('project_id','Project',projectOptions(r.project_id))}${field('report_date','Date',r.report_date||date(),'date')}${area('issues','Issues / Delays',r.issues||r.delays)}${photoChooser('Report Photos')}`,
      plans:`${selectHtml('project_id','Project',projectOptions(r.project_id))}${field('sheet_no','Sheet #',r.sheet_no)}${field('title','Title',r.title)}${field('revision','Revision',r.revision||'Rev 01')}<div class="field" style="grid-column:1/-1"><label>Plan Files</label><input id="plan_files" type="file" multiple><small class="muted">Upload PDFs, images, drawings, or any project file type.</small><div id="planPreviews" class="fileList"></div></div>`,
      tasks:`${selectHtml('project_id','Project',projectOptions(r.project_id))}${field('title','Punch Item',r.title)}${field('location','Location',r.location)}${select('status','Status',statuses,r.status)}${area('notes','Notes',r.notes)}${photoChooser('Punch Photos')}`,
      daily_logs:`${selectHtml('project_id','Project',projectOptions(r.project_id))}${field('log_date','Date',r.log_date||date(),'date')}${area('delays','Daily Notes',r.delays)}${photoChooser('Daily Log Photos')}`,
      rfis:`${selectHtml('project_id','Project',projectOptions(r.project_id))}${field('title','RFI Title',r.title)}${area('question','Question',r.question)}${area('response','Response',r.response)}${select('status','Status',['Open','Answered','Closed'],r.status)}${field('due_date','Due Date',r.due_date,'date')}`,
      subcontractors:`${field('company','Company',r.company)}${field('trade','Trade',r.trade)}${field('contact_name','Contact Name',r.contact_name)}${field('phone','Phone',r.phone)}${field('email','Email',r.email,'email')}`,
      bid_tracker:`${selectHtml('project_id','Project',projectOptions(r.project_id))}${select('trade','Trade',bidTrades,r.trade)}${field('company','Company',r.company)}${field('contact_name','Contact Name',r.contact_name)}${field('email','Email',r.email,'email')}${field('phone','Phone',r.phone)}${field('website','Website',r.website,'url')}${field('email_sent_date','Email Sent Date',r.email_sent_date,'date')}${field('follow_up_date','Follow-up Date',r.follow_up_date,'date')}${yesNo('site_visit_needed','Site Visit Needed',r.site_visit_needed)}${field('site_visit_date','Site Visit Date',r.site_visit_date,'date')}${yesNo('quote_received','Quote Received',r.quote_received)}${field('quote_amount','Quote Amount',r.quote_amount,'number')}${select('status','Status',bidStatuses,r.status||'Not Contacted')}${yesNo('turnkey','Turnkey',r.turnkey)}${yesNo('labor_included','Labor Included',r.labor_included)}${yesNo('materials_included','Materials Included',r.materials_included)}${yesNo('equipment_included','Equipment Included',r.equipment_included)}${yesNo('cleanup_included','Cleanup Included',r.cleanup_included)}${yesNo('permits_included','Permits Included',r.permits_included)}${yesNo('inspections_included','Inspections Included',r.inspections_included)}${area('missing_scope_items','Missing Scope Items',r.missing_scope_items)}${area('notes','Notes',r.notes)}`,
      photos:`${selectHtml('project_id','Project',projectOptions(r.project_id))}${field('location','Location',r.location)}${select('category','Category',['Progress','Issue','Correction','Before','After','Inspection'],r.category)}${selectHtml('task_id','Related Task',taskOptions(r.task_id))}${area('notes','Notes',r.notes)}${photoChooser('Photos')}`
    };
    document.body.insertAdjacentHTML('beforeend',`<div class="modal"><div class="modalbox"><div class="between"><h1>${r.id?'Edit':'Add'} ${label(t)}</h1><button class="btn" data-close>Close</button></div><div class="formgrid" id="form">${forms[t]}</div><br><button class="btn gold" id="save">Save</button></div></div>`);
    $('[data-close]').onclick=()=>{selectedPhotoFiles=[]; selectedPlanFiles=[]; $('.modal').remove();};
    if(['photos','site_reports','tasks','daily_logs'].includes(t)) { selectedPhotoFiles=[]; $('#files_library').onchange=addPreviewFiles; $('#files_camera').onchange=addPreviewFiles; }
    if(t==='plans') { selectedPlanFiles=[]; $('#plan_files').onchange=addPlanFiles; renderPlanFiles(r.id); }
    $('#save').onclick=()=> t==='photos'?savePhotos():t==='site_reports'?saveSiteReport(r.id):t==='tasks'?saveTask(r.id):t==='daily_logs'?saveDailyLog(r.id):t==='plans'?savePlan(r.id):saveRecord(t,r.id);
  }
  function field(n,l,v='',type='text'){return `<div class="field"><label>${l}</label><input id="f_${n}" type="${type}" value="${esc(v||'')}"></div>`}
  function area(n,l,v=''){return `<div class="field" style="grid-column:1/-1"><label>${l}</label><textarea id="f_${n}">${esc(v||'')}</textarea></div>`}
  function select(n,l,opts,v){return `<div class="field"><label>${l}</label><select id="f_${n}">${opts.map(o=>`<option ${v===o?'selected':''}>${o}</option>`).join('')}</select></div>`}
  function selectHtml(n,l,html){return `<div class="field"><label>${l}</label><select id="f_${n}">${html}</select></div>`}
  function yesNo(n,l,v){return select(n,l,['No','Yes'],v?'Yes':'No')}
  function collect(t){
    let o={};
    document.querySelectorAll('#form [id^="f_"]').forEach(el=>{
      let v=el.value;
      if(v==='') v=null;
      o[el.id.slice(2)]=v;
    });
    return cleanRecordForTable(t,o);
  }

  // v5.6 FIX:
  // Only send fields that actually exist in each Supabase table.
  // This prevents errors like:
  // "Could not find the 'task_id' column of 'plans' in the schema cache"
  const allowedColumns={
    projects:['name','address','status'],
    plans:['project_id','sheet_no','title','revision'],
    tasks:['project_id','title','location','status','notes'],
    site_reports:['project_id','report_date','issues','submitted_by','submitted_by_name','submitted_by_email'],
    daily_logs:['project_id','log_date','delays'],
    rfis:['project_id','title','question','response','status','due_date'],
    subcontractors:['company','trade','contact_name','phone','email','website','notes'],
    bid_tracker:['project_id','trade','company','contact_name','email','phone','website','email_sent_date','follow_up_date','site_visit_needed','site_visit_date','quote_received','quote_amount','turnkey','labor_included','materials_included','equipment_included','cleanup_included','permits_included','inspections_included','missing_scope_items','status','notes'],
    photos:['project_id','location','category','task_id','report_id','daily_log_id','notes']
  };

  function cleanRecordForTable(t,obj){
    const cols=allowedColumns[t]||Object.keys(obj);
    const out={};

    cols.forEach(k=>{
      if(Object.prototype.hasOwnProperty.call(obj,k)){
        let v=obj[k];
        if(v===''||v===undefined) v=null;
        out[k]=v;
      }
    });

    ['project_id','task_id','report_id','daily_log_id'].forEach(k=>{
      if(Object.prototype.hasOwnProperty.call(out,k) && (out[k]===''||out[k]===undefined)) out[k]=null;
    });

    ['due_date','log_date','report_date','email_sent_date','follow_up_date','site_visit_date'].forEach(k=>{
      if(Object.prototype.hasOwnProperty.call(out,k) && out[k]==='') out[k]=null;
    });

    if(t==='bid_tracker'){
      bidBooleanFields.forEach(k=>{
        if(Object.prototype.hasOwnProperty.call(out,k)) out[k]=out[k]===true||out[k]==='Yes'||out[k]==='true';
      });
      if(Object.prototype.hasOwnProperty.call(out,'quote_amount')){
        const amount=Number(out.quote_amount);
        out.quote_amount=out.quote_amount===null||Number.isNaN(amount)?null:amount;
      }
    }

    return out;
  }

  async function saveRecord(t,recordId){
    let obj=collect(t);
    const res=recordId? await sb.from(t).update(obj).eq('id',recordId): await sb.from(t).insert(obj);
    if(res.error)return toast(res.error.message);
    $('.modal').remove();
    await loadAll();
    renderView();
  }
  function addPreviewFiles(e){const input=e?.target||$('#files'); if(!input)return; const incoming=[...input.files]; incoming.forEach(f=>selectedPhotoFiles.push(f)); input.value=''; renderSelectedPhotoPreviews()}
  function renderSelectedPhotoPreviews(){const wrap=$('#previews'); if(!wrap)return; wrap.innerHTML=''; selectedPhotoFiles.forEach((f,i)=>{const url=URL.createObjectURL(f); wrap.insertAdjacentHTML('beforeend',`<div class="photo"><img src="${url}"><div class="pbody"><b>${esc(f.name)}</b><div class="muted">${Math.round(f.size/1024)} KB</div><br><button class="btn danger" data-remove-preview="${i}">Remove</button></div></div>`)}); document.querySelectorAll('[data-remove-preview]').forEach(b=>b.onclick=()=>{selectedPhotoFiles.splice(Number(b.dataset.removePreview),1); renderSelectedPhotoPreviews()})}
  function addPlanFiles(){const incoming=[...$('#plan_files').files]; incoming.forEach(f=>selectedPlanFiles.push(f)); $('#plan_files').value=''; renderSelectedPlanFiles()}
  function renderSelectedPlanFiles(){const wrap=$('#planPreviews'); if(!wrap)return; wrap.innerHTML=selectedPlanFiles.map((f,i)=>`<div class="fileItem"><b>${esc(f.name)}</b><span class="muted">${Math.round(f.size/1024)} KB</span><button class="btn danger" data-remove-plan-preview="${i}">Remove</button></div>`).join(''); document.querySelectorAll('[data-remove-plan-preview]').forEach(b=>b.onclick=()=>{selectedPlanFiles.splice(Number(b.dataset.removePlanPreview),1); renderSelectedPlanFiles()})}
  function renderPlanFiles(planId){const wrap=$('#planPreviews'); if(!wrap||!planId)return; const files=cache.plan_files.filter(f=>f.plan_id===planId); if(files.length) wrap.insertAdjacentHTML('afterbegin',files.map(f=>`<div class="fileItem"><a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.file_name||'Plan file')}</a><span class="muted">${Math.round((f.file_size||0)/1024)} KB</span></div>`).join(''))}
  async function uploadLinkedPhotos(parent,files,linkKey,label){for(const f of files){const safeName=f.name.replace(/[^a-z0-9_.-]/gi,'_'); const path=`${parent.project_id}/${linkKey}/${parent.id}/${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}`; const up=await sb.storage.from('jobsite-photos').upload(path,f,{upsert:false,contentType:f.type||'image/jpeg'}); if(up.error)return up; const signed=await sb.storage.from('jobsite-photos').createSignedUrl(path, 60*60*24*365); if(signed.error)return signed; const photoRecord={project_id:parent.project_id,[linkKey]:parent.id,location:label,category:'Progress',notes:parent.notes||parent.delays||parent.work_completed||'',url:signed.data?.signedUrl||'',storage_path:path,file_name:f.name,file_size:f.size,mime_type:f.type||'image/jpeg',uploaded_by:user?.id||null}; const ins=await sb.from('photos').insert(photoRecord); if(ins.error)return ins;} return {error:null}}
  async function saveTask(recordId){let obj=collect('tasks'); if(!obj.project_id)return toast('Choose a project before saving the punch item.'); const res=recordId? await sb.from('tasks').update(obj).eq('id',recordId).select().single(): await sb.from('tasks').insert(obj).select().single(); if(res.error)return toast(res.error.message); const files=[...selectedPhotoFiles]; if(files.length){const up=await uploadLinkedPhotos(res.data,files,'task_id','Punch List'); if(up.error)return toast(up.error.message);} selectedPhotoFiles=[]; $('.modal').remove(); await loadAll(); renderView()}
  async function saveDailyLog(recordId){let obj=collect('daily_logs'); if(!obj.project_id)return toast('Choose a project before saving the daily log.'); const res=recordId? await sb.from('daily_logs').update(obj).eq('id',recordId).select().single(): await sb.from('daily_logs').insert(obj).select().single(); if(res.error)return toast(res.error.message); const files=[...selectedPhotoFiles]; if(files.length){const up=await uploadLinkedPhotos(res.data,files,'daily_log_id','Daily Log'); if(up.error)return toast(up.error.message);} selectedPhotoFiles=[]; $('.modal').remove(); await loadAll(); renderView()}
  async function savePlan(recordId){let obj=collect('plans'); if(!obj.project_id)return toast('Choose a project before saving the plan.'); const res=recordId? await sb.from('plans').update(obj).eq('id',recordId).select().single(): await sb.from('plans').insert(obj).select().single(); if(res.error)return toast(res.error.message); const files=[...selectedPlanFiles]; for(const f of files){const safeName=f.name.replace(/[^a-z0-9_.-]/gi,'_'); const path=`${res.data.project_id}/plans/${res.data.id}/${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}`; const up=await sb.storage.from('jobsite-photos').upload(path,f,{upsert:false,contentType:f.type||'application/octet-stream'}); if(up.error)return toast(up.error.message); const signed=await sb.storage.from('jobsite-photos').createSignedUrl(path, 60*60*24*365); if(signed.error)return toast(signed.error.message); const ins=await sb.from('plan_files').insert({plan_id:res.data.id,project_id:res.data.project_id,url:signed.data?.signedUrl||'',storage_path:path,file_name:f.name,file_size:f.size,mime_type:f.type||'application/octet-stream',uploaded_by:user?.id||null}); if(ins.error)return toast(ins.error.message);} selectedPlanFiles=[]; $('.modal').remove(); await loadAll(); renderView()}
  async function uploadReportPhotos(report,files){for(const f of files){const safeName=f.name.replace(/[^a-z0-9_.-]/gi,'_'); const path=`${report.project_id}/report_id/${report.id}/${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}`; const up=await sb.storage.from('jobsite-photos').upload(path,f,{upsert:false,contentType:f.type||'image/jpeg'}); if(up.error)return up; const signed=await sb.storage.from('jobsite-photos').createSignedUrl(path, 60*60*24*365); if(signed.error)return signed; const photoRecord={project_id:report.project_id,report_id:report.id,location:'Site Report',category:'Progress',notes:report.issues||'',url:signed.data?.signedUrl||'',storage_path:path,file_name:f.name,file_size:f.size,mime_type:f.type||'image/jpeg',uploaded_by:user?.id||null}; const ins=await sb.from('photos').insert(photoRecord); if(ins.error)return ins;} return {error:null}}
  async function saveSiteReport(recordId){let obj=collect('site_reports'); if(!obj.project_id)return toast('Choose a project before saving the site report.'); obj.submitted_by=user?.id||null; obj.submitted_by_name=profile?.full_name||profile?.email||null; obj.submitted_by_email=profile?.email||user?.email||null; const res=recordId? await sb.from('site_reports').update(obj).eq('id',recordId).select().single(): await sb.from('site_reports').insert(obj).select().single(); if(res.error)return toast(res.error.message); const files=[...selectedPhotoFiles]; if(files.length){const up=await uploadReportPhotos(res.data,files); if(up.error)return toast(up.error.message);} selectedPhotoFiles=[]; $('.modal').remove(); await loadAll(); renderView()}
  async function savePhotos(){const files=[...selectedPhotoFiles]; if(!files.length)return toast('Choose at least one photo.'); const meta=collect('photos'); if(!meta.project_id)return toast('Choose a project before saving photos.'); for(const f of files){const safeName=f.name.replace(/[^a-z0-9_.-]/gi,'_'); const path=`${meta.project_id}/${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}`; const up=await sb.storage.from('jobsite-photos').upload(path,f,{upsert:false,contentType:f.type||'image/jpeg'}); if(up.error)return toast(up.error.message); const signed=await sb.storage.from('jobsite-photos').createSignedUrl(path, 60*60*24*365); if(signed.error)return toast(signed.error.message); const photoUrl=signed.data?.signedUrl||''; const photoRecord={...meta,url:photoUrl,storage_path:path,file_name:f.name,file_size:f.size,mime_type:f.type||'image/jpeg',uploaded_by:user?.id||null}; const ins=await sb.from('photos').insert(photoRecord); if(ins.error)return toast(ins.error.message); } selectedPhotoFiles=[]; $('.modal').remove(); await loadAll(); renderView()}
  async function delRecord(t,recordId){if(!canEdit())return toast('Your role does not allow deleting.'); if(!confirm('Delete this item? This cannot be undone.'))return; if(t==='projects'){await Promise.all(['plan_files','site_reports','plans','tasks','photos','daily_logs','rfis','bid_tracker'].map(x=>sb.from(x).delete().eq('project_id',recordId)))} if(t==='plans'){const files=cache.plan_files.filter(x=>x.plan_id===recordId); const paths=files.map(f=>f.storage_path).filter(Boolean); if(paths.length) await sb.storage.from('jobsite-photos').remove(paths); await sb.from('plan_files').delete().eq('plan_id',recordId);} if(t==='tasks'){const photos=cache.photos.filter(x=>x.task_id===recordId); const paths=photos.map(p=>p.storage_path).filter(Boolean); if(paths.length) await sb.storage.from('jobsite-photos').remove(paths); await sb.from('photos').delete().eq('task_id',recordId);} if(t==='daily_logs'){const photos=cache.photos.filter(x=>x.daily_log_id===recordId); const paths=photos.map(p=>p.storage_path).filter(Boolean); if(paths.length) await sb.storage.from('jobsite-photos').remove(paths); await sb.from('photos').delete().eq('daily_log_id',recordId);} if(t==='site_reports'){const photos=cache.photos.filter(x=>x.report_id===recordId); const paths=photos.map(p=>p.storage_path).filter(Boolean); if(paths.length) await sb.storage.from('jobsite-photos').remove(paths); await sb.from('photos').delete().eq('report_id',recordId);} if(t==='photos'){const p=cache.photos.find(x=>x.id===recordId); if(p?.storage_path) await sb.storage.from('jobsite-photos').remove([p.storage_path]);} const {error}=await sb.from(t).delete().eq('id',recordId); if(error)return toast(error.message); await loadAll(); renderView()}
  function relatedPhotosFor(t,r){
    if(t==='site_reports') return cache.photos.filter(p=>p.report_id===r.id);
    if(t==='tasks') return cache.photos.filter(p=>p.task_id===r.id);
    if(t==='daily_logs') return cache.photos.filter(p=>p.daily_log_id===r.id);
    if(t==='projects') return cache.photos.filter(p=>p.project_id===r.id);
    return [];
  }
  function spreadsheetLink(url,label){
    if(!url) return '';
    return `=HYPERLINK("${String(url).replaceAll('"','""')}","${String(label).replaceAll('"','""')}")`;
  }
  function csvRowsFor(t){
    return (cache[t]||[]).map(r=>{
      const out={...r};
      if(r.project_id) out.project_name=projectName(r.project_id);
      if(t==='photos'){
        out.project_name=projectName(r.project_id);
        delete out.url;
        out.photo_link=spreadsheetLink(r.url,'Open Photo');
        out.related_record=r.report_id?'Site Report':r.daily_log_id?'Daily Log':r.task_id?'Punch List':'Photo Library';
      }
      const photos=relatedPhotosFor(t,r);
      if(photos.length){
        out.photo_count=photos.length;
        out.photo_file_names=photos.map(p=>p.file_name).filter(Boolean).join(' | ');
        photos.forEach((p,i)=>{out[`Photo ${i+1}`]=spreadsheetLink(p.url,`Open Photo ${i+1}`)});
      }
      if(t==='plans'){
        const files=cache.plan_files.filter(f=>f.plan_id===r.id);
        out.file_count=files.length;
        out.file_names=files.map(f=>f.file_name).filter(Boolean).join(' | ');
        files.forEach((f,i)=>{out[`File ${i+1}`]=spreadsheetLink(f.url,`Open File ${i+1}`)});
      }
      return out;
    });
  }
  function exportCSV(t){
    const rows=csvRowsFor(t);
    if(!rows.length)return toast('No data.');
    const cols=[...new Set(rows.flatMap(r=>Object.keys(r)))];
    const csv=[cols.join(','),...rows.map(r=>cols.map(c=>`"${String(r[c]??'').replaceAll('"','""')}"`).join(','))].join('\n');
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
    a.download=`amin_ventures_${t}.csv`;
    a.click();
  }
  async function makePDF(type){
    const {jsPDF}=window.jspdf;
    const doc=new jsPDF({unit:'pt',format:'letter',compress:false});
    const W=612,H=792,M=42,HEADER=104;
    const title=type==='site_reports'?'Site Report Package':type==='daily'?'Daily Field Report':type==='tasks'?'Punch List Report':'Photo Report';
    let y=HEADER+32;
    const logo=await imageToDataUrl('assets/amin-logo-full.png','PNG').catch(()=>null);
    const generated=new Date().toLocaleString();
    const pageCount=()=>doc.internal.getNumberOfPages();
    const addHeader=()=>{
      doc.setFillColor(7,7,7);
      doc.rect(0,0,W,HEADER,'F');
      doc.setTextColor(201,152,58);
      doc.setFont('helvetica','bold');
      doc.setFontSize(10);
      doc.text('AMIN VENTURES',M,28);
      doc.setTextColor(255,255,255);
      doc.setFontSize(22);
      doc.text(title,M,58);
      doc.setFont('helvetica','normal');
      doc.setFontSize(9);
      doc.setTextColor(190,184,174);
      doc.text(`Generated: ${generated}`,M,80);
      if(logo){
        const box=fitToBox(logo.w,logo.h,132,82);
        doc.addImage(logo.data,logo.format,W-M-box.w,11,box.w,box.h,undefined,'NONE');
      }
    };
    const addFooter=()=>{
      const page=pageCount();
      doc.setFont('helvetica','normal');
      doc.setFontSize(8);
      doc.setTextColor(125,125,125);
      doc.text(`Page ${page}`,W-M,H-24,{align:'right'});
    };
    const newPage=()=>{addFooter(); doc.addPage(); addHeader(); y=HEADER+32;};
    const ensure=(height)=>{if(y+height>H-48)newPage();};
    const text=(txt,size=10,color=[35,35,35],style='normal',width=W-M*2)=>{
      doc.setFont('helvetica',style);
      doc.setFontSize(size);
      doc.setTextColor(...color);
      const parts=doc.splitTextToSize(String(txt||''),width);
      doc.text(parts,M,y);
      y+=parts.length*(size+4)+5;
    };
    const rule=()=>{doc.setDrawColor(218,218,218);doc.line(M,y,W-M,y);y+=16;};
    const section=(heading)=>{ensure(42); doc.setFont('helvetica','bold');doc.setFontSize(13);doc.setTextColor(20,20,20);doc.text(heading,M,y);y+=18; rule();};
    const field=(label,value)=>{
      if(value===null||value===undefined||value==='') return;
      ensure(34);
      doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(120,92,34);doc.text(label.toUpperCase(),M,y);
      y+=13;
      text(value,10,[32,32,32],'normal');
    };
    const addPhoto=async(photo,caption='')=>{
      try{
        const img=await imageToDataUrl(photo.url,'JPEG');
        const isPortrait=img.h>=img.w;
        const maxW=isPortrait?330:W-M*2;
        const maxH=isPortrait?540:380;
        const dims=fitToBox(img.w,img.h,maxW,maxH);
        const blockH=dims.h+(caption?44:24);
        if(y+blockH>H-50)newPage();
        if(caption){
          doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(20,20,20);
          const c=doc.splitTextToSize(caption,W-M*2);
          doc.text(c,M,y);
          y+=c.length*13+8;
        }
        const x=M+((W-M*2)-dims.w)/2;
        doc.addImage(img.data,'JPEG',x,y,dims.w,dims.h,undefined,'NONE');
        y+=dims.h+20;
      }catch{
        field('Photo', 'Photo could not be embedded due to storage or browser CORS settings.');
      }
    };

    addHeader();
    section(title);

    if(type==='site_reports'){
      for(const r of cache.site_reports){
        section(`${projectName(r.project_id)} - ${r.report_date||''}`);
        field('Submitted By', reportSubmitter(r));
        field('Issues / Delays', r.issues);
        const photos=reportPhotos(r.id);
        if(photos.length){
          section('Attached Photos');
          for(const p of photos) await addPhoto(p,`${p.category||'Progress'} - ${p.location||'Site Report'}`);
        }
      }
    }
    if(type==='tasks'){
      for(const t of cache.tasks){
        section(t.title||'Punch Item');
        field('Project', projectName(t.project_id));
        field('Location', t.location);
        field('Status', t.status);
        field('Notes', t.notes);
        const photos=cache.photos.filter(p=>p.task_id===t.id);
        for(const p of photos) await addPhoto(p,`${p.category||'Progress'} - ${p.location||'Punch List'}`);
      }
    }
    if(type==='daily'){
      for(const l of cache.daily_logs){
        section(`${projectName(l.project_id)} - ${l.log_date||''}`);
        field('Daily Notes', l.delays);
        const photos=cache.photos.filter(p=>p.daily_log_id===l.id);
        for(const p of photos) await addPhoto(p,`${p.category||'Progress'} - ${p.location||'Daily Log'}`);
      }
    }
    if(type==='photos'){
      for(const p of cache.photos){
        section(`${projectName(p.project_id)} - ${p.location||'Field Photo'}`);
        field('Category', p.category||'Progress');
        field('Date', p.created_at?new Date(p.created_at).toLocaleString():'');
        field('Notes', p.notes);
        await addPhoto(p,`${p.category||'Progress'} - ${p.location||projectName(p.project_id)}`);
      }
    }
    addFooter();
    doc.save(`Amin_Ventures_${title.replaceAll(' ','_')}.pdf`);
  }
  function fitToBox(srcW,srcH,maxW,maxH){
    const w=Number(srcW)||maxW, h=Number(srcH)||maxH;
    const scale=Math.min(maxW/w,maxH/h,1);
    return {w:w*scale,h:h*scale};
  }
  function imageToDataUrl(url,format='JPEG'){
    return new Promise((resolve,reject)=>{
      const img=new Image();
      img.crossOrigin='anonymous';
      img.onload=()=>{
        const c=document.createElement('canvas');
        const w=img.naturalWidth||img.width;
        const h=img.naturalHeight||img.height;
        c.width=w;c.height=h;
        const ctx=c.getContext('2d');
        ctx.imageSmoothingEnabled=true;
        ctx.imageSmoothingQuality='high';
        ctx.drawImage(img,0,0,w,h);
        const isPng=format==='PNG'||/\.png($|\?)/i.test(url);
        resolve({data:c.toDataURL(isPng?'image/png':'image/jpeg',.98),w,h,format:isPng?'PNG':'JPEG'});
      };
      img.onerror=reject;
      img.src=url;
    });
  }
  return {start};
})();
window.addEventListener('load',App.start);
