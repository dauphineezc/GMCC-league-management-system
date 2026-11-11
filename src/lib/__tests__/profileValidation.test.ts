import { parseDob, parseEmail, parsePersonName, parsePhone } from "@/lib/profileValidation";

describe("parsePersonName", () => {
  it("accepts common names and punctuation", () => {
    expect(parsePersonName("Mary-Jane").value).toBe("Mary-Jane");
    expect(parsePersonName("O'Brien").value).toBe("O'Brien");
    expect(parsePersonName("St. John").value).toBe("St. John");
    expect(parsePersonName("Jr.").ok).toBe(true);
  });

  it("rejects digits and symbols", () => {
    expect(parsePersonName("John3").ok).toBe(false);
    expect(parsePersonName(" ann ").ok).toBe(true);
    expect(parsePersonName("Bad_Name").ok).toBe(false);
    expect(parsePersonName("").ok).toBe(false);
  });
});

describe("parseDob", () => {
  it("rejects future dates and years", () => {
    const nextYear = new Date().getFullYear() + 1;
    expect(parseDob(`${nextYear}-01-01`).ok).toBe(false);
    expect(parseDob("2099-12-31").ok).toBe(false);
  });

  it("accepts a valid past date", () => {
    expect(parseDob("1990-05-15")).toEqual({ ok: true, value: "1990-05-15" });
  });

  it("allows empty/optional", () => {
    expect(parseDob("")).toEqual({ ok: true, value: null });
    expect(parseDob(null)).toEqual({ ok: true, value: null });
  });
});

describe("parsePhone", () => {
  it("accepts 10 digits with punctuation", () => {
    expect(parsePhone("(555) 123-4567")).toEqual({
      ok: true,
      value: "(555) 123-4567",
    });
    expect(parsePhone("555.123.4567").value).toBe("(555) 123-4567");
    expect(parsePhone("5551234567").value).toBe("(555) 123-4567");
  });

  it("accepts country code +1", () => {
    expect(parsePhone("+1 555-123-4567").value).toBe("(555) 123-4567");
    expect(parsePhone("1 (555) 123-4567").value).toBe("(555) 123-4567");
  });

  it("accepts other country codes with 10-digit national numbers", () => {
    expect(parsePhone("+44 7700900123").value).toBe("+44 7700900123");
  });

  it("rejects nonsense and wrong lengths", () => {
    expect(parsePhone("123").ok).toBe(false);
    expect(parsePhone("abcdefghij").ok).toBe(false);
    expect(parsePhone("555-CALL-NOW").ok).toBe(false);
  });

  it("allows empty/optional", () => {
    expect(parsePhone("")).toEqual({ ok: true, value: null });
  });
});

describe("parseEmail", () => {
  it("accepts and normalizes valid emails", () => {
    expect(parseEmail("  Player@Example.com ")).toEqual({
      ok: true,
      value: "player@example.com",
    });
  });

  it("rejects missing or invalid emails", () => {
    expect(parseEmail("").ok).toBe(false);
    expect(parseEmail("not-an-email").ok).toBe(false);
    expect(parseEmail("a@b").ok).toBe(false);
  });
});
