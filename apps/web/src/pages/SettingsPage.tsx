import { useEffect, useState } from "react";
import type { CalendarMode, UserSettings } from "@mindbloom/shared";

import { getSettings, updateSettings } from "../lib/api";

const calendarModes: Array<{
  value: CalendarMode;
  title: string;
  body: string;
}> = [
  {
    value: "gentle",
    title: "Gentle",
    body: "Shows your writing rhythm without pressure.",
  },
  {
    value: "habit",
    title: "Habit",
    body: "Adds optional streaks when you want a little structure.",
  },
];

export function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    getSettings()
      .then((response) => {
        if (isMounted) {
          setSettings(response.settings);
        }
      })
      .catch((apiError: unknown) => {
        if (isMounted) {
          setError(
            apiError instanceof Error
              ? apiError.message
              : "Settings could not load.",
          );
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  async function save(nextSettings: UserSettings) {
    setIsSaving(true);
    setError(null);
    setSettings(nextSettings);

    try {
      const response = await updateSettings({
        calendarEnabled: nextSettings.calendarEnabled,
        calendarMode: nextSettings.calendarMode,
        streaksEnabled: nextSettings.streaksEnabled,
      });
      setSettings(response.settings);
    } catch (apiError) {
      setError(
        apiError instanceof Error
          ? apiError.message
          : "Settings could not be saved.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function updateLocal(partial: Partial<UserSettings>) {
    if (!settings) {
      return;
    }

    const calendarMode = partial.calendarMode ?? settings.calendarMode;
    void save({
      ...settings,
      ...partial,
      calendarMode,
      streaksEnabled:
        calendarMode === "habit"
          ? (partial.streaksEnabled ?? settings.streaksEnabled)
          : false,
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-[1160px] flex-col gap-6 px-4 py-5 sm:px-6 md:px-8 md:py-8">
      <header className="max-w-3xl">
        <p className="label-text">Settings</p>
        <h1 className="mt-2 font-serif text-[32px] leading-tight text-bloom-text-primary md:text-[42px]">
          Shape MindBloom around your rhythm
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-7 text-bloom-text-secondary">
          Keep the calendar as a gentle record, turn on habit cues when they help,
          and leave streaks off when you just want room to write.
        </p>
      </header>

      {error ? (
        <p className="rounded-bloom-sm border border-coral-border bg-coral-bg px-3 py-2 text-[13px] text-coral-text">
          {error}
        </p>
      ) : null}

      {!settings ? (
        <section className="rounded-bloom-sm border border-bloom-border bg-bloom-surface p-5 text-[14px] text-bloom-text-secondary">
          Loading settings...
        </section>
      ) : (
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
          <div className="rounded-bloom-sm border border-bloom-border bg-bloom-surface p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-[18px] font-semibold text-bloom-text-primary">
                  Calendar
                </h2>
                <p className="mt-1 max-w-xl text-[14px] leading-6 text-bloom-text-secondary">
                  See entries, notes, and reflections by day. It is here for memory,
                  not judgment.
                </p>
              </div>
              <button
                type="button"
                aria-pressed={settings.calendarEnabled}
                onClick={() =>
                  updateLocal({ calendarEnabled: !settings.calendarEnabled })
                }
                className={[
                  "h-10 rounded-bloom-sm px-4 text-[13px] font-semibold transition-colors",
                  settings.calendarEnabled
                    ? "bg-bloom-accent text-bloom-on-accent"
                    : "border border-bloom-border-mid bg-bloom-bg text-bloom-text-secondary",
                ].join(" ")}
              >
                {settings.calendarEnabled ? "Enabled" : "Enable"}
              </button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {calendarModes.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => updateLocal({ calendarMode: mode.value })}
                  className={[
                    "min-h-[116px] rounded-bloom-sm border p-4 text-left transition-colors",
                    settings.calendarMode === mode.value
                      ? "border-bloom-accent bg-bloom-accent-bg"
                      : "border-bloom-border bg-bloom-bg",
                  ].join(" ")}
                >
                  <span className="text-[15px] font-semibold text-bloom-text-primary">
                    {mode.title}
                  </span>
                  <span className="mt-2 block text-[13px] leading-5 text-bloom-text-secondary">
                    {mode.body}
                  </span>
                </button>
              ))}
            </div>

            <label className="mt-5 flex items-start gap-3 rounded-bloom-sm border border-bloom-border bg-bloom-bg p-4">
              <input
                type="checkbox"
                checked={settings.streaksEnabled}
                disabled={settings.calendarMode !== "habit"}
                onChange={(event) =>
                  updateLocal({ streaksEnabled: event.currentTarget.checked })
                }
                className="mt-1 h-4 w-4 accent-bloom-accent"
              />
              <span>
                <span className="block text-[14px] font-semibold text-bloom-text-primary">
                  Show streaks
                </span>
                <span className="mt-1 block text-[13px] leading-5 text-bloom-text-secondary">
                  Available in Habit mode. Keep it off if numbers make journaling
                  feel less personal.
                </span>
              </span>
            </label>
          </div>

          <aside className="rounded-bloom-sm border border-bloom-border bg-bloom-surface p-5">
            <p className="label-text">Current setup</p>
            <dl className="mt-4 space-y-4 text-[14px]">
              <div>
                <dt className="text-bloom-text-tertiary">Calendar</dt>
                <dd className="mt-1 font-semibold text-bloom-text-primary">
                  {settings.calendarEnabled ? "Visible" : "Hidden"}
                </dd>
              </div>
              <div>
                <dt className="text-bloom-text-tertiary">Mode</dt>
                <dd className="mt-1 font-semibold capitalize text-bloom-text-primary">
                  {settings.calendarMode}
                </dd>
              </div>
              <div>
                <dt className="text-bloom-text-tertiary">Streaks</dt>
                <dd className="mt-1 font-semibold text-bloom-text-primary">
                  {settings.streaksEnabled ? "On" : "Off"}
                </dd>
              </div>
            </dl>
            <p className="mt-6 text-[12px] text-bloom-text-tertiary">
              {isSaving ? "Saving..." : "Changes save as you choose them."}
            </p>
          </aside>
        </section>
      )}
    </main>
  );
}
