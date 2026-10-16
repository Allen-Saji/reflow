import { test, expect } from "@playwright/test";
test("recovers orders, persists approval, and exposes a revised-data shortage", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open the sample workspace" }).click();
  await page
    .getByRole("button", { name: "Report disruption", exact: true })
    .click();
  await page.getByRole("button", { name: "Create recovery case" }).click();
  await expect(page.getByText("O-103", { exact: true })).toBeVisible();
  await page
    .getByRole("combobox", { name: "Investigation mode" })
    .selectOption("guided");
  await page
    .getByRole("button", { name: "Find recovery options", exact: true })
    .click();
  await expect(
    page.getByText(
      "Offer depends on the disrupted factory; no independent finished stock.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Review recovery plan" }).click();
  await expect(
    page.getByRole("heading", {
      name: "2 of 2 affected orders projected on time.",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Approve recovery plan" }).click();
  await page.getByRole("button", { name: "Approve and verify" }).click();
  await expect(
    page.getByRole("button", { name: "Download receipt" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: "03 Plan" }).click();
  await expect(
    page.getByRole("button", { name: "Download receipt" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(() => document.body.scrollWidth <= window.innerWidth),
    )
    .toBe(true);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("link", { name: "Data & evidence" }).click();
  await page.getByRole("button", { name: "Open 50-unit scenario" }).click();
  await page
    .getByRole("button", { name: "Report disruption", exact: true })
    .click();
  await page.getByRole("button", { name: "Create recovery case" }).click();
  await page
    .getByRole("combobox", { name: "Investigation mode" })
    .selectOption("guided");
  await page
    .getByRole("button", { name: "Find recovery options", exact: true })
    .click();
  await page.getByRole("button", { name: "Review recovery plan" }).click();
  await expect(
    page.getByText(
      "30 units remain uncovered. Incomplete orders are not counted as on-time shipments.",
    ),
  ).toBeVisible();
  await page.getByRole("link", { name: "Data & evidence" }).click();
  await page
    .getByRole("spinbutton", { name: "Quoted quantity for offer_d" })
    .fill("40");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("link", { name: "Operations", exact: true }).click();
  await page.getByRole("link", { name: /Open recovery case/ }).click();
  await page.getByRole("tab", { name: "03 Plan" }).click();
  await expect(
    page.getByRole("button", { name: "Approve recovery plan" }),
  ).toBeDisabled();
});
