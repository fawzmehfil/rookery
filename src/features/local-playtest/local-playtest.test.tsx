import { cleanup, render, screen } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { coordinateToSquare, type Coordinate } from "@rookery/rules";
import { firstFlightDemonstration, firstFlightVariant } from "@rookery/rules/fixtures";
import { createLocalSession } from "./local-session";
import { LocalPlaytest } from "./local-playtest";

afterEach(cleanup);

describe("local playtest", () => {
  it("highlights exactly the selected piece's engine-provided legal and capture targets", async () => {
    const { user, square } = setup();

    await user.click(square("a1"));

    expect(square("a2").getAttribute("aria-label")).toContain("legal move");
    expect(square("a3").getAttribute("aria-label")).toContain("legal move");
    expect(square("a4").getAttribute("aria-label")).toContain("legal move");
    expect(square("a5").getAttribute("aria-label")).toContain("capture");
    expect(square("b2").getAttribute("aria-label")).not.toContain("legal move");
  });

  it("renders a structured illegal-action error and leaves authoritative state unchanged", async () => {
    const { user, square } = setup();

    await user.click(square("a1"));
    await user.click(square("b2"));

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("ACTION_NOT_LEGAL");
    expect(alert.textContent).toContain("The proposed action is not legal");
    expect(square("a1").getAttribute("aria-label")).toContain("White Tower");
    expect(screen.getByText("Ply").nextElementSibling?.textContent).toBe("0");
    expect(screen.getByText("White to move")).toBeTruthy();
  });

  it("updates the board, events, ply, turn, and active player exactly once", async () => {
    const { move, square } = setup();

    await move("a1", "a4");

    expect(square("a4").getAttribute("aria-label")).toContain("White Tower");
    expect(square("a1").getAttribute("aria-label")).not.toContain("White Tower");
    expect(screen.getByText("Ply").nextElementSibling?.textContent).toBe("1");
    expect(screen.getByText("Black to move")).toBeTruthy();
    expect(screen.getByText(/White Tower moved a1 to a4/)).toBeTruthy();
    expect(screen.getByText(/Turn changed to Black/)).toBeTruthy();
    expect(document.querySelectorAll('[aria-pressed="true"]')).toHaveLength(0);
  });

  it("completes First Flight, removes only captures, blocks input, and resets exactly", async () => {
    const { user, move, square } = setup();

    for (const action of firstFlightDemonstration) {
      const piece = firstFlightVariant.setup.find(({ id }) => id === action.pieceId);
      const current = document.querySelector<HTMLButtonElement>(`[aria-label*="${piece?.ownerId === "white" ? "White" : "Black"} ${pieceTypeName(action.pieceId)}"]`);
      if (!current) throw new Error(`Could not find ${action.pieceId}`);
      await move(current.dataset.square!, coordinateToSquare(action.to));
    }

    expect(screen.getByText("White wins")).toBeTruthy();
    expect(screen.getByText(/Victory by capturing the opposing royal/)).toBeTruthy();
    expect(screen.getByText("Black Hopper")).toBeTruthy();
    expect(screen.getByText("Black Sovereign")).toBeTruthy();
    expect(document.querySelector('[aria-label*="Black Sovereign"]')).toBeNull();
    expect(square("a1").getAttribute("aria-disabled")).toBe("true");

    await user.click(screen.getByRole("button", { name: "Reset position" }));
    expect(screen.getByText("Ply").nextElementSibling?.textContent).toBe("0");
    expect(screen.getByText("White to move")).toBeTruthy();
    expect(square("a1").getAttribute("aria-label")).toContain("White Tower");
    expect(square("c5").getAttribute("aria-label")).toContain("Black Sovereign");
    expect(screen.getByText("No pieces captured yet.")).toBeTruthy();
    expect(screen.getByText(/Accepted moves, captures, turns, and victory/)).toBeTruthy();
  });

  it("supports the complete canonical flow with keyboard board input", async () => {
    const { user, square } = setup();
    square("a1").focus();

    for (const action of firstFlightDemonstration) {
      const piece = firstFlightVariant.setup.find(({ id }) => id === action.pieceId);
      const current = document.querySelector<HTMLButtonElement>(`[aria-label*="${piece?.ownerId === "white" ? "White" : "Black"} ${pieceTypeName(action.pieceId)}"]`);
      if (!current) throw new Error(`Could not find ${action.pieceId}`);
      await keyboardActivate(user, current.dataset.square!);
      await user.keyboard("{Enter}");
      await keyboardActivate(user, coordinateToSquare(action.to));
      await user.keyboard("{Enter}");
    }

    expect(screen.getByText("White wins")).toBeTruthy();
    expect(screen.getByText("Ply").nextElementSibling?.textContent).toBe("9");
  });
});

function setup() {
  const result = createLocalSession(firstFlightVariant);
  if (!result.ok) throw new Error(result.error.code);
  const user = userEvent.setup();
  render(<LocalPlaytest initialSession={result.value} onReturnToEditor={() => undefined} />);
  const board = screen.getByRole("group", { name: "First Flight playtest board" });
  const square = (name: string) => board.querySelector<HTMLButtonElement>(`[data-square="${name}"]`)!;
  const move = async (from: string, to: string) => {
    await user.click(square(from));
    await user.click(square(to));
  };
  return { user, board, square, move };
}

async function keyboardActivate(user: UserEvent, target: string) {
  const currentName = (document.activeElement as HTMLElement).dataset.square;
  if (!currentName) throw new Error("A board square must have focus");
  const current = parse(currentName);
  const destination = parse(target);
  const horizontal = destination.file > current.file ? "{ArrowRight}" : "{ArrowLeft}";
  const vertical = destination.rank > current.rank ? "{ArrowUp}" : "{ArrowDown}";
  const horizontalSteps = Math.abs(destination.file - current.file);
  const verticalSteps = Math.abs(destination.rank - current.rank);
  if (horizontalSteps > 0) await user.keyboard(horizontal.repeat(horizontalSteps));
  if (verticalSteps > 0) await user.keyboard(vertical.repeat(verticalSteps));
}

function parse(square: string): Coordinate {
  return { file: square.charCodeAt(0) - 97, rank: Number(square.slice(1)) - 1 };
}

function pieceTypeName(pieceId: string): string {
  if (pieceId.includes("tower")) return "Tower";
  if (pieceId.includes("hopper")) return "Hopper";
  return "Sovereign";
}
