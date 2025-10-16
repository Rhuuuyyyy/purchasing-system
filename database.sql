-- Estrutura Completa do Banco de Dados do Sistema de Compras

-- Tabela 1: Armazena o cabeçalho de cada solicitação de compra.
CREATE TABLE `compras_solicitacoes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `solicitante_nome` varchar(255) NOT NULL,
  `solicitante_setor` varchar(255) NOT NULL,
  `solicitante_email` varchar(255) NOT NULL,
  `data_solicitacao` date NOT NULL,
  `justificativa` text,
  `status` enum('Pendente de Aprovação','Aprovado pelo Gerente','Rejeitado','Ordem Gerada','Concluído') DEFAULT 'Pendente de Aprovação',
  `observacao_entrega` text,
  `nota_fiscal` varchar(100) DEFAULT NULL,
  `action_token` varchar(64) DEFAULT NULL,
  `criado_em` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabela 2: Armazena os itens individuais de cada solicitação.
CREATE TABLE `compras_solicitacoes_itens` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `solicitacao_id` int(11) NOT NULL,
  `descricao_item` varchar(255) NOT NULL,
  `tamanho` varchar(100) DEFAULT NULL,
  `quantidade` int(11) NOT NULL,
  `unidade_medida` varchar(50) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `solicitacao_id` (`solicitacao_id`),
  CONSTRAINT `compras_solicitacoes_itens_ibfk_1` FOREIGN KEY (`solicitacao_id`) REFERENCES `compras_solicitacoes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabela 3: Armazena os caminhos para as fotos de cada item.
CREATE TABLE `compras_solicitacoes_itens_fotos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `item_id` int(11) NOT NULL,
  `caminho_arquivo` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `item_id` (`item_id`),
  CONSTRAINT `compras_solicitacoes_itens_fotos_ibfk_1` FOREIGN KEY (`item_id`) REFERENCES `compras_solicitacoes_itens` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabela 4: Armazena os dados dos fornecedores.
CREATE TABLE `compras_fornecedores` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nome` varchar(255) NOT NULL,
  `cnpj` varchar(20) DEFAULT NULL,
  `contato_nome` varchar(255) DEFAULT NULL,
  `contato_email` varchar(255) DEFAULT NULL,
  `telefone` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `cnpj` (`cnpj`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabela 5: Armazena as ordens de compra geradas.
CREATE TABLE `compras_ordens_compra` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `solicitacao_id` int(11) NOT NULL,
  `fornecedor_id` int(11) NOT NULL,
  `data_emissao` date NOT NULL,
  `valor_total` decimal(10,2) NOT NULL,
  `condicao_pagamento` varchar(255) DEFAULT NULL,
  `observacoes` text,
  `status` varchar(50) NOT NULL DEFAULT 'Emitida',
  PRIMARY KEY (`id`),
  KEY `solicitacao_id` (`solicitacao_id`),
  KEY `fornecedor_id` (`fornecedor_id`),
  CONSTRAINT `compras_ordens_compra_ibfk_1` FOREIGN KEY (`solicitacao_id`) REFERENCES `compras_solicitacoes` (`id`),
  CONSTRAINT `compras_ordens_compra_ibfk_2` FOREIGN KEY (`fornecedor_id`) REFERENCES `compras_fornecedores` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabela 6: Armazena um catálogo de produtos (se necessário).
CREATE TABLE `compras_produtos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nome` varchar(255) NOT NULL,
  `descricao` text,
  `unidade_medida` varchar(50) DEFAULT NULL,
  `fornecedor_padrao_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fornecedor_padrao_id` (`fornecedor_padrao_id`),
  CONSTRAINT `compras_produtos_ibfk_1` FOREIGN KEY (`fornecedor_padrao_id`) REFERENCES `compras_fornecedores` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabela 7: Tabela para a funcionalidade de Follow Up (mesmo que removida, a estrutura está aqui).
CREATE TABLE `compras_follow_up` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `solicitacao_item_id` int(11) NOT NULL,
  `custo_centro` varchar(100) DEFAULT NULL,
  `situacao` varchar(100) DEFAULT NULL,
  `aplicacao` varchar(255) DEFAULT NULL,
  `data_nf` date DEFAULT NULL,
  `previsao_entrega` varchar(100) DEFAULT NULL,
  `envio_financeiro` date DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `solicitacao_item_id_unique` (`solicitacao_item_id`),
  CONSTRAINT `fk_follow_up_item` FOREIGN KEY (`solicitacao_item_id`) REFERENCES `compras_solicitacoes_itens` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
