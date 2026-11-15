import { test as base, expect, type Page } from "@playwright/test";

/**
 * Opens the editor with empty browser storage and fails the test on any
 * uncaught page error or console error, so hydration problems surface.
 */
export const test = base.extend<{ editor: Page }>({
  editor: async ({ page }, provide) => {
    const problems: string[] = [];
    page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") problems.push(`console: ${message.text()}`);
    });

    await page.goto("/editor");
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await provide(page);

    expect(problems, "browser console should stay clean").toEqual([]);
  },
});

export { expect };

export const board = (page: Page) => page.getByRole("group", { name: "Variant editor board" });
