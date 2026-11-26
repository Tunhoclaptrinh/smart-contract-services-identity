// Imports: CSV with headers by key or label, typed cells, modes, upsert by a unique key.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { BaseService, Repository, parseCsv } from "../dist/index.js";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const admin = {
  id: "admin",
  email: "admin@example.test",
  displayName: "Admin",
  role: "SYSTEM_ADMIN",
  organizationId: "OPS",
  roleChipOrganization: "OPS",
  partyId: null,
  title: "",
  permissions: [],
};
let repo, service, dir;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "chassis-import-"));
  Object.assign(process.env, {
    DATA_DIR: dir,
    STORAGE_DRIVER: "file",
    REPO_ROOT: repoRoot,
  });
  repo = new Repository();
  await repo.init();
  service = new BaseService(repo);
});
afterEach(async () => {
  await repo.onModuleDestroy();
  await rm(dir, { recursive: true, force: true });
});
const orgs = () => repo.list("organizations");

test("the CSV reader handles quotes, CRLF, BOM, semicolons and blank lines", () => {
  assert.deepEqual(parseCsv('﻿a,b\r\n"x, ""y""",2\r\n\r\n'), [
    ["a", "b"],
    ['x, "y"', "2"],
  ]);
  assert.deepEqual(parseCsv("a;b\n1;2"), [
    ["a", "b"],
    ["1", "2"],
  ]);
  assert.throws(() => parseCsv('a\n"open'), /INVALID_CSV/);
});

test("a CSV import reads typed cells and ignores exported system columns", async () => {
  const csv = [
    "id,name,workflowTemplate,sequence,milestoneType,requiredEvents,paymentPercent,latePenalty,offsetDays",
    "old-id,Giao hàng,WF_GOODS_4STAGE,2,DELIVERY,E1,40,có,30",
  ].join("\n");
  const result = await service.import("milestone-templates", { csv }, admin);
  assert.deepEqual(result, { created: 1, updated: 0, skipped: 0 });
  const [row] = await repo.list("milestone-templates");
  assert.equal(row.sequence, 2);
  assert.equal(row.latePenalty, true);
  assert.notEqual(row.id, "old-id");
});

test("headers match through a mapping; unknown columns are refused", async () => {
  const csv = "Tên,Mã,Loại\nCông ty A,A1,BUYER";
  const result = await service.import(
    "organizations",
    { csv, mapping: { Tên: "name", Mã: "code", Loại: "kind" } },
    admin,
  );
  assert.equal(result.created, 1);
  await assert.rejects(
    service.import("organizations", { csv: "name,ghost\nX,1" }, admin),
    /UNKNOWN_COLUMN:ghost/,
  );
});

test("skip-invalid writes the valid rows and returns the others", async () => {
  const result = await service.import(
    "organizations",
    {
      mode: "skip-invalid",
      items: [
        { name: "A", code: "A1", kind: "BUYER" },
        { name: "B", code: "A1", kind: "BUYER" },
        { name: "C", kind: "NOPE" },
      ],
    },
    admin,
  );
  assert.equal(result.created, 1);
  assert.equal(result.skipped, 2);
  assert.deepEqual(
    result.errors.map((e) => [e.row, e.code]),
    [
      [2, "DUPLICATE_RECORD"],
      [3, "REQUIRED"],
      [3, "INVALID_OPTION"],
    ],
  );
  assert.equal((await orgs()).length, 1);
});

test("upsert updates the record with the same unique key and creates the rest", async () => {
  await service.create(
    "organizations",
    { name: "A", code: "A1", kind: "BUYER" },
    admin,
  );
  const body = {
    mode: "upsert",
    key: "code",
    items: [
      { code: "A1", name: "A mới" },
      { name: "B", code: "B1", kind: "SUPPLIER" },
    ],
  };
  const plan = await service.validateImport("organizations", body, admin);
  assert.deepEqual(plan.plan, { create: 1, update: 1 });
  const result = await service.import("organizations", body, admin);
  assert.deepEqual(result, { created: 1, updated: 1, skipped: 0 });
  const a = (await orgs()).find((x) => x.code === "A1");
  assert.equal(a.name, "A mới");
  assert.equal(a.version, 2);
  await assert.rejects(
    service.import("organizations", { ...body, key: "name" }, admin),
    /INVALID_IMPORT_KEY/,
  );
});

test("the template can carry labels; the import reads either", async () => {
  const keys = await service.template("organizations", admin);
  assert.match(keys, /^﻿name,code,kind/);
  await assert.rejects(
    service.template("organizations", admin, "x"),
    /INVALID_HEADER/,
  );
});
