Internal Purchasing Management System

A comprehensive, self-hosted web application built with PHP and Vanilla JavaScript to manage the complete internal procurement lifecycle for a business. This system provides a clear workflow for employees to create requests, managers to approve them, and the purchasing department to issue purchase orders.

Core Features

Role-Based Access Control: Distinct interfaces and permissions for three user roles:

Employee: Can create new requests and track the status of their own requests.

Manager: Can view all pending requests, approve/reject them, and view team requests.

Purchasing: Can view all approved requests, manage suppliers, and generate Purchase Orders.

Intranet-Based Authentication: Designed to integrate seamlessly with an existing company intranet, using the $_SESSION for secure user identification.

Dynamic Request Creation: Employees can create detailed purchase requests, including adding multiple items, specifying quantity, size, unit of measure, and uploading photos for clarification.

Manager Approval Workflow:

Managers receive an email notification for new requests.

Emails contain secure, one-click "Approve" and "Reject" buttons.

The action is processed instantly via a secure token, without requiring the manager to log in.

Automated Purchasing Notification: Upon manager approval, the purchasing department (compras@...) automatically receives a detailed email with all request info (including photos), signaling them to begin the procurement process.

End-to-End Status Tracking: Requests are tracked through a clear status system:

Pendente de Aprovação (Pending Approval)

Aprovado pelo Gerente (Manager Approved)

Ordem Gerada (Order Generated)

Rejeitado (Rejected)

Concluído (Completed)

Delivery Confirmation: Requesters can close the loop by marking their items as "Delivered" and adding an invoice number and delivery observations.

SPA-like Interface: Built as a fast, responsive Single Page Application (SPA) using vanilla JavaScript for navigation and content rendering without page reloads.

Technology Stack

Backend: PHP 8.x (Procedural API handlers)

Frontend: Vanilla JavaScript (ES6+), HTML5, CSS3

Database: MySQL / MariaDB

Key Libraries:

Chart.js: For data visualization on the dashboard.

Choices.js: For advanced, searchable select inputs.

jspdf & jspdf-autotable: For client-side PDF generation of Purchase Orders.

Project Structure

/
├── api/                     # Backend PHP handlers (REST-like)
│   ├── auth.php             # Handles session validation & user permissions
│   ├── solicitacoes_handler.php # Core logic for creating/updating requests
│   ├── email_action_handler.php # Logic for handling approve/reject email links
│   ├── ordens_handler.php     # Logic for Purchase Orders
│   ├── ...                  # Other handlers (suppliers, products, etc.)
│
├── assets/
│   ├── css/                 # Main application stylesheet
│   │   └── style.css
│   ├── js/                  # Frontend JavaScript modules
│   │   ├── main.js            # Core SPA router, navigation, and API request wrapper
│   │   ├── solicitacoes.js    # Logic for the "Requests" module
│   │   ├── ordens.js          # Logic for the "Purchase Orders" module
│   │   ├── ...                # Other feature modules
│
├── config/
│   └── database.php         # Database connection (PDO)
│
├── uploads/                 # Writable directory for item photos
│
└── index.php                # Main application entry point (loads HTML shell)


Database Schema

The system relies on 7 core tables.

<details>
<summary>Click to expand/collapse SQL Schema</summary>

-- 1. Main request header
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

-- 2. Individual items for each request
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

-- 3. Stores paths to uploaded photos for each item
CREATE TABLE `compras_solicitacoes_itens_fotos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `item_id` int(11) NOT NULL,
  `caminho_arquivo` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `item_id` (`item_id`),
  CONSTRAINT `compras_solicitacoes_itens_fotos_ibfk_1` FOREIGN KEY (`item_id`) REFERENCES `compras_solicitacoes_itens` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Supplier data
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

-- 5. Generated Purchase Orders
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

-- 6. Product catalog (optional)
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

-- 7. Follow-up data (optional module)
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


</details>

Installation and Setup

Clone Repository:

git clone [your-repository-url]
cd [repository-name]
