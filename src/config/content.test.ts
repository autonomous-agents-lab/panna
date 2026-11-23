import { describe, expect, it } from "vitest";

import {
  CONTENT_STATUSES,
  HEADING_LEVELS,
  IMAGE_ALT_MAX_LENGTH,
  IMAGE_SRC_MAX_LENGTH,
  PAGE_BODY_DB_MAX_BYTES,
  PAGE_BODY_MAX_BYTES,
  PAGE_BODY_MAX_DEPTH,
  PAGE_IMAGES_BUCKET,
} from "./content";
import * as config from "./index";

describe("content config", () => {
  it("has draft and published statuses", () => {
    expect(CONTENT_STATUSES).toEqual(["draft", "published"]);
  });

  it("gives the database size check room above the sanitiser's limit", () => {
    expect(PAGE_BODY_DB_MAX_BYTES).toBeGreaterThan(PAGE_BODY_MAX_BYTES);
  });

  it("has positive integer limits", () => {
    for (const limit of [PAGE_BODY_MAX_BYTES, PAGE_BODY_DB_MAX_BYTES, PAGE_BODY_MAX_DEPTH, IMAGE_ALT_MAX_LENGTH, IMAGE_SRC_MAX_LENGTH]) {
      expect(Number.isInteger(limit) && limit > 0).toBe(true);
    }
  });

  it("allows heading levels 2 and 3, the pair the sanitiser clamps to", () => {
    expect(HEADING_LEVELS).toEqual([2, 3]);
  });

  it("names a valid storage bucket", () => {
    expect(PAGE_IMAGES_BUCKET).toMatch(/^[a-z0-9][a-z0-9-]*$/);
  });

  it("is exported from src/config", () => {
    expect(config.CONTENT_STATUSES).toBe(CONTENT_STATUSES);
    expect(config.PAGE_BODY_MAX_BYTES).toBe(PAGE_BODY_MAX_BYTES);
  });
});
