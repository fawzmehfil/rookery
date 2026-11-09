import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import { VariantWorkshop } from "./variant-workshop";

afterEach(cleanup);

it("edits board, placement, and movement before entering a validated local playtest", async () => {
  const user = userEvent.setup();
  render(<VariantWorkshop />);
  const editorBoard = () => screen.getByRole("group", { name: "Variant editor board" });
  const editorSquare = (name: string) => editorBoard().querySelector<HTMLButtonElement>(`[data-square="${name}"]`)!;

  fireEvent.change(screen.getByLabelText("Files (columns)"), { target: { value: "6" } });
  await user.click(screen.getByRole("button", { name: "Apply board size" }));
  await user.selectOptions(screen.getByLabelText("Palette piece"), "tower");
  await user.click(screen.getByRole("radio", { name: "Place" }));
  await user.click(editorSquare("f1"));
  await user.selectOptions(screen.getByLabelText("Piece type to edit"), "tower");
  await user.selectOptions(screen.getByLabelText("Rule to edit"), "0");
  await user.selectOptions(screen.getByLabelText("Direction frame"), "owner");

  expect(screen.getByText("✓ Shared schema and semantic checks pass.")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Open playtest" }));

  const playtestBoard = screen.getByRole("group", { name: "First Flight playtest board" });
  expect(within(playtestBoard).getAllByRole("button")).toHaveLength(30);
  expect(playtestBoard.querySelector('[data-square="f1"]')?.getAttribute("aria-label")).toContain("White Tower");
  expect(screen.getByText("Every highlight and move comes from the shared rules engine.")).toBeTruthy();

  await user.click(screen.getByRole("button", { name: "Return to editor" }));
  expect(within(editorBoard()).getAllByRole("button")).toHaveLength(30);
  expect(editorSquare("f1").getAttribute("aria-label")).toContain("White Tower");
  await user.selectOptions(screen.getByLabelText("Piece type to edit"), "tower");
  await user.selectOptions(screen.getByLabelText("Rule to edit"), "0");
  expect((screen.getByLabelText("Direction frame") as HTMLSelectElement).value).toBe("owner");
});

it("keeps a blocking draft editable and links its issue back to the editor field", async () => {
  const user = userEvent.setup();
  render(<VariantWorkshop />);
  const board = screen.getByRole("group", { name: "Variant editor board" });
  const royal = board.querySelector<HTMLButtonElement>('[data-square="c1"]')!;

  await user.click(screen.getByRole("radio", { name: "Remove" }));
  await user.click(royal);

  const issue = screen.getByText(/White needs exactly one starting royal/).closest("li");
  expect(issue?.querySelector("a")?.getAttribute("href")).toBe("#setup-heading");
  expect((screen.getByRole("button", { name: "Open playtest" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole("group", { name: "Variant editor board" })).toBeTruthy();
});
