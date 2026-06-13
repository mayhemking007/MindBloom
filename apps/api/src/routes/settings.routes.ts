import { Router } from "express";
import { z } from "zod";
import type {
  CalendarActivityResponse,
  SettingsResponse,
} from "@mindbloom/shared";

import { ApiError } from "../http/errors.js";
import { readOwnerScope } from "../http/middleware/requireOwner.js";
import { entryStore } from "../services/entries.service.js";

const updateSettingsSchema = z.object({
  calendarEnabled: z.boolean().optional(),
  calendarMode: z.enum(["gentle", "habit"]).optional(),
  streaksEnabled: z.boolean().optional(),
});

export const settingsRouter = Router();

settingsRouter.get("/settings", async (req, res, next) => {
  try {
    const owner = await readOwnerScope(req);
    const response: SettingsResponse = {
      settings: await entryStore.getSettings(owner),
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

settingsRouter.patch("/settings", async (req, res, next) => {
  try {
    const owner = await readOwnerScope(req);
    const parsed = updateSettingsSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid body",
      );
    }

    const response: SettingsResponse = {
      settings: await entryStore.updateSettings(owner, parsed.data),
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

settingsRouter.get("/calendar/activity", async (req, res, next) => {
  try {
    const owner = await readOwnerScope(req);
    const response: CalendarActivityResponse = {
      days: await entryStore.listCalendarActivity(owner),
      settings: await entryStore.getSettings(owner),
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});
