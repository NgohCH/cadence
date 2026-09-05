export function sameTimestampInstant(
  first: string,
  second: string,
): boolean {
  const firstInstant = parseTimestamp(first);
  const secondInstant = parseTimestamp(second);

  return firstInstant !== null &&
    secondInstant !== null &&
    firstInstant === secondInstant;
}


export function sameNullableTimestampInstant(
  first: string | null,
  second: string | null,
): boolean {
  if (first === null || second === null) {
    return first === second;
  }

  return sameTimestampInstant(first, second);
}


function parseTimestamp(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const milliseconds = Number(match[7] ?? "0");
  const timezone = match[8];
  const offsetHours = timezone === "Z" ? 0 : Number(timezone.slice(1, 3));
  const offsetMinutes = timezone === "Z" ? 0 : Number(timezone.slice(4, 6));
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ][month - 1];

  if (
    month < 1 || month > 12 ||
    day < 1 || day > (daysInMonth ?? 0) ||
    hour > 23 || minute > 59 || second > 59 ||
    offsetHours > 23 || offsetMinutes > 59
  ) {
    return null;
  }

  const instant = new Date(
    Date.UTC(year, month - 1, day, hour, minute, second, milliseconds),
  );
  if (year < 100) {
    instant.setUTCFullYear(year);
  }

  return instant.getTime() - (offsetHours * 60 + offsetMinutes) * 60_000;
}
