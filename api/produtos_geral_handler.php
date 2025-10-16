<?php
/**
 * API Handler para Gestão de Produtos (Almoxarifado e Catálogo de Compras)
 */
require_once __DIR__ . '/../auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_response(false, 'Método não permitido. Use POST.', null, 405);
}

// Apenas administradores podem aceder a esta funcionalidade
if (!is_full_admin() && !is_purchasing()) {
    api_response(false, 'Acesso negado. Apenas administradores podem gerir produtos.', null, 403);
}

$action = $_POST['action'] ?? '';

try {
    switch ($action) {
        case 'get_almoxarifado_produtos':
            $stmt = $pdo->query("SELECT cod, produto, quantidade FROM almoxarifado_produtos WHERE ativo = 1 ORDER BY produto ASC");
            $produtos = $stmt->fetchAll(PDO::FETCH_ASSOC);
            api_response(true, 'Produtos do almoxarifado carregados.', ['produtos' => $produtos]);
            break;

        case 'get_catalogo_produtos':
            $stmt = $pdo->query("SELECT id, nome, descricao, categoria FROM compras_produtos_catalogo WHERE ativo = 1 ORDER BY nome ASC");
            $produtos = $stmt->fetchAll(PDO::FETCH_ASSOC);
            api_response(true, 'Produtos do catálogo carregados.', ['produtos' => $produtos]);
            break;

        case 'save_catalogo_produto':
            $id = (int)($_POST['id'] ?? 0);
            $nome = trim($_POST['nome'] ?? '');
            $descricao = trim($_POST['descricao'] ?? '');
            $categoria = trim($_POST['categoria'] ?? '');

            if (empty($nome)) {
                api_response(false, 'O nome do produto é obrigatório.', null, 400);
            }

            if ($id > 0) { // Atualizar
                $stmt = $pdo->prepare("UPDATE compras_produtos_catalogo SET nome = ?, descricao = ?, categoria = ? WHERE id = ?");
                $stmt->execute([$nome, $descricao, $categoria, $id]);
                api_response(true, 'Produto do catálogo atualizado com sucesso.');
            } else { // Criar
                $stmt = $pdo->prepare("INSERT INTO compras_produtos_catalogo (nome, descricao, categoria) VALUES (?, ?, ?)");
                $stmt->execute([$nome, $descricao, $categoria]);
                api_response(true, 'Novo produto adicionado ao catálogo com sucesso.');
            }
            break;

        case 'delete_catalogo_produto':
            $id = (int)($_POST['id'] ?? 0);
            if ($id <= 0) {
                api_response(false, 'ID do produto inválido.', null, 400);
            }
            // Usamos soft delete
            $stmt = $pdo->prepare("UPDATE compras_produtos_catalogo SET ativo = 0 WHERE id = ?");
            $stmt->execute([$id]);
            api_response(true, 'Produto do catálogo desativado com sucesso.');
            break;

        default:
            api_response(false, 'Ação inválida ou não fornecida.', null, 400);
    }
} catch (PDOException $e) {
    if ($e->getCode() == '23000') {
        api_response(false, 'Já existe um produto com este nome no catálogo.', null, 409);
    }
    api_response(false, 'Erro de banco de dados: ' . $e->getMessage(), null, 500);
}
