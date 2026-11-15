import { expect, test } from "./fixtures";

test("health endpoint reports the web service", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({ status: "ok", service: "rookery-web" });
});

test("home page links to the editor and the editor hydrates", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goto("/editor");
  await expect(page.getByRole("button", { name: "Open playtest" })).toBeEnabled();
});
