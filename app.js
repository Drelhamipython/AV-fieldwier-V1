const App = (() => {
  const LS_CFG='av_supabase_config_v51';
  let sb=null, user=null, profile=null, active='dashboard', searchTerm='', selectedPhotoFiles=[], cache={projects:[],site_reports:[],plans:[],tasks:[],photos:[],daily_logs:[],rfis:[],subcontractors:[]};
  const statuses=['Open','In Progress','Ready for Review','Done','Blocked'];
  const priorities=['Low','Medium','High','Critical'];
  const roles=['admin','project_manager','superintendent','subcontractor','client'];
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
    document.body.innerHTML=`<div class="app"><aside class="sidebar" id="side"><div class="logo"><img class="brandLogo" src="assets/amin-logo-full.png" alt="Amin Ventures full logo"></div><nav class="nav">${navBtn('dashboard','⌂','Dashboard')}${navBtn('projects','▣','Projects')}${navBtn('site_reports','◷','Site Reports')}${navBtn('plans','▤','Plans')}${navBtn('tasks','☑','Punch List')}${navBtn('photos','▧','Photos')}${navBtn('daily_logs','◷','Daily Logs')}${navBtn('rfis','?','RFIs')}${navBtn('subcontractors','♟','Subcontractors')}${navBtn('reports','▥','Reports')}${navBtn('users','◉','Team / Roles')}</nav><div class="userbox"><b>${esc(profile.full_name||profile.email)}</b><br>${esc(profile.role)}<br><span class="muted">${esc(profile.email)}</span><br><br><div class="muted" style="margin-top:10px">AV Field v5.19 - Connected</div><button class="btn ghost" id="signout">Sign out</button></div></aside><main class="main"><header class="topbar"><button class="btn mobileMenu" id="menu">☰</button><input class="search" id="search" value="${esc(searchTerm)}" placeholder="Search projects, tasks, plans..."><div class="top-actions"><button class="btn" id="sync">Sync</button><button class="btn gold" id="quickTask">Site Report</button></div></header><section class="content" id="view"></section></main></div>`;
    $('#signout').onclick=async()=>{await sb.auth.signOut();location.reload()}; $('#sync').onclick=async()=>{await loadAll(); renderView();}; $('#quickTask').onclick=()=>openForm('site_reports'); $('#menu').onclick=()=>$('#side').classList.toggle('open'); $('#search').oninput=e=>{searchTerm=e.target.value.trim(); renderView();}; document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>{active=b.dataset.nav;searchTerm='';renderShell()}); renderView();
  }
  function navBtn(k,i,l){return `<button data-nav="${k}" class="${active===k?'active':''}">${l}</button>`}
  function renderView(){
    const v=$('#view'); if(!v)return; document.querySelectorAll('[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===active));
    if(searchTerm) v.innerHTML=searchPage();
    else if(active==='dashboard') v.innerHTML=dashboard();
    else if(active==='reports') v.innerHTML=reports();
    else if(active==='users') v.innerHTML=usersPage();
    else if(active==='cloud') v.innerHTML=cloudSetupPage();
    else v.innerHTML=listPage(active);
    bindActions();
  }
  function dashboard(){
    const open=cache.tasks.filter(t=>t.status!=='Done').length, critical=cache.tasks.filter(t=>t.priority==='Critical'&&t.status!=='Done').length;
    return `<div class="between"><div><h1>Field Dashboard</h1><p class="muted">Projects, punch items, field photos, daily logs, and reports in one place.</p></div><button class="btn gold no-print heroAction" data-add="site_reports">Site Report</button></div><div class="grid stats"><div class="card stat"><div class="label">Active Projects</div><div class="value">${cache.projects.length}</div><div class="sub">Current jobs</div></div><div class="card stat"><div class="label">Open Tasks</div><div class="value">${open}</div><div class="sub">Assigned work</div></div><div class="card stat"><div class="label">Critical Items</div><div class="value">${critical}</div><div class="sub">Needs attention</div></div><div class="card stat"><div class="label">Site Reports</div><div class="value">${cache.site_reports.length}</div><div class="sub">Submitted reports</div></div></div><div class="grid dashboardGrid">${recentProjects()}${recentTasks()}</div><br><div class="grid dashboardGrid">${recentSiteReports()}${recentPhotos()}</div>`;
  }
  const projectName=id=>cache.projects.find(p=>p.id===id)?.name||'—';
  function recentProjects(){return `<div class="card"><div class="between"><h2>Project Progress</h2></div>${cache.projects.slice(0,5).map(p=>`<div class="between" style="border-top:1px solid rgba(255,255,255,.07);padding:12px 0"><div><b>${esc(p.name)}</b><div class="muted">${esc(p.address||'')}</div></div><span class="pill green">${esc(p.status||'Active')}</span></div>`).join('')||'<p class="muted">No projects yet.</p>'}</div>`}
  function recentTasks(){return `<div class="card"><div class="between"><h2>Critical / Open Tasks</h2></div>${cache.tasks.slice(0,6).map(t=>`<div class="between" style="border-top:1px solid rgba(255,255,255,.07);padding:12px 0"><div><b>${esc(t.title)}</b><div class="muted">${esc(projectName(t.project_id))} - ${esc(t.location||'')}</div></div><span class="pill ${t.priority==='Critical'?'red':t.priority==='High'?'yellow':''}">${esc(t.priority||'Medium')}</span></div>`).join('')||'<p class="muted">No tasks yet.</p>'}</div>`}
  function recentSiteReports(){return `<div class="card"><div class="between"><h2>Recent Site Reports</h2></div>${cache.site_reports.slice(0,5).map(r=>siteReportRow(r)).join('')||'<p class="muted">No site reports yet.</p>'}</div>`}
  function recentPhotos(){return `<div class="card"><div class="between"><h2>Recent Photos</h2></div><div class="photos">${cache.photos.slice(0,6).map(p=>photoCard(p,false)).join('')||'<p class="muted">No photos yet.</p>'}</div></div>`}
  function recentLogs(){return `<div class="card"><div class="between"><h2>Daily Logs</h2></div>${cache.daily_logs.slice(0,5).map(l=>`<div style="border-top:1px solid rgba(255,255,255,.07);padding:12px 0"><b>${esc(projectName(l.project_id))}</b><div class="muted">${esc(l.log_date)} - ${esc(l.weather||'')} - ${esc(l.manpower||0)} workers</div><div>${esc(l.work_completed||'')}</div></div>`).join('')||'<p class="muted">No logs yet.</p>'}</div>`}
  function filteredRows(t){
    const rows=cache[t]||[];
    const q=searchTerm.toLowerCase();
    if(!q) return rows;
    return rows.filter(r=>[...Object.values(r), projectName(r.project_id)].some(v=>String(v??'').toLowerCase().includes(q)));
  }
  function searchPage(){
    const tables=['projects','site_reports','tasks','plans','photos','daily_logs','rfis','subcontractors'];
    const counts=tables.map(t=>[t,filteredRows(t).length]).filter(([,n])=>n);
    return `<div class="between"><div><h1>Search Results</h1><p class="muted">Showing matches for "${esc(searchTerm)}".</p></div><button class="btn ghost" id="clearSearch">Clear</button></div><br><div class="grid searchGrid">${counts.map(([t,n])=>`<button class="card searchHit" data-go="${t}"><b>${esc(label(t))}</b><span>${n}</span></button>`).join('')||'<div class="card muted">No matching records.</div>'}</div><br>${counts[0]?`<div class="card">${tableFor(counts[0][0])}</div>`:''}`;
  }
  function listPage(t){
    const titles={projects:'Projects',site_reports:'Site Reports',plans:'Plans / Sheets',tasks:'Punch List',photos:'Photos',daily_logs:'Daily Logs',rfis:'RFIs',subcontractors:'Subcontractors'};
    return `<div class="between"><div><h1>${titles[t]}</h1><p class="muted">Create, edit, delete, and keep field records current.</p></div>${canEdit()?`<button class="btn gold no-print" data-add="${t}">+ Add</button>`:''}</div><br><div class="card">${tableFor(t)}</div>`;
  }
  function tableFor(t){
    if(t==='site_reports') return siteReportsCards();
    if(t==='photos') return `<div class="photos">${filteredRows('photos').map(p=>photoCard(p,true)).join('')||'<p class="muted">No photos.</p>'}</div>`;
    const rows=filteredRows(t); const cols={projects:['name','address','status'],plans:['sheet_no','title','revision','project_id'],tasks:['title','project_id','location','priority','status','due_date'],daily_logs:['log_date','project_id','weather','manpower','work_completed'],rfis:['title','project_id','status','due_date'],subcontractors:['company','trade','contact_name','phone','email']}[t];
    return `<table class="table"><thead><tr>${cols.map(c=>`<th>${label(c)}</th>`).join('')}<th class="no-print">Actions</th></tr></thead><tbody>${rows.map(r=>`<tr>${cols.map(c=>`<td>${c==='project_id'?esc(projectName(r[c])):esc(r[c])}</td>`).join('')}<td class="no-print"><button class="btn" data-edit="${t}" data-id="${r.id}">Edit</button> ${canEdit()?`<button class="btn danger" data-del="${t}" data-id="${r.id}">Delete</button>`:''}</td></tr>`).join('')||`<tr><td colspan="${cols.length+1}" class="muted">No records yet.</td></tr>`}</tbody></table>`;
  }
  function label(c){return ({site_reports:'Site Reports',project_id:'Project',report_date:'Date',sheet_no:'Sheet #',due_date:'Due Date',log_date:'Date',contact_name:'Contact',work_completed:'Work Completed',safety_notes:'Safety Notes'}[c]||c).replaceAll('_',' ').replace(/^./,m=>m.toUpperCase())}
  function reportPhotos(reportId){return cache.photos.filter(p=>p.report_id===reportId)}
  function reportSubmitter(r){return r.submitted_by_name||r.submitted_by_email||'Field team'}
  function siteReportRow(r){
    const photos=reportPhotos(r.id).length;
    return `<div class="reportLine"><div><b>${esc(projectName(r.project_id))}</b><div class="muted">${esc(r.report_date||'')} - ${esc(reportSubmitter(r))} - ${photos} photo${photos===1?'':'s'}</div><div>${esc(r.work_completed||'')}</div></div><button class="btn" data-view-report="${r.id}">Open</button></div>`;
  }
  function siteReportsCards(){
    const rows=filteredRows('site_reports');
    return `<div class="reportCards">${rows.map(r=>{const photos=reportPhotos(r.id);return `<div class="reportCard"><div class="between"><div><h2>${esc(projectName(r.project_id))}</h2><p class="muted">${esc(r.report_date||'')} - ${esc(reportSubmitter(r))}</p></div><span class="pill green">${photos.length} photo${photos.length===1?'':'s'}</span></div><div class="reportSummary"><b>Work completed</b><p>${esc(r.work_completed||'No work summary entered.')}</p><b>Issues / Delays</b><p>${esc(r.issues||r.delays||'None reported.')}</p><b>Safety Notes</b><p>${esc(r.safety_notes||'None reported.')}</p></div><div class="reportThumbs">${photos.slice(0,4).map(p=>`<img src="${esc(p.url)}" alt="${esc(p.location||'Report photo')}">`).join('')}</div><div class="row no-print"><button class="btn" data-view-report="${r.id}">Open</button><button class="btn" data-edit="site_reports" data-id="${r.id}">Edit</button>${canEdit()?`<button class="btn danger" data-del="site_reports" data-id="${r.id}">Delete</button>`:''}</div></div>`}).join('')||'<p class="muted">No site reports yet.</p>'}</div>`;
  }
  function openSiteReport(id){
    const r=cache.site_reports.find(x=>x.id===id);
    if(!r)return;
    const photos=reportPhotos(id);
    document.body.insertAdjacentHTML('beforeend',`<div class="modal"><div class="modalbox"><div class="between"><div><h1>Site Report</h1><p class="muted">${esc(projectName(r.project_id))} - ${esc(r.report_date||'')} - ${esc(reportSubmitter(r))}</p></div><button class="btn" data-close>Close</button></div><div class="reportDetail"><div class="card"><h2>Field Notes</h2><p><b>Weather:</b> ${esc(r.weather||'')}</p><p><b>Manpower:</b> ${esc(r.manpower||0)}</p><p><b>Work completed:</b><br>${esc(r.work_completed||'')}</p><p><b>Issues / Delays:</b><br>${esc(r.issues||r.delays||'')}</p><p><b>Safety Notes:</b><br>${esc(r.safety_notes||'')}</p></div><div class="card"><h2>Photos</h2><div class="photos">${photos.map(p=>photoCard(p,false)).join('')||'<p class="muted">No photos attached.</p>'}</div></div></div></div></div>`);
    $('[data-close]').onclick=()=>$('.modal').remove();
  }
  function photoCard(p,actions){const title=p.location||p.notes||`${p.category||'Progress'} Photo`; return `<div class="photo"><img src="${esc(p.url)}" alt="${esc(title)}"><div class="pbody"><b>${esc(title)}</b><div class="muted">${esc(projectName(p.project_id))}<br>${esc(p.category||'Progress')} - ${esc(new Date(p.created_at).toLocaleString())}</div>${actions&&canEdit()?`<br><button class="btn danger" data-del="photos" data-id="${p.id}">Delete</button>`:''}</div></div>`}
  function reports(){return `<div class="between"><div><h1>Reports</h1><p class="muted">Direct PDF creator. Does not rely on browser print layout. US Letter size built into the PDF.</p></div></div><br><div class="grid reportGrid"><div class="card"><h2>Site Report Package</h2><p class="muted">Submitted report notes with attached field photos.</p><button class="btn gold" data-pdf="site_reports">Download Exact PDF</button></div><div class="card"><h2>Daily Field Report</h2><p class="muted">Logs, manpower, weather, completed work.</p><button class="btn gold" data-pdf="daily">Download Exact PDF</button></div><div class="card"><h2>Punch List Report</h2><p class="muted">Open tasks, priorities, due dates, assignees.</p><button class="btn gold" data-pdf="tasks">Download Exact PDF</button></div><div class="card"><h2>Photo Report</h2><p class="muted">Cloud photos with project, location, category, and notes.</p><button class="btn gold" data-pdf="photos">Download Exact PDF</button></div></div><br><div class="card"><h2>Export Data</h2><button class="btn" data-csv="site_reports">Export Site Reports CSV</button> <button class="btn" data-csv="tasks">Export Tasks CSV</button> <button class="btn" data-csv="photos">Export Photos CSV</button> <button class="btn" data-csv="daily_logs">Export Daily Logs CSV</button></div>`}

  function cloudSetupPage(){
    const c=cfg()||{};
    return `<div class="between"><div><h1>Cloud Setup</h1><p class="muted">Supabase is pre-configured for Amin Ventures. You can update or verify the connection here if needed.</p></div></div><br><div class="card"><div class="alert"><b>Status:</b> AV Field v5.19 package. Photos use Supabase Storage bucket <b>jobsite-photos</b>. Data uses Supabase database tables.</div><br><div class="field"><label>Supabase Project URL</label><input id="cloud_url" value="${esc(c.url||'')}" placeholder="https://xxxx.supabase.co"></div><br><div class="field"><label>Supabase Publishable / anon public key</label><textarea id="cloud_key" placeholder="sb_publishable_... or eyJ...">${esc(c.anonKey||'')}</textarea></div><br><button class="btn gold" id="saveCloud">Save Cloud Settings</button> <button class="btn ghost" id="resetCloud">Reset Cloud Settings</button><br><br><p class="muted">After saving, the app refreshes and reconnects to Supabase. Do not use the secret/service_role key.</p></div>`
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
    const clear=$('#clearSearch'); if(clear) clear.onclick=()=>{searchTerm=''; renderShell();}; const lu=$('#loadUsers'); if(lu) lu.onclick=loadUsers; const sc=$('#saveCloud'); if(sc) sc.onclick=()=>{setCfg({url:$('#cloud_url').value.trim(),anonKey:$('#cloud_key').value.trim()}); location.reload()}; const rc=$('#resetCloud'); if(rc) rc.onclick=()=>{localStorage.removeItem(LS_CFG); location.reload()};
  }
  async function loadUsers(){const {data,error}=await sb.from('profiles').select('*').order('email'); if(error)return toast(error.message); $('#usersBox').innerHTML=`<table class="table"><tr><th>Email</th><th>Name</th><th>Role</th><th>Action</th></tr>${data.map(u=>`<tr><td>${esc(u.email)}</td><td>${esc(u.full_name||'')}</td><td><select data-role-id="${u.id}">${roles.map(r=>`<option ${u.role===r?'selected':''}>${r}</option>`).join('')}</select></td><td><button class="btn" data-save-role="${u.id}">Save</button></td></tr>`).join('')}</table>`; document.querySelectorAll('[data-save-role]').forEach(b=>b.onclick=async()=>{if(!canAdmin())return toast('Admin or PM only.'); const role=document.querySelector(`[data-role-id="${b.dataset.saveRole}"]`).value; const {error}=await sb.from('profiles').update({role}).eq('id',b.dataset.saveRole); if(error)toast(error.message); else toast('Role updated.')})}
  function projectOptions(sel){return cache.projects.map(p=>`<option value="${p.id}" ${sel===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}
  function taskOptions(sel){return `<option value="">None</option>`+cache.tasks.map(t=>`<option value="${t.id}" ${sel===t.id?'selected':''}>${esc(t.title)}</option>`).join('')}
  function openForm(t,r={}){
    if(!canEdit())return toast('Your role does not allow editing.');
    const forms={
      projects:`${field('name','Project Name',r.name)}${field('address','Address',r.address)}${select('status','Status',['Active','Planning','On Hold','Punch','Closed'],r.status)}`,
      site_reports:`${selectHtml('project_id','Project',projectOptions(r.project_id))}${field('report_date','Date',r.report_date||date(),'date')}${field('weather','Weather',r.weather)}${field('manpower','Manpower',r.manpower,'number')}${area('work_completed','Work Completed',r.work_completed)}${area('issues','Issues / Delays',r.issues||r.delays)}${area('safety_notes','Safety Notes',r.safety_notes)}<div class="field"><label>Report Photos</label><input id="files" type="file" accept="image/*" multiple><small class="muted">Attach the superintendent's site photos to this report.</small><div id="previews" class="photos" style="margin-top:12px"></div></div>`,
      plans:`${selectHtml('project_id','Project',projectOptions(r.project_id))}${field('sheet_no','Sheet #',r.sheet_no)}${field('title','Title',r.title)}${field('revision','Revision',r.revision||'Rev 01')}`,
      tasks:`${selectHtml('project_id','Project',projectOptions(r.project_id))}${field('title','Task Title',r.title)}${field('location','Location',r.location)}${select('priority','Priority',priorities,r.priority)}${select('status','Status',statuses,r.status)}${field('due_date','Due Date',r.due_date,'date')}${field('assignee','Assignee',r.assignee)}${area('notes','Notes',r.notes)}`,
      daily_logs:`${selectHtml('project_id','Project',projectOptions(r.project_id))}${field('log_date','Date',r.log_date||date(),'date')}${field('weather','Weather',r.weather)}${field('manpower','Manpower',r.manpower,'number')}${area('work_completed','Work Completed',r.work_completed)}${area('delays','Delays / Safety Notes',r.delays)}`,
      rfis:`${selectHtml('project_id','Project',projectOptions(r.project_id))}${field('title','RFI Title',r.title)}${area('question','Question',r.question)}${area('response','Response',r.response)}${select('status','Status',['Open','Answered','Closed'],r.status)}${field('due_date','Due Date',r.due_date,'date')}`,
      subcontractors:`${field('company','Company',r.company)}${field('trade','Trade',r.trade)}${field('contact_name','Contact Name',r.contact_name)}${field('phone','Phone',r.phone)}${field('email','Email',r.email,'email')}`,
      photos:`${selectHtml('project_id','Project',projectOptions(r.project_id))}${field('location','Location',r.location)}${select('category','Category',['Progress','Issue','Correction','Before','After','Inspection'],r.category)}${selectHtml('task_id','Related Task',taskOptions(r.task_id))}${area('notes','Notes',r.notes)}<div class="field"><label>Photos</label><input id="files" type="file" accept="image/*" multiple><small class="muted">You can choose multiple photos at once, or click Choose Files again to add more before saving.</small><div id="previews" class="photos" style="margin-top:12px"></div></div>`
    };
    document.body.insertAdjacentHTML('beforeend',`<div class="modal"><div class="modalbox"><div class="between"><h1>${r.id?'Edit':'Add'} ${label(t)}</h1><button class="btn" data-close>Close</button></div><div class="formgrid" id="form">${forms[t]}</div><br><button class="btn gold" id="save">Save</button></div></div>`);
    $('[data-close]').onclick=()=>{selectedPhotoFiles=[]; $('.modal').remove();};
    if(t==='photos'||t==='site_reports') { selectedPhotoFiles=[]; $('#files').onchange=addPreviewFiles; }
    $('#save').onclick=()=> t==='photos'?savePhotos():t==='site_reports'?saveSiteReport(r.id):saveRecord(t,r.id);
  }
  function field(n,l,v='',type='text'){return `<div class="field"><label>${l}</label><input id="f_${n}" type="${type}" value="${esc(v||'')}"></div>`}
  function area(n,l,v=''){return `<div class="field" style="grid-column:1/-1"><label>${l}</label><textarea id="f_${n}">${esc(v||'')}</textarea></div>`}
  function select(n,l,opts,v){return `<div class="field"><label>${l}</label><select id="f_${n}">${opts.map(o=>`<option ${v===o?'selected':''}>${o}</option>`).join('')}</select></div>`}
  function selectHtml(n,l,html){return `<div class="field"><label>${l}</label><select id="f_${n}">${html}</select></div>`}
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
    tasks:['project_id','title','location','priority','status','due_date','assignee','notes'],
    site_reports:['project_id','report_date','weather','manpower','work_completed','issues','safety_notes','submitted_by','submitted_by_name','submitted_by_email'],
    daily_logs:['project_id','log_date','weather','manpower','work_completed','delays'],
    rfis:['project_id','title','question','response','status','due_date'],
    subcontractors:['company','trade','contact_name','phone','email'],
    photos:['project_id','location','category','task_id','report_id','notes']
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

    ['project_id','task_id'].forEach(k=>{
      if(Object.prototype.hasOwnProperty.call(out,k) && (out[k]===''||out[k]===undefined)) out[k]=null;
    });

    ['due_date','log_date','report_date'].forEach(k=>{
      if(Object.prototype.hasOwnProperty.call(out,k) && out[k]==='') out[k]=null;
    });

    if(Object.prototype.hasOwnProperty.call(out,'manpower')){
      if(out.manpower===''||out.manpower===null||out.manpower===undefined) out.manpower=0;
      else out.manpower=Number(out.manpower)||0;
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
  function addPreviewFiles(){const incoming=[...$('#files').files]; incoming.forEach(f=>selectedPhotoFiles.push(f)); $('#files').value=''; renderSelectedPhotoPreviews()}
  function renderSelectedPhotoPreviews(){const wrap=$('#previews'); if(!wrap)return; wrap.innerHTML=''; selectedPhotoFiles.forEach((f,i)=>{const url=URL.createObjectURL(f); wrap.insertAdjacentHTML('beforeend',`<div class="photo"><img src="${url}"><div class="pbody"><b>${esc(f.name)}</b><div class="muted">${Math.round(f.size/1024)} KB</div><br><button class="btn danger" data-remove-preview="${i}">Remove</button></div></div>`)}); document.querySelectorAll('[data-remove-preview]').forEach(b=>b.onclick=()=>{selectedPhotoFiles.splice(Number(b.dataset.removePreview),1); renderSelectedPhotoPreviews()})}
  async function uploadReportPhotos(report,files){for(const f of files){const safeName=f.name.replace(/[^a-z0-9_.-]/gi,'_'); const path=`${report.project_id}/reports/${report.id}/${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}`; const up=await sb.storage.from('jobsite-photos').upload(path,f,{upsert:false,contentType:f.type||'image/jpeg'}); if(up.error)return up; const signed=await sb.storage.from('jobsite-photos').createSignedUrl(path, 60*60*24*365); if(signed.error)return signed; const photoRecord={project_id:report.project_id,report_id:report.id,location:'Site Report',category:'Progress',notes:report.work_completed||'',url:signed.data?.signedUrl||'',storage_path:path,file_name:f.name,file_size:f.size,mime_type:f.type||'image/jpeg',uploaded_by:user?.id||null}; const ins=await sb.from('photos').insert(photoRecord); if(ins.error)return ins;} return {error:null}}
  async function saveSiteReport(recordId){let obj=collect('site_reports'); if(!obj.project_id)return toast('Choose a project before saving the site report.'); obj.submitted_by=user?.id||null; obj.submitted_by_name=profile?.full_name||profile?.email||null; obj.submitted_by_email=profile?.email||user?.email||null; const res=recordId? await sb.from('site_reports').update(obj).eq('id',recordId).select().single(): await sb.from('site_reports').insert(obj).select().single(); if(res.error)return toast(res.error.message); const files=[...selectedPhotoFiles]; if(files.length){const up=await uploadReportPhotos(res.data,files); if(up.error)return toast(up.error.message);} selectedPhotoFiles=[]; $('.modal').remove(); await loadAll(); renderView()}
  async function savePhotos(){const files=[...selectedPhotoFiles]; if(!files.length)return toast('Choose at least one photo.'); const meta=collect('photos'); if(!meta.project_id)return toast('Choose a project before saving photos.'); for(const f of files){const safeName=f.name.replace(/[^a-z0-9_.-]/gi,'_'); const path=`${meta.project_id}/${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}`; const up=await sb.storage.from('jobsite-photos').upload(path,f,{upsert:false,contentType:f.type||'image/jpeg'}); if(up.error)return toast(up.error.message); const signed=await sb.storage.from('jobsite-photos').createSignedUrl(path, 60*60*24*365); if(signed.error)return toast(signed.error.message); const photoUrl=signed.data?.signedUrl||''; const photoRecord={...meta,url:photoUrl,storage_path:path,file_name:f.name,file_size:f.size,mime_type:f.type||'image/jpeg',uploaded_by:user?.id||null}; const ins=await sb.from('photos').insert(photoRecord); if(ins.error)return toast(ins.error.message); } selectedPhotoFiles=[]; $('.modal').remove(); await loadAll(); renderView()}
  async function delRecord(t,recordId){if(!canEdit())return toast('Your role does not allow deleting.'); if(!confirm('Delete this item? This cannot be undone.'))return; if(t==='projects'){await Promise.all(['site_reports','plans','tasks','photos','daily_logs','rfis'].map(x=>sb.from(x).delete().eq('project_id',recordId)))} if(t==='site_reports'){const photos=cache.photos.filter(x=>x.report_id===recordId); const paths=photos.map(p=>p.storage_path).filter(Boolean); if(paths.length) await sb.storage.from('jobsite-photos').remove(paths); await sb.from('photos').delete().eq('report_id',recordId);} if(t==='photos'){const p=cache.photos.find(x=>x.id===recordId); if(p?.storage_path) await sb.storage.from('jobsite-photos').remove([p.storage_path]);} const {error}=await sb.from(t).delete().eq('id',recordId); if(error)return toast(error.message); await loadAll(); renderView()}
  function exportCSV(t){const rows=cache[t]||[]; if(!rows.length)return toast('No data.'); const cols=Object.keys(rows[0]); const csv=[cols.join(','),...rows.map(r=>cols.map(c=>`"${String(r[c]??'').replaceAll('"','""')}"`).join(','))].join('\n'); const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download=`amin_ventures_${t}.csv`; a.click()}
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
        field('Weather', r.weather);
        field('Manpower', r.manpower||0);
        field('Work Completed', r.work_completed);
        field('Issues / Delays', r.issues);
        field('Safety Notes', r.safety_notes);
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
        field('Priority', t.priority);
        field('Status', t.status);
        field('Due Date', t.due_date);
        field('Assignee', t.assignee);
        field('Notes', t.notes);
      }
    }
    if(type==='daily'){
      for(const l of cache.daily_logs){
        section(`${projectName(l.project_id)} - ${l.log_date||''}`);
        field('Weather', l.weather);
        field('Manpower', l.manpower);
        field('Work Completed', l.work_completed);
        field('Delays / Safety', l.delays);
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
