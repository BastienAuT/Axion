ALTER TABLE `attachments` ADD `report_id` text;--> statement-breakpoint
ALTER TABLE `attachments` ADD `size_bytes` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `attachments` ADD `data_base64` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_attachments_report_id` ON `attachments` (`report_id`);