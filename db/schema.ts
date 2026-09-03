import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(), name: text("name").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export const customers = sqliteTable("customers", {
  id: text("id").primaryKey(), organizationId: text("organization_id").notNull(),
  name: text("name").notNull(), contactName: text("contact_name").notNull().default(""),
  email: text("email").notNull().default(""), phone: text("phone").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_customers_organization_id").on(table.organizationId),
  uniqueIndex("uq_customers_organization_name").on(table.organizationId, table.name),
  uniqueIndex("uq_customers_organization_email").on(table.organizationId, table.email),
]);
export const sites = sqliteTable("sites", {
  id: text("id").primaryKey(), organizationId: text("organization_id").notNull(),
  customerId: text("customer_id").notNull(), name: text("name").notNull(),
  address: text("address").notNull(), city: text("city").notNull(),
}, (table) => [
  index("idx_sites_organization_customer").on(table.organizationId, table.customerId),
  uniqueIndex("uq_sites_customer_name").on(table.organizationId, table.customerId, table.name),
]);
export const interventions = sqliteTable("interventions", {
  id: text("id").primaryKey(), organizationId: text("organization_id").notNull(),
  customerId: text("customer_id"), technicianUserId: text("technician_user_id"),
  reference: text("reference").notNull().unique(), customerName: text("customer_name").notNull(),
  siteName: text("site_name").notNull(), address: text("address").notNull(),
  title: text("title").notNull(), description: text("description").notNull().default(""),
  technician: text("technician").notNull(), scheduledDate: text("scheduled_date").notNull(),
  scheduledTime: text("scheduled_time").notNull(), durationMinutes: integer("duration_minutes").notNull().default(60),
  priority: text("priority", { enum: ["low", "normal", "high", "urgent"] }).notNull().default("normal"),
  status: text("status", { enum: ["scheduled", "en_route", "in_progress", "completed", "cancelled"] }).notNull().default("scheduled"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_interventions_organization_date").on(table.organizationId, table.scheduledDate),
  index("idx_interventions_organization_status").on(table.organizationId, table.status),
  index("idx_interventions_customer_id").on(table.organizationId, table.customerId),
  index("idx_interventions_technician_user_id").on(table.organizationId, table.technicianUserId),
]);
export const reports = sqliteTable("reports", {
  id: text("id").primaryKey(), organizationId: text("organization_id").notNull(),
  interventionId: text("intervention_id").notNull(), summary: text("summary").notNull(),
  materials: text("materials").notNull().default(""), clientName: text("client_name").notNull().default(""),
  signedAt: text("signed_at"), signatureData: text("signature_data"), pdfKey: text("pdf_key"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_reports_intervention_id").on(table.interventionId)]);
export const attachments = sqliteTable("attachments", {
  id: text("id").primaryKey(), organizationId: text("organization_id").notNull(),
  interventionId: text("intervention_id").notNull(), reportId: text("report_id"),
  storageKey: text("storage_key").notNull(),
  filename: text("filename").notNull(), contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull().default(0),
  dataBase64: text("data_base64").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_attachments_intervention_id").on(table.interventionId),
  index("idx_attachments_report_id").on(table.reportId),
]);
export const billingDocuments = sqliteTable("billing_documents", {
  id: text("id").primaryKey(), organizationId: text("organization_id").notNull(),
  customerId: text("customer_id"),
  kind: text("kind", { enum: ["Facture", "Devis"] }).notNull(),
  number: text("number").notNull(), client: text("client").notNull(),
  date: text("date").notNull(), amountCents: integer("amount_cents").notNull(),
  status: text("status", {
    enum: ["draft", "sent", "paid", "overdue", "accepted", "rejected"],
  }).notNull().default("draft"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_billing_organization_date").on(table.organizationId, table.date),
  index("idx_billing_organization_status").on(table.organizationId, table.status),
  index("idx_billing_customer_id").on(table.organizationId, table.customerId),
  uniqueIndex("uq_billing_organization_number").on(table.organizationId, table.number),
]);
export const billingSequences = sqliteTable("billing_sequences", {
  organizationId: text("organization_id").notNull(),
  kind: text("kind", { enum: ["Facture", "Devis"] }).notNull(),
  year: integer("year").notNull(), lastValue: integer("last_value").notNull(),
}, (table) => [primaryKey({ columns: [table.organizationId, table.kind, table.year] })]);
export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(), organizationId: text("organization_id").notNull(),
  actorId: text("actor_id").notNull(), action: text("action").notNull(),
  entityType: text("entity_type").notNull(), entityId: text("entity_id").notNull(),
  metadata: text("metadata").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_audit_logs_organization_created").on(table.organizationId, table.createdAt)]);
