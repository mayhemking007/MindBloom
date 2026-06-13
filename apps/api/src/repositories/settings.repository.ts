import type { UserSettingsRow } from "../db/schema.js";
import { appTables } from "../db/schema.js";
import { query } from "../config/db.js";

export async function upsertUserSettings(input: {
  ownerId: string;
  ownerKind: UserSettingsRow["owner_kind"];
  calendarEnabled: boolean;
  calendarMode: UserSettingsRow["calendar_mode"];
  streaksEnabled: boolean;
}): Promise<UserSettingsRow> {
  const result = await query<UserSettingsRow>(
    `INSERT INTO ${appTables.userSettings}
      (owner_id, owner_kind, calendar_enabled, calendar_mode, streaks_enabled, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (owner_kind, owner_id)
     DO UPDATE SET
       calendar_enabled = EXCLUDED.calendar_enabled,
       calendar_mode = EXCLUDED.calendar_mode,
       streaks_enabled = EXCLUDED.streaks_enabled,
       updated_at = now()
     RETURNING *`,
    [
      input.ownerId,
      input.ownerKind,
      input.calendarEnabled,
      input.calendarMode,
      input.streaksEnabled,
    ],
  );

  return result.rows[0]!;
}

export async function findUserSettings(input: {
  ownerId: string;
  ownerKind: UserSettingsRow["owner_kind"];
}): Promise<UserSettingsRow | null> {
  const result = await query<UserSettingsRow>(
    `SELECT * FROM ${appTables.userSettings}
     WHERE owner_id = $1 AND owner_kind = $2`,
    [input.ownerId, input.ownerKind],
  );

  return result.rows[0] ?? null;
}
