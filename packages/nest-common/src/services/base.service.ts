import {
  Injectable,
  Inject,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  PayloadTooLargeException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import bcrypt from "bcryptjs";
import { Repository } from "../repository";
import { parsePage } from "../dto/pagination.dto";
import {
  compareCells,
  meets,
  operatorsFor,
  parseFilterConditions,
} from "../utils/query-builder";
import { stampedName, toCsv } from "../utils/csv";
import { toXlsx } from "../utils/xlsx";
import { can, scopeOf } from "../permissions";
import type { Actor, Field, Resource, RecordEntity } from "../types";
import { repoRoot } from "../paths";
import { fold } from "../listing";
import { INTERNAL_ROLES, orgAdminRefusal } from "../roles";
import { auditDigest } from "../audit-chain";
import { fieldProblem, normalizeField } from "../field-validation";
import { ValidationProblem, toFieldIssue } from "../problem";
import { parseCsv } from "../utils/csv-parse";
import { IMPORT_MODES, MAX_BATCH, type ImportMode } from "../dto/resource.dto";

/** Each operation maps to `<resource>:<operation>` in packages/contracts/permissions.json. */
type Operation = "read" | "create" | "update" | "delete" | "import" | "export";

/** A CSV cell as the field's type; text that is not a valid value stays text and fails validation. */
function readCell(field: Field, cell: string): unknown {
  if (field.type === "number") {
    const n = Number(cell.replace(/\s/g, ""));
    return Number.isFinite(n) ? n : cell;
  }
  if (field.type === "boolean") {
    const v = fold(cell);
    if (["true", "1", "yes", "co", "x"].includes(v)) return true;
    if (["false", "0", "no", "khong"].includes(v)) return false;
  }
  return cell;
}

/** Most rows one export returns; filter further for more. */
export const MAX_EXPORT = 10_000;
const SYSTEM_LABELS: Record<string, string> = {
  id: "ID",
  origin: "Nguồn",
  createdAt: "Tạo lúc",
  updatedAt: "Sửa lúc",
};

@Injectable()
export class BaseService {
  readonly definitions: Resource[] = JSON.parse(
    readFileSync(
      resolve(repoRoot(), "packages/contracts/resources.json"),
      "utf8",
    ),
  );
  constructor(@Inject(Repository) private repo: Repository) {}
  definition(name: string) {
    const def = this.definitions.find((d) => d.name === name);
    if (!def) throw new NotFoundException("RESOURCE_NOT_FOUND");
    return def;
  }
  private access(name: string, actor: Actor, operation: Operation) {
    const def = this.definition(name);
    if (def.readOnly && !["read", "export"].includes(operation))
      throw new ForbiddenException("APPEND_ONLY_RESOURCE");
    if (!can(actor.role, `${name}:${operation}`))
      throw new ForbiddenException("PERMISSION_DENIED");
    return def;
  }
  /** Sample-data and workflow records change only through their own actions (resources.json). */
  private assertUnmanaged(def: Resource, item: RecordEntity) {
    if (def.managedOrigins?.includes(String(item.origin)))
      throw new ForbiddenException("MANAGED_RECORD");
  }
  private visible(name: string, item: RecordEntity, actor: Actor) {
    return (
      scopeOf(actor.role, `${name}:read`) === "all" ||
      (name === "organizations"
        ? item.id === actor.organizationId
        : item.organizationId === actor.organizationId)
    );
  }
  /**
   * A company administrator manages only the business accounts of its own company: checked on
   * the account as it is and as it would become (vocabulary.orgAdminRefusal).
   */
  private async assertAccountManageable(
    name: string,
    actor: Actor,
    ...accounts: Record<string, unknown>[]
  ) {
    if (name !== "users" || actor.role !== "ORG_ADMIN") return;
    const tables = {
      organizations: await this.repo.list("organizations"),
      parties: await this.repo.list("parties"),
    };
    for (const account of accounts) {
      const refusal = orgAdminRefusal(actor, account, tables);
      if (refusal) throw new ForbiddenException(refusal);
    }
  }
  private clean(item: RecordEntity) {
    const { passwordHash, tokenVersion, ...safe } = item;
    return safe;
  }
  /** Platform roles read the audit log as digests only: they check it, they do not read it. */
  private shown(name: string, item: RecordEntity, actor: Actor) {
    const safe = this.clean(item);
    return name === "audit" && INTERNAL_ROLES.includes(actor.role)
      ? auditDigest(safe as RecordEntity)
      : safe;
  }
  /** Every problem with one record, in field order; `validate` reports only the first. */
  private fieldErrors(def: Resource, body: unknown, partial = false) {
    if (!body || typeof body !== "object" || Array.isArray(body))
      return { errors: ["INVALID_BODY"], data: {} };
    const input = body as Record<string, unknown>;
    const allowed = [...def.fields.map((f) => f.key), "version"];
    const errors: string[] = [];
    if (Object.keys(input).some((k) => !allowed.includes(k)))
      errors.push("UNKNOWN_FIELD");
    const data: Record<string, unknown> = {};
    for (const f of def.fields) {
      const value = normalizeField(f, input[f.key]);
      if (value === undefined) {
        if (f.required && !partial) errors.push(`REQUIRED:${f.key}`);
        continue;
      }
      if (f.required && (value === "" || value === null)) {
        errors.push(`REQUIRED:${f.key}`);
        continue;
      }
      const error = this.valueError(f, value);
      if (error) {
        errors.push(error);
        continue;
      }
      data[f.key] =
        f.type === "email" ? String(value).trim().toLowerCase() : value;
    }
    return { errors, data };
  }
  private valueError(f: Field, value: unknown): string | undefined {
    return fieldProblem(f, value) ?? undefined;
  }
  private validate(def: Resource, body: unknown, partial = false) {
    const { errors, data } = this.fieldErrors(def, body, partial);
    if (errors.length) throw new ValidationProblem(errors);
    return data;
  }
  /** Ids referenced by `ref` fields that do not exist in the target resource. */
  private async referenceErrors(
    def: Resource,
    data: Record<string, unknown>,
    cache = new Map<string, Set<string>>(),
  ) {
    const errors: string[] = [];
    for (const f of def.fields) {
      if (!f.ref || data[f.key] === undefined || data[f.key] === "") continue;
      if (!cache.has(f.ref))
        cache.set(
          f.ref,
          new Set((await this.repo.list(f.ref)).map((item) => item.id)),
        );
      if (!cache.get(f.ref)!.has(String(data[f.key])))
        errors.push(`INVALID_REFERENCE:${f.key}`);
    }
    return errors;
  }
  private async checkReferences(def: Resource, data: Record<string, unknown>) {
    const errors = await this.referenceErrors(def, data);
    if (errors.length) throw new ValidationProblem(errors);
  }
  /** Fields declared `unique` in resources.json; resources that declare none keep code/email. */
  private uniqueKeys(def: Resource) {
    const declared = def.fields.filter((f) => f.unique).map((f) => f.key);
    return declared.length
      ? declared
      : ["code", "email"].filter((k) => def.fields.some((f) => f.key === k));
  }
  private duplicate(
    def: Resource,
    a: Record<string, unknown>,
    b: Record<string, unknown>,
  ): boolean {
    return this.uniqueKeys(def).some(
      (k) =>
        a[k] !== undefined && a[k] !== null && a[k] !== "" && b[k] === a[k],
    );
  }
  /** Columns a list can filter and sort on: system columns plus the declared fields. */
  private columnTypes(def: Resource, use: "filter" | "sort") {
    const types: Record<string, string> = {
      id: "string",
      createdAt: "datetime",
      updatedAt: "datetime",
    };
    for (const f of def.fields)
      if ((use === "filter" ? f.filterable : f.sortable) !== false)
        types[f.key] = f.ref ? "ref" : f.type;
    return types;
  }
  /** id → name of every record of the resources `def` points to. */
  private async referenceNames(def: Resource, keys?: string[]) {
    const names = new Map<string, Map<string, string>>();
    for (const f of def.fields)
      if (f.ref && !names.has(f.ref) && (!keys || keys.includes(f.key)))
        names.set(
          f.ref,
          new Map(
            (await this.repo.list(f.ref)).map((r) => [
              r.id,
              String(r.name ?? r.displayName ?? r.code ?? ""),
            ]),
          ),
        );
    return names;
  }
  /**
   * Column descriptions for the web's table, filter bar and import mapping: type, label, which
   * operators apply, options of a select, target of a reference.
   */
  async columns(name: string, actor: Actor) {
    const def = this.access(name, actor, "read");
    const filterable = this.columnTypes(def, "filter");
    const sortable = this.columnTypes(def, "sort");
    const describe = (
      key: string,
      type: string,
      extra: Partial<Field> = {},
    ) => ({
      key,
      label: extra.label ?? key,
      type: extra.ref ? "ref" : type,
      required: Boolean(extra.required),
      sortable: key in sortable,
      filterable: key in filterable,
      operators:
        key in filterable ? operatorsFor(extra.ref ? "ref" : type) : [],
      facet: Boolean(extra.ref) || ["select", "boolean"].includes(type),
      ...(extra.options ? { options: extra.options } : {}),
      ...(extra.ref ? { ref: extra.ref } : {}),
      ...(extra.unique ? { unique: true } : {}),
      ...(extra.description ? { description: extra.description } : {}),
      system: !def.fields.some((f) => f.key === key),
    });
    return [
      describe("id", "string", { label: "ID" }),
      ...def.fields.map((f) => describe(f.key, f.type, f)),
      describe("createdAt", "datetime", { label: "Tạo lúc" }),
      describe("updatedAt", "datetime", { label: "Sửa lúc" }),
    ];
  }
  /** Scoped, filtered, searched and sorted records; `list` pages them and `export` takes all. */
  private async query(
    def: Resource,
    query: Record<string, unknown>,
    actor: Actor,
  ) {
    const conditions = parseFilterConditions(
      query.filters,
      this.columnTypes(def, "filter"),
    );
    const sort = String(query.sortBy ?? "createdAt");
    if (!(sort in this.columnTypes(def, "sort")))
      throw new BadRequestException("INVALID_SORT");
    if (query.sortOrder && !["asc", "desc"].includes(String(query.sortOrder)))
      throw new BadRequestException("INVALID_SORT");
    const scope = (await this.repo.list(def.name)).filter((x) =>
      this.visible(def.name, x, actor),
    );
    let items = scope.filter((x) =>
      conditions.every((c) => meets(x[c.field], c, fold)),
    );
    const names = await this.referenceNames(def);
    if (query.search) {
      // Every word must appear, accents and case ignored; a reference also matches by its name.
      const words = fold(String(query.search)).split(/\s+/).filter(Boolean);
      items = items.filter((x) => {
        const text = fold(
          def.fields
            .map((f) =>
              [
                x[f.key] ?? "",
                f.ref ? (names.get(f.ref)?.get(String(x[f.key])) ?? "") : "",
              ].join(" "),
            )
            .join(" "),
        );
        return words.every((word) => text.includes(word));
      });
    }
    // A reference sorts by the name people see, not by its id; empty values go last.
    const ref = def.fields.find((f) => f.key === sort)?.ref;
    const key = (x: RecordEntity) =>
      ref ? (names.get(ref)?.get(String(x[sort])) ?? x[sort]) : x[sort];
    const direction = query.sortOrder === "asc" ? 1 : -1;
    items.sort(
      (a, b) =>
        direction * compareCells(key(a), key(b)) || a.id.localeCompare(b.id),
    );
    return { items, scope };
  }
  /** `columns=a,b`: the record fields to return (id and version always come along). */
  private projection(def: Resource, raw: unknown) {
    if (raw === undefined || raw === "") return null;
    const requested = String(raw)
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    const available = [
      "id",
      "version",
      "createdAt",
      "updatedAt",
      "origin",
      ...def.fields.map((f) => f.key),
    ];
    if (!requested.length || requested.some((c) => !available.includes(c)))
      throw new BadRequestException("INVALID_COLUMN");
    return new Set(["id", "version", ...requested]);
  }
  /** `facets=kind,active`: distinct values with counts over the caller's whole scope. */
  private facets(def: Resource, raw: unknown, scope: RecordEntity[]) {
    if (raw === undefined || raw === "") return undefined;
    const keys = String(raw)
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    const out: Record<string, { value: string; count: number }[]> = {};
    for (const key of keys) {
      const field = def.fields.find((f) => f.key === key);
      if (!field || !(field.ref || ["select", "boolean"].includes(field.type)))
        throw new BadRequestException("INVALID_FACET");
      const counts = new Map<string, number>();
      for (const row of scope) {
        const value = row[key];
        if (value === undefined || value === null || value === "") continue;
        counts.set(String(value), (counts.get(String(value)) ?? 0) + 1);
      }
      out[key] = [...counts]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => compareCells(a.value, b.value));
    }
    return out;
  }
  async list(name: string, raw: object, actor: Actor) {
    const query = raw as Record<string, unknown>;
    const def = this.access(name, actor, "read");
    const { page: asked, limit } = parsePage(query);
    const pick = this.projection(def, query.columns);
    const { items, scope } = await this.query(def, query, actor);
    const facets = this.facets(def, query.facets, scope);
    // A page past the end (rows removed meanwhile) is answered with the last page, as the
    // workflow lists do; the client follows the page it was served.
    const totalPages = Math.max(1, Math.ceil(items.length / limit));
    const page = Math.min(asked, totalPages);
    return {
      items: items
        .slice((page - 1) * limit, page * limit)
        .map((x) => this.shown(name, x, actor))
        .map((x) =>
          pick
            ? Object.fromEntries(Object.entries(x).filter(([k]) => pick.has(k)))
            : x,
        ),
      total: items.length,
      page,
      limit,
      totalPages,
      scopeTotal: scope.length,
      ...(facets ? { facets } : {}),
    };
  }
  async get(name: string, id: string, actor: Actor) {
    this.access(name, actor, "read");
    const item = (await this.repo.list(name)).find(
      (x) => x.id === id && this.visible(name, x, actor),
    );
    if (!item) throw new NotFoundException("RECORD_NOT_FOUND");
    return this.shown(name, item, actor);
  }
  private async newRecord(
    name: string,
    data: Record<string, unknown>,
    actor: Actor,
  ): Promise<RecordEntity> {
    const now = new Date().toISOString();
    const item: RecordEntity = {
      ...data,
      id: randomUUID(),
      version: 1,
      organizationId: actor.organizationId,
      createdAt: now,
      updatedAt: now,
    };
    if (name === "users") {
      item.organizationId = String(data.organizationId);
      item.passwordHash = await bcrypt.hash(randomUUID(), 12);
      item.active = data.active ?? true;
    }
    return item;
  }
  async create(name: string, body: unknown, actor: Actor) {
    const def = this.access(name, actor, "create");
    const data = this.validate(def, body);
    await this.checkReferences(def, data);
    await this.assertAccountManageable(name, actor, data);
    const item = await this.newRecord(name, data, actor);
    await this.repo.mutate(
      name,
      (items) => {
        if (items.some((x) => this.duplicate(def, data, x)))
          throw new ConflictException("DUPLICATE_RECORD");
        items.push(item);
      },
      this.auditRecord("CREATE", name, item.id, actor),
    );
    return this.clean(item);
  }
  async update(name: string, id: string, body: unknown, actor: Actor) {
    const def = this.access(name, actor, "update");
    const data = this.validate(def, body, true);
    await this.checkReferences(def, data);
    const current = await this.get(name, id, actor);
    await this.assertAccountManageable(name, actor, current, {
      ...current,
      ...data,
    });
    if (
      name === "users" &&
      id === actor.id &&
      (data.role !== undefined || data.active === false)
    )
      throw new ForbiddenException("CANNOT_REMOVE_OWN_ACCESS");
    const expected = (body as Record<string, unknown>).version;
    if (!Number.isInteger(expected))
      throw new BadRequestException("VERSION_REQUIRED");
    let updated!: RecordEntity;
    await this.repo.mutate(
      name,
      (items) => {
        const i = items.findIndex(
          (x) => x.id === id && this.visible(name, x, actor),
        );
        if (i < 0) throw new NotFoundException();
        this.assertUnmanaged(def, items[i]);
        if (items[i].version !== expected)
          throw new ConflictException("VERSION_CONFLICT");
        if (items.some((x) => x.id !== id && this.duplicate(def, data, x)))
          throw new ConflictException("DUPLICATE_RECORD");
        updated = {
          ...items[i],
          ...data,
          version: items[i].version + 1,
          updatedAt: new Date().toISOString(),
        };
        items[i] = updated;
      },
      this.auditRecord("UPDATE", name, id, actor),
    );
    return this.clean(updated);
  }
  async remove(name: string, id: string, actor: Actor) {
    const def = this.access(name, actor, "delete");
    await this.assertAccountManageable(
      name,
      actor,
      await this.get(name, id, actor),
    );
    if (name === "users" && id === actor.id)
      throw new ForbiddenException("CANNOT_DELETE_SELF");
    await this.repo.mutate(
      name,
      (items) => {
        const index = items.findIndex(
          (x) => x.id === id && this.visible(name, x, actor),
        );
        if (index < 0) throw new NotFoundException();
        this.assertUnmanaged(def, items[index]);
        items.splice(index, 1);
      },
      this.auditRecord("DELETE", name, id, actor),
    );
    return { deleted: true };
  }
  /**
   * Rows of an import, from JSON `items` or a CSV text. CSV headers match a field key or label (or
   * go through `mapping`); CSV cells are text, so they are read as the field's type here.
   */
  private importInput(def: Resource, body: unknown) {
    const input = (body ?? {}) as {
      items?: unknown;
      csv?: unknown;
      mapping?: unknown;
      mode?: unknown;
      key?: unknown;
    };
    const mode = (input.mode ?? "all-or-nothing") as ImportMode;
    if (!(IMPORT_MODES as readonly string[]).includes(mode))
      throw new BadRequestException("INVALID_IMPORT_MODE");
    let rows: unknown[];
    if (typeof input.csv === "string") {
      if (input.items !== undefined)
        throw new BadRequestException("INVALID_IMPORT");
      let table: string[][];
      try {
        table = parseCsv(input.csv);
      } catch {
        throw new BadRequestException("INVALID_CSV");
      }
      const [headers = [], ...lines] = table;
      const mapping =
        input.mapping && typeof input.mapping === "object"
          ? (input.mapping as Record<string, unknown>)
          : {};
      const keys = headers.map((raw) => {
        const header = raw.trim();
        const mapped = mapping[header];
        const field = def.fields.find(
          (f) =>
            f.key === (typeof mapped === "string" ? mapped : header) ||
            (mapped === undefined &&
              f.label !== undefined &&
              fold(f.label) === fold(header)),
        );
        // `id`, `createdAt`… of an exported file are ignored rather than refused.
        if (
          !field &&
          !["id", "version", "createdAt", "updatedAt", "origin"].includes(
            header,
          ) &&
          !header.endsWith("_name")
        )
          throw new ValidationProblem([`UNKNOWN_COLUMN:${header}`]);
        return field;
      });
      rows = lines.map((cells) =>
        Object.fromEntries(
          keys.flatMap((field, i) => {
            const cell = (cells[i] ?? "").trim();
            if (!field || cell === "") return [];
            return [[field.key, readCell(field, cell)]];
          }),
        ),
      );
    } else rows = input.items as unknown[];
    if (!Array.isArray(rows) || !rows.length || rows.length > MAX_BATCH)
      throw new BadRequestException("INVALID_IMPORT");
    const key = mode === "upsert" ? String(input.key ?? "") : undefined;
    if (key !== undefined && !this.uniqueKeys(def).includes(key))
      throw new BadRequestException("INVALID_IMPORT_KEY");
    return { rows, mode, key };
  }
  /**
   * Checks every row the way the import will write it: field rules, references, unique values
   * against the stored records and the rows above it, and (upsert) the record a row updates.
   */
  private async planImport(def: Resource, body: unknown, actor: Actor) {
    const { rows, mode, key } = this.importInput(def, body);
    const existing = await this.repo.list(def.name);
    const cache = new Map<string, Set<string>>();
    const accepted: Record<string, unknown>[] = [];
    const results = [];
    for (const [index, row] of rows.entries()) {
      const field = key ? def.fields.find((f) => f.key === key) : undefined;
      const wanted =
        field && row && typeof row === "object"
          ? normalizeField(field, (row as Record<string, unknown>)[field.key])
          : undefined;
      const target =
        key && wanted !== undefined && wanted !== ""
          ? existing.find((x) => x[key] === wanted)
          : undefined;
      const { errors, data } = this.fieldErrors(def, row, Boolean(target));
      errors.push(...(await this.referenceErrors(def, data, cache)));
      if (target && !this.visible(def.name, target, actor))
        errors.push("RECORD_NOT_FOUND");
      else if (target && def.managedOrigins?.includes(String(target.origin)))
        errors.push("MANAGED_RECORD");
      if (
        [...existing.filter((x) => x.id !== target?.id), ...accepted].some(
          (other) => this.duplicate(def, data, other),
        )
      )
        errors.push("DUPLICATE_RECORD");
      if (!errors.length) accepted.push(data);
      results.push({
        row: index + 1,
        data: row,
        status: errors.length ? ("invalid" as const) : ("valid" as const),
        action: target ? ("update" as const) : ("create" as const),
        ...(target ? { targetId: target.id } : {}),
        errors,
        values: data,
      });
    }
    return { mode, results };
  }
  /**
   * Dry run of an import: one result per row with every problem found, so the user can fix the
   * file before anything is written (Base import-export: validate, then import).
   */
  async validateImport(name: string, body: unknown, actor: Actor) {
    const def = this.access(name, actor, "import");
    const { results } = await this.planImport(def, body, actor);
    const valid = results.filter((r) => r.status === "valid");
    return {
      summary: {
        total: results.length,
        valid: valid.length,
        error: results.length - valid.length,
      },
      plan: {
        create: valid.filter((r) => r.action === "create").length,
        update: valid.filter((r) => r.action === "update").length,
      },
      results: results.map(({ values: _values, ...r }) => r),
    };
  }
  /**
   * `all-or-nothing` (default) and `upsert`: one invalid row rejects the file, with every problem
   * and its row. `skip-invalid`: valid rows are written, the others come back in `errors`.
   */
  async import(name: string, body: unknown, actor: Actor) {
    const def = this.access(name, actor, "import");
    const { mode, results } = await this.planImport(def, body, actor);
    const invalid = results.filter((r) => r.status === "invalid");
    const issues = invalid.flatMap((r) =>
      r.errors.map((e) => toFieldIssue(e, r.row)),
    );
    if (invalid.length && mode !== "skip-invalid")
      throw new ValidationProblem(issues, invalid[0].errors[0]);
    const valid = results.filter((r) => r.status === "valid");
    if (!valid.length)
      throw new ValidationProblem(issues, invalid[0]?.errors[0]);
    const created: RecordEntity[] = [];
    for (const r of valid.filter((r) => r.action === "create"))
      created.push(await this.newRecord(name, r.values, actor));
    const updates = valid.filter((r) => r.action === "update");
    await this.repo.mutate(
      name,
      (items) => {
        // Checked again inside the write: another request may have changed the table meanwhile.
        const now = new Date().toISOString();
        for (const r of updates) {
          const i = items.findIndex((x) => x.id === r.targetId);
          if (i < 0) throw new NotFoundException("RECORD_NOT_FOUND");
          this.assertUnmanaged(def, items[i]);
          items[i] = {
            ...items[i],
            ...r.values,
            version: items[i].version + 1,
            updatedAt: now,
          };
        }
        for (const item of created) {
          if (items.some((x) => this.duplicate(def, item, x)))
            throw new ConflictException("DUPLICATE_RECORD");
          items.push(item);
        }
        for (const r of updates)
          if (
            items.some(
              (x) => x.id !== r.targetId && this.duplicate(def, r.values, x),
            )
          )
            throw new ConflictException("DUPLICATE_RECORD");
      },
      this.auditRecord(
        "IMPORT",
        name,
        `created=${created.length};updated=${updates.length};skipped=${invalid.length}`,
        actor,
      ),
    );
    return {
      created: created.length,
      updated: updates.length,
      skipped: invalid.length,
      ...(invalid.length ? { errors: issues } : {}),
    };
  }
  /**
   * Header row plus one sample row, in the column order the import expects. `header=label` writes
   * the labels (the import reads both).
   */
  async template(name: string, actor: Actor, header: unknown = "key") {
    const def = this.access(name, actor, "import");
    if (!["key", "label"].includes(String(header)))
      throw new BadRequestException("INVALID_HEADER");
    const sample: Record<string, unknown> = {};
    for (const f of def.fields) {
      const ref = f.ref ? (await this.repo.list(f.ref))[0]?.id : undefined;
      sample[f.key] =
        ref ??
        (f.options
          ? f.options[0]
          : f.type === "boolean"
            ? true
            : f.type === "number"
              ? (f.min ?? 1)
              : f.type === "email"
                ? "name@example.com"
                : "");
    }
    const csv = toCsv(
      def.fields.map((f) => f.key),
      [sample],
    );
    if (header !== "label") return csv;
    const labels = toCsv(
      def.fields.map((f) => f.label ?? f.key),
      [],
    );
    return labels + csv.slice(csv.indexOf("\r\n") + 2);
  }
  /**
   * Server-side export of the whole filtered result (Base import-export). Reference fields get a
   * `<field>_name` column with the referenced record's name. `header=label` titles the columns with
   * their labels; more than MAX_EXPORT rows is refused so one request cannot pin the server.
   */
  async export(name: string, raw: object, actor: Actor) {
    const query = raw as Record<string, unknown>;
    const def = this.access(name, actor, "export");
    const format = String(query.format ?? "csv");
    if (!["csv", "json", "xlsx"].includes(format))
      throw new BadRequestException("INVALID_FORMAT");
    const header = String(query.header ?? "key");
    if (!["key", "label"].includes(header))
      throw new BadRequestException("INVALID_HEADER");
    let items = (await this.query(def, query, actor)).items;
    if (query.limit !== undefined) {
      const limit = Number(query.limit);
      const page = Number(query.page ?? 1);
      if (
        !Number.isInteger(limit) ||
        limit < 1 ||
        !Number.isInteger(page) ||
        page < 1
      )
        throw new BadRequestException("INVALID_PAGINATION");
      items = items.slice((page - 1) * limit, page * limit);
    }
    if (items.length > MAX_EXPORT)
      throw new PayloadTooLargeException("EXPORT_TOO_LARGE");
    const shown = items.map((x) => this.shown(name, x, actor));
    const available = [
      "id",
      ...def.fields.map((f) => f.key),
      "origin",
      "createdAt",
      "updatedAt",
    ];
    const requested = query.columns
      ? String(query.columns)
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean)
      : def.fields.map((f) => f.key);
    if (
      !requested.length ||
      requested.some((column) => !available.includes(column))
    )
      throw new BadRequestException("INVALID_COLUMN");
    const names = await this.referenceNames(def, requested);
    const columns = requested.flatMap((column) => {
      const field = def.fields.find((f) => f.key === column);
      return field?.ref ? [column, `${column}_name`] : [column];
    });
    const rows = shown.map((item) =>
      Object.fromEntries(
        columns.map((column) => {
          if (column.endsWith("_name")) {
            const key = column.slice(0, -"_name".length);
            const field = def.fields.find((f) => f.key === key);
            if (field?.ref)
              return [
                column,
                names.get(field.ref)?.get(String(item[key])) ?? "",
              ];
          }
          return [column, item[column] ?? ""];
        }),
      ),
    );
    const titles = columns.map((column) => {
      if (header === "key") return column;
      const base = column.endsWith("_name") ? column.slice(0, -5) : column;
      const field = def.fields.find((f) => f.key === base);
      const label = field?.label ?? SYSTEM_LABELS[base] ?? base;
      return column === base ? label : `${label} (tên)`;
    });
    await this.audit("EXPORT", name, String(rows.length), actor);
    const fileName = stampedName(name);
    if (format === "json")
      return {
        contentType: "application/json",
        fileName: `${fileName}.json`,
        body: JSON.stringify(rows, null, 2),
      };
    if (format === "xlsx")
      return {
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        fileName: `${fileName}.xlsx`,
        body: await toXlsx(name, titles, columns, rows),
      };
    const csvRows = rows.map((row) =>
      Object.fromEntries(columns.map((c, i) => [titles[i], row[c]])),
    );
    return {
      contentType: "text/csv; charset=utf-8",
      fileName: `${fileName}.csv`,
      body: toCsv(titles, csvRows),
    };
  }
  async bulkDelete(name: string, body: unknown, actor: Actor) {
    const def = this.access(name, actor, "delete");
    const ids = (body as any)?.ids;
    if (
      !Array.isArray(ids) ||
      !ids.length ||
      ids.length > MAX_BATCH ||
      ids.some((x) => typeof x !== "string")
    )
      throw new BadRequestException("INVALID_BATCH");
    if (name === "users" && ids.includes(actor.id))
      throw new ForbiddenException("CANNOT_DELETE_SELF");
    await this.assertAccountManageable(
      name,
      actor,
      ...(await this.repo.list(name)).filter((item) => ids.includes(item.id)),
    );
    await this.repo.mutate(
      name,
      (items) => {
        for (const id of ids) {
          const item = items.find(
            (x) => x.id === id && this.visible(name, x, actor),
          );
          if (!item) throw new NotFoundException("RECORD_NOT_FOUND");
          this.assertUnmanaged(def, item);
        }
        for (let i = items.length - 1; i >= 0; i--)
          if (ids.includes(items[i].id)) items.splice(i, 1);
      },
      this.auditRecord("BULK_DELETE", name, ids.join(","), actor),
    );
    return { deleted: ids.length };
  }
  auditRecord(
    action: string,
    resource: string,
    recordId: string,
    actor: Actor,
  ): RecordEntity {
    const now = new Date().toISOString();
    return {
      id: randomUUID(),
      version: 1,
      createdAt: now,
      updatedAt: now,
      organizationId: actor.organizationId,
      action,
      resource,
      recordId,
      actorId: actor.id,
      actorName: actor.displayName,
      actorRole: actor.role,
    };
  }
  async audit(
    action: string,
    resource: string,
    recordId: string,
    actor: Actor,
  ) {
    await this.repo.mutate("audit", (items) =>
      items.push(this.auditRecord(action, resource, recordId, actor)),
    );
  }
}
