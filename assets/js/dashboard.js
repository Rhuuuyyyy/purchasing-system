/**
 * Lógica da Página de Dashboard Gerencial Avançado
 */

// Variável global para a instância do gráfico
let spendingChart = null;

async function loadDashboard() {
    // A interface agora se adapta ao perfil do utilizador
    if (window.isFullAdmin || window.isPurchasing) {
        renderAdminDashboard();
    } else {
        renderCollaboratorDashboard();
    }
}

function renderCollaboratorDashboard() {
    appContent.innerHTML = `
        <div class="card">
            <h3>Bem-vindo ao Portal de Compras!</h3>
            <p style="margin-top: 10px;">Este é o seu espaço para solicitar novos materiais e acompanhar o andamento dos seus pedidos.</p>
            <div style="margin-top: 30px; display: flex; flex-wrap: wrap; gap: 15px;">
                <button class="btn btn-primary" id="btn-dashboard-novo-pedido">
                    <i class="fas fa-plus"></i> Fazer um Novo Pedido
                </button>
                <button class="btn btn-secondary" onclick="navigateTo('solicitacoes')">
                    <i class="fas fa-list"></i> Ver Meus Pedidos
                </button>
            </div>
        </div>
    `;

    document.getElementById('btn-dashboard-novo-pedido').addEventListener('click', () => {
        if (typeof renderSolicitacaoModal === 'function') {
            renderSolicitacaoModal();
        } else {
            showToast('Erro: A função para criar solicitações não foi encontrada.', 'error');
        }
    });
}

/**
 * Renderiza o layout principal do dashboard de administrador.
 */
function renderAdminDashboard() {
    appContent.innerHTML = `
        <style>
            .dashboard-filters { margin-bottom: 25px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
            .filter-btn { background-color: #fff; border: 1px solid var(--cor-borda); color: var(--cor-texto-claro); font-weight: 500; }
            .filter-btn.active { background-color: var(--cor-primaria); color: #fff; border-color: var(--cor-primaria); }
            .dashboard-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 25px; }
            .stat-card { display: flex; align-items: center; background-color: #fff; padding: 20px; border-radius: 8px; box-shadow: var(--cor-sombra); border-left: 5px solid var(--cor-primaria); transition: transform 0.2s ease, box-shadow 0.2s ease; }
            .stat-card:hover { transform: translateY(-3px); box-shadow: 0 8px 15px rgba(0,0,0,0.1); }
            .stat-card .stat-icon { font-size: 1.8rem; width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 20px; flex-shrink: 0; }
            .stat-card .stat-info h4 { font-size: 0.9rem; color: var(--cor-texto-claro); font-weight: 500; text-transform: uppercase; margin: 0; }
            .stat-card .stat-info p { font-size: 1.8rem; font-weight: 700; color: #333; margin: 0; }
            #card-solicitacoes-pendentes { border-left-color: var(--cor-aviso); }
            #card-solicitacoes-pendentes .stat-icon { background-color: #fffbeb; color: var(--cor-aviso); }
            #card-ordens-abertas { border-left-color: var(--cor-info); }
            #card-ordens-abertas .stat-icon { background-color: #ecfeff; color: var(--cor-info); }
            #card-valor-periodo { border-left-color: var(--cor-sucesso); }
            #card-valor-periodo .stat-icon { background-color: #f0fdf4; color: var(--cor-sucesso); }
            .chart-container { position: relative; height: 350px; width: 100%; }
            .stuck-requests-table .days-waiting { font-weight: bold; color: var(--cor-erro); text-align: center; }
        </style>

        <!-- Filtros -->
        <div class="dashboard-filters">
            <button class="btn filter-btn active" data-period="this_month">Este Mês</button>
            <button class="btn filter-btn" data-period="last_3_months">Últimos 3 Meses</button>
            <button class="btn filter-btn" data-period="today">Hoje</button>
        </div>

        <!-- KPIs -->
        <div class="dashboard-grid" id="kpi-container">
            <div class="stat-card" id="card-solicitacoes-pendentes"><div class="loading-spinner"></div></div>
            <div class="stat-card" id="card-ordens-abertas"><div class="loading-spinner"></div></div>
            <div class="stat-card" id="card-valor-periodo"><div class="loading-spinner"></div></div>
        </div>

        <!-- Gráfico e Alertas -->
        <div class="dashboard-grid" style="margin-top: 30px; grid-template-columns: 2fr 1fr; align-items: flex-start;">
            <div class="card">
                <div class="card-header"><h3>Evolução de Gastos</h3></div>
                <div class="chart-container"><canvas id="spendingChart"></canvas></div>
            </div>
            <div class="card">
                <div class="card-header"><h3><i class="fas fa-exclamation-triangle" style="color: var(--cor-aviso);"></i> Alertas</h3></div>
                <div id="stuck-requests-container"></div>
            </div>
        </div>
    `;

    addFilterListeners();
    // Carrega os dados com o filtro padrão ("Este Mês")
    fetchAndRenderDashboardData('this_month');
}

/**
 * Adiciona os listeners de eventos aos botões de filtro.
 */
function addFilterListeners() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const period = button.dataset.period;
            fetchAndRenderDashboardData(period);
        });
    });
}

/**
 * Busca os dados do backend e chama as funções de renderização.
 * @param {string} period O período selecionado para o filtro.
 */
async function fetchAndRenderDashboardData(period) {
    // Mostra spinners de carregamento
    document.getElementById('kpi-container').querySelectorAll('.stat-card').forEach(card => card.innerHTML = '<div class="loading-spinner"></div>');
    if (spendingChart) spendingChart.destroy(); // Limpa o gráfico anterior
    document.getElementById('stuck-requests-container').innerHTML = '<div class="loading-spinner"></div>';

    const response = await apiRequest('dashboard_handler.php', { action: 'get_stats', period: period });

    if (response.success && response.data) {
        const stats = response.data.stats;
        renderKPIs(stats.kpis);
        renderSpendingChart(stats.spending_evolution);
        renderStuckRequests(stats.stuck_requests);
    } else {
        appContent.innerHTML = `<div class="card"><p class="error-message">${response.message || 'Não foi possível carregar os dados do dashboard.'}</p></div>`;
    }
}

/**
 * Renderiza os cartões de KPI.
 */
function renderKPIs(kpis) {
    document.getElementById('card-solicitacoes-pendentes').innerHTML = `<div class="stat-icon"><i class="fas fa-file-import"></i></div><div class="stat-info"><h4>Pendentes de Aprovação</h4><p>${kpis.solicitacoes_pendentes}</p></div>`;
    document.getElementById('card-ordens-abertas').innerHTML = `<div class="stat-icon"><i class="fas fa-truck-loading"></i></div><div class="stat-info"><h4>Ordens Abertas (Período)</h4><p>${kpis.ordens_abertas_periodo}</p></div>`;
    document.getElementById('card-valor-periodo').innerHTML = `<div class="stat-icon"><i class="fas fa-dollar-sign"></i></div><div class="stat-info"><h4>Gastos (Período)</h4><p>${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpis.valor_total_periodo)}</p></div>`;
}

/**
 * Renderiza o gráfico de evolução de gastos.
 */
function renderSpendingChart(data) {
    const ctx = document.getElementById('spendingChart').getContext('2d');
    
    const labels = data.map(item => new Date(item.dia + 'T00:00:00').toLocaleDateString('pt-BR'));
    const values = data.map(item => item.total);

    if (spendingChart) {
        spendingChart.destroy();
    }

    spendingChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Valor Gasto',
                data: values,
                backgroundColor: 'rgba(5, 150, 105, 0.1)',
                borderColor: 'rgba(5, 150, 105, 1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

/**
 * Renderiza a tabela de solicitações "encalhadas".
 */
function renderStuckRequests(data) {
    const container = document.getElementById('stuck-requests-container');
    if (data.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 20px;">Nenhuma solicitação pendente há mais de 3 dias.</p>';
        return;
    }

    container.innerHTML = `
        <p style="margin-bottom: 15px; font-size: 0.9rem; color: var(--cor-texto-claro);">Solicitações pendentes de aprovação há mais de 3 dias.</p>
        <table class="data-table stuck-requests-table">
            <thead>
                <tr>
                    <th>Solicitante</th>
                    <th>Espera</th>
                </tr>
            </thead>
            <tbody>
                ${data.map(req => `
                    <tr>
                        <td data-label="Solicitante">${req.solicitante_nome} (#${req.id})</td>
                        <td data-label="Espera" class="days-waiting">${req.dias_espera} dias</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

