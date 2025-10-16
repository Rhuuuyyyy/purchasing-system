<?php
/**
 * API Handler para buscar uma lista combinada de fornecedores
 * com suporte para pesquisa, incluindo ativos e inativos.
 */
require_once __DIR__ . '/../auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_response(false, 'Método não permitido. Use POST.', null, 405);
}

$searchTerm = !empty($_POST['search']) ? '%' . trim($_POST['search']) . '%' : null;

try {
    // Passo 1: Buscar fornecedores do sistema de Compras (ativos e inativos)
    $sql_compras = "
        SELECT CONCAT('c_', id) as id, nome_fantasia, razao_social, area_atuacao, ativo 
        FROM compras_fornecedores
    ";
    $params_compras = [];
    if ($searchTerm) {
        $sql_compras .= " WHERE (nome_fantasia LIKE ? OR razao_social LIKE ?)";
        array_push($params_compras, $searchTerm, $searchTerm);
    }
    $stmt_compras = $pdo->prepare($sql_compras);
    $stmt_compras->execute($params_compras);
    $fornecedores_compras = $stmt_compras->fetchAll(PDO::FETCH_ASSOC);

    // Passo 2: Buscar fornecedores da tabela relacao_financeiro (ativos e inativos)
    $fornecedores_financeiro = [];
    try {
        $sql_financeiro = "
            SELECT CONCAT('f_', id) as id, Nome as nome_fantasia, `CNPJ/CPF` as cnpj, 'Financeiro' as area_atuacao, ativo 
            FROM relacao_financeiro
        ";
        $params_financeiro = [];
        if ($searchTerm) {
            $sql_financeiro .= " WHERE (Nome LIKE ?)";
            array_push($params_financeiro, $searchTerm);
        }
        $stmt_financeiro = $pdo->prepare($sql_financeiro);
        $stmt_financeiro->execute($params_financeiro);
        $fornecedores_financeiro = $stmt_financeiro->fetchAll(PDO::FETCH_ASSOC);
    } catch (PDOException $e) {
        // Ignora o erro se a tabela não existir
    }

    $combined_list = array_merge($fornecedores_compras, $fornecedores_financeiro);

    $unique_suppliers = [];
    $names_seen = [];
    foreach ($combined_list as $supplier) {
        $name = !empty($supplier['nome_fantasia']) ? $supplier['nome_fantasia'] : ($supplier['razao_social'] ?? null);
        if ($name && !isset($names_seen[$name])) {
            $unique_suppliers[] = $supplier;
            $names_seen[$name] = true;
        }
    }

    usort($unique_suppliers, function($a, $b) {
        return strcasecmp($a['nome_fantasia'], $b['nome_fantasia']);
    });

    api_response(true, 'Fornecedores carregados com sucesso.', ['fornecedores' => $unique_suppliers]);

} catch (PDOException $e) {
    api_response(false, 'Erro de banco de dados: ' . $e->getMessage(), null, 500);
}
