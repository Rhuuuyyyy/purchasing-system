<?php
/**
 * API Handler para Fornecedores (com campo de Área de Atuação)
 *
 * Gerencia todas as operações CRUD para a tabela 'compras_fornecedores'.
 */

require_once __DIR__ . '/../auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_response(false, 'Método não permitido. Use POST.', null, 405);
}

$action = $_POST['action'] ?? '';

try {
    switch ($action) {
        case 'get_all':
            $search = !empty($_POST['search']) ? '%' . trim($_POST['search']) . '%' : null;
            
            // 1. Busca os fornecedores da tabela principal 'compras_fornecedores'
            $sql_compras = "SELECT id, razao_social, nome_fantasia, cnpj, area_atuacao, contato_nome, contato_email, contato_telefone, ativo, 'compras' as source FROM compras_fornecedores";
            $params_compras = [];
            if ($search) {
                $sql_compras .= " WHERE (razao_social LIKE ? OR nome_fantasia LIKE ? OR cnpj LIKE ?)";
                array_push($params_compras, $search, $search, $search);
            }
            $stmt_compras = $pdo->prepare($sql_compras);
            $stmt_compras->execute($params_compras);
            $fornecedores_compras = $stmt_compras->fetchAll(PDO::FETCH_ASSOC);

            // 2. Busca os fornecedores da tabela antiga 'relacao_financeiro'
            $fornecedores_financeiro = [];
            try {
                // Mapeia as colunas para serem compatíveis com a estrutura principal
                $sql_financeiro = "SELECT id, Nome as razao_social, Nome as nome_fantasia, `CNPJ/CPF` as cnpj, 'Financeiro' as area_atuacao, NULL as contato_nome, NULL as contato_email, NULL as contato_telefone, ativo, 'financeiro' as source FROM relacao_financeiro";
                $params_financeiro = [];
                if ($search) {
                    $sql_financeiro .= " WHERE (Nome LIKE ? OR `CNPJ/CPF` LIKE ?)";
                    array_push($params_financeiro, $search, $search);
                }
                $stmt_financeiro = $pdo->prepare($sql_financeiro);
                $stmt_financeiro->execute($params_financeiro);
                $fornecedores_financeiro = $stmt_financeiro->fetchAll(PDO::FETCH_ASSOC);
            } catch (PDOException $e) {
                // Ignora o erro caso a tabela 'relacao_financeiro' não exista
            }

            // 3. Junta os resultados das duas tabelas
            $all_fornecedores = array_merge($fornecedores_compras, $fornecedores_financeiro);

            // 4. Ordena a lista combinada por nome
            usort($all_fornecedores, function($a, $b) {
                return strcasecmp($a['nome_fantasia'] ?? $a['razao_social'], $b['nome_fantasia'] ?? $b['razao_social']);
            });

            api_response(true, 'Fornecedores carregados com sucesso.', ['fornecedores' => $all_fornecedores]);
            break;

        case 'create':
        case 'update':
            // Estas ações continuam a funcionar apenas para a tabela 'compras_fornecedores'
            $id = (int)($_POST['id'] ?? 0);
            $razao_social = trim($_POST['razao_social'] ?? '');
            $nome_fantasia = trim($_POST['nome_fantasia'] ?? '');
            $cnpj = trim($_POST['cnpj'] ?? '');
            $area_atuacao = trim($_POST['area_atuacao'] ?? '');
            $contato_nome = trim($_POST['contato_nome'] ?? '');
            $contato_email = trim($_POST['contato_email'] ?? '');
            $contato_telefone = trim($_POST['contato_telefone'] ?? '');

            if (empty($razao_social) || empty($cnpj)) {
                api_response(false, 'Razão Social e CNPJ são obrigatórios.', null, 400);
            }

            if ($action === 'update') {
                if ($id <= 0) {
                    api_response(false, 'ID do fornecedor inválido para atualização.', null, 400);
                }
                $stmt = $pdo->prepare(
                    "UPDATE compras_fornecedores SET razao_social = ?, nome_fantasia = ?, cnpj = ?, area_atuacao = ?, contato_nome = ?, contato_email = ?, contato_telefone = ? WHERE id = ?"
                );
                $stmt->execute([$razao_social, $nome_fantasia, $cnpj, $area_atuacao, $contato_nome, $contato_email, $contato_telefone, $id]);
                api_response(true, 'Fornecedor atualizado com sucesso.');
            } else {
                $stmt = $pdo->prepare(
                    "INSERT INTO compras_fornecedores (razao_social, nome_fantasia, cnpj, area_atuacao, contato_nome, contato_email, contato_telefone) VALUES (?, ?, ?, ?, ?, ?, ?)"
                );
                $stmt->execute([$razao_social, $nome_fantasia, $cnpj, $area_atuacao, $contato_nome, $contato_email, $contato_telefone]);
                api_response(true, 'Fornecedor criado com sucesso.', ['id' => $pdo->lastInsertId()]);
            }
            break;

        case 'toggle_status':
            // Esta ação funciona apenas para a tabela 'compras_fornecedores'
            $id = (int)($_POST['id'] ?? 0);
            if ($id <= 0) {
                api_response(false, 'ID do fornecedor inválido.', null, 400);
            }
            $stmt_current = $pdo->prepare("SELECT ativo FROM compras_fornecedores WHERE id = ?");
            $stmt_current->execute([$id]);
            $current_status = $stmt_current->fetchColumn();
            
            $new_status = ($current_status == 1) ? 0 : 1;

            $stmt = $pdo->prepare("UPDATE compras_fornecedores SET ativo = ? WHERE id = ?");
            $stmt->execute([$new_status, $id]);
            api_response(true, 'Status do fornecedor alterado com sucesso.');
            break;

        default:
            api_response(false, 'Ação inválida ou não fornecida.', null, 400);
    }
} catch (PDOException $e) {
    if ($e->getCode() == '23000') {
         api_response(false, 'Já existe um fornecedor com este CNPJ.', null, 409);
    }
    api_response(false, 'Erro de banco de dados: ' . $e->getMessage(), null, 500);
}
