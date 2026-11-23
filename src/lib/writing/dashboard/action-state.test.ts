import { describe, expect, it, vi } from "vitest";

import { IDLE, failSafe, submittedText, type ActionState } from "./action-state";

const FAILED: ActionState = { status: "failed", message: "Not saved" };

describe("failSafe (AC-8)", () => {
  it("passes the action's own result through", async () => {
    const action = vi.fn(async () => ({ status: "ok" }) as const);
    const formData = new FormData();
    const safe = failSafe(action, () => FAILED, () => {});

    expect(await safe(IDLE, formData)).toEqual({ status: "ok" });
    expect(action).toHaveBeenCalledWith(IDLE, formData);
  });

  it("turns a rejected call into the failed state instead of an error page", async () => {
    const rethrow = vi.fn();
    const safe = failSafe(async () => Promise.reject(new TypeError("Failed to fetch")), () => FAILED, rethrow);

    expect(await safe(IDLE, new FormData())).toEqual(FAILED);
    expect(rethrow).toHaveBeenCalledWith(new TypeError("Failed to fetch"));
  });

  it("lets framework signals such as a redirect through", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;push;/write;307;" });
    const safe = failSafe(
      async () => Promise.reject(redirect),
      () => FAILED,
      (error) => {
        throw error;
      },
    );

    await expect(safe(IDLE, new FormData())).rejects.toBe(redirect);
  });
});

describe("submittedText", () => {
  it("reads a submitted text field", () => {
    const formData = new FormData();
    formData.set("title", "पहला");
    expect(submittedText(formData, "title")).toBe("पहला");
  });

  it("is empty with no form data, a missing field or a file", () => {
    const formData = new FormData();
    formData.set("title", new Blob(["x"]));
    expect(submittedText(null, "title")).toBe("");
    expect(submittedText(new FormData(), "title")).toBe("");
    expect(submittedText(formData, "title")).toBe("");
  });
});
