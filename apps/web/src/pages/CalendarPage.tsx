import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { CalendarActivityDay, UserSettings } from "@mindbloom/shared";

import { getCalendarActivity } from "../lib/api";

const moodClasses: Record<string, string> = {
  amber: "bg-amber-bg text-amber-text border-amber-border",
  blue: "bg-blue-bg text-blue-text border-blue-border",
  pink: "bg-pink-bg text-pink-text border-pink-border",
  purple: "bg-purple-bg text-purple-text border-purple-border",
  teal: "bg-teal-bg text-teal-text border-teal-border",
};

function getMonthDays(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const first = new Date(year, month, 1);
  const totalDays = new Date(year, month + 1, 0).getDate();
  const leadingBlankDays = first.getDay();
  const monthLabel = first.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return {
    monthLabel,
    leadingBlankDays,
    days: Array.from({ length: totalDays }, (_, index) => {
      const day = index + 1;
      return {
        day,
        date: `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      };
    }),
  };
}

function getDayTotal(day?: CalendarActivityDay) {
  if (!day) {
    return 0;
  }

  return day.entryCount + day.noteCount + day.reflectionCount;
}

export function CalendarPage() {
  const [activity, setActivity] = useState<CalendarActivityDay[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    getCalendarActivity()
      .then((response) => {
        if (!isMounted) {
          return;
        }
        setActivity(response.days);
        setSettings(response.settings);
        setSelectedDate(response.days[0]?.date ?? null);
      })
      .catch((apiError: unknown) => {
        if (isMounted) {
          setError(
            apiError instanceof Error
              ? apiError.message
              : "Calendar could not load.",
          );
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const month = useMemo(() => getMonthDays(), []);
  const activityByDate = useMemo(
    () => new Map(activity.map((day) => [day.date, day])),
    [activity],
  );
  const selectedDay = selectedDate
    ? activityByDate.get(selectedDate) ?? null
    : null;

  if (error) {
    return (
      <main className="mx-auto w-full max-w-[1160px] px-4 py-5 sm:px-6 md:px-8 md:py-8">
        <p className="rounded-bloom-sm border border-coral-border bg-coral-bg px-3 py-2 text-[13px] text-coral-text">
          {error}
        </p>
      </main>
    );
  }

  if (!settings) {
    return (
      <main className="mx-auto w-full max-w-[1160px] px-4 py-5 sm:px-6 md:px-8 md:py-8">
        <section className="rounded-bloom-sm border border-bloom-border bg-bloom-surface p-5 text-[14px] text-bloom-text-secondary">
          Loading calendar...
        </section>
      </main>
    );
  }

  if (!settings.calendarEnabled) {
    return (
      <main className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-4 py-5 sm:px-6 md:px-8 md:py-8">
        <header>
          <p className="label-text">Calendar</p>
          <h1 className="mt-2 font-serif text-[32px] leading-tight md:text-[42px]">
            Your calendar is tucked away
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-7 text-bloom-text-secondary">
            Turn it on when seeing your writing rhythm feels useful. MindBloom
            keeps entries, notes, and reflections available either way.
          </p>
        </header>
        <Link
          to="/settings"
          className="inline-flex h-10 w-fit items-center rounded-bloom-sm bg-bloom-accent px-4 text-[13px] font-semibold text-bloom-on-accent transition-colors hover:bg-bloom-accent-hover"
        >
          Open settings
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-[1160px] flex-col gap-6 px-4 py-5 sm:px-6 md:px-8 md:py-8">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="label-text">Calendar</p>
          <h1 className="mt-2 font-serif text-[32px] leading-tight md:text-[42px]">
            {month.monthLabel}
          </h1>
        </div>
        <p className="max-w-xl text-[14px] leading-6 text-bloom-text-secondary">
          A calm month view for entries, notes, reflections, and the mood you
          captured most recently on a reflection day.
        </p>
      </header>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-bloom-sm border border-bloom-border bg-bloom-surface p-4">
          <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-semibold uppercase text-bloom-text-tertiary">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
              <div key={label}>{label}</div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-7 gap-2">
            {Array.from({ length: month.leadingBlankDays }, (_, index) => (
              <div key={`blank-${index}`} className="aspect-square" />
            ))}
            {month.days.map((day) => {
              const dayActivity = activityByDate.get(day.date);
              const total = getDayTotal(dayActivity);
              const moodClass =
                dayActivity?.moodColor && moodClasses[dayActivity.moodColor]
                  ? moodClasses[dayActivity.moodColor]
                  : "bg-bloom-bg text-bloom-text-secondary border-bloom-border";

              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setSelectedDate(day.date)}
                  className={[
                    "aspect-square min-h-[54px] rounded-bloom-sm border p-2 text-left transition-colors sm:min-h-[76px]",
                    selectedDate === day.date
                      ? "border-bloom-accent bg-bloom-accent-bg"
                      : total > 0
                        ? moodClass
                        : "border-bloom-border bg-bloom-bg text-bloom-text-tertiary",
                  ].join(" ")}
                >
                  <span className="block text-[13px] font-semibold">{day.day}</span>
                  {total > 0 ? (
                    <span className="mt-2 block text-[11px] leading-4">
                      {total} saved
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <aside className="rounded-bloom-sm border border-bloom-border bg-bloom-surface p-5">
          <p className="label-text">Selected day</p>
          <h2 className="mt-2 text-[20px] font-semibold text-bloom-text-primary">
            {selectedDate ?? "Choose a day"}
          </h2>
          {selectedDay ? (
            <dl className="mt-5 space-y-4 text-[14px]">
              <div>
                <dt className="text-bloom-text-tertiary">Entries</dt>
                <dd className="font-semibold text-bloom-text-primary">
                  {selectedDay.entryCount}
                </dd>
              </div>
              <div>
                <dt className="text-bloom-text-tertiary">Notes</dt>
                <dd className="font-semibold text-bloom-text-primary">
                  {selectedDay.noteCount}
                </dd>
              </div>
              <div>
                <dt className="text-bloom-text-tertiary">Reflections</dt>
                <dd className="font-semibold text-bloom-text-primary">
                  {selectedDay.reflectionCount}
                </dd>
              </div>
              {selectedDay.moodLabel ? (
                <div>
                  <dt className="text-bloom-text-tertiary">Mood note</dt>
                  <dd className="mt-1 text-bloom-text-primary">
                    {selectedDay.moodLabel}
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <p className="mt-5 text-[14px] leading-6 text-bloom-text-secondary">
              No saved activity for this day yet.
            </p>
          )}
        </aside>
      </section>
    </main>
  );
}
