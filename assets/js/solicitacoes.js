/**
 * Lógica da Página de Solicitações de Compra - Sistema de Compras
 * VERSÃO COM CAMPO "TAMANHO" OBRIGATÓRIO
 */

let itensDaSolicitacao = [];

/**
 * Converte um ficheiro para uma string Base64.
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

/**
 * Gera um PDF para a solicitação de compra, incluindo imagens.
 * @param {object} data Os dados completos da solicitação.
 */
async function generateSolicitacaoPDF(data) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const emeraldColor = [5, 150, 105]; // Cor Esmeralda (#059669)

    // Cabeçalho do PDF
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(emeraldColor[0], emeraldColor[1], emeraldColor[2]);
    doc.text('Solicitação de Compra', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(`Nº da Solicitação: ${data.id}`, 190, 28, { align: 'right' });
    doc.text(`Data: ${new Date(data.data_solicitacao + 'T00:00:00').toLocaleDateString('pt-BR')}`, 190, 35, { align: 'right' });

    // Detalhes do Solicitante
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Detalhes do Solicitante', 14, 50);
    doc.autoTable({
        startY: 55,
        theme: 'plain',
        styles: { fontSize: 10 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 35 } },
        body: [
            ['Nome:', data.solicitante_nome],
            ['Email:', data.solicitante_email],
            ['Setor:', data.solicitante_setor],
            ['Justificativa:', data.justificativa || 'Nenhuma'],
        ]
    });

    // Tabela de Itens
    let finalY = doc.autoTable.previous.finalY;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Itens Solicitados', 14, finalY + 15);
    doc.autoTable({
        startY: finalY + 20,
        head: [['Qtd.', 'Un.', 'Tamanho', 'Descrição do Item']],
        body: data.itens.map(item => [item.quantidade, item.unidade_medida, item.tamanho, item.descricao_item]),
        theme: 'grid',
        headStyles: { fillColor: emeraldColor },
        styles: { fontSize: 9 }
    });

    // NOVA SECÇÃO: Imagens de Referência
    finalY = doc.autoTable.previous.finalY;
    const hasPhotos = data.itens.some(item => item.fotos && item.fotos.length > 0);

    if (hasPhotos) {
        if (finalY > 230) { // Verifica se precisa de uma nova página
            doc.addPage();
            finalY = 20;
        } else {
            finalY += 15;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Imagens de Referência', 14, finalY);
        finalY += 10;

        for (const item of data.itens) {
            if (item.fotos && item.fotos.length > 0) {
                if (finalY > 250) {
                    doc.addPage();
                    finalY = 20;
                }
                
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.text(`Item: ${item.descricao_item}`, 14, finalY);
                finalY += 7;

                let currentX = 14;
                for (const base64Image of item.fotos) {
                    try {
                        const imgProps = doc.getImageProperties(base64Image);
                        const imgWidth = 45; // Largura fixa para a imagem
                        const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

                        if (finalY + imgHeight > 280) { // Verifica espaço na página
                            doc.addPage();
                            finalY = 20;
                            currentX = 14;
                        }
                        
                        doc.addImage(base64Image, 'JPEG', currentX, finalY, imgWidth, imgHeight);
                        
                        currentX += imgWidth + 5;
                        if (currentX > 160) { // Quebra a linha de imagens
                            currentX = 14;
                            finalY += imgHeight + 5;
                        }
                    } catch(e) {
                        console.error("Erro ao adicionar imagem ao PDF: ", e);
                        doc.setFontSize(8);
                        doc.setTextColor(255, 0, 0);
                        doc.text('Erro ao carregar imagem', currentX, finalY + 10);
                        doc.setTextColor(0, 0, 0);
                    }
                }
                finalY += 50; // Espaço para o próximo item
            }
        }
    }

    // Salva o ficheiro PDF
    doc.save(`Solicitacao-de-Compra-${data.id}.pdf`);
}


function renderItensList() {
    const list = document.getElementById('item-list');
    list.innerHTML = itensDaSolicitacao.map((item, index) => `
        <li style="display: block; padding: 10px; border-bottom: 1px solid #eee;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span><strong>${item.quantidade} ${item.unidade_medida || 'Un'}</strong> - ${item.descricao_item} (${item.tamanho})</span>
                <button type="button" class="btn-icon btn-delete" data-index="${index}" title="Remover Item"><i class="fas fa-trash"></i></button>
            </div>
            ${item.fotos && item.fotos.length > 0 ? `
                <div style="display: flex; gap: 5px; margin-top: 5px;">
                    ${item.fotos.map(fotoSrc => `<img src="${fotoSrc}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;">`).join('')}
                </div>
            ` : ''}
        </li>
    `).join('');
    list.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = e.currentTarget.dataset.index;
            itensDaSolicitacao.splice(index, 1);
            renderItensList();
        });
    });
}

async function addSolicitacaoModalListeners() {
    document.getElementById('form-add-item').addEventListener('submit', async (e) => {
        e.preventDefault();
        const descricaoInput = document.getElementById('item-descricao');
        const tamanhoInput = document.getElementById('item-tamanho'); // NOVO
        const quantidadeInput = document.getElementById('item-quantidade');
        const unidadeInput = document.getElementById('item-unidade');
        const fotosInput = document.getElementById('item-fotos');

        if (!descricaoInput.value.trim()) {
            showToast('A descrição do item é obrigatória.', 'error');
            return;
        }
        // VALIDAÇÃO DO NOVO CAMPO
        if (!tamanhoInput.value.trim()) {
            showToast('O tamanho do item é obrigatório.', 'error');
            return;
        }

        const newItem = {
            descricao_item: descricaoInput.value.trim(),
            tamanho: tamanhoInput.value.trim(), // NOVO
            quantidade: quantidadeInput.value,
            unidade_medida: unidadeInput.value.trim(),
            fotos: []
        };

        if (fotosInput.files.length > 0) {
            const promises = Array.from(fotosInput.files).map(fileToBase64);
            try {
                newItem.fotos = await Promise.all(promises);
            } catch (error) {
                showToast('Erro ao ler os ficheiros de imagem.', 'error');
                return;
            }
        }
        
        itensDaSolicitacao.push(newItem);
        renderItensList();
        e.target.reset();
        descricaoInput.focus();
    });
}

async function renderSolicitacaoModal() {
    itensDaSolicitacao = [];

    const produtosResponse = await apiRequest('produtos_almoxarifado_handler.php', { action: 'get_all' });
    let produtosDatalistOptions = '';
    if (produtosResponse.success && Array.isArray(produtosResponse.data.produtos)) {
        produtosDatalistOptions = produtosResponse.data.produtos.map(p => `<option value="${p.produto}"></option>`).join('');
    }

    const modalHtml = `
        <form id="form-solicitacao">
            <div class="form-grid">
                <div class="form-group"><label for="solicitante_nome">Seu Nome</label><input type="text" id="solicitante_nome" name="solicitante_nome" required></div>
                <div class="form-group"><label for="solicitante_setor">Seu Setor</label><input type="text" id="solicitante_setor" name="solicitante_setor" required></div>
                <div class="form-group" style="grid-column: 1 / -1;"><label for="justificativa">Justificativa da Compra</label><textarea id="justificativa" name="justificativa" rows="3"></textarea></div>
            </div>
        </form>
        <hr style="margin: 20px 0;">
        <h4>Itens da Solicitação</h4>
        <form id="form-add-item" class="form-grid" style="align-items: flex-end; gap: 15px;">
            <div class="form-group" style="grid-column: 1 / -1;">
                <label>Descrição do Item</label>
                <input type="text" id="item-descricao" list="produtos-sugestoes" placeholder="Selecione ou digite um produto...">
                <datalist id="produtos-sugestoes">${produtosDatalistOptions}</datalist>
            </div>
            
            <!-- CAMPOS NA MESMA LINHA -->
            <div class="form-group"><label>Tamanho</label><input type="text" id="item-tamanho" placeholder="Ex: 10mm, 2 Polegadas, P" required></div>
            <div class="form-group"><label>Quantidade</label><input type="number" id="item-quantidade" min="1" value="1"></div>
            <div class="form-group"><label>Unidade</label><input type="text" id="item-unidade" placeholder="Ex: Un, Pç, Cx"></div>

            <div class="form-group" style="grid-column: 1 / -1;"><label for="item-fotos">Adicionar Fotos (Opcional)</label><input type="file" id="item-fotos" multiple accept="image/jpeg, image/png, image/gif"></div>
            <div class="form-group"><button type="submit" class="btn btn-secondary"><i class="fas fa-plus"></i> Adicionar Item</button></div>
        </form>
        <ul id="item-list"></ul>
    `;
    
    const saveButton = {
        text: '<i class="fas fa-save"></i> Salvar Solicitação',
        className: 'btn-primary',
        onClick: async () => {
             const form = document.getElementById('form-solicitacao');
            if (!form.checkValidity()) {
                showToast('Por favor, preencha seu nome e setor.', 'error');
                form.reportValidity();
                return;
            }
            if (itensDaSolicitacao.length === 0) {
                showToast('Adicione pelo menos um item à solicitação.', 'error');
                return;
            }
            
            const data = Object.fromEntries(new FormData(form));
            data.action = 'create';
            data.itens = itensDaSolicitacao;

            const response = await apiRequest('solicitacoes_handler.php', data);
            showToast(response.message, response.success ? 'success' : 'error');
            if (response.success) {
                document.querySelector('.modal-close-btn').click();
                renderSolicitacoesTable();
            }
        }
    };

    showContentModal('Nova Solicitação de Compra', modalHtml, 'modal-lg', [saveButton]);
    addSolicitacaoModalListeners();
}


async function renderSolicitacoesTable() {
    const tableContent = document.getElementById('table-content');
    tableContent.innerHTML = '<div class="loading-spinner"></div>';
    
    const response = await apiRequest('solicitacoes_handler.php', { action: 'get_all' });
    
    if (response.success && Array.isArray(response.data.solicitacoes)) {
        const solicitacoes = response.data.solicitacoes;
        tableContent.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr><th>ID</th><th>Solicitante</th><th>Setor</th><th>Data</th><th>Itens</th><th>Status</th><th>Ações</th></tr>
                </thead>
                <tbody>
                    ${solicitacoes.length > 0 ? solicitacoes.map(s => {
                         const statusClass = (s.status || 'N/D').replace(/\s+/g, '_');
                         let actionButtons = `<button class="btn-icon btn-view" data-id="${s.id}" title="Ver Detalhes"><i class="fas fa-eye"></i></button>`;

                        if (window.isFullAdmin && s.status === 'Pendente de Aprovação') {
                            actionButtons += `
                                <button class="btn-icon btn-success" data-id="${s.id}" data-status="Aprovado pelo Gerente" title="Aprovar"><i class="fas fa-check"></i></button>
                                <button class="btn-icon btn-danger" data-id="${s.id}" data-status="Rejeitado" title="Rejeitar"><i class="fas fa-times"></i></button>
                            `;
                        }
                        if (s.status === 'Ordem Gerada' && s.solicitante_email === window.userEmail) {
                            actionButtons += `<button class="btn btn-success" data-id="${s.id}" data-action="confirm-delivery" style="font-size: 0.8rem; padding: 5px 10px;">Confirmar Entrega</button>`;
                        }

                        return `
                            <tr>
                                <td data-label="ID">#${s.id || ''}</td>
                                <td data-label="Solicitante">${s.solicitante_nome || 'N/D'}</td>
                                <td data-label="Setor">${s.solicitante_setor || 'N/D'}</td>
                                <td data-label="Data">${new Date(s.data_solicitacao + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                                <td data-label="Itens">${s.total_itens || 0}</td>
                                <td data-label="Status"><span class="status-badge status-${statusClass}">${s.status || 'N/D'}</span></td>
                                <td data-label="Ações" class="actions-cell">${actionButtons}</td>
                            </tr>
                        `;
                    }).join('') : '<tr><td colspan="7" style="text-align:center;">Nenhuma solicitação encontrada.</td></tr>'}
                </tbody>
            </table>
        `;
        addSolicitacoesTableListeners();
    } else {
        tableContent.innerHTML = `<p class="error-message">${response.message || 'Falha ao carregar solicitações.'}</p>`;
    }
}

function addSolicitacoesTableListeners() {
    document.getElementById('table-content').addEventListener('click', async (e) => {
        const targetButton = e.target.closest('button');
        if (!targetButton) return;

        const id = targetButton.dataset.id;

        if (targetButton.classList.contains('btn-view')) {
            const response = await apiRequest('solicitacoes_handler.php', { action: 'get_details', id });
            if (response.success && response.data) {
                const s = response.data.solicitacao;
                const detailsHtml = `
                    <div class="details-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px 25px; margin-bottom: 20px;">
                        <div class="details-group"><label>Solicitante</label><p>${s.solicitante_nome}</p></div>
                        <div class="details-group"><label>Email</label><p>${s.solicitante_email}</p></div>
                        <div class="details-group"><label>Setor</label><p>${s.solicitante_setor}</p></div>
                        <div class="details-group"><label>Data</label><p>${new Date(s.data_solicitacao + 'T00:00:00').toLocaleDateString('pt-BR')}</p></div>
                        <div class="details-group" style="grid-column: 1 / -1;"><label>Status</label><p><span class="status-badge status-${(s.status || '').replace(/\s+/g, '_')}">${s.status}</span></p></div>
                        <div class="details-group" style="grid-column: 1 / -1;"><label>Justificativa</label><p>${s.justificativa || 'Nenhuma'}</p></div>
                         ${s.nota_fiscal ? `<div class="details-group"><label>Nota Fiscal</label><p>${s.nota_fiscal}</p></div>` : ''}
                        ${s.observacao_entrega ? `<div class="details-group" style="grid-column: 1 / -1;"><label>Observação de Entrega</label><p>${s.observacao_entrega}</p></div>` : ''}
                    </div>
                    <hr>
                    <h4 style="margin-top: 20px;">Itens Solicitados</h4>
                    <ul style="list-style: none; padding: 0; margin-top: 15px;">
                        ${s.itens.map(item => `
                            <li style="padding: 15px 0; border-bottom: 1px solid #eee;">
                                <strong>${item.quantidade} ${item.unidade_medida || ''}</strong> - ${item.descricao_item} <strong>(Tamanho: ${item.tamanho})</strong>
                                ${item.fotos && item.fotos.length > 0 ? `
                                    <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px;">
                                        ${item.fotos.map(foto => `<a href="${foto}" target="_blank"><img src="${foto}" alt="Foto do item" style="width: 80px; height: 80px; object-fit: cover; border-radius: 5px;"></a>`).join('')}
                                    </div>
                                ` : '<p style="font-size: 0.8rem; color: #888; margin-top: 5px;">Nenhuma foto anexada.</p>'}
                            </li>
                        `).join('')}
                    </ul>
                `;
                
                const pdfButton = { text: '<i class="fas fa-file-pdf"></i> Baixar PDF', className: 'btn-primary', onClick: () => generateSolicitacaoPDF(s) };
                showContentModal(`Detalhes da Solicitação #${s.id}`, detailsHtml, 'modal-lg', [pdfButton]);
            }
        } else if (targetButton.dataset.status) {
            const status = targetButton.dataset.status;
            const confirmed = await showConfirmModal('Confirmar Ação', `Tem a certeza que deseja alterar o status para "${status}"?`);
            if (confirmed) {
                const response = await apiRequest('solicitacoes_handler.php', { action: 'update_status', id, status });
                showToast(response.message, response.success ? 'success' : 'error');
                if (response.success) renderSolicitacoesTable();
            }
        } else if (targetButton.dataset.action === 'confirm-delivery') {
            const { value: formValues } = await Swal.fire({
                title: 'Confirmar Recebimento',
                html: `
                    <div style="text-align: left;">
                        <div class="form-group">
                            <label for="swal-nota-fiscal" style="margin-bottom: 8px; font-weight: 600;">Nota Fiscal (Opcional)</label>
                            <input id="swal-nota-fiscal" class="swal2-input" placeholder="Número da NF" style="width: 95%;">
                        </div>
                        <div class="form-group" style="margin-top: 15px;">
                            <label for="swal-observacao" style="margin-bottom: 8px; font-weight: 600;">Observações (Opcional)</label>
                            <textarea id="swal-observacao" class="swal2-textarea" placeholder="Ex: Material entregue em perfeitas condições." style="width: 95%;"></textarea>
                        </div>
                    </div>`,
                focusConfirm: false,
                showCancelButton: true,
                confirmButtonText: 'Confirmar Entrega',
                cancelButtonText: 'Cancelar',
                preConfirm: () => {
                    return {
                        nota_fiscal: document.getElementById('swal-nota-fiscal').value,
                        observacao: document.getElementById('swal-observacao').value
                    }
                }
            });

            if (formValues) {
                const response = await apiRequest('solicitacoes_handler.php', {
                    action: 'mark_as_delivered',
                    id: id,
                    nota_fiscal: formValues.nota_fiscal,
                    observacao: formValues.observacao
                });
                showToast(response.message, response.success ? 'success' : 'error');
                if (response.success) {
                    renderSolicitacoesTable();
                }
            }
        }
    });
}

async function loadSolicitacoes() {
    const isManagementView = window.isFullAdmin || window.isPurchasing;
    let title = "Meus Pedidos";
    if (window.isFullAdmin) {
        title = "Gerir Solicitações";
    } else if (window.isPurchasing) {
        title = "Gerir Solicitações Aprovadas";
    }

    appContent.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3>${title}</h3>
                <button class="btn btn-primary" id="btn-nova-solicitacao"><i class="fas fa-plus"></i> Novo Pedido</button>
            </div>
            <div id="table-content" class="table-wrapper">
                <div class="loading-spinner"></div>
            </div>
        </div>
    `;

    renderSolicitacoesTable();
    
    document.getElementById('btn-nova-solicitacao').addEventListener('click', () => {
        renderSolicitacaoModal();
    });
}

