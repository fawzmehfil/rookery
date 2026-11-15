import { test as base, expect, type Locator, type Page } from "@playwright/test";

export const DRAFT_STORAGE_KEY = "rookery.editor.draft";

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
    await expect(board(page)).toBeVisible();

    await provide(page);

    expect(problems, "browser console should stay clean").toEqual([]);
  },
});

export { expect };

export const board = (page: Page) => page.getByRole("group", { name: "Variant editor board" });

export const playtestBoard = (page: Page, variantName: string) =>
  page.getByRole("group", { name: `${variantName} playtest board` });

export const square = (boardLocator: Locator, name: string) => boardLocator.locator(`[data-square="${name}"]`);

/** Loads a showcase, confirming the replacement prompt when the draft was edited. */
export async function loadShowcase(page: Page, name: string) {
  await page.getByRole("button", { name: `Load ${name}` }).click();
  const confirm = page.getByRole("button", { name: `Confirm load ${name}` });
  if (await confirm.isVisible()) await confirm.click();
  await expect(page.getByRole("region", { name })).toBeVisible();
}

/** The draft variant currently saved in this browser, or null. */
export async function savedVariant(page: Page): Promise<{ id: string; name: string } | null> {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw).variant : null;
  }, DRAFT_STORAGE_KEY);
}

export type Move = readonly [from: string, to: string];

export const showcases = [
  {
    name: "First Flight",
    objective: "Capture the royal",
    winner: "White",
    victory: "capturing the opposing royal",
    moves: [
      ["a1", "a4"], ["a5", "b3"], ["c1", "b2"], ["c5", "b5"], ["a4", "b4"],
      ["e5", "e2"], ["b4", "b3"], ["e2", "e1"], ["b3", "b5"],
    ],
  },
  {
    name: "The Long Walk",
    objective: "Reach a target",
    winner: "White",
    victory: "reaching a target",
    moves: [["a1", "a2"], ["c3", "c2"], ["a2", "a3"]],
  },
  {
    name: "Last Flock Standing",
    objective: "Eliminate all opponents",
    winner: "White",
    victory: "",
    moves: [
      ["a1", "a5"], ["b5", "b4"], ["a5", "c5"], ["b4", "a4"], ["c5", "e5"],
      ["a4", "a3"], ["e1", "a3"],
    ],
  },
] as const satisfies readonly {
  name: string; objective: string; winner: string; victory: string; moves: readonly Move[];
}[];
