<?php
/**
 * API Handler para buscar produtos (sugestões combinadas do Almoxarifado e Catálogo)
 *
 * Este script serve como uma ponte para ler a lista de produtos de ambas as fontes
 * e fornecê-la como sugestão no formulário de solicitação de compra.
 */
require_once __DIR__ . '/../auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_response(false, 'Método não permitido. Use POST.', null, 405);
}

$action = $_POST['action'] ?? '';

try {
    switch ($action) {
        case 'get_all':
            // Passo 1: Buscar produtos da tabela do almoxarifado
            $stmt_almox = $pdo->query("SELECT produto FROM almoxarifado_produtos WHERE ativo = 1 AND produto IS NOT NULL AND produto != ''");
            $produtos_almox = $stmt_almox->fetchAll(PDO::FETCH_COLUMN);

            // Passo 2: Buscar produtos da tabela de catálogo de compras
            $stmt_catalogo = $pdo->query("SELECT nome as produto FROM compras_produtos_catalogo WHERE ativo = 1 AND nome IS NOT NULL AND nome != ''");
            $produtos_catalogo = $stmt_catalogo->fetchAll(PDO::FETCH_COLUMN);

            // Passo 3: Juntar os dois arrays de nomes de produtos
            $produtos_combinados = array_merge($produtos_almox, $produtos_catalogo);

            // Passo 4: Remover nomes duplicados para ter uma lista limpa
            $produtos_unicos = array_unique($produtos_combinados);

            // Passo 5: Ordenar a lista final alfabeticamente
            sort($produtos_unicos);
            
            // Passo 6: Transformar para o formato esperado pelo frontend (um array de objetos)
            $produtos_finais = [];
            foreach ($produtos_unicos as $nome_produto) {
                // Garante que o nome não está vazio antes de adicionar
                if (!empty(trim($nome_produto))) {
                    $produtos_finais[] = ['produto' => $nome_produto];
                }
            }

            api_response(true, 'Sugestões de produtos carregadas com sucesso.', ['produtos' => $produtos_finais]);
            break;

        default:
            api_response(false, 'Ação inválida ou não fornecida.', null, 400);
    }
} catch (PDOException $e) {
    // Trata o caso de uma das tabelas não existir ou outro erro de base de dados
    api_response(false, 'Erro ao buscar sugestões de produtos: ' . $e->getMessage(), null, 500);
}
