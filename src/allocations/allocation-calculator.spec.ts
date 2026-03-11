import {
  BadRequestException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { computeAllocations } from "./allocation-calculator";

describe("computeAllocations", () => {
  describe("empty allocations", () => {
    it("returns empty array when allocations is empty", () => {
      expect(computeAllocations(100, [])).toEqual([]);
    });
  });

  describe("equal allocation", () => {
    it("splits 100.00 between two participants", () => {
      const result = computeAllocations(100, [
        { participantId: "p1", type: "equal", value: "0" },
        { participantId: "p2", type: "equal", value: "0" },
      ]);
      expect(result).toHaveLength(2);
      expect(result.every((r) => r.amount === "50.00")).toBe(true);
    });

    it("distributes remainder to the first participant", () => {
      const result = computeAllocations(100, [
        { participantId: "p1", type: "equal", value: "0" },
        { participantId: "p2", type: "equal", value: "0" },
        { participantId: "p3", type: "equal", value: "0" },
      ]);
      expect(result[0].amount).toBe("33.34");
      expect(result[1].amount).toBe("33.33");
      expect(result[2].amount).toBe("33.33");
    });

    it("keeps total amount exact", () => {
      const result = computeAllocations(100, [
        { participantId: "p1", type: "equal", value: "0" },
        { participantId: "p2", type: "equal", value: "0" },
        { participantId: "p3", type: "equal", value: "0" },
      ]);
      const total = result.reduce((s, r) => s + Number(r.amount), 0);
      expect(total.toFixed(2)).toBe("100.00");
    });

    it("does not add remainder when evenly divisible", () => {
      const result = computeAllocations("9.99", [
        { participantId: "p1", type: "equal", value: "0" },
        { participantId: "p2", type: "equal", value: "0" },
        { participantId: "p3", type: "equal", value: "0" },
      ]);
      // 9.99 / 3 = 3.33 exactly
      expect(result.every((r) => r.amount === "3.33")).toBe(true);
    });

    it("keeps type as equal", () => {
      const result = computeAllocations(60, [
        { participantId: "p1", type: "equal", value: "0" },
      ]);
      expect(result[0].type).toBe("equal");
    });
  });

  describe("shares allocation", () => {
    it("allocates proportionally for 2:1 shares", () => {
      const result = computeAllocations(90, [
        { participantId: "p1", type: "shares", value: "2" },
        { participantId: "p2", type: "shares", value: "1" },
      ]);
      const byId: Record<string, string> = {};
      result.forEach((r) => (byId[r.participantId] = r.amount));
      expect(byId["p1"]).toBe("60.00");
      expect(byId["p2"]).toBe("30.00");
    });

    it("splits evenly for 1:1 shares", () => {
      const result = computeAllocations(50, [
        { participantId: "p1", type: "shares", value: "1" },
        { participantId: "p2", type: "shares", value: "1" },
      ]);
      expect(result.every((r) => r.amount === "25.00")).toBe(true);
    });

    it("handles rounding accurately for 1:2 shares", () => {
      // (10 * 1) / 3 = 3.3333..., (10 * 2) / 3 = 6.6666...
      // Round to 2 dp: 3.33 and 6.67
      const result = computeAllocations("10.00", [
        { participantId: "p1", type: "shares", value: "1" },
        { participantId: "p2", type: "shares", value: "2" },
      ]);
      const byId: Record<string, string> = {};
      result.forEach((r) => (byId[r.participantId] = r.amount));
      expect(byId["p1"]).toBe("3.33");
      expect(byId["p2"]).toBe("6.67");
    });

    it("throws 422 when total shares is zero", () => {
      expect(() =>
        computeAllocations(100, [
          { participantId: "p1", type: "shares", value: "0" },
        ]),
      ).toThrow(UnprocessableEntityException);
    });
  });

  describe("custom allocation", () => {
    it("passes through custom amounts", () => {
      const result = computeAllocations(100, [
        { participantId: "p1", type: "custom", value: "70.00" },
        { participantId: "p2", type: "custom", value: "30.00" },
      ]);
      const byId: Record<string, string> = {};
      result.forEach((r) => (byId[r.participantId] = r.amount));
      expect(byId["p1"]).toBe("70.00");
      expect(byId["p2"]).toBe("30.00");
    });

    it("throws 422 when custom sum exceeds totalPrice", () => {
      expect(() =>
        computeAllocations(100, [
          { participantId: "p1", type: "custom", value: "80.00" },
          { participantId: "p2", type: "custom", value: "30.00" },
        ]),
      ).toThrow(UnprocessableEntityException);
    });

    it("does not throw when custom sum equals totalPrice", () => {
      expect(() =>
        computeAllocations(100, [
          { participantId: "p1", type: "custom", value: "60.00" },
          { participantId: "p2", type: "custom", value: "40.00" },
        ]),
      ).not.toThrow();
    });

    it("avoids floating-point overflow in 0.1 + 0.1 + 0.1", () => {
      // 0.1 + 0.1 + 0.1 === 0.30000000000000004 in JS
      expect(() =>
        computeAllocations("0.30", [
          { participantId: "p1", type: "custom", value: "0.1" },
          { participantId: "p2", type: "custom", value: "0.1" },
          { participantId: "p3", type: "custom", value: "0.1" },
        ]),
      ).not.toThrow();
    });

    it("avoids floating-point overflow in 99.99 + 0.01", () => {
      expect(() =>
        computeAllocations("100.00", [
          { participantId: "p1", type: "custom", value: "99.99" },
          { participantId: "p2", type: "custom", value: "0.01" },
        ]),
      ).not.toThrow();
    });
  });

  describe("duplicate participantId validation", () => {
    it("throws 400 for duplicate participantId", () => {
      expect(() =>
        computeAllocations(100, [
          { participantId: "p1", type: "equal", value: "0" },
          { participantId: "p1", type: "equal", value: "0" },
        ]),
      ).toThrow(BadRequestException);
    });
  });

  describe("output shape", () => {
    it("includes participantId / type / value / amount", () => {
      const result = computeAllocations(50, [
        { participantId: "p1", type: "equal", value: "0" },
      ]);
      expect(result[0]).toMatchObject({
        participantId: "p1",
        type: "equal",
        value: "0",
        amount: "50.00",
      });
    });
  });

  describe("string totalPrice input", () => {
    it("supports string totalPrice", () => {
      const result = computeAllocations("100.00", [
        { participantId: "p1", type: "equal", value: "0" },
        { participantId: "p2", type: "equal", value: "0" },
      ]);
      expect(result.every((r) => r.amount === "50.00")).toBe(true);
    });
  });
});
