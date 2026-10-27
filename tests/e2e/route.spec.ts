import { expect, test } from "@playwright/test";

// The main entry: homepage CTA → adaptive assessment → evaluated results → sign up → roadmap on the dashboard.
// Creates one e2e-*@raasta.test account (delete from live afterwards).

test("study route: adaptive questions, saved progress, results with evidence, roadmap after sign-up", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.getByRole("link", { name: /Find my study route/ }).first().click();
  await expect(page).toHaveURL(/\/route$/);
  await expect(page.getByRole("heading", { name: "Where are you right now?" })).toBeVisible();
  const next = () => page.getByRole("button", { name: /^Continue|See my study routes/ }).click();

  // The second question depends on the first answer.
  await expect(page.getByRole("button", { name: /^Continue/ })).toBeDisabled();
  await page.getByRole("radio", { name: "I'm already studying in China" }).click();
  await next();
  await expect(page.getByRole("heading", { name: "Tell us about your current studies" })).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("radio", { name: "I'm applying from Pakistan" }).click();
  await next();
  await expect(page.getByRole("heading", { name: "Which countries are you considering?" })).toBeVisible();
  await page.getByRole("checkbox", { name: "Italy" }).click();
  await next();
  await page.getByRole("radio", { name: "Master's" }).click();
  await next();

  // Progress survives a refresh (kept in this browser only).
  await page.reload();
  await expect(page.getByRole("button", { name: /Goal:/ })).toContainText("Master");
  await expect(page.getByRole("heading", { name: "What's your highest completed qualification?" })).toBeVisible();

  await page.getByRole("radio", { name: "Bachelor's (16 years)" }).click();
  await next(); // grades
  await page.getByRole("radio", { name: "CGPA out of 4" }).click();
  await page.getByLabel("Your grade").fill("3.1");
  await next(); // gap
  await page.getByRole("radio", { name: "No gap" }).click();
  await next(); // language: none yet
  await next(); // personal details: optional
  await next(); // budget, last question
  await page.getByLabel("Budget (PKR)").fill("3000000");
  await next();

  // Results: routes, honest grouping, evidence, labelled estimate.
  await expect(page.getByRole("heading", { name: "Your possible routes" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Italy" })).toBeVisible();
  await expect(page.getByText(/estimate/i).first()).toBeVisible();
  await expect(page.getByText(/\d\s?%/)).toHaveCount(0); // never probabilities
  // No record is reviewer-confirmed yet, so nothing may appear as a verified fit.
  await expect(page.getByRole("heading", { name: /Verified fits \(0\)/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Potential fits|Needs confirmation/ }).first()).toBeVisible();
  await page.getByRole("button", { name: "Evidence" }).first().click();
  await expect(page.getByRole("link", { name: /source|official/i }).first()).toBeVisible();
  await page.getByRole("button", { name: "Add to roadmap" }).first().click();
  await expect(page.getByRole("button", { name: /In roadmap/ }).first()).toBeVisible();

  // Saving needs an account; sign-up returns to the results and creates the roadmap.
  await page.getByRole("button", { name: /Create free account to save/ }).click();
  await expect(page).toHaveURL(/\/signup\?next=/);
  await page.getByLabel("Name").fill("E2E Route");
  await page.getByLabel("Email").fill(`e2e-route-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@raasta.test`);
  await page.getByLabel("Password").fill("e2e-test-password-123");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Next actions" })).toBeVisible();

  const state = await page.evaluate(async () => {
    const [apps, profile]: any[] = await Promise.all([fetch("/api/me/applications").then((r) => r.json()), fetch("/api/me/profile").then((r) => r.json())]);
    return { apps: apps.applications?.length ?? 0, level: profile.profile?.targetLevel, journey: profile.profile?.journey };
  });
  expect(state).toEqual({ apps: 1, level: "master", journey: "applying_from_pakistan" });
});

test("cost planner opens on the first question with no unexplained numbers", async ({ page }) => {
  await page.goto("/costs");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/costs");
  await expect(page.getByRole("heading", { name: "Where do you want to study?" })).toBeVisible();
  await expect(page.getByText(/PKR|EUR|CNY/)).toHaveCount(0);
});
