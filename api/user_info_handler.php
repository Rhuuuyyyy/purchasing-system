<?php
/**
 * API Handler para Informações do Utilizador
 */
require_once __DIR__ . '/../auth.php';

// Responde com os status de permissão do utilizador logado.
api_response(true, 'User info retrieved.', [
    'is_full_admin' => is_full_admin(),
    'is_purchasing' => is_purchasing(),
    'user_email' => $usuario_logado ?? ''
]);
?>
