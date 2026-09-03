CREATE TABLE `billing_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`kind` text NOT NULL,
	`number` text NOT NULL,
	`client` text NOT NULL,
	`date` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `billing_documents_number_unique` ON `billing_documents` (`number`);--> statement-breakpoint
CREATE INDEX `idx_billing_organization_date` ON `billing_documents` (`organization_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_billing_organization_status` ON `billing_documents` (`organization_id`,`status`);--> statement-breakpoint
CREATE TABLE `billing_sequences` (
	`organization_id` text NOT NULL,
	`kind` text NOT NULL,
	`year` integer NOT NULL,
	`last_value` integer NOT NULL,
	PRIMARY KEY(`organization_id`, `kind`, `year`)
);
