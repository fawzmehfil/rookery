import { mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { board, expect, loadShowcase, playtestBoard, showcases, square, test } from "../fixtures";

// Optional presentation evidence, not a release gate. Run with
// `npm run evidence:capture`; files land in docs/evidence/sprint-2/.
const evidenceDir = path.join("docs", "evidence", "sprint-2");

test.beforeAll(async () => {
  await mkdir(evidenceDir, { recursive: true });
});

test("screenshots of the library, editor and playtest", async ({ editor: page }, testInfo) => {
  test.skip(testInfo.project.name === "firefox", "Screenshots use the Chromium projects.");
  const size = testInfo.project.name === "chromium-narrow" ? "narrow" : "desktop";
  const shot = (name: string) => page.screenshot({ path: path.join(evidenceDir, `s2-08-${name}-${size}.png`) });

  await loadShowcase(page, "The Long Walk");
  await board(page).scrollIntoViewIfNeeded();
  await shot("editor");

  await page.getByRole("button", { name: "+ Add piece type" }).click();
  const library = page.getByRole("dialog", { name: "Piece library" });
  await library.getByLabel("Search pieces").fill("Empress");
  await library.getByRole("button", { name: "Preview Chancellor" }).click();
  await expect(library.getByRole("region", { name: "Chancellor preview" })).toBeVisible();
  await shot("library");
  await library.getByRole("button", { name: "Close Piece library" }).click();

  await page.getByRole("button", { name: "Open playtest" }).click();
  const playBoard = playtestBoard(page, "The Long Walk");
  for (const [from, to] of showcases[1].moves) {
    await square(playBoard, from).click();
    await square(playBoard, to).click();
  }
  await expect(page.getByRole("heading", { name: "White wins" })).toBeVisible();
  await playBoard.scrollIntoViewIfNeeded();
  await shot("playtest");
});

test("records the Sprint 2 demo story", async ({ editor: page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "One desktop recording is enough.");
  const pause = () => page.waitForTimeout(700); // pacing for viewers only; nothing is asserted on it

  for (const showcase of showcases) {
    await loadShowcase(page, showcase.name);
    await board(page).scrollIntoViewIfNeeded();
    await pause();
  }

  await loadShowcase(page, "First Flight");
  await page.getByRole("button", { name: "+ Add piece type" }).click();
  const library = page.getByRole("dialog", { name: "Piece library" });
  await library.getByLabel("Search pieces").pressSequentially("Empress", { delay: 60 });
  await library.getByRole("button", { name: "Preview Chancellor" }).click();
  await pause();
  await library.getByRole("button", { name: "Add Chancellor" }).click();
  await pause();

  await page.getByRole("button", { name: /^Reach a target$/ }).click();
  await page.getByLabel("White target coordinate").fill("b4");
  await page.getByLabel("White target coordinate").press("Enter");
  await page.getByLabel("Black target coordinate").fill("d2");
  await page.getByLabel("Black target coordinate").press("Enter");
  await pause();

  for (const showcase of showcases) {
    await loadShowcase(page, showcase.name);
    await page.getByRole("button", { name: "Open playtest" }).click();
    const playBoard = playtestBoard(page, showcase.name);
    await playBoard.scrollIntoViewIfNeeded();
    for (const [from, to] of showcase.moves) {
      await square(playBoard, from).click();
      await square(playBoard, to).click();
      await page.waitForTimeout(350);
    }
    await expect(page.getByRole("heading", { name: `${showcase.winner} wins` })).toBeVisible();
    await pause();
    await page.getByRole("button", { name: "Return to editor" }).click();
  }

  await page.reload();
  await expect(page.getByRole("region", { name: "Last Flock Standing" })).toBeVisible();
  await pause();

  const video = page.video();
  await page.close();
  if (video) await rename(await video.path(), path.join(evidenceDir, "s2-08-backup.webm"));
});
