import { expect, test } from "@playwright/test";

// Live discovery reads REAL official pages (no fixtures), so the exact results vary. The test checks the honest
// labelling and the flow, not specific scholarships. Creates one e2e-*@raasta.test account (delete from live afterwards).
const email = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@raasta.test`;

test("discover: official-source search, separate statuses, evidence, English/MOI, checklist, save to roadmap", async ({ page }, info) => {
  test.setTimeout(150_000);
  await page.goto("/signup");
  await page.getByLabel("Name").fill("E2E Discover");
  await page.getByLabel("Email").fill(email());
  await page.getByLabel("Password").fill("e2e-test-password-123");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/route/);
  await page.evaluate(() =>
    fetch("/api/me/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ profile: { nationality: "PK", journey: "applying_from_pakistan", targetLevel: "master", highestCompleted: "bachelor", targetCountries: ["DE", "IT"] } }) }),
  );

  await page.goto("/app/discover");
  await expect(page.getByRole("heading", { name: "Discover" })).toBeVisible();
  await expect(page.getByText(/Nothing here is verified until a Raasta reviewer checks it/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Germany" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Search official sources" }).click();
  await expect(page.getByRole("heading", { name: /page(s)? found/ })).toBeVisible({ timeout: 120_000 });
  await page.screenshot({ path: info.outputPath("discover-results.png"), fullPage: true });

  const cards = page.getByRole("article");
  const n = await cards.count();
  test.skip(n === 0, "No official page with usable details was reachable right now (network-dependent).");
  const first = cards.first();
  // Five separate dimensions, never a probability.
  await expect(first.getByText(/^Eligibility:/)).toBeVisible();
  await expect(first.getByText("Chances: not estimated")).toBeVisible();
  await expect(first.getByText(/^Readiness:/)).toBeVisible();
  await expect(first.getByText(/Not verified|Reviewer checked|Conflicting details/)).toBeVisible();
  await expect(first.getByText(/Deadline (ahead|passed|unknown)|Several dates/)).toBeVisible();
  await expect(page.getByText(/%|probability|likely to win/i)).toHaveCount(0);

  await first.getByRole("button", { name: /Details, documents and plan/ }).click();
  await expect(first.getByText(/Not yet verified by a Raasta reviewer|Reviewer checked|some details conflict/).first()).toBeVisible();
  await expect(first.getByRole("heading", { name: /English requirement \(admission and scholarship checked separately\)/ })).toBeVisible();
  await expect(first.getByText(/^Admission:/).first()).toBeVisible();
  await expect(first.getByText(/^Scholarship:/).first()).toBeVisible();
  await expect(first.getByRole("heading", { name: "Document checklist" })).toBeVisible();
  await expect(first.getByRole("heading", { name: "Your timeline" })).toBeVisible();
  await page.screenshot({ path: info.outputPath("discover-detail.png"), fullPage: true });
  expect(await page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")).toBe(true); // no sideways scroll

  await first.getByRole("button", { name: "Save to my roadmap" }).click();
  await expect(page).toHaveURL(/\/app\/applications\//);
  await expect(page.getByText(/\[Unverified lead\]/).first()).toBeVisible();
});
