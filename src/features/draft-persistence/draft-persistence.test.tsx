import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { VariantDefinition } from "@rookery/rules";
import { firstFlightVariant, lastFlockStandingVariant, longWalkVariant } from "@rookery/rules/fixtures";
import { VariantWorkshop } from "@/features/variant-workshop/variant-workshop";
import { DRAFT_STORAGE_KEY, exportDraft, MAX_IMPORT_BYTES } from "./envelope";
import { createDraftRepository, type DraftRepository, type LoadResult } from "./repository";
import { createMemoryDraftStorage, type DraftStorage } from "./storage";
import { AUTOSAVE_DELAY_MS } from "./use-draft-persistence";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** jsdom has no object URLs; capture each downloaded Blob and file name instead of navigating. */
function captureDownloads() {
  const files: { name: string; blob: Blob }[] = [];
  let pending: Blob | null = null;
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn((blob: Blob) => {
      pending = blob;
      return "blob:rookery-test";
    }),
  });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    if (pending) files.push({ name: this.download, blob: pending });
    pending = null;
  });
  return files;
}

/** jsdom's Blob has no text(); FileReader is available. */
function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

const clock = () => new Date("2026-11-14T17:04:00.000Z");

/** Renders the real workshop over an in-memory store, then switches to fake timers for the debounce. */
async function openWorkshop(storage: DraftStorage = createMemoryDraftStorage()) {
  // Re-spying returns the existing spy after a simulated refresh, so start each mount from zero writes.
  const write = vi.spyOn(storage, "write");
  write.mockClear();
  render(<VariantWorkshop repository={createDraftRepository(storage, clock)} />);
  await screen.findByRole("group", { name: "Variant editor board" });
  vi.useFakeTimers();
  return { storage, write };
}

/** Simulates a page refresh: unmount, then mount a new workshop and repository over the same storage. */
async function refresh(storage: DraftStorage) {
  cleanup();
  vi.useRealTimers();
  return openWorkshop(storage);
}

const board = () => screen.getByRole("group", { name: "Variant editor board" });
const squareCount = () => within(board()).getAllByRole("button").length;
const saveStatus = () => within(screen.getByRole("region", { name: "Your draft" })).getByRole("status").textContent ?? "";
const editorMessage = () => screen.getAllByRole("status").map((node) => node.textContent ?? "").join(" | ");
const storedVariant = (storage: DraftStorage) =>
  (JSON.parse(storage.read(DRAFT_STORAGE_KEY) ?? "null") as { variant: VariantDefinition } | null)?.variant;

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

function resizeFiles(files: number) {
  fireEvent.change(screen.getByLabelText("Files (columns)"), { target: { value: String(files) } });
  fireEvent.click(screen.getByRole("button", { name: "Apply board size" }));
}

function removeWhiteRoyal() {
  fireEvent.click(screen.getByRole("radio", { name: "Remove" }));
  fireEvent.click(board().querySelector<HTMLButtonElement>('[data-square="c1"]')!);
}

async function confirmReset() {
  fireEvent.click(screen.getByRole("button", { name: "Reset draft" }));
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Confirm reset to First Flight" }));
  });
}

it("shows a restoring state, not an editable board, until recovery finishes", async () => {
  let resolveLoad: (result: LoadResult) => void = () => {};
  const repository: DraftRepository = {
    ...createDraftRepository(createMemoryDraftStorage(), clock),
    load: () => new Promise<LoadResult>((resolve) => { resolveLoad = resolve; }),
  };

  render(<VariantWorkshop repository={repository} />);

  expect(screen.getByRole("status").textContent).toBe("Restoring your draft…");
  expect(screen.queryByRole("group", { name: "Variant editor board" })).toBeNull();

  await act(async () => resolveLoad({ status: "restored", variant: longWalkVariant, savedAt: null }));

  expect(within(board()).getAllByRole("button")).toHaveLength(9);
  expect(screen.getByRole("heading", { level: 2, name: "The Long Walk" })).toBeTruthy();
});

it("writes nothing on first load", async () => {
  const { storage, write } = await openWorkshop();

  await advance(AUTOSAVE_DELAY_MS * 5);

  expect(write).not.toHaveBeenCalled();
  expect(storage.read(DRAFT_STORAGE_KEY)).toBeNull();
  expect(saveStatus()).toBe("Autosave is on. Valid changes save in this browser.");
});

it("debounces autosave, writes once, and skips unchanged drafts", async () => {
  const { storage, write } = await openWorkshop();

  resizeFiles(6);
  expect(saveStatus()).toBe("Saving…");
  await advance(AUTOSAVE_DELAY_MS - 1);
  expect(write).not.toHaveBeenCalled();

  await advance(1);
  expect(write).toHaveBeenCalledTimes(1);
  expect(storedVariant(storage)?.board.files).toBe(6);
  expect(saveStatus()).toContain("Saved in this browser at");

  resizeFiles(6);
  await advance(AUTOSAVE_DELAY_MS * 5);
  expect(write).toHaveBeenCalledTimes(1);
});

it("restores the last saved draft after a refresh", async () => {
  const { storage } = await openWorkshop();
  resizeFiles(6);
  await advance(AUTOSAVE_DELAY_MS);

  const { write } = await refresh(storage);

  expect(squareCount()).toBe(30);
  expect(editorMessage()).toContain("Restored your draft saved at");
  expect(saveStatus()).toContain("Saved in this browser at");
  await advance(AUTOSAVE_DELAY_MS * 5);
  expect(write).not.toHaveBeenCalled();
});

it("does not save an invalid draft and keeps the last valid copy", async () => {
  const { storage, write } = await openWorkshop();
  resizeFiles(6);
  await advance(AUTOSAVE_DELAY_MS);

  removeWhiteRoyal();
  await advance(AUTOSAVE_DELAY_MS);

  expect(write).toHaveBeenCalledTimes(1);
  expect(saveStatus()).toMatch(/^Not saved: resolve \d+ issues?\. Last valid draft kept/);
  expect(storedVariant(storage)?.setup.some(({ id }) => id === "white-sovereign")).toBe(true);

  await refresh(storage);
  expect(board().querySelector('[data-square="c1"]')?.getAttribute("aria-label")).toContain("White Sovereign");
});

it("flushes a pending save when the page is hidden", async () => {
  const { storage, write } = await openWorkshop();
  resizeFiles(6);

  await act(async () => {
    window.dispatchEvent(new Event("pagehide"));
  });

  expect(write).toHaveBeenCalledTimes(1);
  expect(storedVariant(storage)?.board.files).toBe(6);
});

it("saves before playtest, stores no game state, and returns to the same draft", async () => {
  const { storage, write } = await openWorkshop();
  resizeFiles(6);

  fireEvent.click(screen.getByRole("button", { name: "Open playtest" }));

  expect(write).toHaveBeenCalledTimes(1);
  const stored = storage.read(DRAFT_STORAGE_KEY) ?? "";
  for (const key of ["ply", "activePlayerId", "pieces", "history", "outcome", "events"]) {
    expect(stored).not.toContain(`"${key}"`);
  }

  fireEvent.click(screen.getByRole("button", { name: "Return to editor" }));
  await advance(AUTOSAVE_DELAY_MS * 5);

  expect(squareCount()).toBe(30);
  expect(editorMessage()).toContain("Back from playtest. Your draft is unchanged.");
  expect(write).toHaveBeenCalledTimes(1);
});

it("cancels reset without changes, and confirmed reset clears storage and loads First Flight", async () => {
  const { storage, write } = await openWorkshop();
  resizeFiles(6);
  await advance(AUTOSAVE_DELAY_MS);
  const saved = storage.read(DRAFT_STORAGE_KEY);

  fireEvent.click(screen.getByRole("button", { name: "Reset draft" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel replacement" }));
  expect(storage.read(DRAFT_STORAGE_KEY)).toBe(saved);
  expect(squareCount()).toBe(30);

  await confirmReset();

  expect(storage.read(DRAFT_STORAGE_KEY)).toBeNull();
  expect(squareCount()).toBe(25);
  expect(editorMessage()).toContain("Reset to First Flight. The saved draft was cleared.");
  expect(saveStatus()).toBe("Autosave is on. Valid changes save in this browser.");
  await advance(AUTOSAVE_DELAY_MS * 5);
  expect(write).toHaveBeenCalledTimes(1);
});

it("explains a failed recovery, preserves the raw value, and offers download and reset", async () => {
  const storage = createMemoryDraftStorage({ initial: { [DRAFT_STORAGE_KEY]: "{oops" } });
  const { write } = await openWorkshop(storage);

  const alert = screen.getByRole("alert", { name: "Your saved draft could not be restored" });
  expect(document.activeElement).toBe(alert);
  expect(alert.textContent).toContain("ENVELOPE_MALFORMED");
  expect(within(alert).getByRole("button", { name: "Download stored data" })).toBeTruthy();
  expect(squareCount()).toBe(25);

  await advance(AUTOSAVE_DELAY_MS * 5);
  expect(write).not.toHaveBeenCalled();
  expect(storage.read(DRAFT_STORAGE_KEY)).toBe("{oops");

  fireEvent.click(within(alert).getByRole("button", { name: "Reset saved draft" }));
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Confirm reset to First Flight" }));
  });

  expect(storage.read(DRAFT_STORAGE_KEY)).toBeNull();
  expect(screen.queryByRole("alert", { name: "Your saved draft could not be restored" })).toBeNull();
});

it("replaces an unrecoverable stored value only after the first edit", async () => {
  const storage = createMemoryDraftStorage({ initial: { [DRAFT_STORAGE_KEY]: "[1,2,3]" } });
  const { write } = await openWorkshop(storage);

  resizeFiles(6);
  await advance(AUTOSAVE_DELAY_MS);

  expect(write).toHaveBeenCalledTimes(1);
  expect(storedVariant(storage)?.board.files).toBe(6);
  expect(screen.queryByRole("alert", { name: "Your saved draft could not be restored" })).toBeNull();
});

it("keeps editing when browser storage is unavailable", async () => {
  await openWorkshop(createMemoryDraftStorage({ unavailable: true }));

  expect(screen.getByRole("alert").textContent).toContain("Autosave is off");
  resizeFiles(6);
  await advance(AUTOSAVE_DELAY_MS);

  expect(squareCount()).toBe(30);
  expect(saveStatus()).toContain("Couldn't save: Browser storage is unavailable");
});

it("reports a full storage quota and keeps the in-memory draft", async () => {
  await openWorkshop(createMemoryDraftStorage({ quotaBytes: 100 }));

  resizeFiles(6);
  await advance(AUTOSAVE_DELAY_MS);

  expect(squareCount()).toBe(30);
  expect(saveStatus()).toContain("Couldn't save: Browser storage is full.");
});

it("exports the current draft as the deterministic envelope without touching storage", async () => {
  const files = captureDownloads();
  const { storage, write } = await openWorkshop();
  resizeFiles(6);
  await advance(AUTOSAVE_DELAY_MS);

  const exportButton = screen.getByRole("button", { name: "Export JSON" });
  fireEvent.click(exportButton);
  fireEvent.click(exportButton);
  vi.useRealTimers();

  const expected = exportDraft(storedVariant(storage)!);
  if (!expected.ok) throw new Error("Expected the edited draft to export");
  expect(files.map(({ name }) => name)).toEqual(["first-flight.rookery.json", "first-flight.rookery.json"]);
  expect(files.every(({ blob }) => blob.type === "application/json")).toBe(true);
  const [first, second] = await Promise.all(files.map(({ blob }) => readBlob(blob)));
  expect(first).toBe(expected.text);
  expect(second).toBe(first);
  expect((JSON.parse(first!) as { variant: VariantDefinition }).variant.board.files).toBe(6);
  expect(screen.getByText("Exported first-flight.rookery.json.")).toBeTruthy();
  expect(write).toHaveBeenCalledTimes(1);
});

it("refuses to export a draft with blocking issues and explains why", async () => {
  const files = captureDownloads();
  await openWorkshop();
  removeWhiteRoyal();

  fireEvent.click(screen.getByRole("button", { name: "Export JSON" }));

  expect(files).toHaveLength(0);
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  expect(screen.getByText(/^Resolve \d+ issues? before exporting\. Export uses the same checks as playtest\.$/)).toBeTruthy();
});

describe("JSON import", () => {
  /** Opens the workshop, optionally saves a 6-file edit, then returns to real timers for FileReader. */
  async function openForImport(storage: DraftStorage = createMemoryDraftStorage(), { edited = false } = {}) {
    const opened = await openWorkshop(storage);
    if (edited) {
      resizeFiles(6);
      await advance(AUTOSAVE_DELAY_MS);
    }
    vi.useRealTimers();
    return opened;
  }

  function chooseFile(name: string, contents: string) {
    const file = new File([contents], name, { type: "application/json" });
    fireEvent.change(screen.getByLabelText("Import JSON"), { target: { files: [file] } });
  }

  async function confirmImport(name: string) {
    const confirm = await screen.findByRole("button", { name: `Confirm import ${name}` });
    await act(async () => {
      fireEvent.click(confirm);
    });
  }

  const exportedText = (variant: VariantDefinition) => {
    const result = exportDraft(variant);
    if (!result.ok) throw new Error(`Expected ${variant.name} to export`);
    return result.text;
  };

  it.each([
    [firstFlightVariant, 25, "First Flight: 5 × 5 board, Capture the royal, 3 piece types, 6 starting pieces."],
    [longWalkVariant, 9, "The Long Walk: 3 × 3 board, Reach a target, 1 piece type, 2 starting pieces."],
    [lastFlockStandingVariant, 25, "Last Flock Standing: 5 × 5 board, Eliminate all opponents, 4 piece types,"],
  ])("imports showcase %#: summarises, confirms, replaces, and saves immediately", async (variant, squares, summary) => {
    const { storage, write } = await openForImport(createMemoryDraftStorage(), { edited: true });
    write.mockClear();

    chooseFile("shared.rookery.json", exportedText(variant));
    await screen.findByRole("button", { name: `Confirm import ${variant.name}` });
    expect(screen.getByRole("group", { name: "Confirm replacement" }).textContent).toContain(summary);
    expect(write).not.toHaveBeenCalled();

    await confirmImport(variant.name);

    expect(squareCount()).toBe(squares);
    expect(storedVariant(storage)).toEqual(variant);
    expect(write).toHaveBeenCalledTimes(1);
    expect(editorMessage()).toContain(`Imported ${variant.name} from shared.rookery.json.`);
    expect(document.activeElement).toBe(screen.getByRole("group", { name: "Import result" }));
  });

  it("loads an independent copy that later edits never share with the file or fixture", async () => {
    const { storage } = await openForImport();
    chooseFile("walk.json", exportedText(longWalkVariant));
    await confirmImport("The Long Walk");

    resizeFiles(4);

    expect(squareCount()).toBe(12);
    expect(longWalkVariant.board.files).toBe(3);
    expect(storedVariant(storage)?.board.files).toBe(3);
  });

  it("cancels an import without changing the draft or storage", async () => {
    const { storage, write } = await openForImport(createMemoryDraftStorage(), { edited: true });
    const before = storage.read(DRAFT_STORAGE_KEY);
    write.mockClear();

    chooseFile("walk.json", exportedText(longWalkVariant));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel replacement" }));

    expect(squareCount()).toBe(30);
    expect(storage.read(DRAFT_STORAGE_KEY)).toBe(before);
    expect(write).not.toHaveBeenCalled();
    expect(screen.getByText("Import cancelled. Your draft is unchanged.")).toBeTruthy();
  });

  it("undoes an import, restoring and saving the previous draft", async () => {
    const { storage } = await openForImport(createMemoryDraftStorage(), { edited: true });
    chooseFile("walk.json", exportedText(longWalkVariant));
    await confirmImport("The Long Walk");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Undo import" }));
    });

    expect(squareCount()).toBe(30);
    expect(storedVariant(storage)?.board.files).toBe(6);
    expect(editorMessage()).toContain("Import undone. First Flight is back.");
    expect(screen.queryByRole("button", { name: "Undo import" })).toBeNull();
  });

  it("stops offering undo after the next edit", async () => {
    await openForImport();
    chooseFile("walk.json", exportedText(longWalkVariant));
    await confirmImport("The Long Walk");
    expect(screen.getByRole("button", { name: "Undo import" })).toBeTruthy();

    resizeFiles(4);

    expect(screen.queryByRole("button", { name: "Undo import" })).toBeNull();
  });

  it("accepts a bare Sprint 1 variant file and says it has no envelope", async () => {
    await openForImport();

    chooseFile("first-flight.json", JSON.stringify(firstFlightVariant, null, 2));

    await screen.findByRole("button", { name: "Confirm import First Flight" });
    expect(screen.getByRole("group", { name: "Confirm replacement" }).textContent).toContain("older Rookery variant file without a draft envelope");
  });

  const longWalkEnvelope = (overrides: Record<string, unknown>) => JSON.stringify({
    format: "rookery.variant-draft",
    envelopeVersion: 1,
    variantSchemaVersion: 2,
    variant: longWalkVariant,
    ...overrides,
  });
  const brokenFirstFlight = {
    ...firstFlightVariant,
    setup: [
      ...firstFlightVariant.setup.filter(({ id }) => id !== "white-sovereign"),
      { id: "white-tower", typeId: "tower", ownerId: "white", at: { file: 4, rank: 4 } },
    ],
  };

  it.each([
    ["notes.txt", "remember to buy milk", "IMPORT_NOT_JSON", []],
    ["empty.json", "   ", "IMPORT_EMPTY", []],
    ["array.json", "[1, 2, 3]", "ENVELOPE_MALFORMED", []],
    ["future.json", longWalkEnvelope({ envelopeVersion: 2 }), "ENVELOPE_UNSUPPORTED_VERSION", ["envelopeVersion"]],
    ["hostile.json", `{"__proto__":{"polluted":true},${longWalkEnvelope({}).slice(1)}`, "ENVELOPE_MALFORMED", ["__proto__"]],
    ["zero-files.json", longWalkEnvelope({ variant: { ...longWalkVariant, board: { files: 0, ranks: 3, disabledCells: [] } } }), "VARIANT_INVALID", ["SCHEMA_INVALID", "board.files"]],
    ["broken.json", JSON.stringify(brokenFirstFlight), "VARIANT_INVALID", ["DUPLICATE_PIECE_ID", "OVERLAPPING_PIECES", "INVALID_ROYAL_COUNT"]],
  ])("rejects %s with %s and leaves the draft and storage deeply unchanged", async (name, contents, code, mentions) => {
    const { storage, write } = await openForImport(createMemoryDraftStorage(), { edited: true });
    const storedBefore = storage.read(DRAFT_STORAGE_KEY);
    const boardBefore = board().innerHTML;
    write.mockClear();

    chooseFile(name, contents);

    const alert = await screen.findByRole("alert", { name: `Import failed: ${name}` });
    expect(alert.textContent).toContain(code);
    for (const mention of mentions) expect(alert.textContent).toContain(mention);
    expect(alert.textContent).toContain("Your current draft and its saved copy are unchanged.");
    expect(document.activeElement).toBe(alert);
    expect(screen.queryByRole("group", { name: "Confirm replacement" })).toBeNull();
    expect(board().innerHTML).toBe(boardBefore);
    expect(storage.read(DRAFT_STORAGE_KEY)).toBe(storedBefore);
    expect(write).not.toHaveBeenCalled();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("rejects an oversized file from its size without reading it", async () => {
    const { storage } = await openForImport();
    const readAsText = vi.spyOn(FileReader.prototype, "readAsText");

    chooseFile("huge.json", "x".repeat(MAX_IMPORT_BYTES + 1));

    const alert = await screen.findByRole("alert", { name: "Import failed: huge.json" });
    expect(alert.textContent).toContain("IMPORT_TOO_LARGE");
    expect(readAsText).not.toHaveBeenCalled();
    expect(storage.read(DRAFT_STORAGE_KEY)).toBeNull();
  });

  it("replaces an unrecoverable stored draft with a confirmed import", async () => {
    const storage = createMemoryDraftStorage({ initial: { [DRAFT_STORAGE_KEY]: "{oops" } });
    await openForImport(storage);
    expect(screen.getByRole("alert", { name: "Your saved draft could not be restored" }).textContent).toContain("use Import JSON");

    chooseFile("walk.json", exportedText(longWalkVariant));
    await confirmImport("The Long Walk");

    expect(storedVariant(storage)).toEqual(longWalkVariant);
    expect(screen.queryByRole("alert", { name: "Your saved draft could not be restored" })).toBeNull();
  });
});
