import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { success, error, warn, info, heading, dim, banner } from "../utils/theme.js";

describe("theme - success", () => {
  it("returns a string containing the message", () => {
    const result = success("done");
    assert.ok(result.includes("done"));
  });

  it("contains a checkmark character", () => {
    const result = success("ok");
    assert.ok(result.includes("\u2713"));
  });
});

describe("theme - error", () => {
  it("returns a string containing the message", () => {
    const result = error("fail");
    assert.ok(result.includes("fail"));
  });

  it("contains an X character", () => {
    const result = error("bad");
    assert.ok(result.includes("\u2717"));
  });
});

describe("theme - warn", () => {
  it("returns a string containing the message", () => {
    const result = warn("caution");
    assert.ok(result.includes("caution"));
  });
});

describe("theme - info", () => {
  it("returns a string containing the message", () => {
    const result = info("notice");
    assert.ok(result.includes("notice"));
  });
});

describe("theme - heading", () => {
  it("returns a non-empty string", () => {
    const result = heading("Title");
    assert.ok(result.length > 0);
    assert.ok(result.includes("Title"));
  });
});

describe("theme - dim", () => {
  it("returns a string containing the message", () => {
    const result = dim("faded");
    assert.ok(result.includes("faded"));
  });
});

describe("theme - banner", () => {
  it("returns a long string", () => {
    const result = banner();
    assert.ok(result.length > 100);
  });

  it("contains framework tagline", () => {
    const result = banner();
    assert.ok(result.includes("Context Engineering Framework"));
  });
});
