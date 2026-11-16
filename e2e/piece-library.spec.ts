import { board, expect, test } from "./fixtures";

test("finds Chancellor by its Empress alias, previews it and adds it to the palette", async ({ editor: page }) => {
  await page.getByRole("button", { name: "+ Add piece type" }).click();
  const library = page.getByRole("dialog", { name: "Piece library" });
  await library.getByLabel("Search pieces").fill("Empress");
  await expect(library.getByRole("status")).toContainText("1 templates");

  await library.getByRole("button", { name: "Preview Chancellor" }).click();
  await expect(library.getByRole("region", { name: "Chancellor preview" })).toBeVisible();
  await library.getByRole("button", { name: "Add Chancellor" }).click();

  await expect(page.getByLabel("Palette piece").locator("option", { hasText: "Chancellor" })).toHaveCount(1);
});

test("creates a custom leaper visually and places it on the board", async ({ editor: page }) => {
  await page.getByRole("button", { name: "+ Add piece type" }).click();
  await page.getByRole("button", { name: "Create a blank piece" }).click();

  const creator = page.getByRole("dialog", { name: "Create your piece" });
  await creator.getByLabel("Piece name").fill("Unicorn");
  await creator.getByLabel("Display token").fill("U");
  await creator.getByRole("group", { name: "Movement designer" }).getByRole("button", { name: "f7" }).click();
  await creator.getByRole("button", { name: "Add type and place copies" }).click();

  await board(page).getByRole("button", { name: "b2", exact: true }).click();
  await expect(board(page).getByRole("button", { name: "b2, White Unicorn" })).toBeVisible();
});

test("keeps the vector editor in sync with the visual designer", async ({ editor: page }) => {
  await page.getByRole("button", { name: "+ Add piece type" }).click();
  await page.getByRole("button", { name: "Create a blank piece" }).click();

  const creator = page.getByRole("dialog", { name: "Create your piece" });
  await creator.getByLabel("Piece name").fill("Bishop ray");
  await creator.getByLabel("Draw movement").selectOption("slide");
  await creator.getByLabel("Symmetry shortcut").selectOption("all");
  await creator.getByRole("group", { name: "Movement designer" }).getByRole("button", { name: "f6" }).click();

  await creator.getByText("Advanced: edit movement vectors").click();
  await creator.getByLabel("Across 1.1").fill("0");
  await creator.getByLabel("Forward 1.1").fill("0");
  await expect(creator.getByRole("alert")).toContainText("cannot be zero");
  await creator.getByLabel("Across 1.1").fill("1");
  await creator.getByLabel("Forward 1.1").fill("1");
  await expect(creator.getByRole("alert")).toHaveCount(0);
});

test("closes the library with Escape and returns focus to the trigger", async ({ editor: page }) => {
  const trigger = page.getByRole("button", { name: "+ Add piece type" });
  await trigger.click();
  await expect(page.getByRole("dialog", { name: "Piece library" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
