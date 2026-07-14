import { describe, expect, it } from "vitest";
import { maskAnswer, maskLength } from "./mask";

describe("maskAnswer", () => {
  it("shows only length at reveal 0 is not used; reveal 1 shows first letter", () => {
    expect(maskAnswer("vergelijken", 1)).toBe("v _ _ _ _ _ _ _ _ _ _");
  });
  it("reveals progressively", () => {
    expect(maskAnswer("aarde", 3)).toBe("a a r _ _");
  });
  it("keeps a leading article visible without counting it", () => {
    expect(maskAnswer("de aarde", 1)).toBe("de a _ _ _ _");
    expect(maskAnswer("zich gedragen", 2)).toBe("zich g e _ _ _ _ _ _");
  });
  it("preserves internal word gaps", () => {
    expect(maskAnswer("ten slotte", 1)).toBe("t _ _   _ _ _ _ _ _");
  });
});

describe("maskLength", () => {
  it("counts letters excluding lead particle and spaces", () => {
    expect(maskLength("de aarde")).toBe(5);
    expect(maskLength("ten slotte")).toBe(9);
  });
});
