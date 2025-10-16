/**
 * Lógica da Página de Gestão de Fornecedores
 *
 * VERSÃO ATUALIZADA PARA MOSTRAR FORNECEDORES DE MÚLTIPLAS FONTES
 */

async function loadFornecedores() {
    appContent.innerHTML = `
        <div class="page-container">
            <div class="card" id="fornecedor-form-container">
                <!-- O formulário será renderizado aqui -->
            </div>
            <div class="card" id="fornecedor-list-container">
                <div class="card-header">
                    <h3>Fornecedores</h3>
                    <div class="search-wrapper">
                        <i class="fas fa-search"></i>
                        <input type="search" id="search-fornecedores-input" class="search-input" placeholder="Pesquisar por nome, CNPJ...">
                    </div>
                </div>
                <div id="table-content" class="table-wrapper">
                    <div class="loading-spinner"></div>
                </div>
            </div>
        </div>
    `;
    renderFornecedorForm();
    renderFornecedoresTable();
    document.getElementById('search-fornecedores-input').addEventListener('input', (e) => {
        clearTimeout(window.searchTimeout);
        window.searchTimeout = setTimeout(() => {
            renderFornecedoresTable(e.target.value);
        }, 300);
    });
}

function renderFornecedorForm(fornecedor = {}) {
    const isEditing = !!fornecedor.id;
    const container = document.getElementById('fornecedor-form-container');
    container.innerHTML = `
        <div class="card-header">
            <h3>${isEditing ? 'Editar Fornecedor' : 'Novo Fornecedor'}</h3>
        </div>
        <form id="form-fornecedor" class="form-grid">
            <input type="hidden" name="id" value="${fornecedor.id || ''}">
            <div class="form-group"><label for="razao_social">Razão Social</label><input type="text" id="razao_social" name="razao_social" value="${fornecedor.razao_social || ''}" required></div>
            <div class="form-group"><label for="nome_fantasia">Nome Fantasia</label><input type="text" id="nome_fantasia" name="nome_fantasia" value="${fornecedor.nome_fantasia || ''}"></div>
            <div class="form-group"><label for="cnpj">CNPJ</label><input type="text" id="cnpj" name="cnpj" value="${fornecedor.cnpj || ''}" required></div>
            <div class="form-group"><label for="area_atuacao">Área de Atuação</label><input type="text" id="area_atuacao" name="area_atuacao" value="${fornecedor.area_atuacao || ''}" placeholder="Ex: Peças, Eletrónicos, Escritório"></div>
            <div class="form-group"><label for="contato_nome">Nome do Contato</label><input type="text" id="contato_nome" name="contato_nome" value="${fornecedor.contato_nome || ''}"></div>
            <div class="form-group"><label for="contato_email">Email do Contato</label><input type="email" id="contato_email" name="contato_email" value="${fornecedor.contato_email || ''}"></div>
            <div class="form-group"><label for="contato_telefone">Telefone do Contato</label><input type="text" id="contato_telefone" name="contato_telefone" value="${fornecedor.contato_telefone || ''}"></div>
            <div class="form-actions">
                <button type="submit" class="btn btn-primary">${isEditing ? '<i class="fas fa-save"></i> Atualizar' : '<i class="fas fa-plus"></i> Adicionar'}</button>
                ${isEditing ? '<button type="button" class="btn btn-secondary" id="cancel-edit">Cancelar</button>' : ''}
            </div>
        </form>
    `;
    addFornecedorFormListeners();
}

async function renderFornecedoresTable(searchTerm = '') {
    const tableContent = document.getElementById('table-content');
    tableContent.innerHTML = '<div class="loading-spinner"></div>';
    
    const response = await apiRequest('fornecedores_handler.php', { action: 'get_all', search: searchTerm });
    
    if (response.success && response.data) {
        tableContent.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Nome Fantasia</th>
                        <th>Origem</th>
                        <th>CNPJ</th>
                        <th>Status</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${response.data.fornecedores.map(f => {
                        // Desativa os botões se o fornecedor for da tabela antiga
                        const isFromFinanceiro = f.source === 'financeiro';
                        const actionsHtml = isFromFinanceiro ? 
                            `<span style="font-size: 0.8rem; color: var(--cor-texto-claro);">Não editável</span>` : 
                            `<button class="btn-icon btn-edit" data-fornecedor='${JSON.stringify(f)}' title="Editar"><i class="fas fa-pencil-alt"></i></button>
                             <button class="btn-icon btn-toggle-status" data-id="${f.id}" title="${f.ativo == 1 ? 'Desativar' : 'Ativar'}">
                                <i class="fas ${f.ativo == 1 ? 'fa-toggle-on' : 'fa-toggle-off'}"></i>
                             </button>`;

                        return `
                        <tr style="${f.ativo == 0 ? 'opacity: 0.6;' : ''}">
                            <td data-label="Nome"><strong>${f.nome_fantasia || f.razao_social}</strong></td>
                            <td data-label="Origem">${f.area_atuacao || 'N/D'}</td>
                            <td data-label="CNPJ">${f.cnpj}</td>
                            <td data-label="Status">
                                <span class="status-badge ${f.ativo == 1 ? 'status-Ordem_Gerada' : 'status-Rejeitado'}">
                                    ${f.ativo == 1 ? 'Ativo' : 'Inativo'}
                                </span>
                            </td>
                            <td data-label="Ações" class="actions-cell">
                                ${actionsHtml}
                            </td>
                        </tr>
                    `}).join('') || '<tr><td colspan="5" style="text-align:center;">Nenhum fornecedor encontrado.</td></tr>'}
                </tbody>
            </table>
        `;
        addFornecedoresTableListeners();
    } else {
        tableContent.innerHTML = `<p class="error-message">${response.message}</p>`;
    }
}

function addFornecedorFormListeners() {
    const form = document.getElementById('form-fornecedor');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        const action = data.id ? 'update' : 'create';
        
        const response = await apiRequest('fornecedores_handler.php', { ...data, action });
        showToast(response.message, response.success ? 'success' : 'error');
        
        if (response.success) {
            renderFornecedorForm();
            renderFornecedoresTable();
        }
    });

    const cancelButton = document.getElementById('cancel-edit');
    if (cancelButton) {
        cancelButton.addEventListener('click', () => renderFornecedorForm());
    }
}

function addFornecedoresTableListeners() {
    document.getElementById('table-content').addEventListener('click', async (e) => {
        const editButton = e.target.closest('.btn-edit');
        if (editButton) {
            const fornecedorData = JSON.parse(editButton.dataset.fornecedor);
            renderFornecedorForm(fornecedorData);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        const toggleButton = e.target.closest('.btn-toggle-status');
        if (toggleButton) {
            const id = toggleButton.dataset.id;
            const actionText = toggleButton.title;
            const confirmed = await showConfirmModal('Confirmar Alteração', `Tem a certeza que deseja ${actionText.toLowerCase()} este fornecedor?`);
            if (confirmed) {
                const response = await apiRequest('fornecedores_handler.php', { action: 'toggle_status', id: id });
                showToast(response.message, response.success ? 'success' : 'error');
                if (response.success) {
                    renderFornecedoresTable();
                }
            }
        }
    });
}
