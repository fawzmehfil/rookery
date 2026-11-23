import { board, expect, test } from "./fixtures";

test("resizes the board and keeps the existing setup", async ({ editor: page }) => {
  await page.getByLabel("Files (columns)").fill("6");
  await page.getByRole("button", { name: "Apply board size" }).click();

  await expect(page.getByRole("region", { name: "First Flight" })).toContainText("6 × 5");
  await expect(board(page).getByRole("button", { name: "f1", exact: true })).toBeVisible();
  await expect(board(page).getByRole("button", { name: "c1, White Sovereign" })).toBeVisible();
});
