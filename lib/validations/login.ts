import { z } from 'zod';

export const loginSchema = z.object({
  loginName: z.string().min(3, 'Login required').max(150),
  password: z.string().min(1, 'Password required').max(200),
});

export type LoginInput = z.infer<typeof loginSchema>;
