<?php
/**
 * API Handler for the Advanced Dashboard - Sistema de Compras
 */
require_once __DIR__ . '/../auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_response(false, 'Método não permitido. Use POST.', null, 405);
}

$action = $_POST['action'] ?? '';

try {
    if ($action === 'get_stats') {
        // --- Lógica de Filtro de Data ---
        $period = $_POST['period'] ?? 'this_month';
        $where_clause = '';
        $params = [];

        switch ($period) {
            case 'today':
                $where_clause = "DATE(oc.data_emissao) = CURDATE()";
                break;
            case 'last_3_months':
                $where_clause = "oc.data_emissao >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)";
                break;
            case 'this_month':
            default:
                $where_clause = "YEAR(oc.data_emissao) = YEAR(CURDATE()) AND MONTH(oc.data_emissao) = MONTH(CURDATE())";
                break;
        }

        // --- 1. Gráfico de Evolução de Gastos ---
        $sql_spending = "
            SELECT DATE(oc.data_emissao) as dia, SUM(oc.valor_total) as total
            FROM compras_ordens oc
            WHERE {$where_clause} AND oc.status != 'Cancelada'
            GROUP BY DATE(oc.data_emissao)
            ORDER BY dia ASC
        ";
        $stmt_spending = $pdo->prepare($sql_spending);
        $stmt_spending->execute($params);
        $spending_evolution = $stmt_spending->fetchAll(PDO::FETCH_ASSOC);

        // --- 2. Solicitações Encalhadas (mais de 3 dias) ---
        $sql_stuck = "
            SELECT 
                s.id, 
                s.solicitante_nome, 
                s.data_solicitacao,
                DATEDIFF(CURDATE(), s.data_solicitacao) as dias_espera
            FROM compras_solicitacoes s
            WHERE s.status = 'Pendente de Aprovação' AND s.data_solicitacao <= DATE_SUB(CURDATE(), INTERVAL 3 DAY)
            ORDER BY dias_espera DESC
        ";
        $stmt_stuck = $pdo->query($sql_stuck);
        $stuck_requests = $stmt_stuck->fetchAll(PDO::FETCH_ASSOC);

        // --- 3. KPIs (Atualizados para usar o filtro de data) ---
        $sql_kpis = "
            SELECT
                (SELECT COUNT(*) FROM compras_solicitacoes WHERE status = 'Pendente de Aprovação') as solicitacoes_pendentes,
                (SELECT COUNT(*) FROM compras_ordens oc WHERE {$where_clause} AND oc.status NOT IN ('Recebida Totalmente', 'Cancelada')) as ordens_abertas,
                (SELECT SUM(oc.valor_total) FROM compras_ordens oc WHERE {$where_clause} AND oc.status != 'Cancelada') as valor_total_periodo
        ";
        $stmt_kpis = $pdo->prepare($sql_kpis);
        $stmt_kpis->execute($params);
        $kpis = $stmt_kpis->fetch(PDO::FETCH_ASSOC);


        // Monta a resposta final
        $stats = [
            'kpis' => [
                'solicitacoes_pendentes' => (int)($kpis['solicitacoes_pendentes'] ?? 0),
                'ordens_abertas_periodo' => (int)($kpis['ordens_abertas'] ?? 0),
                'valor_total_periodo' => (float)($kpis['valor_total_periodo'] ?? 0),
            ],
            'spending_evolution' => $spending_evolution,
            'stuck_requests' => $stuck_requests
        ];

        api_response(true, 'Estatísticas do dashboard carregadas.', ['stats' => $stats]);

    } else {
        api_response(false, 'Ação inválida ou não fornecida.', null, 400);
    }
} catch (PDOException $e) {
    api_response(false, 'Erro de banco de dados: ' . $e->getMessage(), null, 500);
}
