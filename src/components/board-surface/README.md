# Board surface

`BoardSurface` draws a board and reports which square was activated. It's shared by the variant editor and the playtest screen, so it holds no game rules and no editor, engine, session or network logic. The wrapper decides what an activation means and passes the resulting state back in as props.

```tsx
import { BoardSurface, type SquareActivation } from "@/components/board-surface";

function PlaytestBoard({ view, onActivate }: Props) {
  return (
    <BoardSurface
      files={view.files}
      ranks={view.ranks}
      pieces={view.pieces}
      label="Playtest board"
      selectedSquare={view.selected}
      legalDestinations={view.moves}
      captureDestinations={view.captures}
      lastMove={view.lastMove}
      checkSquares={view.checks}
      disabled={view.isOver}
      onSquareActivate={(activation: SquareActivation) => onActivate(activation)}
    />
  );
}
```

A live example of every state is at `/dev/board-surface` while running `npm run dev`.

## Props

| Prop | Type | Notes |
| --- | --- | --- |
| `files`, `ranks` | `number` | Board dimensions. Up to 26 files. |
| `pieces` | `readonly BoardPiece[]` | `{ id, square, kind, side, label? }`. `id` must stay the same when a piece moves; it's the React key and drives the move animation. Pieces off the board are ignored. |
| `label` | `string` | Accessible name for the board. |
| `orientation` | `"white" \| "black"` | Side drawn at the bottom. Default `"white"`. |
| `selectedSquare` | `BoardSquare \| null` | |
| `legalDestinations` | `readonly BoardSquare[]` | Drawn as a centre dot. |
| `captureDestinations` | `readonly BoardSquare[]` | Drawn as corner wedges. |
| `lastMove` | `{ from, to } \| null` | Tinted with a dashed inset. |
| `checkSquares` | `readonly BoardSquare[]` | Radial warning burst. |
| `disabledSquares` | `readonly BoardSquare[]` | Cells that aren't part of the board. Hatched and never activated. |
| `disabled` | `boolean` | Blocks all activation (e.g. game over). Squares stay focusable so the position can still be read. |
| `coordinates` | `boolean` | Edge labels. Default `true`. |
| `onSquareActivate` | `(activation: SquareActivation) => void` | `{ square, piece, input: "pointer" \| "keyboard" }`. |
| `renderPiece` | `(piece) => ReactNode \| undefined` | Custom art. Return `undefined` to fall back to the built-in set; unknown kinds get a lettered token. |

Squares are algebraic names (`"a1"` is bottom-left from white's side).

## Keyboard

The board is a single tab stop. Arrow keys move around the board following the screen, so they flip along with it. Enter or Space activates the focused square. Each square's accessible name includes its coordinate, the piece on it and any state, for example `"d5, black pawn, capture, last move"`.

## Theming

Colours are custom properties on the board's root (`--board-light`, `--board-dark`, `--board-move`, `--board-check`, …). Override them from a parent class to re-theme it.

## Open questions for the editor

- Should removed cells (`disabledSquares`) still emit activations, so the editor can toggle them back on? They currently don't.
- Does placement from a palette need drag-and-drop onto the board, or is click-to-place enough for the PoC?
