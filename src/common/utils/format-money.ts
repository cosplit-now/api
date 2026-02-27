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
    return padToTwoDecimals(value);
  }

  if (typeof value === "number") {
    return value.toFixed(2);
  }

  if (typeof value.toFixed === "function") {
    return value.toFixed(2);
  }

  return null;
}

function padToTwoDecimals(value: string): string {
  if (value.includes("e") || value.includes("E")) {
    return Number(value).toFixed(2);
  }

  const [whole, fraction = ""] = value.split(".");
  if (fraction.length === 0) {
    return `${whole}.00`;
  }
  if (fraction.length === 1) {
    return `${whole}.${fraction}0`;
  }
  if (fraction.length === 2) {
    return `${whole}.${fraction}`;
  }

  return Number(value).toFixed(2);
}
