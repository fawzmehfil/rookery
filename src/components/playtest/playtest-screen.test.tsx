import { cleanup, render, screen } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseSquare } from "@/components/board-surface";
import { createScriptedSession, SCHOLARS_MATE } from "./fixtures/scripted-session";
import { PlaytestScreen } from "./playtest-screen";
import type { PlaytestSession } from "./session";

afterEach(cleanup);

function setup(session: PlaytestSession = createScriptedSession()) {
  const user = userEvent.setup();
  const onExit = vi.fn();
  render(<PlaytestScreen session={session} onExit={onExit} />);
  const square = (name: string) => document.querySelector<HTMLButtonElement>(`[data-square="${name}"]`)!;
  const label = (name: string) => square(name).getAttribute("aria-label");
  const move = async (from: string, to: string) => {
    await user.click(square(from));
    await user.click(square(to));
  };
  return { user, session, onExit, square, label, move };
}

/** Walks keyboard focus to a square with the arrow keys and presses Enter. */
async function keyboardActivate(user: UserEvent, target: string) {
  const current = (document.activeElement as HTMLElement).dataset.square!;
  const from = parseSquare(current);
  const to = parseSquare(target);
  const horizontal = to.file > from.file ? "{ArrowRight}" : "{ArrowLeft}";
  const vertical = to.rank > from.rank ? "{ArrowUp}" : "{ArrowDown}";
  await user.keyboard(horizontal.repeat(Math.abs(to.file - from.file)) + vertical.repeat(Math.abs(to.rank - from.rank)));
  await user.keyboard("{Enter}");
}

describe("playtest screen", () => {
  it("starts from the session's state", () => {
    setup();
    expect(screen.getByRole("heading", { name: "Standard Chess" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("White to move");
    expect(screen.getByText("Turn").nextElementSibling?.textContent).toBe("1");
  });

  it("highlights exactly the legal actions the session reports", async () => {
    const { user, square, label, session } = setup();
    const legalActions = vi.spyOn(session, "legalActions");

    await user.click(square("e2"));
    expect(legalActions).toHaveBeenCalledWith("e2");
    expect(label("e4")).toBe("e4, legal move");
    expect(label("e3")).toBe("e3");
  });

  it("plays a move, changes the turn and clears the selection", async () => {
    const { move, label } = setup();
    await move("e2", "e4");

    expect(label("e4")).toBe("e4, white pawn, last move");
    expect(label("e2")).toBe("e2, last move");
    expect(screen.getByRole("status").textContent).toBe("Black to move");
    expect(document.querySelector('[aria-pressed="true"]')).toBeNull();
  });

  it("rejects an illegal move in plain language and leaves the board unchanged", async () => {
    const { move, label, session } = setup();
    const before = session.snapshot();

    await move("e2", "e5");

    expect(screen.getByRole("alert").textContent).toBe("That move isn't allowed in this position.");
    expect(session.snapshot()).toBe(before);
    expect(label("e2")).toBe("e2, white pawn");
    expect(label("e5")).toBe("e5");
    expect(screen.getByRole("status").textContent).toBe("White to move");
  });

  it("explains when the wrong side tries to move", async () => {
    const { user, square } = setup();
    await user.click(square("e7"));
    expect(screen.getByRole("alert").textContent).toBe("It's the other player's turn.");
  });

  it("never shows a move the session hasn't confirmed", async () => {
    const session = createScriptedSession();
    const { user, square, label } = setup({
      ...session,
      legalActions: session.legalActions,
      submit: () => ({ ok: false, error: { code: "invalid-state", message: "corrupt" } }),
    });

    await user.click(square("e2"));
    await user.click(square("e4"));

    expect(label("e4")).toBe("e4");
    expect(screen.getByRole("alert").textContent).toBe("The game reached a state it can't continue from. Reset to start again.");
  });

  it("reports captures and the win, then blocks further input", async () => {
    const { move, label, square, session } = setup();
    for (const ply of SCHOLARS_MATE) await move(ply.from, ply.to);

    expect(screen.getByText(/Black pawn captured on f7/)).toBeTruthy();
    expect(screen.getByText(/Black is in check/)).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("White wins by checkmate");
    expect(label("e8")).toBe("e8, black king, in check");

    const submit = vi.spyOn(session, "submit");
    await userEvent.click(square("e7"));
    await userEvent.click(square("e6"));
    expect(submit).not.toHaveBeenCalled();
    expect(square("e7").getAttribute("aria-disabled")).toBe("true");
  });

  it("resets to the variant's initial state", async () => {
    const { user, move, label } = setup();
    await move("e2", "e4");
    await move("e7", "e5");

    await user.click(screen.getByRole("button", { name: "Reset" }));

    expect(label("e2")).toBe("e2, white pawn");
    expect(label("e4")).toBe("e4");
    expect(screen.getByRole("status").textContent).toBe("White to move");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("Captures and checks will appear here.")).toBeTruthy();
  });

  it("calls onExit from the exit control", async () => {
    const { user, onExit } = setup();
    await user.click(screen.getByRole("button", { name: "Exit playtest" }));
    expect(onExit).toHaveBeenCalledOnce();
  });

  it("can play the whole sequence with only the keyboard", async () => {
    const { user } = setup();
    await user.tab();
    expect((document.activeElement as HTMLElement).dataset.square).toBe("a1");

    for (const ply of SCHOLARS_MATE) {
      await keyboardActivate(user, ply.from);
      await keyboardActivate(user, ply.to);
    }

    expect(screen.getByRole("status").textContent).toBe("White wins by checkmate");
  });
});
