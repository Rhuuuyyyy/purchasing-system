/**
 * Lógica da Página de Gestão de Produtos
 */

async function loadProdutos() {
    appContent.innerHTML = `
        <div class="page-container">
            <div class="card">
                <div class="card-header">
                    <h3>Produtos do Catálogo de Compras</h3>
                </div>
                <div id="catalogo-form-container"></div>
                <div id="catalogo-table-container" class="table-wrapper" style="margin-top: 20px;"></div>
            </div>
            <div class="card">
                <div class="card-header">
                    <h3>Produtos do Almoxarifado (Consulta)</h3>
                </div>
                <div id="almoxarifado-table-container" class="table-wrapper"></div>
            </div>
        </div>
    `;

    renderCatalogoForm();
    renderCatalogoTable();
    renderAlmoxarifadoTable();
}

// --- Funções para o Catálogo de Compras ---

function renderCatalogoForm(produto = {}) {
    const container = document.getElementById('catalogo-form-container');
    const isEditing = !!produto.id;

    container.innerHTML = `
        <form id="form-catalogo-produto" class="form-grid">
            <input type="hidden" name="id" value="${produto.id || ''}">
            <div class="form-group">
                <label for="catalogo-nome">Nome do Produto</label>
                <input type="text" id="catalogo-nome" name="nome" value="${produto.nome || ''}" required>
            </div>
            <div class="form-group">
                <label for="catalogo-categoria">Categoria</label>
                <input type="text" id="catalogo-categoria" name="categoria" value="${produto.categoria || ''}">
            </div>
            <div class="form-group" style="grid-column: 1 / -1;">
                <label for="catalogo-descricao">Descrição</label>
                <textarea id="catalogo-descricao" name="descricao" rows="2">${produto.descricao || ''}</textarea>
            </div>
            <div class="form-actions">
                <button type="submit" class="btn btn-primary">${isEditing ? '<i class="fas fa-save"></i> Atualizar' : '<i class="fas fa-plus"></i> Adicionar ao Catálogo'}</button>
                ${isEditing ? `<button type="button" class="btn btn-secondary" id="cancel-edit-catalogo">Cancelar</button>` : ''}
            </div>
        </form>
    `;
    addCatalogoFormListeners();
}

function addCatalogoFormListeners() {
    const form = document.getElementById('form-catalogo-produto');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(form));
        data.action = 'save_catalogo_produto';

        const response = await apiRequest('produtos_geral_handler.php', data);
        showToast(response.message, response.success ? 'success' : 'error');
        if (response.success) {
            renderCatalogoForm();
            renderCatalogoTable();
        }
    });

    const cancelButton = document.getElementById('cancel-edit-catalogo');
    if (cancelButton) {
        cancelButton.addEventListener('click', () => renderCatalogoForm());
    }
}

async function renderCatalogoTable() {
    const container = document.getElementById('catalogo-table-container');
    container.innerHTML = '<div class="loading-spinner"></div>';
    
    const response = await apiRequest('produtos_geral_handler.php', { action: 'get_catalogo_produtos' });

    if (response.success && Array.isArray(response.data.produtos)) {
        const produtos = response.data.produtos;
        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Nome</th>
                        <th>Categoria</th>
                        <th>Descrição</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${produtos.map(p => `
                        <tr>
                            <td data-label="Nome">${p.nome}</td>
                            <td data-label="Categoria">${p.categoria || 'N/D'}</td>
                            <td data-label="Descrição">${p.descricao || 'N/D'}</td>
                            <td data-label="Ações" class="actions-cell">
                                <button class="btn-icon btn-edit" data-produto='${JSON.stringify(p)}' title="Editar"><i class="fas fa-pencil-alt"></i></button>
                                <button class="btn-icon btn-delete" data-id="${p.id}" title="Desativar"><i class="fas fa-trash"></i></button>
                            </td>
                        </tr>
                    `).join('') || '<tr><td colspan="4" style="text-align:center;">Nenhum produto no catálogo.</td></tr>'}
                </tbody>
            </table>
        `;
        addCatalogoTableListeners();
    } else {
        container.innerHTML = `<p class="error-message">${response.message || 'Falha ao carregar produtos do catálogo.'}</p>`;
    }
}

function addCatalogoTableListeners() {
    const container = document.getElementById('catalogo-table-container');
    container.addEventListener('click', async (e) => {
        const editButton = e.target.closest('.btn-edit');
        if (editButton) {
            const produtoData = JSON.parse(editButton.dataset.produto);
            renderCatalogoForm(produtoData);
            document.getElementById('catalogo-form-container').scrollIntoView({ behavior: 'smooth' });
            return;
        }

        const deleteButton = e.target.closest('.btn-delete');
        if (deleteButton) {
            const id = deleteButton.dataset.id;
            const confirmed = await showConfirmModal('Confirmar Desativação', 'Tem a certeza que deseja desativar este produto do catálogo?');
            if (confirmed) {
                const response = await apiRequest('produtos_geral_handler.php', { action: 'delete_catalogo_produto', id: id });
                showToast(response.message, response.success ? 'success' : 'error');
                if (response.success) {
                    renderCatalogoTable();
                }
            }
        }
    });
}


// --- Funções para a Lista de Produtos do Almoxarifado ---

async function renderAlmoxarifadoTable() {
    const container = document.getElementById('almoxarifado-table-container');
    container.innerHTML = '<div class="loading-spinner"></div>';

    const response = await apiRequest('produtos_geral_handler.php', { action: 'get_almoxarifado_produtos' });

    if (response.success && Array.isArray(response.data.produtos)) {
        const produtos = response.data.produtos;
        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Código</th>
                        <th>Produto</th>
                        <th>Estoque Atual</th>
                    </tr>
                </thead>
                <tbody>
                    ${produtos.map(p => `
                        <tr>
                            <td data-label="Código">${p.cod}</td>
                            <td data-label="Produto">${p.produto}</td>
                            <td data-label="Estoque">${p.quantidade}</td>
                        </tr>
                    `).join('') || '<tr><td colspan="3" style="text-align:center;">Nenhum produto encontrado no almoxarifado.</td></tr>'}
                </tbody>
            </table>
        `;
    } else {
        container.innerHTML = `<p class="error-message">${response.message || 'Falha ao carregar produtos do almoxarifado.'}</p>`;
    }
}
