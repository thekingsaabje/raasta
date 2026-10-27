import { expect, test, type Page } from "@playwright/test";

// Seven first-time-student journeys with fictional data. Each creates its own e2e-*@raasta.test account
// (delete them from live afterwards: DELETE FROM users WHERE email LIKE 'e2e-%@raasta.test').
const PASSWORD = "e2e-test-password-123";
const email = (tag: string) => `e2e-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@raasta.test`;

async function signup(page: Page, tag: string) {
  const e = email(tag);
  await page.goto("/signup");
  await page.getByLabel("Name").fill(`E2E ${tag}`);
  await page.getByLabel("Email").fill(e);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/route/); // new students start with the study-route assessment
  await page.goto("/app/profile");
  return e;
}

/** API calls from inside the page so they use the browser's session and network path. */
const call = (page: Page, method: string, path: string, body?: unknown): Promise<{ status: number; json: any }> =>
  page.evaluate(
    async ([m, p, b]) => {
      const r = await fetch("/api" + p, { method: m as string, headers: b ? { "content-type": "application/json" } : {}, body: b ? JSON.stringify(b) : undefined });
      return { status: r.status, json: await r.json().catch(() => null) };
    },
    [method, path, body] as const,
  );

test.describe.configure({ mode: "parallel" });

test("J1 · applying from Pakistan for a Chinese Government Scholarship", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("checked against the source");
  await signup(page, "j1");
  await page.getByRole("radio", { name: "Applying from Pakistan" }).click();
  await page.getByLabel("Highest completed qualification").selectOption("bachelor");
  await page.getByLabel("Degree you want").selectOption("master");
  await page.getByLabel("Grading scale").selectOption("4");
  await page.getByLabel("Your grade").fill("3.2");
  await page.getByRole("button", { name: "Save and see matches" }).click();
  await expect(page).toHaveURL(/\/app\/matches/);

  await page.goto("/scholarships");
  await page.getByRole("group", { name: "Country" }).getByRole("button", { name: "China" }).click();
  await page.getByLabel("Search scholarships").fill("Type A");
  const row = page.locator(".trow").filter({ hasText: "HEC" }).first();
  await expect(row).toBeVisible();
  await row.getByRole("link", { name: /View/ }).click();
  await expect(page.getByRole("link", { name: /Official page/ })).toHaveAttribute("href", /hec\.gov\.pk|campuschina/);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
  await page.getByRole("button", { name: "Track application" }).click();
  await expect(page).toHaveURL(/\/app\/applications\//);
  const first = page.getByRole("checkbox", { name: /Mark Read the official/ });
  await first.click();
  await expect(first).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText(/1 of \d+ applicable tasks done/)).toBeVisible();
});

test("J2 · already studying in China, looking for university scholarships", async ({ page }) => {
  await signup(page, "j2");
  await page.getByRole("radio", { name: "Studying in China" }).click();
  await expect(page.getByLabel("Current university")).toBeVisible(); // adaptive question appears
  await page.getByLabel("Current university").fill("Zhejiang University");
  await page.getByLabel("Year of study").fill("2");
  await page.getByLabel("Do you hold a scholarship now?").selectOption("false");
  await page.getByRole("button", { name: "Save and see matches" }).click();
  await page.goto("/scholarships");
  await page.getByLabel("Applicant type").selectOption("continuing");
  await expect(page.locator(".trow").first()).toContainText(/continuing/);
  const prof = await call(page, "GET", "/me/profile");
  expect(prof.json.profile.currentUniversity).toBe("Zhejiang University");
});

test("J3 · study gap, low CGPA, no IELTS → unknowns and next actions, not false rejections", async ({ page }) => {
  await signup(page, "j3");
  await call(page, "PUT", "/me/profile", { journey: "applying_from_pakistan", nationality: "PK", targetLevel: "master", highestCompleted: "bachelor", grade: { scale: "4", value: 2.4 }, gapYears: 3, hasExistingScholarship: false, birthDate: "1999-01-01" });
  await page.goto("/scholarships/test-cn-master");
  await expect(page.getByText("This is a TEST record", { exact: false })).toBeVisible();
  await expect(page.getByText(/Published minimum is 2.8; you entered 2.4/)).toBeVisible();
  await expect(page.getByText(/Add your language test results/)).toBeVisible(); // missing IELTS → UNKNOWN with next step
  const a = await call(page, "GET", "/me/assessments/test-cn-master");
  expect(a.json.assessment.overall).toBe("NOT_MET");
  expect(a.json.assessment.results.find((r: any) => r.text.includes("language")).status).toBe("UNKNOWN");
  // A "not met" verdict is only ever caused by a verified rule; unverified rules can't reject.
  const all = await call(page, "GET", "/me/assessments");
  for (const x of all.json.assessments.filter((x: any) => x.assessment.overall === "NOT_MET"))
    expect(x.assessment.results.some((r: any) => r.status === "NOT_MET" && r.ruleVerified)).toBe(true);
});

test("J4 · comparing Germany and Italy", async ({ page }) => {
  await page.goto("/scholarships");
  const country = page.getByRole("group", { name: "Country" });
  await country.getByRole("button", { name: "Germany" }).click();
  await expect(page.locator(".trow").first()).toContainText("Germany");
  await page.locator(".trow").first().getByRole("button", { name: /to comparison/ }).click();
  await country.getByRole("button", { name: "Italy" }).click();
  await expect(page.locator(".trow").first()).toContainText("Italy");
  await page.locator(".trow").first().getByRole("button", { name: /to comparison/ }).click();
  await expect(page.getByText("2/3 selected")).toBeVisible();
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Germany")).toBeVisible();
  await expect(dialog.getByText("Italy")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("J5 · limited funding with a confirmed award (China, CNY at 40 PKR)", async ({ page }) => {
  await signup(page, "j5");
  await page.goto("/app");
  await expect(page.getByText("Run the Cost Planner")).toBeVisible();
  await page.goto("/costs");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/costs");
  const next = () => page.getByRole("button", { name: /Continue|See my results/ }).click();
  await page.getByRole("radio", { name: "China" }).click();
  await next();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await page.getByRole("radio", { name: "Master's" }).click();
  await next();
  await next(); // 24 months
  await page.getByRole("radio", { name: "Applying from Pakistan" }).click();
  await next();
  await page.getByRole("radio", { name: "I have a full scholarship offer" }).click();
  await next();
  await page.getByLabel("Award name").fill("CSC Type B");
  await page.getByLabel("Stipend (cash)", { exact: true }).fill("3000");
  await page.getByLabel("Accommodation").selectOption("full");
  await page.getByLabel("Insurance").selectOption("full");
  await page.getByLabel("Travel").selectOption("none");
  await next();
  await page.getByLabel("Tuition", { exact: true }).fill("30000");
  await page.getByLabel("Tuition frequency").selectOption("year");
  await next();
  await page.getByRole("button", { name: "Skip", exact: true }).click(); // dorm covered by the award
  await page.getByLabel("Living costs", { exact: true }).fill("1500");
  await next();
  await page.getByRole("checkbox", { name: /Flight to destination/ }).check();
  await page.getByLabel("Flight to destination amount", { exact: true }).fill("120000");
  await next();
  await page.getByLabel("Your savings", { exact: true }).fill("200000");
  await next();
  await page.getByLabel("PKR per CNY").fill("40");
  // Hand-calculated: tuition 2 × 30,000 + living 24 × 1,500 = 96,000 CNY = 3,840,000 + flight 120,000 = 3,960,000 PKR.
  // Confirmed award: tuition 2,400,000 + stipend (23 paid months × 120,000 = 2,760,000, capped at living 1,440,000).
  // You still pay 120,000 (the flight); funds 200,000 → no gap. Without the award the gap is 3,760,000.
  const cards = page.locator(".scenario");
  await expect(cards.first()).toContainText("PKR 3,960,000");
  await expect(cards.first()).toContainText("PKR 3,760,000");
  const confirmed = cards.filter({ hasText: "Confirmed award" });
  await expect(confirmed).toContainText("PKR 120,000");
  await expect(confirmed).toContainText("None");
  await confirmed.click(); // details follow the selected scenario
  await expect(page.getByText(/first month must be paid from your own funds/).first()).toBeVisible();
});

test("J6 · several applications and writing documents", async ({ page }) => {
  await signup(page, "j6");
  const a1 = (await call(page, "POST", "/me/applications", { scholarshipId: "test-cn-master" })).json.application;
  const a2 = (await call(page, "POST", "/me/applications", { scholarshipId: "test-de-phd" })).json.application;
  await call(page, "POST", "/me/facts", { category: "project", text: "Built a crop-disease detection model for my final-year project" });
  await page.goto("/app");
  await expect(page.locator("a").filter({ hasText: "[TEST] Sample China Master's Award" }).first()).toBeVisible();
  await expect(page.locator("a").filter({ hasText: "[TEST] Sample Germany Doctoral Grant" }).first()).toBeVisible();

  await page.goto("/app/writing");
  await page.getByRole("button", { name: "New document" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel("Type").selectOption("research_proposal");
  await dlg.getByLabel("For application").selectOption(a2.id);
  await dlg.getByLabel(/Word limit/).fill("120");
  await dlg.getByRole("button", { name: "Create" }).click();
  await expect(page.getByText("Drafting help allowed")).toBeVisible();
  await page.getByRole("button", { name: "Outline from my facts" }).click();
  await expect(page.getByText(/crop-disease detection model/)).toBeVisible();
  await page.getByLabel("Document text").fill("word ".repeat(130));
  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByText(/130 words; the limit is 120/)).toBeVisible();

  // Second document for the other application follows that award's stricter policy.
  const d = (await call(page, "POST", "/me/writing", { kind: "study_plan", title: "Plan", applicationId: a1.id })).json.id;
  expect((await call(page, "POST", `/me/writing/${d}/outline`, {})).status).toBe(403);
  // Progress is tracked separately per application.
  const t1 = (await call(page, "GET", `/me/tasks?application_id=${a1.id}`)).json;
  const t2 = (await call(page, "GET", `/me/tasks?application_id=${a2.id}`)).json;
  await call(page, "PATCH", `/me/tasks/${t1.tasks[0].id}`, { studentStatus: "COMPLETED_BY_STUDENT" });
  expect((await call(page, "GET", `/me/tasks?application_id=${a2.id}`)).json.progress.done).toBe(t2.progress.done);
});

test("J7 · continuing student tracking a scholarship renewal", async ({ page }) => {
  await signup(page, "j7");
  await call(page, "PUT", "/me/profile", { journey: "studying_in_china", currentUniversity: "Wuhan University", currentYear: 2, hasExistingScholarship: true, existingScholarshipName: "CSC Type B" });
  const app = (await call(page, "POST", "/me/applications", { title: "CSC annual review 2027", institution: "Wuhan University" })).json.application;
  await page.goto(`/app/applications/${app.id}`);
  await page.getByPlaceholder("Add your own task…").fill("Collect transcript for annual review");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByText("Collect transcript for annual review")).toBeVisible();
  await call(page, "POST", "/me/tasks", { applicationId: app.id, title: "Submit annual review form", dueDate: "2027-03-01", requirementType: "mandatory" });
  await page.goto("/app");
  await expect(page.getByText("Submit annual review form").first()).toBeVisible(); // agenda
  await expect(page.getByText("not confirmed").first()).toBeVisible(); // own dates are never shown as official
  // Awards that exclude existing scholarship holders are flagged.
  const a = await call(page, "GET", "/me/assessments/test-cn-master");
  expect(a.json.assessment.results.find((r: any) => r.text.includes("existing")).status).toBe("NEEDS_REVIEW");
});

test("Security · isolation, admin denial, honest unavailable features", async ({ page, browser }) => {
  await signup(page, "secA");
  const app = (await call(page, "POST", "/me/applications", { scholarshipId: "test-cn-master" })).json.application;
  const ctx = await browser.newContext();
  const other = await ctx.newPage();
  await signup(other, "secB");
  expect((await call(other, "GET", "/admin/coverage")).status).toBe(403);
  expect((await call(other, "PATCH", "/admin/scholarships/test-cn-master", { status: "VERIFIED_OPEN", reason: "x" })).status).toBe(403);
  expect((await call(other, "GET", `/me/tasks?application_id=${app.id}`)).json.tasks).toHaveLength(0);
  expect((await call(other, "PATCH", `/me/applications/${app.id}`, { stage: "prepared" })).status).toBe(404);
  await other.goto("/admin");
  await expect(other.getByText("Admins only")).toBeVisible();
  await ctx.close();

  await page.goto("/pricing");
  await expect(page.getByText("Paid plans are not on sale yet")).toBeVisible();
  await expect(page.getByRole("button", { name: "Not yet available" }).first()).toBeDisabled();

  await page.goto("/scholarships/test-cn-master");
  await page.getByRole("button", { name: "Report an error" }).click();
  await page.getByLabel("Describe the error").fill("E2E test report, please ignore");
  await page.getByRole("button", { name: "Send report" }).click();
  await expect(page.getByText("review queue")).toBeVisible();

  const bad = await call(page, "PUT", "/me/profile", { grade: { scale: "4", value: "abc" } });
  expect(bad.status).toBe(400);
});
