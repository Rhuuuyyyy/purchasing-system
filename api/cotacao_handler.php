<?php
/**
 * API Handler para a funcionalidade de Cotações
 * Versão 2.2 - Adicionado suporte para buscar histórico de cotações.
 */
require_once __DIR__ . '/../auth.php';

// Apenas o setor de compras e administradores podem gerir cotações.
if (!is_purchasing() && !is_full_admin()) {
    api_response(false, 'Acesso negado. Você não tem permissão para gerir cotações.', null, 403);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_response(false, 'Método não permitido. Use POST.', null, 405);
}

$action = $_POST['action'] ?? '';

try {
    switch ($action) {
        // Ação para buscar solicitações aprovadas para iniciar uma cotação.
        case 'get_solicitacoes_aprovadas':
            $stmt = $pdo->query("
                SELECT id, solicitante_nome, data_solicitacao 
                FROM compras_solicitacoes 
                WHERE status = 'Aprovado pelo Gerente' 
                ORDER BY id DESC
            ");
            $solicitacoes = $stmt->fetchAll(PDO::FETCH_ASSOC);
            api_response(true, 'Solicitações carregadas.', ['solicitacoes' => $solicitacoes]);
            break;

        // Ação para buscar os itens de uma solicitação específica.
        case 'get_itens_solicitacao':
            $solicitacao_id = (int)($_POST['solicitacao_id'] ?? 0);
            if ($solicitacao_id <= 0) {
                api_response(false, 'ID da solicitação inválido.', null, 400);
            }
            $stmt = $pdo->prepare("
                SELECT descricao_item, quantidade, unidade_medida 
                FROM compras_solicitacoes_itens 
                WHERE solicitacao_id = ?
            ");
            $stmt->execute([$solicitacao_id]);
            $itens = $stmt->fetchAll(PDO::FETCH_ASSOC);
            api_response(true, 'Itens da solicitação carregados.', ['itens' => $itens]);
            break;
        
        // Ação principal para salvar o mapa de cotação completo.
        case 'save_cotacao':
            $cotacaoData = json_decode($_POST['cotacao_data'] ?? '[]', true);
            
            if (empty($cotacaoData) || empty($cotacaoData['produtos']) || empty($cotacaoData['fornecedores'])) {
                api_response(false, 'Dados da cotação incompletos ou em formato inválido.', null, 400);
            }

            $pdo->beginTransaction();

            $stmtCotacao = $pdo->prepare(
                "INSERT INTO compras_cotacoes (solicitacao_id, data_cotacao, descricao, responsavel_cotacao) VALUES (?, CURDATE(), ?, ?)"
            );
            $stmtCotacao->execute([
                $cotacaoData['solicitacao_id'] ?: null,
                $cotacaoData['descricao'] ?? 'Mapa Comparativo de Cotação',
                $usuario_logado
            ]);
            $cotacao_id = $pdo->lastInsertId();

            $stmtItem = $pdo->prepare(
                "INSERT INTO compras_cotacoes_itens (cotacao_id, descricao_produto, setor, unidade, quantidade) VALUES (?, ?, ?, ?, ?)"
            );
            $stmtFornecedor = $pdo->prepare(
                "INSERT INTO compras_cotacoes_fornecedores (cotacao_item_id, fornecedor_nome, valor_unitario, frete_tipo, frete_valor, prazo_entrega, cond_pagamento) VALUES (?, ?, ?, ?, ?, ?, ?)"
            );

            foreach ($cotacaoData['produtos'] as $produto) {
                $stmtItem->execute([
                    $cotacao_id,
                    $produto['descricao'],
                    $produto['setor'],
                    $produto['unidade'],
                    $produto['quantidade']
                ]);
                $cotacao_item_id = $pdo->lastInsertId();

                foreach ($produto['propostas'] as $proposta) {
                    $stmtFornecedor->execute([
                        $cotacao_item_id,
                        $proposta['fornecedor_nome'],
                        (float)($proposta['valor_unitario'] ?? 0),
                        $proposta['frete_tipo'] ?? null,
                        (float)($proposta['frete_valor'] ?? 0),
                        $proposta['prazo_entrega'] ?? null,
                        $proposta['cond_pagamento'] ?? null
                    ]);
                }
            }

            $pdo->commit();
            api_response(true, 'Mapa de cotação salvo com sucesso!', ['cotacao_id' => $cotacao_id]);
            break;

        // NOVA AÇÃO: Buscar o histórico de cotações salvas.
        case 'get_saved_cotacoes':
            $stmt = $pdo->query("
                SELECT id, descricao, data_cotacao, responsavel_cotacao 
                FROM compras_cotacoes 
                ORDER BY data_cotacao DESC, id DESC
            ");
            $cotacoes = $stmt->fetchAll(PDO::FETCH_ASSOC);
            api_response(true, 'Histórico de cotações carregado.', ['cotacoes' => $cotacoes]);
            break;

        // NOVA AÇÃO: Buscar todos os detalhes de uma cotação para gerar o PDF.
        case 'get_cotacao_details_for_pdf':
            $cotacao_id = (int)($_POST['id'] ?? 0);
            if ($cotacao_id <= 0) {
                api_response(false, 'ID da cotação inválido.', null, 400);
            }

            // 1. Busca os dados principais da cotação.
            $stmtMain = $pdo->prepare("SELECT * FROM compras_cotacoes WHERE id = ?");
            $stmtMain->execute([$cotacao_id]);
            $cotacao = $stmtMain->fetch(PDO::FETCH_ASSOC);

            if (!$cotacao) {
                api_response(false, 'Cotação não encontrada.', null, 404);
            }

            // 2. Busca os itens da cotação.
            $stmtItems = $pdo->prepare("SELECT * FROM compras_cotacoes_itens WHERE cotacao_id = ?");
            $stmtItems->execute([$cotacao_id]);
            $items = $stmtItems->fetchAll(PDO::FETCH_ASSOC);

            // 3. Busca as propostas dos fornecedores para cada item.
            $stmtProposals = $pdo->prepare("SELECT * FROM compras_cotacoes_fornecedores WHERE cotacao_item_id = ?");
            
            $fornecedores = [];
            $condicoesGerais = [];

            foreach ($items as $key => $item) {
                $stmtProposals->execute([$item['id']]);
                $propostas = $stmtProposals->fetchAll(PDO::FETCH_ASSOC);
                $items[$key]['propostas'] = $propostas;

                // Constrói a lista de fornecedores e condições gerais a partir da primeira proposta encontrada.
                foreach ($propostas as $proposta) {
                    if (!in_array($proposta['fornecedor_nome'], $fornecedores)) {
                        $fornecedores[] = $proposta['fornecedor_nome'];
                    }
                    if (!isset($condicoesGerais[$proposta['fornecedor_nome']])) {
                         $condicoesGerais[$proposta['fornecedor_nome']] = [
                            'frete_tipo' => $proposta['frete_tipo'],
                            'frete_valor' => $proposta['frete_valor'],
                            'prazo_entrega' => $proposta['prazo_entrega'],
                            'cond_pagamento' => $proposta['cond_pagamento'],
                        ];
                    }
                }
            }

            // 4. Monta o objeto final no mesmo formato do `cotacaoState` do frontend.
            $cotacao['produtos'] = $items;
            $cotacao['fornecedores'] = $fornecedores;
            $cotacao['condicoesGerais'] = $condicoesGerais;

            api_response(true, 'Detalhes da cotação carregados.', ['cotacao' => $cotacao]);
            break;

        default:
            api_response(false, 'Ação inválida ou não fornecida.', null, 400);
    }
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    api_response(false, 'Ocorreu um erro crítico no servidor: ' . $e->getMessage(), null, 500);
}
