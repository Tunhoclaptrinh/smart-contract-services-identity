// Exports: labels as headers, formula guard, XLSX, file names, the row cap.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import {
  BaseService,
  Repository,
  attachmentHeader,
  safeCell,
  stampedName,
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
  dir = await mkdtemp(join(tmpdir(), "chassis-export-"));
  Object.assign(process.env, {
    DATA_DIR: dir,
    STORAGE_DRIVER: "file",
    REPO_ROOT: repoRoot,
  });
  repo = new Repository();
  await repo.init();
  service = new BaseService(repo);
  await service.create(
    "organizations",
    { name: '=HYPERLINK("x")', code: "A1", kind: "BUYER" },
    admin,
  );
});
afterEach(async () => {
  await repo.onModuleDestroy();
  await rm(dir, { recursive: true, force: true });
});

test("formula-looking cells are neutralised, tab and CR included", () => {
  for (const bad of ["=1", "+1", "-1", "@x", "\tx", "\rx"])
    assert.equal(safeCell(bad).startsWith("'"), true, JSON.stringify(bad));
  assert.equal(safeCell("ok"), "ok");
});

test("file names carry a stamp and a UTF-8 form", () => {
  assert.equal(
    stampedName("orgs", new Date("2026-11-26T22:08:00Z")),
    "orgs_20261126-2208",
  );
  assert.equal(
    attachmentHeader("hợp đồng.csv"),
    "attachment; filename=\"hop dong.csv\"; filename*=UTF-8''h%E1%BB%A3p%20%C4%91%E1%BB%93ng.csv",
  );
});

test("CSV export can title columns with their labels", async () => {
  const file = await service.export(
    "organizations",
    { columns: "code,name", header: "label" },
    admin,
  );
  const lines = file.body.replace("﻿", "").trim().split("\r\n");
  assert.deepEqual(lines, ["Mã,Tên tổ chức", `A1,"'=HYPERLINK(""x"")"`]);
  assert.match(file.fileName, /^organizations_\d{8}-\d{4}\.csv$/);
});

test("XLSX export is a real workbook with a typed, guarded sheet", async () => {
  const file = await service.export(
    "organizations",
    { format: "xlsx", columns: "code,name,kind" },
    admin,
  );
  assert.ok(Buffer.isBuffer(file.body));
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(file.body);
  const sheet = book.worksheets[0];
  assert.deepEqual(sheet.getRow(1).values.slice(1), ["code", "name", "kind"]);
  assert.equal(sheet.getRow(2).getCell(2).value, '\'=HYPERLINK("x")');
});

test("unknown formats and headers are refused; big exports are capped", async () => {
  await assert.rejects(
    service.export("organizations", { format: "pdf" }, admin),
    /INVALID_FORMAT/,
  );
  await assert.rejects(
    service.export("organizations", { header: "x" }, admin),
    /INVALID_HEADER/,
  );
  const now = new Date().toISOString();
  await repo.mutate("organizations", (items) => {
    for (let i = 0; i < 10_001; i++)
      items.push({
        id: `o${i}`,
        version: 1,
        createdAt: now,
        updatedAt: now,
        name: `O${i}`,
        code: `C${i}`,
        kind: "BUYER",
        organizationId: "OPS",
      });
  });
  await assert.rejects(service.export("organizations", {}, admin), (e) => {
    assert.equal(e.getStatus(), 413);
    assert.equal(e.message, "EXPORT_TOO_LARGE");
    return true;
  });
});
