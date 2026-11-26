# Hướng dẫn cho AI (và người) làm việc trong repo backend

Tệp này nằm ở nhánh `base` của repo cha `smart-contract-services`, nên **mọi repo service đều có
nó**. Cursor, Codex, Copilot đọc `AGENTS.md`, tệp đó trỏ về đây. Giữ tệp này ngắn: chi tiết nằm ở
các tệp trong bảng mục 3, đọc đúng tệp cần thay vì quét mã.

## 1. Đang ở đâu

- `service/package.json` tên `@sc/service` → **repo cha** (`btl-backend`): chassis, khuôn service,
  tài liệu chung; nhánh `main` thêm gateway, `compose.yaml`, Postman.
- Tên `@sc/<tên>-service` → **repo service** (`btl-backend-<tên>`): đọc `service/SERVICE.md` trước.
- Thư mục cùng cấp: `codecash/` (MÃ CŨ, **chỉ đọc**: không sửa, không commit, không chạy lệnh ghi dữ
  liệu), `btl-backend/`, `btl-backend-<tên>/`, `btl-frontend/`. Thiếu `../codecash` thì dừng, nhắc
  `git clone https://github.com/Tunhoclaptrinh/Code-n-Cash.git codecash`.

## 2. Được sửa ở đâu

| Được sửa (nhánh `feat/…` → `main`) | Không được sửa (phần nền) |
| --- | --- |
| `service/**` (mã, test, `openapi.yaml`, `SERVICE.md`, `CHANGELOG.md` của service) | `packages/nest-common/**` (chassis) |
| `packages/contracts/{resources,permissions}.json`: **chỉ** mục resource service này sở hữu | `scripts/**`, `.github/**`, `infra/**`, cấu hình gốc (`package.json` gốc, `tsconfig*`, ESLint, Prettier, `pnpm-workspace.yaml`) |
| `README.md` (chỉ phần giới thiệu ở đầu), `pnpm-lock.yaml` | `CHANGELOG.md` gốc, `CLAUDE.md`, `AGENTS.md`, `docs/*.md` chung |
| Repo cha, `main`: `gateway/`, `postman/`, `compose.yaml` | |

CI (`scripts/check-base-untouched.mjs`) từ chối PR sửa phần nền. Thiếu gì ở phần nền thì **dừng**,
nói với người dùng cần gì, vì sao; việc đó làm ở repo cha (`docs/QUY_TRINH_NHANH.md`), rồi kéo về.
Không chép chassis vào `service/` để lách.

## 3. Cần biết gì thì đọc đâu

| Cần biết | Đọc |
| --- | --- |
| Toàn cảnh: service, cổng, schema, ai gọi ai, token, luồng chính | `docs/HE_THONG.md` |
| Phạm vi, tính năng, quy tắc BR, API từng service, saga, ma trận yêu cầu hai môn | `docs/PHAN_TICH_THIET_KE.md` |
| Vì sao chọn kiến trúc, công nghệ nào; luồng chính đồng bộ hay bất đồng bộ, đi qua service nào | `docs/LUAN_CU_KIEN_TRUC.md` |
| Chassis có gì; CRUD chung (lọc, nhập, xuất); định dạng lỗi | `packages/nest-common/MODULES.md` |
| Một service: dữ liệu, endpoint, sơ đồ mã, sơ đồ luồng | `service/SERVICE.md`, `service/openapi.yaml` |
| Nghiệp vụ: vai trò, vòng đời, luật, tính tiền, mã trạng thái | `../codecash/docs/NGHIEP_VU.md` (bản duy nhất; mục 14 là từ điển trạng thái) |
| Luồng đầu–cuối, thiết kế bảng | `../codecash/docs/33_LUONG_NGHIEP_VU_DAU_CUOI.md`, `../codecash/docs/31_THIET_KE_CSDL_POSTGRES.md` |
| Dữ liệu ban tổ chức (Data Pack) | `../codecash/BangD-Case4/DataPack-CASE4_SmartContractWorkflow/` |
| Tệp cũ nào chuyển sang service nào | `docs/DOI_CHIEU_CODECASH.md` |
| Ai làm gì, ngày nào, prompt mẫu | `docs/KICH_BAN_VIBE_CODE.md` |
| Quy trình nhánh, cấu trúc repo, kéo phần nền | `docs/QUY_TRINH_NHANH.md`, `docs/KIEN_TRUC_REPO.md` |

Mã cũ và tài liệu cũ mâu thuẫn thì `NGHIEP_VU.md` thắng; ghi chỗ mâu thuẫn vào mục "Rà soát" của
`service/SERVICE.md`.

## 4. Luật cập nhật tài liệu (cùng commit với mã)

| Khi… | Sửa |
| --- | --- |
| thêm, sửa, bỏ endpoint | `service/openapi.yaml` + bảng "Endpoint" trong `SERVICE.md` |
| thêm, đổi, bỏ tệp hay thư mục trong `service/src` | "Sơ đồ mã" trong `SERVICE.md` |
| đổi luồng nghiệp vụ, thêm sự kiện phát hoặc nhận | "Sơ đồ luồng", "Sự kiện" trong `SERVICE.md` |
| thêm collection, đổi trường | `packages/contracts/resources.json` + "Dữ liệu sở hữu" |
| thêm service, đổi cổng, schema, lời gọi giữa service, luồng token | `docs/HE_THONG.md` |
| thêm, đổi, bỏ module hay hàm xuất của chassis | `packages/nest-common/MODULES.md` + `CHANGELOG.md` gốc |
| thay đổi đáng ghi của service | `service/CHANGELOG.md` |

CI chạy `scripts/check-docs-updated.mjs` (`pnpm check:docs`): nhánh sửa `service/src/**` mà không
sửa `service/SERVICE.md`, hoặc sửa `packages/nest-common/src/**` mà không sửa `MODULES.md`, bị báo
đỏ. Thay đổi thật sự không cần ghi (sửa chính tả, tái cấu trúc bên trong) thì thêm dòng
`[no-docs] <lý do>` vào một commit message của nhánh.

## 5. Chuyển nghiệp vụ từ CodeCash (bắt buộc theo thứ tự)

1. **Tìm nguồn**: `docs/DOI_CHIEU_CODECASH.md`, `service/SERVICE.md`; mở đúng tệp trong
   `../codecash/apps/api/src/` (Python: `../codecash/apps/engine/`).
2. **Đọc trước, viết sau**: liệt kê luật nghiệp vụ tệp cũ đang làm, mỗi luật kèm mục `NGHIEP_VU.md`
   hoặc mã BR. Không tìm được nguồn thì hỏi, không bịa.
3. **Chép rồi chỉnh**, giữ tên hàm, tên trường, mã lỗi cũ: hạ tầng import từ `@sc/nest-common`; chỉ
   đọc, ghi **bảng của service này** (dữ liệu service khác lấy qua API hoặc sự kiện); người gọi lấy
   từ `req.user`, không tin vai trò, tổ chức gửi lên từ client.
4. **Rà soát**: ghi vào `SERVICE.md` mục "Rà soát" (lệch, thiếu) và "Cải tiến so với CodeCash".
   Không đổi kết quả nghiệp vụ (tiền, quyết định, trạng thái) khi chưa ghi lý do và được đồng ý.
5. **Test**: mỗi endpoint ít nhất một ca thành công và một ca lỗi 4xx có `code`; chuyển test cũ liên
   quan (`../codecash/tests/foundation/*.test.mjs`, `../codecash/tests/*.py`).
6. **Tài liệu** theo mục 4, rồi **kiểm tra** (mục 7) xanh mới báo xong.

## 6. Quy tắc mã

- Định danh, chú thích tiếng Anh; tài liệu nhóm tiếng Việt.
- Tiền không dùng số thực: chuỗi thập phân hoặc số nguyên đơn vị nhỏ nhất, như CodeCash.
- Lỗi: exception của Nest với mã `UPPER_SNAKE_CASE` (`ConflictException("NOT_YOUR_TURN")`); nhiều lỗi
  theo trường: `throw new ValidationProblem([...])`. Bộ lọc chung trả RFC 9457 problem+json
  (`MODULES.md` mục "Định dạng lỗi").
- Đầu vào endpoint riêng: DTO `class-validator` (pipe toàn cục bật whitelist, forbidNonWhitelisted,
  transform); không nhận `@Body() body: any` ở endpoint mới.
- Quyền: khai báo trong `permissions.json`, gắn `@RequirePermission("<resource>:<action>")`; route
  công khai `@Public()`.
- Nhật ký kiểm toán chỉ ghi qua `Repository` (chuỗi băm), không sửa, không xoá mục cũ.
- SoD-1: `ADMIN_AUDITOR` xử lý ngoại lệ, `SYSTEM_ADMIN` quản trị tài khoản và cấu hình, `AUDITOR`
  chỉ đọc.
- Không chép thông tin đăng nhập, `.env` từ repo cũ; không ghi bí mật vào mã.
- Mỗi service một schema PostgreSQL (`PG_SCHEMA=<tên>`), cổng theo `docs/HE_THONG.md`.

## 7. Lệnh

```bash
pnpm install
pnpm dev            # chạy service (http://127.0.0.1:<cổng>/api/v1, Swagger ở /api/docs)
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test   # phải xanh trước khi PR
pnpm check:base     # có lỡ sửa phần nền không
pnpm check:docs     # có quên cập nhật tài liệu không (mục 4)
```

## 8. Git

- Nhánh `feat/<phần>-<việc>`, `fix/<phần>-<việc>` từ `main`; không commit thẳng `main`.
- Conventional Commits, tiếng Anh, mệnh lệnh: `feat(contract): add milestone percent check`. Mỗi
  commit một thay đổi có nghĩa, build vẫn xanh.
- `git add <tệp cụ thể>`, không `git add -A`; không commit `.env*`, `dist`, `node_modules`, `.data`.
- Không thêm dòng ghi công AI (`Co-Authored-By`, "Generated with…") vào commit hay PR.
- Chỉ push, mở PR khi người dùng bảo.
