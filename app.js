// Frontend app.js - works with Apache (local storage) or backend when available
const BASE_PATH = window.location.pathname.replace(/\/[^/]*$/, '');
const API_URL = window.location.origin + BASE_PATH;
const TOKEN_KEY = 'nle_token';
const ROLE_KEY = 'nle_role';
const OFFLINE_KEY = 'nle_offline';
const USERS_KEY = 'nle_users_v1';
const PALLETS_KEY = 'pallets_v1';

const DEFAULT_USERS = [
  { username: 'admin', password: 'admin123', role: 'admin' },
  { username: 'func', password: 'func123', role: 'funcionario' }
];

function getToken(){ return localStorage.getItem(TOKEN_KEY); }
function getRole(){ return localStorage.getItem(ROLE_KEY) || 'funcionario'; }
function isOffline(){ return localStorage.getItem(OFFLINE_KEY) === '1' || getToken() === 'local'; }

async function ensureLocalData(){
  const hasUsers = !!localStorage.getItem(USERS_KEY);
  const hasPallets = !!localStorage.getItem(PALLETS_KEY);
  if(hasUsers && hasPallets) return;

  try{
    const res = await fetch('database.json', { cache: 'no-store' });
    if(res.ok){
      const data = await res.json();
      const users = Array.isArray(data.users) ? data.users : DEFAULT_USERS;
      const pallets = Array.isArray(data.pallets) ? data.pallets : [];
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      localStorage.setItem(PALLETS_KEY, JSON.stringify(pallets));
      return;
    }
  }catch(e){
    // ignore and fallback
  }

  if(!hasUsers){
    localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS));
  }
  if(!hasPallets){
    localStorage.setItem(PALLETS_KEY, JSON.stringify([]));
  }
}

function getLocalUsers(){
  return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
}

function setLocalUsers(users){
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getLocalPallets(){
  return JSON.parse(localStorage.getItem(PALLETS_KEY) || '[]');
}

function setLocalPallets(pallets){
  localStorage.setItem(PALLETS_KEY, JSON.stringify(pallets));
}

async function requireAuth(){
  const token = getToken();
  if(!token && !window.location.pathname.includes('login.html')){
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

async function tryServerLogin(username, password){
  try{
    const res = await fetch(API_URL + '/login', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ username, password })
    });
    const contentType = res.headers.get('content-type') || '';
    if(!contentType.includes('application/json')){
      return null;
    }
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || 'Falha no login');
    return { token: data.token, role: data.role || 'funcionario', mode: 'server' };
  }catch(e){
    return null;
  }
}

async function localLogin(username, password){
  await ensureLocalData();
  const users = getLocalUsers();
  const user = users.find(u => u.username === username && u.password === password);
  if(!user){
    throw new Error('Usuário ou senha inválidos');
  }
  return { token: 'local', role: user.role || 'funcionario', mode: 'local' };
}

// LOGIN PAGE logic
if(window.location.pathname.includes('login.html')){
  let serverAvailable = false;
  document.addEventListener('DOMContentLoaded', async ()=>{
    await ensureLocalData();
    const statusEl = document.getElementById('serverStatus');
    if(statusEl){
      try{
        const res = await fetch(API_URL + '/health');
        const contentType = res.headers.get('content-type') || '';
        serverAvailable = res.ok && contentType.includes('application/json');
        statusEl.innerText = serverAvailable ? 'online' : 'local';
      }catch(e){
        statusEl.innerText = 'local';
      }
    }
    const userInput = document.getElementById('username');
    if(userInput){ userInput.focus(); }
  });

  document.getElementById('btnLogin').onclick = async ()=>{
    const u = document.getElementById('username').value.trim();
    const p = document.getElementById('password').value.trim();
    if(!u||!p) return alert('Preencha usuário e senha');

    let auth = null;
    if(serverAvailable){
      auth = await tryServerLogin(u, p);
    }
    if(!auth){
      try{
        auth = await localLogin(u, p);
      }catch(e){
        return alert(e.message);
      }
    }

    localStorage.setItem(TOKEN_KEY, auth.token);
    localStorage.setItem(ROLE_KEY, auth.role);
    localStorage.setItem(OFFLINE_KEY, auth.mode === 'local' ? '1' : '0');
    localStorage.setItem('nle_user', u);
    window.location = 'sistema.html';
  };

  const offlineBtn = document.getElementById('btnOffline');
  if(offlineBtn){
    offlineBtn.onclick = async ()=>{
      await ensureLocalData();
      localStorage.setItem(OFFLINE_KEY,'1');
      localStorage.setItem(TOKEN_KEY,'local');
      localStorage.setItem(ROLE_KEY,'funcionario');
      window.location.href = 'sistema.html';
    };
  }
}

// SISTEMA PAGE logic
if(window.location.pathname.includes('sistema.html')){
  // elements
  const userInfo = document.getElementById('userInfo');
  const logoutBtn = document.getElementById('logoutBtn');
  const grid = document.getElementById('grid');
  const search = document.getElementById('search');
  const btnClear = document.getElementById('btnClear');
  const btnNew = document.getElementById('btnNew');
  const btnExport = document.getElementById('btnExport');
  const btnImport = document.getElementById('btnImport');
  const btnSeparate = document.getElementById('btnSeparate');
  const btnPdfPortrait = document.getElementById('btnPdfPortrait');
  const btnPdfLandscape = document.getElementById('btnPdfLandscape');
  const fileInput = document.getElementById('fileInput');
  const btnNewUser = document.getElementById('btnNewUser');

  const modalEdit = document.getElementById('modalEdit');
  const modalDetail = document.getElementById('modalDetail');
  const modalSeparate = document.getElementById('modalSeparate');
  const modalUser = document.getElementById('modalUser');

  const palletNumber = document.getElementById('palletNumber');
  const palletColor = document.getElementById('palletColor');
  const palletProducts = document.getElementById('palletProducts');

  const detailTitle = document.getElementById('detailTitle');
  const detailList = document.getElementById('detailList');
  const detailColor = document.getElementById('detailColor');

  const sepInput = document.getElementById('sepInput');
  const sepResult = document.getElementById('sepResult');
  const newUsername = document.getElementById('newUsername');
  const newPassword = document.getElementById('newPassword');
  const newRole = document.getElementById('newRole');
  const userList = document.getElementById('userList');

  let pallets = [];
  let editingIndex = null;

  // setup UI
  userInfo.innerText = 'Perfil: ' + (localStorage.getItem('nle_role') || 'funcionario');
  document.querySelectorAll('.admin-block').forEach(el=> el.style.display = (getRole()==='admin')? 'flex':'none');

  logoutBtn.onclick = ()=>{ localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(ROLE_KEY); localStorage.removeItem(OFFLINE_KEY); window.location='login.html'; };

  btnClear.onclick = ()=>{ search.value=''; render(); };

  btnNew.onclick = ()=>{ openNew(); };

  document.getElementById('cancelPallet').onclick = ()=> modalEdit.classList.remove('open');

  document.getElementById('closeDetail').onclick = ()=> modalDetail.classList.remove('open');

  document.getElementById('sepClose').onclick = ()=> modalSeparate.classList.remove('open');

  document.getElementById('savePallet').onclick = savePallet;

  document.getElementById('deletePallet').onclick = deletePallet;

  document.getElementById('sepOk').onclick = processSeparacao;
  document.getElementById('sepPrint').onclick = ()=> gerarPdf('portrait');
  document.getElementById('sepPrintLand').onclick = ()=> gerarPdf('landscape');

  btnPdfPortrait.onclick = ()=> gerarPdfTodos('portrait');
  btnPdfLandscape.onclick = ()=> gerarPdfTodos('landscape');

  btnExport.onclick = exportarJSON;
  btnImport.onclick = ()=> fileInput.click();
  fileInput.onchange = importarJSON;

  if(btnNewUser){
    btnNewUser.onclick = ()=> openUserModal();
  }
  document.getElementById('cancelUser').onclick = ()=> modalUser.classList.remove('open');
  document.getElementById('saveUser').onclick = saveUser;

  // fetch pallets from backend or local storage
  async function load(){
    await ensureLocalData();
    if(isOffline()){
      pallets = getLocalPallets();
      render();
      return;
    }
    try{
      const res = await fetch(API_URL + '/pallets', { headers: { Authorization: 'Bearer ' + getToken() } });
      if(res.status===401 || res.status===403){ alert('Sessão expirada'); localStorage.removeItem(TOKEN_KEY); window.location='login.html'; return; }
      pallets = await res.json();
      render();
    }catch(e){
      alert('Erro ao carregar paletes: ' + e.message);
    }
  }

  async function loadUsers(){
    if(getRole() !== 'admin') return;
    await ensureLocalData();
    if(isOffline()){
      const users = getLocalUsers();
      userList.innerHTML = '';
      users.forEach(user => {
        const item = document.createElement('div');
        item.className = 'user-item';
        item.innerHTML = `<span>${user.username}</span><span class="small muted">${user.role}</span>`;
        userList.appendChild(item);
      });
      return;
    }
    try{
      const res = await fetch(API_URL + '/users', { headers: { Authorization: 'Bearer ' + getToken() } });
      if(!res.ok) return;
      const users = await res.json();
      userList.innerHTML = '';
      users.forEach(user => {
        const item = document.createElement('div');
        item.className = 'user-item';
        item.innerHTML = `<span>${user.username}</span><span class="small muted">${user.role}</span>`;
        userList.appendChild(item);
      });
    }catch(e){
      userList.innerHTML = '<div class="small muted">Erro ao carregar usuários.</div>';
    }
  }

  function render(){
    const q = (search.value||'').toLowerCase();
    grid.innerHTML = '';
    pallets.forEach((p, idx)=>{
      if(q && !String(p.number).toLowerCase().includes(q) && !(p.products||[]).join(',').toLowerCase().includes(q)) return;
      const el = document.createElement('div'); el.className='pallet-card';
      el.innerHTML = `<div style="display:flex;align-items:center;gap:10px"><div class="colorbox" style="background:${p.color||'#60a5fa'}"></div><div><strong>Palete ${p.number}</strong><div class="small muted">${(p.products||[]).length} produto(s)</div></div></div>
        <div class="chips">${(p.products||[]).slice(0,8).map(x=>'<span class="chip">'+x+'</span>').join('')}</div>
        <div style="display:flex;justify-content:space-between;margin-top:10px">
          <button class="btn secondary" onclick="openDetail(${idx})">Ver</button>
          ${getRole()==='admin'?'<button class="btn primary" onclick="openEdit('+idx+')">Editar</button>':''}
        </div>`;
      grid.appendChild(el);
    });
  }

  // expose functions for onclick in html
  window.openDetail = function(idx){
    const p = pallets[idx];
    detailTitle.innerText = 'Palete ' + p.number;
    detailColor.style.background = p.color||'#60a5fa';
    detailList.innerHTML = '';
    (p.products||[]).forEach(code=>{ const d = document.createElement('div'); d.className='chip'; d.innerText = code; detailList.appendChild(d); });
    document.getElementById('editFromDetail').onclick = ()=>{ modalDetail.classList.remove('open'); openEdit(idx); };
    modalDetail.classList.add('open');
  };

  window.openEdit = function(idx){
    editingIndex = idx;
    const p = pallets[idx];
    palletNumber.value = p.number;
    palletColor.value = p.color;
    palletProducts.value = (p.products||[]).join(',');
    document.getElementById('modalTitle').innerText = 'Editar Palete';
    document.getElementById('deletePallet').style.display = (getRole()==='admin')? 'inline-block':'none';
    modalEdit.classList.add('open');
  };

  function openNew(){
    editingIndex = null;
    palletNumber.value=''; palletColor.value=''; palletProducts.value='';
    document.getElementById('modalTitle').innerText = 'Novo Palete';
    document.getElementById('deletePallet').style.display = 'none';
    modalEdit.classList.add('open');
  }

  function openUserModal(){
    newUsername.value = '';
    newPassword.value = '';
    newRole.value = 'funcionario';
    loadUsers();
    modalUser.classList.add('open');
  }

  async function saveUser(){
    const username = (newUsername.value || '').trim();
    const password = (newPassword.value || '').trim();
    const role = newRole.value;
    if(!username || !password) return alert('Informe usuário e senha');
    if(getRole() !== 'admin') return alert('Apenas admin');

    if(isOffline()){
      const users = getLocalUsers();
      if(users.some(u => u.username === username)) return alert('Usuário já existe');
      users.push({ username, password, role });
      setLocalUsers(users);
      newUsername.value = '';
      newPassword.value = '';
      newRole.value = 'funcionario';
      await loadUsers();
      return;
    }

    try{
      const res = await fetch(API_URL + '/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + getToken()
        },
        body: JSON.stringify({ username, password, role })
      });
      const data = await res.json();
      if(!res.ok) return alert(data.error || 'Erro ao cadastrar');
      newUsername.value = '';
      newPassword.value = '';
      newRole.value = 'funcionario';
      await loadUsers();
    }catch(e){
      alert('Erro: ' + e.message);
    }
  }

  async function savePallet(){
    const num = (palletNumber.value||'').trim();
    const raw = (palletProducts.value||'').trim();
    if(!num || !raw) return alert('Informe número e produtos');
    const products = raw.split(',').map(s=>s.trim()).filter(Boolean);
    const body = { number: num, color: palletColor.value||'#60a5fa', products };

    if(getRole()!=='admin' && !isOffline()) return alert('Apenas admin');

    if(isOffline()){
      if(editingIndex===null) pallets.push(body); else pallets[editingIndex]=body;
      setLocalPallets(pallets);
      modalEdit.classList.remove('open'); render(); return;
    }

    try{
      if(editingIndex===null){
        const res = await fetch(API_URL + '/pallets', { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+getToken()}, body: JSON.stringify(body) });
        if(!res.ok) return alert('Erro ao criar');
      } else {
        const res = await fetch(API_URL + '/pallets/'+editingIndex, { method:'PUT', headers:{'Content-Type':'application/json','Authorization':'Bearer '+getToken()}, body: JSON.stringify(body) });
        if(!res.ok) return alert('Erro ao editar');
      }
      modalEdit.classList.remove('open');
      await load();
    }catch(e){ alert('Erro: '+e.message); }
  }

  async function deletePallet(){
    if(getRole()!=='admin' && !isOffline()) return alert('Apenas admin');
    if(!confirm('Excluir palete?')) return;
    if(isOffline()){
      pallets.splice(editingIndex,1);
      setLocalPallets(pallets);
      modalEdit.classList.remove('open'); render(); return;
    }
    try{
      const res = await fetch(API_URL + '/pallets/'+editingIndex, { method:'DELETE', headers:{ Authorization: 'Bearer '+getToken() }});
      if(!res.ok) return alert('Erro ao excluir');
      modalEdit.classList.remove('open');
      await load();
    }catch(e){ alert('Erro: '+e.message); }
  }

  // separação
  function processSeparacao(){
    const lista = (sepInput.value||'').split(',').map(s=>s.trim()).filter(Boolean);
    sepResult.innerHTML = '';
    if(lista.length===0) return;
    pallets.forEach(p=>{
      const encontrados = (p.products||[]).filter(code=> lista.includes(String(code)));
      if(encontrados.length>0){
        const div = document.createElement('div');
        div.className='pallet-card';
        div.innerHTML = `<strong>Palete ${p.number}</strong><div class="chips">${encontrados.map(x=>'<span class="chip">'+x+'</span>').join('')}</div>`;
        sepResult.appendChild(div);
      }
    });
  }

  async function gerarPdf(orientation='portrait'){
    const temp = document.createElement('div'); temp.style.padding='12px'; temp.style.background='#fff'; temp.style.color='#000';
    temp.appendChild(sepResult.cloneNode(true));
    document.body.appendChild(temp);
    const canvas = await html2canvas(temp, {scale:2});
    const img = canvas.toDataURL('image/png');
    document.body.removeChild(temp);
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation, unit:'pt', format:'a4' });
    const w = pdf.internal.pageSize.getWidth();
    const h = pdf.internal.pageSize.getHeight();
    const ratio = Math.min(w/canvas.width, h/canvas.height);
    pdf.addImage(img, 'PNG', (w - canvas.width*ratio)/2, 20, canvas.width*ratio, canvas.height*ratio);
    pdf.save('separacao.pdf');
  }

  async function gerarPdfTodos(orientation='portrait'){
    const temp = document.createElement('div'); temp.style.padding='12px'; temp.style.background='#fff'; temp.style.color='#000';
    pallets.forEach(p=>{
      const c = document.createElement('div'); c.style.marginBottom='10px';
      c.innerHTML = `<h3>Palete ${p.number}</h3><p>${(p.products||[]).join(', ')}</p>`;
      temp.appendChild(c);
    });
    document.body.appendChild(temp);
    const canvas = await html2canvas(temp, {scale:2});
    const img = canvas.toDataURL('image/png');
    document.body.removeChild(temp);
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation, unit:'pt', format:'a4' });
    const w = pdf.internal.pageSize.getWidth();
    const h = pdf.internal.pageSize.getHeight();
    const ratio = Math.min(w/canvas.width, h/canvas.height);
    pdf.addImage(img, 'PNG', (w - canvas.width*ratio)/2, 20, canvas.width*ratio, canvas.height*ratio);
    pdf.save('todos_paletes.pdf');
  }

  // import/export
  function exportarJSON(){
    const blob = new Blob([JSON.stringify(pallets, null, 2)], { type:'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'pallets_export.json'; a.click();
  }

  function importarJSON(e){
    const f = e.target.files[0]; if(!f) return;
    const r = new FileReader();
    r.onload = async ()=> {
      try{
        const imported = JSON.parse(r.result);
        if(!Array.isArray(imported)) throw 'invalid';
        if(isOffline()){
          pallets = imported; setLocalPallets(pallets); render(); return;
        }
        for(const p of imported){
          await fetch(API_URL + '/pallets', { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+localStorage.getItem(TOKEN_KEY)}, body: JSON.stringify(p) });
        }
        await load();
      }catch(err){ alert('Arquivo inválido'); }
    };
    r.readAsText(f);
  }

  // init
  (async ()=>{ await requireAuth(); await load(); await loadUsers(); })();
}
