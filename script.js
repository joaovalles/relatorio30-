// Adicione esta variável para armazenar os dados brutos processados
let dadosProcessados = []; 

function processNewData(data) {
    initCounts();
    dadosProcessados = data.map(row => {
        // Normaliza as chaves para facilitar a leitura
        const n = {};
        for(let key in row) { n[key.trim().toLowerCase()] = row[key]; }
        return {
            pedido: n['idvenda'] || n['pedido'] || 'N/A',
            status: (n['status'] || '').toString().trim().toUpperCase(),
            data: n['data'] || 'N/A'
        };
    });

    // Atualiza contadores para os gráficos
    dadosProcessados.forEach(row => {
        for (let config of tableConfig) {
            if (row.status.includes(config.status) || config.status.includes(row.status)) {
                currentCounts[config.status]++;
                break;
            }
        }
    });

    renderSetores();
    updateDashboard();
}

function renderSetores() {
    const container = document.getElementById('setoresContainer');
    container.innerHTML = '';
    const setores = [...new Set(tableConfig.map(c => c.setor))];

    setores.forEach(setor => {
        const pedidosDoSetor = dadosProcessados.filter(p => 
            tableConfig.find(c => c.setor === setor && (p.status.includes(c.status) || c.status.includes(p.status)))
        );

        const div = document.createElement('div');
        div.className = "bg-white p-6 rounded-lg shadow-md border-t-4 border-blue-900";
        div.innerHTML = `
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-xl font-bold text-blue-900 uppercase">${setor}</h2>
                <button onclick="copiarDadosSetor('${setor}')" class="text-xs bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded font-bold">📋 Copiar Dados</button>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-sm text-left">
                    <thead class="bg-gray-100"><tr><th class="p-2">Pedido</th><th class="p-2">Status</th><th class="p-2">Data</th></tr></thead>
                    <tbody>
                        ${pedidosDoSetor.map(p => `
                            <tr class="border-b ${p.status.includes('RETIDO') || p.status.includes('PENDENTE') ? 'bg-red-50 text-red-800 font-bold' : ''}">
                                <td class="p-2">${p.pedido}</td>
                                <td class="p-2">${p.status}</td>
                                <td class="p-2">${p.data}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        container.appendChild(div);
    });
}

// Função para copiar dados de um setor específico para o Clipboard
window.copiarDadosSetor = function(setor) {
    const pedidosDoSetor = dadosProcessados.filter(p => 
        tableConfig.find(c => c.setor === setor && (p.status.includes(c.status) || c.status.includes(p.status)))
    );
    
    let textoCopia = "Pedido\tStatus\tData\n";
    pedidosDoSetor.forEach(p => textoCopia += `${p.pedido}\t${p.status}\t${p.data}\n`);
    
    navigator.clipboard.writeText(textoCopia).then(() => {
        alert(`Dados do setor ${setor} copiados! Basta colar no Excel/Sheets.`);
    });
}