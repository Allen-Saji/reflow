import { test, expect } from "@playwright/test";

test("saves a theme choice across routes, reloads and tabs", async ({
  page,
  context,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    "content",
    "#f5f2ec",
  );
  await page.screenshot({
    path: testInfo.outputPath("light-landing.png"),
    fullPage: true,
  });
  const toggle = page.getByRole("button", { name: "Switch to dark mode" });
  await toggle.focus();
  await toggle.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    "content",
    "#0a0a0a",
  );
  await page.screenshot({
    path: testInfo.outputPath("dark-landing.png"),
    fullPage: true,
  });

  await page.getByRole("button", { name: "Open the sample workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Order overview" }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const other = await context.newPage();
  await other.goto("/");
  await other.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await other.close();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.screenshot({
    path: testInfo.outputPath("light-dashboard.png"),
    fullPage: true,
  });

  await page
    .getByRole("button", { name: "Report disruption", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("light-dialog.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Create recovery case" }).click();
  const graph = page.getByLabel("Graph evidence path");
  await expect(graph.locator(".react-flow__node").first()).toBeVisible();
  await expect(graph.locator(".react-flow")).toHaveClass(/light/);
  await page.screenshot({
    path: testInfo.outputPath("light-graph.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(graph.locator(".react-flow")).toHaveClass(/dark/);
  await expect(graph.locator(".react-flow__node").first()).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("dark-graph.png"),
    fullPage: true,
  });

  await page.setViewportSize({ width: 320, height: 844 });
  await expect(
    page.getByRole("button", { name: "Switch to light mode" }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.body.scrollWidth <= innerWidth))
    .toBe(true);
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await page.getByRole("link", { name: "Data & evidence" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect
    .poll(() => page.evaluate(() => document.body.scrollWidth <= innerWidth))
    .toBe(true);
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Switch to dark mode" }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.body.scrollWidth <= innerWidth))
    .toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("light-phone.png"),
    fullPage: true,
  });
});

test("follows system changes and keeps the toggle usable when storage is blocked", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Storage blocked", "SecurityError");
      },
    });
  });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Open the sample workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Order overview" }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
