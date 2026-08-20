import {
  bigint,
  integer,
  varchar,
  timestamp,
  numeric,
  text,
  boolean,
} from 'drizzle-orm/pg-core';
import { hdp } from './user';

export const indicators = hdp.table('indicators', {
  indicatorId: bigint('indicator_id', { mode: 'number' }).primaryKey().notNull(),
  projectId: bigint('project_id', { mode: 'number' }),
  indicatorName: varchar('indicator_name', { length: 255 }),
  districtId: integer('district_id'),
  unit: varchar('unit', { length: 15 }),

  financialTarget: numeric('financial_target', { precision: 13, scale: 5 }),
  physicalTarget: numeric('physical_target', { precision: 10, scale: 2 }),
  financialAchievement: numeric('financial_achievement', { precision: 13, scale: 5 }),
  physicalAchievement: numeric('physical_achievement', { precision: 10, scale: 2, mode: 'number' }),
  physicalDescription: text('physical_description'),
  percentage: numeric('percentage', { precision: 6, scale: 2 }),

  // Verification-side mirrors
  verifiedFinancialAchievement: numeric('verified_financial_achievement', { precision: 13, scale: 5 }),
  verifiedPhysicalAchievement: numeric('verified_physical_achievement', { precision: 10, scale: 2, mode: 'number' }),
  verifiedPhysicalDescription: text('verified_physical_description'),
  verifiedPercentage: numeric('verified_percentage', { precision: 6, scale: 2 }),

  // Employment
  noDaysEmployedDirect: integer('no_days_employed_direct').default(0),
  noPersonsEmployedDirect: integer('no_persons_employed_direct').default(0),
  noDaysEmployedIndirect: integer('no_days_employed_indirect').default(0),
  noPersonsEmployedIndirect: integer('no_persons_employed_indirect').default(0),
  achievedNoDaysEmployedDirect: integer('achieved_no_days_employed_direct'),
  achievedNoPersonsEmployedDirect: integer('achieved_no_persons_employed_direct'),
  achievedNoDaysEmployedIndirect: integer('achieved_no_days_employed_indirect'),
  achievedNoPersonsEmployedIndirect: integer('achieved_no_persons_employed_indirect'),
  verifiedAchievedNoDaysEmployedDirect: integer('verified_achieved_no_days_employed_direct'),
  verifiedAchievedNoPersonsEmployedDirect: integer('verified_achieved_no_persons_employed_direct'),
  verifiedAchievedNoDaysEmployedIndirect: integer('verified_achieved_no_days_employed_indirect'),
  verifiedAchievedNoPersonsEmployedIndirect: integer('verified_achieved_no_persons_employed_indirect'),

  latitude: numeric('latitude', { precision: 10, scale: 7 }),
  longitude: numeric('longitude', { precision: 10, scale: 7 }),

  submittedBy: bigint('submitted_by', { mode: 'number' }),
  submittedDate: timestamp('submitted_date'),
  verifiedBy: bigint('verified_by', { mode: 'number' }),
  verifiedDate: timestamp('verified_date'),
  completedDate: timestamp('completed_date'),
});

// hdp.gallery — gallery_type: 1=Image, 2=Video, 3=Document
export const gallery = hdp.table('gallery', {
  galleryId: bigint('gallery_id', { mode: 'number' })
    .primaryKey()
    .generatedByDefaultAsIdentity(),
  indicatorId: bigint('indicator_id', { mode: 'number' }),
  galleryType: integer('gallery_type'),
  imagePath: text('image_path'), // for videos: YouTube/FB embed URL (see C.5)
  description: text('description'),
  uploadedBy: bigint('uploaded_by', { mode: 'number' }),
  uploadedOn: timestamp('uploaded_on').defaultNow(),
  isVerified: boolean('is_verified').default(false),
});

export const documents = hdp.table('documents', {
  documentId: bigint('document_id', { mode: 'number' })
    .primaryKey()
    .generatedByDefaultAsIdentity(),
  indicatorId: bigint('indicator_id', { mode: 'number' }),
  documentPath: text('document_path'),
  description: text('description'),
  uploadedBy: bigint('uploaded_by', { mode: 'number' }),
  uploadedOn: timestamp('uploaded_on').defaultNow(),
});

export type Indicator = typeof indicators.$inferSelect;
export type NewIndicator = typeof indicators.$inferInsert;
export type Gallery = typeof gallery.$inferSelect;
