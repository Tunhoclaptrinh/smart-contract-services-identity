// The generic list: filter operators, typed values, reference sorting, columns and facets.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BaseService,
  Repository,
  parseFilterConditions,
} from "../dist/index.js";

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
const step = (sequence, extra = {}) => ({
  name: `Bước ${sequence}`,
  workflowTemplate: "WF_GOODS_4STAGE",
  sequence,
  milestoneType: "DELIVERY",
  requiredEvents: "E1",
  paymentPercent: "25",
  offsetDays: sequence * 10,
  ...extra,
});
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "chassis-list-"));
  Object.assign(process.env, {
    DATA_DIR: dir,
    STORAGE_DRIVER: "file",
    REPO_ROOT: repoRoot,
  });
  repo = new Repository();
  await repo.init();
  service = new BaseService(repo);
  for (const [i, extra] of [
    { latePenalty: true },
    { latePenalty: false, name: "Nghiệm thu đợt 2" },
    { workflowTemplate: "WF_SERVICE_4STAGE" },
    { latePenalty: true, name: "Bước 10 bảo hành" },
  ].entries())
    await service.create("milestone-templates", step(i + 1, extra), admin);
});
afterEach(async () => {
  await repo.onModuleDestroy();
  await rm(dir, { recursive: true, force: true });
});
const list = (query) => service.list("milestone-templates", query, admin);
const names = (page) => page.items.map((x) => x.name);

test("the earlier forms still work: one value or a list", async () => {
  assert.equal(
    (await list({ filters: '{"workflowTemplate":"WF_SERVICE_4STAGE"}' })).total,
    1,
  );
  assert.equal(
    (
      await list({
        filters: { workflowTemplate: ["WF_SERVICE_4STAGE", "WF_GOODS_4STAGE"] },
      })
    ).total,
    4,
  );
});

test("numbers from a query string compare as numbers", async () => {
  const page = await list({
    filters: '{"sequence":{"gte":"2","lt":4}}',
    sortBy: "sequence",
    sortOrder: "asc",
  });
  assert.deepEqual(
    page.items.map((x) => x.sequence),
    [2, 3],
  );
  assert.equal(
    (await list({ filters: '{"offsetDays":{"between":[15,35]}}' })).total,
    2,
  );
  assert.throws(
    () => parseFilterConditions('{"n":{"gte":"x"}}', { n: "number" }),
    /INVALID_FILTER/,
  );
});

test("booleans from a query string, ne, nin and isNull", async () => {
  assert.equal((await list({ filters: '{"latePenalty":"true"}' })).total, 2);
  assert.equal(
    (await list({ filters: '{"latePenalty":{"isNull":true}}' })).total,
    1,
  );
  assert.equal(
    (await list({ filters: '{"workflowTemplate":{"ne":"WF_GOODS_4STAGE"}}' }))
      .total,
    1,
  );
  assert.equal(
    (await list({ filters: '{"sequence":{"nin":[1,2]}}' })).total,
    2,
  );
});

test("contains and startsWith ignore accents and case", async () => {
  assert.deepEqual(
    names(await list({ filters: '{"name":{"contains":"NGHIEM THU"}}' })),
    ["Nghiệm thu đợt 2"],
  );
  assert.equal(
    (await list({ filters: '{"name":{"startsWith":"buoc"}}' })).total,
    3,
  );
});

test("operators that do not fit the field type are refused", async () => {
  for (const bad of [
    '{"latePenalty":{"gte":true}}',
    '{"workflowTemplate":{"contains":"WF"}}',
    '{"sequence":{"between":[1]}}',
    '{"name":{"regex":".*"}}',
    '{"passwordHash":"x"}',
    '{"name":{"isNull":"yes"}}',
  ])
    await assert.rejects(list({ filters: bad }), /INVALID_FILTER/, bad);
});

test("text sorts in Vietnamese order with numeric parts", async () => {
  const page = await list({ sortBy: "name", sortOrder: "asc" });
  assert.deepEqual(names(page), [
    "Bước 1",
    "Bước 3",
    "Bước 10 bảo hành",
    "Nghiệm thu đợt 2",
  ]);
});

test("columns projects fields, facets count over the whole scope", async () => {
  const page = await list({
    columns: "name,sequence",
    facets: "workflowTemplate,latePenalty",
    filters: '{"sequence":1}',
  });
  assert.deepEqual(Object.keys(page.items[0]).sort(), [
    "id",
    "name",
    "sequence",
    "version",
  ]);
  assert.equal(page.total, 1);
  assert.equal(page.scopeTotal, 4);
  assert.deepEqual(page.facets.workflowTemplate, [
    { value: "WF_GOODS_4STAGE", count: 3 },
    { value: "WF_SERVICE_4STAGE", count: 1 },
  ]);
  assert.deepEqual(page.facets.latePenalty, [
    { value: "false", count: 1 },
    { value: "true", count: 2 },
  ]);
  await assert.rejects(list({ columns: "passwordHash" }), /INVALID_COLUMN/);
  await assert.rejects(list({ facets: "name" }), /INVALID_FACET/);
});

test("the column endpoint describes types, operators and options", async () => {
  const columns = await service.columns("milestone-templates", admin);
  const by = Object.fromEntries(columns.map((c) => [c.key, c]));
  assert.equal(by.sequence.type, "number");
  assert.ok(by.sequence.operators.includes("between"));
  assert.equal(by.workflowTemplate.facet, true);
  assert.equal(by.workflowTemplate.options.length, 4);
  assert.equal(by.id.system, true);
  assert.equal(by.name.required, true);
  const users = await service.columns("users", admin);
  assert.equal(
    users.find((c) => c.key === "organizationId").ref,
    "organizations",
  );
});
