import { DateTime } from "luxon";
import { AppError } from "../middlewares/error.middleware";

const TZ = "Europe/Madrid";

export const parseReportRange = (from: string, to: string) => {
  const fromDt = DateTime.fromISO(from, { zone: TZ }).startOf("day");
  const toDt = DateTime.fromISO(to, { zone: TZ }).endOf("day");

  if (!fromDt.isValid || !toDt.isValid) {
    throw new AppError("Invalid date range format. Use YYYY-MM-DD.", 400);
  }

  if (fromDt > toDt) {
    throw new AppError("The 'from' date must be before or equal to 'to'.", 400);
  }

  if (toDt.diff(fromDt, "days").days > 62) {
    throw new AppError("Date range too large. Maximum supported range is 62 days.", 400);
  }

  return {
    fromUtc: fromDt.toUTC().toJSDate(),
    toUtc: toDt.toUTC().toJSDate()
  };
};
