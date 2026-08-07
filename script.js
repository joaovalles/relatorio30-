// Importações do Firebase SDK Modular
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, updatePassword, setPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

// Suas credenciais do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyA20u249HTh7osBExNRznpd6UmQzqmTZRY",
    authDomain: "relatorio-30h.firebaseapp.com",
    projectId: "relatorio-30h",
    storageBucket: "relatorio-30h.firebasestorage.app",
    messagingSenderId: "315379117754",
    appId: "1:315379117754:web:e1847977fc374239575c83",
    measurementId: "G-G0PKYYG4JL"
};

// Inicializando Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const reportsCollection = collection(db, 'relatorios');

// Lógica Operacional e Regras de Negócio
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
let chartInstanceSector = null;
let chartInstanceStatus = null;
let activeReportId = null; 
let historyCache = []; 

document.addEventListener('DOMContentLoaded', () => {
    initCounts();
    
    // Preenche o e-mail salvo anteriormente se houver
    const savedEmail = localStorage.getItem('saved_user_email');
    if (savedEmail) {
        document.getElementById('emailInput').value = savedEmail;
        document.getElementById('rememberEmail').checked = true;
    }
});

function initCounts() {
    tableConfig.forEach(item => currentCounts[item.status] = 0);
}

// ================= SISTEMA DE LOGIN E SESSÃO =================

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('loginScreen').classList.add('hidden');
        document.querySelector('.main-ui').classList.remove('hidden');
    } else {
        document.getElementById('loginScreen').classList.remove('hidden');
        document.querySelector('.main-ui').classList.add('hidden');
    }
});

window.fazerLogin = async function() {
    const email = document.getElementById('emailInput').value;
    const pass = document.getElementById('passwordInput').value;
    const remember = document.getElementById('rememberEmail').checked;
    const btn = document.getElementById('btnLogin');
    
    if(!email || !pass) return;

    btn.innerText = "Verificando...";
    document.getElementById('loginError').classList.add('hidden');

    try {
        // Define para limpar a sessão ao fechar a aba/navegador
        await setPersistence(auth, browserSessionPersistence);
        await signInWithEmailAndPassword(auth, email, pass);

        // Gerencia a opção de lembrar o e-mail
        if (remember) {
            localStorage.setItem('saved_user_email', email);
        } else {
            localStorage.removeItem('saved_user_email');
        }

    } catch (error) {
        console.error("Erro no login:", error);
        document.getElementById('loginError').classList.remove('hidden');
    } finally {
        btn.innerText = "Entrar";
    }
}

window.fazerLogout = function() {
    signOut(auth).then(() => {
        document.getElementById('passwordInput').value = '';
    }).catch((error) => {
        alert("Erro ao sair.");
    });
}

window.alterarSenha = async function() {
    const newPass = document.getElementById('newPasswordInput').value;
    const confirmPass = document.getElementById('confirmPasswordInput').value;
    const msg = document.getElementById('passwordMsg');

    msg.classList.remove('hidden', 'text-red-600', 'text-green-600');

    if (!newPass || newPass.length < 6) {
        msg.innerText = "A senha deve ter pelo menos 6 caracteres.";
        msg.classList.add('text-red-600');
        return;
    }

    if (newPass !== confirmPass) {
        msg.innerText = "As senhas não coincidem.";
        msg.classList.add('text-red-600');
        return;
    }

    const user = auth.currentUser;
    if (user) {
        try {
            await updatePassword(user, newPass);
            msg.innerText = "Senha alterada com sucesso!";
            msg.classList.add('text-green-600');
            document.getElementById('newPasswordInput').value = '';
            document.getElementById('confirmPasswordInput').value = '';
        } catch (error) {
            console.error("Erro ao alterar senha:", error);
            msg.innerText = "Erro ao alterar. Saia e entre novamente na conta por segurança.";
            msg.classList.add('text-red-600');
        }
    }
}

// ================= CONTROLE DE NAVEGAÇÃO =================

window.switchTab = function(tabId) {
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

// ================= PROCESSAMENTO DE PLANILHAS =================

window.handleFileUpload = function(event) {
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

    data.forEach(row => {
        const rowNormalized = {};
        for(let key in row) { rowNormalized[key.trim().toLowerCase()] = row[key]; }
        const idPedido = rowNormalized['idvenda'] || rowNormalized['pedido'] || '';
        const statusStr = (rowNormalized['status'] || '').toString().trim().toUpperCase();
        
        if(!idPedido && statusStr === '') return;

        for (let config of tableConfig) {
            if (statusStr.includes(config.status) || config.status.includes(statusStr)) {
                currentCounts[config.status]++;
                break;
            }
        }
    });

    document.getElementById('currentReportLabel').innerText = "Relatório em exibição: Nova análise (Não salva na nuvem)";
    document.getElementById('btnSave').classList.remove('hidden');
    
    updateDashboard();
    window.switchTab('tab-analise');
}

function updateDashboard() {
    document.getElementById('emptyState').classList.add('hidden');
    document.getElementById('uiArea').classList.remove('hidden');
    document.getElementById('uiArea').classList.add('flex');

    renderTable();
    generateTextForTeam();
    renderCharts();
}

function renderTable() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    tableConfig.forEach(config => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${config.status}</td><td>${config.setor}</td><td class="font-bold text-lg">${currentCounts[config.status]}</td>`;
        tbody.appendChild(tr);
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

window.copyText = function() {
    const textToCopy = document.getElementById('reportText');
    textToCopy.select();
    document.execCommand('copy');
    const msg = document.getElementById('copyMsg');
    msg.classList.remove('hidden');
    setTimeout(() => msg.classList.add('hidden'), 3000);
}

function renderCharts() {
    if (chartInstanceSector) chartInstanceSector.destroy();
    if (chartInstanceStatus) chartInstanceStatus.destroy();

    let scTotal = 0, atTotal = 0;
    tableConfig.forEach(c => {
        if(c.setor === 'ESTOQUE SC') scTotal += currentCounts[c.status];
        if(c.setor === 'ATENDIMENTO') atTotal += currentCounts[c.status];
    });

    const ctxSector = document.getElementById('sectorChart').getContext('2d');
    chartInstanceSector = new Chart(ctxSector, {
        type: 'doughnut',
        data: { labels: ['Estoque SC', 'Atendimento'], datasets: [{ data: [scTotal, atTotal], backgroundColor: ['#2563eb', '#16a34a'], borderWidth: 1 }] },
        options: { responsive: true, maintainAspectRatio: false }
    });

    const statusLabels = [], statusData = [];
    tableConfig.forEach(c => {
        if (currentCounts[c.status] > 0) {
            statusLabels.push(c.status.replace(' (SC)', ''));
            statusData.push(currentCounts[c.status]);
        }
    });

    const ctxStatus = document.getElementById('statusChart').getContext('2d');
    chartInstanceStatus = new Chart(ctxStatus, {
        type: 'bar',
        data: { labels: statusLabels, datasets: [{ label: 'Qtd de Pedidos', data: statusData, backgroundColor: '#f59e0b', borderRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });
}

// ================= SALVAR E AUDITORIA (FIREBASE) =================

window.saveCurrentReport = async function() {
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
        counts: { ...currentCounts } 
    };

    const btn = document.getElementById('btnSave');
    btn.innerText = "Salvando...";
    btn.disabled = true;

    try {
        const docRef = await addDoc(reportsCollection, reportData);
        alert("Relatório salvo na nuvem (Firebase) com sucesso!");
        
        btn.classList.add('hidden');
        document.getElementById('currentReportLabel').innerText = `Relatório em exibição: Salvo em ${reportData.dateLabel} por ${authorEmail}`;
        activeReportId = docRef.id;
    } catch (e) {
        console.error("Erro ao salvar documento: ", e);
        alert("Erro ao salvar no banco. Verifique as regras de acesso.");
    } finally {
        btn.innerText = "💾 Salvar no Firebase";
        btn.disabled = false;
    }
}

async function fetchHistoryFromFirebase() {
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-blue-600 font-bold">Buscando relatórios na nuvem...</td></tr>';

    try {
        const q = query(reportsCollection, orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
        
        historyCache = [];
        querySnapshot.forEach((doc) => {
            historyCache.push({ id: doc.id, ...doc.data() });
        });

        renderHistoryTable();
    } catch (e) {
        console.error("Erro ao buscar histórico: ", e);
        tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-red-600 font-bold">Erro ao buscar dados. Verifique a autenticação.</td></tr>';
    }
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
            <td class="p-3 text-center"><span class="bg-gray-200 px-3 py-1 rounded-full text-gray-700 font-bold">${item.total}</span></td>
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

window.loadReport = function(id) {
    const report = historyCache.find(r => r.id === id);
    if(report) {
        currentCounts = { ...report.counts };
        activeReportId = report.id;
        
        document.getElementById('currentReportLabel').innerText = `Relatório em exibição: Arquivo de ${report.dateLabel} (Criado por: ${report.createdBy || 'Desconhecido'})`;
        document.getElementById('btnSave').classList.add('hidden'); 
        
        updateDashboard();
        window.switchTab('tab-analise');
    }
}

window.deleteReport = async function(id) {
    const user = auth.currentUser;
    const deleterEmail = user ? user.email : "Desconhecido";

    if(confirm(`Tem certeza que deseja excluir permanentemente este relatório?\n(Ação realizada por: ${deleterEmail})`)) {
        try {
            console.warn(`[LOG DE AUDITORIA] O relatório ID ${id} foi EXCLUÍDO por ${deleterEmail} em ${new Date().toLocaleString()}`);

            await deleteDoc(doc(db, "relatorios", id));
            
            historyCache = historyCache.filter(r => r.id !== id);
            
            if(activeReportId === id) {
                document.getElementById('uiArea').classList.add('hidden');
                document.getElementById('uiArea').classList.remove('flex');
                document.getElementById('emptyState').classList.remove('hidden');
                activeReportId = null;
            }
            
            renderHistoryTable();
            alert("Excluído com sucesso! (Log de exclusão registrado)");
        } catch(e) {
            console.error("Erro ao excluir: ", e);
            alert("Erro ao excluir. Tente novamente.");
        }
    }
}

// ================= PDF GERADOR =================

function generateAnalysis() {
    let total = 0, scTotal = 0, atTotal = 0;
    let statusArray = [];

    tableConfig.forEach(c => {
        let qtd = currentCounts[c.status];
        total += qtd;
        if (c.setor === 'ESTOQUE SC') scTotal += qtd;
        if (c.setor === 'ATENDIMENTO') atTotal += qtd;
        if (qtd > 0) statusArray.push({ status: c.status, setor: c.setor, qtd: qtd });
    });

    statusArray.sort((a, b) => b.qtd - a.qtd);
    const analysisContainer = document.getElementById('executiveAnalysis');
    
    if (total === 0) {
        analysisContainer.innerHTML = `<p>Atualmente, não há pedidos com mais de 30 horas de atraso registrados no sistema. O fluxo operacional encontra-se totalmente normalizado.</p>`;
        return;
    }

    let setorCritico = scTotal > atTotal ? 'ESTOQUE SC' : (atTotal > scTotal ? 'ATENDIMENTO' : 'ambos os setores (de forma equilibrada)');
    let percentualCritico = Math.round((Math.max(scTotal, atTotal) / total) * 100);
    let p1 = `<p>O cenário atual reporta um acumulado de <strong>${total} pedidos</strong> com tempo de permanência superior a 30 horas. A maior concentração de retenções recai sob o setor de <strong>${setorCritico}</strong>, respondendo por aproximadamente <strong>${percentualCritico}%</strong> do volume total travado.</p>`;

    let p2 = '';
    if (statusArray.length > 0) {
        p2 = `<p>O <strong>maior gargalo de produtividade</strong> neste momento localiza-se na fila de <em>${statusArray[0].status}</em>, que retém <strong>${statusArray[0].qtd} pedidos</strong> isoladamente. Trata-se do ponto de maior impacto operacional, exigindo intervenção rápida para garantir o fluxo logístico.</p>`;
    }

    let p3 = '';
    if (statusArray.length > 1) {
        let secundarios = statusArray.slice(1, 3).map(s => `<em>${s.status}</em> (${s.qtd})`).join(' e ');
        p3 = `<p>Adicionalmente, os status de ${secundarios} devem ser tratados como <strong>pontos de atenção estratégicos</strong>. Sugere-se o monitoramento focado nestas categorias nas próximas horas para impedir o efeito cascata nas esteiras operacionais.</p>`;
    }

    analysisContainer.innerHTML = p1 + p2 + p3;
}

window.generatePDF = function() {
    window.scrollTo(0, 0); 
    generateAnalysis();

    const pdfTable = document.getElementById('pdfTable');
    let tableHTML = `<thead><tr><th>Status</th><th>Setor Responsável</th><th>QTD</th></tr></thead><tbody>`;
    tableConfig.forEach(config => {
        tableHTML += `<tr><td>${config.status}</td><td>${config.setor}</td><td style="font-weight: bold;">${currentCounts[config.status]}</td></tr>`;
    });
    tableHTML += `</tbody>`;
    pdfTable.innerHTML = tableHTML;

    let dataImpressao = new Date().toLocaleString('pt-BR');
    if(activeReportId) {
        const report = historyCache.find(r => r.id === activeReportId);
        if(report) dataImpressao = report.dateLabel;
    }

    document.getElementById('pdfDate').innerText = `Documento referente a: ${dataImpressao}`;
    document.body.classList.add('is-printing');
    
    const element = document.getElementById('pdfContent');
    const opt = {
        margin:       15,
        filename:     `Analise_Gerencial_${dataImpressao.replace(/[/:, ]/g, '_')}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, scrollY: 0 },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['css', 'legacy'] }
    };

    html2pdf().set(opt).from(element).save().then(() => {
        document.body.classList.remove('is-printing');
    });
}