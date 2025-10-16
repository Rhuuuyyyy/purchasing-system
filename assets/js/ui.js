/**
 * Funções de UI Reutilizáveis (Alertas, Modais, etc.)
 *
 * Este ficheiro centraliza a criação de componentes de interface comuns
 * para garantir uma experiência de utilizador consistente.
 */

/**
 * Exibe uma notificação temporária (toast) no canto do ecrã.
 * @param {string} message A mensagem a ser exibida.
 * @param {string} type O tipo de toast ('success' ou 'error').
 */
function showToast(message, type = 'success') {
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 100);

    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 4000);
}

/**
 * Exibe um modal de confirmação e retorna uma Promise que resolve para true ou false.
 * @param {string} title O título do modal.
 * @param {string} message A pergunta de confirmação.
 * @returns {Promise<boolean>} Resolve para `true` se confirmado, `false` se cancelado.
 */
function showConfirmModal(title, message) {
    return new Promise((resolve) => {
        const existingModal = document.querySelector('.modal-overlay');
        if (existingModal) {
            existingModal.remove();
        }

        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay';

        modalOverlay.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close-btn">&times;</button>
                </div>
                <div class="modal-body">
                    <p>${message}</p>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" id="modal-cancel">Cancelar</button>
                    <button class="btn btn-danger" id="modal-confirm">Confirmar</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modalOverlay);

        const closeModal = (result) => {
            modalOverlay.remove();
            resolve(result);
        };

        modalOverlay.querySelector('#modal-confirm').addEventListener('click', () => closeModal(true));
        modalOverlay.querySelector('#modal-cancel').addEventListener('click', () => closeModal(false));
        modalOverlay.querySelector('.modal-close-btn').addEventListener('click', () => closeModal(false));
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                closeModal(false);
            }
        });
    });
}

/**
 * Exibe um modal com conteúdo HTML personalizado.
 * @param {string} title O título do modal.
 * @param {string} contentHtml O HTML a ser inserido no corpo do modal.
 * @param {string} sizeClass Classe de tamanho opcional ('modal-lg' para um modal maior).
 * @param {Array<object>} footerButtons Array opcional de objetos de botão. Ex: [{ text: 'Salvar', className: 'btn-primary', onClick: () => {} }]
 */
function showContentModal(title, contentHtml, sizeClass = '', footerButtons = []) {
    const existingModal = document.querySelector('.modal-overlay');
    if (existingModal) {
        existingModal.remove();
    }

    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';

    // Gera os botões personalizados a partir do array
    const customButtonsHtml = footerButtons.map((btn, index) => 
        `<button class="btn ${btn.className || 'btn-secondary'}" id="modal-custom-btn-${index}">${btn.text}</button>`
    ).join('');

    modalOverlay.innerHTML = `
        <div class="modal-content ${sizeClass}">
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="modal-close-btn">&times;</button>
            </div>
            <div class="modal-body">
                ${contentHtml}
            </div>
            <div class="modal-footer">
                ${customButtonsHtml}
                <button class="btn btn-secondary" id="modal-close">Fechar</button>
            </div>
        </div>
    `;

    document.body.appendChild(modalOverlay);

    const closeModal = () => {
        modalOverlay.remove();
    };

    // Adiciona os listeners de clique para os botões personalizados
    footerButtons.forEach((btn, index) => {
        if (typeof btn.onClick === 'function') {
            document.getElementById(`modal-custom-btn-${index}`).addEventListener('click', btn.onClick);
        }
    });

    modalOverlay.querySelector('#modal-close').addEventListener('click', closeModal);
    modalOverlay.querySelector('.modal-close-btn').addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            closeModal();
        }
    });
}
