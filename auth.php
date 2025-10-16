<?php
// Ativa a exibição de todos os erros para depuração
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

/**
 * API Authentication Gate (Versão Simplificada e Unificada)
 * Agora utiliza diretamente a conexão PDO do 'database.php'.
 */
header('Content-Type: application/json; charset=utf-8');
@session_start();

// 1. Inclui o ficheiro de ligação PDO padrão da aplicação.
// O caminho foi corrigido para procurar a pasta 'config' no mesmo nível do 'auth.php'.
require_once __DIR__ . '/config/database.php';

// Se a variável $pdo não foi criada pelo ficheiro acima, algo está errado.
if (!isset($pdo)) {
    // A função api_response está definida abaixo.
    api_response(false, 'Erro Crítico: A variável de ligação PDO não foi criada. Verifique o ficheiro config/database.php.', null, 500);
}

// --- DEFINIÇÃO DE PERFIS ---
const FULL_ADMIN_USERS = [
    'gerente.ind@solovivo.com.br',
    'ti@solovivo.com.br'
];
const PURCHASING_USERS = [
    'compras@solovivo.com.br',
    'ti@solovivo.com.br',
	'rh01@solovivo.com.br'
];

/**
 * Envia uma resposta JSON padronizada e termina o script.
 */
function api_response(bool $success, string $message, ?array $data = null, int $http_code = 200) {
    if (ob_get_level()) ob_end_clean();
    http_response_code($http_code);
    $response = ['success' => $success, 'message' => $message];
    if ($data !== null) $response['data'] = $data;
    echo json_encode($response);
    exit;
}

function is_full_admin() {
    $user = $_SESSION['Recemail'] ?? '';
    return in_array($user, FULL_ADMIN_USERS);
}

function is_purchasing() {
    $user = $_SESSION['Recemail'] ?? '';
    return in_array($user, PURCHASING_USERS);
}

// A verificação de login foi REATIVADA.
// A segurança agora depende do sistema de intranet principal para definir a variável de sessão 'Recemail'.
if (!isset($_SESSION['Recemail']) || empty($_SESSION['Recemail'])) {
    api_response(false, 'Acesso não autorizado. Por favor, efetue o login na intranet da Solo Vivo para continuar.', null, 401);
}

// Define a variável global com o email do utilizador logado
$usuario_logado = $_SESSION['Recemail'];

