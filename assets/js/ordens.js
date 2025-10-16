/**
 * Lógica da Página de Ordens de Compra - Sistema de Compras
 *
 * VERSÃO COM CAMPO DE PESQUISA DE FORNECEDOR
 */

// Variável global para a instância do seletor de pesquisa
let choicesInstance = null;

async function loadOrdens() {
    appContent.innerHTML = `
        <div class="page-container">
            <div class="card" id="pending-requests-container">
                <div class="card-header">
                    <h3>Solicitações Aprovadas - Aguardando Ordem de Compra</h3>
                </div>
                <div id="pending-table-content" class="table-wrapper">
                    <div class="loading-spinner"></div>
                </div>
            </div>
            <div class="card">
                <div class="card-header">
                    <h3>Ordens de Compra Emitidas</h3>
                    <button class="btn btn-secondary" id="btn-nova-ordem">
                        <i class="fas fa-plus"></i> Gerar Ordem Manualmente
                    </button>
                </div>
                <div id="table-content" class="table-wrapper">
                    <div class="loading-spinner"></div>
                </div>
            </div>
        </div>
    `;
    renderPendingRequestsTable();
    renderOrdensTable();
    
    document.getElementById('btn-nova-ordem').addEventListener('click', () => {
        renderOrdemModal();
    });
}

async function renderPendingRequestsTable() {
    const container = document.getElementById('pending-table-content');
    const response = await apiRequest('solicitacoes_handler.php', { 
        action: 'get_all', 
        status: 'Aprovado pelo Gerente' 
    });

    if (response.success && response.data) {
        if (response.data.solicitacoes.length === 0) {
            container.innerHTML = `<p style="text-align:center; padding: 20px;">Não há solicitações aprovadas aguardando uma ordem de compra.</p>`;
            return;
        }
        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>ID da Solicitação</th>
                        <th>Solicitante</th>
                        <th>Data</th>
                        <th>Itens</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${response.data.solicitacoes.map(s => `
                        <tr>
                            <td data-label="ID">#${s.id}</td>
                            <td data-label="Solicitante">${s.solicitante_nome}</td>
                            <td data-label="Data">${new Date(s.data_solicitacao + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                            <td data-label="Itens">${s.total_itens}</td>
                            <td data-label="Ações" class="actions-cell">
                                <button class="btn-icon btn-view" data-id="${s.id}" data-action="visualizar-solicitacao" title="Visualizar Detalhes"><i class="fas fa-eye"></i></button>
                                <button class="btn btn-success" data-id="${s.id}" data-action="gerar-ordem" style="font-size: 0.8rem; padding: 5px 10px;"><i class="fas fa-file-invoice-dollar"></i> Gerar OC</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        container.addEventListener('click', async (e) => {
            const targetButton = e.target.closest('button');
            if (!targetButton) return;

            const id = targetButton.dataset.id;
            const action = targetButton.dataset.action;

            if (action === 'gerar-ordem') {
                renderOrdemModal(id);
            } else if (action === 'visualizar-solicitacao') {
                const response = await apiRequest('solicitacoes_handler.php', { action: 'get_details', id });
                if (response.success && response.data) {
                    const s = response.data.solicitacao;
                    const detailsHtml = `
                        <div class="details-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px 25px; margin-bottom: 20px;">
                            <div class="details-group"><label>Solicitante</label><p>${s.solicitante_nome}</p></div>
                            <div class="details-group"><label>Email</label><p>${s.solicitante_email}</p></div>
                            <div class="details-group"><label>Setor</label><p>${s.solicitante_setor}</p></div>
                            <div class="details-group"><label>Data</label><p>${new Date(s.data_solicitacao + 'T00:00:00').toLocaleDateString('pt-BR')}</p></div>
                            <div class="details-group" style="grid-column: 1 / -1;"><label>Status</label><p><span class="status-badge status-${s.status.replace(/\s+/g, '_')}">${s.status}</span></p></div>
                            <div class="details-group" style="grid-column: 1 / -1;"><label>Justificativa</label><p>${s.justificativa || 'Nenhuma'}</p></div>
                        </div>
                        <hr>
                        <h4 style="margin-top: 20px;">Itens Solicitados</h4>
                        <ul style="list-style: none; padding: 0; margin-top: 15px;">
                            ${s.itens.map(item => `
                                <li style="padding: 15px 0; border-bottom: 1px solid #eee;">
                                    <strong>${item.quantidade} ${item.unidade_medida || ''}</strong> - ${item.descricao_item}
                                    ${item.fotos && item.fotos.length > 0 ? `
                                        <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px;">
                                            ${item.fotos.map(foto => `<a href="${foto}" target="_blank"><img src="${foto}" alt="Foto do item" style="width: 80px; height: 80px; object-fit: cover; border-radius: 5px;"></a>`).join('')}
                                        </div>
                                    ` : ''}
                                </li>
                            `).join('')}
                        </ul>
                    `;
                    
                    const pdfButton = {
                        text: '<i class="fas fa-file-pdf"></i> Baixar PDF da Solicitação',
                        className: 'btn-primary',
                        onClick: () => generateSolicitacaoPDF(s)
                    };

                    showContentModal(`Detalhes da Solicitação #${s.id}`, detailsHtml, 'modal-lg', [pdfButton]);
                }
            }
        });
    } else {
        container.innerHTML = `<p class="error-message">${response.message}</p>`;
    }
}

async function renderOrdensTable() {
    const tableContent = document.getElementById('table-content');
    tableContent.innerHTML = '<div class="loading-spinner"></div>';
    
    const response = await apiRequest('ordens_handler.php', { action: 'get_all' });
    
    if (response.success && response.data) {
        tableContent.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>ID da Ordem</th>
                        <th>Fornecedor</th>
                        <th>Data de Emissão</th>
                        <th>Valor Total</th>
                        <th>Status</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${response.data.ordens.map(o => `
                        <tr>
                            <td data-label="ID">#${o.id}</td>
                            <td data-label="Fornecedor">${o.fornecedor_nome}</td>
                            <td data-label="Data">${new Date(o.data_emissao + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                            <td data-label="Valor">${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(o.valor_total)}</td>
                            <td data-label="Status"><span class="status-badge status-${o.status.replace(/\s+/g, '_')}">${o.status}</span></td>
                            <td data-label="Ações" class="actions-cell">
                                <button class="btn-icon btn-view" data-id="${o.id}" data-action="visualizar-ordem" title="Visualizar Detalhes"><i class="fas fa-eye"></i></button>
                            </td>
                        </tr>
                    `).join('') || '<tr><td colspan="6" style="text-align:center;">Nenhuma ordem de compra encontrada.</td></tr>'}
                </tbody>
            </table>
        `;
        tableContent.addEventListener('click', async (e) => {
            const targetButton = e.target.closest('button[data-action="visualizar-ordem"]');
            if(targetButton) {
                const id = targetButton.dataset.id;
                renderOrdemDetailsModal(id);
            }
        });
    } else {
        tableContent.innerHTML = `<p class="error-message">${response.message}</p>`;
    }
}

async function renderOrdemDetailsModal(ordemId) {
    const response = await apiRequest('ordens_handler.php', { action: 'get_details', id: ordemId });

    if (!response.success) {
        showToast(response.message, 'error');
        return;
    }
    
    const d = response.data.details;
    const detailsHtml = `
        <div id="ordem-pdf-content">
            <style>
                .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px 25px; margin-bottom: 20px; }
                .details-group { font-size: 0.9rem; }
                .details-group label { font-weight: 600; color: var(--cor-texto-claro); display: block; margin-bottom: 3px; }
                .details-group p { margin: 0; color: var(--cor-texto-principal); }
                .full-width { grid-column: 1 / -1; }
            </style>
            <h4>Dados do Fornecedor</h4>
            <div class="details-grid">
                <div class="details-group"><label>Nome Fantasia</label><p>${d.fornecedor_nome_fantasia}</p></div>
                <div class="details-group"><label>CNPJ</label><p>${d.fornecedor_cnpj}</p></div>
                <div class="details-group"><label>Contato</label><p>${d.fornecedor_contato || 'N/D'}</p></div>
                <div class="details-group"><label>Email</label><p>${d.fornecedor_email || 'N/D'}</p></div>
            </div>
            <hr style="margin: 20px 0;">
            <h4>Dados da Solicitação Original</h4>
            <div class="details-grid">
                <div class="details-group"><label>Solicitante</label><p>${d.solicitante_nome}</p></div>
                <div class="details-group"><label>Setor</label><p>${d.solicitante_setor}</p></div>
                <div class="details-group full-width"><label>Justificativa</label><p>${d.justificativa || 'Nenhuma'}</p></div>
            </div>
            <hr style="margin: 20px 0;">
            <h4>Itens</h4>
            <ul style="list-style: none; padding: 0; margin-top: 15px;">
                ${d.itens.map(item => `<li style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>${item.quantidade} ${item.unidade_medida || ''}</strong> - ${item.descricao_item}</li>`).join('')}
            </ul>
            <hr style="margin: 20px 0;">
             <h4>Condições Comerciais</h4>
             <div class="details-grid">
                <div class="details-group"><label>Valor Total</label><p><strong>${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(d.valor_total)}</strong></p></div>
                <div class="details-group"><label>Condições de Pagamento</label><p>${d.condicoes_pagamento}</p></div>
                <div class="details-group full-width"><label>Observações</label><p>${d.observacoes || 'Nenhuma'}</p></div>
            </div>
        </div>
    `;
    
    const pdfButton = {
        text: '<i class="fas fa-file-pdf"></i> Baixar PDF',
        className: 'btn-primary',
        onClick: () => generateOrderPDF(d)
    };
    
    showContentModal(
        `Detalhes da Ordem de Compra #${d.ordem_id}`,
        detailsHtml,
        'modal-lg',
        [pdfButton]
    );
}

function generateOrderPDF(data) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const emeraldColor = [5, 150, 105];

    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(emeraldColor[0], emeraldColor[1], emeraldColor[2]);
    doc.text('Ordem de Compra', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(`OC Nº: ${data.ordem_id}`, 190, 28, { align: 'right' });
    doc.text(`Data de Emissão: ${new Date(data.data_emissao + 'T00:00:00').toLocaleDateString('pt-BR')}`, 190, 35, { align: 'right' });

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Fornecedor', 14, 50);
    doc.autoTable({
        startY: 55,
        head: [['Razão Social', 'Nome Fantasia', 'CNPJ']],
        body: [[data.fornecedor_razao_social, data.fornecedor_nome_fantasia, data.fornecedor_cnpj]],
        theme: 'striped',
        styles: { fontSize: 9 },
        headStyles: { fillColor: emeraldColor }
    });

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Itens Solicitados', 14, doc.autoTable.previous.finalY + 15);
    doc.autoTable({
        startY: doc.autoTable.previous.finalY + 20,
        head: [['Qtd.', 'Un.', 'Descrição do Item']],
        body: data.itens.map(item => [item.quantidade, item.unidade_medida, item.descricao_item]),
        theme: 'grid',
        headStyles: { fillColor: emeraldColor },
        styles: { fontSize: 9 }
    });
    
    const finalY = doc.autoTable.previous.finalY;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Valor Total:', 14, finalY + 15);
    doc.setFont('helvetica', 'normal');
    doc.text(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.valor_total), 45, finalY + 15);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Condições de Pagamento:', 14, finalY + 22);
    doc.setFont('helvetica', 'normal');
    doc.text(data.condicoes_pagamento, 70, finalY + 22);

    if(data.observacoes) {
        doc.setFont('helvetica', 'bold');
        doc.text('Observações:', 14, finalY + 29);
        doc.setFont('helvetica', 'normal');
        doc.text(data.observacoes, 48, finalY + 29);
    }
    
    doc.save(`Ordem-de-Compra-${data.ordem_id}.pdf`);
}


async function renderOrdemModal(solicitacaoId = null) {
    showContentModal('Gerar Nova Ordem de Compra', '<div class="loading-spinner"></div>', 'modal-lg');

    const solicitacoesResponse = await apiRequest('solicitacoes_handler.php', { action: 'get_all', status: 'Aprovado pelo Gerente' });
    
    if (!solicitacoesResponse.success) {
        document.querySelector('.modal-close-btn')?.click();
        showToast('Erro ao carregar as solicitações.', 'error');
        return;
    }

    const solicitacoesAprovadas = solicitacoesResponse.data.solicitacoes || [];
    let solicitacoesOptions = '<option value="">Selecione uma solicitação aprovada...</option>';
    solicitacoesAprovadas.forEach(s => {
        const isSelected = s.id == solicitacaoId ? 'selected' : '';
        solicitacoesOptions += `<option value="${s.id}" ${isSelected}>#${s.id} - ${s.solicitante_nome} (${s.total_itens} itens)</option>`;
    });
    
    const modalHtml = `
        <form id="form-ordem">
            <div class="form-grid">
                <div class="form-group" style="grid-column: 1 / -1;"><label for="solicitacao_id">Solicitação de Compra (Aprovada)</label><select id="solicitacao_id" name="solicitacao_id" required ${solicitacaoId ? 'disabled' : ''}>${solicitacoesOptions}</select></div>
                <div class="form-group"><label for="fornecedor_id">Fornecedor</label><select id="fornecedor_id" name="fornecedor_id" required></select></div>
                <div class="form-group"><label for="valor_total">Valor Total (R$)</label><input type="number" id="valor_total" name="valor_total" step="0.01" min="0.01" required></div>
                <div class="form-group" style="grid-column: 1 / -1;"><label for="condicoes_pagamento">Condições de Pagamento</label><input type="text" id="condicoes_pagamento" name="condicoes_pagamento" placeholder="Ex: 30 dias, 50% adiantado"></div>
                <div class="form-group" style="grid-column: 1 / -1;"><label for="observacoes">Observações</label><textarea id="observacoes" name="observacoes" rows="3"></textarea></div>
            </div>
            <div class="modal-footer" style="padding: 15px 0 0 0; margin-top: 20px; border-radius: 0;"><button type="button" class="btn btn-secondary" id="modal-cancel-ordem">Cancelar</button><button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Gerar Ordem</button></div>
        </form>
    `;
    
    const modalBody = document.querySelector('.modal-content .modal-body');
    if (modalBody) {
        modalBody.innerHTML = modalHtml;
        
        // --- INICIALIZAÇÃO DO CAMPO DE PESQUISA ---
        const fornecedorSelect = document.getElementById('fornecedor_id');
        if (choicesInstance) {
            choicesInstance.destroy();
        }
        choicesInstance = new Choices(fornecedorSelect, {
            placeholder: true,
            placeholderValue: 'Digite para pesquisar um fornecedor...',
            searchPlaceholderValue: 'Digite para pesquisar...',
            removeItemButton: true,
            itemSelectText: 'Selecionar',
            loadingText: 'A carregar...',
            // CORREÇÃO: Mensagem mais informativa
            noResultsText: 'Nenhum fornecedor encontrado',
            noChoicesText: 'Comece a digitar para pesquisar fornecedores ativos',
        });

        fornecedorSelect.addEventListener('search', async (event) => {
            const searchTerm = event.detail.value;
            // A pesquisa só é acionada com 2 ou mais caracteres
            if (searchTerm.length < 2) {
                choicesInstance.clearChoices();
                return;
            }

            // Mostra a mensagem de "A carregar..."
            choicesInstance.clearChoices();
            const loadingOption = {
                value: '',
                label: 'A pesquisar...',
                disabled: true,
            };
            choicesInstance.setChoices([loadingOption], 'value', 'label', false);

            const response = await apiRequest('combined_suppliers_handler.php', { search: searchTerm });
            
            if (response.success && response.data.fornecedores.length > 0) {
                const choices = response.data.fornecedores.map(f => {
                    const nome = f.nome_fantasia || f.razao_social;
                    const area = f.area_atuacao ? `(${f.area_atuacao})` : '';
                    return { value: f.id, label: `${nome} ${area}` };
                });
                choicesInstance.setChoices(choices, 'value', 'label', false);
            } else {
                // Se não houver resultados, a mensagem "Nenhum fornecedor encontrado" será exibida
                choicesInstance.clearChoices();
            }
        });

        addOrdemModalListeners();
    }
}

function addOrdemModalListeners() {
    const form = document.getElementById('form-ordem');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const solicitacaoSelect = form.querySelector('#solicitacao_id');
        solicitacaoSelect.disabled = false;
        
        const data = Object.fromEntries(new FormData(form));
        data.action = 'create';

        const response = await apiRequest('ordens_handler.php', data);
        showToast(response.message, response.success ? 'success' : 'error');

        if (response.success) {
            document.querySelector('.modal-close-btn')?.click();
            renderPendingRequestsTable();
            renderOrdensTable();
        } else {
            if (solicitacaoSelect.hasAttribute('disabled')) {
                 solicitacaoSelect.disabled = true;
            }
        }
    });

    document.getElementById('modal-cancel-ordem').addEventListener('click', () => {
        document.querySelector('.modal-close-btn')?.click();
    });
}
