import { describe, expect, it } from "vitest";

import { INITIAL_STATUS, statusReducer } from "./status";

const retry = () => {};

describe("statusReducer (AC-5, AC-8)", () => {
  it("starts with nothing to announce and no failure", () => {
    expect(INITIAL_STATUS).toEqual({ announcement: null, failure: null });
  });

  it("announces each success with a new id, so the same words are read again", () => {
    const first = statusReducer(INITIAL_STATUS, { type: "succeed", announcement: "Moved A" });
    const second = statusReducer(first, { type: "succeed", announcement: "Moved A" });
    expect(first.announcement).toEqual({ id: 1, message: "Moved A" });
    expect(second.announcement).toEqual({ id: 2, message: "Moved A" });
  });

  it("keeps the last announcement for a success with nothing to say", () => {
    const announced = statusReducer(INITIAL_STATUS, { type: "succeed", announcement: "Moved A" });
    expect(statusReducer(announced, { type: "succeed" }).announcement).toBe(announced.announcement);
  });

  it("shows a failure with its retry, keeping the announcement", () => {
    const announced = statusReducer(INITIAL_STATUS, { type: "succeed", announcement: "Moved A" });
    const failed = statusReducer(announced, { type: "fail", message: "Not saved", retry });
    expect(failed).toEqual({ announcement: announced.announcement, failure: { message: "Not saved", retry } });
  });

  it("clears the failure when it is dismissed or a later change succeeds", () => {
    const failed = statusReducer(INITIAL_STATUS, { type: "fail", message: "Not saved", retry });
    expect(statusReducer(failed, { type: "dismiss" }).failure).toBeNull();
    expect(statusReducer(failed, { type: "succeed" }).failure).toBeNull();
  });
});
