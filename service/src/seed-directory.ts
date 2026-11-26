import type { Role } from "@sc/nest-common";

/**
 * Seed organisations and accounts of the base: the platform operator and one demo company, so the
 * app can be signed into before any business data exists. The full business directory (every
 * party of the sample data) has the same shape and replaces it once parties are imported.
 */
export const INTERNAL_ORG = { id: "OPS", name: "Vận hành nền tảng" };

export interface OrganizationSpec {
  id: string;
  name: string;
  code: string;
  kind: "BUYER" | "SUPPLIER" | "INTERNAL";
  email: string;
  category: string;
  region: string;
  origin: "SEED";
}

export interface AccountSpec {
  id: string;
  email: string;
  displayName: string;
  title: string;
  role: Role;
  organizationId: string;
  organizationName: string;
  partyId: string | null;
  origin: "SEED";
}

const DEMO_ORG = { id: "B010", name: "Nova An Business JSC" };
const DEMO_SUPPLIER = { id: "S015", name: "Phú Minh Technology JSC" };

export function buildDirectory(): {
  organizations: OrganizationSpec[];
  accounts: AccountSpec[];
} {
  const organizations: OrganizationSpec[] = [
    {
      ...INTERNAL_ORG,
      code: INTERNAL_ORG.id,
      kind: "INTERNAL",
      email: "contact@scw.vn",
      category: "INTERNAL_CONTROL",
      region: "HANOI",
      origin: "SEED",
    },
    {
      ...DEMO_ORG,
      code: DEMO_ORG.id,
      kind: "BUYER",
      email: "contact@novaan.vn",
      category: "ENTERPRISE",
      region: "HANOI",
      origin: "SEED",
    },
    {
      ...DEMO_SUPPLIER,
      code: DEMO_SUPPLIER.id,
      kind: "SUPPLIER",
      email: "contact@phuminh.vn",
      category: "TECHNOLOGY",
      region: "HANOI",
      origin: "SEED",
    },
  ];
  const account = (
    id: string,
    email: string,
    displayName: string,
    title: string,
    role: Role,
    org: { id: string; name: string },
  ): AccountSpec => ({
    id,
    email,
    displayName,
    title,
    role,
    organizationId: org.id,
    organizationName: org.name,
    partyId: org.id === INTERNAL_ORG.id ? null : org.id,
    origin: "SEED",
  });
  const accounts = [
    account(
      "u-sysadmin",
      "sysadmin@scw.vn",
      "Trịnh Hoài Phương",
      "Quản trị hệ thống",
      "SYSTEM_ADMIN",
      INTERNAL_ORG,
    ),
    account(
      "u-auditor",
      "auditor@scw.vn",
      "Mai Xuân Lộc",
      "Chuyên viên kiểm tra toàn vẹn",
      "AUDITOR",
      INTERNAL_ORG,
    ),
    {
      ...account(
        "u-novaan-admin",
        "admin@novaan.vn",
        "Hoàng Thu Hằng",
        "Quản trị tài khoản công ty",
        "ORG_ADMIN",
        DEMO_ORG,
      ),
      partyId: null,
    },
    account(
      "u-owner",
      "owner@novaan.vn",
      "Nguyễn Văn An",
      "Giám đốc dự án",
      "CONTRACT_OWNER",
      DEMO_ORG,
    ),
    account(
      "u-novaan-controller",
      "controller@novaan.vn",
      "Đỗ Minh Khoa",
      "Kiểm soát viên nội bộ",
      "ADMIN_AUDITOR",
      DEMO_ORG,
    ),
    account(
      "u-supplier",
      "supplier@phuminh.vn",
      "Vũ Thanh Hà",
      "Đại diện nhà cung cấp",
      "SUPPLIER",
      DEMO_SUPPLIER,
    ),
  ];
  return { organizations, accounts };
}

/** Accounts offered first by the demo sign-in menu. */
export const FEATURED_ACCOUNTS = [
  "u-owner",
  "u-novaan-controller",
  "u-supplier",
  "u-novaan-admin",
  "u-sysadmin",
  "u-auditor",
];
