import { expect, test, type Page } from "@playwright/test";

// Walks the conversational Cost Planner. Expected totals are hand-calculated (EUR at a fixed 300 PKR):
// 24 months: tuition 4 × 1,500 + fee 4 × 150 + rent 24 × 400 + living 24 × 500 + visa 75 = 28,275 EUR = 8,482,500 PKR
// 18 months: 3 × 1,500 + 3 × 150 + 18 × 400 + 18 × 500 + 75 = 21,225 EUR = 6,367,500 PKR

async function answerGermany(page: Page) {
  await page.goto("/costs");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/costs");
  await page.getByRole("button", { name: "Start planning" }).click();
  const next = () => page.getByRole("button", { name: /Continue|See my results/ }).click();
  await page.getByRole("radio", { name: "Germany" }).click();
  await next();
  await page.getByRole("button", { name: "Skip", exact: true }).click(); // city & university are optional
  await page.getByRole("radio", { name: "Master's" }).click();
  await next();
  await expect(page.getByLabel("Or exact months")).toHaveValue("24");
  await next();
  await page.getByRole("radio", { name: "Applying from Pakistan" }).click();
  await next();
  await page.getByRole("radio", { name: "Exploring scholarships" }).click();
  await next();
  await page.getByRole("checkbox").first().click(); // pick one catalogued German award as potential funding
  await next();
  await page.getByLabel("Tuition", { exact: true }).fill("1500");
  await page.getByLabel("Tuition frequency").selectOption("semester");
  await page.getByLabel("Semester / enrolment fee", { exact: true }).fill("150");
  await page.getByLabel("Semester / enrolment fee frequency").selectOption("semester");
  await next();
  await page.getByRole("radio", { name: "Shared flat" }).click();
  await page.getByLabel("Rent", { exact: true }).fill("400");
  await page.getByLabel("Rent currency").selectOption("EUR");
  await next();
  await page.getByLabel("Living costs", { exact: true }).fill("500");
  await page.getByLabel("Living costs currency").selectOption("EUR");
  await next();
  await page.getByRole("checkbox", { name: /Student visa fee/ }).check();
  await page.getByLabel("Student visa fee amount", { exact: true }).fill("75");
  await page.getByLabel("Student visa fee amount currency").selectOption("EUR");
  await next();
  await page.getByLabel("Your savings", { exact: true }).fill("3000000");
  await next();
  await page.getByLabel("PKR per EUR").fill("300");
}

test("conversation → three-scenario results with hand-checked totals, edit and back", async ({ page }, info) => {
  await answerGermany(page);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `qa-shots/costs-results-${info.project.name}.png`, fullPage: true });
  const baseline = page.locator(".scenario").first();
  await expect(baseline).toContainText("Without a scholarship");
  await expect(baseline).toContainText("PKR 8,482,500");
  await expect(page.locator(".scenario").nth(1)).toContainText("Potential — not awarded");
  // Potential funding never changes "Your available funds".
  await expect(page.locator(".scenario").nth(1)).toContainText("PKR 3,000,000");
  await expect(page.getByText("Proof of funds for the visa")).toBeVisible();
  await expect(page.getByText(/not an extra cost/)).toBeVisible();

  // Immediate recalculation from the assumptions editor.
  await page.getByLabel("Programme length in months").fill("18");
  await expect(baseline).toContainText("PKR 6,367,500");

  // Back to the conversation and edit an earlier answer via the trail.
  await page.getByRole("button", { name: "Edit answers" }).click();
  await expect(page.getByRole("heading", { name: "Where do you want to study?" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("radio", { name: "Germany" })).toHaveAttribute("aria-checked", "true");

  // Display currency switch keeps the original currency figures intact.
  await page.getByRole("button", { name: "Skip to results" }).click();
  await page.getByRole("group", { name: "Display currency" }).getByRole("button", { name: "EUR" }).click();
  await expect(baseline).toContainText("EUR 21,225");

  // Export is voluntary and contains the scenarios and sources.
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export summary" }).click()]);
  const text = await (await download.createReadStream()).toArray().then((b) => Buffer.concat(b).toString("utf8"));
  expect(text).toContain("## Without a scholarship");
  expect(text).toContain("Cost lines");

  // Start over asks first, then clears the draft.
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Start over" }).click();
  await expect(page.getByRole("button", { name: "Start planning" })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("raasta.costplan.draft.v1") ?? "{}").costs?.length ?? 0)).toBe(0);
});

test("saved plan appears on the dashboard and keeps versions", async ({ page }) => {
  const email = `e2e-costs-${Date.now()}@raasta.test`;
  await page.goto("/signup");
  await page.getByLabel("Name").fill("E2E Costs");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("e2e-test-password-123");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/app\/profile/);

  await answerGermany(page);
  await page.getByRole("button", { name: "Save to dashboard" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved · version 1")).toBeVisible();
  await page.getByLabel("Programme length in months").fill("18");
  await page.getByRole("button", { name: "Save new version" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved · version 2")).toBeVisible();

  await page.goto("/app");
  const card = page.getByRole("region", { name: "Financial plan" });
  await expect(card).toContainText("Version 2");
  await expect(card).toContainText("PKR 6,367,500"); // 18-month baseline, nothing confirmed
  await expect(card).toContainText("(not counted)");
  await card.getByRole("link", { name: "Open plan" }).click();
  await expect(page.locator(".scenario").first()).toContainText("PKR 6,367,500");
  await page.getByRole("button", { name: "Versions" }).click();
  await expect(page.getByRole("dialog").getByText("Version 1")).toBeVisible();
});
