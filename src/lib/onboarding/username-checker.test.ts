import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { UsernameAvailability } from "@/contracts/onboarding";

import { createUsernameChecker, type UsernameCheckState } from "./username-checker";

const DELAY = 400;

function deferred() {
  let resolve!: (value: UsernameAvailability) => void;
  const promise = new Promise<UsernameAvailability>((done) => (resolve = done));
  return { promise, resolve };
}

function setup(check = vi.fn(async (): Promise<UsernameAvailability> => ({ status: "available", username: "asha" }))) {
  const states: UsernameCheckState[] = [];
  const checker = createUsernameChecker({ check, onState: (state) => states.push(state), delayMs: DELAY });
  return { check, states, checker, last: () => states.at(-1) };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("createUsernameChecker (AC-2)", () => {
  it("waits for typing to pause before checking, and checks only the last value", async () => {
    const { check, checker, last } = setup();
    checker.update("a");
    checker.update("as");
    await vi.advanceTimersByTimeAsync(DELAY - 1);
    checker.update("asha");
    await vi.advanceTimersByTimeAsync(DELAY - 1);
    expect(check).not.toHaveBeenCalled();
    expect(last()).toEqual({ status: "idle" });

    await vi.advanceTimersByTimeAsync(1);
    expect(check).toHaveBeenCalledExactlyOnceWith("asha");
    expect(last()).toEqual({ status: "available", username: "asha" });
  });

  it("shows checking while the server answers", async () => {
    const answer = deferred();
    const { checker, last } = setup(vi.fn(() => answer.promise));
    checker.update("asha");
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(last()).toEqual({ status: "checking" });
    answer.resolve({ status: "unavailable", code: "taken" });
    await vi.advanceTimersByTimeAsync(0);
    expect(last()).toEqual({ status: "unavailable", code: "taken" });
  });

  it.each([
    ["ab", "too_short"],
    ["asha k", "invalid_characters"],
    ["1asha", "must_start_with_letter"],
    ["admin", "reserved"],
  ] as const)("answers %j as %s locally, without a server call", async (raw, code) => {
    const { check, checker, last } = setup();
    checker.update(raw);
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(check).not.toHaveBeenCalled();
    expect(last()).toEqual({ status: "unavailable", code });
  });

  it("goes back to idle at once when the field is emptied", async () => {
    const { check, checker, states } = setup();
    checker.update("   ");
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(check).not.toHaveBeenCalled();
    expect(states).toEqual([{ status: "idle" }]);
  });

  it("ignores a slow answer for an older value that arrives after a newer one", async () => {
    const older = deferred();
    const newer = deferred();
    const { checker, last } = setup(vi.fn().mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise));
    checker.update("asha");
    await vi.advanceTimersByTimeAsync(DELAY);
    checker.update("ashar");
    await vi.advanceTimersByTimeAsync(DELAY);

    newer.resolve({ status: "available", username: "ashar" });
    await vi.advanceTimersByTimeAsync(0);
    older.resolve({ status: "unavailable", code: "taken" });
    await vi.advanceTimersByTimeAsync(0);
    expect(last()).toEqual({ status: "available", username: "ashar" });
  });

  it.each([
    ["the server can't tell", async (): Promise<UsernameAvailability> => ({ status: "unknown" })],
    ["the call fails", async (): Promise<UsernameAvailability> => Promise.reject(new Error("network"))],
  ])("shows nothing when %s, leaving submit to decide", async (_case, check) => {
    const { checker, last } = setup(vi.fn(check));
    checker.update("asha");
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(last()).toEqual({ status: "idle" });
  });

  it("reports nothing after dispose", async () => {
    const answer = deferred();
    const { check, checker, states } = setup(vi.fn(() => answer.promise));
    checker.update("asha");
    await vi.advanceTimersByTimeAsync(DELAY);
    checker.dispose();
    answer.resolve({ status: "available", username: "asha" });
    checker.update("asha_k");
    checker.dispose();
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(check).toHaveBeenCalledOnce();
    expect(states.at(-1)).toEqual({ status: "idle" });
  });
});
