DROP INDEX `billing_documents_number_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_billing_organization_number` ON `billing_documents` (`organization_id`,`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_customers_organization_name` ON `customers` (`organization_id`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_customers_organization_email` ON `customers` (`organization_id`,`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_sites_customer_name` ON `sites` (`organization_id`,`customer_id`,`name`);