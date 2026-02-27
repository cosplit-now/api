import {
  BadRequestException,
  UnprocessableEntityException,
} from "@nestjs/common";
import Decimal from "decimal.js";

export type AllocationType = "equal" | "shares" | "custom";

export interface AllocationInput {
  participantId: string;
  type: AllocationType;
  value: string;
}

export interface AllocationComputed {
  participantId: string;
  type: AllocationType;
  value: string;
  amount: string;
}

/**
 * Calculates the amount for each allocation entry given the item's total price.
 * Pure function - no side effects, no DB access.
 *
 * Uses decimal.js for precise arithmetic to avoid floating-point pitfalls.
 *
 * equal strategy: all participants get floor(total/n, 2 dp); the remainder
 * (due to truncation) is added to the first participant.
 *
 * Throws:
 *   - BadRequestException          — duplicate participantIds
 *   - UnprocessableEntityException — zero total shares (shares type)
 *                                    or custom sum exceeds total
 */
export function computeAllocations(
  totalPrice: number | string,
  allocations: AllocationInput[],
): AllocationComputed[] {
  if (allocations.length === 0) {
    return [];
  }

  // Validate: no duplicate participantIds
  const ids = allocations.map((a) => a.participantId);
  if (new Set(ids).size !== ids.length) {
    throw new BadRequestException(
      "Each participantId must appear at most once",
    );
  }

  const total = new Decimal(totalPrice);
  const type = allocations[0].type;

  if (type === "equal") {
    const n = allocations.length;
    // Truncate to 2 dp (ROUND_DOWN) for each share
    const baseAmount = total
      .dividedBy(n)
      .toDecimalPlaces(2, Decimal.ROUND_DOWN);
    // Compute remainder: total - baseAmount * n
    const distributed = baseAmount.times(n);
    const remainder = total.minus(distributed).toDecimalPlaces(2);

    return allocations.map((a, i) => ({
      participantId: a.participantId,
      type: "equal",
      value: a.value ?? "0",
      // First participant absorbs the remainder
      amount: (i === 0 ? baseAmount.plus(remainder) : baseAmount).toFixed(2),
    }));
  }

  if (type === "shares") {
    const totalShares = allocations.reduce(
      (sum, a) => sum.plus(new Decimal(a.value ?? "0")),
      new Decimal(0),
    );
    if (totalShares.isZero()) {
      throw new UnprocessableEntityException(
        "Total shares must be greater than zero",
      );
    }
    return allocations.map((a) => {
      const shareValue = new Decimal(a.value ?? "0");
      return {
        participantId: a.participantId,
        type: "shares",
        value: a.value ?? "0",
        amount: total
          .times(shareValue)
          .dividedBy(totalShares)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
          .toFixed(2),
      };
    });
  }

  if (type === "custom") {
    const totalCustom = allocations.reduce(
      (sum, a) => sum.plus(new Decimal(a.value ?? "0")),
      new Decimal(0),
    );
    if (totalCustom.greaterThan(total)) {
      throw new UnprocessableEntityException(
        "Custom amounts exceed item total price",
      );
    }
    return allocations.map((a) => ({
      participantId: a.participantId,
      type: "custom",
      value: a.value ?? "0",
      amount: new Decimal(a.value ?? "0").toFixed(2),
    }));
  }

  // Fallback: mixed / unknown types
  return allocations.map((a) => ({
    participantId: a.participantId,
    type: a.type,
    value: a.value ?? "0",
    amount: new Decimal(a.value ?? "0").toFixed(2),
  }));
}
