// Shared login guard, loaded in the <head> of every page except login.html.
// Each browser tab keeps its own login (sessionStorage), so several accounts can be open side by
// side on one laptop and a refresh keeps the tab's account. A tab opened from the app with
// Ctrl/Shift/middle-click takes over the login of the tab it came from; any other tab without a
// login of its own goes to login.html, which offers to continue as this browser's last account.
// The page stays hidden until the login is checked. The backend enforces the same role rules on
// every API call; this file only shapes the UI.
(function(){
  const API_BASE=location.protocol.startsWith('http')?location.origin:'http://localhost:8000';
  const TAB_KEY='simrs_tab_token',HANDOFF_KEY='simrs_tab_handoff';
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
  const toLogin=()=>{sessionStorage.removeItem(TAB_KEY);return leave('login.html?next='+encodeURIComponent(page+location.hash));};

  // a tab just opened from another tab of the app: take over that tab's login (valid a few seconds)
  let token=sessionStorage.getItem(TAB_KEY);
  if(!token){
    try{
      const h=JSON.parse(localStorage.getItem(HANDOFF_KEY)||'null');
      localStorage.removeItem(HANDOFF_KEY);
      if(h&&h.token&&Date.now()-h.at<15000){token=h.token;sessionStorage.setItem(TAB_KEY,token);}
    }catch(_){}
  }

  document.documentElement.style.visibility='hidden';

  // every API call carries this tab's login; a 401 (login ended or expired) goes back to login.html
  const withAuth=(init,input)=>{
    const h=new Headers((init&&init.headers)||(input instanceof Request?input.headers:undefined));
    if(token&&!h.has('Authorization'))h.set('Authorization','Bearer '+token);
    return Object.assign({},init,{headers:h});
  };
  const realFetch=window.fetch.bind(window);
  window.fetch=async(input,init)=>{
    const url=String((input&&input.url)||input),isApi=url.includes('/api/');
    const r=await realFetch(input,isApi?withAuth(init,input):init);
    if(r.status===401&&isApi&&!url.includes('/api/auth/'))toLogin();
    return r;
  };

  // Ctrl/Shift/middle-click on an app link opens a new tab: hand this tab's login over to it
  function handoff(e){
    const a=e.target.closest&&e.target.closest('a[href]');
    if(!a||!token||a.origin!==location.origin)return;
    const newTab=e.type==='auxclick'?e.button===1:(e.ctrlKey||e.metaKey||e.shiftKey);
    if(newTab)localStorage.setItem(HANDOFF_KEY,JSON.stringify({token,at:Date.now()}));
  }
  document.addEventListener('click',handoff,true);
  document.addEventListener('auxclick',handoff,true);

  window.simrsCan=action=>!!(window.SIMRS_USER&&(CAN[action]||[]).includes(window.SIMRS_USER.role));

  // Result shaped like /api/satusehat/send-study, so pages render a refused request as a failed step.
  window.simrsDenied=(status,url)=>({ok:false,mode:'—',imaging_study_id:'',diagnostic_report_id:'',logs:[{
    step:'akses',status,request:{method:'POST',url},
    response:{issue:[{details:{text:status===403?'Akses ditolak untuk peran '+((window.SIMRS_USER||{}).role_label||'ini'):'Permintaan ditolak ('+status+')'}}]}
  }]});

  window.simrsUser=(token?realFetch(API_BASE+'/api/auth/me',withAuth()):Promise.resolve({status:401})).then(r=>{
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
    document.title=user.role_label+' · '+document.title;   // tells the tabs apart
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
      out.href='#';out.dataset.logout='';out.textContent='Keluar';out.title='Keluar dari '+user.username+' (hanya tab ini)';
      out.addEventListener('click',e=>{
        e.preventDefault();
        realFetch(API_BASE+'/api/auth/logout',withAuth({method:'POST'}))
          .finally(()=>{sessionStorage.removeItem(TAB_KEY);location.replace('login.html');});
      });
      nav.appendChild(out);
    }
  }
})();
