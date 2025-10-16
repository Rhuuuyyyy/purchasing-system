<?php
/**
 * API Handler para Ordens de Compra (com get_details completo para PDF)
 */
require_once __DIR__ . '/../auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_response(false, 'Método não permitido. Use POST.', null, 405);
}

$action = $_POST['action'] ?? '';

try {
    switch ($action) {
        case 'get_all':
            $stmt = $pdo->query("
                SELECT 
                    oc.id,
                    oc.data_emissao,
                    oc.valor_total,
                    oc.status,
                    cf.nome_fantasia AS fornecedor_nome
                FROM compras_ordens oc
                JOIN compras_fornecedores cf ON oc.fornecedor_id = cf.id
                ORDER BY oc.data_emissao DESC, oc.id DESC
            ");
            $ordens = $stmt->fetchAll(PDO::FETCH_ASSOC);
            api_response(true, 'Ordens de compra carregadas.', ['ordens' => $ordens]);
            break;

        case 'get_details':
            $id = (int)($_POST['id'] ?? 0);
            if ($id <= 0) {
                api_response(false, 'ID da ordem de compra inválido.', null, 400);
            }

            // Consulta principal que junta todas as informações necessárias
            $sql = "
                SELECT
                    oc.id AS ordem_id,
                    oc.data_emissao,
                    oc.valor_total,
                    oc.condicoes_pagamento,
                    oc.observacoes,
                    oc.status AS ordem_status,
                    s.id AS solicitacao_id,
                    s.solicitante_nome,
                    s.solicitante_setor,
                    s.justificativa,
                    cf.id AS fornecedor_id,
                    cf.razao_social AS fornecedor_razao_social,
                    cf.nome_fantasia AS fornecedor_nome_fantasia,
                    cf.cnpj AS fornecedor_cnpj,
                    cf.contato_nome AS fornecedor_contato,
                    cf.contato_email AS fornecedor_email,
                    cf.contato_telefone AS fornecedor_telefone
                FROM compras_ordens oc
                JOIN compras_solicitacoes s ON oc.solicitacao_id = s.id
                JOIN compras_fornecedores cf ON oc.fornecedor_id = cf.id
                WHERE oc.id = ?
            ";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$id]);
            $details = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$details) {
                api_response(false, 'Ordem de compra não encontrada.', null, 404);
            }

            // Busca os itens da solicitação original
            $stmt_itens = $pdo->prepare("SELECT descricao_item, quantidade, unidade_medida FROM compras_solicitacoes_itens WHERE solicitacao_id = ?");
            $stmt_itens->execute([$details['solicitacao_id']]);
            $details['itens'] = $stmt_itens->fetchAll(PDO::FETCH_ASSOC);

            api_response(true, 'Detalhes da ordem carregados.', ['details' => $details]);
            break;

        case 'create':
            $solicitacao_id = (int)($_POST['solicitacao_id'] ?? 0);
            $fornecedor_id_raw = trim($_POST['fornecedor_id'] ?? ''); 
            $valor_total = (float)($_POST['valor_total'] ?? 0);
            $condicoes_pagamento = trim($_POST['condicoes_pagamento'] ?? '');
            $observacoes = trim($_POST['observacoes'] ?? '');

            if ($solicitacao_id <= 0 || empty($fornecedor_id_raw) || $valor_total <= 0) {
                api_response(false, 'Solicitação, fornecedor e valor total são obrigatórios.', null, 400);
            }

            $pdo->beginTransaction();

            list($prefix, $id_fornecedor) = explode('_', $fornecedor_id_raw . '_');
            $id_fornecedor = (int)$id_fornecedor;
            $fornecedor_id_final = 0;

            if ($prefix === 'c') {
                $fornecedor_id_final = $id_fornecedor;
            } elseif ($prefix === 'f') {
                $stmt_fin = $pdo->prepare("SELECT Nome, `CNPJ/CPF` FROM relacao_financeiro WHERE id = ?");
                $stmt_fin->execute([$id_fornecedor]);
                $fornecedor_financeiro = $stmt_fin->fetch(PDO::FETCH_ASSOC);

                if (!$fornecedor_financeiro) {
                    $pdo->rollBack();
                    api_response(false, 'O fornecedor do financeiro selecionado não foi encontrado.', null, 404);
                }
                
                $stmt_check = $pdo->prepare("SELECT id FROM compras_fornecedores WHERE cnpj = ?");
                $stmt_check->execute([$fornecedor_financeiro['CNPJ/CPF']]);
                $existing_id = $stmt_check->fetchColumn();

                if ($existing_id) {
                    $fornecedor_id_final = $existing_id;
                } else {
                    $stmt_insert = $pdo->prepare(
                        "INSERT INTO compras_fornecedores (razao_social, nome_fantasia, cnpj, area_atuacao) VALUES (?, ?, ?, ?)"
                    );
                    $stmt_insert->execute([
                        $fornecedor_financeiro['Nome'],
                        $fornecedor_financeiro['Nome'],
                        $fornecedor_financeiro['CNPJ/CPF'],
                        'Financeiro (Importado)'
                    ]);
                    $fornecedor_id_final = $pdo->lastInsertId();
                }
            } else {
                $pdo->rollBack();
                api_response(false, 'ID de fornecedor inválido.', null, 400);
            }

            $stmt = $pdo->prepare(
                "INSERT INTO compras_ordens (solicitacao_id, fornecedor_id, data_emissao, valor_total, condicoes_pagamento, observacoes, status) VALUES (?, ?, CURDATE(), ?, ?, ?, 'Emitida')"
            );
            $stmt->execute([$solicitacao_id, $fornecedor_id_final, $valor_total, $condicoes_pagamento, $observacoes]);
            $ordem_id = $pdo->lastInsertId();

            $stmt_update = $pdo->prepare("UPDATE compras_solicitacoes SET status = 'Ordem Gerada' WHERE id = ?");
            $stmt_update->execute([$solicitacao_id]);

            $pdo->commit();
            api_response(true, 'Ordem de compra gerada com sucesso.', ['id' => $ordem_id]);
            break;

        default:
            api_response(false, 'Ação inválida ou não fornecida.', null, 400);
    }
} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    api_response(false, 'Erro de banco de dados: ' . $e->getMessage(), null, 500);
}
