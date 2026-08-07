import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

const app = initializeApp({
    apiKey: "AIzaSyA20u249HTh7osBExNRznpd6UmQzqmTZRY",
    authDomain: "relatorio-30h.firebaseapp.com",
    projectId: "relatorio-30h",
    storageBucket: "relatorio-30h.firebasestorage.app",
    messagingSenderId: "315379117754",
    appId: "1:315379117754:web:e1847977fc374239575c83"
});

const auth = getAuth(app), db = getFirestore(app);
const tableConfig = [
    { status: 'FATURADO (SC)', setor: 'ESTOQUE SC' },
    { status: 'EM SEPARAÇÃO (SC)', setor: 'ESTOQUE SC' },
    { status: 'AGUARDANDO COLETA (SC)', setor: 'ESTOQUE SC' },
    { status: 'VERIFICADO (SC)', setor: 'ESTOQUE SC' },
    { status: 'AGUARDANDO REVISÃO (SC)', setor: 'ATENDIMENTO' },
    { status: 'RETIDO (SC)', setor: 'ATENDIMENTO' }
];

let currentCounts = {}, dadosProcessados = [], sectorChart = null;

window.fazerLogin = () => signInWithEmailAndPassword(auth, document.getElementById('emailInput').value, document.getElementById('passwordInput').value).catch(() => alert("Erro"));
window.fazerLogout = () => signOut(auth);
window.alterarSenha = () => {
    const user = auth.currentUser;
    reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, document.getElementById('currentPasswordInput').value))
        .then(() => updatePassword(user, document.getElementById('newPasswordInput').value))
        .then(() => document.getElementById('passwordMsg').innerText = "Sucesso!")
        .catch(() => document.getElementById('passwordMsg').innerText = "Erro.");
};

window.handleFileUpload = (e) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
        const wb = XLSX.read(new Uint8Array(ev.target.result), {type: 'array'});
        dadosProcessados = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {defval: ""}).map(r => ({
            pedido: r.IDVENDA || r.PEDIDO || 'N/A', status: (r.STATUS || '').toString().toUpperCase(), data: r.DATA || 'N/A'
        }));
        processarDados();
    };
    reader.readAsArrayBuffer(e.target.files[0]);
};

function processarDados() {
    currentCounts = {}; tableConfig.forEach(c => currentCounts[c.status] = 0);
    dadosProcessados.forEach(row => {
        tableConfig.forEach(c => { if(row.status.includes(c.status)) currentCounts[c.status]++; });
    });
    document.getElementById('uiArea').classList.remove('hidden');
    document.getElementById('emptyState').classList.add('hidden');
    renderTabela(); renderSetores(); renderCharts();
}

function renderTabela() {
    document.getElementById('tableBody').innerHTML = tableConfig.map(c => `<tr><td>${c.status}</td><td>${c.setor}</td><td>${currentCounts[c.status]}</td></tr>`).join('');
}

function renderSetores() {
    const container = document.getElementById('setoresContainer');
    container.innerHTML = '<h2 class="text-xl font-bold">Detalhamento por Setor</h2>';
    [...new Set(tableConfig.map(c => c.setor))].forEach(setor => {
        const pedidos = dadosProcessados.filter(p => tableConfig.find(c => c.setor === setor && p.status.includes(c.status)));
        const div = document.createElement('div');
        div.className = "bg-white p-6 shadow rounded-lg border-t-4 border-blue-900";
        div.innerHTML = `<div class="flex justify-between mb-4"><h2 class="font-bold text-lg">${setor}</h2><button onclick="window.copiarDadosSetor('${setor}')" class="bg-gray-200 px-3 py-1 text-xs font-bold rounded">📋 Copiar</button></div>
        <table class="w-full text-sm"><thead><tr class="bg-gray-100"><th class="p-2 border">Pedido</th><th class="p-2 border">Status</th></tr></thead>
        <tbody>${pedidos.map(p => `<tr class="${p.status.includes('RETIDO')?'bg-red-50':''}"><td class="p-2 border">${p.pedido}</td><td class="p-2 border">${p.status}</td></tr>`).join('')}</tbody></table>`;
        container.appendChild(div);
    });
}

window.copiarDadosSetor = (setor) => {
    const p = dadosProcessados.filter(p => tableConfig.find(c => c.setor === setor && p.status.includes(c.status)));
    navigator.clipboard.writeText(p.map(x => `${x.pedido}\t${x.status}`).join('\n'));
    alert("Dados copiados!");
};

window.gerarEcopiarMensagem = () => {
    document.getElementById('reportText').value = "Relatório processado.";
    document.getElementById('reportText').select();
    document.execCommand('copy');
    alert("Copiado!");
};

function renderCharts() {
    if(sectorChart) sectorChart.destroy();
    sectorChart = new Chart(document.getElementById('sectorChart'), {
        type: 'doughnut', data: { labels: Object.keys(currentCounts), datasets: [{ data: Object.values(currentCounts), backgroundColor: ['#2563eb', '#16a34a', '#f59e0b'] }] }
    });
}

window.switchTab = (id) => { /* lógica abas */ };
window.saveCurrentReport = () => alert("Salvo!");
onAuthStateChanged(auth, (u) => { if(u) { document.getElementById('loginScreen').classList.add('hidden'); document.querySelector('.main-ui').classList.remove('hidden'); } });