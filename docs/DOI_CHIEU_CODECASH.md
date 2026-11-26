# Đối chiếu: mã CodeCash → service

Bảng tra cho người và AI: mỗi tệp của CodeCash (`../codecash`, chỉ đọc) chuyển vào service nào.
Đường dẫn cũ tính từ `../codecash/apps/api/src/` nếu không ghi khác. Phần web xem
`btl-frontend/docs/DOI_CHIEU_CODECASH.md`.

Nguyên tắc tách: **ai ghi dữ liệu thì service đó sở hữu**. Một tệp cũ chạm nhiều nhóm dữ liệu (ví
dụ `workflow.controller.ts`, `domain/types.ts`) thì mỗi service lấy phần của mình.

## 1. Bảng service

| Service | Repo / thư mục | Cổng | Schema | Chủ | Sở hữu dữ liệu |
| --- | --- | --- | --- | --- | --- |
| identity | `smart-contract-services-identity` / `btl-backend-identity` | 3001 | `identity` | TV1 | organizations, users, settings |
| contract | `…-contract` / `btl-backend-contract` | 3002 | `contract` | TV2 | contract-drafts, contract-templates, milestone-templates, rule-versions, extraction-proposals |
| signing (gồm tài liệu) | `…-signing` / `btl-backend-signing` | 3004 | `signing` | TV3 | documents, signing, signing-requests, signing-profiles, attachments (tệp chứng từ) |
| execution | `…-execution` / `btl-backend-execution` | 3005 | `execution` | TV4 | parties, contracts, milestones, events, status-history, acceptance-requests, amendments, exceptions, notes |
| decision (Python) | `…-decision` / `btl-backend-decision` | 3006 | `decision` | TV5 | evaluations, engine-runs, payment-rules |
| payment | `…-payment` / `btl-backend-payment` | 3007 | `payment` | TV5 | payments |
| audit (gồm thông báo) | `…-audit` / `btl-backend-audit` | 3008 | `audit` | TV6 | audit (tập trung), anchor-jobs, notifications |
| gateway | repo cha, nhánh `main`, `gateway/` | 3000 | — | TV1 | — |

Tên collection lấy đúng tên trong CodeCash (`domain/records.ts`, `common/repository.ts`) để mã
cũ chạy gần như nguyên.

## 2. Đã nằm trong phần nền (không chuyển lại)

| Tệp cũ | Ở đâu bây giờ |
| --- | --- |
| `common/*` (repository, postgres-store, chuỗi băm, merkle, lỗi, interceptor, RolesGuard, CRUD chung, listing, field-validation) | `packages/nest-common` |
| `main.ts` (khởi động, Swagger, request id) | `bootstrapService` trong `packages/nest-common/src/bootstrap.ts` |
| `permissions.controller.ts` | `PermissionsController` trong chassis |
| Kiểm token (phần đọc người gọi) | `JwtAuthGuard`, `signActorToken` trong `packages/nest-common/src/auth-token.ts` |
| `domain/listing.ts` | `packages/nest-common/src/listing.ts` |
| `packages/contracts/{resources,permissions}.json` | `packages/contracts/` (mỗi service thêm mục của mình) |

## 3. Từng service

### identity (TV1) — làm mẫu đầu tiên

| Tệp cũ | Ghi chú |
| --- | --- |
| `auth.ts` | Đăng nhập, đăng ký công ty + `ORG_ADMIN`, tài khoản demo, đổi mật khẩu, `me`. Phát token bằng `signActorToken` của chassis |
| `domain/accounts.ts` | Tài khoản demo theo bên trong Data Pack (`parties.csv`) |
| `common/roles.ts` | Đã ở chassis (`orgAdminRefusal`) |
| Test: `tests/foundation/resource.test.mjs`, phần auth của `workflow.test.mjs` | |

Đã làm: DTO cho mọi body, refresh token xoay vòng, đổi và quên mật khẩu, mời thành viên, khoá tài khoản, token RS256 + JWKS (xem `SERVICE.md` của identity).

### contract (TV2) — soạn và rà soát hợp đồng

| Tệp cũ | Ghi chú |
| --- | --- |
| `domain/drafts.ts` (1138 dòng) | Vòng đời bản nháp, mốc, chuyển trạng thái. **Tách** theo việc: `drafts.service.ts`, `milestones.ts`, `transitions.ts` |
| `domain/contract-templates.ts`, `domain/templates.ts` | Mẫu hợp đồng, các giai đoạn theo loại (đọc `milestones.csv`) |
| `domain/contract-rules.ts` | Luật riêng của từng hợp đồng |
| `domain/rule-versions.ts`, `trust/milestone-library.ts` | Phiên bản luật, thư viện mốc (bên decision chỉ đọc) |
| `trust/extraction*.ts`, `trust/gemini-extractor.ts`, `trust/term-provider.ts` | Số hoá điều khoản từ PDF (tuỳ chọn, cắt nếu thiếu thời gian) |
| `domain/late-payment.ts` | Điều khoản thanh toán và lãi chậm trả **của hợp đồng** (payment đọc lại khi tính) |
| Test: phần bản nháp trong `tests/foundation/business-rules.test.mjs`, `workflow.test.mjs` | |

Nghiệp vụ: `NGHIEP_VU.md` §4 (vòng đời), §6.2a (số hoá, chỉnh tay, phụ lục), §6.3, §14.4.

### signing, gồm tài liệu (TV3)

| Tệp cũ | Ghi chú |
| --- | --- |
| `domain/signing.ts` (830 dòng), `domain/signing-layout.ts` | Phiên ký, lượt ký đúng thứ tự, vị trí ký trên trang |
| `signing-service.ts`, `trust/remote-signer.ts`, `trust/signing-provider.ts`, `trust/crypto.ts` | Gọi nhà ký từ xa (giả lập CA) |
| `../codecash/apps/signer/src/*` | Nhà ký giả lập: giữ làm tiến trình riêng `simulator/` trong repo signing, dùng cho thí nghiệm lỗi |
| `documents.ts`, `document-preview.ts`, `pdf-layout.ts`, `contract-files.ts` | Kho tài liệu theo SHA-256, bản PDF, quyền xem của bên hợp đồng |
| `evidence-store.ts`, `evidence-documents.ts` | Lưu tệp chứng từ; execution gọi API này khi nộp chứng từ |
| `mock-originals.ts`, `sample-documents.ts` | Bản gốc mô phỏng cho hợp đồng Data Pack |
| Test: `tests/foundation/signer.test.mjs`, `pdf-gemini.test.mjs` | |

Nghiệp vụ: `NGHIEP_VU.md` §11 (ký số và tài liệu), §9.4. Saga S1 điều phối ở đây.

### execution (TV4) — thực hiện mốc

| Tệp cũ | Ghi chú |
| --- | --- |
| `domain/records.ts`, `domain/datapack.ts`, `domain/csv.ts`, `domain/seed.ts`, `domain/factory.ts` | Bảng nghiệp vụ, nhập Data Pack (100 hợp đồng, 405 mốc), sinh mã |
| `domain/context.ts`, `domain/service.ts` | Đọc theo người gọi, ghi trong một giao dịch |
| `domain/actions/{evidence,acceptance,approvals,disputes,exceptions,amendments,liquidation,shared}.ts` | Hành động nghiệp vụ trên mốc |
| `domain/views/{contracts,milestones,tasks,responsibility,evidence,approvals,disputes,exceptions,dashboard}.ts` | Màn đọc của web |
| `domain/vocabulary.ts` | Bên nào được tạo sự kiện gì (đọc policy pack) |
| `domain/lists.ts` | Danh sách có phân trang của workflow |
| `workflow.controller.ts` | Phần route của các hành động, màn trên |
| `domain/engine.ts`, `domain/engine-contract.ts` | Hôm nay gọi CLI Python trong tiến trình; **đổi** thành gọi HTTP sang decision (timeout, thử lại, S3) |
| Test: `tests/foundation/workflow.test.mjs`, `business-rules.test.mjs` | |

Nghiệp vụ: `NGHIEP_VU.md` §2.1 (thẩm quyền tạo event), §4, §9, §14.3, §14.5, §14.6, §14.13.

### decision (TV5, Python)

| Tệp cũ | Ghi chú |
| --- | --- |
| `../codecash/apps/engine/codecash_engine/` | Giữ **nguyên** bộ đánh giá; bọc bằng FastAPI |
| `../codecash/apps/engine/{cli.py,server.py,policy/,rule_language.json,validate_rules.py}` | Đầu vào, policy pack, kiểm luật |
| `domain/policy.ts`, `trust/rules-service.ts`, `trust/rule-workflows.ts` | Áp phiên bản luật, quy trình riêng của phiên bản |
| `domain/views/verification.ts`, `domain/views/shared.ts` | Gói kiểm chứng quyết định, chạy thử giả định |
| `engine.ts` | Chạy cả bộ dữ liệu, xuất kết quả theo mẫu của ban tổ chức |
| Test: `../codecash/tests/*.py` (golden 20/20, mutation, policy) | Phải xanh nguyên như cũ |

Nghiệp vụ: `NGHIEP_VU.md` §5–§8, §14.1, §14.2, §14.11, §14.12. **Không suy ra độ chính xác trên 405 mốc từ 20 mẫu.**

### payment (TV5)

| Tệp cũ | Ghi chú |
| --- | --- |
| `domain/actions/payments.ts` | Lập lệnh chi từ quyết định trả tiền |
| `payment-gateway.ts` | Gửi lệnh ra cổng thanh toán (giả lập ngân hàng) |
| `domain/views/approvals.ts` (phần duyệt chi) | Hàng đợi duyệt chi |
| Test: phần thanh toán của `business-rules.test.mjs` | |

Nghiệp vụ: `NGHIEP_VU.md` §7 (tính tiền), §9.2. Saga S4 điều phối ở đây; Idempotency-Key bắt buộc.

### audit, gồm thông báo (TV6)

| Tệp cũ | Ghi chú |
| --- | --- |
| `trust/service.ts`, `trust/anchor-provider.ts`, `trust/timestamp.ts`, `trust/controller.ts`, `trust/types.ts` | Neo chuỗi băm định kỳ, dấu thời gian |
| `domain/views/integrity.ts`, `domain/views/activity.ts` | Kiểm toàn vẹn, nhật ký hoạt động |
| `notifications.ts` | Thông báo theo người; nhận từ sự kiện RabbitMQ |
| Test: `tests/foundation/trust.test.mjs`, `notifications.test.mjs`; `../codecash/tests/test_verify_audit.py` | |

Mỗi service đã tự ghi chuỗi băm của mình (chassis); audit gom về và kiểm chéo.

## 4. Tệp dùng chung nhiều service

| Tệp cũ | Cách chia |
| --- | --- |
| `domain/types.ts` (1707 dòng) | Mỗi service chép kiểu mình dùng vào `service/src/types.ts`. Kiểu của **sự kiện giữa các service** đưa vào `packages/contracts` qua `core/<việc>` (một lần, có duyệt) |
| `workflow.controller.ts` | Mỗi service lấy route của mình; tiền tố đường dẫn giữ như cũ để web ít phải đổi |
| `main.ts` | Không chép: dùng `bootstrapService` |
