import { board, expect, loadShowcase, playtestBoard, square, test } from "./fixtures";

test("skip link is the first tab stop and moves to the board", async ({ editor: page }) => {
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to board" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#editor-board$/);
});

test("every button, link and field in the editor has an accessible name", async ({ editor: page }) => {
  const unnamed = await page.getByRole("main").locator("button, a, input, select, textarea").evaluateAll((elements) =>
    elements
      .filter((element) => {
        const input = element as HTMLInputElement;
        if (input.type === "hidden") return false;
        const labelled =
          element.getAttribute("aria-label") ||
          element.getAttribute("aria-labelledby") ||
          element.textContent?.trim() ||
          (input.labels && input.labels.length > 0) ||
          element.getAttribute("title");
        return !labelled;
      })
      .map((element) => element.outerHTML.slice(0, 120)),
  );
  expect(unnamed).toEqual([]);
});

test("keyboard focus is visible on controls and board squares", async ({ editor: page }) => {
  const outlineWidth = (locator: ReturnType<typeof board>) =>
    locator.evaluate((element) => Number.parseFloat(getComputedStyle(element).outlineWidth) || 0);

  const openPlaytest = page.getByRole("button", { name: "Open playtest" });
  await page.keyboard.press("Tab");
  await openPlaytest.focus();
  await expect(openPlaytest).toBeFocused();
  expect(await outlineWidth(openPlaytest)).toBeGreaterThan(0);

  const a1 = board(page).getByRole("button", { name: "a1, White Tower" });
  await a1.focus();
  await page.keyboard.press("ArrowRight");
  const b1 = board(page).getByRole("button", { name: "b1", exact: true });
  await expect(b1).toBeFocused();
  const ring = await b1.evaluate((element) => {
    const style = getComputedStyle(element);
    return (Number.parseFloat(style.outlineWidth) || 0) > 0 || style.boxShadow !== "none";
  });
  expect(ring).toBe(true);
});

test("moves are announced in a live region", async ({ editor: page }) => {
  await loadShowcase(page, "The Long Walk");
  await page.getByRole("button", { name: "Open playtest" }).click();
  const playBoard = playtestBoard(page, "The Long Walk");
  await square(playBoard, "a1").click();
  await square(playBoard, "a2").click();

  const announcement = page.getByRole("status").filter({ hasText: "White Runner moved a1 to a2" });
  await expect(announcement).toContainText("Black to move");
});

test("win conditions are told apart by text, not colour alone", async ({ editor: page }) => {
  await loadShowcase(page, "The Long Walk");
  await page.getByRole("button", { name: "Open playtest" }).click();

  const targets = page.getByRole("region", { name: "Targets" });
  await expect(targets).toContainText("Corner brackets");
  await expect(targets).toContainText("Dashed ring");
  const playBoard = playtestBoard(page, "The Long Walk");
  await expect(square(playBoard, "a3")).toHaveAccessibleName(/White target/);
  await expect(square(playBoard, "c1")).toHaveAccessibleName(/Black target/);
});

test("the page does not scroll sideways", async ({ editor: page }) => {
  const overflow = () =>
    page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(await overflow()).toBeLessThanOrEqual(1);

  await loadShowcase(page, "Last Flock Standing");
  await page.getByRole("button", { name: "Open playtest" }).click();
  await expect(playtestBoard(page, "Last Flock Standing")).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(1);
});

test.describe("with reduced motion requested", () => {
  test.use({ reducedMotion: "reduce" });

  test("pieces move without animation and the game still completes", async ({ editor: page }) => {
    await loadShowcase(page, "The Long Walk");
    await page.getByRole("button", { name: "Open playtest" }).click();
    const playBoard = playtestBoard(page, "The Long Walk");

    const longest = await playBoard.evaluate((element) => {
      const seconds = (value: string) =>
        Math.max(...value.split(",").map((part) => (part.trim().endsWith("ms") ? Number.parseFloat(part) / 1000 : Number.parseFloat(part) || 0)));
      return Math.max(
        ...[element, ...element.querySelectorAll("*")].map((node) => {
          const style = getComputedStyle(node);
          return Math.max(seconds(style.transitionDuration), seconds(style.animationDuration));
        }),
      );
    });
    expect(longest).toBeLessThanOrEqual(0.01);

    for (const [from, to] of [["a1", "a2"], ["c3", "c2"], ["a2", "a3"]]) {
      await square(playBoard, from).click();
      await square(playBoard, to).click();
    }
    await expect(page.getByRole("heading", { name: "White wins" })).toBeVisible();
  });
});
