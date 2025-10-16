<?php
// Ativa a exibição de todos os erros para depuração
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

/**
 * API Handler para Ações via E-mail (Aprovar/Recusar)
 * VERSÃO SIMPLIFICADA: Executa a ação imediatamente e notifica o setor de compras.
 */

// Inclui a ligação à base de dados
require_once __DIR__ . '/../config/database.php';

// Função para gerar uma página de resposta em HTML
function render_html_response($title, $message, $is_success = true) {
    $icon = $is_success ? 'fa-check-circle' : 'fa-exclamation-triangle';
    $color = $is_success ? '#059669' : '#dc3545'; // Cores diretas para evitar dependência de CSS
    $button_link = "https://www.solovivo.com.br/SoloVivo/Intranet/compras/index.html";
    $button_text = "Voltar ao Sistema de Compras";
    $button_html = "<p style='margin-top: 30px;'><a href='{$button_link}' style='display: inline-block; padding: 12px 24px; font-size: 1rem; font-weight: 600; color: #fff; background-color: #059669; border-radius: 6px; text-decoration: none; transition: background-color 0.2s;'>{$button_text}</a></p>";

    echo <<<HTML
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{$title}</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap');
            body { 
                display: flex; justify-content: center; align-items: center; height: 100vh; 
                background-color: #f0fdf4; text-align: center; padding: 20px; 
                font-family: 'Poppins', sans-serif;
            }
            .card { 
                max-width: 500px; background-color: #fff; padding: 40px; border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.08);
            }
            .icon { font-size: 3.5rem; color: {$color}; margin-bottom: 20px; }
            h3 { font-size: 1.75rem; margin-bottom: 15px; color: #333; }
            p { color: #6c757d; line-height: 1.6; }
        </style>
    </head>
    <body>
        <div class="card">
            <div class="icon"><i class="fas {$icon}"></i></div>
            <h3>{$title}</h3>
            <p>{$message}</p>
            {$button_html}
        </div>
    </body>
    </html>
HTML;
    exit;
}

// 1. PROCESSAR A AÇÃO DIRETAMENTE
$id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);
$action = filter_input(INPUT_GET, 'action', FILTER_SANITIZE_STRING);
$token = filter_input(INPUT_GET, 'token', FILTER_SANITIZE_STRING);

if (!$id || !$action || !$token) {
    render_html_response('Erro', 'Parâmetros inválidos na sua solicitação.', false);
}

if (!isset($pdo)) {
    render_html_response('Erro Crítico', 'Não foi possível estabelecer ligação com a base de dados.', false);
}

try {
    // Verifica se o token corresponde e se a solicitação ainda está pendente
    $stmt = $pdo->prepare("SELECT status, action_token FROM compras_solicitacoes WHERE id = ?");
    $stmt->execute([$id]);
    $solicitacao = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$solicitacao) {
        render_html_response('Erro', 'A solicitação de compra não foi encontrada.', false);
    }

    if ($solicitacao['status'] !== 'Pendente de Aprovação') {
        render_html_response('Aviso', 'Esta solicitação já foi processada anteriormente. O status atual é: ' . htmlspecialchars($solicitacao['status']), false);
    }
    
    if (!hash_equals($solicitacao['action_token'], $token)) {
        render_html_response('Erro de Segurança', 'O link de ação é inválido ou expirou.', false);
    }

    $new_status = '';
    if ($action === 'approve') {
        $new_status = 'Aprovado pelo Gerente';
    } elseif ($action === 'reject') {
        $new_status = 'Rejeitado';
    } else {
        render_html_response('Erro', 'Ação desconhecida.', false);
    }

    // Atualiza o status e invalida o token
    $update_stmt = $pdo->prepare("UPDATE compras_solicitacoes SET status = ?, action_token = NULL WHERE id = ?");
    $update_stmt->execute([$new_status, $id]);

    // *** INÍCIO DA LÓGICA DE E-MAIL PARA COMPRAS ***
    if ($new_status === 'Aprovado pelo Gerente') {
        // Buscar detalhes completos para enviar no e-mail
        $stmt_main = $pdo->prepare("SELECT * FROM compras_solicitacoes WHERE id = ?");
        $stmt_main->execute([$id]);
        $solicitacao_details = $stmt_main->fetch(PDO::FETCH_ASSOC);

        if ($solicitacao_details) {
            $stmt_items = $pdo->prepare("SELECT * FROM compras_solicitacoes_itens WHERE solicitacao_id = ?");
            $stmt_items->execute([$id]);
            $itens = $stmt_items->fetchAll(PDO::FETCH_ASSOC);

            $base_dir = __DIR__ . '/../';
            foreach ($itens as &$item) {
                $stmt_fotos = $pdo->prepare("SELECT caminho_arquivo FROM compras_solicitacoes_itens_fotos WHERE item_id = ?");
                $stmt_fotos->execute([$item['id']]);
                $paths = $stmt_fotos->fetchAll(PDO::FETCH_COLUMN);
                $item['base64_photos_for_email'] = [];
                foreach ($paths as $path) {
                    $full_path = $base_dir . $path;
                    if (file_exists($full_path)) {
                        $type = pathinfo($full_path, PATHINFO_EXTENSION);
                        $data = file_get_contents($full_path);
                        $item['base64_photos_for_email'][] = 'data:image/' . $type . ';base64,' . base64_encode($data);
                    }
                }
            }
            unset($item);

            try {
                $to = 'compras@solovivo.com.br';
                $subject = "Solicitação de Compra Aprovada (#{$id})";
                
                $message = "
                <html>
                <head>
                    <title>Solicitação de Compra Aprovada</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
                        .container { padding: 20px; border: 1px solid #ddd; border-radius: 5px; max-width: 600px; margin: 20px auto; background-color: #ffffff; }
                        h2 { color: #059669; }
                        table { width: 100%; border-collapse: collapse; }
                        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
                        th { background-color: #f2f2f2; }
                        .item-photos img { width: 80px; height: 80px; object-fit: cover; border-radius: 4px; margin-right: 5px; margin-top: 5px; }
                        .footer-note { margin-top: 20px; font-size: 0.9em; color: #888; text-align: center; }
                    </style>
                </head>
                <body>
                    <div class='container'>
                        <h2>Solicitação de Compra Aprovada</h2>
                        <p>A seguinte solicitação de compra foi aprovada e está pronta para cotação e/ou emissão da ordem de compra.</p>
                        <p><strong>ID da Solicitação:</strong> #{$id}</p>
                        <p><strong>Solicitante:</strong> " . htmlspecialchars($solicitacao_details['solicitante_nome']) . "</p>
                        <p><strong>Setor:</strong> " . htmlspecialchars($solicitacao_details['solicitante_setor']) . "</p>
                        <p><strong>Justificativa:</strong> " . nl2br(htmlspecialchars($solicitacao_details['justificativa'])) . "</p>
                        <h3>Itens Solicitados:</h3>
                        <table>
                            <thead>
                                <tr><th>Quantidade</th><th>Unidade</th><th>Tamanho</th><th>Descrição</th></tr>
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
                        <p class='footer-note'>
                            Este é um e-mail automático. Por favor, acesse o sistema de compras para dar continuidade ao processo.
                        </p>
                    </div>
                </body>
                </html>";

                $headers = "MIME-Version: 1.0" . "\r\n";
                $headers .= "Content-type:text/html;charset=UTF-8" . "\r\n";
                $headers .= 'From: <sistema.compras@solovivo.com.br>' . "\r\n";

                mail($to, $subject, $message, $headers);
            } catch (Exception $e) { /* Ignora falhas no envio */ }
        }
    }
    // *** FIM DA LÓGICA DE E-MAIL ***

    $success_message = $action === 'approve' ? "A solicitação de compra #{$id} foi APROVADA com sucesso." : "A solicitação de compra #{$id} foi RECUSADA com sucesso.";
    render_html_response('Ação Concluída', $success_message, true);

} catch (PDOException $e) {
    render_html_response('Erro de Base de Dados', 'Ocorreu um erro ao processar a sua solicitação.', false);
}

