# smart-contract-services-identity

Identity service of the Smart Contract Workflow project: companies, accounts, sign-in, company
sign-up, and the access tokens every other service verifies. Port 3001. What it owns, its
endpoints and what came from CodeCash: [service/SERVICE.md](service/SERVICE.md).

This repository is a service repository: the shared base (chassis `packages/nest-common`,
configuration, CI) comes from the parent `smart-contract-services` (remote `upstream`) and is not
edited here; the identity code lives in `service/`. See [CLAUDE.md](CLAUDE.md) and
[docs/KIEN_TRUC_REPO.md](docs/KIEN_TRUC_REPO.md).

```bash
pnpm install
pnpm dev          # http://127.0.0.1:3001/api/v1, Swagger at /api/docs; seed accounts use Passw0rd!
pnpm test         # chassis storage tests, identity tests (service/test), service smoke
```

---

The parent repository's description follows.

# smart-contract-services

Parent repository of the Smart Contract Workflow services (course: Microservices). NestJS 11, TypeScript.

It holds what every service shares, and each service lives in its own repository beside it
(`btl-backend-<name>` locally, `smart-contract-services-<name>` on GitHub). See
[docs/KIEN_TRUC_REPO.md](docs/KIEN_TRUC_REPO.md).

| Path | What |
| --- | --- |
| `packages/nest-common` | The microservice chassis: storage with a sealed audit log, generic resource CRUD, errors, startup (`bootstrapService`) |
| `packages/contracts` | Resource definitions and the permission matrix |
| `service/` | Service template (with the `SERVICE.md` card); `scripts/new-service.sh <name>` creates a service repository from it |
| `CLAUDE.md` (`AGENTS.md`) | Guide for AI tools and people: sibling folders, the old code in `../codecash`, what may change, how to port |
| `docs/DOI_CHIEU_CODECASH.md` | Which CodeCash file moves to which service |
| `docs/KICH_BAN_VIBE_CODE.md` | Who does what, day by day, with prompts |

The base is ported from CodeCash (`github.com/Tunhoclaptrinh/Code-n-Cash`, commit `c667ec4`);
see `docs/PHAN_TICH.md` and `CHANGELOG.md`.

```bash
pnpm install
pnpm dev          # the template service on http://127.0.0.1:3000/api/v1
pnpm test         # chassis storage tests (PostgreSQL when DATABASE_URL is set) and a service smoke
```

## Branches

`base` holds the shared base only; `main` holds the base plus the business features. Base changes go
`core/<task>` → `base` → `main` (merge commit `sync: base → main`); features go `feat/<area>-<task>`
→ `main`. Both branches are protected (pull request, one review, CI). Details:
[docs/QUY_TRINH_NHANH.md](docs/QUY_TRINH_NHANH.md).
