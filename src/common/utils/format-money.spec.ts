import { formatMoney } from "./format-money";

describe("formatMoney", () => {
  describe("null / undefined inputs", () => {
    it("returns null for null", () => {
      expect(formatMoney(null)).toBeNull();
    });

    it("returns null for undefined", () => {
      expect(formatMoney(undefined)).toBeNull();
    });
  });

  describe("number inputs", () => {
    it("pads integer with two decimals", () => {
      expect(formatMoney(100)).toBe("100.00");
    });

    it("pads one decimal place", () => {
      expect(formatMoney(9.9)).toBe("9.90");
    });

    it("keeps two decimal places", () => {
      expect(formatMoney(3.14)).toBe("3.14");
    });

    it("rounds more than two decimal places", () => {
      expect(formatMoney(1.005)).toBe("1.01");
    });

    it("formats zero as 0.00", () => {
      expect(formatMoney(0)).toBe("0.00");
    });
  });

  describe("string inputs", () => {
    it("pads integer string with .00", () => {
      expect(formatMoney("100")).toBe("100.00");
    });

    it("pads one decimal place string", () => {
      expect(formatMoney("9.9")).toBe("9.90");
    });

    it("keeps two decimal place string", () => {
      expect(formatMoney("333.33")).toBe("333.33");
    });

    it("rounds string with more than two decimals", () => {
      expect(formatMoney("1.005")).toBe("1.01");
    });

    it('"0" formats as 0.00', () => {
      expect(formatMoney("0")).toBe("0.00");
    });

    it("supports scientific notation strings", () => {
      expect(formatMoney("1e2")).toBe("100.00");
    });
  });

  describe("Decimal-like inputs (Prisma Decimal)", () => {
    it("formats object with toFixed", () => {
      const decimalLike = { toFixed: (d: number) => (999.99).toFixed(d) };
      expect(formatMoney(decimalLike)).toBe("999.99");
    });

    it("pads integer Decimal with .00", () => {
      const decimalLike = { toFixed: (d: number) => (50).toFixed(d) };
      expect(formatMoney(decimalLike)).toBe("50.00");
    });
  });
});
