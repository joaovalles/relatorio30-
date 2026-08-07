import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, updatePassword, setPersistence, browserSessionPersistence, EmailAuthProvider, reauthenticateWithCredential } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyA20u249HTh7osBExNRznpd6UmQzqmTZRY",
    authDomain: "relatorio-30h.firebaseapp.com",
    projectId: "relatorio-30h",
    storageBucket: "relatorio-30h.firebasestorage.app",
    messagingSenderId: "315379117754",
    appId: "1:315379117754:web:e1847977fc374239575c83",
    measurementId: "G-G0PKYYG4JL"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const reportsCollection = collection(db, 'relatorios');

const tableConfig = [
    { status: 'FATURADO (SC)', setor: 'ESTOQUE SC' },
    { status: 'EM SEPARAÇÃO (SC)', setor: 'ESTOQUE SC' },
    { status: 'AGUARDANDO COLETA (SC)', setor: 'ESTOQUE SC' },
    { status: 'VERIFICADO (SC)', setor: 'ESTOQUE SC' },
    { status: 'HD BRASIL ESTÁ MONTANDO SUA MÁQUINA (SC)', setor: 'ESTOQUE SC' },
    { status: 'PAGAMENTO APROVADO (SC)', setor: 'ESTOQUE SC' },
    { status: 'EM PROCESSAMENTO (SC)', setor: 'ESTOQUE SC' },
    { status: 'PENDENTE TROCA (SC)', setor: 'ESTOQUE SC' },
    { status: 'AGUARDANDO REVISÃO (SC)', setor: 'ATENDIMENTO' },
    { status: 'RETIDO (SC)', setor: 'ATENDIMENTO' },
    { status: 'AGUARDANDO DISPONIBILIDADE (SC)', setor: 'ATENDIMENTO' },
    { status: 'INCOMPATÍVEL (SC)', setor: 'ATENDIMENTO' },
    { status: 'PENDENTE REEMBOLSO (SC)', setor: 'ATENDIMENTO' }
];

let currentCounts = {};
let dadosProcessados = []; 
let activeReportId = null; 
let historyCache = []; 

document.addEventListener('DOMContentLoaded', () => {
    initCounts();
    const savedEmail = localStorage.getItem('saved_user_email');
    if (savedEmail) {
        document.getElementById('emailInput').value = savedEmail;
        document.getElementById('rememberEmail').checked = true;
    }
});

function initCounts() {
    tableConfig.forEach(item => currentCounts[item.status] = 0);
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('loginScreen').classList.add('hidden');
        document.querySelector('.main-ui').classList.remove('hidden');
    } else {
        document.getElementById('loginScreen').classList.remove('hidden');
        document.querySelector('.main-ui').classList.add('hidden');
    }
});

function fazerLogin() {
    const email = document.getElementById('emailInput').value;
    const pass = document.getElementById('passwordInput').value;
    const remember = document.getElementById('rememberEmail').checked;
    const btn = document.getElementById('btnLogin');
    
    if(!email || !pass) return;

    btn.innerText = "Verificando...";
    document.getElementById('loginError').classList.add('hidden');

    setPersistence(auth, browserSessionPersistence)
        .then(() => signInWithEmailAndPassword(auth, email, pass))
        .then(() => {
            if (remember) localStorage.setItem('saved_user_email', email);
            else localStorage.removeItem('saved_user_email');
        })
        .catch((error) => {
            console.error("Erro no login:", error);
            document.getElementById('loginError').classList.remove('hidden');
        })
        .finally(() => btn.innerText = "Entrar");
}

function fazerLogout() {
    signOut(auth).catch(() => alert("Erro ao sair."));
}

function alterarSenha() {
    const currentPass = document.getElementById('currentPasswordInput').value;
    const newPass = document.getElementById('newPasswordInput').value;
    const confirmPass = document.getElementById('confirmPasswordInput').value;
    const msg = document.getElementById('passwordMsg');

    msg.classList.remove('hidden', 'text-red-600', 'text-green-600');

    if (!currentPass) {
        msg.innerText = "Informe a sua senha atual.";
        msg.classList.add('text-red-600');
        return;
    }
    if (!newPass || newPass.length < 6) {
        msg.innerText = "A nova senha deve ter pelo menos 6 caracteres.";
        msg.classList.add('text-red-600');
        return;
    }
    if (newPass !== confirmPass) {
        msg.innerText = "As novas senhas não coincidem.";
        msg.classList.add('text-red-600');
        return;
    }

    const user = auth.currentUser;
    if (user && user.email) {
        const credential = EmailAuthProvider.credential(user.email, currentPass);
        reauthenticateWithCredential(user, credential)
            .then(() => updatePassword(user, newPass))
            .then(() => {
                msg.innerText = "Senha alterada com sucesso!";
                msg.classList.add('text-green-600');
                document.getElementById('currentPasswordInput').value = '';
                document.getElementById('newPasswordInput').value = '';
                document.getElementById('confirmPasswordInput').value = '';
            })
            .catch((error) => {
                if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                    msg.innerText = "A senha atual está incorreta.";
                } else {
                    msg.innerText = "Erro ao alterar. Tente novamente.";
                }
                msg.classList.add('text-red-600');
            });
    }
}

function switchTab(tabId) {
    document.getElementById('tab-analise').classList.add('hidden');
    document.getElementById('tab-historico').classList.add('hidden');
    document.getElementById('tab-conta').classList.add('hidden');
    document.getElementById(tabId).classList.remove('hidden');

    document.getElementById('nav-analise').classList.remove('active');
    document.getElementById('nav-historico').classList.remove('active');
    document.getElementById('nav-conta').classList.remove('active');
    
    if(tabId === 'tab-analise') document.getElementById('nav-analise').classList.add('active');
    if(tabId === 'tab-historico') {
        document.getElementById('nav-historico').classList.add('active');
        fetchHistoryFromFirebase();
    }
    if(tabId === 'tab-conta') document.getElementById('nav-conta').classList.add('active');
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        const sheetName = workbook.SheetNames.includes('PEDIDOS') ? 'PEDIDOS' : workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        processNewData(jsonData);
    };
    reader.readAsArrayBuffer(file);
    event.target.value = ''; 
}

function processNewData(data) {
    initCounts();
    activeReportId = null; 

    dadosProcessados = data.map(row => {
        const n = {};
        for(let key in row) { n[key.trim().toLowerCase()] = row[key]; }
        return {
            pedido: n['idvenda'] || n['pedido'] || 'N/A',
            status: (n['status'] || '').toString().trim().toUpperCase(),
            data: n['data'] || 'N/A'
        };
    });

    dadosProcessados.forEach(row => {
        for (let config of tableConfig) {
            if (row.status.includes(config.status) || config.status.includes(row.status)) {
                currentCounts[config.status]++;
                break;
            }
        }
    });

    document.getElementById('currentReportLabel').innerText = "Relatório em exibição: Nova análise (Não salva na nuvem)";
    document.getElementById('btnSave').classList.remove('hidden');
    
    renderSetores();
    updateDashboard();
    switchTab('tab-analise');
}

function updateDashboard() {
    document.getElementById('emptyState').classList.add('hidden');
    document.getElementById('uiArea').classList.remove('hidden');
    document.getElementById('uiArea').classList.add('flex');
    generateTextForTeam();
}

function renderSetores() {
    const container = document.getElementById('setoresContainer');
    container.innerHTML = '';
    const setores = [...new Set(tableConfig.map(c => c.setor))];

    setores.forEach(setor => {
        const statusDoSetor = tableConfig.filter(c => c.setor === setor).map(c => c.status);
        const pedidosDoSetor = dadosProcessados.filter(p => 
            statusDoSetor.some(s => p.status.includes(s) || s.includes(p.status))
        );

        const div = document.createElement('div');
        div.className = "bg-white p-6 rounded-lg shadow-md border-t-4 border-blue-900";
        div.innerHTML = `
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-xl font-bold text-blue-900 uppercase">${setor} (${pedidosDoSetor.length} pedidos)</h2>
                <button onclick="copiarDadosSetor('${setor}')" class="bg-blue-100 hover:bg-blue-200 text-blue-800 text-xs px-3 py-1.5 rounded font-bold transition shadow-sm">📋 Copiar Dados do Setor</button>
            </div>
            <div class="overflow-x-auto max-h-96">
                <table class="w-full text-sm text-left border-collapse">
                    <thead class="bg-gray-100 sticky top-0">
                        <tr><th class="p-2 border">Pedido</th><th class="p-2 border">Status</th><th class="p-2 border">Data</th></tr>
                    </thead>
                    <tbody>
                        ${pedidosDoSetor.length === 0 ? '<tr><td colspan="3" class="p-4 text-center text-gray-400">Nenhum pedido neste setor.</td></tr>' : 
                            pedidosDoSetor.map(p => `
                                <tr class="border-b ${p.status.includes('RETIDO') || p.status.includes('PENDENTE') ? 'bg-red-50 text-red-800 font-bold' : 'hover:bg-gray-50'}">
                                    <td class="p-2 border">${p.pedido}</td>
                                    <td class="p-2 border">${p.status}</td>
                                    <td class="p-2 border">${p.data}</td>
                                </tr>
                            `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        container.appendChild(div);
    });
}

window.copiarDadosSetor = function(setor) {
    const statusDoSetor = tableConfig.filter(c => c.setor === setor).map(c => c.status);
    const pedidosDoSetor = dadosProcessados.filter(p => 
        statusDoSetor.some(s => p.status.includes(s) || s.includes(p.status))
    );
    
    let textoCopia = "Pedido\tStatus\tData\n";
    pedidosDoSetor.forEach(p => textoCopia += `${p.pedido}\t${p.status}\t${p.data}\n`);
    
    navigator.clipboard.writeText(textoCopia).then(() => {
        alert(`Dados do setor ${setor} copiados com sucesso! Basta colar no Excel/Sheets.`);
    });
}

function generateTextForTeam() {
    const now = new Date();
    const hora = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    let texto = `Bom dia meus consagrados!\n\nSegue relação de 30+ para avaliação, retirado as ${hora}, podem ter ocorrido atualizações!\n\nEstoque SC @Mario Tobal Se precisar de uma mão só avisar!\n\n`;
    tableConfig.forEach(config => {
        if (config.setor === 'ESTOQUE SC' && currentCounts[config.status] > 0) { texto += `${config.status}    ${currentCounts[config.status]}\n`; }
    });

    texto += `\nATENDIMENTO - Já em validação, quebras bem controladas, e validando casos de pendente reembolso e retido para a finalização.\n\n`;
    tableConfig.forEach(config => {
        if (config.setor === 'ATENDIMENTO' && currentCounts[config.status] > 0) { texto += `${config.status}    ${currentCounts[config.status]}\n`; }
    });

    texto += `\nSegue planilha para acompanhamento:\nRELATÓRIO 30+`;
    document.getElementById('reportText').value = texto;
}

function gerarEcopiarMensagem() {
    generateTextForTeam(); 
    const textToCopy = document.getElementById('reportText');
    textToCopy.select();
    document.execCommand('copy');
    
    const msg = document.getElementById('copyMsg');
    msg.classList.remove('hidden');
    setTimeout(() => msg.classList.add('hidden'), 3500);
}

function saveCurrentReport() {
    let total = 0;
    tableConfig.forEach(c => total += currentCounts[c.status]);

    const user = auth.currentUser;
    const authorEmail = user ? user.email : "Desconhecido";
    const now = new Date();
    
    const reportData = {
        timestamp: now.getTime(),
        dateLabel: now.toLocaleString('pt-BR'),
        total: total,
        createdBy: authorEmail,
        counts: { ...currentCounts },
        dados: dadosProcessados 
    };

    const btn = document.getElementById('btnSave');
    btn.innerText = "Salvando...";
    btn.disabled = true;

    addDoc(reportsCollection, reportData)
        .then((docRef) => {
            alert("Relatório salvo na nuvem (Firebase) com sucesso!");
            btn.classList.add('hidden');
            document.getElementById('currentReportLabel').innerText = `Relatório em exibição: Salvo em ${reportData.dateLabel} por ${authorEmail}`;
            activeReportId = docRef.id;
        })
        .catch((e) => {
            console.error("Erro ao salvar: ", e);
            alert("Erro ao salvar no banco.");
        })
        .finally(() => {
            btn.innerText = "💾 Salvar no Firebase";
            btn.disabled = false;
        });
}

function fetchHistoryFromFirebase() {
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-blue-600 font-bold">Buscando relatórios na nuvem...</td></tr>';

    const q = query(reportsCollection, orderBy("timestamp", "desc"));
    getDocs(q)
        .then((querySnapshot) => {
            historyCache = [];
            querySnapshot.forEach((doc) => {
                historyCache.push({ id: doc.id, ...doc.data() });
            });
            renderHistoryTable();
        })
        .catch(() => {
            tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-red-600 font-bold">Erro ao buscar dados.</td></tr>';
        });
}

function renderHistoryTable() {
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = '';

    if(historyCache.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-500">Nenhum relatório salvo na nuvem ainda.</td></tr>`;
        return;
    }

    historyCache.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = "border-b hover:bg-gray-50";
        tr.innerHTML = `
            <td class="p-3 font-semibold">${item.dateLabel}</td>
            <td class="p-3 text-center"><span class="bg-gray-200 px-3 py-1 rounded-full text-gray-700 font-bold">${item.total || 0}</span></td>
            <td class="p-3 text-sm text-gray-600">${item.createdBy || 'Sistema'}</td>
            <td class="p-3 text-center flex justify-center gap-2">
                <button onclick="loadReport('${item.id}')" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm font-bold shadow transition">
                    👁️ Visualizar
                </button>
                <button onclick="deleteReport('${item.id}')" class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm font-bold shadow transition">
                    🗑️ Excluir
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function loadReport(id) {
    const report = historyCache.find(r => r.id === id);
    if(report) {
        currentCounts = { ...report.counts };
        dadosProcessados = report.dados || [];
        activeReportId = report.id;
        
        document.getElementById('currentReportLabel').innerText = `Relatório em exibição: Arquivo de ${report.dateLabel} (Criado por: ${report.createdBy || 'Desconhecido'})`;
        document.getElementById('btnSave').classList.add('hidden'); 
        
        renderSetores();
        updateDashboard();
        switchTab('tab-analise');
    }
}

function deleteReport(id) {
    if(confirm("Tem certeza que deseja excluir permanentemente este relatório?")) {
        deleteDoc(doc(db, "relatorios", id))
            .then(() => {
                historyCache = historyCache.filter(r => r.id !== id);
                if(activeReportId === id) {
                    document.getElementById('uiArea').classList.add('hidden');
                    document.getElementById('uiArea').classList.remove('flex');
                    document.getElementById('emptyState').classList.remove('hidden');
                    activeReportId = null;
                }
                renderHistoryTable();
                alert("Excluído com sucesso!");
            })
            .catch(() => alert("Erro ao excluir."));
    }
}

// Exposições globais
window.fazerLogin = fazerLogin;
window.fazerLogout = fazerLogout;
window.alterarSenha = alterarSenha;
window.switchTab = switchTab;
window.handleFileUpload = handleFileUpload;
window.gerarEcopiarMensagem = gerarEcopiarMensagem;
window.saveCurrentReport = saveCurrentReport;
window.loadReport = loadReport;
window.deleteReport = deleteReport;