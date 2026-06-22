import {
  leagueSlugFromLegacyId,
  normalizeDivision,
  normalizeGameStatus,
  normalizeGender,
  normalizeSport,
} from "@/lib/kvExport/normalize";

describe("kvExport normalize", () => {
  it("normalizes gender spellings", () => {
    expect(normalizeGender("Men's")).toBe("mens");
    expect(normalizeGender("WOMEN")).toBe("womens");
    expect(normalizeGender("co-ed")).toBe("coed");
  });

  it("normalizes sport and division", () => {
    expect(normalizeSport("Basketball")).toBe("basketball");
    expect(normalizeDivision("low b")).toBe("low_b");
    expect(normalizeDivision("A")).toBe("a");
  });

  it("derives game status from scores", () => {
    expect(normalizeGameStatus("scheduled", true)).toBe("final");
    expect(normalizeGameStatus("canceled", false)).toBe("canceled");
  });

  it("slugifies legacy league ids", () => {
    expect(leagueSlugFromLegacyId("5v5")).toBe("5v5");
    expect(leagueSlugFromLegacyId("Basketball Mens A")).toBe("basketball-mens-a");
  });
});
