import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { VariantDefinition } from "@rookery/rules";
import { longWalkVariant } from "@rookery/rules/fixtures";
import { VariantWorkshop } from "@/features/variant-workshop/variant-workshop";
import { DRAFT_STORAGE_KEY, exportDraft } from "./envelope";
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
