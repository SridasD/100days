import {
  bigint,
  integer,
  varchar,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core';
import { hdp } from './user';

// hdp.user_log + ALTER 2 (Section 4.2 of the blueprint).
// Uses an identity column so writeAuditLog() can insert without providing an ID.
export const userLog = hdp.table('user_log', {
  userLogId: bigint('user_log_id', { mode: 'number' })
    .primaryKey()
    .generatedByDefaultAsIdentity(),
  userId: integer('user_id'),
  userIp: varchar('user_ip', { length: 150 }),
  loggedOn: timestamp('logged_on').defaultNow(),
  browserDetails: varchar('browser_details', { length: 250 }),
  secId: integer('sec_id'),

  // ALTER 2 additions
  action: varchar('action', { length: 50 }),
  entity: varchar('entity', { length: 50 }),
  entityId: bigint('entity_id', { mode: 'number' }),
  outcome: varchar('outcome', { length: 10 }), // SUCCESS | FAILURE
  userAgent: varchar('user_agent', { length: 500 }),
  meta: jsonb('meta'),
});

export type UserLog = typeof userLog.$inferSelect;
export type NewUserLog = typeof userLog.$inferInsert;

// Canonical action codes (from Section 9 of the blueprint)
export const AUDIT_ACTIONS = {
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  LOGOUT: 'LOGOUT',
  INDICATOR_CREATED: 'INDICATOR_CREATED',
  INDICATOR_SUBMITTED: 'INDICATOR_SUBMITTED',
  INDICATOR_APPROVED: 'INDICATOR_APPROVED',
  INDICATOR_REJECTED: 'INDICATOR_REJECTED',
  INDICATOR_CORRECTED: 'INDICATOR_CORRECTED',
  MEDIA_UPLOADED: 'MEDIA_UPLOADED',
  MEDIA_DELETED: 'MEDIA_DELETED',
  VIDEO_EMBEDDED: 'VIDEO_EMBEDDED',
  PASSWORD_RESET_REQUEST: 'PASSWORD_RESET_REQUEST',
  PASSWORD_RESET_COMPLETE: 'PASSWORD_RESET_COMPLETE',
  ADMIN_PASSWORD_RESET: 'ADMIN_PASSWORD_RESET',
  CHANGE_PASSWORD: 'CHANGE_PASSWORD',
  CHANGE_PASSWORD_FAILED: 'CHANGE_PASSWORD_FAILED',
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_STATUS_CHANGED: 'USER_STATUS_CHANGED',
  PROJECT_CREATED: 'PROJECT_CREATED',
  PROJECT_UPDATED: 'PROJECT_UPDATED',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];
