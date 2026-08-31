CREATE INDEX `idx_attachments_intervention_id` ON `attachments` (`intervention_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_organization_created` ON `audit_logs` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_customers_organization_id` ON `customers` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_interventions_organization_date` ON `interventions` (`organization_id`,`scheduled_date`);--> statement-breakpoint
CREATE INDEX `idx_interventions_organization_status` ON `interventions` (`organization_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_reports_intervention_id` ON `reports` (`intervention_id`);--> statement-breakpoint
CREATE INDEX `idx_sites_organization_customer` ON `sites` (`organization_id`,`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_users_organization_id` ON `users` (`organization_id`);