import { describe, expect, it } from "vitest";
import { googleCalendarUrl, icsFile } from "../../shared/calendar";
import { dateVariants } from "../../worker/quotecheck";

describe("calendar reminders", () => {
  const e = { title: "Deadline: Award, Italy", date: "2026-12-15", details: "From the official page; check it", url: "https://uni.example/call" };

  it("Google link is an all-day event ending the next day", () => {
    const u = new URL(googleCalendarUrl(e));
    expect(u.searchParams.get("dates")).toBe("20261215/20261216");
    expect(u.searchParams.get("text")).toBe(e.title);
  });

  it("ics file is valid all-day events with escaped text and a 2-day reminder", () => {
    const ics = icsFile([e, { ...e, date: "2026-12-31", title: "Year end" }], "it-award", "2026-10-29T10:00:00.000Z");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261215\r\nDTEND;VALUE=DATE:20261216");
    expect(ics).toContain("DTEND;VALUE=DATE:20270101"); // across the year end
    expect(ics).toContain("SUMMARY:Deadline: Award\\, Italy");
    expect(ics).toContain("DESCRIPTION:From the official page\\; check it\\nhttps://uni.example/call");
    expect(ics).toContain("DTSTAMP:20261029T100000Z");
    expect(ics).toContain("TRIGGER:-P2D");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });
});

describe("deadline date formats the checker accepts", () => {
  it("covers English, German, Italian, numeric, Chinese and Korean forms", () => {
    const v = dateVariants("2026-03-01");
    for (const f of ["1 march 2026", "march 1, 2026", "1st march 2026", "1. märz 2026", "1 marzo 2026", "01.03.2026", "2026-03-01", "2026年3月1日", "2026년 3월 1일", "2026. 3. 1"])
      expect(v).toContain(f);
    expect(dateVariants("2026-12-22")).toContain("22nd december 2026");
    expect(dateVariants("2026-12-12")).toContain("12th december 2026");
  });
});
