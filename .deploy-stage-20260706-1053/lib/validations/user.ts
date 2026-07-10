// Section 8 — User schemas (HDP_Platform_Blueprint_v2.md)
import { z } from "zod";
import { passwordSchema } from "./password";

export const createUserSchema = z.object({
  user_name: z.string().min(2).max(250),
  login_name: z.string().min(3).max(150),
  password: passwordSchema.innerType().shape.password,
  mobile_no: z.string().regex(/^\d{10}$/, "Enter valid 10-digit mobile"),
  role_id: z.number().int().min(1).max(6),
  sec_id: z.number().int().optional(),
  designation: z.string().max(250).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = createUserSchema
  .omit({ password: true })
  .partial()
  .extend({
    status: z.union([z.literal(0), z.literal(1)]).optional(),
  });

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
