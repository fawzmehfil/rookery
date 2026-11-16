import { readFile } from "node:fs/promises";
import { board, expect, loadShowcase, savedVariant, test } from "./fixtures";

const draft = (page: import("@playwright/test").Page) => page.getByRole("region", { name: "Your draft" });

test("autosaves an edited draft and restores it after a refresh", async ({ editor: page }) => {
  await loadShowcase(page, "The Long Walk");
  await page.getByLabel("White target coordinate").fill("b3");
  await page.getByLabel("White target coordinate").press("Enter");
  await expect(draft(page).getByRole("status")).toContainText("Saved in this browser");
  await expect.poll(async () => (await savedVariant(page))?.id).toBe("the-long-walk");

  await page.reload();

  await expect(page.getByRole("region", { name: "The Long Walk" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove White target b3" })).toBeVisible();
  await expect(board(page).getByRole("button", { name: "a1, White Runner" })).toBeVisible();
});

test("keeps the last valid draft while the editor shows a validation error", async ({ editor: page }) => {
  await loadShowcase(page, "The Long Walk");
  await expect.poll(async () => (await savedVariant(page))?.id).toBe("the-long-walk");

  // Reach a target without any target is invalid: readable error, playtest blocked, nothing saved over.
  await page.getByRole("button", { name: "Remove White target a3" }).click();
  await expect(draft(page).getByRole("status")).toContainText("Not saved: resolve");
  await expect(page.getByRole("button", { name: "Open playtest" })).toBeDisabled();

  await page.getByLabel("White target coordinate").fill("a3");
  await page.getByLabel("White target coordinate").press("Enter");
  await expect(draft(page).getByRole("status")).toContainText("Saved in this browser");
  await expect(page.getByRole("button", { name: "Open playtest" })).toBeEnabled();
});

test("exports a draft, resets, re-imports it and gets the same variant back", async ({ editor: page }, testInfo) => {
  await loadShowcase(page, "Last Flock Standing");
  await expect.poll(async () => (await savedVariant(page))?.id).toBe("last-flock-standing");
  const before = await savedVariant(page);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    draft(page).getByRole("button", { name: "Export JSON" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("last-flock-standing.rookery.json");
  const exported = testInfo.outputPath("exported.rookery.json");
  await download.saveAs(exported);

  await draft(page).getByRole("button", { name: "Reset draft" }).click();
  await page.getByRole("button", { name: "Confirm reset to First Flight" }).click();
  await expect(page.getByRole("region", { name: "First Flight" })).toBeVisible();

  await draft(page).locator('input[type="file"]').setInputFiles(exported);
  await page.getByRole("button", { name: "Confirm import Last Flock Standing" }).click();
  await expect(page.getByRole("group", { name: "Import result" })).toContainText("Imported Last Flock Standing");
  await expect(page.getByRole("region", { name: "Last Flock Standing" })).toBeVisible();
  await expect.poll(async () => await savedVariant(page)).toEqual(before);

  // The same draft exports to the same bytes.
  const [second] = await Promise.all([
    page.waitForEvent("download"),
    draft(page).getByRole("button", { name: "Export JSON" }).click(),
  ]);
  const reExported = testInfo.outputPath("re-exported.rookery.json");
  await second.saveAs(reExported);
  expect(await readFile(reExported, "utf8")).toBe(await readFile(exported, "utf8"));
});

test("undoes an import and returns to the previous draft", async ({ editor: page }, testInfo) => {
  await loadShowcase(page, "The Long Walk");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    draft(page).getByRole("button", { name: "Export JSON" }).click(),
  ]);
  const exported = testInfo.outputPath("long-walk.rookery.json");
  await download.saveAs(exported);

  await loadShowcase(page, "Last Flock Standing");
  await draft(page).locator('input[type="file"]').setInputFiles(exported);
  await page.getByRole("button", { name: "Confirm import The Long Walk" }).click();
  await expect(page.getByRole("region", { name: "The Long Walk" })).toBeVisible();

  await page.getByRole("button", { name: "Undo import" }).click();
  await expect(page.getByRole("region", { name: "Last Flock Standing" })).toBeVisible();
});

test("a failed import explains the problem and leaves the current draft alone", async ({ editor: page }) => {
  await loadShowcase(page, "The Long Walk");
  await expect.poll(async () => (await savedVariant(page))?.id).toBe("the-long-walk");
  const before = await savedVariant(page);

  await draft(page).locator('input[type="file"]').setInputFiles({
    name: "broken.rookery.json",
    mimeType: "application/json",
    buffer: Buffer.from("{ this is not json"),
  });

  const failure = page.getByRole("alert").filter({ hasText: "Import failed: broken.rookery.json" });
  await expect(failure).toBeVisible();
  await expect(failure).toContainText("Your current draft and its saved copy are unchanged.");
  await expect(page.getByRole("region", { name: "The Long Walk" })).toBeVisible();
  expect(await savedVariant(page)).toEqual(before);

  await failure.getByRole("button", { name: "Dismiss" }).click();
  await expect(failure).toHaveCount(0);
});

test("a valid JSON file that is not a variant is rejected without changing the draft", async ({ editor: page }) => {
  await draft(page).locator('input[type="file"]').setInputFiles({
    name: "not-a-variant.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ hello: "world" })),
  });

  await expect(page.getByRole("alert").filter({ hasText: "Import failed: not-a-variant.json" })).toBeVisible();
  await expect(page.getByRole("region", { name: "First Flight" })).toBeVisible();
});
