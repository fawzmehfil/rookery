import { expect, loadShowcase, playtestBoard, showcases, square, test } from "./fixtures";

for (const showcase of showcases) {
  test(`wins ${showcase.name}, locks the board, keeps the events and resets`, async ({ editor: page }) => {
    await loadShowcase(page, showcase.name);
    await page.getByRole("button", { name: "Open playtest" }).click();

    const board = playtestBoard(page, showcase.name);
    await expect(page.getByRole("heading", { name: "White to move" })).toBeVisible();

    for (const [from, to] of showcase.moves) {
      await square(board, from).click();
      await square(board, to).click();
      await expect(square(board, to)).toHaveAccessibleName(/last move/);
    }

    const details = page.getByRole("complementary", { name: "Playtest details" });
    await expect(details.getByRole("heading", { name: `${showcase.winner} wins` })).toBeVisible();
    await expect(details).toContainText("Board input is now locked");
    if (showcase.victory) await expect(details).toContainText(showcase.victory);

    const events = details.getByRole("region", { name: "Accepted events" });
    await expect(events.getByRole("listitem").last()).toContainText(`${showcase.winner} won`);
    await expect(page.getByRole("status").filter({ hasText: `${showcase.winner} won` })).toBeVisible();

    // A locked board ignores further input.
    const [lastFrom] = showcase.moves[0];
    await square(board, lastFrom).click({ force: true });
    await expect(details.getByRole("heading", { name: `${showcase.winner} wins` })).toBeVisible();

    await page.getByRole("button", { name: "Reset position" }).click();
    await expect(page.getByRole("heading", { name: "White to move" })).toBeVisible();
    await expect(square(board, lastFrom)).toBeEnabled();
    await expect(events.getByRole("listitem").filter({ hasText: "won" })).toHaveCount(0);
  });
}

test("wins The Long Walk with the keyboard only", async ({ editor: page }) => {
  await loadShowcase(page, "The Long Walk");
  await page.getByRole("button", { name: "Open playtest" }).click();
  const board = playtestBoard(page, "The Long Walk");

  await square(board, "a1").focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await expect(square(board, "a2")).toHaveAccessibleName(/White Runner/);
  await expect(square(board, "a2")).toBeFocused();

  // Black: c3 to c2.
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(square(board, "c3")).toBeFocused();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Space");
  await expect(square(board, "c2")).toHaveAccessibleName(/Black Runner/);

  // White: a2 to a3.
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");

  await expect(page.getByRole("heading", { name: "White wins" })).toBeVisible();
});

test("a custom piece and objective made in the editor reach playtest unchanged", async ({ editor: page }) => {
  await loadShowcase(page, "The Long Walk");
  await page.getByRole("button", { name: "+ Add piece type" }).click();
  await page.getByRole("button", { name: "Create a blank piece" }).click();
  const creator = page.getByRole("dialog", { name: "Create your piece" });
  await creator.getByLabel("Piece name").fill("Unicorn");
  await creator.getByLabel("Display token").fill("U");
  await creator.getByRole("group", { name: "Movement designer" }).getByRole("button", { name: "f7" }).click();
  await creator.getByRole("button", { name: "Add type and place copies" }).click();
  await page.getByRole("group", { name: "Variant editor board" }).getByRole("button", { name: "b1", exact: true }).click();

  await page.getByRole("button", { name: "Open playtest" }).click();
  const board = playtestBoard(page, "The Long Walk");
  await expect(square(board, "b1")).toHaveAccessibleName(/White Unicorn/);

  await page.getByRole("button", { name: "Return to editor" }).click();
  await expect(page.getByRole("group", { name: "Variant editor board" }).getByRole("button", { name: "b1, White Unicorn" })).toBeVisible();
});
