import { z } from "zod";

export const updateSettingsSchema = z.object({
  calendarEnabled: z.boolean().optional(),
  calendarMode: z.enum(["gentle", "habit"]).optional(),
  streaksEnabled: z.boolean().optional(),
});
