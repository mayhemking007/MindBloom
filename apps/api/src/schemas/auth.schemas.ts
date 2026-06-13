import { z } from "zod";

export const authCredentialsSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(256),
});

export const registerSchema = authCredentialsSchema.extend({
  displayName: z.string().trim().min(1).max(80).optional(),
});
