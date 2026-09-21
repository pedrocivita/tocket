import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { lf, posixPath } from "./helpers.js";

describe("test helpers", () => {
  it("normalizes CRLF on both sides of template equality", () => {
    const crlf = "---\r\nname: tocket\r\n";
    const lfText = "---\nname: tocket\n";
    assert.equal(lf(crlf), lf(lfText));
    assert.equal(lf(lfText), lfText);
  });

  it("normalizes Windows separators in filesystem path assertions", () => {
    assert.equal(posixPath(".context\\decisions\\write\\x.json"), ".context/decisions/write/x.json");
    assert.equal(posixPath(".context/decisions/write/x.json"), ".context/decisions/write/x.json");
  });
});
