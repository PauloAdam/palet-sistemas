// =============================
// CONFIGURAÇÃO
// =============================
const API_URL = "http://localhost:3000";
let TOKEN = localStorage.getItem("token");
let ROLE = localStorage.getItem("role");

// =============================
// CHECAR LOGIN AO CARREGAR
// =============================
if (!TOKEN) {
  window.location.href = "login.html";
}

// =============================
// ELEMENTOS
// =============================
const grid = document.getElementById("grid");
const usernameDisplay = document.getElementById("usernameDisplay");

// Modais
const modalEdit = document.getElementById("modalEdit");
const modalDetail = document.getElementById("modalDetail");
const modalSeparate = document.getElementById("modalSeparate");

// Inputs modal
const palletNumber = document.getElementById("palletNumber");
const palletColor = document.getElementById("palletColor");
const palletProducts = document.getElementById("palletProducts");

// Separação
const sepInput = document.getElementById("sepInput");
const sepResult = document.getElementById("sepResult");

// Botões
document.getElementById("logoutBtn").onclick = logout;
document.getElementById("btnNew").onclick = openNewModal;
document.getElementById("btnSeparate").onclick = openSeparacao;
document.getElementById("btnClear").onclick = () => { search.value = ""; render(); };
document.getElementById("cancelPallet").onclick = () => modalEdit.classList.remove("open");
document.getElementById("closeDetail").onclick = () => modalDetail.classList.remove("open");
document.getElementById("sepClose").onclick = () => modalSeparate.classList.remove("open");

// PDF
document.getElementById("sepPrint").onclick = () => gerarPdf('portrait');
document.getElementById("sepPrintLand").onclick = () => gerarPdf('landscape');
document.getElementById("btnPdfPortrait").onclick = () => gerarPdfTodos('portrait');
document.getElementById("btnPdfLandscape").onclick = () => gerarPdfTodos('landscape');

document.getElementById("btnExport").onclick = exportarJSON;
document.getElementById("btnImport").onclick = () => document.getElementById("fileInput").click();
document.getElementById("fileInput").onchange = importarJSON;

// =============================
// PERMISSÕES
// =============================
function aplicarPermissoes() {
  usernameDisplay.innerText = `Usuário: ${ROLE}`;

  if (ROLE === "admin") {
    document.querySelectorAll(".admin-only").forEach(el => el.style.display = "flex");
  }
}

// =============================
// LOGOUT
// =============================
function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  window.location.href = "login.html";
}

// =============================
// BUSCAR DO BACKEND
// =============================
async function fetchPallets() {
  const res = await fetch(`${API_URL}/pallets`, {
    headers: { "Authorization": "Bearer " + TOKEN }
  });

  if (res.status === 401 || res.status === 403) logout();

  return await res.json();
}

// =============================
// SALVAR / EDITAR / EXCLUIR
// =============================
async function savePallet() {
  const number = palletNumber.value.trim();
  const color = palletColor.value.trim() || "#3b82f6";
  const products = palletProducts.value.split(",").map(s => s.trim()).filter(Boolean);

  const body = { number, color, products };

  const url = editingIndex === null
    ? `${API_URL}/pallets`
    : `${API_URL}/pallets/${editingIndex}`;

  const method = editingIndex === null ? "POST" : "PUT";

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + TOKEN
    },
    body: JSON.stringify(body)
  });

  if (res.status !== 200) {
    alert("Erro ao salvar");
    return;
  }

  modalEdit.classList.remove("open");
  load();
}

async function deletePallet() {
  if (!confirm("Excluir palete?")) return;

  await fetch(`${API_URL}/pallets/${editingIndex}`, {
    method: "DELETE",
    headers: { "Authorization": "Bearer " + TOKEN }
  });

  modalEdit.classList.remove("open");
  load();
}

// =============================
// RENDER
// =============================
let pallets = [];
let editingIndex = null;

function render() {
  const q = search.value.trim().toLowerCase();
  grid.innerHTML = "";

  pallets.forEach((p, idx) => {
    if (q && !String(p.number).toLowerCase().includes(q) &&
        !p.products.join(",").toLowerCase().includes(q)) {
      return;
    }

    const card = document.createElement("div");
    card.className = "pallet-card";

    card.innerHTML = `
      <div class="pallet-head">
        <div class="colorbox" style="background:${p.color}"></div>
        <h3>Palete ${p.number}</h3>
      </div>

      <div class="chip-list">
        ${p.products.slice(0, 8).map(c => `<span class="chip">${c}</span>`).join("")}
      </div>

      <div style="display:flex; justify-content:space-between">
        <button class="btn-secondary" onclick="openDetail(${idx})">Ver</button>

        ${ROLE === "admin" ? `
        <button class="btn-primary" onclick="openEdit(${idx})">Editar</button>
        ` : ""}
      </div>
    `;

    grid.appendChild(card);
  });
}

// =============================
// MODAIS
// =============================
function openNewModal() {
  editingIndex = null;
  palletNumber.value = "";
  palletColor.value = "";
  palletProducts.value = "";
  document.getElementById("modalTitle").innerText = "Novo Palete";

  document.getElementById("deletePallet").style.display = "none";
  modalEdit.classList.add("open");
}

function openEdit(i) {
  editingIndex = i;
  const p = pallets[i];

  palletNumber.value = p.number;
  palletColor.value = p.color;
  palletProducts.value = p.products.join(",");

  document.getElementById("modalTitle").innerText = "Editar Palete";
  document.getElementById("deletePallet").style.display = "flex";

  modalEdit.classList.add("open");
}

function openDetail(i) {
  const p = pallets[i];

  document.getElementById("detailTitle").innerText = `Palete ${p.number}`;
  document.getElementById("detailColor").style.background = p.color;

  const list = document.getElementById("detailList");
  list.innerHTML = "";

  p.products.forEach(prod => {
    const div = document.createElement("div");
    div.className = "chip";
    div.innerText = prod;
    list.appendChild(div);
  });

  document.getElementById("editFromDetail").onclick = () => {
    modalDetail.classList.remove("open");
    openEdit(i);
  };

  modalDetail.classList.add("open");
}

// =============================
// SEPARAÇÃO
// =============================
function openSeparacao() {
  sepInput.value = "";
  sepResult.innerHTML = "";
  modalSeparate.classList.add("open");
}

function processSeparacao() {
  const lista = sepInput.value.split(",").map(s => s.trim()).filter(Boolean);

  sepResult.innerHTML = "";
  if (lista.length === 0) return;

  pallets.forEach(p => {
    const encontrados = p.products.filter(code => lista.includes(code));
    if (encontrados.length > 0) {
      const div = document.createElement("div");
      div.className = "chip";
      div.innerHTML = `<strong>Palete ${p.number}:</strong> ${encontrados.join(", ")}`;
      sepResult.appendChild(div);
    }
  });
}

document.getElementById("sepOk").onclick = processSeparacao;

// =============================
// PDF
// =============================
async function gerarPdf(orientation = "portrait") {
  const temp = document.createElement("div");
  temp.style.background = "white";
  temp.style.color = "black";
  temp.style.padding = "20px";

  temp.innerHTML = sepResult.innerHTML.replaceAll("chip", "");

  document.body.appendChild(temp);

  const canvas = await html2canvas(temp);
  const img = canvas.toDataURL("image/png");

  const pdf = new jspdf.jsPDF({ orientation });
  pdf.addImage(img, "PNG", 10, 10);
  pdf.save("separacao.pdf");

  document.body.removeChild(temp);
}

async function gerarPdfTodos(orientation = "portrait") {
  const temp = document.createElement("div");
  temp.style.background = "white";
  temp.style.color = "black";
  temp.style.padding = "20px";

  pallets.forEach(p => {
    const container = document.createElement("div");
    container.innerHTML = `
      <h3>Palete ${p.number}</h3>
      <p>${p.products.join(", ")}</p>
    `;
    temp.appendChild(container);
  });

  document.body.appendChild(temp);

  const canvas = await html2canvas(temp);
  const img = canvas.toDataURL("image/png");

  const pdf = new jspdf.jsPDF({ orientation });
  pdf.addImage(img, "PNG", 10, 10);
  pdf.save("todos_paletes.pdf");

  document.body.removeChild(temp);
}

// =============================
// IMPORTAÇÃO / EXPORTAÇÃO
// =============================
function exportarJSON() {
  const blob = new Blob([JSON.stringify(pallets, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "pallets_backup.json";
  a.click();
}

function importarJSON(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async () => {
    const imported = JSON.parse(reader.result);
    if (!Array.isArray(imported)) return alert("Arquivo inválido");

    for (const p of imported) {
      await fetch(`${API_URL}/pallets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + TOKEN
        },
        body: JSON.stringify(p)
      });
    }

    load();
  };

  reader.readAsText(file);
}

// =============================
// INICIALIZAÇÃO
// =============================
document.getElementById("savePallet").onclick = savePallet;
document.getElementById("deletePallet").onclick = deletePallet;

async function load() {
  pallets = await fetchPallets();
  render();
}

aplicarPermissoes();
load();
