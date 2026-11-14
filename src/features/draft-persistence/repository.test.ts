import { describe, expect, it, vi } from "vitest";
import type { VariantDefinition } from "@rookery/rules";
import { firstFlightVariant, lastFlockStandingVariant, longWalkVariant } from "@rookery/rules/fixtures";
import { DRAFT_STORAGE_KEY, ENVELOPE_FORMAT } from "./envelope";
import { createDraftRepository } from "./repository";
import { createMemoryDraftStorage, type DraftStorage } from "./storage";

const fixedClock = () => new Date("2026-11-14T17:04:12.345Z");
const renamed = (variant: VariantDefinition, name: string): VariantDefinition => ({ ...variant, name });

function setup(storage: DraftStorage = createMemoryDraftStorage()) {
  const write = vi.spyOn(storage, "write");
  return { storage, write, repository: createDraftRepository(storage, fixedClock) };
}

function storedEnvelope(storage: DraftStorage) {
  return JSON.parse(storage.read(DRAFT_STORAGE_KEY) ?? "null") as Record<string, unknown>;
}

describe("load", () => {
  it("reports an empty repository on first load", async () => {
    const { repository } = setup();

    await expect(repository.load()).resolves.toEqual({ status: "empty" });
  });

  it("restores a saved draft through a fresh repository, as after a refresh", async () => {
    const storage = createMemoryDraftStorage();
    await createDraftRepository(storage, fixedClock).save(longWalkVariant);

    const result = await createDraftRepository(storage, fixedClock).load();

    expect(result).toEqual({ status: "restored", variant: longWalkVariant, savedAt: "2026-11-14T17:04:12.345Z" });
  });

  it("reports unavailable storage without throwing", async () => {
    const { repository } = setup(createMemoryDraftStorage({ unavailable: true }));

    await expect(repository.load()).resolves.toMatchObject({ status: "unavailable", code: "STORAGE_UNAVAILABLE" });
    await expect(createDraftRepository(null).load()).resolves.toMatchObject({ status: "unavailable" });
  });

  it.each([
    ["non-JSON text", "{oops", "ENVELOPE_MALFORMED"],
    ["a wrong root type", "[1,2,3]", "ENVELOPE_MALFORMED"],
    ["a bare variant without an envelope", JSON.stringify(firstFlightVariant), "ENVELOPE_MALFORMED"],
    ["an unknown envelope version", JSON.stringify({ format: ENVELOPE_FORMAT, envelopeVersion: 9, variantSchemaVersion: 2, variant: longWalkVariant }), "ENVELOPE_UNSUPPORTED_VERSION"],
    ["a structurally invalid variant", JSON.stringify({ format: ENVELOPE_FORMAT, envelopeVersion: 1, variantSchemaVersion: 2, variant: { ...longWalkVariant, players: [] } }), "VARIANT_INVALID"],
    ["a semantically invalid variant", JSON.stringify({ format: ENVELOPE_FORMAT, envelopeVersion: 1, variantSchemaVersion: 1, variant: { ...firstFlightVariant, setup: firstFlightVariant.setup.slice(1, 3) } }), "VARIANT_INVALID"],
  ])("fails safely on %s and keeps the raw value for diagnosis", async (_, raw, code) => {
    const storage = createMemoryDraftStorage({ initial: { [DRAFT_STORAGE_KEY]: raw } });
    const { repository, write } = setup(storage);

    const result = await repository.load();

    expect(result).toMatchObject({ status: "failed", code, raw });
    expect(write).not.toHaveBeenCalled();
    expect(storage.read(DRAFT_STORAGE_KEY)).toBe(raw);
  });
});

describe("save", () => {
  it("writes a versioned envelope with the exact canonical variant", async () => {
    const { repository, storage } = setup();

    await expect(repository.save(lastFlockStandingVariant)).resolves.toEqual({ status: "saved", savedAt: "2026-11-14T17:04:12.345Z" });
    expect(storedEnvelope(storage)).toEqual({
      format: ENVELOPE_FORMAT,
      envelopeVersion: 1,
      variantSchemaVersion: 2,
      savedAt: "2026-11-14T17:04:12.345Z",
      variant: lastFlockStandingVariant,
    });
  });

  it("does not rewrite an unchanged draft, including an equal copy", async () => {
    const { repository, write } = setup();

    await repository.save(longWalkVariant);
    await expect(repository.save(structuredClone(longWalkVariant))).resolves.toEqual({ status: "unchanged" });
    expect(write).toHaveBeenCalledTimes(1);

    await repository.save(renamed(longWalkVariant, "The Longer Walk"));
    expect(write).toHaveBeenCalledTimes(2);
  });

  it("treats a baseline draft as already saved", async () => {
    const { repository, write } = setup();

    repository.markBaseline(firstFlightVariant);

    await expect(repository.save(firstFlightVariant)).resolves.toEqual({ status: "unchanged" });
    expect(write).not.toHaveBeenCalled();
  });

  it("treats a restored draft as the baseline", async () => {
    const storage = createMemoryDraftStorage();
    await createDraftRepository(storage, fixedClock).save(longWalkVariant);
    const { repository, write } = setup(storage);

    await repository.load();

    await expect(repository.save(longWalkVariant)).resolves.toEqual({ status: "unchanged" });
    expect(write).not.toHaveBeenCalled();
  });

  it("refuses to save a draft with blocking issues and keeps the last valid copy", async () => {
    const { repository, storage } = setup();
    await repository.save(firstFlightVariant);
    const before = storage.read(DRAFT_STORAGE_KEY);

    const result = await repository.save({ ...firstFlightVariant, setup: firstFlightVariant.setup.filter(({ id }) => id !== "white-sovereign") });

    expect(result).toMatchObject({ status: "failed", code: "VARIANT_INVALID" });
    if (result.status !== "failed") return;
    expect(result.issues.map(({ code }) => code)).toContain("INVALID_ROYAL_COUNT");
    expect(storage.read(DRAFT_STORAGE_KEY)).toBe(before);
  });

  it("reports a full quota, keeps the previous copy, and retries the same draft later", async () => {
    const storage = createMemoryDraftStorage({ quotaBytes: 3_000 });
    const { repository } = setup(storage);
    await expect(repository.save(longWalkVariant)).resolves.toMatchObject({ status: "saved" });
    const before = storage.read(DRAFT_STORAGE_KEY);
    expect(before).toContain('"the-long-walk"');

    await expect(repository.save(lastFlockStandingVariant)).resolves.toMatchObject({ status: "failed", code: "STORAGE_QUOTA_EXCEEDED" });
    expect(storage.read(DRAFT_STORAGE_KEY)).toBe(before);
    await expect(repository.save(lastFlockStandingVariant)).resolves.toMatchObject({ status: "failed", code: "STORAGE_QUOTA_EXCEEDED" });
  });

  it("maps blocked and unexpected storage failures to stable codes", async () => {
    await expect(setup(createMemoryDraftStorage({ unavailable: true })).repository.save(firstFlightVariant))
      .resolves.toMatchObject({ status: "failed", code: "STORAGE_UNAVAILABLE" });
    await expect(createDraftRepository(null).save(firstFlightVariant))
      .resolves.toMatchObject({ status: "failed", code: "STORAGE_UNAVAILABLE" });

    const broken: DraftStorage = { read: () => null, write: () => { throw new Error("disk on fire"); }, remove: () => {} };
    const result = await createDraftRepository(broken).save(firstFlightVariant);
    expect(result).toMatchObject({ status: "failed", code: "STORAGE_WRITE_FAILED" });
    expect(JSON.stringify(result)).not.toContain("disk on fire");
  });

  it("applies saves in call order so an earlier save never overwrites a newer one", async () => {
    const { repository, storage } = setup();

    const first = repository.save(renamed(longWalkVariant, "Older"));
    const second = repository.save(renamed(longWalkVariant, "Newer"));
    await Promise.all([second, first]);

    expect((storedEnvelope(storage).variant as VariantDefinition).name).toBe("Newer");
  });
});

describe("clear", () => {
  it("removes the saved draft so the next load is empty, and allows saving the same draft again", async () => {
    const { repository, write } = setup();
    await repository.save(longWalkVariant);

    await expect(repository.clear()).resolves.toEqual({ ok: true });
    await expect(repository.load()).resolves.toEqual({ status: "empty" });
    await repository.save(longWalkVariant);
    expect(write).toHaveBeenCalledTimes(2);
  });

  it("reports blocked storage on clear", async () => {
    await expect(setup(createMemoryDraftStorage({ unavailable: true })).repository.clear())
      .resolves.toMatchObject({ ok: false, code: "STORAGE_UNAVAILABLE" });
  });
});
