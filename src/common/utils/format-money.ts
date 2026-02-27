import { Prisma } from "generated/prisma/client";

type MoneyInput =
  | { toFixed: (digits: number) => string }
  | string
  | number
  | null
  | undefined;

export function formatMoney(value: MoneyInput): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    return new Prisma.Decimal(value).toFixed(2);
  }

  if (typeof value === "number") {
    return new Prisma.Decimal(String(value)).toFixed(2);
  }

  if (typeof value.toFixed === "function") {
    return value.toFixed(2);
  }

  return null;
}
