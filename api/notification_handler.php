<?php
/**
 * API Handler para o Sistema de Notificações
 *
 * Verifica o estado das solicitações para notificar os utilizadores.
 */
require_once __DIR__ . '/../auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_response(false, 'Método não permitido. Use POST.', null, 405);
}

$action = $_POST['action'] ?? '';

try {
    switch ($action) {
        case 'get_latest_solicitacao':
            // Busca o ID e o nome do solicitante do último pedido pendente de aprovação.
            $stmt = $pdo->query("
                SELECT id, solicitante_nome 
                FROM compras_solicitacoes 
                WHERE status = 'Pendente de Aprovação'
                ORDER BY id DESC 
                LIMIT 1
            ");
            $latest = $stmt->fetch(PDO::FETCH_ASSOC);

            api_response(true, 'Última solicitação verificada.', ['latest' => $latest ?: null]);
            break;

        default:
            api_response(false, 'Ação inválida ou não fornecida.', null, 400);
    }
} catch (PDOException $e) {
    api_response(false, 'Erro de banco de dados: ' . $e->getMessage(), null, 500);
}

