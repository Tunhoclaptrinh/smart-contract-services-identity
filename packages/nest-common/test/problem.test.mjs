// Unit tests of the error format and the resource validation that every service inherits.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BaseService,
  Repository,
  ValidationProblem,
  flattenValidationErrors,
  problemBody,
  toFieldIssue,
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
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "chassis-"));
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

test("field codes split into field and code", () => {
  assert.deepEqual(toFieldIssue("REQUIRED:name"), {
    field: "name",
    code: "REQUIRED",
  });
  assert.deepEqual(toFieldIssue("INVALID_EMAIL"), {
    field: "email",
    code: "INVALID_EMAIL",
  });
  assert.deepEqual(toFieldIssue("UNKNOWN_FIELD", 3), {
    field: "",
    code: "UNKNOWN_FIELD",
    row: 3,
  });
});

test("a validation problem keeps the first code as message and lists all", () => {
  const error = new ValidationProblem(["REQUIRED:name", "INVALID_OPTION:kind"]);
  assert.equal(error.getStatus(), 400);
  assert.equal(error.message, "REQUIRED:name");
  assert.equal(error.getResponse().errors.length, 2);
});

test("problem body follows RFC 9457 and keeps the old fields", () => {
  const body = problemBody({
    status: 409,
    code: "VERSION_CONFLICT",
    requestId: "r1",
    instance: "/api/v1/x",
  });
  assert.equal(body.type, "urn:problem:version-conflict");
  assert.equal(body.title, "Conflict");
  assert.equal(body.status, 409);
  assert.equal(body.statusCode, 409);
  assert.equal(body.code, "VERSION_CONFLICT");
  assert.equal(body.traceId, "r1");
  assert.equal(body.errors, undefined);
});

test("class-validator errors map to our codes, nested included", () => {
  const issues = flattenValidationErrors([
    { property: "limit", constraints: { max: "x" }, children: [] },
    {
      property: "items",
      children: [
        { property: "0", constraints: { isObject: "x" }, children: [] },
      ],
    },
  ]);
  assert.deepEqual(issues, [
    { field: "limit", code: "INVALID_NUMBER" },
    { field: "items.0", code: "INVALID_IS_OBJECT" },
  ]);
});

test("create reports every field problem at once", async () => {
  await assert.rejects(
    service.create("organizations", { kind: "NOPE", email: "x" }, admin),
    (error) => {
      assert.equal(error.message, "REQUIRED:name");
      assert.deepEqual(
        error.getResponse().errors.map((e) => `${e.code}:${e.field}`),
        [
          "REQUIRED:name",
          "REQUIRED:code",
          "INVALID_OPTION:kind",
          "INVALID_EMAIL:email",
        ],
      );
      return true;
    },
  );
});

test("import refuses the file with every problem and its row", async () => {
  await assert.rejects(
    service.import(
      "organizations",
      {
        items: [
          { name: "A", code: "A1", kind: "BUYER" },
          { name: "B", kind: "NOPE" },
        ],
      },
      admin,
    ),
    (error) => {
      assert.deepEqual(error.getResponse().errors, [
        { field: "code", code: "REQUIRED", row: 2 },
        { field: "kind", code: "INVALID_OPTION", row: 2 },
      ]);
      return true;
    },
  );
  assert.equal((await repo.list("organizations")).length, 0);
});
