/* IKB Learning – LMS statis (HTML + CSS + Vanilla JS) dengan Supabase sebagai backend global.
   Semua konten, pengaturan, tema, dan file disimpan di cloud. Isi 2 konstanta di bawah, lalu jalankan supabase/setup.sql. */
(function(){
'use strict';

/* ===================== KONFIGURASI (dibaca dari js/config.js) ===================== */
const CFG=window.IKB_CONFIG||{};
const SUPABASE_URL=CFG.SUPABASE_URL||'';
const SUPABASE_ANON_KEY=CFG.SUPABASE_ANON_KEY||'';
const EMAIL_DOMAIN=CFG.EMAIL_DOMAIN||'ikblearning.id';
const BUCKET='assets';
const CONFIGURED=!!SUPABASE_URL&&!!SUPABASE_ANON_KEY&&!/YOUR-/.test(SUPABASE_URL+SUPABASE_ANON_KEY);

/* ===================== UTIL ===================== */
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Math.random().toString(36).slice(2,10);
const ROLES={peserta:'Peserta',instruktur:'Instruktur',admin:'Admin',mentor:'Mentor',it:'Tim IT'};
const TYPES={materi:'Materi',kuis:'Kuis',assessment:'Assessment'};
const VIEW_ALL=['admin','instruktur','mentor','it'];
const REVIEW=['admin','instruktur','mentor'];
const EDIT_CONTENT=['admin','instruktur'];
const fmt=t=>new Date(t).toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
const HEX=/^#[0-9a-f]{6}$/i;

/* ===================== DEFAULT ===================== */
const DEFAULT_CONTENT={siteName:'ikb learning',tagline:'Pusat Pembelajaran Optimalisasi Pemasaran dan Kompetensi',
  heroDesc:'Pelatihan terfokus pada Optimalisasi Pemasaran Media Sosial dan Digital untuk UMKM melalui 3 pilar utama: Optimasi Profil, Mengelola Konten, dan Copywriting yang persuasif.',
  registrationTitle:'Pendaftaran Kelas Optimalisasi Pemasaran',registrationBtnLabel:'Buka Form Pendaftaran Peserta',registrationUrl:'https://docs.google.com/forms',
  registrationDesc:'Lengkapi data diri Anda melalui formulir Google Form resmi untuk mendaftar kelas Optimalisasi Pemasaran (Optimasi Profil, Mengelola Konten, dan Copywriting).',
  profile:'ikb learning adalah pusat pembelajaran praktis yang berfokus pada Optimalisasi Pemasaran untuk membantu pelaku usaha dan profesional membangun kehadiran digital yang kuat.',
  email:'akademik@ikblearning.id',phone:'+62 812-8899-2026',whatsapp:'6281288992026',address:'Menara Cakrawala Lt. 12, Jl. M.H. Thamrin No. 9, Jakarta Pusat'};
const DEFAULT_THEME={primary:'#0F4C97',secondary:'#12A5A8',accent:'#F5A01C',dark:'#0B2E66',bg:'#F2F7FA',surface:'#FFFFFF',text:'#102A43',
  font:'Plus Jakarta Sans',headingFont:'',fontScale:1,radius:'medium',nav:'light',navSticky:true,animations:true,
  sections:{hero:true,pendaftaran:true,materi:true,kuis:true,profil:true},
  branding:{siteTitle:'',logoUrl:'',logoPath:'',faviconUrl:'',faviconPath:''}};
const PRESETS={
  'IKB (bawaan)':{primary:'#0F4C97',secondary:'#12A5A8',accent:'#F5A01C',dark:'#0B2E66',bg:'#F2F7FA',surface:'#FFFFFF',text:'#102A43'},
  'Hijau Segar':{primary:'#15803D',secondary:'#0D9488',accent:'#EAB308',dark:'#14532D',bg:'#F3F8F4',surface:'#FFFFFF',text:'#14231A'},
  'Ungu Kreatif':{primary:'#6D28D9',secondary:'#DB2777',accent:'#F59E0B',dark:'#2E1065',bg:'#F7F3FB',surface:'#FFFFFF',text:'#241335'},
  'Mode Gelap':{primary:'#38BDF8',secondary:'#2DD4BF',accent:'#FBBF24',dark:'#020617',bg:'#0F172A',surface:'#1E293B',text:'#E2E8F0'}};
const FONTS=[['Plus Jakarta Sans','sans-serif'],['Inter','sans-serif'],['Poppins','sans-serif'],['Nunito','sans-serif'],['DM Sans','sans-serif'],['Montserrat','sans-serif'],['Roboto','sans-serif'],['Open Sans','sans-serif'],['Lato','sans-serif'],['Merriweather','serif'],['Playfair Display','serif'],['Lora','serif'],['System UI','system']];
const RADII={sharp:{card:0,ctl:0,btn:0,lg:0},medium:{card:10,ctl:8,btn:8,lg:16},round:{card:18,ctl:14,btn:999,lg:28}};
const mergeTheme=t=>{t=t||{};return {...DEFAULT_THEME,...t,sections:{...DEFAULT_THEME.sections,...(t.sections||{})},branding:{...DEFAULT_THEME.branding,...(t.branding||{})}};};

/* ===================== STATE ===================== */
let sb=null,profile=null,SILENT=false;
const db={settings:{...DEFAULT_CONTENT},theme:mergeTheme(),items:[],users:[],progress:{},notes:[],logs:[]};
const me=()=>profile;
const isRole=(...r)=>!!profile&&r.includes(profile.role);
const isStaff=()=>isRole(...EDIT_CONTENT);
const pk=(u,i)=>u+'|'+i;
const prog=(u,i)=>db.progress[pk(u,i)];
const visibleItems=t=>db.items.filter(i=>(!t||i.type===t)&&(i.published||isStaff()));
const logoSrc=()=>db.theme.branding.logoUrl||'assets/logo.png';
const fileUrl=it=>it.filePath?sb.storage.from(BUCKET).getPublicUrl(it.filePath).data.publicUrl:'';

/* ===================== TEMA (CSS Variables) ===================== */
const lum=h=>{const c=[1,3,5].map(i=>parseInt(h.substr(i,2),16)/255).map(v=>v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4));return .2126*c[0]+.7152*c[1]+.0722*c[2];};
const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
const onColor=h=>ratio(h,'#FFFFFF')>=ratio(h,'#101828')?'#FFFFFF':'#101828';
const fontStack=n=>{const f=FONTS.find(x=>x[0]===n);if(!f||f[1]==='system')return "system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif";return `'${f[0]}',${f[1]==='serif'?'Georgia,serif':'system-ui,Arial,sans-serif'}`;};
function loadFont(n){
  const f=FONTS.find(x=>x[0]===n);if(!f||f[1]==='system')return;
  const id='gf-'+n.replace(/\W/g,'');if(document.getElementById(id))return;
  const l=document.createElement('link');l.id=id;l.rel='stylesheet';
  l.href='https://fonts.googleapis.com/css2?family='+n.replace(/ /g,'+')+':wght@400;500;600;700;800&display=swap';document.head.appendChild(l);
}
function applyTheme(t,cache=true){
  t=mergeTheme(t);const r=document.documentElement,set=(k,v)=>r.style.setProperty(k,v);
  ['primary','secondary','accent','dark','bg','surface','text'].forEach(k=>{if(HEX.test(t[k]))set('--'+k,t[k]);});
  set('--on-primary',onColor(t.primary));set('--on-secondary',onColor(t.secondary));set('--on-accent',onColor(t.accent));
  set('--fs',Math.min(1.4,Math.max(.8,Number(t.fontScale)||1)));
  const rd=RADII[t.radius]||RADII.medium;set('--r-card',rd.card+'px');set('--r-ctl',rd.ctl+'px');set('--r-btn',rd.btn+'px');set('--r-lg',rd.lg+'px');
  set('--font',fontStack(t.font));set('--font-head',t.headingFont?fontStack(t.headingFont):'var(--font)');
  loadFont(t.font);loadFont(t.headingFont);
  r.dataset.nav=t.nav;r.dataset.sticky=t.navSticky?'1':'0';r.dataset.anim=t.animations===false?'0':'1';
  if(cache){try{localStorage.setItem('ikb_theme_cache',JSON.stringify(t));}catch(e){}}
}
function applyBrand(){
  const b=db.theme.branding;document.title=b.siteTitle||db.settings.siteName;
  const f=$('#favicon');if(f)f.href=b.faviconUrl||b.logoUrl||'assets/favicon.png';
}

/* ===================== LAPISAN DATA (Supabase) ===================== */
const errMsg=e=>{const m=(e&&e.message)||String(e);return /row-level security|permission denied|42501/i.test(m+(e&&e.code))?'Anda tidak punya izin untuk tindakan ini.':m;};
const must=async p=>{const r=await p;if(r.error)throw r.error;return r.data;};
async function run(fn,okMsg){try{await fn();if(okMsg)toast(okMsg);return true;}catch(e){console.error(e);toast(errMsg(e),'err');return false;}}
const mapItem=r=>({id:r.id,type:r.type,title:r.title,category:r.category||'',description:r.description||'',checklist:r.checklist||[],duration:r.duration||'',source:r.source,url:r.url||'',filePath:r.file_path||'',fileName:r.file_name||'',passScore:r.pass_score||70,questions:r.questions||[],published:!!r.published,sortOrder:r.sort_order||0,createdBy:r.created_by||''});
const toRow=o=>({id:o.id,type:o.type,title:o.title,category:o.category||'',description:o.description||'',checklist:o.checklist||[],duration:o.duration||'',source:o.source,url:o.url||null,file_path:o.filePath||null,file_name:o.fileName||null,pass_score:o.passScore||70,questions:o.questions||[],published:o.published,sort_order:o.sortOrder||0,created_by:o.createdBy||'',updated_at:new Date().toISOString()});
const mapProfile=r=>({id:r.id,username:r.username,name:r.full_name||r.username,role:r.role,active:r.active});

async function loadPublic(){
  const [st,it]=await Promise.all([
    sb.from('site_settings').select('*').eq('id',1).maybeSingle(),
    sb.from('items').select('*').order('sort_order',{ascending:true}).order('created_at',{ascending:true})]);
  if(it.error)throw it.error;
  db.settings={...DEFAULT_CONTENT,...((st.data&&st.data.content)||{})};
  db.theme=mergeTheme(st.data&&st.data.theme);
  db.items=(it.data||[]).map(mapItem);
}
async function loadPrivate(){
  if(!profile)return;
  const all=VIEW_ALL.includes(profile.role);
  const [pr,pg,nt,lg]=await Promise.all([
    all?sb.from('profiles').select('*').order('created_at',{ascending:true}):Promise.resolve({data:[]}),
    sb.from('progress').select('*'),
    sb.from('notes').select('*').order('created_at',{ascending:false}),
    ['admin','it'].includes(profile.role)?sb.from('activity_logs').select('*').order('id',{ascending:false}).limit(300):Promise.resolve({data:[]})]);
  db.users=all?(pr.data||[]).map(mapProfile):[profile];
  db.progress={};(pg.data||[]).forEach(r=>{db.progress[pk(r.user_id,r.item_id)]={status:r.status,score:r.score==null?undefined:r.score,attempts:r.attempts||0,feedback:r.feedback||'',gradedBy:r.graded_by||'',date:new Date(r.updated_at).getTime()};});
  db.notes=(nt.data||[]).map(r=>({id:r.id,participantId:r.participant_id,text:r.text,by:r.by_name||'',t:new Date(r.created_at).getTime()}));
  db.logs=(lg.data||[]).map(r=>({t:new Date(r.created_at).getTime(),u:r.user_name||'-',a:r.action}));
}
function clearPrivate(){profile=null;db.users=[];db.progress={};db.notes=[];db.logs=[];}
function log(a){if(!profile)return;sb.from('activity_logs').insert({user_id:profile.id,user_name:profile.name,action:a}).then(()=>{},()=>{});}
async function readProfile(userId){
  const r=await sb.from('profiles').select('*').eq('id',userId).maybeSingle();
  return r.data?mapProfile(r.data):null;
}
async function writeProgress(userId,itemId,patch){
  const old=prog(userId,itemId)||{},n={...old,...patch};
  const row={user_id:userId,item_id:itemId,status:n.status||'proses',score:n.score==null||Number.isNaN(n.score)?null:n.score,attempts:n.attempts||0};
  if(isRole(...REVIEW)){row.feedback=n.feedback||null;row.graded_by=n.gradedBy||null;}
  await must(sb.from('progress').upsert(row,{onConflict:'user_id,item_id'}));
  db.progress[pk(userId,itemId)]={...n,status:row.status,date:Date.now()};
}
async function saveContent(c){await must(sb.from('site_settings').upsert({id:1,content:c,updated_at:new Date().toISOString()},{onConflict:'id'}));db.settings={...DEFAULT_CONTENT,...c};}
async function saveTheme(t){await must(sb.from('site_settings').upsert({id:1,theme:t,updated_at:new Date().toISOString()},{onConflict:'id'}));db.theme=mergeTheme(t);}
async function uploadFile(path,blob){
  await must(sb.storage.from(BUCKET).upload(path,blob,{contentType:blob.type||'application/octet-stream',upsert:false,cacheControl:'3600'}));
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
const removeFile=async p=>{if(p)try{await sb.storage.from(BUCKET).remove([p]);}catch(e){}};
async function login(un,pw){
  const email=un.includes('@')?un.trim():un.trim().toLowerCase()+'@'+EMAIL_DOMAIN;
  let r=await sb.auth.signInWithPassword({email,password:pw});
  if(r.error&&/\s/.test(pw))r=await sb.auth.signInWithPassword({email,password:pw.replace(/\s+/g,'')});
  if(r.error)throw new Error('Nama pengguna atau kata sandi salah.');
  const p=await readProfile(r.data.user.id);
  if(!p||!p.active){await sb.auth.signOut();throw new Error('Akun belum aktif atau belum punya profil. Hubungi admin.');}
  profile=p;await loadPrivate();log('Masuk sebagai '+ROLES[p.role]);
}

/* ===================== REALTIME ===================== */
let liveTimer=null,lastSync=Date.now();
function subscribeLive(){
  try{
    const ch=sb.channel('ikb-live');
    ['items','site_settings','progress','notes'].forEach(t=>ch.on('postgres_changes',{event:'*',schema:'public',table:t},()=>scheduleSync()));
    ch.subscribe();
  }catch(e){console.warn('Realtime tidak aktif, data diperbarui saat refresh.',e);}
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-lastSync>30000)scheduleSync();});
}
function scheduleSync(){clearTimeout(liveTimer);liveTimer=setTimeout(async()=>{
  try{await loadPublic();await loadPrivate();lastSync=Date.now();applyTheme(db.theme);applyBrand();
    const m=$('#modal'),name=location.hash.replace(/^#\/?/,'').split('/')[0],typing=document.activeElement&&/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if(!(m&&m.open)&&!typing&&!['pengaturan','item'].includes(name))route(true);
  }catch(e){console.warn(e);}
},350);}

/* ===================== UI UMUM ===================== */
function toast(msg,kind){const d=document.createElement('div');d.className='toast '+(kind||'');d.textContent=msg;$('#toasts').appendChild(d);setTimeout(()=>d.remove(),4200);}
function openModal(title,body,foot){
  const m=$('#modal');
  m.innerHTML=`<div class="mhead"><h3>${esc(title)}</h3><button class="xbtn" data-close aria-label="Tutup">&times;</button></div><div class="mbody">${body}</div>${foot?`<div class="mfoot">${foot}</div>`:''}`;
  if(!m.open)m.showModal();
  $$('[data-close]',m).forEach(b=>b.onclick=()=>m.close());
  return m;
}
function closeModal(){const m=$('#modal');if(m.open)m.close();}
const ICON={
  home:'<path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  book:'<path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z"/><path d="M8 4v16"/>',
  quiz:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/>',
  check:'<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/>',
  chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  users:'<circle cx="9" cy="8" r="3.5"/><path d="M2 21a7 7 0 0 1 14 0M17 4.5a3.5 3.5 0 0 1 0 7M22 21a7 7 0 0 0-4-6.3"/>',
  edit:'<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  db:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  menu:'<path d="M3 6h18M3 12h18M3 18h18"/>'};
const ic=n=>`<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;
const NAV={
  peserta:[['dashboard','Dashboard','home'],['materi','Materi','book'],['kuis','Kuis','quiz'],['assessment','Assessment','check'],['nilai','Nilai Saya','chart'],['profil','Profil Saya','user']],
  instruktur:[['dashboard','Dashboard','home'],['kelola','Kelola Konten','edit'],['peserta','Peserta','users'],['profil','Profil Saya','user']],
  mentor:[['dashboard','Dashboard','home'],['peserta','Peserta dan Catatan','users'],['materi','Katalog Materi','book'],['profil','Profil Saya','user']],
  admin:[['dashboard','Dashboard','home'],['kelola','Kelola Konten','edit'],['peserta','Peserta','users'],['pengguna','Pengguna','users'],['pengaturan','Pengaturan Website','gear'],['sistem','Sistem dan Log','db'],['profil','Profil Saya','user']],
  it:[['dashboard','Dashboard','home'],['pengguna','Akun Pengguna','users'],['sistem','Sistem dan Log','db'],['profil','Profil Saya','user']]};
const ACCESS={dashboard:['peserta','instruktur','mentor','admin','it'],profil:['peserta','instruktur','mentor','admin','it'],
  materi:['peserta','instruktur','mentor','admin'],kuis:['peserta','instruktur','admin'],assessment:['peserta','instruktur','admin'],
  item:['peserta','instruktur','mentor','admin'],nilai:['peserta'],kelola:['instruktur','admin'],peserta:['instruktur','mentor','admin'],
  pengguna:['admin','it'],pengaturan:['admin'],sistem:['it','admin']};

function stats(userId){
  const items=db.items.filter(i=>i.published);
  const done=items.filter(i=>{const p=prog(userId,i.id);return p&&p.status==='selesai';});
  const sc=items.map(i=>prog(userId,i.id)).filter(p=>p&&typeof p.score==='number').map(p=>p.score);
  return {total:items.length,done:done.length,pct:items.length?Math.round(done.length/items.length*100):0,avg:sc.length?Math.round(sc.reduce((a,b)=>a+b,0)/sc.length):null};
}

/* ===================== SHELL & ROUTER ===================== */
const app=$('#app');
function shell(title,body,active){
  const u=me();
  app.innerHTML=`<div class="shell"><aside class="side" id="side">
    <div class="logo-tile"><img src="${esc(logoSrc())}" onerror="this.onerror=null;this.src='assets/logo.png'" alt="${esc(db.settings.siteName)}"></div>
    <div class="who">${esc(db.settings.siteName)}</div>
    <nav class="nav">${NAV[u.role].map(n=>`<a href="#/${n[0]}" class="${n[0]===active?'on':''}">${ic(n[2])}${n[1]}</a>`).join('')}</nav>
    <button class="btn ghost out" id="logout" style="color:#fff;justify-content:center;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.3)">Keluar</button></aside>
    <div class="main"><header class="top"><button class="burger" id="burger" aria-label="Buka menu"><svg viewBox="0 0 24 24">${ICON.menu}</svg></button>
    <h1>${esc(title)}</h1><div class="userchip"><span class="nm">${esc(u.name)}</span><span class="badge teal">${ROLES[u.role]}</span><div class="avatar">${esc(u.name.charAt(0).toUpperCase())}</div></div></header>
    <main class="content">${body}</main></div></div>`;
  $('#burger').onclick=()=>$('#side').classList.toggle('open');
  $$('.nav a').forEach(a=>a.onclick=()=>$('#side').classList.remove('open'));
  $('#logout').onclick=async()=>{log('Keluar');try{await sb.auth.signOut();}catch(e){}clearPrivate();location.hash='#/';route();};
}
let routeToken=0;
async function route(silent){
  const tok=++routeToken;SILENT=!!silent;
  if(silent)app.dataset.silent='1';else delete app.dataset.silent;
  applyTheme(db.theme);applyBrand();
  if(!CONFIGURED)return setupScreen();
  const [name='',arg]=location.hash.replace(/^#\/?/,'').split('/');
  const u=me();closeModal();
  if(PUBLIC_ROUTES[name]!==undefined)return publicRoute(PUBLIC_ROUTES[name],silent);
  if(name==='login'){if(u){location.hash='#/dashboard';return;}return loginPage();}
  if(!u){location.hash='#/login';return;}
  if(!ACCESS[name]||!ACCESS[name].includes(u.role)){
    return shell('Akses ditolak','<div class="empty"><h2>Anda tidak punya akses ke halaman ini</h2><p>Hubungi admin bila Anda merasa ini keliru.</p><a class="btn" href="#/dashboard">Kembali ke dashboard</a></div>','dashboard');
  }
  const P={dashboard,materi:()=>listPage('materi'),kuis:()=>listPage('kuis'),assessment:()=>listPage('assessment'),item:()=>itemPage(arg),nilai,kelola,peserta:()=>pesertaPage(arg),pengguna,pengaturan:()=>pengaturan(arg),sistem,profil};
  try{await P[name]();}catch(e){console.error(e);if(tok===routeToken)toast(errMsg(e),'err');}
}
window.addEventListener('hashchange',()=>route());

function setupScreen(){
  app.innerHTML=`<div class="setup"><div class="card"><h2 style="font-size:24px">Website belum terhubung ke database</h2>
  <p class="muted">Isi dua nilai konfigurasi di file <code>js/config.js</code>, lalu muat ulang halaman ini.</p>
  <ol><li>Buat proyek di <b>supabase.com</b> (gratis).</li><li>Buka <b>SQL Editor</b>, tempel isi <code>supabase/setup.sql</code>, lalu klik <b>Run</b>.</li>
  <li>Salin <b>Project URL</b> dan <b>anon public key</b> dari <b>Project Settings &gt; API</b> ke <code>SUPABASE_URL</code> dan <code>SUPABASE_ANON_KEY</code> di <code>js/config.js</code>.</li>
  <li>Buat akun admin di <b>Authentication &gt; Users</b>. Panduan lengkap ada di <code>SETUP.md</code>.</li></ol></div></div>`;
}

/* ===================== HALAMAN PUBLIK (pindah halaman + animasi) ===================== */
const PUBLIC_ROUTES={'':'beranda',daftar:'daftar',modul:'modul',evaluasi:'evaluasi',tentang:'tentang'};
const PUBNAV=[['beranda','Beranda',null],['daftar','Pendaftaran','pendaftaran'],['modul','Modul Pemasaran','materi'],['evaluasi','Kuis & Assessment','kuis'],['tentang','Profil & Kontak','profil']];
const hashOf=k=>k==='beranda'?'#/':'#/'+k;
const REDUCED=()=>window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
let lastPublic=null;
function publicRoute(page,silent){
  const sec=db.theme.sections,need={daftar:'pendaftaran',modul:'materi',evaluasi:'kuis',tentang:'profil'}[page];
  if(need&&!sec[need]){location.hash='#/';return;}
  const render=()=>{landing(page);if(!silent)window.scrollTo(0,0);initReveal(silent);};
  const animate=!silent&&lastPublic&&lastPublic!==page&&document.startViewTransition&&db.theme.animations!==false&&!REDUCED();
  lastPublic=page;
  if(animate)document.startViewTransition(render);else render();
}
function initReveal(silent){
  const els=$$('.reveal');
  if(silent||!('IntersectionObserver' in window)||db.theme.animations===false||REDUCED())els.forEach(e=>e.classList.add('in'));
  else{const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}}),{threshold:.12,rootMargin:'0px 0px -40px 0px'});els.forEach(e=>io.observe(e));}
  $$('[data-count]').forEach(countUp);
}
function countUp(el){
  const to=Number(el.dataset.count)||0;
  if(SILENT||db.theme.animations===false||REDUCED()){el.textContent=to;return;}
  let t0=null;el.textContent='0';
  const step=ts=>{if(!t0)t0=ts;const p=Math.min(1,(ts-t0)/900);el.textContent=Math.round(to*(1-Math.pow(1-p,3)));if(p<1)requestAnimationFrame(step);};
  requestAnimationFrame(step);
}
function landing(page){
  const s=db.settings,u=me(),sec=db.theme.sections,pub=db.items.filter(i=>i.published);
  const mats=pub.filter(i=>i.type==='materi'),qz=pub.filter(i=>i.type!=='materi');
  const cats=[...new Set(mats.map(i=>i.category).filter(Boolean))];
  const wa=String(s.whatsapp||'').replace(/\D/g,''),go=u?'#/dashboard':'#/login';
  const dl=k=>`style="--d:${k*90}ms"`;
  const matCard=(i,k)=>`<article class="pcard reveal" ${dl(k)} data-cat="${esc(i.category||'')}"><span class="badge teal">${esc(i.category||'Materi')}</span><h3>${esc(i.title)}</h3><p>${esc(i.description)}</p>
    ${(i.checklist||[]).length?`<ul class="check">${i.checklist.map(c=>`<li>${esc(c)}</li>`).join('')}</ul>`:''}
    <button class="btn teal sm" data-open="${i.id}">${i.source==='pdf'?'Buka dokumen PDF':'Buka materi'}</button></article>`;
  const quizCard=(i,k)=>`<article class="pcard reveal q-${i.type}" ${dl(k)}><div class="meta"><span class="badge ${i.type==='kuis'?'warn':''}">${esc(i.category||TYPES[i.type])}</span>${i.duration?`<span class="badge">${esc(i.duration)}</span>`:''}</div><h3>${esc(i.title)}</h3><p>${esc(i.description)}</p>
    <button class="btn sm" data-open="${i.id}">${i.source==='builtin'?'Kerjakan sekarang':'Mulai kerjakan'}</button></article>`;
  const banner=(t,sub)=>`<section class="pagehero"><div class="pagehero-in"><nav class="crumb" aria-label="Breadcrumb"><a href="#/">Beranda</a><span>/</span><b>${esc(t)}</b></nav><h1>${esc(t)}</h1><p>${esc(sub)}</p></div></section>`;
  const regcard=`<div class="regcard reveal"><div><span class="badge warn">Pendaftaran peserta pelatihan</span>
    <h2>${esc(s.registrationTitle)} <span class="blue">${esc(s.siteName)}</span></h2><p>${esc(s.registrationDesc)}</p></div>
    <div class="regact"><a class="btn orange" href="${esc(s.registrationUrl)}" target="_blank" rel="noopener">${esc(s.registrationBtnLabel)}</a><span class="small muted">Formulir terbuka di tab baru (Google Form)</span></div></div>`;
  let h=`<header class="pub-nav"><a href="#/" aria-label="${esc(s.siteName)}"><img src="${esc(logoSrc())}" onerror="this.onerror=null;this.src='assets/logo.png'" alt="${esc(s.siteName)}"></a>
    <nav class="pub-links" aria-label="Navigasi utama">${PUBNAV.filter(n=>!n[2]||sec[n[2]]).map(n=>`<a href="${hashOf(n[0])}" class="${n[0]===page?'on':''}">${n[1]}</a>`).join('')}</nav>
    <a class="btn" href="${go}">${u?'Dashboard':'Masuk'}</a></header><main class="page">`;
  if(page==='beranda'){
    if(sec.hero)h+=`<section class="hero"><div class="hero-main"><span class="pill">Program unggulan: Optimalisasi Pemasaran</span>
      <h1>Kuasai Optimalisasi Pemasaran bersama ${esc(s.siteName)}</h1><p>${esc(s.heroDesc)}</p>
      <div class="acts"><a class="btn orange" href="${esc(s.registrationUrl)}" target="_blank" rel="noopener">Daftar Kelas Sekarang</a>
      ${sec.materi?`<a class="btn ghost light" href="#/modul">Jelajahi ${mats.length} Modul</a>`:''}</div></div>
      <div class="hero-card"><div class="hc-head"><div><small>Fokus kurikulum utama</small><h3>Optimalisasi Pemasaran</h3></div><img src="${esc(logoSrc())}" onerror="this.onerror=null;this.src='assets/logo.png'" alt=""></div>
        <div class="hc-stats"><div><b data-count="${mats.length}">${mats.length}</b><span>Modul Pemasaran</span></div><div><b data-count="${qz.length}">${qz.length}</b><span>Kuis & Assessment</span></div></div>
        <div class="hc-list"><b>${cats.length} pilar modul pelatihan</b>${cats.map((c,k)=>`<div>${k+1}. ${esc(c)}</div>`).join('')||'<div>Belum ada modul terbit.</div>'}</div></div></section>`;
    else h+=banner(s.siteName,s.tagline);
    const steps=[];
    if(sec.pendaftaran)steps.push(['daftar','Daftar Kelas','Isi formulir pendaftaran resmi untuk bergabung di kelas.']);
    if(sec.materi)steps.push(['modul','Pelajari Modul',(cats.length||mats.length)+' pilar modul dengan checklist praktik yang langsung bisa diterapkan.']);
    if(sec.kuis)steps.push(['evaluasi','Uji Kemampuan','Ukur pemahaman lewat Pre-Test dan assessment praktik.']);
    if(steps.length)h+=`<section class="sect"><div class="sechead"><div><h2>Alur Belajar</h2><p class="muted">Langkah sederhana untuk memulai.</p></div></div>
      <div class="steps">${steps.map((st,k)=>`<a class="step reveal" ${dl(k)} href="${hashOf(st[0])}"><b class="num">${k+1}</b><h3>${esc(st[1])}</h3><p>${esc(st[2])}</p><span class="more">Buka halaman &rarr;</span></a>`).join('')}</div></section>`;
    if(sec.materi&&mats.length)h+=`<section class="band"><div class="sect"><div class="sechead"><div><h2>Modul Unggulan</h2><p class="muted">Tiga modul pertama dari kurikulum kami.</p></div><a class="btn ghost" href="#/modul">Lihat semua modul</a></div>
      <div class="pgrid">${mats.slice(0,3).map(matCard).join('')}</div></div></section>`;
    if(sec.pendaftaran)h+=`<section class="sect">${regcard}</section>`;
  }
  if(page==='daftar')h+=banner(s.registrationTitle,'Bergabung dengan kelas dan mulai belajar langkah demi langkah.')+`<section class="sect">${regcard}
    <div class="sechead" style="margin-top:36px"><div><h2>Cara bergabung</h2></div></div>
    <div class="steps">${[['Buka formulir','Klik tombol pendaftaran di atas untuk membuka formulir resmi.'],['Lengkapi data diri','Isi data dengan benar agar tim kami mudah menghubungi Anda.'],['Masuk ke platform','Setelah akun dibuat oleh admin, masuk lewat tombol Masuk untuk mengakses materi.']].map((st,k)=>`<div class="step reveal static" ${dl(k)}><b class="num">${k+1}</b><h3>${st[0]}</h3><p>${st[1]}</p></div>`).join('')}</div></section>`;
  if(page==='modul')h+=banner('Modul Optimalisasi Pemasaran','Pelajari langkah praktis '+(cats.length?cats.join(', '):'pemasaran')+' beserta checklist eksekusinya.')+`<section class="sect">
    <div class="sechead"><div class="tabs" id="pills" style="margin:0"><button class="on" data-pill="">Semua Modul</button>${cats.map(c=>`<button data-pill="${esc(c)}">${esc(c)}</button>`).join('')}</div>
    <div class="field" style="margin:0;min-width:240px"><input type="text" id="pub-q" placeholder="Cari modul atau poin praktik" aria-label="Cari modul"></div></div>
    ${mats.length?`<div class="pgrid" id="pub-mat">${mats.map(matCard).join('')}</div>`:'<div class="empty">Belum ada modul yang diterbitkan.</div>'}</section>`;
  if(page==='evaluasi')h+=banner('Kuis & Assessment','Uji pemahaman Anda melalui Pre-Test, Post-Test, maupun Studi Kasus yang telah disediakan.')+`<section class="sect">
    ${qz.length?`<div class="pgrid two">${qz.map(quizCard).join('')}</div>`:'<div class="empty">Belum ada kuis atau assessment.</div>'}</section>`;
  if(page==='tentang')h+=banner('Profil '+s.siteName,s.tagline)+`<section class="sect"><div class="profcard reveal"><div class="prof-l"><h2>Tentang kami</h2><p style="white-space:pre-line">${esc(s.profile)}</p></div>
    <div class="prof-r"><h3>Hubungi Kami</h3><p>Butuh bantuan terkait pendaftaran peserta, materi pelatihan, atau jadwal assessment? Hubungi kami lewat kontak resmi berikut.</p>
      <dl><dt>Alamat</dt><dd>${esc(s.address)}</dd><dt>Telepon / WhatsApp</dt><dd>${esc(s.phone)}</dd><dt>Email resmi</dt><dd><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></dd></dl>
      ${wa?`<a class="btn orange" style="justify-content:center" href="https://wa.me/${wa}" target="_blank" rel="noopener">Chat via WhatsApp</a>`:''}</div></div></section>`;
  h+=`</main><footer class="pfoot">&copy; ${new Date().getFullYear()} ${esc(s.siteName)}. ${esc(s.tagline)}</footer>`;
  app.innerHTML=h;
  const filt=()=>{const q=$('#pub-q').value.toLowerCase(),on=$('#pills .on'),c=on?on.dataset.pill:'';
    $$('#pub-mat .pcard').forEach(a=>a.classList.toggle('hidden',(c&&a.dataset.cat!==c)||!a.textContent.toLowerCase().includes(q)));};
  const pq=$('#pub-q');if(pq)pq.oninput=filt;
  $$('#pills button').forEach(b=>b.onclick=()=>{$$('#pills button').forEach(x=>x.classList.remove('on'));b.classList.add('on');filt();});
  $$('[data-open]').forEach(b=>b.onclick=()=>{
    const it=db.items.find(x=>x.id===b.dataset.open),cu=me();
    if(cu&&ACCESS.item.includes(cu.role)){location.hash='#/item/'+it.id;return;}
    if(it.source==='link'){window.open(it.url,'_blank','noopener');return;}
    if(it.source==='pdf'){openModal(it.title,`<iframe class="viewer" src="${esc(fileUrl(it))}" title="${esc(it.title)}"></iframe>`);return;}
    location.hash='#/login';toast('Masuk terlebih dahulu untuk mengerjakan kuis ini.');
  });
}

/* ===================== LOGIN ===================== */
function loginPage(){
  const s=db.settings;
  app.innerHTML=`<div class="login"><div class="brandside"><div class="logo-tile"><img src="${esc(logoSrc())}" onerror="this.onerror=null;this.src='assets/logo.png'" alt="${esc(s.siteName)}"></div>
    <div><h1>${esc(s.tagline)}</h1><p>Masuk untuk mengakses materi, kuis, dan assessment sesuai peran Anda.</p></div>
    <p class="small" style="margin:0"><a href="#/" style="color:#fff">Kembali ke beranda</a></p></div>
    <div class="formside"><div class="formcard"><h2 style="font-size:26px">Masuk</h2><p class="muted">Gunakan akun yang dibuat admin. Anda boleh mengetik nama pengguna saja atau email lengkap.</p>
    <p class="err hidden" id="lerr" role="alert"></p>
    <form id="lf"><div class="field"><label for="un">Nama pengguna atau email</label><input type="text" id="un" autocomplete="username" required autofocus></div>
    <div class="field"><label for="pw">Kata sandi</label><input type="password" id="pw" autocomplete="current-password" required></div>
    <button class="btn" id="lbtn" style="width:100%;justify-content:center" type="submit">Masuk</button></form>
    </div></div></div>`;
  $('#lf').onsubmit=async e=>{e.preventDefault();
    const er=$('#lerr'),btn=$('#lbtn');er.classList.add('hidden');btn.disabled=true;btn.textContent='Memproses…';
    try{await login($('#un').value,$('#pw').value);location.hash='#/dashboard';route();}
    catch(err){er.textContent=err.message;er.classList.remove('hidden');btn.disabled=false;btn.textContent='Masuk';}};
}

/* ===================== DASHBOARD ===================== */
function statCards(arr){return `<div class="grid g4" style="margin-bottom:18px">${arr.map(a=>`<div class="stat"><div class="n">${a[0]}</div><div class="l">${a[1]}</div></div>`).join('')}</div>`;}
function itemCard(i,userId){
  const p=userId?prog(userId,i.id):null;
  const st=p?(p.status==='selesai'?'<span class="badge ok">Selesai</span>':'<span class="badge warn">Berjalan</span>'):(userId?'<span class="badge">Belum mulai</span>':'');
  const src={link:'Tautan',pdf:'PDF',builtin:'Kuis bawaan'}[i.source];
  return `<a class="item ${i.type}" href="#/item/${i.id}"><div class="meta"><span class="badge teal">${TYPES[i.type]}</span><span class="badge">${src}</span>${i.duration?`<span class="badge">${esc(i.duration)}</span>`:''}${i.published?'':'<span class="badge err">Draf</span>'}${st}</div>
    <h3>${esc(i.title)}</h3><p>${esc(i.description)}</p><span class="small muted">${esc(i.category||'')}</span></a>`;
}
function logList(n){return `<ul class="log">${db.logs.slice(0,n).map(l=>`<li><b>${esc(l.u)}</b> &middot; ${esc(l.a)} <span class="muted small">(${fmt(l.t)})</span></li>`).join('')||'<li class="muted">Belum ada aktivitas.</li>'}</ul>`;}
function dashboard(){
  const u=me(),r=u.role;let b='';
  if(r==='peserta'){
    const s=stats(u.id),todo=db.items.filter(i=>i.published&&!(prog(u.id,i.id)&&prog(u.id,i.id).status==='selesai')).slice(0,4);
    const notes=db.notes.filter(n=>n.participantId===u.id).slice(0,3);
    b=`<div class="welcome"><div><h2>Halo, ${esc(u.name)}</h2><p>${s.done} dari ${s.total} konten selesai. ${s.pct===100?'Semua selesai, kerja bagus.':'Lanjutkan dari materi berikutnya.'}</p></div></div>
    ${statCards([[s.pct+'%','Progres belajar'],[s.done+'/'+s.total,'Konten selesai'],[s.avg===null?'-':s.avg,'Rata-rata nilai']])}
    <div class="card" style="margin-bottom:18px"><div class="bar"><i style="width:${s.pct}%"></i></div></div>
    <div class="pagehead"><h2>Lanjutkan belajar</h2></div>
    ${todo.length?`<div class="items">${todo.map(i=>itemCard(i,u.id)).join('')}</div>`:'<div class="empty">Tidak ada konten yang tertunda.</div>'}
    ${notes.length?`<div class="pagehead" style="margin-top:24px"><h2>Catatan dari mentor dan instruktur</h2></div><div class="grid">${notes.map(n=>`<div class="card"><p style="margin:0 0 6px;white-space:pre-line">${esc(n.text)}</p><span class="small muted">${esc(n.by)} &middot; ${fmt(n.t)}</span></div>`).join('')}</div>`:''}`;
  }else if(r==='it'){
    b=statCards([[db.users.length,'Akun terdaftar'],[db.users.filter(x=>x.active).length,'Akun aktif'],[db.items.length,'Konten'],[Object.keys(db.progress).length,'Catatan progres']])+`<div class="card"><h2>Aktivitas terbaru</h2>${logList(8)}</div>`;
  }else{
    const ps=db.users.filter(x=>x.role==='peserta'&&x.active),pub=db.items.filter(i=>i.published);
    const all=ps.map(x=>stats(x.id)),avgPct=all.length?Math.round(all.reduce((a,x)=>a+x.pct,0)/all.length):0,sc=all.filter(x=>x.avg!==null);
    b=statCards([[ps.length,'Peserta aktif'],[pub.length,'Konten terbit'],[avgPct+'%','Rata-rata progres'],[sc.length?Math.round(sc.reduce((a,x)=>a+x.avg,0)/sc.length):'-','Rata-rata nilai']])+
    `<div class="pagehead"><h2>Penyelesaian per konten</h2></div><div class="tablewrap"><table><thead><tr><th>Konten</th><th>Jenis</th><th>Selesai</th><th style="width:30%">Persentase</th></tr></thead><tbody>
    ${pub.map(i=>{const d=ps.filter(x=>{const p=prog(x.id,i.id);return p&&p.status==='selesai';}).length,pc=ps.length?Math.round(d/ps.length*100):0;
      return `<tr><td><a href="#/item/${i.id}">${esc(i.title)}</a></td><td><span class="badge teal">${TYPES[i.type]}</span></td><td>${d}/${ps.length}</td><td><div class="bar"><i style="width:${pc}%"></i></div></td></tr>`;}).join('')||'<tr><td colspan="4" class="muted">Belum ada konten terbit.</td></tr>'}</tbody></table></div>`;
  }
  shell('Dashboard',b,'dashboard');
}

/* ===================== DAFTAR & DETAIL KONTEN ===================== */
function listPage(type){
  const u=me(),items=visibleItems(type),names={materi:'Materi Pelatihan',kuis:'Kuis',assessment:'Assessment'};
  shell(names[type],`<div class="pagehead"><div class="field" style="margin:0;flex:1;max-width:340px"><input type="text" id="q" placeholder="Cari judul atau kategori" aria-label="Cari"></div>
    ${isStaff()?'<a class="btn teal" href="#/kelola">Kelola konten</a>':''}</div>
    ${items.length?`<div class="items" id="il">${items.map(i=>itemCard(i,u.role==='peserta'?u.id:null)).join('')}</div>`:`<div class="empty"><h3>Belum ada ${names[type].toLowerCase()}</h3><p>Admin atau instruktur dapat menambahkannya dari menu Kelola Konten.</p></div>`}`,type);
  const q=$('#q');if(q)q.oninput=()=>{const v=q.value.toLowerCase();$$('#il .item').forEach(a=>a.classList.toggle('hidden',!a.textContent.toLowerCase().includes(v)));};
}
function quizHTML(it,isP){
  return `<form id="qf">${isP?'':'<p class="badge warn" style="margin:12px 0">Mode pratinjau: nilai tidak disimpan</p>'}
  ${it.questions.map((q,i)=>`<div class="q"><h3>${i+1}. ${esc(q.q)}</h3>${q.o.map((o,j)=>`<label><input type="radio" name="q${i}" value="${j}"><span>${esc(o)}</span></label>`).join('')}</div>`).join('')}
  <button class="btn" id="qsubmit" type="submit">Kirim jawaban</button><div class="card hidden" id="qres" style="margin-top:12px"></div></form>`;
}
function itemPage(id){
  const u=me(),it=db.items.find(i=>i.id===id);
  if(!it||(!it.published&&!isStaff()))return shell('Tidak ditemukan','<div class="empty"><h3>Konten tidak ditemukan</h3><a class="btn" href="#/dashboard">Kembali</a></div>','dashboard');
  const p=prog(u.id,it.id),isP=u.role==='peserta';
  let body=`<a href="#/${it.type}" class="small">&larr; Kembali ke ${TYPES[it.type]}</a>
  <div class="card" style="margin:12px 0 18px"><div class="meta" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px"><span class="badge teal">${TYPES[it.type]}</span>${it.category?`<span class="badge">${esc(it.category)}</span>`:''}${it.published?'':'<span class="badge err">Draf</span>'}${p&&p.status==='selesai'?'<span class="badge ok">Selesai</span>':''}</div>
  <h2 style="font-size:24px">${esc(it.title)}</h2><p style="white-space:pre-line;margin:0">${esc(it.description)}</p>
  ${it.duration?`<p class="small muted" style="margin:10px 0 0">Durasi: ${esc(it.duration)}</p>`:''}
  ${(it.checklist||[]).length?`<h3 style="margin:16px 0 6px;font-size:15px">Checklist praktik</h3><ul class="check">${it.checklist.map(c=>`<li>${esc(c)}</li>`).join('')}</ul>`:''}</div>`;
  if(it.source==='link')body+=`<div class="card"><h2>Buka konten</h2><p class="muted small" style="word-break:break-all">${esc(it.url)}</p><a class="btn" href="${esc(it.url)}" target="_blank" rel="noopener">Buka tautan</a></div>`;
  if(it.source==='pdf'){const url=esc(fileUrl(it));body+=`<div class="card"><h2>Dokumen PDF</h2><p class="muted small">${esc(it.fileName||'dokumen.pdf')}</p><iframe class="viewer" src="${url}" title="${esc(it.title)}"></iframe><p style="margin:12px 0 0;display:flex;gap:8px;flex-wrap:wrap"><a class="btn ghost sm" href="${url}" target="_blank" rel="noopener">Buka di tab baru</a><a class="btn ghost sm" href="${url}" download="${esc(it.fileName||'dokumen.pdf')}">Unduh PDF</a></p></div>`;}
  if(it.source==='builtin')body+=quizHTML(it,isP);
  if(isP&&it.source!=='builtin'){
    body+=`<div class="card" style="margin-top:16px"><h2>Status belajar</h2>${p&&p.status==='selesai'?`<p><span class="badge ok">Selesai</span> ${typeof p.score==='number'?'Nilai: <b>'+p.score+'</b>':''}</p>`:''}
    <div class="row" style="align-items:end">${it.type!=='materi'?`<div class="field" style="margin:0"><label for="myscore">Nilai yang Anda peroleh (opsional)</label><input type="number" id="myscore" min="0" max="100" value="${p&&typeof p.score==='number'?p.score:''}"></div>`:'<span></span>'}
    <div><button class="btn teal" id="done">${p&&p.status==='selesai'?'Perbarui status':'Tandai selesai'}</button></div></div></div>`;
  }
  if(isP&&p&&p.feedback)body+=`<div class="card" style="margin-top:16px;border-left:5px solid var(--accent)"><h2>Umpan balik instruktur</h2><p style="margin:0;white-space:pre-line">${esc(p.feedback)}</p></div>`;
  shell(it.title,body,it.type);
  const d=$('#done');
  if(d)d.onclick=async()=>{
    const sv=$('#myscore'),sc=sv&&sv.value!==''?Math.max(0,Math.min(100,Number(sv.value))):undefined;
    d.disabled=true;
    const ok=await run(async()=>{await writeProgress(u.id,it.id,{status:'selesai',score:sc!==undefined?sc:(p&&p.score)});log('Menyelesaikan: '+it.title);},'Status tersimpan.');
    if(ok)itemPage(id);else d.disabled=false;
  };
  const qf=$('#qf');
  if(qf)qf.onsubmit=async e=>{e.preventDefault();
    let ok=0;const ans=[];
    it.questions.forEach((q,i)=>{const c=qf.querySelector(`input[name=q${i}]:checked`);ans.push(c?Number(c.value):-1);if(ans[i]===q.a)ok++;});
    if(ans.includes(-1)&&!confirm('Masih ada pertanyaan yang belum dijawab. Kirim sekarang?'))return;
    const score=Math.round(ok/it.questions.length*100),pass=it.passScore||70;
    if(isP){const old=prog(u.id,it.id)||{};
      const saved=await run(async()=>{await writeProgress(u.id,it.id,{status:score>=pass?'selesai':'proses',score:Math.max(score,typeof old.score==='number'?old.score:0),attempts:(old.attempts||0)+1});log(`Mengerjakan ${it.title} (nilai ${score})`);});
      if(!saved)return;}
    it.questions.forEach((q,i)=>{$$(`input[name=q${i}]`,qf).forEach(r=>{const l=r.closest('label'),v=Number(r.value);r.disabled=true;
      if(v===q.a)l.classList.add('right');else if(v===ans[i])l.classList.add('wrong');});});
    const res=$('#qres');res.classList.remove('hidden');
    res.innerHTML=`<div class="score">${score}</div><p style="margin:0 0 10px"><span class="badge ${score>=pass?'ok':'warn'}">${score>=pass?'Lulus':'Belum lulus'}</span> Benar ${ok} dari ${it.questions.length}. Nilai minimal ${pass}.${isP?'':' <span class="muted">(Pratinjau, nilai tidak disimpan.)</span>'}</p>
      <button type="button" class="btn ghost" id="retry">Ulangi kuis</button>`;
    $('#retry').onclick=()=>itemPage(id);
    $('#qsubmit').classList.add('hidden');res.scrollIntoView({behavior:'smooth'});
  };
}
function nilai(){
  const u=me(),items=db.items.filter(i=>i.published);
  shell('Nilai Saya',`<div class="tablewrap"><table><thead><tr><th>Konten</th><th>Jenis</th><th>Status</th><th>Nilai</th><th>Terakhir</th><th>Umpan balik</th></tr></thead><tbody>
  ${items.map(i=>{const p=prog(u.id,i.id);return `<tr><td><a href="#/item/${i.id}">${esc(i.title)}</a></td><td>${TYPES[i.type]}</td><td>${p?(p.status==='selesai'?'<span class="badge ok">Selesai</span>':'<span class="badge warn">Berjalan</span>'):'<span class="badge">Belum mulai</span>'}</td><td>${p&&typeof p.score==='number'?p.score:'-'}</td><td class="small">${p&&p.date?fmt(p.date):'-'}</td><td class="small">${p&&p.feedback?esc(p.feedback):'-'}</td></tr>`;}).join('')||'<tr><td colspan="6" class="muted">Belum ada konten.</td></tr>'}</tbody></table></div>`,'nilai');
}

/* ===================== KELOLA KONTEN (admin & instruktur) ===================== */
let kFilter='all';
function kelola(){
  const list=db.items.filter(i=>kFilter==='all'||i.type===kFilter),srcName={link:'Tautan',pdf:'File PDF',builtin:'Kuis bawaan'};
  shell('Kelola Konten',`<div class="pagehead"><div class="tabs" style="margin:0">${[['all','Semua'],['materi','Materi'],['kuis','Kuis'],['assessment','Assessment']].map(t=>`<button data-f="${t[0]}" class="${kFilter===t[0]?'on':''}">${t[1]}</button>`).join('')}</div>
    <button class="btn teal" id="add">+ Tambah konten</button></div>
    ${list.length?`<div class="tablewrap"><table><thead><tr><th>Judul</th><th>Jenis</th><th>Sumber</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
    ${list.map(i=>`<tr><td><a href="#/item/${i.id}"><b>${esc(i.title)}</b></a><div class="small muted">${esc(i.category||'')}</div></td><td><span class="badge teal">${TYPES[i.type]}</span></td><td>${srcName[i.source]}</td>
      <td>${i.published?'<span class="badge ok">Terbit</span>':'<span class="badge warn">Draf</span>'}</td>
      <td><div class="acts"><button class="btn ghost sm" data-edit="${i.id}">Edit</button><button class="btn ghost sm" data-pub="${i.id}">${i.published?'Sembunyikan':'Terbitkan'}</button><button class="btn danger sm" data-del="${i.id}">Hapus</button></div></td></tr>`).join('')}</tbody></table></div>`
    :'<div class="empty"><h3>Belum ada konten</h3><p>Tambahkan materi, kuis, atau assessment lewat tautan atau file PDF.</p></div>'}`,'kelola');
  $$('[data-f]').forEach(b=>b.onclick=()=>{kFilter=b.dataset.f;kelola();});
  $('#add').onclick=()=>itemForm();
  $$('[data-edit]').forEach(b=>b.onclick=()=>itemForm(b.dataset.edit));
  $$('[data-pub]').forEach(b=>b.onclick=async()=>{const i=db.items.find(x=>x.id===b.dataset.pub),np=!i.published;
    if(await run(()=>must(sb.from('items').update({published:np,updated_at:new Date().toISOString()}).eq('id',i.id)).then(()=>{i.published=np;log((np?'Menerbitkan: ':'Menyembunyikan: ')+i.title);}),np?'Konten diterbitkan.':'Konten disembunyikan.'))kelola();});
  $$('[data-del]').forEach(b=>b.onclick=async()=>{const i=db.items.find(x=>x.id===b.dataset.del);
    if(!confirm('Hapus "'+i.title+'"? Data progres peserta untuk konten ini ikut terhapus.'))return;
    if(await run(async()=>{await must(sb.from('items').delete().eq('id',i.id));await removeFile(i.filePath);
      db.items=db.items.filter(x=>x.id!==i.id);Object.keys(db.progress).forEach(k=>{if(k.endsWith('|'+i.id))delete db.progress[k];});log('Menghapus: '+i.title);},'Konten dihapus.'))kelola();});
}
function itemForm(id){
  const it=id?db.items.find(i=>i.id===id):null;
  const v={type:'materi',source:'link',published:true,passScore:70,questions:[],...(it||{})};
  let qs=JSON.parse(JSON.stringify(v.questions||[]));
  const body=`<form id="itf" onsubmit="return false"><div class="field"><label>Jenis konten</label><div class="radios" id="r-type">${Object.keys(TYPES).map(k=>`<label><input type="radio" name="type" value="${k}" ${v.type===k?'checked':''}><span>${TYPES[k]}</span></label>`).join('')}</div></div>
  <div class="field"><label for="f-title">Judul</label><input type="text" id="f-title" value="${esc(v.title||'')}" required></div>
  <div class="row"><div class="field"><label for="f-cat">Kategori</label><input type="text" id="f-cat" list="catlist" value="${esc(v.category||'')}" placeholder="Contoh: Optimasi Profil"><datalist id="catlist">${[...new Set(db.items.map(i=>i.category).filter(Boolean))].map(c=>`<option value="${esc(c)}">`).join('')}</datalist></div>
  <div class="field"><label for="f-pub">Status</label><select id="f-pub"><option value="1" ${v.published?'selected':''}>Terbit (terlihat semua pengunjung)</option><option value="0" ${v.published?'':'selected'}>Draf (hanya staf)</option></select></div></div>
  <div class="field"><label for="f-desc">Deskripsi</label><textarea id="f-desc">${esc(v.description||'')}</textarea></div>
  <div class="field" id="w-cl"><label for="f-cl">Checklist praktik (satu poin per baris)</label><textarea id="f-cl" style="min-height:110px">${esc((v.checklist||[]).join('\n'))}</textarea></div>
  <div class="field" id="w-dur" style="max-width:260px"><label for="f-dur">Durasi pengerjaan</label><input type="text" id="f-dur" value="${esc(v.duration||'')}" placeholder="Contoh: 15 Menit"></div>
  <div class="field"><label>Sumber konten</label><div class="radios" id="r-src">
    <label><input type="radio" name="source" value="link" ${v.source==='link'?'checked':''}><span>Tautan</span></label>
    <label><input type="radio" name="source" value="pdf" ${v.source==='pdf'?'checked':''}><span>Unggah PDF</span></label>
    <label id="lb-builtin"><input type="radio" name="source" value="builtin" ${v.source==='builtin'?'checked':''}><span>Soal pilihan ganda bawaan</span></label></div></div>
  <div class="field" id="s-link"><label for="f-url">Tautan (Google Drive, YouTube, Google Form, dll.)</label><input type="url" id="f-url" value="${esc(v.url||'')}" placeholder="https://"></div>
  <div class="field" id="s-pdf"><label for="f-pdf">File PDF</label><input type="file" id="f-pdf" accept="application/pdf,.pdf">${v.fileName?`<div class="hint">File saat ini: ${esc(v.fileName)}. Pilih file baru untuk menggantinya.</div>`:''}<div class="hint">Disimpan di Supabase Storage dan terlihat semua pengunjung. Maksimal 30 MB.</div></div>
  <div id="s-built"><div class="field" style="max-width:220px"><label for="f-pass">Nilai minimal lulus</label><input type="number" id="f-pass" min="0" max="100" value="${v.passScore||70}"></div><div id="qlist"></div><button type="button" class="btn ghost sm" id="addq">+ Tambah pertanyaan</button></div></form>`;
  const m=openModal(it?'Edit konten':'Tambah konten',body,'<button class="btn ghost" data-close>Batal</button><button class="btn" id="save">Simpan</button>');
  const radio=n=>$(`input[name=${n}]:checked`,m).value;
  function sync(){
    const t=radio('type');let s=radio('source');
    $('#lb-builtin').classList.toggle('hidden',t==='materi');
    $('#w-cl').classList.toggle('hidden',t!=='materi');$('#w-dur').classList.toggle('hidden',t==='materi');
    if(t==='materi'&&s==='builtin'){$('input[name=source][value=link]',m).checked=true;s='link';}
    $('#s-link').classList.toggle('hidden',s!=='link');$('#s-pdf').classList.toggle('hidden',s!=='pdf');$('#s-built').classList.toggle('hidden',s!=='builtin');
    if(s==='builtin'&&!qs.length){qs.push({q:'',o:['','','',''],a:0});drawQ();}
  }
  function drawQ(){
    $('#qlist').innerHTML=qs.map((q,i)=>`<div class="qb"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b>Pertanyaan ${i+1}</b><button type="button" class="btn danger sm" data-rq="${i}">Hapus</button></div>
      <textarea data-q="${i}" style="min-height:60px;margin-top:6px" placeholder="Tulis pertanyaan">${esc(q.q)}</textarea>
      <div class="opts">${[0,1,2,3].map(j=>`<input type="text" data-o="${i}.${j}" value="${esc(q.o[j]||'')}" placeholder="Pilihan ${String.fromCharCode(65+j)}">`).join('')}</div>
      <label>Jawaban benar <select data-a="${i}" style="max-width:160px;display:inline-block">${[0,1,2,3].map(j=>`<option value="${j}" ${q.a===j?'selected':''}>${String.fromCharCode(65+j)}</option>`).join('')}</select></label></div>`).join('')||'<p class="muted small">Belum ada pertanyaan.</p>';
    $$('[data-q]',m).forEach(e=>e.oninput=()=>qs[e.dataset.q].q=e.value);
    $$('[data-o]',m).forEach(e=>e.oninput=()=>{const[a,b]=e.dataset.o.split('.');qs[a].o[b]=e.value;});
    $$('[data-a]',m).forEach(e=>e.onchange=()=>qs[e.dataset.a].a=Number(e.value));
    $$('[data-rq]',m).forEach(e=>e.onclick=()=>{qs.splice(Number(e.dataset.rq),1);drawQ();});
  }
  $$('#r-type input,#r-src input',m).forEach(r=>r.onchange=sync);
  $('#addq').onclick=()=>{qs.push({q:'',o:['','','',''],a:0});drawQ();};
  drawQ();sync();
  $('#save').onclick=async()=>{
    const btn=$('#save'),type=radio('type'),source=radio('source'),title=$('#f-title').value.trim();
    if(!title)return toast('Judul wajib diisi.','err');
    const o={id:it?it.id:'i'+uid(),type,title,category:$('#f-cat').value.trim(),description:$('#f-desc').value.trim(),source,published:$('#f-pub').value==='1',
      sortOrder:it?it.sortOrder:(db.items.reduce((a,x)=>Math.max(a,x.sortOrder||0),0)+1),createdBy:it?it.createdBy:me().name};
    if(type==='materi')o.checklist=$('#f-cl').value.split('\n').map(x=>x.trim()).filter(Boolean);else o.duration=$('#f-dur').value.trim();
    let newFile=null;
    if(source==='link'){const u=$('#f-url').value.trim();if(!/^https?:\/\//i.test(u))return toast('Tautan harus diawali http:// atau https://','err');o.url=u;}
    if(source==='pdf'){
      const f=$('#f-pdf').files[0];
      if(f){if(!/pdf$/i.test(f.type)&&!/\.pdf$/i.test(f.name))return toast('File harus berformat PDF.','err');
        if(f.size>30*1024*1024)return toast('File terlalu besar (maks 30 MB).','err');
        newFile=f;o.fileName=f.name;o.filePath='pdf/'+o.id+'-'+Date.now()+'.pdf';}
      else if(it&&it.filePath){o.filePath=it.filePath;o.fileName=it.fileName;}
      else return toast('Pilih file PDF terlebih dahulu.','err');
    }
    if(source==='builtin'){
      const out=[];
      for(let i=0;i<qs.length;i++){const q=qs[i];
        if(!q.q.trim())return toast(`Pertanyaan ${i+1} masih kosong.`,'err');
        const opts=q.o.map((t,j)=>({t:t.trim(),j})).filter(x=>x.t);
        if(opts.length<2)return toast(`Pertanyaan ${i+1} butuh minimal 2 pilihan.`,'err');
        const k=opts.findIndex(x=>x.j===q.a);if(k<0)return toast(`Jawaban benar pertanyaan ${i+1} menunjuk pilihan yang kosong.`,'err');
        out.push({q:q.q.trim(),o:opts.map(x=>x.t),a:k});}
      if(!out.length)return toast('Tambahkan minimal satu pertanyaan.','err');
      o.questions=out;o.passScore=Math.max(0,Math.min(100,Number($('#f-pass').value)||70));
    }
    btn.disabled=true;btn.textContent=newFile?'Mengunggah…':'Menyimpan…';
    const ok=await run(async()=>{
      if(newFile)await uploadFile(o.filePath,newFile);
      try{await must(sb.from('items').upsert(toRow(o),{onConflict:'id'}));}
      catch(e){if(newFile)await removeFile(o.filePath);throw e;}
      if(it&&it.filePath&&it.filePath!==o.filePath)await removeFile(it.filePath);
      const idx=db.items.findIndex(x=>x.id===o.id);if(idx>=0)db.items[idx]=o;else db.items.push(o);
      log((it?'Mengubah: ':'Menambah: ')+title);
    },'Konten tersimpan dan langsung terlihat semua pengunjung.');
    if(ok){closeModal();kelola();}else{btn.disabled=false;btn.textContent='Simpan';}
  };
}

/* ===================== PESERTA, PENILAIAN, CATATAN ===================== */
function pesertaPage(id){
  const ps=db.users.filter(x=>x.role==='peserta');
  if(!id){
    return shell('Peserta',`<div class="tablewrap"><table><thead><tr><th>Peserta</th><th>Status akun</th><th style="width:26%">Progres</th><th>Selesai</th><th>Rata-rata nilai</th><th></th></tr></thead><tbody>
    ${ps.map(x=>{const s=stats(x.id);return `<tr><td><b>${esc(x.name)}</b><div class="small muted">@${esc(x.username)}</div></td><td>${x.active?'<span class="badge ok">Aktif</span>':'<span class="badge err">Nonaktif</span>'}</td><td><div class="bar"><i style="width:${s.pct}%"></i></div><span class="small muted">${s.pct}%</span></td><td>${s.done}/${s.total}</td><td>${s.avg===null?'-':s.avg}</td><td><a class="btn ghost sm" href="#/peserta/${x.id}">Detail</a></td></tr>`;}).join('')||'<tr><td colspan="6" class="muted">Belum ada peserta.</td></tr>'}</tbody></table></div>`,'peserta');
  }
  const x=ps.find(z=>z.id===id);
  if(!x)return shell('Peserta','<div class="empty">Peserta tidak ditemukan. <a href="#/peserta">Kembali</a></div>','peserta');
  const s=stats(x.id),items=db.items.filter(i=>i.published),notes=db.notes.filter(n=>n.participantId===x.id);
  shell('Detail peserta',`<a href="#/peserta" class="small">&larr; Semua peserta</a>
  <div class="welcome" style="margin-top:12px"><div><h2>${esc(x.name)}</h2><p>Progres ${s.pct}% &middot; ${s.done}/${s.total} selesai &middot; rata-rata nilai ${s.avg===null?'-':s.avg}</p></div></div>
  <div class="pagehead"><h2>Penilaian per konten</h2></div><div class="tablewrap"><table><thead><tr><th>Konten</th><th>Status</th><th style="width:110px">Nilai</th><th>Umpan balik</th><th></th></tr></thead><tbody>
  ${items.map(i=>{const p=prog(x.id,i.id)||{};return `<tr><td>${esc(i.title)}<div class="small muted">${TYPES[i.type]}</div></td><td>${p.status==='selesai'?'<span class="badge ok">Selesai</span>':p.status?'<span class="badge warn">Berjalan</span>':'<span class="badge">Belum</span>'}</td>
    <td><input type="number" min="0" max="100" data-sc="${i.id}" value="${typeof p.score==='number'?p.score:''}" aria-label="Nilai ${esc(i.title)}"></td>
    <td><input type="text" data-fb="${i.id}" value="${esc(p.feedback||'')}" placeholder="Tulis umpan balik" aria-label="Umpan balik ${esc(i.title)}"></td>
    <td><button class="btn sm" data-save="${i.id}">Simpan</button></td></tr>`;}).join('')}</tbody></table></div>
  <div class="pagehead" style="margin-top:26px"><h2>Catatan mentoring</h2></div>
  <div class="card" style="margin-bottom:12px"><div class="field"><label for="nt">Tambah catatan (terlihat oleh peserta)</label><textarea id="nt" placeholder="Tulis saran, target, atau tindak lanjut"></textarea></div><button class="btn teal" id="addnote">Simpan catatan</button></div>
  <div class="grid">${notes.map(n=>`<div class="card"><p style="margin:0 0 6px;white-space:pre-line">${esc(n.text)}</p><span class="small muted">${esc(n.by)} &middot; ${fmt(n.t)}</span> <button class="btn danger sm" data-dn="${n.id}" style="margin-left:8px">Hapus</button></div>`).join('')||'<div class="empty">Belum ada catatan.</div>'}</div>`,'peserta');
  $$('[data-save]').forEach(b=>b.onclick=async()=>{const i=b.dataset.save,sc=$(`[data-sc="${i}"]`).value,fb=$(`[data-fb="${i}"]`).value.trim(),old=prog(x.id,i)||{};
    if(await run(async()=>{await writeProgress(x.id,i,{status:old.status||'selesai',score:sc===''?undefined:Math.max(0,Math.min(100,Number(sc))),feedback:fb,gradedBy:me().name});log('Menilai '+x.name);},'Penilaian tersimpan.'))pesertaPage(id);});
  $('#addnote').onclick=async()=>{const t=$('#nt').value.trim();if(!t)return toast('Catatan masih kosong.','err');
    if(await run(async()=>{const by=me().name+' ('+ROLES[me().role]+')';
      const r=await must(sb.from('notes').insert({participant_id:x.id,text:t,by_name:by}).select().single());
      db.notes.unshift({id:r.id,participantId:x.id,text:t,by,t:Date.now()});log('Menambah catatan untuk '+x.name);},'Catatan tersimpan.'))pesertaPage(id);};
  $$('[data-dn]').forEach(b=>b.onclick=async()=>{if(await run(async()=>{await must(sb.from('notes').delete().eq('id',b.dataset.dn));db.notes=db.notes.filter(n=>n.id!==b.dataset.dn);}))pesertaPage(id);});
}

/* ===================== PENGGUNA ===================== */
function pengguna(){
  const canEdit=isRole('admin');
  shell('Akun Pengguna',`<div class="pagehead"><p class="muted" style="margin:0">${canEdit?'Atur nama, peran, dan status akun. Akun baru dibuat di Supabase.':'Daftar akun (hanya lihat). Perubahan peran dilakukan oleh Admin.'}</p><button class="btn teal" id="addu">+ Tambah pengguna</button></div>
  <div class="tablewrap"><table><thead><tr><th>Nama</th><th>Nama pengguna</th><th>Peran</th><th>Status</th>${canEdit?'<th>Aksi</th>':''}</tr></thead><tbody>
  ${db.users.map(u=>`<tr><td><b>${esc(u.name)}</b></td><td>${esc(u.username)}</td><td><span class="badge teal">${ROLES[u.role]}</span></td><td>${u.active?'<span class="badge ok">Aktif</span>':'<span class="badge err">Nonaktif</span>'}</td>
  ${canEdit?`<td><button class="btn ghost sm" data-eu="${u.id}">Edit</button></td>`:''}</tr>`).join('')}</tbody></table></div>`,'pengguna');
  $('#addu').onclick=()=>openModal('Cara menambah pengguna',`<ol style="padding-left:1.2em;display:grid;gap:8px"><li>Buka Supabase &gt; <b>Authentication &gt; Users &gt; Add user &gt; Create new user</b>.</li>
    <li>Isi email <code>namapengguna@${esc(EMAIL_DOMAIN)}</code> dan kata sandi (minimal 6 karakter), lalu centang <b>Auto Confirm User</b>.</li>
    <li>Profil otomatis dibuat sebagai <b>Peserta</b>. Admin dapat mengubah nama dan peran di halaman ini (muat ulang bila belum muncul).</li>
    <li>Pengguna masuk memakai <code>namapengguna</code> saja atau email lengkap.</li></ol><p class="muted small">Akun dibuat lewat dashboard Supabase karena membuat akun dari browser membutuhkan kunci rahasia (service role) yang tidak boleh ada di website.</p>`,'<button class="btn" data-close>Mengerti</button>');
  $$('[data-eu]').forEach(b=>b.onclick=()=>userForm(b.dataset.eu));
}
function userForm(id){
  const u=db.users.find(x=>x.id===id);
  openModal('Edit pengguna',`<div class="field"><label for="u-name">Nama lengkap</label><input type="text" id="u-name" value="${esc(u.name)}"></div>
  <div class="row"><div class="field"><label>Nama pengguna</label><input type="text" value="${esc(u.username)}" disabled></div>
  <div class="field"><label for="u-role">Peran</label><select id="u-role">${Object.keys(ROLES).map(r=>`<option value="${r}" ${u.role===r?'selected':''}>${ROLES[r]}</option>`).join('')}</select></div></div>
  <div class="field"><label><input type="checkbox" id="u-act" ${u.active?'checked':''}> Akun aktif</label></div>`,'<button class="btn ghost" data-close>Batal</button><button class="btn" id="usave">Simpan</button>');
  $('#usave').onclick=async()=>{
    const name=$('#u-name').value.trim(),role=$('#u-role').value,act=$('#u-act').checked;
    if(!name)return toast('Nama wajib diisi.','err');
    if(u.role==='admin'&&(role!=='admin'||!act)&&db.users.filter(x=>x.role==='admin'&&x.active).length<2)return toast('Minimal harus ada satu admin aktif.','err');
    if(u.id===me().id&&(!act||role!==u.role))return toast('Anda tidak bisa mengubah peran atau menonaktifkan akun sendiri.','err');
    if(await run(async()=>{await must(sb.from('profiles').update({full_name:name,role,active:act}).eq('id',u.id));Object.assign(u,{name,role,active:act});log('Mengubah akun '+u.username);},'Akun tersimpan.')){closeModal();pengguna();}
  };
}

/* ===================== PENGATURAN WEBSITE (admin) ===================== */
function processImage(file,max){return new Promise((res,rej)=>{
  if(!/^image\//.test(file.type))return rej(new Error('File harus berupa gambar.'));
  if(file.type==='image/svg+xml'){if(file.size>400*1024)return rej(new Error('SVG terlalu besar (maks 400 KB).'));return res(file);}
  const img=new Image(),u=URL.createObjectURL(file);
  img.onload=()=>{const k=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');
    c.width=Math.max(1,Math.round(img.width*k));c.height=Math.max(1,Math.round(img.height*k));c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(u);
    c.toBlob(b=>b?res(b):rej(new Error('Gagal memproses gambar.')),file.type==='image/jpeg'?'image/jpeg':'image/png',.92);};
  img.onerror=()=>rej(new Error('Gambar tidak dapat dibaca.'));img.src=u;});}
const EXT={'image/png':'png','image/jpeg':'jpg','image/svg+xml':'svg'};
function settingsTabs(active){return `<div class="tabs"><a href="#/pengaturan" class="${active==='info'?'on':''}">Informasi Website</a><a href="#/pengaturan/tampilan" class="${active==='ui'?'on':''}">Tampilan &amp; UI/UX</a></div>`;}
function pengaturan(arg){return arg==='tampilan'?tampilanTab():infoTab();}
function infoTab(){
  const s=db.settings;
  shell('Pengaturan Website',settingsTabs('info')+`<p class="muted" style="margin-top:0">Perubahan disimpan ke database cloud dan langsung terlihat oleh semua pengunjung.</p>
  <form id="sf" class="grid g2" style="align-items:start">
  <div class="card"><h2>Identitas dan kontak</h2>
    <div class="field"><label for="s-name">Nama website</label><input type="text" id="s-name" value="${esc(s.siteName)}" required></div>
    <div class="field"><label for="s-tag">Slogan</label><input type="text" id="s-tag" value="${esc(s.tagline)}"></div>
    <div class="row"><div class="field"><label for="s-mail">Email</label><input type="email" id="s-mail" value="${esc(s.email)}"></div><div class="field"><label for="s-tel">Telepon</label><input type="text" id="s-tel" value="${esc(s.phone)}"></div></div>
    <div class="field"><label for="s-wa">Nomor WhatsApp</label><input type="text" id="s-wa" value="${esc(s.whatsapp)}" placeholder="628123456789"><div class="hint">Format internasional tanpa tanda plus, contoh 6281234567890.</div></div>
    <div class="field"><label for="s-addr">Alamat</label><input type="text" id="s-addr" value="${esc(s.address)}"></div></div>
  <div class="card"><h2>Profil organisasi</h2><div class="field"><label for="s-prof">Teks profil (tampil di beranda)</label><textarea id="s-prof" style="min-height:230px">${esc(s.profile)}</textarea></div></div>
  <div class="card" style="grid-column:1/-1"><h2>Beranda dan pendaftaran</h2>
    <div class="field"><label for="s-hero">Deskripsi beranda</label><textarea id="s-hero">${esc(s.heroDesc||'')}</textarea></div>
    <div class="row"><div class="field"><label for="s-rt">Judul pendaftaran</label><input type="text" id="s-rt" value="${esc(s.registrationTitle||'')}"></div><div class="field"><label for="s-rb">Teks tombol pendaftaran</label><input type="text" id="s-rb" value="${esc(s.registrationBtnLabel||'')}"></div></div>
    <div class="field"><label for="s-ru">Tautan Google Form pendaftaran</label><input type="url" id="s-ru" value="${esc(s.registrationUrl||'')}" placeholder="https://docs.google.com/forms/..."></div>
    <div class="field"><label for="s-rd">Deskripsi pendaftaran</label><textarea id="s-rd">${esc(s.registrationDesc||'')}</textarea></div></div>
  <div style="grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap"><button class="btn" type="submit" id="ssave">Simpan pengaturan</button><a class="btn ghost" href="#/" target="_blank">Lihat beranda</a></div></form>`,'pengaturan');
  $('#sf').onsubmit=async e=>{e.preventDefault();
    const name=$('#s-name').value.trim();if(!name)return toast('Nama website wajib diisi.','err');
    const c={siteName:name,tagline:$('#s-tag').value.trim(),email:$('#s-mail').value.trim(),phone:$('#s-tel').value.trim(),whatsapp:$('#s-wa').value.trim(),address:$('#s-addr').value.trim(),profile:$('#s-prof').value.trim(),
      heroDesc:$('#s-hero').value.trim(),registrationTitle:$('#s-rt').value.trim(),registrationBtnLabel:$('#s-rb').value.trim(),registrationUrl:$('#s-ru').value.trim(),registrationDesc:$('#s-rd').value.trim()};
    const b=$('#ssave');b.disabled=true;
    if(await run(async()=>{await saveContent(c);log('Memperbarui informasi website');},'Pengaturan tersimpan dan tersinkron ke semua pengunjung.'))infoTab();else b.disabled=false;};
}

function tampilanTab(initial){
  let d=mergeTheme(initial||JSON.parse(JSON.stringify(db.theme)));
  const pend={logo:undefined,favicon:undefined};
  const COLORS=[['primary','Primary (tombol dan tautan)'],['secondary','Secondary (aksen dan badge)'],['accent','Aksen (tombol sorot)'],['dark','Warna gelap (sidebar dan hero)'],['bg','Background halaman'],['surface','Kartu dan panel'],['text','Warna teks']];
  const SECS=[['hero','Hero (bagian atas)'],['pendaftaran','Pendaftaran'],['materi','Modul Pemasaran'],['kuis','Kuis & Assessment'],['profil','Profil & Kontak']];
  const fontOpts=(sel,blank)=>(blank?`<option value="" ${sel===''?'selected':''}>Sama dengan font utama</option>`:'')+FONTS.map(f=>`<option value="${esc(f[0])}" ${sel===f[0]?'selected':''}>${esc(f[0])}</option>`).join('');
  const radioG=(name,opts,cur)=>`<div class="radios" data-g="${name}">${opts.map(o=>`<label><input type="radio" name="${name}" value="${o[0]}" ${cur===o[0]?'checked':''}><span>${o[1]}</span></label>`).join('')}</div>`;
  shell('Pengaturan Website',settingsTabs('ui')+`<p class="muted" style="margin-top:0">Perubahan tampil langsung sebagai pratinjau di halaman ini. Klik <b>Simpan tampilan</b> agar berlaku untuk semua pengunjung.</p>
  <div class="grid" style="gap:18px">
  <div class="card"><h2>Skema warna</h2>
    <div class="presets">${Object.keys(PRESETS).map(n=>`<button type="button" class="preset" data-preset="${esc(n)}"><i>${['primary','secondary','accent'].map(k=>`<b style="background:${PRESETS[n][k]}"></b>`).join('')}</i>${esc(n)}</button>`).join('')}</div>
    <div class="cgrid">${COLORS.map(c=>`<div class="colorf"><label>${c[1]}</label><div class="cinput"><input type="color" data-ck="${c[0]}" value="${d[c[0]]}" aria-label="${c[1]}"><input type="text" data-ct="${c[0]}" value="${d[c[0]]}" maxlength="7" aria-label="Kode ${c[1]}"></div></div>`).join('')}</div>
    <div class="warnbox hidden" id="warn" role="status"></div></div>
  <div class="card"><h2>Tipografi dan ukuran</h2><div class="row"><div class="field"><label for="t-font">Font utama (Google Fonts)</label><select id="t-font">${fontOpts(d.font,false)}</select></div>
    <div class="field"><label for="t-head">Font judul</label><select id="t-head">${fontOpts(d.headingFont,true)}</select></div></div>
    <div class="field" style="max-width:420px"><label for="t-fs">Ukuran font dasar: <b id="t-fsv">${Math.round(d.fontScale*100)}%</b></label><input type="range" id="t-fs" min="0.85" max="1.25" step="0.05" value="${d.fontScale}"></div></div>
  <div class="card"><h2>Layout dan komponen</h2>
    <div class="field"><label>Bentuk sudut komponen</label>${radioG('radius',[['sharp','Kotak'],['medium','Melengkung sedang'],['round','Bulat']],d.radius)}</div>
    <div class="field"><label>Gaya header / navbar</label>${radioG('nav',[['light','Terang'],['dark','Gelap'],['primary','Warna primary']],d.nav)}</div>
    <div class="field"><label><input type="checkbox" id="t-sticky" ${d.navSticky?'checked':''}> Navbar tetap di atas saat halaman digulir</label></div>
    <div class="field"><label><input type="checkbox" id="t-anim" ${d.animations!==false?'checked':''}> Aktifkan animasi dan transisi antar halaman</label></div>
    <div class="field" style="margin-bottom:0"><label>Section yang tampil di beranda</label><div class="checks">${SECS.map(s=>`<label><input type="checkbox" data-sec="${s[0]}" ${d.sections[s[0]]?'checked':''}> ${s[1]}</label>`).join('')}</div></div></div>
  <div class="card"><h2>Branding</h2>
    <div class="field"><label for="b-title">Judul website (tab browser)</label><input type="text" id="b-title" value="${esc(d.branding.siteTitle)}" placeholder="${esc(db.settings.siteName)}"><div class="hint">Kosongkan untuk memakai nama website.</div></div>
    <div class="grid g2"><div><label>Logo website</label><div class="logoprev"><img id="lp" src="${esc(logoSrc())}" alt="Logo"><div><input type="file" id="b-logo" accept="image/png,image/jpeg,image/svg+xml"><div class="hint">PNG transparan paling baik. Otomatis diperkecil.</div><button type="button" class="btn ghost sm" id="logo-reset" style="margin-top:8px">Pakai logo bawaan</button></div></div></div>
    <div><label>Favicon (ikon tab browser)</label><div class="logoprev"><img id="fp" class="fav-prev" src="${esc(d.branding.faviconUrl||d.branding.logoUrl||'assets/favicon.png')}" alt="Favicon"><div><input type="file" id="b-fav" accept="image/png,image/jpeg,image/svg+xml"><div class="hint">Gambar persegi, minimal 64 px.</div><button type="button" class="btn ghost sm" id="fav-reset" style="margin-top:8px">Pakai favicon bawaan</button></div></div></div></div></div>
  </div>
  <div class="savebar"><button class="btn" id="tsave">Simpan tampilan</button><button class="btn ghost" id="tdef" type="button">Kembalikan ke bawaan</button><button class="btn ghost" id="tcancel" type="button">Batalkan perubahan</button></div>`,'pengaturan');
  const prev=()=>{applyTheme(d,false);warn();};
  function warn(){
    const w=[];
    if(ratio(d.text,d.bg)<4.5)w.push('Teks kurang kontras dengan background halaman.');
    if(ratio(d.text,d.surface)<4.5)w.push('Teks kurang kontras dengan warna kartu.');
    if(ratio('#FFFFFF',d.dark)<4.5)w.push('Warna gelap terlalu terang untuk teks putih di sidebar dan hero.');
    if(ratio(d.primary,d.surface)<3)w.push('Warna primary kurang kontras terhadap warna kartu.');
    const b=$('#warn');b.classList.toggle('hidden',!w.length);b.innerHTML=w.map(esc).join('<br>');
  }
  const setColor=(k,v)=>{d[k]=v.toUpperCase();$(`[data-ck="${k}"]`).value=d[k];$(`[data-ct="${k}"]`).value=d[k];};
  $$('[data-ck]').forEach(i=>i.oninput=()=>{setColor(i.dataset.ck,i.value);prev();});
  $$('[data-ct]').forEach(i=>i.oninput=()=>{let v=i.value.trim();if(v&&v[0]!=='#')v='#'+v;if(HEX.test(v)){setColor(i.dataset.ct,v);prev();}});
  $$('[data-preset]').forEach(b=>b.onclick=()=>{Object.entries(PRESETS[b.dataset.preset]).forEach(([k,v])=>setColor(k,v));prev();});
  $('#t-font').onchange=e=>{d.font=e.target.value;prev();};
  $('#t-head').onchange=e=>{d.headingFont=e.target.value;prev();};
  $('#t-fs').oninput=e=>{d.fontScale=Number(e.target.value);$('#t-fsv').textContent=Math.round(d.fontScale*100)+'%';prev();};
  $$('input[name=radius]').forEach(r=>r.onchange=()=>{d.radius=r.value;prev();});
  $$('input[name=nav]').forEach(r=>r.onchange=()=>{d.nav=r.value;prev();});
  $('#t-sticky').onchange=e=>{d.navSticky=e.target.checked;prev();};
  $('#t-anim').onchange=e=>{d.animations=e.target.checked;prev();};
  $$('[data-sec]').forEach(c=>c.onchange=()=>{d.sections[c.dataset.sec]=c.checked;});
  $('#b-title').oninput=e=>{d.branding.siteTitle=e.target.value.trim();};
  const pickImg=(inp,key,max,img)=>{inp.onchange=async()=>{const f=inp.files[0];if(!f)return;
    try{const blob=await processImage(f,max);pend[key]={blob,url:URL.createObjectURL(blob)};img.src=pend[key].url;}catch(e){toast(e.message,'err');inp.value='';}};};
  pickImg($('#b-logo'),'logo',700,$('#lp'));pickImg($('#b-fav'),'favicon',128,$('#fp'));
  $('#logo-reset').onclick=()=>{pend.logo='reset';$('#b-logo').value='';$('#lp').src='assets/logo.png';};
  $('#fav-reset').onclick=()=>{pend.favicon='reset';$('#b-fav').value='';$('#fp').src='assets/favicon.png';};
  $('#tdef').onclick=()=>{tampilanTab(mergeTheme({branding:d.branding}));toast('Nilai bawaan dimuat sebagai pratinjau. Klik Simpan tampilan untuk menerapkan.');};
  $('#tcancel').onclick=()=>route();
  $('#tsave').onclick=async()=>{
    const btn=$('#tsave');btn.disabled=true;btn.textContent='Menyimpan…';
    const ok=await run(async()=>{
      const b={...d.branding},oldPaths=[];
      for(const [k,field,pathKey,urlKey,name] of [['logo','logo','logoPath','logoUrl','logo'],['favicon','favicon','faviconPath','faviconUrl','favicon']]){
        const p=pend[k];if(p===undefined)continue;
        if(p==='reset'){if(b[pathKey])oldPaths.push(b[pathKey]);b[pathKey]='';b[urlKey]='';continue;}
        const path=`branding/${name}-${Date.now()}.${EXT[p.blob.type]||'png'}`;
        b[urlKey]=await uploadFile(path,p.blob);if(b[pathKey])oldPaths.push(b[pathKey]);b[pathKey]=path;
      }
      const nt={...d,branding:b};
      await saveTheme(nt);for(const op of oldPaths)await removeFile(op);
      log('Memperbarui tampilan dan UI/UX');
    },'Tampilan tersimpan dan langsung berlaku untuk semua pengunjung.');
    if(ok){applyTheme(db.theme);applyBrand();tampilanTab();}else{btn.disabled=false;btn.textContent='Simpan tampilan';}
  };
  if(initial)applyTheme(d,false);
  warn();
}

/* ===================== SISTEM & LOG ===================== */
async function sistem(){
  const t0=performance.now();let up=true;
  try{await must(sb.from('site_settings').select('id').limit(1));}catch(e){up=false;}
  const ms=Math.round(performance.now()-t0);
  let host='';try{host=new URL(SUPABASE_URL).host;}catch(e){}
  shell('Sistem dan Log',statCards([[db.users.length,'Akun'],[db.items.length,'Konten'],[Object.keys(db.progress).length,'Catatan progres'],[db.logs.length,'Entri log dimuat']])+
  `<div class="grid g2"><div class="card"><h2>Koneksi database</h2><p style="margin:0 0 6px"><span class="badge ${up?'ok':'err'}">${up?'Terhubung':'Gagal terhubung'}</span> ${up?ms+' ms':''}</p><p class="muted small" style="margin:0">Proyek: ${esc(host)}</p><p class="muted small">Realtime aktif untuk tabel konten, pengaturan, progres, dan catatan.</p></div>
  <div class="card"><h2>Backup data</h2><p class="muted small">Unduh salinan JSON berisi pengaturan, tema, konten, dan daftar akun. Untuk backup penuh termasuk file, gunakan fitur backup Supabase.</p><button class="btn" id="bk">Unduh backup (JSON)</button></div></div>
  <div class="card" style="margin-top:16px"><h2>Log aktivitas</h2>${logList(80)}</div>`,'sistem');
  $('#bk').onclick=()=>{const blob=new Blob([JSON.stringify({app:'ikb-lms',exportedAt:new Date().toISOString(),settings:db.settings,theme:db.theme,items:db.items,profiles:db.users},null,2)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='backup-ikb-learning-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);log('Mengunduh backup');};
}

/* ===================== PROFIL ===================== */
function profil(){
  const u=me();
  shell('Profil Saya',`<div class="card" style="max-width:520px"><form id="pf"><div class="field"><label for="p-name">Nama lengkap</label><input type="text" id="p-name" value="${esc(u.name)}" required></div>
  <div class="field"><label>Nama pengguna</label><input type="text" value="${esc(u.username)}" disabled></div>
  <div class="field"><label>Peran</label><input type="text" value="${ROLES[u.role]}" disabled></div>
  <div class="field"><label for="p-pw">Kata sandi baru</label><input type="password" id="p-pw" autocomplete="new-password" placeholder="Kosongkan bila tidak diubah"><div class="hint">Minimal 6 karakter.</div></div>
  <button class="btn" type="submit">Simpan profil</button></form></div>`,'profil');
  $('#pf').onsubmit=async e=>{e.preventDefault();const n=$('#p-name').value.trim(),pw=$('#p-pw').value;
    if(!n)return toast('Nama wajib diisi.','err');if(pw&&pw.length<6)return toast('Kata sandi minimal 6 karakter.','err');
    if(await run(async()=>{await must(sb.from('profiles').update({full_name:n}).eq('id',u.id));if(pw){const r=await sb.auth.updateUser({password:pw});if(r.error)throw r.error;}
      u.name=n;const x=db.users.find(z=>z.id===u.id);if(x)x.name=n;log('Memperbarui profil');},'Profil tersimpan.'))profil();};
}

/* ===================== BOOT ===================== */
function fatal(msg,raw){app.innerHTML=`<div class="setup"><div class="card"><h2 style="font-size:22px">Tidak dapat memuat data</h2><p>${esc(msg)}</p>
  <p class="muted small">Periksa isi <code>js/config.js</code>, pastikan <code>supabase/setup.sql</code> sudah dijalankan, lalu muat ulang.</p>${raw?`<p class="muted small">Detail teknis: <code>${esc((raw.code?raw.code+' – ':'')+(raw.message||raw))}</code></p>`:''}<button class="btn" onclick="location.reload()">Muat ulang</button></div></div>`;}
async function boot(){
  try{const c=localStorage.getItem('ikb_theme_cache');if(c)applyTheme(JSON.parse(c),false);}catch(e){}
  if(!CONFIGURED)return setupScreen();
  app.innerHTML='<div class="boot"><div><i></i>Memuat…</div></div>';
  if(!window.supabase||!window.supabase.createClient)return fatal('Library Supabase gagal dimuat. Periksa koneksi internet.');
  sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
  try{
    await loadPublic();
    const s=await sb.auth.getSession();
    if(s.data&&s.data.session){const p=await readProfile(s.data.session.user.id);if(p&&p.active){profile=p;await loadPrivate();}else await sb.auth.signOut();}
  }catch(e){console.error(e);return fatal(errMsg(e),e);}
  sb.auth.onAuthStateChange(ev=>{if(ev==='SIGNED_OUT'&&profile){clearPrivate();route();}});
  subscribeLive();route();
}
boot();
})();
