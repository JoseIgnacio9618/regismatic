import { DateTime } from "luxon";

const MADRID_TZ = "Europe/Madrid";

export const madridDateKey = (date: Date): string => {
  return DateTime.fromJSDate(date, { zone: "utc" }).setZone(MADRID_TZ).toISODate() ?? "";
};

export const madridDayRange = (reference: Date) => {
  const local = DateTime.fromJSDate(reference, { zone: "utc" }).setZone(MADRID_TZ);
  const start = local.startOf("day").toUTC().toJSDate();
  const end = local.endOf("day").toUTC().toJSDate();
  return { start, end };
};

export const diffMinutes = (from: Date, to: Date): number => {
  const diffMs = to.getTime() - from.getTime();
  return Math.max(0, Math.round(diffMs / 60000));
};

export const nowUtc = (): Date => new Date();
