// Section 8 — Form Validation Strategy (HDP_Platform_Blueprint_v2.md)
import { z } from 'zod';

export const indicatorSchema = z.object({
  indicator_name: z
    .string()
    .min(3, 'Indicator name required')
    .max(255),
  district_id: z.number().int().positive('Select a district'),
  unit: z.string().max(15).optional(),
  financial_target: z.number().min(0).optional(),
  physical_target: z.number().min(0).optional(),
  financial_achievement: z.number().min(0).optional(),
  physical_achievement: z.number().int().min(0).optional(),
  physical_description: z.string().max(2000).optional(),
  no_days_employed_direct: z.number().int().min(0).default(0),
  no_persons_employed_direct: z.number().int().min(0).default(0),
  no_days_employed_indirect: z.number().int().min(0).default(0),
  no_persons_employed_indirect: z.number().int().min(0).default(0),
});

export type IndicatorInput = z.infer<typeof indicatorSchema>;

export const indicatorVerifySchema = z.object({
  verified_financial_achievement: z.number().min(0),
  verified_physical_achievement: z.number().int().min(0),
  verified_physical_description: z.string().max(2000).optional(),
  verified_achieved_no_days_employed_direct: z.number().int().min(0).optional(),
  verified_achieved_no_persons_employed_direct: z.number().int().min(0).optional(),
  verified_achieved_no_days_employed_indirect: z.number().int().min(0).optional(),
  verified_achieved_no_persons_employed_indirect: z.number().int().min(0).optional(),
});

export type IndicatorVerifyInput = z.infer<typeof indicatorVerifySchema>;

export const indicatorRejectSchema = z.object({
  remarks: z.string().min(5, 'Remarks required for rejection').max(2000),
});

export type IndicatorRejectInput = z.infer<typeof indicatorRejectSchema>;
