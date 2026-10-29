import { expect, test } from "@playwright/test";

// Each run creates a throwaway student account with a unique test email.
const email = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@raasta.test`;
const PASSWORD = "e2e-test-password-123";

test("public pages render without console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const path of ["/", "/scholarships", "/pricing", "/costs", "/how-it-works", "/privacy"]) {
    await page.goto(path);
    await expect(page.locator("h1").first()).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("catalogue search and filters", async ({ page }) => {
  await page.goto("/scholarships");
  await expect(page.getByText(/catalogued awards/)).toBeVisible();
  await page.getByRole("group", { name: "Country" }).getByRole("button", { name: "Germany" }).click();
  await expect(page.locator(".trow").first()).toContainText("Germany");
  await page.getByLabel("Search scholarships").fill("zzzz-no-match");
  await expect(page.getByText("Nothing matches yet")).toBeVisible();
});

test("student journey: sign up, profile, matches, track, tick task, writing", async ({ page, isMobile }) => {
  await page.goto("/signup");
  await page.getByLabel("Name").fill("E2E Student");
  await page.getByLabel("Email").fill(email());
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/route/); // new students start with the study-route assessment
  await page.goto("/app/profile");

  await page.getByRole("radio", { name: "Applying from Pakistan" }).click();
  await page.getByLabel("Degree you want").selectOption("master");
  await page.getByLabel("Highest completed qualification").selectOption("bachelor");
  await page.getByRole("button", { name: "Save and see matches" }).click();
  await expect(page).toHaveURL(/\/app\/matches/);
  await expect(page.getByRole("heading", { name: "Your matches" })).toBeVisible();

  await page.goto("/scholarships/test-cn-master");
  await expect(page.getByText("This is a TEST record", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Track application" }).click();
  await expect(page).toHaveURL(/\/app\/applications\//);

  const first = page.getByRole("checkbox", { name: /Mark Read the official/ });
  await first.click();
  await expect(first).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText(/1 of \d+ applicable tasks done/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: /Read the official/ })).toHaveAttribute("aria-checked", "true");

  await page.goto("/app");
  await expect(page.getByRole("heading", { name: "Next actions" })).toBeVisible();

  await page.goto("/app/writing");
  await page.getByRole("button", { name: "New document" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Create" }).click();
  await expect(page.getByText("coaching only", { exact: false }).first()).toBeVisible();
  await page.getByLabel("Document text").fill("My CGPA of 3.1 and my project.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByText("fact bank is empty", { exact: false })).toBeVisible();
  if (!isMobile) await expect(page.getByRole("button", { name: "Outline from my facts" })).toBeDisabled();
});

test("dashboard is private when signed out", async ({ page }) => {
  await page.goto("/app");
  await expect(page.getByText("Please sign in")).toBeVisible();
  // Fetch from inside the page so it uses the browser's network path (proxies included).
  const status = await page.evaluate(() => fetch("/api/me/dashboard").then((r) => r.status));
  expect(status).toBe(401);
});

test("cost planner opens with the conversation", async ({ page }) => {
  await page.goto("/costs");
  await expect(page.getByRole("heading", { name: "Cost Planner" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Where do you want to study?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled(); // must answer first
});
