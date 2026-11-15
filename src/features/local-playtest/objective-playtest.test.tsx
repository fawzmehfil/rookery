import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as rules from "@rookery/rules";
import { firstFlightVariant, lastFlockStandingVariant, longWalkVariant } from "@rookery/rules/fixtures";
import { createLocalSession, type LocalSession } from "./local-session";
import { LocalPlaytest } from "./local-playtest";
import { crossroadsMoves, crossroadsVariant, lastFlockMoves, longWalkMoves } from "./objective-test-fixtures";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

type Moves = readonly (readonly [string, string])[];

describe("objective introduction", () => {
  it.each([
    [firstFlightVariant, "Capture the royal.", /capturing your opponent's royal piece/],
    [longWalkVariant, "Reach a target.", /eligible piece onto one of your own target cells/],
    [lastFlockStandingVariant, "Eliminate all opponents.", /opponent's last remaining piece/],
  ] as const)("names the objective and how to win before the first move (%#)", (variant, title, instructions) => {
    setup(variant);
    const objective = screen.getByText(title).closest("p")!;
    expect(objective.textContent).toMatch(instructions);
    expect(screen.getByText("Ply").nextElementSibling?.textContent).toBe("0");
  });

  it("shows target and remaining-piece panels only for the objectives that use them", () => {
    setup(firstFlightVariant);
    expect(screen.queryByRole("region", { name: "Targets" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Pieces remaining" })).toBeNull();
    expect(document.querySelectorAll("[data-side]")).toHaveLength(0);
  });
});

describe("reach-target", () => {
  it("marks both owners' targets on the board and explains eligibility in the panel", () => {
    const { square } = setup(longWalkVariant);

    expect(square("a3").getAttribute("aria-label")).toBe("a3, White target");
    expect(square("c1").getAttribute("aria-label")).toBe("c1, Black target");
    expect(square("a3").querySelector('[data-side="white"]')).toBeTruthy();
    expect(square("c1").querySelector('[data-side="black"]')).toBeTruthy();

    const panel = within(screen.getByRole("region", { name: "Targets" }));
    expect(panel.getByText("a3")).toBeTruthy();
    expect(panel.getByText("c1")).toBeTruthy();
    expect(panel.getByText("Corner brackets · eligible: Runner")).toBeTruthy();
    expect(panel.getByText("Dashed ring · eligible: Runner")).toBeTruthy();
  });

  it("lists several targets per player and explains unrestricted targets", () => {
    const anyPiece = {
      ...longWalkVariant,
      objectives: [{
        type: "reach-target",
        requireAction: true,
        targets: [
          { playerId: "white", cells: [{ file: 0, rank: 2 }, { file: 1, rank: 2 }] },
          { playerId: "black", cells: [{ file: 2, rank: 0 }] },
        ],
      }],
    };
    const { square } = setup(anyPiece);
    expect(square("b3").getAttribute("aria-label")).toBe("b3, White target");
    const panel = within(screen.getByRole("region", { name: "Targets" }));
    expect(panel.getByText("a3, b3")).toBeTruthy();
    expect(panel.getAllByText(/any piece can win/)).toHaveLength(2);
  });

  it("combines target, selection, and legal-move information in the cell name", async () => {
    const { user, square } = setup(crossroadsVariant);

    await user.click(square("b1"));
    expect(square("a3").getAttribute("aria-label")).toBe("a3, White target, selected piece eligible");
    expect(square("b3").getAttribute("aria-label")).toBe("b3, Black target, selected piece not eligible");
    expect(square("b2").getAttribute("aria-label")).toBe("b2, legal move");

    await user.click(square("a2"));
    expect(square("a3").getAttribute("aria-label")).toBe("a3, White target, selected piece not eligible, legal move");
    expect(square("a3").className).toMatch(/legal/);
  });

  it("wins only from the engine outcome when an eligible piece reaches its own target", async () => {
    const { user, move, square, status } = setup(longWalkVariant);

    await play(move, longWalkMoves.slice(0, 2));
    expect(screen.getByText("White to move")).toBeTruthy();

    await move("a2", "a3");
    expect(screen.getByRole("heading", { name: "White wins" })).toBeTruthy();
    expect(screen.getByText(/Victory by reaching a target: White Runner reached a3\./)).toBeTruthy();
    expect(status().textContent).toBe("White Runner moved a2 to a3. White won: White Runner reached target a3.");
    expect(events().getByText("White won: White Runner reached target a3.")).toBeTruthy();
    expect(square("a3").getAttribute("aria-label")).toBe("a3, White Runner, White target, last move");
    expect(square("c2").getAttribute("aria-disabled")).toBe("true");

    await user.click(square("c2"));
    await user.click(square("c1"));
    expect(screen.getByText("Ply").nextElementSibling?.textContent).toBe("3");
  });

  it("keeps playing when an ineligible piece or the wrong owner stands on a target", async () => {
    const { move, status } = setup(crossroadsVariant);

    await move("a2", "a3");
    expect(status().textContent).toBe("White Guard moved a2 to a3. Black to move.");
    expect(screen.queryByText(/wins/)).toBeNull();

    await play(move, crossroadsMoves.slice(1, 5));
    expect(status().textContent).toBe("White Runner moved b2 to b3. Black to move.");
    expect(screen.queryByText(/wins/)).toBeNull();

    await move("c2", "c1");
    expect(screen.getByRole("heading", { name: "Black wins" })).toBeTruthy();
    expect(screen.getByText(/Black Runner reached c1\./)).toBeTruthy();
  });

  it("completes The Long Walk with the keyboard", async () => {
    const { user, square } = setup(longWalkVariant);
    square("a1").focus();

    for (const [from, to] of longWalkMoves) {
      await keyboardTo(user, from);
      await user.keyboard("{Enter}");
      await keyboardTo(user, to);
      await user.keyboard("{Enter}");
      expect(document.activeElement).toBe(square(to));
    }

    expect(screen.getByRole("heading", { name: "White wins" })).toBeTruthy();
    expect(document.activeElement).toBe(square("a3"));
  });
});

describe("eliminate-all", () => {
  it("counts remaining pieces only from accepted engine state", async () => {
    const { user, move, square } = setup(lastFlockStandingVariant);
    expect(remaining()).toEqual({ White: "4", Black: "4" });

    await user.click(square("a1"));
    await user.click(square("b2"));
    expect(screen.getByRole("alert").textContent).toContain("ACTION_NOT_LEGAL");
    expect(remaining()).toEqual({ White: "4", Black: "4" });

    await user.click(square("a1"));
    await move("a1", "a5");
    expect(remaining()).toEqual({ White: "4", Black: "3" });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("announces the final capture, locks the board, and keeps the history", async () => {
    const { move, square, status } = setup(lastFlockStandingVariant);

    await play(move, lastFlockMoves);
    expect(remaining()).toEqual({ White: "4", Black: "0" });
    expect(screen.getByRole("heading", { name: "White wins" })).toBeTruthy();
    expect(screen.getByText(/Victory by elimination: Black Tower was Black's last piece\./)).toBeTruthy();
    expect(status().textContent).toBe(
      "White Nightrider moved e1 to a3, capturing Black Tower. White won by capturing Black Tower, Black's last piece.",
    );
    expect(events().getByText("White Chancellor moved a1 to a5.")).toBeTruthy();
    expect(events().getAllByText(/was captured/)).toHaveLength(4);
    expect(square("a3").getAttribute("aria-label")).toBe("a3, White Nightrider, last move");
    expect(square("a3").getAttribute("aria-disabled")).toBe("true");
  });

  it("completes Last Flock Standing with the keyboard", async () => {
    const { user, square } = setup(lastFlockStandingVariant);
    square("a1").focus();

    for (const [from, to] of lastFlockMoves) {
      await keyboardTo(user, from);
      await user.keyboard("{Enter}");
      await keyboardTo(user, to);
      await user.keyboard("{Enter}");
    }

    expect(screen.getByRole("heading", { name: "White wins" })).toBeTruthy();
    expect(remaining()).toEqual({ White: "4", Black: "0" });
  });
});

describe("terminal state and reset", () => {
  it.each([
    ["The Long Walk", longWalkVariant, longWalkMoves],
    ["Last Flock Standing", lastFlockStandingVariant, lastFlockMoves],
  ] as const)("resets %s to the exact initial presentation", async (_name, variant, moves) => {
    const { user, move, square, status, session } = setup(variant);
    const initialLabels = labels();

    await play(move, moves);
    await user.click(screen.getByRole("button", { name: "Reset position" }));

    expect(labels()).toEqual(initialLabels);
    expect(screen.getByText("Ply").nextElementSibling?.textContent).toBe("0");
    expect(screen.getByRole("heading", { name: "White to move" })).toBeTruthy();
    expect(status().textContent).toBe("Playtest reset to the exact validated starting position.");
    expect(screen.getByText(/Accepted moves, captures, turns, and victory/)).toBeTruthy();
    expect(square("a1").getAttribute("aria-disabled")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Reset position" }));
    expect(session.state.ply).toBe(0);
  });

  it("clears a rejection when resetting", async () => {
    const { user, square } = setup(lastFlockStandingVariant);
    await user.click(square("a1"));
    await user.click(square("b2"));
    expect(screen.getByRole("alert")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Reset position" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("controlled presentation", () => {
  it("does not infer a win from a piece standing on a target", () => {
    const session = start(longWalkVariant);
    const onTarget: LocalSession = {
      ...session,
      state: {
        ...session.state,
        pieces: session.state.pieces.map((piece) => piece.id === "white-runner" ? { ...piece, at: { file: 0, rank: 2 } } : piece),
      },
    };
    render(<LocalPlaytest initialSession={onTarget} onReturnToEditor={() => undefined} />);

    expect(screen.getByRole("heading", { name: "White to move" })).toBeTruthy();
    expect(screen.queryByText(/wins/)).toBeNull();
  });

  it("shows exactly the outcome the engine state carries", () => {
    const session = start(lastFlockStandingVariant);
    const ended: LocalSession = {
      ...session,
      state: {
        ...session.state,
        activePlayerId: null,
        outcome: { type: "win", reason: "eliminate-all", winnerPlayerId: "black", loserPlayerId: "white", capturedPieceId: "white-camel" },
      },
    };
    render(<LocalPlaytest initialSession={ended} onReturnToEditor={() => undefined} />);

    expect(screen.getByRole("heading", { name: "Black wins" })).toBeTruthy();
    expect(screen.getByText(/White Camel was White's last piece/)).toBeTruthy();
    expect(remaining()).toEqual({ White: "4", Black: "4" });
  });

  it("submits every move through the public engine API", async () => {
    const applyAction = vi.spyOn(rules, "applyAction");
    const { move } = setup(longWalkVariant);

    await play(move, longWalkMoves);

    expect(applyAction).toHaveBeenCalledTimes(3);
    expect(screen.getByRole("heading", { name: "White wins" })).toBeTruthy();
  });
});

function start(variant: unknown): LocalSession {
  const result = createLocalSession(variant);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

function setup(variant: unknown) {
  const session = start(variant);
  const user = userEvent.setup();
  render(<LocalPlaytest initialSession={session} onReturnToEditor={() => undefined} />);
  const board = screen.getByRole("group", { name: `${session.variant.name} playtest board` });
  const square = (name: string) => board.querySelector<HTMLButtonElement>(`[data-square="${name}"]`)!;
  const move = async (from: string, to: string) => {
    await user.click(square(from));
    await user.click(square(to));
  };
  const status = () => screen.getByRole("status");
  return { user, board, square, move, status, session };
}

async function play(move: (from: string, to: string) => Promise<void>, moves: Moves) {
  for (const [from, to] of moves) await move(from, to);
}

function events() {
  return within(screen.getByRole("region", { name: "Accepted events" }));
}

function remaining(): Record<string, string> {
  const list = screen.getByRole("region", { name: "Pieces remaining" });
  return Object.fromEntries([...list.querySelectorAll("div")].map((entry) => [
    entry.querySelector("dt")?.textContent ?? "",
    entry.querySelector("dd")?.textContent ?? "",
  ]));
}

function labels(): string[] {
  return [...document.querySelectorAll<HTMLButtonElement>("[data-square]")].map((square) => square.getAttribute("aria-label") ?? "");
}

async function keyboardTo(user: UserEvent, target: string) {
  const current = (document.activeElement as HTMLElement).dataset.square;
  if (!current) throw new Error("A board square must have focus");
  const dx = target.charCodeAt(0) - current.charCodeAt(0);
  const dy = Number(target.slice(1)) - Number(current.slice(1));
  if (dx) await user.keyboard((dx > 0 ? "{ArrowRight}" : "{ArrowLeft}").repeat(Math.abs(dx)));
  if (dy) await user.keyboard((dy > 0 ? "{ArrowUp}" : "{ArrowDown}").repeat(Math.abs(dy)));
}
