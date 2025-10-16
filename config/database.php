<?php
/**
 * Ficheiro de Ligação à Base de Dados Seguro para a API de Compras
 *
 * Este ficheiro inclui as credenciais de um ficheiro separado (config.secret.php)
 * que é ignorado pelo Git, mantendo o código-fonte livre de segredos.
 */

// Inclui o arquivo com as credenciais. Se o arquivo não existir, o script para.
require_once __DIR__ . '/config.secret.php';

// As variáveis ($db_host, $db_name, etc.) agora existem neste escopo.

$charset = 'utf8mb4';

$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

$dsn = "mysql:host=$db_host;dbname=$db_name;charset=$charset";

try {
     $pdo = new PDO($dsn, $db_user, $db_pass, $options);
} catch (\PDOException $e) {
     // Em caso de erro, lança uma exceção que será capturada pelos nossos handlers.
     throw new \PDOException($e->getMessage(), (int)$e->getCode());
}