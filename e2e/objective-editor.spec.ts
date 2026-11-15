import { board, expect, test } from "./fixtures";

const showcases = [
  { name: "First Flight", objective: "Capture the royal" },
  { name: "The Long Walk", objective: "Reach a target" },
  { name: "Last Flock Standing", objective: "Eliminate all opponents" },
];

for (const showcase of showcases) {
  test(`loads ${showcase.name} and hands it to playtest`, async ({ editor: page }) => {
    await page.getByRole("button", { name: `Load ${showcase.name}` }).click();
    const confirm = page.getByRole("button", { name: `Confirm load ${showcase.name}` });
    if (await confirm.isVisible()) await confirm.click();

    await expect(page.getByRole("region", { name: showcase.name })).toBeVisible();
    await expect(page.getByRole("main")).toContainText(showcase.objective);

    await page.getByRole("button", { name: "Open playtest" }).click();
    await page.getByRole("button", { name: "Return to editor" }).click();
    await expect(page.getByRole("region", { name: showcase.name })).toBeVisible();
  });
}

test("switches objectives and shows only the controls that apply", async ({ editor: page }) => {
  await page.getByRole("button", { name: /^Reach a target$/ }).click();
  await expect(page.getByLabel("White target coordinate")).toBeVisible();
  await expect(page.getByRole("button", { name: "Open playtest" })).toBeDisabled();

  await page.getByRole("button", { name: /^Eliminate all opponents$/ }).click();
  await expect(page.getByLabel("White target coordinate")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open playtest" })).toBeEnabled();
});

test("adds targets by keyboard and on the board, then unlocks playtest", async ({ editor: page }) => {
  await page.getByRole("button", { name: /^Reach a target$/ }).click();

  await page.getByLabel("White target coordinate").fill("b4");
  await page.getByLabel("White target coordinate").press("Enter");
  await expect(page.getByRole("button", { name: "Remove White target b4" })).toBeVisible();

  await page.getByRole("button", { name: "Select Black targets on board" }).click();
  await board(page).getByRole("button", { name: "d2", exact: true }).click();
  await expect(page.getByRole("button", { name: "Remove Black target d2" })).toBeVisible();

  await expect(page.getByRole("button", { name: "Open playtest" })).toBeEnabled();
});

test("asks before a showcase replaces an edited draft and keeps it on cancel", async ({ editor: page }) => {
  await page.getByRole("button", { name: /^Eliminate all opponents$/ }).click();

  await page.getByRole("button", { name: "Load The Long Walk" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "edited draft" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel replacement" }).click();
  await expect(page.getByRole("region", { name: "First Flight" })).toBeVisible();

  await page.getByRole("button", { name: "Load The Long Walk" }).click();
  await page.getByRole("button", { name: "Confirm load The Long Walk" }).click();
  await expect(page.getByRole("region", { name: "The Long Walk" })).toBeVisible();
});
