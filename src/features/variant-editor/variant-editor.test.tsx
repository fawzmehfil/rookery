import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { firstFlightVariant } from "@rookery/rules/fixtures";
import { VariantEditor } from "./variant-editor";

afterEach(cleanup);
const board = () => screen.getByRole("group", { name: "Variant editor board" });
const square = (name: string) => board().querySelector<HTMLButtonElement>(`[data-square="${name}"]`)!;

it("moves a piece with pointer input and hands off the exact validated definition", async () => {
  const user = userEvent.setup(); const handoff = vi.fn();
  render(<VariantEditor onPlaytest={handoff} />);
  await user.click(square("a1")); await user.click(square("a2"));
  expect(square("a2").getAttribute("aria-label")).toContain("White Tower");
  await user.click(screen.getByRole("button", { name: "Open playtest" }));
  expect(handoff).toHaveBeenCalledWith({ ...firstFlightVariant, setup: firstFlightVariant.setup.map(p => p.id === "white-tower" ? { ...p, at: { file: 0, rank: 1 } } : p) });
});

it("uses arrow keys, Enter and Space for placement, replacement and removal", async () => {
  const user = userEvent.setup(); render(<VariantEditor />);
  await user.click(screen.getByRole("radio", { name: "Place" }));
  square("b2").focus(); await user.keyboard("{Enter}");
  expect(square("b2").getAttribute("aria-label")).toContain("White Sovereign");
  await user.selectOptions(screen.getByLabelText("Palette piece"), "hopper");
  await user.click(screen.getByRole("radio", { name: "Replace" }));
  square("b2").focus(); await user.keyboard(" ");
  expect(square("b2").getAttribute("aria-label")).toContain("White Hopper");
  await user.click(screen.getByRole("radio", { name: "Select / move" }));
  square("b2").focus(); await user.keyboard("{Enter}{ArrowUp}{Enter}");
  expect(square("b3").getAttribute("aria-label")).toContain("White Hopper");
  await user.keyboard("{Escape}");
  expect(screen.getByRole("status").textContent).toBe("Selection cleared.");
  await user.click(screen.getByRole("radio", { name: "Remove" }));
  square("b3").focus(); await user.keyboard("{Enter}");
  expect(square("b3").getAttribute("aria-label")).toBe("b3");
});

it("does not resize destructively until separately confirmed and supports cancellation", async () => {
  const user = userEvent.setup(); render(<VariantEditor />);
  fireEvent.change(screen.getByLabelText("Files (columns)"), { target: { value: "3" } });
  await user.click(screen.getByRole("button", { name: "Apply board size" }));
  expect(screen.getByRole("alert", { name: "Destructive resize confirmation" }).textContent).toContain("2 piece(s)");
  expect(within(board()).getAllByRole("button")).toHaveLength(25);
  await user.click(screen.getByRole("button", { name: "Cancel resize" }));
  expect(within(board()).getAllByRole("button")).toHaveLength(25);
  await user.click(screen.getByRole("button", { name: "Apply board size" }));
  await user.click(screen.getByRole("button", { name: "Confirm resize and remove" }));
  expect(within(board()).getAllByRole("button")).toHaveLength(15);
});

it("shows disabled cells, rejects overlap, and keeps invalid drafts for correction", async () => {
  const user = userEvent.setup(); const handoff = vi.fn();
  render(<VariantEditor onPlaytest={handoff} initialVariant={{ ...firstFlightVariant, board: { ...firstFlightVariant.board, disabledCells: [{ file: 1, rank: 1 }] } }} />);
  await user.click(screen.getByRole("radio", { name: "Place" }));
  await user.click(square("b2")); expect(square("b2").getAttribute("aria-label")).toContain("not part of the board");
  await user.click(square("a1")); expect(screen.getByRole("status").textContent).toContain("occupied");
  await user.click(screen.getByRole("radio", { name: "Remove" }));
  await user.click(square("c1"));
  expect(screen.getByText(/White needs exactly one starting royal/)).toBeTruthy();
  expect((screen.getByRole("button", { name: "Open playtest" }) as HTMLButtonElement).disabled).toBe(true);
  expect(handoff).not.toHaveBeenCalled();
  await user.click(screen.getByRole("radio", { name: "Place" })); await user.click(square("c1"));
  expect((screen.getByRole("button", { name: "Open playtest" }) as HTMLButtonElement).disabled).toBe(false);
});

it("edits a rule without overwriting another type and rejects zero vectors locally", async () => {
  const user = userEvent.setup(); render(<VariantEditor />);
  await user.selectOptions(screen.getByLabelText("Piece type to edit"), "tower");
  await user.selectOptions(screen.getByLabelText("Rule to edit"), "0");
  await user.selectOptions(screen.getByLabelText("Direction frame"), "owner");
  expect(screen.getByText(/Forward follows the owner's direction/)).toBeTruthy();
  await user.selectOptions(screen.getByLabelText("Piece type to edit"), "hopper");
  expect((screen.getByLabelText("Direction frame") as HTMLSelectElement).value).toBe("board");
  await user.selectOptions(screen.getByLabelText("Piece type to edit"), "tower");
  await user.selectOptions(screen.getByLabelText("Rule to edit"), "0");
  expect((screen.getByLabelText("Direction frame") as HTMLSelectElement).value).toBe("owner");
  await user.click(screen.getByText("Advanced: edit movement vectors"));
  fireEvent.change(screen.getByLabelText("Across 1.1"), { target: { value: "0" } });
  fireEvent.change(screen.getByLabelText("Forward 1.1"), { target: { value: "0" } });
  expect(screen.getByRole("alert").textContent).toContain("cannot be zero");
  expect(screen.getByText(/Rule 1 needs correction in Advanced/)).toBeTruthy();
});
