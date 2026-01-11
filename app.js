// Frontend app.js - full features (replace API_URL with your backend URL)
const API_URL = "http://localhost:10000"; // <<-- CHANGE to your Render URL after deploy
const TOKEN_KEY = "nle_token";
const ROLE_KEY = "nle_role";

function getToken(){ return localStorage.getItem(TOKEN_KEY); }
function getRole(){ return localStorage.getItem(ROLE_KEY) || 'funcionario'; }

async function requireAuth(){
  const token = getToken();
  const offline = localStorage.getItem('nle_offline');
  if(!token && !offline && !window.location.pathname.includes('login.html')){
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

// LOGIN PAGE logic
if(window.location.pathname.includes('login.html')){
  document.addEventListener('DOMContentLoaded', ()=>{ document.getElementById('username').focus(); });

  document.getElementById('btnLogin').onclick = async ()=>{
    const u = document.getElementById('username').value.trim();
    const p = document.getElementById('password').value.trim();
    if(!u||!p) return alert('Preencha usuário e senha');

    try{
      const res = await fetch(API_URL + '/login', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({username:u,password:p})
      });
      const j = await res.json();
      if(!res.ok) return alert(j.error || 'Falha no login');
      localStorage.setItem(TOKEN_KEY, j.token);
      localStorage.setItem(ROLE_KEY, j.role || 'funcionario');
      localStorage.removeItem('nle_offline');
      window.location = 'sistema.html';
    }catch(e){
      alert('Erro: ' + e.message);
    }
  };
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

  const modalEdit = document.getElementById('modalEdit');
  const modalDetail = document.getElementById('modalDetail');
  const modalSeparate = document.getElementById('modalSeparate');

  const palletNumber = document.getElementById('palletNumber');
  const palletColor = document.getElementById('palletColor');
  const palletProducts = document.getElementById('palletProducts');

  const detailTitle = document.getElementById('detailTitle');
  const detailList = document.getElementById('detailList');
  const detailColor = document.getElementById('detailColor');

  const sepInput = document.getElementById('sepInput');
  const sepResult = document.getElementById('sepResult');

  let pallets = [];
  let editingIndex = null;

  // setup UI
  userInfo.innerText = 'Perfil: ' + (localStorage.getItem('nle_role') || 'funcionario');
  document.querySelectorAll('.admin-block').forEach(el=> el.style.display = 'flex');

  logoutBtn.onclick = ()=>{ localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(ROLE_KEY); window.location='login.html'; };

  btnClear.onclick = ()=>{ search.value=''; render(); };
  search.oninput = ()=> render();

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

  // fetch pallets from backend
  async function load(){
    const offline = localStorage.getItem('nle_offline');
    if(offline){
      const raw = localStorage.getItem('pallets_v1') || '[]';
      pallets = JSON.parse(raw);
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

  function normalizeSearch(value){
    return String(value ?? '').trim().toLowerCase();
  }

  function render(){
    const q = normalizeSearch(search.value);
    grid.innerHTML = '';
    pallets.forEach((p, idx)=>{
      if(q){
        const numberMatch = normalizeSearch(p.number) === q;
        const productMatch = (p.products || []).some((code)=> normalizeSearch(code) === q);
        if(!numberMatch && !productMatch) return;
      }
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

  async function savePallet(){
    const num = (palletNumber.value||'').trim();
    const raw = (palletProducts.value||'').trim();
    if(!num || !raw) return alert('Informe número e produtos');
    const products = raw.split(',').map(s=>s.trim()).filter(Boolean);
    const body = { number: num, color: palletColor.value||'#60a5fa', products };

    if(localStorage.getItem('nle_offline')){
      // offline store
      if(editingIndex===null) pallets.push(body); else pallets[editingIndex]=body;
      localStorage.setItem('pallets_v1', JSON.stringify(pallets));
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
    if(getRole()!=='admin' && !localStorage.getItem('nle_offline')) return alert('Apenas admin');
    if(!confirm('Excluir palete?')) return;
    if(localStorage.getItem('nle_offline')){
      pallets.splice(editingIndex,1);
      localStorage.setItem('pallets_v1', JSON.stringify(pallets));
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
    // capture sepResult
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
        // if offline, store locally; else push to backend (admin)
        if(localStorage.getItem('nle_offline')){
          pallets = imported; localStorage.setItem('pallets_v1', JSON.stringify(pallets)); render(); return;
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
  (async ()=>{ await load(); })();
}
