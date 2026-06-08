import { Router } from "express";
import { z } from "zod";
import type {
  CalendarActivityResponse,
  SettingsResponse,
} from "@mindbloom/shared";

import { ApiError } from "../http/errors.js";
import { readOwnerScope } from "../http/ownerScope.js";
import { entryStore } from "../lib/entryStore.js";

const updateSettingsSchema = z.object({
  calendarEnabled: z.boolean().optional(),
  calendarMode: z.enum(["gentle", "habit"]).optional(),
  streaksEnabled: z.boolean().optional(),
});

export const settingsRouter = Router();

settingsRouter.get("/settings", (req, res, next) => {
  try {
    const owner = readOwnerScope(req);
    const response: SettingsResponse = {
      settings: entryStore.getSettings(owner),
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

settingsRouter.patch("/settings", (req, res, next) => {
  try {
    const owner = readOwnerScope(req);
    const parsed = updateSettingsSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid body",
      );
    }

    const response: SettingsResponse = {
      settings: entryStore.updateSettings(owner, parsed.data),
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

settingsRouter.get("/calendar/activity", (req, res, next) => {
  try {
    const owner = readOwnerScope(req);
    const response: CalendarActivityResponse = {
      days: entryStore.listCalendarActivity(owner),
      settings: entryStore.getSettings(owner),
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});
