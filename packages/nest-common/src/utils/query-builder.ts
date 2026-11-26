import { BadRequestException } from "@nestjs/common";
/** Only resource-declared fields may enter a filter; organization scope is applied independently. */
type Scalar = string | number | boolean;
const isScalar = (v: unknown): v is Scalar =>
  ["string", "number", "boolean"].includes(typeof v);

/**
 * `filters` of a resource list: field -> one value or a non-empty list of values (a record
 * matches any value of a field, and every field). Always returned as lists.
 */
export function parseFilters(
  raw: unknown,
  allowed: string[],
): Record<string, Scalar[]> {
  if (!raw) return {};
  let value: unknown;
  try {
    value = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    throw new BadRequestException("INVALID_FILTER");
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new BadRequestException("INVALID_FILTER");
  const out: Record<string, Scalar[]> = {};
  for (const [key, item] of Object.entries(value)) {
    const values = Array.isArray(item) ? item : [item];
    if (
      !allowed.includes(key) ||
      values.length === 0 ||
      values.length > 50 ||
      !values.every(isScalar)
    )
      throw new BadRequestException("INVALID_FILTER");
    out[key] = values;
  }
  return out;
}

/** Filter operators of a resource list (`filters={"amount":{"gte":1}}`). */
export const FILTER_OPERATORS = [
  "eq",
  "ne",
  "in",
  "nin",
  "contains",
  "startsWith",
  "gt",
  "gte",
  "lt",
  "lte",
  "between",
  "isNull",
] as const;
export type FilterOperator = (typeof FILTER_OPERATORS)[number];

export interface FilterCondition {
  field: string;
  op: FilterOperator;
  values: Scalar[];
}

/** Operators that make sense for a field type; the column endpoint lists them for the web. */
export function operatorsFor(type: string): FilterOperator[] {
  if (type === "number" || type === "date" || type === "datetime")
    return [
      "eq",
      "ne",
      "in",
      "nin",
      "gt",
      "gte",
      "lt",
      "lte",
      "between",
      "isNull",
    ];
  if (type === "boolean") return ["eq", "ne", "isNull"];
  if (type === "select" || type === "ref")
    return ["eq", "ne", "in", "nin", "isNull"];
  return ["eq", "ne", "in", "nin", "contains", "startsWith", "isNull"];
}

/** Query strings carry text; a number or boolean field compares as its own type. */
function coerce(value: Scalar, type: string): Scalar {
  if (type === "number") {
    const n = typeof value === "number" ? value : Number(value);
    if (typeof value === "boolean" || value === "" || !Number.isFinite(n))
      throw new BadRequestException("INVALID_FILTER");
    return n;
  }
  if (type === "boolean") {
    if (typeof value === "boolean") return value;
    if (value === "true") return true;
    if (value === "false") return false;
    throw new BadRequestException("INVALID_FILTER");
  }
  return value;
}

/**
 * Filters with operators. A plain value means `eq`, a list means `in` (the earlier form keeps
 * working); an object holds operators: `{"gte":1,"lte":9}`, `{"between":[1,9]}`, `{"isNull":true}`.
 * `types` maps an allowed field to its resources.json type, so values are compared as that type.
 */
export function parseFilterConditions(
  raw: unknown,
  types: Record<string, string>,
): FilterCondition[] {
  if (!raw) return [];
  let value: unknown;
  try {
    value = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    throw new BadRequestException("INVALID_FILTER");
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new BadRequestException("INVALID_FILTER");
  const out: FilterCondition[] = [];
  const bad = () => new BadRequestException("INVALID_FILTER");
  for (const [field, item] of Object.entries(value)) {
    const type = types[field];
    if (type === undefined) throw bad();
    const allowed = operatorsFor(type);
    const entries: [string, unknown][] =
      item && typeof item === "object" && !Array.isArray(item)
        ? Object.entries(item)
        : [[Array.isArray(item) ? "in" : "eq", item]];
    if (!entries.length) throw bad();
    for (const [op, operand] of entries) {
      if (!(FILTER_OPERATORS as readonly string[]).includes(op)) throw bad();
      if (
        !allowed.includes(op as FilterOperator) &&
        !(op === "in" && allowed.includes("eq"))
      )
        throw bad();
      const values = Array.isArray(operand) ? operand : [operand];
      if (
        values.length === 0 ||
        values.length > 50 ||
        !values.every(isScalar) ||
        (op === "between" && values.length !== 2) ||
        (op === "isNull" && typeof operand !== "boolean") ||
        (!["in", "nin", "between"].includes(op) && Array.isArray(operand))
      )
        throw bad();
      out.push({
        field,
        op: op as FilterOperator,
        values: op === "isNull" ? values : values.map((v) => coerce(v, type)),
      });
    }
  }
  return out;
}

const empty = (v: unknown) => v === undefined || v === null || v === "";

/** Orders two cells: numbers as numbers, text in Vietnamese order with numeric parts. */
export function compareCells(x: unknown, y: unknown): number {
  if (empty(x) || empty(y))
    return empty(x) === empty(y) ? 0 : empty(x) ? 1 : -1;
  if (typeof x === "number" && typeof y === "number") return x - y;
  if (typeof x === "boolean" && typeof y === "boolean")
    return Number(x) - Number(y);
  return String(x).localeCompare(String(y), "vi", { numeric: true });
}

/** Whether one record value meets a condition; `fold` makes text tests ignore accents and case. */
export function meets(
  cell: unknown,
  condition: FilterCondition,
  fold: (text: string) => string,
): boolean {
  const { op, values } = condition;
  if (op === "isNull") return empty(cell) === values[0];
  const cells = Array.isArray(cell) ? cell : [cell];
  // A date bound ("2026-01-31") covers the whole day of a timestamp ("2026-01-31T10:00:00Z").
  const order = (c: unknown, v: Scalar) =>
    typeof c === "string" && typeof v === "string" && /^\d{4}-\d{2}/.test(v)
      ? compareCells(c.slice(0, v.length), v)
      : compareCells(c, v);
  const same = (a: unknown, b: Scalar) =>
    a === b || (!empty(a) && typeof a !== typeof b && String(a) === String(b));
  switch (op) {
    case "eq":
    case "in":
      return cells.some((c) => values.some((v) => same(c, v)));
    case "ne":
    case "nin":
      return !cells.some((c) => values.some((v) => same(c, v)));
    case "contains":
      return cells.some(
        (c) => !empty(c) && fold(String(c)).includes(fold(String(values[0]))),
      );
    case "startsWith":
      return cells.some(
        (c) => !empty(c) && fold(String(c)).startsWith(fold(String(values[0]))),
      );
    case "between":
      return cells.some(
        (c) =>
          !empty(c) && order(c, values[0]) >= 0 && order(c, values[1]) <= 0,
      );
    default: {
      return cells.some((c) => {
        if (empty(c)) return false;
        const d = order(c, values[0]);
        return op === "gt"
          ? d > 0
          : op === "gte"
            ? d >= 0
            : op === "lt"
              ? d < 0
              : d <= 0;
      });
    }
  }
}
