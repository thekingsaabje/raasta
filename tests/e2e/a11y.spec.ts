import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Automated accessibility audit (axe-core, WCAG 2.1 A/AA). Fails on serious or critical problems only;
// a pass is not a full audit (keyboard and screen-reader checks are still manual).
for (const path of ["/", "/route", "/scholarships", "/scholarships/it-polimi-gold", "/costs", "/how-it-works"]) {
  test(`no serious accessibility violations on ${path}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" }); // measure final colours, not mid-animation
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2500); // staggered fade-ins (opacity still animates under reduced motion) must finish first
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(bad.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
  });
}
