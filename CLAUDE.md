# Hướng dẫn cho AI (và người) làm việc trong repo backend

Tệp này nằm ở nhánh `base` của repo cha `smart-contract-services`, nên **mọi repo service đều có
nó**. Công cụ AI khác (Cursor, Codex, Copilot) đọc `AGENTS.md`, tệp đó trỏ về đây.

## 1. Đang ở repo nào

Xem `service/package.json`:

- `"name": "@sc/service"` → **repo cha** (`btl-backend`, GitHub `smart-contract-services`): chassis,
  khuôn service, tài liệu chung; nhánh `main` thêm gateway, `compose.yaml`, Postman.
- `"name": "@sc/<tên>-service"` → **repo service** (`btl-backend-<tên>`, GitHub
  `smart-contract-services-<tên>`): một service nghiệp vụ. Đọc `service/SERVICE.md` trước tiên:
  service này sở hữu dữ liệu gì, endpoint nào, chuyển từ tệp nào của CodeCash.

## 2. Thư mục cùng cấp (phải có đủ)

```
<thư mục làm việc>/
├── codecash/                 MÃ CŨ — chỉ đọc. git clone https://github.com/Tunhoclaptrinh/Code-n-Cash.git codecash
├── btl-backend/              repo cha
├── btl-backend-<tên>/        repo service (mỗi service một thư mục)
└── btl-frontend/             web
```

Từ thư mục gốc repo này, mã cũ ở **`../codecash`**. Không có thì dừng lại, nhắc người dùng clone
đúng tên thư mục như trên. **Không bao giờ sửa, commit hay chạy lệnh ghi dữ liệu trong
`../codecash`**: nó là bản tham chiếu.

## 3. Nguồn sự thật (đọc trước khi viết nghiệp vụ)

| Cần biết | Đọc |
| --- | --- |
| Nghiệp vụ: vai trò, vòng đời, luật, tính tiền, mã trạng thái | `../codecash/docs/NGHIEP_VU.md` (bản duy nhất; mục 14 là từ điển trạng thái) |
| Luồng đầu–cuối, thiết kế bảng | `../codecash/docs/33_LUONG_NGHIEP_VU_DAU_CUOI.md`, `../codecash/docs/31_THIET_KE_CSDL_POSTGRES.md` |
| Dữ liệu gốc của ban tổ chức (Data Pack) | `../codecash/BangD-Case4/DataPack-CASE4_SmartContractWorkflow/` |
| Tệp cũ nào chuyển sang service nào | `docs/DOI_CHIEU_CODECASH.md` |
| Ai làm gì, ngày nào, prompt mẫu | `docs/KICH_BAN_VIBE_CODE.md` |
| Quy trình nhánh, cấu trúc repo | `docs/QUY_TRINH_NHANH.md`, `docs/KIEN_TRUC_REPO.md` |
| Chassis có gì, CRUD chung (lọc, nhập, xuất), định dạng lỗi | `packages/nest-common/MODULES.md` (đọc thay vì mở mã chassis) |

Mã cũ và tài liệu cũ mâu thuẫn nhau thì `NGHIEP_VU.md` thắng; ghi chỗ mâu thuẫn vào
`service/SERVICE.md` (mục "Rà soát").

## 4. Được sửa ở đâu

| Được sửa (nhánh `feat/…` → `main`) | Không được sửa (phần nền) |
| --- | --- |
| `service/**` (mã, test, `openapi.yaml`, `SERVICE.md`, `package.json` của service) | `packages/nest-common/**` (chassis) |
| `packages/contracts/resources.json`, `permissions.json`: **chỉ** mục của resource service này sở hữu | `scripts/**`, `.github/**`, `infra/**`, cấu hình gốc (`package.json` gốc, `tsconfig*`, ESLint, Prettier, `pnpm-workspace.yaml`) |
| `service/CHANGELOG.md` (nhật ký thay đổi của service), `README.md` (chỉ thêm phần giới thiệu ở đầu), `pnpm-lock.yaml` | `CHANGELOG.md` gốc (của phần nền: đổi mỗi lần đồng bộ, ghi vào sẽ xung đột), `CLAUDE.md`, `AGENTS.md`, `docs/*.md` chung |
| Repo cha, nhánh `main`: `gateway/` (nhật ký ở `gateway/CHANGELOG.md`), `postman/`, `compose.yaml` | |

CI chạy `scripts/check-base-untouched.mjs` và **từ chối** PR sửa phần nền ngoài quy trình. Thiếu
gì ở phần nền (một hàm trong chassis, một guard, một cấu hình)? **Dừng lại**, nói với người dùng
cần gì và vì sao; việc đó làm ở repo cha theo `core/<việc>` → `base`, rồi kéo về
(`docs/KIEN_TRUC_REPO.md`). Không chép chassis vào `service/` để "lách".

## 5. Chuyển một phần nghiệp vụ từ CodeCash (quy trình bắt buộc)

1. **Tìm nguồn**: tra `docs/DOI_CHIEU_CODECASH.md` và `service/SERVICE.md`; mở đúng tệp trong
   `../codecash/apps/api/src/` (Python: `../codecash/apps/engine/`).
2. **Đọc trước, viết sau**: liệt kê ra (trong câu trả lời) các luật nghiệp vụ tệp cũ đang làm, mỗi
   luật kèm mục `NGHIEP_VU.md` hoặc mã BR tương ứng. Luật nào không tìm được nguồn thì hỏi, không bịa.
3. **Chép rồi chỉnh**, giữ tên hàm, tên trường, mã lỗi như cũ để web và test cũ dùng lại được:
   - import hạ tầng từ `@sc/nest-common` (thay `./common/...`);
   - chỉ đọc, ghi **bảng của service này**; dữ liệu của service khác lấy qua HTTP API của nó
     (qua gateway) hoặc qua sự kiện, không bao giờ đọc thẳng bảng của nó;
   - người gọi lấy từ `req.user` (do `JwtAuthGuard` đặt), không tin vai trò, mã tổ chức gửi lên
     từ client.
4. **Rà soát**: so lại với `NGHIEP_VU.md`; ghi vào `service/SERVICE.md` mục "Rà soát" những gì
   lệch, thiếu, và mục "Cải tiến so với CodeCash" những gì đã làm tốt hơn (tách hàm quá dài, mã lỗi
   rõ hơn, idempotency, validate đầu vào…). Cải tiến không được đổi kết quả nghiệp vụ (số tiền,
   quyết định, trạng thái) nếu chưa ghi lý do và được người dùng đồng ý.
5. **Test**: mỗi endpoint ít nhất một ca thành công và một ca lỗi nghiệp vụ (4xx có `code`). Test
   cũ liên quan (`../codecash/tests/foundation/*.test.mjs` cho API, `../codecash/tests/*.py` cho engine)
   thì chuyển theo.
6. **Kiểm tra** (mục 7) xanh, rồi mới báo xong.

## 6. Quy tắc mã

- Định danh, chú thích tiếng Anh; tài liệu nhóm tiếng Việt.
- Tiền: không dùng số thực. Số tiền là chuỗi thập phân hoặc số nguyên đơn vị nhỏ nhất, như CodeCash.
- Lỗi nghiệp vụ: ném exception của Nest với mã `UPPER_SNAKE_CASE` (`ConflictException("NOT_YOUR_TURN")`);
  bộ lọc chung trả RFC 9457 `application/problem+json`: `{ type, title, status, detail, code, traceId,
  errors?, statusCode, message, requestId }`. Nhiều lỗi theo trường: `throw new ValidationProblem([...])`.
- Đầu vào endpoint riêng: viết DTO bằng `class-validator` (pipe toàn cục đã bật whitelist,
  forbidNonWhitelisted, transform); không nhận `@Body() body: any` ở endpoint mới.
- Quyền: khai báo trong `packages/contracts/permissions.json`, gắn bằng `@RequirePermission("<resource>:<action>")`;
  route công khai dùng `@Public()`.
- Nhật ký kiểm toán: chỉ ghi qua `Repository.transact` (chuỗi băm), không sửa, không xoá mục cũ.
- SoD-1: `ADMIN_AUDITOR` xử lý ngoại lệ, `SYSTEM_ADMIN` quản trị tài khoản và cấu hình, `AUDITOR` chỉ đọc.
- Không chép thông tin đăng nhập, `.env` từ repo cũ. Không ghi bí mật vào mã.
- Mỗi service một schema PostgreSQL (`PG_SCHEMA=<tên>`); cổng mặc định theo `service/SERVICE.md`.

## 7. Lệnh

```bash
pnpm install
pnpm dev            # chạy service (http://127.0.0.1:<cổng>/api/v1, Swagger ở /api/docs)
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test   # phải xanh trước khi PR
pnpm check:base     # tự kiểm: có lỡ sửa phần nền không
```

## 8. Git

- Nhánh: `feat/<phần>-<việc>`, `fix/<phần>-<việc>` từ `main`. Không commit thẳng `main`.
- Commit Conventional Commits, tiếng Anh, mệnh lệnh: `feat(contract): add milestone percent check`.
  Mỗi commit một thay đổi có nghĩa, build vẫn xanh.
- `git add <tệp cụ thể>`, không `git add -A`; không commit `.env*`, `dist`, `node_modules`, `.data`.
- Không thêm dòng ghi công AI (`Co-Authored-By`, "Generated with…") vào commit hay PR.
- Chỉ push, mở PR khi người dùng bảo.
