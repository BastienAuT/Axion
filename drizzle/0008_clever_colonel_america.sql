ALTER TABLE `billing_documents` ADD `customer_id` text;--> statement-breakpoint
CREATE INDEX `idx_billing_customer_id` ON `billing_documents` (`organization_id`,`customer_id`);--> statement-breakpoint
ALTER TABLE `interventions` ADD `customer_id` text;--> statement-breakpoint
ALTER TABLE `interventions` ADD `technician_user_id` text;--> statement-breakpoint
CREATE INDEX `idx_interventions_customer_id` ON `interventions` (`organization_id`,`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_interventions_technician_user_id` ON `interventions` (`organization_id`,`technician_user_id`);