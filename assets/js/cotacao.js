/**
 * Lógica da Página de Cotação de Materiais
 * Versão 2.4 - Correção de UI e Fluxo de Tela
 * Desenvolvido para uma experiência de usuário intuitiva e eficiente.
 */

// Objeto de estado global para gerenciar todos os dados da cotação de forma centralizada.
let cotacaoState = {
    solicitacao_id: null,
    descricao: 'Mapa Comparativo de Cotação',
    produtos: [],       // Array de objetos de produto
    fornecedores: [],   // Array de nomes de fornecedores
    condicoesGerais: {} // Objeto para armazenar frete, entrega, etc., por fornecedor
};

/**
 * Função principal que inicializa a página de cotação.
 */
async function loadCotacao() {
    // Zera o estado para garantir que uma nova cotação comece limpa.
    cotacaoState = {
        solicitacao_id: null,
        descricao: 'Mapa Comparativo de Cotação',
        produtos: [],
        fornecedores: [],
        condicoesGerais: {}
    };

    // Garante que o fundo da página volte ao padrão ao recarregar a view.
    document.querySelector('.main-content').classList.remove('is-creating');

    appContent.innerHTML = `
        <div class="page-container">
            <div id="initial-view">
                <div class="card" id="setup-card">
                    <div class="card-header">
                        <h3>Criar Novo Mapa Comparativo</h3>
                    </div>
                    <div id="cotacao-setup" class="card-body">
                        <!-- Seção de configuração inicial (selecionar solicitação ou começar em branco) -->
                    </div>
                </div>

                <!-- Seção de Histórico de Cotações, visível apenas na tela inicial -->
                <div class="card" id="saved-cotacoes-container">
                     <div class="card-header">
                        <h3>Histórico de Cotações Salvas</h3>
                    </div>
                    <div id="saved-cotacoes-list" class="table-wrapper">
                        <div class="loading-spinner"></div>
                    </div>
                </div>
            </div>

            <div id="creation-view" style="display: none;">
                 <div class="card" id="creation-actions-card">
                    <div class="card-header">
                        <h3>Editando Mapa Comparativo</h3>
                    </div>
                    <div id="cotacao-actions" class="form-actions" style="flex-wrap: wrap; gap: 10px; margin-top: 0; padding: 0 25px 25px;"></div>
                </div>
                <div id="cotacao-grid-container" class="table-wrapper">
                    <!-- O mapa comparativo será renderizado aqui -->
                </div>
            </div>
        </div>
    `;
    renderCotacaoSetup();
    renderSavedCotacoesList(); // Carrega a lista de cotações salvas
}

/**
 * Renderiza a seção de configuração inicial.
 */
async function renderCotacaoSetup() {
    const container = document.getElementById('cotacao-setup');
    const response = await apiRequest('cotacao_handler.php', { action: 'get_solicitacoes_aprovadas' });
    
    let solicitacoesOptions = '<option value="">Iniciar Cotação em Branco</option>';
    if (response.success && response.data.solicitacoes) {
        solicitacoesOptions += response.data.solicitacoes.map(s => 
            `<option value="${s.id}">#${s.id} - ${s.solicitante_nome} (${new Date(s.data_solicitacao + 'T00:00:00').toLocaleDateString('pt-BR')})</option>`
        ).join('');
    }

    container.innerHTML = `
        <p>Selecione uma solicitação de compra aprovada para preencher os itens automaticamente ou inicie uma cotação do zero.</p>
        <div class="form-grid" style="align-items: flex-end; max-width: 600px;">
            <div class="form-group" style="grid-column: 1 / -1;">
                <label for="solicitacao-select">Basear em Solicitação Aprovada (Opcional)</label>
                <select id="solicitacao-select">${solicitacoesOptions}</select>
            </div>
            <div class="form-group">
                <button id="start-cotacao-btn" class="btn btn-primary"><i class="fas fa-play"></i> Iniciar Cotação</button>
            </div>
        </div>
    `;

    document.getElementById('start-cotacao-btn').addEventListener('click', handleStartCotacao);
}

/**
 * Lida com o início da cotação, buscando itens se uma solicitação for selecionada.
 */
async function handleStartCotacao() {
    const solicitacaoId = document.getElementById('solicitacao-select').value;
    cotacaoState.solicitacao_id = solicitacaoId || null;
    
    if (solicitacaoId) {
        const response = await apiRequest('cotacao_handler.php', { action: 'get_itens_solicitacao', solicitacao_id: solicitacaoId });
        if (response.success && response.data.itens) {
            cotacaoState.produtos = response.data.itens.map(item => ({
                descricao: item.descricao_item,
                setor: '',
                unidade: item.unidade_medida || 'Un',
                quantidade: item.quantidade || 1,
                propostas: []
            }));
        }
    } else {
        cotacaoState.produtos.push({ descricao: '', setor: '', unidade: 'Un', quantidade: 1, propostas: [] });
    }

    cotacaoState.fornecedores = ['Fornecedor 1', 'Fornecedor 2', 'Fornecedor 3'];
    
    // Altera a UI para o modo de criação
    document.querySelector('.main-content').classList.add('is-creating');
    document.getElementById('initial-view').style.display = 'none'; 
    document.getElementById('creation-view').style.display = 'block';
    
    renderCotacaoActions();
    renderCotacaoGrid();
}

/**
 * Renderiza os botões de ação principais (Adicionar Produto, Fornecedor, Salvar).
 */
function renderCotacaoActions() {
    const container = document.getElementById('cotacao-actions');
    container.innerHTML = `
        <button id="add-produto-btn" class="btn btn-secondary"><i class="fas fa-plus"></i> Adicionar Produto</button>
        <button id="add-fornecedor-btn" class="btn btn-secondary"><i class="fas fa-truck"></i> Adicionar Fornecedor</button>
        <button id="save-cotacao-btn" class="btn btn-primary"><i class="fas fa-save"></i> Salvar Cotação</button>
        <button id="download-pdf-btn" class="btn btn-success"><i class="fas fa-file-pdf"></i> Baixar PDF</button>
        <button id="cancel-cotacao-btn" class="btn btn-danger"><i class="fas fa-times"></i> Cancelar</button>
    `;

    document.getElementById('add-produto-btn').addEventListener('click', () => {
        cotacaoState.produtos.push({ descricao: '', setor: '', unidade: 'Un', quantidade: 1, propostas: [] });
        renderCotacaoGrid();
    });

    document.getElementById('add-fornecedor-btn').addEventListener('click', () => {
        const newSupplierName = `Fornecedor ${cotacaoState.fornecedores.length + 1}`;
        cotacaoState.fornecedores.push(newSupplierName);
        renderCotacaoGrid();
    });
    
    document.getElementById('save-cotacao-btn').addEventListener('click', handleSaveCotacao);

    document.getElementById('download-pdf-btn').addEventListener('click', () => {
        updateStateFromGrid();
        generateCotacaoPDF(cotacaoState);
    });

    document.getElementById('cancel-cotacao-btn').addEventListener('click', () => {
        loadCotacao(); // Simplesmente recarrega a página de cotação
    });
}

/**
 * Renderiza a lista de cotações já salvas.
 */
async function renderSavedCotacoesList() {
    const container = document.getElementById('saved-cotacoes-list');
    const response = await apiRequest('cotacao_handler.php', { action: 'get_saved_cotacoes' });

    if (response.success && response.data.cotacoes) {
        if (response.data.cotacoes.length === 0) {
            container.innerHTML = `<p style="text-align:center; padding: 20px;">Nenhuma cotação salva encontrada.</p>`;
            return;
        }
        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Descrição</th>
                        <th>Data</th>
                        <th>Responsável</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${response.data.cotacoes.map(c => `
                        <tr>
                            <td data-label="ID">#${c.id}</td>
                            <td data-label="Descrição">${c.descricao}</td>
                            <td data-label="Data">${new Date(c.data_cotacao + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                            <td data-label="Responsável">${c.responsavel_cotacao}</td>
                            <td data-label="Ações" class="actions-cell">
                                <button class="btn btn-success btn-sm" data-id="${c.id}" data-action="download-saved-pdf">
                                    <i class="fas fa-file-pdf"></i> Baixar PDF
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        container.addEventListener('click', (e) => {
            const button = e.target.closest('button[data-action="download-saved-pdf"]');
            if (button) {
                const cotacaoId = button.dataset.id;
                handleDownloadSavedPdf(cotacaoId);
            }
        });

    } else {
        container.innerHTML = `<p class="error-message">${response.message}</p>`;
    }
}

/**
 * Lida com o download do PDF de uma cotação salva.
 * @param {number} cotacaoId O ID da cotação a ser baixada.
 */
async function handleDownloadSavedPdf(cotacaoId) {
    showToast('A preparar o seu PDF...', 'success');
    const response = await apiRequest('cotacao_handler.php', { action: 'get_cotacao_details_for_pdf', id: cotacaoId });

    if (response.success && response.data.cotacao) {
        generateCotacaoPDF(response.data.cotacao);
    } else {
        showToast(response.message || 'Não foi possível carregar os dados da cotação.', 'error');
    }
}


/**
 * Renderiza o grid/mapa comparativo de cotação.
 */
function renderCotacaoGrid() {
    const container = document.getElementById('cotacao-grid-container');
    
    let headHtml = `
        <th class="produto-header">Produto</th>
        ${cotacaoState.fornecedores.map((nome, index) => `
            <th class="fornecedor-header">
                <input type="text" class="fornecedor-name-input" value="${nome}" data-findex="${index}">
                <button class="btn-icon btn-delete" data-findex="${index}" title="Remover Fornecedor"><i class="fas fa-times-circle"></i></button>
            </th>
        `).join('')}
    `;

    let bodyHtml = cotacaoState.produtos.map((produto, pIndex) => {
        let minValorTotalItem = Infinity;
        produto.propostas.forEach(prop => {
            const valorTotal = (produto.quantidade || 0) * (prop.valor_unitario || 0);
            if (valorTotal > 0 && valorTotal < minValorTotalItem) {
                minValorTotalItem = valorTotal;
            }
        });

        return `
            <tr data-pindex="${pIndex}">
                <td class="produto-cell">
                    <div class="produto-card">
                        <div class="produto-card-header">
                            <i class="fas fa-box-open"></i>
                            <input type="text" class="form-control" placeholder="Descrição do Produto" data-field="descricao" value="${produto.descricao || ''}">
                            <button class="btn-icon btn-delete" data-pindex="${pIndex}" title="Remover Produto"><i class="fas fa-trash"></i></button>
                        </div>
                        <div class="produto-card-body">
                            <div class="form-group">
                                <label>Setor</label>
                                <input type="text" class="form-control" data-field="setor" value="${produto.setor || ''}">
                            </div>
                            <div class="form-group">
                                <label>Un.</label>
                                <input type="text" class="form-control" data-field="unidade" value="${produto.unidade || ''}">
                            </div>
                            <div class="form-group">
                                <label>Qtd.</label>
                                <input type="number" class="form-control" data-field="quantidade" value="${produto.quantidade || 1}" min="1">
                            </div>
                        </div>
                    </div>
                </td>
                ${cotacaoState.fornecedores.map((nomeFornecedor, fIndex) => {
                    const proposta = produto.propostas.find(p => p.fornecedor_nome === nomeFornecedor) || {};
                    const valorTotal = (produto.quantidade || 0) * (proposta.valor_unitario || 0);
                    const isBestPrice = valorTotal > 0 && valorTotal === minValorTotalItem;
                    return `
                        <td class="proposta-cell ${isBestPrice ? 'best-price' : ''}" data-fornecedor-label="${nomeFornecedor}">
                            <div class="form-group">
                                <label>Valor Unit. (R$)</label>
                                <input type="number" step="0.01" class="form-control" data-findex="${fIndex}" data-field="valor_unitario" value="${proposta.valor_unitario || ''}">
                            </div>
                            <div class="total-item">
                                Total: <strong>${valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                            </div>
                        </td>
                    `;
                }).join('')}
            </tr>
        `;
    }).join('');

    const renderFooterRow = (label, field, type = 'text') => {
        return `
            <tr>
                <td class="footer-label">${label}</td>
                ${cotacaoState.fornecedores.map((nomeFornecedor, fIndex) => `
                    <td class="condicoes-cell" data-fornecedor-label="${nomeFornecedor}">
                        <input type="${type}" step="0.01" class="form-control" data-findex="${fIndex}" data-field="${field}" value="${(cotacaoState.condicoesGerais[nomeFornecedor] || {})[field] || ''}">
                    </td>
                `).join('')}
            </tr>
        `;
    };
    
    let minTotalGeral = Infinity;
    const totaisGerais = cotacaoState.fornecedores.map(nome => {
        let total = 0;
        cotacaoState.produtos.forEach(p => {
            const proposta = p.propostas.find(prop => prop.fornecedor_nome === nome);
            if (proposta) {
                total += (p.quantidade || 0) * (proposta.valor_unitario || 0);
            }
        });
        total += parseFloat((cotacaoState.condicoesGerais[nome] || {}).frete_valor || 0);
        if (total > 0 && total < minTotalGeral) {
            minTotalGeral = total;
        }
        return total;
    });

    let footerHtml = `
        ${renderFooterRow('Frete (CIF/FOB)', 'frete_tipo')}
        ${renderFooterRow('Valor do Frete (R$)', 'frete_valor', 'number')}
        ${renderFooterRow('Prazo de Entrega', 'prazo_entrega')}
        ${renderFooterRow('Cond. de Pagamento', 'cond_pagamento')}
        <tr class="total-geral-row">
            <td class="footer-label">TOTAL GERAL</td>
            ${cotacaoState.fornecedores.map((nomeFornecedor, fIndex) => {
                const isBestTotal = totaisGerais[fIndex] > 0 && totaisGerais[fIndex] === minTotalGeral;
                return `<td class="total-geral-cell ${isBestTotal ? 'best-price-total' : ''}" data-fornecedor-label="${nomeFornecedor}">${totaisGerais[fIndex].toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>`;
            }).join('')}
        </tr>
    `;

    container.innerHTML = `
        <table class="cotacao-table">
            <thead><tr>${headHtml}</tr></thead>
            <tbody>${bodyHtml}</tbody>
            <tfoot>${footerHtml}</tfoot>
        </table>
    `;
    addGridListeners();
}

/**
 * Adiciona todos os event listeners necessários para a interatividade do grid.
 */
function addGridListeners() {
    const gridContainer = document.getElementById('cotacao-grid-container');

    gridContainer.addEventListener('change', (e) => {
        if (e.target.matches('input')) {
            updateStateFromGrid();
            renderCotacaoGrid();
        }
    });

    gridContainer.addEventListener('click', (e) => {
        const deleteButton = e.target.closest('.btn-delete');
        if (deleteButton) {
            const { pindex, findex } = deleteButton.dataset;
            if (pindex !== undefined) {
                cotacaoState.produtos.splice(pindex, 1);
            } else if (findex !== undefined) {
                const nomeFornecedor = cotacaoState.fornecedores[findex];
                cotacaoState.fornecedores.splice(findex, 1);
                cotacaoState.produtos.forEach(p => {
                    p.propostas = p.propostas.filter(prop => prop.fornecedor_nome !== nomeFornecedor);
                });
                delete cotacaoState.condicoesGerais[nomeFornecedor];
            }
            renderCotacaoGrid();
        }
    });
}


/**
 * Lê todos os valores da interface e atualiza o objeto `cotacaoState`.
 */
function updateStateFromGrid() {
    // Atualiza nomes dos fornecedores a partir dos inputs no cabeçalho
    document.querySelectorAll('.fornecedor-name-input').forEach((input, findex) => {
        const oldName = cotacaoState.fornecedores[findex];
        const newName = input.value.trim();
        if (newName && newName !== oldName) {
            cotacaoState.fornecedores[findex] = newName;
            // Atualiza o nome em todas as estruturas de dados
            cotacaoState.produtos.forEach(p => {
                const prop = p.propostas.find(pr => pr.fornecedor_nome === oldName);
                if (prop) prop.fornecedor_nome = newName;
            });
            if (cotacaoState.condicoesGerais[oldName]) {
                cotacaoState.condicoesGerais[newName] = cotacaoState.condicoesGerais[oldName];
                delete cotacaoState.condicoesGerais[oldName];
            }
        }
    });

    // Atualiza dados dos produtos e propostas
    document.querySelectorAll('.cotacao-table tbody tr').forEach((row, pIndex) => {
        if (!cotacaoState.produtos[pIndex]) return;

        cotacaoState.produtos[pIndex].descricao = row.querySelector('input[data-field="descricao"]').value;
        cotacaoState.produtos[pIndex].setor = row.querySelector('input[data-field="setor"]').value;
        cotacaoState.produtos[pIndex].unidade = row.querySelector('input[data-field="unidade"]').value;
        cotacaoState.produtos[pIndex].quantidade = parseFloat(row.querySelector('input[data-field="quantidade"]').value) || 1;
        
        const newPropostas = [];
        cotacaoState.fornecedores.forEach((nomeFornecedor, fIndex) => {
            const valorUnitarioInput = row.querySelector(`input[data-findex="${fIndex}"][data-field="valor_unitario"]`);
            if (valorUnitarioInput && valorUnitarioInput.value) {
                newPropostas.push({
                    fornecedor_nome: nomeFornecedor,
                    valor_unitario: parseFloat(valorUnitarioInput.value)
                });
            }
        });
        cotacaoState.produtos[pIndex].propostas = newPropostas;
    });

    // Atualiza dados das condições gerais
    cotacaoState.condicoesGerais = {};
    cotacaoState.fornecedores.forEach((nomeFornecedor, fIndex) => {
        cotacaoState.condicoesGerais[nomeFornecedor] = {
            frete_tipo: document.querySelector(`input[data-findex="${fIndex}"][data-field="frete_tipo"]`).value,
            frete_valor: document.querySelector(`input[data-findex="${fIndex}"][data-field="frete_valor"]`).value,
            prazo_entrega: document.querySelector(`input[data-findex="${fIndex}"][data-field="prazo_entrega"]`).value,
            cond_pagamento: document.querySelector(`input[data-findex="${fIndex}"][data-field="cond_pagamento"]`).value
        };
    });

    // Adiciona as condições gerais a cada proposta de produto para salvar no banco
    cotacaoState.produtos.forEach(produto => {
        produto.propostas.forEach(proposta => {
            const condicoes = cotacaoState.condicoesGerais[proposta.fornecedor_nome] || {};
            Object.assign(proposta, condicoes);
        });
    });
}

/**
 * Lida com o salvamento da cotação, enviando os dados para o backend.
 */
async function handleSaveCotacao() {
    updateStateFromGrid();

    if (cotacaoState.produtos.length === 0 || cotacaoState.fornecedores.length === 0) {
        showToast('Adicione pelo menos um produto e um fornecedor.', 'error');
        return;
    }

    const response = await apiRequest('cotacao_handler.php', { 
        action: 'save_cotacao', 
        cotacao_data: JSON.stringify(cotacaoState) 
    });

    showToast(response.message, response.success ? 'success' : 'error');
    if (response.success) {
        loadCotacao();
    }
}

/**
 * Gera um PDF profissional do mapa comparativo.
 * @param {object} dataToPrint O objeto de estado da cotação a ser impresso.
 */
function generateCotacaoPDF(dataToPrint) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(5, 150, 105);
    doc.text('Mapa Comparativo de Cotação', doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
    
    const head = [
        [{ content: 'Produto', colSpan: 4, styles: { halign: 'center', fontStyle: 'bold' } }],
    ];
    dataToPrint.fornecedores.forEach(nome => {
        head[0].push({ content: nome, colSpan: 2, styles: { halign: 'center', fontStyle: 'bold' } });
    });
    
    const body = [];
    const subHead = ['Descrição', 'Setor', 'Un.', 'Qtd.'];
    dataToPrint.fornecedores.forEach(() => {
        subHead.push('Vlr. Unit.', 'Vlr. Total');
    });
    body.push(subHead);
    
    dataToPrint.produtos.forEach(produto => {
        const row = [produto.descricao, produto.setor, produto.unidade, produto.quantidade];
        dataToPrint.fornecedores.forEach(nome => {
            const proposta = (produto.propostas || []).find(p => p.fornecedor_nome === nome) || {};
            const vlrUnit = proposta.valor_unitario || 0;
            const vlrTotal = vlrUnit * (produto.quantidade || 0);
            row.push(vlrUnit > 0 ? vlrUnit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-');
            row.push(vlrTotal > 0 ? vlrTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-');
        });
        body.push(row);
    });

    const addFooterRow = (label, fieldKey, isCurrency = false) => {
        const row = [{ content: label, colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } }];
        dataToPrint.fornecedores.forEach(nome => {
            let value = (dataToPrint.condicoesGerais[nome] || {})[fieldKey] || (isCurrency ? 0 : '-');
            if (isCurrency) {
                value = parseFloat(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            }
            row.push({ content: value, colSpan: 2, styles: { halign: 'center' } });
        });
        body.push(row);
    };

    addFooterRow('Frete (CIF/FOB)', 'frete_tipo');
    addFooterRow('Valor do Frete', 'frete_valor', true);
    addFooterRow('Prazo de Entrega', 'prazo_entrega');
    addFooterRow('Cond. de Pagamento', 'cond_pagamento');

    const totalRow = [{ content: 'TOTAL GERAL', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold', fillColor: '#e9ecef' } }];
    dataToPrint.fornecedores.forEach(nome => {
        let total = 0;
        dataToPrint.produtos.forEach(p => {
            const proposta = (p.propostas || []).find(prop => prop.fornecedor_nome === nome);
            if (proposta) total += (p.quantidade || 0) * (proposta.valor_unitario || 0);
        });
        total += parseFloat((dataToPrint.condicoesGerais[nome] || {}).frete_valor || 0);
        totalRow.push({ content: total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), colSpan: 2, styles: { halign: 'center', fontStyle: 'bold', fillColor: '#e9ecef' } });
    });
    body.push(totalRow);

    doc.autoTable({
        head: head,
        body: body,
        startY: 25,
        theme: 'grid',
        headStyles: { fillColor: [5, 150, 105], textColor: 255 },
        styles: { fontSize: 8 },
        bodyStyles: { overflow: 'linebreak' },
        columnStyles: { 0: { cellWidth: 40 } },
        didParseCell: function(data) {
            if (data.row.index === 0 && data.row.section === 'body') {
                data.cell.styles.fillColor = '#f8f9fa';
                data.cell.styles.fontStyle = 'bold';
            }
            if (data.cell.text[0].includes('R$')) {
                data.cell.styles.halign = 'right';
            }
        }
    });
    
    doc.save(`Mapa-Cotacao-${new Date().toISOString().slice(0,10)}.pdf`);
}
