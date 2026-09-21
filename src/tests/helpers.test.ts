import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { lf, posixPath, includesPath } from "./helpers.js";

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
    assert.equal(posixPath("C:\\tmp\\.context\\appmaps\\x.json"), "C:/tmp/.context/appmaps/x.json");
  });

  it("includesPath accepts mixed separators on either side", () => {
    assert.equal(
      includesPath("C:\\tmp\\.context\\decisions\\review\\next.json", ".context/decisions/review"),
      true,
    );
    assert.equal(
      includesPath("/tmp/.context/decisions/write/next.json", ".context\\decisions\\write"),
      true,
    );
    assert.equal(includesPath("C:\\tmp\\.context\\decisions\\review\\x.json", "/review/"), true);
    assert.equal(includesPath("C:\\tmp\\.context\\decisions\\write\\x.json", "/review/"), false);
  });
});
