CREATE TABLE `bank_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`bankName` varchar(128) NOT NULL,
	`accountName` varchar(128) NOT NULL,
	`accountNumber` varchar(64),
	`currency` varchar(8) NOT NULL DEFAULT 'CNY',
	`accountType` enum('checking','savings','credit','investment','other') NOT NULL DEFAULT 'checking',
	`balance` decimal(18,2) DEFAULT '0.00',
	`color` varchar(16) DEFAULT '#4F46E5',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bank_accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(64) NOT NULL,
	`type` enum('income','expense','transfer','tax','investment','other') NOT NULL,
	`color` varchar(16) DEFAULT '#6366F1',
	`icon` varchar(32) DEFAULT 'tag',
	`isDefault` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `statements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`bankAccountId` int NOT NULL,
	`fileName` varchar(256) NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`fileUrl` text NOT NULL,
	`fileType` enum('pdf','csv') NOT NULL,
	`fileSize` bigint,
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`transactionCount` int DEFAULT 0,
	`periodStart` timestamp,
	`periodEnd` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `statements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`bankAccountId` int NOT NULL,
	`statementId` int,
	`categoryId` int,
	`transactionDate` timestamp NOT NULL,
	`amount` decimal(18,2) NOT NULL,
	`type` enum('income','expense','transfer') NOT NULL,
	`description` text,
	`counterparty` varchar(256),
	`reference` varchar(128),
	`balance` decimal(18,2),
	`currency` varchar(8) DEFAULT 'CNY',
	`aiCategory` varchar(64),
	`aiConfidence` decimal(5,2),
	`isManuallyEdited` int DEFAULT 0,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);
