// Calendar reminders without a library or an account: a Google Calendar link and a standard .ics file
// (opens in Apple Calendar, Outlook and Google). All-day events; the end date is exclusive (the next day).

export type CalEvent = { title: string; date: string; details: string; url?: string };

const compact = (iso: string) => iso.replaceAll("-", "");
const nextDay = (iso: string) => new Date(Date.parse(iso + "T00:00:00Z") + 86_400_000).toISOString().slice(0, 10);

/** "Add to Google Calendar" link for one all-day event. */
export function googleCalendarUrl(e: CalEvent): string {
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${compact(e.date)}/${compact(nextDay(e.date))}`,
    details: e.url ? `${e.details}\n${e.url}` : e.details,
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}

/** RFC 5545 text escaping: backslash, semicolon, comma and newlines. */
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** A .ics calendar file with one all-day event per entry. `stamp` is fixed in tests. */
export function icsFile(events: CalEvent[], uidPrefix: string, stamp = new Date().toISOString()): string {
  const dtstamp = stamp.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Raasta//Deadlines//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  events.forEach((e, i) => {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uidPrefix}-${i}-${compact(e.date)}@raasta`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${compact(e.date)}`,
      `DTEND;VALUE=DATE:${compact(nextDay(e.date))}`,
      `SUMMARY:${esc(e.title)}`,
      `DESCRIPTION:${esc(e.url ? `${e.details}\n${e.url}` : e.details)}`,
      ...(e.url ? [`URL:${e.url}`] : []),
      "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(e.title)}`, "TRIGGER:-P2D", "END:VALARM",
      "END:VEVENT",
    );
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
