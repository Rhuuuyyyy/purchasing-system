/**
 * Script Principal da Aplicação (Frontend) - Sistema de Compras
 * VERSÃO COM SEGURANÇA INTEGRADA À INTRANET
 */

// Variáveis globais da aplicação
let appContent, pageTitle;
window.isFullAdmin = false;
window.isPurchasing = false;
window.userEmail = '';

// --- FUNÇÃO DE API REQUEST ---
window.apiRequest = async function(handler, data) {
    const apiUrl = `api/${handler}`;
    try {
        const formData = new FormData();
        for (const key in data) {
            if (data[key] !== null && data[key] !== undefined) {
                 if (Array.isArray(data[key])) {
                    formData.append(key, JSON.stringify(data[key]));
                } else {
                    formData.append(key, data[key]);
                }
            }
        }

        const response = await fetch(apiUrl, { method: 'POST', body: formData });
        
        if (response.status === 401) {
            showToast('Acesso não autorizado. A sua sessão na intranet pode ter expirado.', 'error');
            // Redireciona para a intranet após a mensagem de erro
            setTimeout(() => window.location.href = 'https://www.solovivo.com.br/SoloVivo/Intranet/intranet.php', 3000);
            return { success: false, message: 'Sessão expirada.' };
        }

        const textResponse = await response.text();
        try {
            const result = JSON.parse(textResponse);
            if (!response.ok) {
                throw new Error(result.message || `Erro HTTP ${response.status}`);
            }
            return result;
        } catch (e) {
            console.error('Erro ao analisar a resposta da API (pode ser um erro de PHP):', textResponse);
            throw new Error('O servidor retornou uma resposta inesperada.');
        }

    } catch (error) {
        console.error('Erro na requisição API:', error);
        showToast(error.message, 'error');
        return { success: false, message: error.message, data: null };
    }
};


// --- LÓGICA DE NAVEGAÇÃO E MENU ---

function buildMenu() {
    const menuContainer = document.querySelector('.sidebar-menu');
    if (!menuContainer) return;

    const menuItems = [
        { id: 'dashboard', icon: 'fa-tachometer-alt', text: 'Dashboard', roles: ['any'] },
        { id: 'solicitacoes', icon: 'fa-file-alt', text: 'Solicitações', roles: ['any'] }
    ];

    if (window.isFullAdmin || window.isPurchasing) {
        menuItems.push({ id: 'cotacao', icon: 'fa-calculator', text: 'Cotação', roles: ['admin', 'purchasing'] });
        menuItems.push({ id: 'ordens', icon: 'fa-file-invoice-dollar', text: 'Ordens de Compra', roles: ['admin', 'purchasing'] });
        menuItems.push({ id: 'fornecedores', icon: 'fa-truck', text: 'Fornecedores', roles: ['admin', 'purchasing'] });
        menuItems.push({ id: 'produtos', icon: 'fa-box-open', text: 'Produtos', roles: ['admin', 'purchasing'] });
    }

    let menuHtml = '';
    menuItems.forEach(item => {
        menuHtml += `
            <li>
                <a href="#${item.id}" class="menu-link" data-page="${item.id}">
                    <i class="fas ${item.icon}"></i>
                    <span>${item.text}</span>
                </a>
            </li>
        `;
    });
    menuContainer.innerHTML = menuHtml;

    document.querySelectorAll('.menu-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = e.currentTarget.dataset.page;
            navigateTo(pageId);
        });
    });
}

async function navigateTo(pageId) {
    if (!pageId) pageId = 'dashboard';

    document.querySelectorAll('.menu-link').forEach(link => link.classList.remove('active'));
    const activeLink = document.querySelector(`.menu-link[data-page="${pageId}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }

    pageTitle.textContent = activeLink ? activeLink.querySelector('span').textContent : 'Página Inicial';
    
    appContent.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';

    switch (pageId) {
        case 'dashboard':
            if (typeof loadDashboard === 'function') await loadDashboard();
            break;
        case 'solicitacoes':
            if (typeof loadSolicitacoes === 'function') await loadSolicitacoes();
            break;
        case 'cotacao':
            if (typeof loadCotacao === 'function') await loadCotacao();
            break;
        case 'ordens':
            if (typeof loadOrdens === 'function') await loadOrdens();
            break;
        case 'fornecedores':
            if (typeof loadFornecedores === 'function') await loadFornecedores();
            break;
        case 'produtos':
            if (typeof loadProdutos === 'function') await loadProdutos();
            break;
        default:
            appContent.innerHTML = '<h2>Página não encontrada</h2>';
            break;
    }
    
    document.querySelector('.sidebar')?.classList.remove('open');
    document.getElementById('mobile-overlay')?.classList.remove('open');
}

// --- FUNÇÃO DE INICIALIZAÇÃO DA APLICAÇÃO ---
document.addEventListener('DOMContentLoaded', async () => {
    // Adiciona o SweetAlert2 para pop-ups mais bonitos
    if (typeof Swal === 'undefined') {
        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/npm/sweetalert2@11";
        document.head.appendChild(script);
    }

    appContent = document.getElementById('app-content');
    pageTitle = document.getElementById('page-title');

    if (!appContent || !pageTitle) {
        console.error('Elementos essenciais da UI (app-content, page-title) não encontrados.');
        return;
    }

    const hamburgerBtn = document.getElementById('hamburger-btn');
    const sidebar = document.querySelector('.sidebar');
    const mobileOverlay = document.getElementById('mobile-overlay');

    if (hamburgerBtn && sidebar && mobileOverlay) {
        hamburgerBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            mobileOverlay.classList.toggle('open');
        });

        mobileOverlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            mobileOverlay.classList.remove('open');
        });
    }

    const userInfoResponse = await apiRequest('user_info_handler.php', {});

    if (userInfoResponse.success && userInfoResponse.data) {
        window.isFullAdmin = userInfoResponse.data.is_full_admin;
        window.isPurchasing = userInfoResponse.data.is_purchasing;
        window.userEmail = userInfoResponse.data.user_email;

        buildMenu();

        const initialPage = window.location.hash.substring(1) || 'dashboard';
        navigateTo(initialPage);

    } else {
        // A mensagem de erro já é mostrada pelo apiRequest em caso de 401
        if(userInfoResponse.message !== 'Sessão expirada.'){
             appContent.innerHTML = `<p class="error-message">${userInfoResponse.message || 'Não foi possível verificar as suas permissões.'}</p>`;
        }
    }
});

