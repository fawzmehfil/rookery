import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it } from "vitest";
import { VariantWorkshop } from "./variant-workshop";

const DRAFT_KEY = "rookery.editor.draft";

beforeEach(() => localStorage.clear());
afterEach(cleanup);

it("wins The Long Walk in playtest and returns to an unchanged saved draft", async () => {
  const user = userEvent.setup();
  render(<VariantWorkshop />);
  await screen.findByRole("group", { name: "Variant editor board" });

  await user.click(screen.getByRole("button", { name: "Load The Long Walk" }));
  await waitFor(() => expect(savedVariant()?.id).toBe("the-long-walk"));
  const before = savedVariant();

  await user.click(screen.getByRole("button", { name: "Open playtest" }));
  const board = screen.getByRole("group", { name: "The Long Walk playtest board" });
  const square = (name: string) => board.querySelector<HTMLButtonElement>(`[data-square="${name}"]`)!;
  for (const [from, to] of [["a1", "a2"], ["c3", "c2"], ["a2", "a3"]]) {
    await user.click(square(from!));
    await user.click(square(to!));
  }
  expect(screen.getByRole("heading", { name: "White wins" })).toBeTruthy();

  await user.click(screen.getByRole("button", { name: "Return to editor" }));
  const editorBoard = screen.getByRole("group", { name: "Variant editor board" });
  expect(within(editorBoard).getByRole("button", { name: "a1, White Runner" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Remove White target a3" })).toBeTruthy();
  expect(savedVariant()).toEqual(before);
});

function savedVariant(): { id: string } | undefined {
  const raw = localStorage.getItem(DRAFT_KEY);
  return raw ? JSON.parse(raw).variant : undefined;
}
