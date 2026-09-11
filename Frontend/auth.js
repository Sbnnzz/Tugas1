// Shared login guard, loaded in the <head> of every page except login.html.
// Keeps the page hidden until /api/auth/me answers, sends visitors without a session to
// login.html, sends a role that may not open this page to its own home page, then shows the
// user in the header and hides links to pages the role cannot use.
// The backend enforces the same rules on every API call; this file only shapes the UI.
(function(){
  const API_BASE=location.protocol.startsWith('http')?location.origin:'http://localhost:8000';
  // null = any logged-in user
  const PAGE_ROLES={
    'index.html':null,
    'instalasi.html':['radiografer','admin'],
    'pacs.html':['radiolog','admin'],
    'bedah.html':['dokter_bedah','admin']
  };
  const HOME={radiografer:'instalasi.html',radiolog:'pacs.html',dokter_bedah:'bedah.html',admin:'index.html'};
  const CAN={report:['radiolog','admin'],archiveWrite:['radiografer','admin']};
  const page=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  const pageAllows=(file,role)=>{const roles=PAGE_ROLES[file];return !roles||roles.includes(role);};
  const leave=url=>{location.replace(url);return new Promise(()=>{});};  // never resolves: the page is going away
  const toLogin=()=>leave('login.html?next='+encodeURIComponent(page+location.hash));

  document.documentElement.style.visibility='hidden';

  // Any API call answered with 401 (session expired) goes back to the login page.
  const realFetch=window.fetch.bind(window);
  window.fetch=async(input,init)=>{
    const r=await realFetch(input,init);
    const url=String((input&&input.url)||input);
    if(r.status===401&&url.includes('/api/')&&!url.includes('/api/auth/'))toLogin();
    return r;
  };

  window.simrsCan=action=>!!(window.SIMRS_USER&&(CAN[action]||[]).includes(window.SIMRS_USER.role));

  // Result shaped like /api/satusehat/send-study, so pages render a refused request as a failed step.
  window.simrsDenied=(status,url)=>({ok:false,mode:'—',imaging_study_id:'',diagnostic_report_id:'',logs:[{
    step:'akses',status,request:{method:'POST',url},
    response:{issue:[{details:{text:status===403?'Akses ditolak untuk peran '+((window.SIMRS_USER||{}).role_label||'ini'):'Permintaan ditolak ('+status+')'}}]}
  }]});

  window.simrsUser=realFetch(API_BASE+'/api/auth/me').then(r=>{
    if(r.status===401)return toLogin();
    if(!r.ok)throw new Error('HTTP '+r.status);
    return r.json();
  }).then(user=>{
    if(!pageAllows(page,user.role))return leave(HOME[user.role]||'index.html');
    window.SIMRS_USER=user;
    const show=()=>{decorate(user);document.documentElement.style.visibility='';};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',show);else show();
    return user;
  }).catch(err=>{
    console.error('Login check failed (backend unreachable?):',err);
    return toLogin();
  });

  function decorate(user){
    const initials=user.full_name.replace(/^(dr|drg|ns)\.?\s+/i,'').split(/[\s,]+/).filter(Boolean)
      .slice(0,2).map(w=>w[0].toUpperCase()).join('');
    document.querySelectorAll('.avatar').forEach(a=>{a.textContent=initials;a.title=user.full_name+' · '+user.role_label;});
    document.querySelectorAll('.brand-user .who b').forEach(b=>{b.textContent=user.full_name;});
    document.querySelectorAll('.brand-user .who small').forEach(s=>{s.textContent=user.role_label;});
    // links to pages this role may not open: nav items, menu cards, "lihat semua"
    document.querySelectorAll('a[href]').forEach(a=>{
      const file=(a.getAttribute('href').split('#')[0].split('?')[0]||'').toLowerCase();
      if(file in PAGE_ROLES&&!pageAllows(file,user.role))a.style.display='none';
    });
    const nav=document.querySelector('nav.topnav');
    if(nav&&!nav.querySelector('[data-logout]')){
      const out=document.createElement('a');
      out.href='#';out.dataset.logout='';out.textContent='Keluar';out.title='Keluar dari '+user.username;
      out.addEventListener('click',e=>{e.preventDefault();realFetch(API_BASE+'/api/auth/logout',{method:'POST'}).finally(()=>location.replace('login.html'));});
      nav.appendChild(out);
    }
  }
})();
