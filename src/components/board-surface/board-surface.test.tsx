import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BoardSurface } from "./board-surface";
import type { BoardPiece, BoardSurfaceProps } from "./types";

afterEach(cleanup);

const pieces: BoardPiece[] = [
  { id: "w-king", square: "e1", kind: "king", side: "white" },
  { id: "w-knight", square: "g1", kind: "knight", side: "white" },
  { id: "b-pawn", square: "d5", kind: "pawn", side: "black" },
];

function renderBoard(props: Partial<BoardSurfaceProps> = {}) {
  const onSquareActivate = vi.fn();
  const result = render(
    <BoardSurface files={8} ranks={8} pieces={pieces} label="Test board" onSquareActivate={onSquareActivate} {...props} />,
  );
  const board = screen.getByRole("group", { name: "Test board" });
  const square = (name: string) => board.querySelector<HTMLButtonElement>(`[data-square="${name}"]`)!;
  return { ...result, board, square, onSquareActivate };
}

describe("rendering", () => {
  it("draws every square of an 8×8 board", () => {
    const { board } = renderBoard();
    expect(within(board).getAllByRole("button")).toHaveLength(64);
  });

  it("draws non-square boards with the right reading order", () => {
    const { board } = renderBoard({ files: 6, ranks: 5, pieces: [] });
    const squares = within(board).getAllByRole("button").map((button) => button.dataset.square);
    expect(squares).toHaveLength(30);
    expect(squares.slice(0, 6)).toEqual(["a5", "b5", "c5", "d5", "e5", "f5"]);
    expect(squares.at(-1)).toBe("f1");
  });

  it("reverses the board when black is at the bottom", () => {
    const { board } = renderBoard({ orientation: "black" });
    const squares = within(board).getAllByRole("button").map((button) => button.dataset.square);
    expect(squares[0]).toBe("h1");
    expect(squares.at(-1)).toBe("a8");
  });

  it("names squares by coordinate and piece", () => {
    renderBoard();
    expect(screen.getByRole("button", { name: "g1, white knight" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "d4" })).toBeTruthy();
  });

  it("ignores pieces placed off the board", () => {
    const { container } = renderBoard({ files: 4, ranks: 4, pieces });
    expect(container.querySelectorAll("svg")).toHaveLength(0);
  });
});

describe("controlled highlights", () => {
  it("shows exactly the states it's given and follows prop changes", () => {
    const { rerender, square } = renderBoard({
      selectedSquare: "g1",
      legalDestinations: ["f3", "h3"],
      captureDestinations: ["d5"],
      lastMove: { from: "d7", to: "d5" },
    });

    expect(square("g1").getAttribute("aria-pressed")).toBe("true");
    expect(square("f3").getAttribute("aria-label")).toBe("f3, legal move");
    expect(square("d5").getAttribute("aria-label")).toBe("d5, black pawn, capture, last move");
    expect(square("e2").getAttribute("aria-label")).toBe("e2");

    rerender(<BoardSurface files={8} ranks={8} pieces={pieces} label="Test board" selectedSquare={null} />);
    expect(square("g1").getAttribute("aria-pressed")).toBe("false");
    expect(square("f3").getAttribute("aria-label")).toBe("f3");
  });

  it("marks checks and removed cells", () => {
    const { square } = renderBoard({ checkSquares: ["e1"], disabledSquares: ["a1"] });
    expect(square("e1").getAttribute("aria-label")).toBe("e1, white king, in check");
    expect(square("a1").getAttribute("aria-label")).toBe("a1, not part of the board");
    expect(square("a1").getAttribute("aria-disabled")).toBe("true");
  });
});

describe("activation", () => {
  it("reports pointer activation with the square and its piece", async () => {
    const { square, onSquareActivate } = renderBoard();
    await userEvent.click(square("g1"));
    expect(onSquareActivate).toHaveBeenCalledWith({ square: "g1", piece: pieces[1], input: "pointer" });

    await userEvent.click(square("f3"));
    expect(onSquareActivate).toHaveBeenLastCalledWith({ square: "f3", piece: null, input: "pointer" });
  });

  it("moves focus with the arrow keys and activates with Enter or Space", async () => {
    const user = userEvent.setup();
    const { square, onSquareActivate } = renderBoard();

    square("g1").focus();
    await user.keyboard("{ArrowUp}{ArrowUp}{ArrowLeft}");
    expect(document.activeElement).toBe(square("f3"));

    await user.keyboard("{Enter}");
    expect(onSquareActivate).toHaveBeenCalledWith({ square: "f3", piece: null, input: "keyboard" });

    await user.keyboard(" ");
    expect(onSquareActivate).toHaveBeenCalledTimes(2);
  });

  it("follows the screen when the board is flipped", async () => {
    const user = userEvent.setup();
    const { square } = renderBoard({ orientation: "black" });
    square("e4").focus();
    await user.keyboard("{ArrowUp}{ArrowRight}");
    expect(document.activeElement).toBe(square("d3"));
  });

  it("stops at the board edge", async () => {
    const user = userEvent.setup();
    const { square } = renderBoard();
    square("a8").focus();
    await user.keyboard("{ArrowUp}{ArrowLeft}");
    expect(document.activeElement).toBe(square("a8"));
  });

  it("blocks activation when disabled but keeps squares readable", async () => {
    const user = userEvent.setup();
    const { square, onSquareActivate } = renderBoard({ disabled: true });
    await user.click(square("g1"));
    square("g1").focus();
    await user.keyboard("{Enter}");
    expect(onSquareActivate).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(square("g1"));
  });

  it("never activates removed cells", async () => {
    const { square, onSquareActivate } = renderBoard({ disabledSquares: ["c3"] });
    await userEvent.click(square("c3"));
    expect(onSquareActivate).not.toHaveBeenCalled();
  });
});

describe("focus", () => {
  it("keeps a single tab stop that starts on the selection", () => {
    const { board, square } = renderBoard({ selectedSquare: "g1" });
    const tabbable = within(board)
      .getAllByRole("button")
      .filter((button) => button.tabIndex === 0);
    expect(tabbable).toEqual([square("g1")]);
  });

  it("is reachable with Tab", async () => {
    const user = userEvent.setup();
    const { square } = renderBoard();
    await user.tab();
    expect(document.activeElement).toBe(square("a1"));
  });
});
