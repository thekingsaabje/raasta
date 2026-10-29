import { describe, expect, it } from "vitest";
import { makeEnv, seedRequirement, seedScholarship } from "../helpers";
import { checkScholarship, classifyCheck, normalise } from "../../worker/quotecheck";

const page = (body: string) => async () => new Response(`<html><body><main>${body}${" filler text".repeat(40)}</main></body></html>`, { headers: { "content-type": "text/html; charset=utf-8" } });

async function setup() {
  const env = makeEnv();
  await seedScholarship(env, { id: "s1", name: "Award", country: "IT", is_test_data: 0 });
  await seedRequirement(env, "s1-r1", "s1", { kind: "manual" }, "NEEDS_REVIEW");
  await env.DB.exec("UPDATE requirements SET excerpt = 'Applications close on 15 December 2026', source_url = 'https://uni.example/call' WHERE id = 's1-r1';");
  return env;
}

describe("official-page quote checker", () => {
  it("ignores formatting differences: tags, curly quotes, dashes, spacing and case", () => {
    expect(normalise("<p>Applications&nbsp;close  on <b>15 December</b> 2026 – “final”</p>")).toBe(`applications close on 15 december 2026 - "final"`);
    expect(classifyCheck(2, 2, true)).toBe("matches");
    expect(classifyCheck(1, 2, true)).toBe("partly");
    expect(classifyCheck(0, 2, true)).toBe("changed");
    expect(classifyCheck(0, 0, false)).toBe("unreadable");
  });

  it("records a match and never changes the scholarship's status", async () => {
    const env = await setup();
    const before = await env.DB.prepare("SELECT status, version FROM scholarships WHERE id = 's1'").first();
    const r = await checkScholarship(env.DB, "s1", page("<p>Applications close on <strong>15 December 2026</strong>.</p>") as any);
    expect(r).toMatchObject({ result: "matches", found: 1, total: 1 });
    const after = await env.DB.prepare("SELECT status, version, source_checked_at, source_check FROM scholarships WHERE id = 's1'").first<any>();
    expect({ status: after.status, version: after.version }).toEqual(before);
    expect(JSON.parse(after.source_check).result).toBe("matches");
    expect(after.source_checked_at).toBeTruthy();
  });

  it("opens one review task when the quote has disappeared, and treats blocked pages as unreadable", async () => {
    const env = await setup();
    expect((await checkScholarship(env.DB, "s1", page("<p>The 2027 call will be announced later.</p>") as any))?.result).toBe("changed");
    await checkScholarship(env.DB, "s1", page("<p>Nothing here.</p>") as any);
    const tasks = await env.DB.prepare("SELECT COUNT(*) AS n FROM review_tasks WHERE kind = 'source_changed' AND scholarship_id = 's1'").first<any>();
    expect(tasks.n).toBe(1);
    const blocked = async () => new Response("blocked", { status: 412 });
    expect((await checkScholarship(env.DB, "s1", blocked as any))?.result).toBe("unreadable");
  });
});
