<?php
// Ativa a exibição de todos os erros para depuração
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

/**
 * API Handler para Solicitações de Compra (VERSÃO COM LÓGICA DE E-MAIL CENTRALIZADA E CORRIGIDA)
 */
require_once __DIR__ . '/../auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_response(false, 'Método não permitido. Use POST.', null, 405);
}

$action = $_POST['action'] ?? '';

try {
    switch ($action) {
        case 'get_all':
            $sql = "SELECT s.*, (SELECT COUNT(*) FROM compras_solicitacoes_itens WHERE solicitacao_id = s.id) as total_itens FROM compras_solicitacoes s";
            $params = [];
            $where_clauses = [];

            if (!empty($_POST['status'])) {
                $where_clauses[] = "s.status = ?";
                $params[] = $_POST['status'];
            } else {
                 if (is_full_admin()) {
                    // Admin vê todos os status relevantes para gestão
                    $where_clauses[] = "s.status IN ('Pendente de Aprovação', 'Aprovado pelo Gerente', 'Ordem Gerada', 'Concluído', 'Rejeitado')";
                } elseif (is_purchasing()) {
                    // Compras vê a partir da aprovação
                    $where_clauses[] = "s.status IN ('Aprovado pelo Gerente', 'Ordem Gerada', 'Concluído')";
                } else {
                    // Utilizador padrão vê apenas os seus
                    $where_clauses[] = "s.solicitante_email = ?";
                    $params[] = $usuario_logado;
                }
            }

            if (!empty($where_clauses)) {
                $sql .= " WHERE " . implode(' AND ', $where_clauses);
            }
            $sql .= " ORDER BY s.data_solicitacao DESC, s.id DESC";
            
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $solicitacoes = $stmt->fetchAll(PDO::FETCH_ASSOC);
            api_response(true, 'Solicitações carregadas.', ['solicitacoes' => $solicitacoes]);
            break;

        case 'get_details':
            $id = (int)($_POST['id'] ?? 0);
            if ($id <= 0) api_response(false, 'ID da solicitação inválido.', null, 400);

            $stmt_main = $pdo->prepare("SELECT * FROM compras_solicitacoes WHERE id = ?");
            $stmt_main->execute([$id]);
            $solicitacao = $stmt_main->fetch(PDO::FETCH_ASSOC);

            if (!$solicitacao) api_response(false, 'Solicitação não encontrada.', null, 404);

            $stmt_items = $pdo->prepare("SELECT * FROM compras_solicitacoes_itens WHERE solicitacao_id = ?");
            $stmt_items->execute([$id]);
            $itens = $stmt_items->fetchAll(PDO::FETCH_ASSOC);

            $stmt_fotos = $pdo->prepare("SELECT caminho_arquivo FROM compras_solicitacoes_itens_fotos WHERE item_id = ?");
            foreach ($itens as $key => $item) {
                $stmt_fotos->execute([$item['id']]);
                $fotos = $stmt_fotos->fetchAll(PDO::FETCH_COLUMN);
                $itens[$key]['fotos'] = $fotos;
            }
            
            $solicitacao['itens'] = $itens;
            
            api_response(true, 'Detalhes da solicitação carregados.', ['solicitacao' => $solicitacao]);
            break;

        case 'create':
            $solicitante_nome = trim($_POST['solicitante_nome'] ?? '');
            $solicitante_setor = trim($_POST['solicitante_setor'] ?? '');
            $justificativa = trim($_POST['justificativa'] ?? '');
            $itens = json_decode($_POST['itens'] ?? '[]', true);

            if (empty($solicitante_nome) || empty($solicitante_setor) || empty($itens)) {
                api_response(false, 'Nome, setor e pelo menos um item são obrigatórios.', null, 400);
            }

            $pdo->beginTransaction();
            
            $action_token = bin2hex(random_bytes(32));

            $stmt_sol = $pdo->prepare(
                "INSERT INTO compras_solicitacoes (solicitante_nome, solicitante_setor, solicitante_email, data_solicitacao, justificativa, status, action_token) VALUES (?, ?, ?, CURDATE(), ?, ?, ?)"
            );
            $stmt_sol->execute([$solicitante_nome, $solicitante_setor, $usuario_logado, $justificativa, 'Pendente de Aprovação', $action_token]);
            $solicitacao_id = $pdo->lastInsertId();

            $stmt_item = $pdo->prepare(
                "INSERT INTO compras_solicitacoes_itens (solicitacao_id, descricao_item, tamanho, quantidade, unidade_medida) VALUES (?, ?, ?, ?, ?)"
            );
            $stmt_foto_insert = $pdo->prepare(
                "INSERT INTO compras_solicitacoes_itens_fotos (item_id, caminho_arquivo) VALUES (?, ?)"
            );
            
            $upload_dir = __DIR__ . '/../uploads/';
            if (!is_dir($upload_dir)) {
                if (!mkdir($upload_dir, 0775, true)) {
                    $pdo->rollBack();
                    api_response(false, 'Erro Crítico: Não foi possível criar o diretório de uploads.', null, 500);
                }
            }
             if (!is_writable($upload_dir)) {
                $pdo->rollBack();
                api_response(false, "Erro Crítico: O diretório de uploads não tem permissão de escrita.", null, 500);
            }

            foreach ($itens as &$item) { // Use reference to add photo data for email
                $stmt_item->execute([$solicitacao_id, trim($item['descricao_item'] ?? ''), trim($item['tamanho'] ?? ''), (int)($item['quantidade'] ?? 1), trim($item['unidade_medida'] ?? '')]);
                $item_id = $pdo->lastInsertId();
                $item['base64_photos_for_email'] = []; 

                if (!empty($item['fotos']) && is_array($item['fotos'])) {
                    foreach ($item['fotos'] as $base64_string) {
                        $item['base64_photos_for_email'][] = $base64_string;

                        if (preg_match('/^data:image\/(\w+);base64,/', $base64_string, $type)) {
                            $data = substr($base64_string, strpos($base64_string, ',') + 1);
                            $type = strtolower($type[1]);
                            if (!in_array($type, ['jpg', 'jpeg', 'png', 'gif'])) continue;
                            $data = base64_decode($data);
                            if ($data === false) continue;
                            $file_name = uniqid("sol_{$solicitacao_id}_") . '.' . $type;
                            $destination = $upload_dir . $file_name;
                            if (file_put_contents($destination, $data)) {
                                $stmt_foto_insert->execute([$item_id, 'uploads/' . $file_name]);
                            }
                        }
                    }
                }
            }
            unset($item);

            $pdo->commit();

            // --- Envio de E-mail para o Gerente ---
            try {
                $to = 'gerente.ind@solovivo.com.br, ti@solovivo.com.br';
                $subject = "Nova Solicitação de Compra (#{$solicitacao_id})";
                
                $base_url = "https://www.solovivo.com.br/SoloVivo/Intranet/compras/api/email_action_handler.php";
                $approve_link = $base_url . "?id={$solicitacao_id}&action=approve&token={$action_token}";
                $reject_link = $base_url . "?id={$solicitacao_id}&action=reject&token={$action_token}";

                $message = "
                <html>
                <head>
                    <title>Nova Solicitação de Compra</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
                        .container { padding: 20px; border: 1px solid #ddd; border-radius: 5px; max-width: 600px; margin: 20px auto; background-color: #ffffff; }
                        h2 { color: #059669; }
                        table { width: 100%; border-collapse: collapse; }
                        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
                        th { background-color: #f2f2f2; }
                        .item-photos img { width: 80px; height: 80px; object-fit: cover; border-radius: 4px; margin-right: 5px; margin-top: 5px; }
                    </style>
                </head>
                <body>
                    <div class='container'>
                        <h2>Nova Solicitação de Compra Recebida</h2>
                        <p>Uma nova solicitação de compra foi registrada no sistema e aguarda a sua aprovação.</p>
                        <p><strong>ID da Solicitação:</strong> #{$solicitacao_id}</p>
                        <p><strong>Solicitante:</strong> " . htmlspecialchars($solicitante_nome) . "</p>
                        <p><strong>Setor:</strong> " . htmlspecialchars($solicitante_setor) . "</p>
                        <p><strong>Justificativa:</strong> " . nl2br(htmlspecialchars($justificativa)) . "</p>
                        <h3>Itens Solicitados:</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>Quantidade</th>
                                    <th>Unidade</th>
                                    <th>Tamanho</th>
                                    <th>Descrição</th>
                                </tr>
                            </thead>
                            <tbody>";

                foreach ($itens as $item) {
                    $message .= "
                                <tr>
                                    <td>" . htmlspecialchars($item['quantidade'] ?? 1) . "</td>
                                    <td>" . htmlspecialchars($item['unidade_medida'] ?? '') . "</td>
                                    <td>" . htmlspecialchars($item['tamanho'] ?? '') . "</td>
                                    <td>" . htmlspecialchars($item['descricao_item'] ?? '') . "</td>
                                </tr>";
                    
                    if (!empty($item['base64_photos_for_email'])) {
                        $message .= "<tr><td colspan='4' class='item-photos'>";
                        foreach ($item['base64_photos_for_email'] as $base64_src) {
                            $message .= "<img src='{$base64_src}' alt='Foto do item'/>";
                        }
                        $message .= "</td></tr>";
                    }
                }

                $message .= "
                            </tbody>
                        </table>
                        
                        <table border='0' cellpadding='0' cellspacing='0' width='100%' style='margin-top: 25px;'>
                            <tr>
                                <td align='center'>
                                    <table border='0' cellpadding='0' cellspacing='0'>
                                        <tr>
                                            <td align='center' style='border-radius: 5px; background-color: #16a34a;'>
                                                <a href='{$approve_link}' target='_blank' style='font-size: 16px; font-family: Arial, sans-serif; color: #ffffff; text-decoration: none; border-radius: 5px; padding: 12px 24px; border: 1px solid #16a34a; display: inline-block; font-weight: bold;'>Aprovar Solicitação</a>
                                            </td>
                                            <td width='20'>&nbsp;</td>
                                            <td align='center' style='border-radius: 5px; background-color: #dc3545;'>
                                                <a href='{$reject_link}' target='_blank' style='font-size: 16px; font-family: Arial, sans-serif; color: #ffffff; text-decoration: none; border-radius: 5px; padding: 12px 24px; border: 1px solid #dc3545; display: inline-block; font-weight: bold;'>Recusar Solicitação</a>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                        </table>

                        <p style='margin-top: 20px; font-size: 0.9em; color: #888; text-align: center;'>
                            Este é um e-mail automático. A ação será registrada em seu nome.
                        </p>
                    </div>
                </body>
                </html>
                ";

                $headers = "MIME-Version: 1.0" . "\r\n";
                $headers .= "Content-type:text/html;charset=UTF-8" . "\r\n";
                $headers .= 'From: <sistema.compras@solovivo.com.br>' . "\r\n";

                mail($to, $subject, $message, $headers);
            } catch (Exception $e) { /* Ignora falhas */ }
            
            api_response(true, 'Solicitação de compra criada com sucesso.', ['id' => $solicitacao_id]);
            break;

        case 'update_status':
            $id = (int)($_POST['id'] ?? 0);
            $status = trim($_POST['status'] ?? '');
            
            // Esta ação agora é apenas para o Compras (Ordem Gerada) ou Admin (Rejeitado) a partir da APP.
            // A aprovação do gerente foi movida para o email_action_handler.php
            if ((is_full_admin() && $status === 'Rejeitado') || (is_purchasing() && $status === 'Ordem Gerada')) {
                $stmt = $pdo->prepare("UPDATE compras_solicitacoes SET status = ? WHERE id = ?");
                $stmt->execute([$status, $id]);
                api_response(true, 'Status da solicitação atualizado com sucesso.');
            } else {
                api_response(false, 'Você não tem permissão para executar esta ação a partir daqui.', null, 403);
            }
            break;

        case 'delete':
             $id = (int)($_POST['id'] ?? 0);
             if (!is_full_admin()) {
                 api_response(false, 'Apenas administradores podem excluir solicitações.', null, 403);
             }
             $stmt = $pdo->prepare("DELETE FROM compras_solicitacoes WHERE id = ?");
             $stmt->execute([$id]);
             api_response(true, 'Solicitação excluída com sucesso.');
             break;
        
        case 'mark_as_delivered':
            $id = (int)($_POST['id'] ?? 0);
            $observacao = trim($_POST['observacao'] ?? '');
            $nota_fiscal = trim($_POST['nota_fiscal'] ?? '');

            if ($id <= 0) {
                api_response(false, 'ID da solicitação inválido.', null, 400);
            }
            
            $stmt_check = $pdo->prepare("SELECT solicitante_email FROM compras_solicitacoes WHERE id = ?");
            $stmt_check->execute([$id]);
            $solicitante_email = $stmt_check->fetchColumn();

            if ($solicitante_email === $usuario_logado || is_full_admin()) {
                 $stmt = $pdo->prepare("UPDATE compras_solicitacoes SET status = 'Concluído', observacao_entrega = ?, nota_fiscal = ? WHERE id = ?");
                 $stmt->execute([$observacao, $nota_fiscal, $id]);
                 api_response(true, 'Entrega confirmada com sucesso.');
            } else {
                api_response(false, 'Apenas o solicitante ou um administrador pode confirmar a entrega.', null, 403);
            }
            break;

        default:
            api_response(false, 'Ação inválida ou não fornecida.', null, 400);
    }
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    api_response(false, 'Ocorreu um erro no servidor: ' . $e->getMessage(), null, 500);
}

