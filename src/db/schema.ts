import { sql } from 'drizzle-orm';
import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

// Used by interactions.suggestedParticipants. A name extracted from the body
// of an email or transcript, plus the candidate contacts the matcher found.
export type SuggestedParticipant = {
  name: string;
  role?: string;
  candidates: Array<{
    contactId: string;
    contactSlug: string;
    fullName: string;
    title: string | null;
    organisationName: string | null;
    confidence: 'exact' | 'partial';
  }>;
};

// --- Users (GovTech team members) ---
export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    role: text('role', { enum: ['admin', 'member', 'viewer'] })
      .notNull()
      .default('member'),
    avatarColour: text('avatar_colour').notNull().default('amber'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    emailIdx: index('users_email_idx').on(t.email),
  }),
);

// --- Organisations (MDAs, vendors, partners) ---
export const organisations = sqliteTable(
  'organisations',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    commonName: text('common_name'),
    type: text('type', {
      enum: [
        'ministry',
        'department',
        'agency',
        'statutory_body',
        'soe',
        'vendor',
        'partner',
        'multilateral',
        'civil_society',
        'media',
        'other',
      ],
    })
      .notNull()
      .default('ministry'),
    // Self-reference. SQLite doesn't strictly enforce this, but the column is
    // intended to point at another organisations.id (or be null for top-level).
    parentId: text('parent_id'),
    website: text('website'),
    notes: text('notes'),
    tags: text('tags', { mode: 'json' }).$type<string[]>().default([]),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    createdBy: text('created_by').references(() => users.id),
  },
  (t) => ({
    typeIdx: index('orgs_type_idx').on(t.type),
    slugIdx: uniqueIndex('orgs_slug_idx').on(t.slug),
  }),
);

// --- Contacts (people in stakeholder organisations) ---
export const contacts = sqliteTable(
  'contacts',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    fullName: text('full_name').notNull(),
    title: text('title'),
    organisationId: text('organisation_id').references(() => organisations.id),
    primaryEmail: text('primary_email'),
    phone: text('phone'),
    sensitive: integer('sensitive', { mode: 'boolean' }).notNull().default(false),
    notes: text('notes'),
    tags: text('tags', { mode: 'json' }).$type<string[]>().default([]),
    avatarColour: text('avatar_colour').notNull().default('blue'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    createdBy: text('created_by').references(() => users.id),
  },
  (t) => ({
    emailIdx: index('contacts_email_idx').on(t.primaryEmail),
    orgIdx: index('contacts_org_idx').on(t.organisationId),
    slugIdx: uniqueIndex('contacts_slug_idx').on(t.slug),
  }),
);

// --- Projects (lightweight initiative tagging) ---
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status', { enum: ['planning', 'active', 'paused', 'closed'] })
    .notNull()
    .default('active'),
  leadUserId: text('lead_user_id').references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// --- Interactions (the timeline spine: meetings, emails, notes) ---
export const interactions = sqliteTable(
  'interactions',
  {
    id: text('id').primaryKey(),
    kind: text('kind', { enum: ['meeting', 'email', 'note', 'call'] }).notNull(),
    occurredAt: integer('occurred_at', { mode: 'timestamp' }).notNull(),
    title: text('title').notNull(),
    summary: text('summary'),
    body: text('body'),
    location: text('location'),
    durationMinutes: integer('duration_minutes'),
    projectId: text('project_id').references(() => projects.id),
    sensitive: integer('sensitive', { mode: 'boolean' }).notNull().default(false),
    tags: text('tags', { mode: 'json' }).$type<string[]>().default([]),
    // Email-specific
    emailMessageId: text('email_message_id'),
    emailFromAddress: text('email_from_address'),
    emailHeaders: text('email_headers', { mode: 'json' }).$type<Record<string, string>>(),
    // Review state for AI-extracted records
    reviewStatus: text('review_status', { enum: ['confirmed', 'pending', 'rejected'] })
      .notNull()
      .default('confirmed'),
    decisions: text('decisions', { mode: 'json' }).$type<string[]>().default([]),
    // People mentioned in the body but not in the To/From/Cc headers, with
    // candidate contact matches for the user to confirm at review time.
    suggestedParticipants: text('suggested_participants', { mode: 'json' })
      .$type<SuggestedParticipant[]>()
      .default([]),
    // Raw transcript text from an AI notetaker (Krisp, Granola, etc.).
    // Stored separately from `body` so the meeting page can show summary +
    // notes by default, with the transcript as a collapsible section.
    transcript: text('transcript'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    createdBy: text('created_by').references(() => users.id),
  },
  (t) => ({
    occurredIdx: index('interactions_occurred_idx').on(t.occurredAt),
    kindIdx: index('interactions_kind_idx').on(t.kind),
    reviewIdx: index('interactions_review_idx').on(t.reviewStatus),
  }),
);

// --- Interaction participants (external contacts present) ---
export const interactionParticipants = sqliteTable(
  'interaction_participants',
  {
    interactionId: text('interaction_id')
      .notNull()
      .references(() => interactions.id, { onDelete: 'cascade' }),
    contactId: text('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['attendee', 'sender', 'recipient', 'cc', 'bcc', 'mentioned'] })
      .notNull()
      .default('attendee'),
  },
  (t) => ({
    pk: uniqueIndex('participants_pk').on(t.interactionId, t.contactId, t.role),
    contactIdx: index('participants_contact_idx').on(t.contactId),
  }),
);

// --- Interaction internal attendees (GovTech users) ---
export const interactionInternalAttendees = sqliteTable(
  'interaction_internal_attendees',
  {
    interactionId: text('interaction_id')
      .notNull()
      .references(() => interactions.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: uniqueIndex('internal_attendees_pk').on(t.interactionId, t.userId),
  }),
);

// --- Contact connectors (which GovTech members "know" each contact) ---
// Many-to-many: a contact can have several connectors and a team member can
// connect to many contacts. Used so we know whose relationship to leverage
// when reaching into an MDA. Strength + notes capture how warm the link is.
export const contactConnectors = sqliteTable(
  'contact_connectors',
  {
    id: text('id').primaryKey(),
    contactId: text('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    strength: text('strength', { enum: ['close', 'professional', 'acquaintance'] })
      .notNull()
      .default('professional'),
    notes: text('notes'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    createdBy: text('created_by').references(() => users.id),
  },
  (t) => ({
    pk: uniqueIndex('connectors_pk').on(t.contactId, t.userId),
    contactIdx: index('connectors_contact_idx').on(t.contactId),
    userIdx: index('connectors_user_idx').on(t.userId),
  }),
);

// --- Action items ---
export const actionItems = sqliteTable(
  'action_items',
  {
    id: text('id').primaryKey(),
    interactionId: text('interaction_id').references(() => interactions.id, {
      onDelete: 'set null',
    }),
    description: text('description').notNull(),
    ownerUserId: text('owner_user_id').references(() => users.id),
    ownerContactId: text('owner_contact_id').references(() => contacts.id),
    dueDate: integer('due_date', { mode: 'timestamp' }),
    status: text('status', { enum: ['open', 'done', 'dropped'] })
      .notNull()
      .default('open'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    completedAt: integer('completed_at', { mode: 'timestamp' }),
  },
  (t) => ({
    statusIdx: index('actions_status_idx').on(t.status),
    ownerIdx: index('actions_owner_idx').on(t.ownerUserId),
    dueIdx: index('actions_due_idx').on(t.dueDate),
  }),
);

// --- Audit log ---
export const auditLog = sqliteTable(
  'audit_log',
  {
    id: text('id').primaryKey(),
    actorUserId: text('actor_user_id').references(() => users.id),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    details: text('details', { mode: 'json' }),
    occurredAt: integer('occurred_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    occurredIdx: index('audit_occurred_idx').on(t.occurredAt),
    actorIdx: index('audit_actor_idx').on(t.actorUserId),
  }),
);

// --- Sessions (cookie-backed) ---
export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    userIdx: index('sessions_user_idx').on(t.userId),
  }),
);

// --- App settings (small key-value store for admin-tunable preferences) ---
export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  /** JSON-encoded value. Use the helpers in lib/settings.ts to read/write. */
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedBy: text('updated_by').references(() => users.id),
});

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Organisation = typeof organisations.$inferSelect;
export type NewOrganisation = typeof organisations.$inferInsert;
export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type Interaction = typeof interactions.$inferSelect;
export type NewInteraction = typeof interactions.$inferInsert;
export type ActionItem = typeof actionItems.$inferSelect;
export type NewActionItem = typeof actionItems.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type ContactConnector = typeof contactConnectors.$inferSelect;
export type NewContactConnector = typeof contactConnectors.$inferInsert;
