import {
  pgSchema,
  bigint,
  integer,
  varchar,
  timestamp,
} from "drizzle-orm/pg-core";

export const hdp = pgSchema("hdp");

// hdp.user_details — see Section 4.1 + ALTER 1 in the blueprint
export const userDetails = hdp.table("user_details", {
  userId: bigint("user_id", { mode: "number" }).primaryKey().notNull(),
  userName: varchar("user_name", { length: 250 }),
  loginName: varchar("login_name", { length: 150 }),
  password: varchar("password", { length: 100 }), // bcrypt hash (post-migration)
  mobileNo: varchar("mobile_no", { length: 10 }),
  emailAddress: varchar("email_address", { length: 254 }),
  roleId: integer("role_id"),
  status: integer("status"), // 1 = active, 0 = inactive
  registeredOn: timestamp("registered_on", {
    withTimezone: false,
  }).defaultNow(),
  registeredBy: varchar("registered_by", { length: 150 }),
  secId: integer("sec_id").default(0),
  deptId: integer("dept_id").default(0),
  designation: varchar("designation", { length: 250 }),

  // ALTER 1 additions
  passwordResetToken: varchar("password_reset_token", { length: 100 }),
  passwordResetExpires: timestamp("password_reset_expires"),
  lastLogin: timestamp("last_login"),
  failedLoginAttempts: integer("failed_login_attempts").default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
});

export const masterRole = hdp.table("master_role", {
  roleId: integer("role_id").primaryKey().notNull(),
  roleDescription: varchar("role_description", { length: 150 }),
});

// NEW table — Section 4.2
export const passwordResetTokens = hdp.table("password_reset_tokens", {
  tokenId: bigint("token_id", { mode: "number" })
    .primaryKey()
    .generatedByDefaultAsIdentity(),
  userId: bigint("user_id", { mode: "number" }).notNull(),
  token: varchar("token", { length: 100 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  resetBy: bigint("reset_by", { mode: "number" }), // NULL = self-service
  ipAddress: varchar("ip_address", { length: 150 }),
});

// NEW table — Section 4.2 (session blocklist for forced logout)
export const sessionBlocklist = hdp.table("session_blocklist", {
  jti: varchar("jti", { length: 100 }).primaryKey(),
  userId: bigint("user_id", { mode: "number" }).notNull(),
  blockedAt: timestamp("blocked_at").defaultNow(),
  reason: varchar("reason", { length: 50 }),
});

export type UserDetails = typeof userDetails.$inferSelect;
export type NewUserDetails = typeof userDetails.$inferInsert;
