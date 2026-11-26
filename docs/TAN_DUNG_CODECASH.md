# Tận dụng CodeCash: giữ gì, sửa gì, bỏ gì

Mục tiêu: **dùng lại phần lớn mã cũ**, chỉ sửa chỗ cần cho kiến trúc microservices, cho sát thực tế
(`DINH_VI_SAN_PHAM.md` §4) và cho đúng đề hai môn. Tệp này quyết định ở mức **mô-đun và tính năng**:
làm gì với nó, sửa cụ thể gì, vì sao, ai làm. Ánh xạ đến từng tệp: `docs/DOI_CHIEU_CODECASH.md`
(backend), `btl-frontend/docs/DOI_CHIEU_CODECASH.md` (web). Quy trình chuyển một phần: `CLAUDE.md` §5
(backend), `btl-frontend/CLAUDE.md` §4 (web), checklist ở `TRIEN_KHAI_NHOM.md` §4.

**Luật cập nhật**: chuyển xong một dòng thì đổi cột "Trạng thái"; quyết định khác bảng (bỏ, viết lại)
thì sửa dòng và ghi lý do ở `DINH_VI_SAN_PHAM.md` §7.

## 1. Bốn mức hành động

| Ký hiệu | Nghĩa | Ví dụ | Commit |
| --- | --- | --- | --- |
| **GIỮ** | Chép nguyên, chỉ đổi đường dẫn import | engine Python, bộ UI, CSS module của màn | `chore(<svc>): port <tệp> from codecash@<commit>` |
| **CHỈNH** | Chép rồi sửa: tách theo service, gọi HTTP thay vì gọi hàm, đổi đơn vị, thêm DTO | `domain/drafts.ts`, `domain/actions/*` | commit port nguyên trạng **trước**, rồi từng commit sửa |
| **MỚI** | Viết mới vì CodeCash không có | gateway, saga, outbox, consumer, refresh token | commit thường |
| **BỎ** | Không chuyển | MongoDB, công cụ chấm của cuộc thi, Render | không commit |

Commit "port nguyên trạng trước, sửa sau" là bắt buộc: người chấm nhìn diff thấy rõ phần mỗi người sửa,
và mình cũng `git diff` được để rà soát (`DINH_VI_SAN_PHAM.md` §6).

## 2. Toàn cảnh khối lượng

| Khối | Cỡ ở CodeCash | Đi đâu | Mức chung | Trạng thái |
| --- | --- | --- | --- | --- |
| `apps/api/src/common` (repository, chuỗi băm, CRUD chung, lỗi, guard) | ~3.000 dòng | chassis `packages/nest-common` | CHỈNH | **xong** |
| `apps/api/src/auth.ts`, `domain/accounts.ts` | ~700 dòng | identity | CHỈNH | **xong** |
| `apps/api/src/domain` + `trust` + các tệp gốc còn lại | ~21.000 dòng | contract, signing, execution, decision, payment, audit | CHỈNH (đa số), GIỮ (logic thuần) | chưa |
| `apps/engine` (Python) | ~3.700 dòng | decision | **GIỮ** + bọc FastAPI | chưa |
| `apps/signer` (nhà ký từ xa) | 7 tệp | signing (`simulator/`) | GIỮ | chưa |
| `apps/web/src/shared`, `packages/ui` | — | phần nền web | CHỈNH | **xong** (khung, xác thực) |
| `apps/web/src/features/*` | ~25.000 dòng | `btl-frontend/src/features/*` | GIỮ màn, CHỈNH lớp gọi API | chưa (trừ `platform`) |
| `apps/web/src/guide` + 96 ảnh | 15 bài vi + en | hướng dẫn trong ứng dụng + ảnh báo cáo | CHỈNH (đổi tên, chụp lại) | chưa |
| `tests/foundation/*.mjs` (15 tệp, ~12.400 dòng) | | test của từng service | CHỈNH (chia theo service) | một phần |
| `tests/*.py` (15 tệp), `tests/golden` | | decision | **GIỮ** | chưa |
| `tools/*.py` (bộ kiểm độc lập) | 7 tệp | decision, audit | GIỮ | chưa |
| `scripts/*.mjs` (smoke, chụp màn hình) | 13 tệp | xem §7 | CHỈNH | chưa |
| `docs/*` | 13 tài liệu chính + archive + sơ đồ | báo cáo (`BAO_CAO_VA_BAO_VE.md`) | CHỈNH | chưa |
| `infra`, `Dockerfile*`, `render.yaml` | | — | BỎ (đã thay bằng Dockerfile từng service, `compose.yaml`) | **xong** |

## 3. Sửa chung cho mọi phần (làm khi chuyển, đừng để cuối)

| # | Tìm | Sửa thành | Vì sao |
| --- | --- | --- | --- |
| C1 | `import … from "./common/…"`, `../common/…` | `@sc/nest-common` | chassis đã có |
| C2 | Đọc trực tiếp bảng của phần khác (`repo.list("contracts")` trong mã của payment…) | `ServiceClient.fromEnv("<service>")` hoặc dữ liệu đến qua sự kiện | database riêng (MS-R2) |
| C3 | Gọi hàm của phần khác trong cùng tiến trình (`engine.evaluate(...)`, `signing.seal(...)`) | HTTP qua `ServiceClient` (đồng bộ) hoặc sự kiện (bất đồng bộ), đúng bảng `LUAN_CU_KIEN_TRUC.md` §3 | tách service |
| C4 | `@Body() body: any`, kiểm tay `typeof x === "string"` | DTO `class-validator` + kiểm nghĩa trong service | LT-07 |
| C5 | `throw new BadRequestException("...")` với nhiều lỗi trường | `throw new ValidationProblem([...])` | lỗi RFC 9457 đủ trường |
| C6 | `…Million` (đơn vị triệu) | `…Vnd` chuỗi số nguyên (D3); giữ triệu chỉ ở chỗ nạp và kiểm Data Pack | sát thực tế |
| C7 | `"BTC"`, "ban tổ chức", "Data Pack" trong chữ hiển thị (web ~14 tệp locale và hướng dẫn) | chữ của sản phẩm SCW; "dữ liệu mẫu" | định vị BTL |
| C8 | Chuỗi thương hiệu "CodeCash" (`brand.*`, `BrandMark`, tiêu đề) | "Smart Contract Workflow" | định vị BTL |
| C9 | Gemini, khoá API trong mã hoặc `.env` cũ | tắt mặc định, không chép khoá (T1) | bảo mật, phạm vi |
| C10 | `workflow.controller.ts` kiểu RPC (`POST /workflow/:module/:action`) | route REST theo tài nguyên ở `PHAN_TICH_THIET_KE.md` §6 | MS-R3 chấm REST đúng method và status |
| C11 | Test gọi thẳng hàm nội bộ của phần khác | test trong service, phần khác giả bằng server HTTP tạm (như `service-client.test.mjs`) | test độc lập từng service |

Ước lượng: C1, C4, C5, C10 chiếm phần lớn công sửa ở backend; C6, C7, C8 ở web. AI làm nhanh các mục
này nếu prompt nêu đúng mã mục (`TRIEN_KHAI_NHOM.md` §5).

## 4. Backend theo service

### 4.1. contract (TV2)

| Phần cũ | Hành động | Sửa cụ thể | Ghi chú |
| --- | --- | --- | --- |
| `domain/drafts.ts` (1.138 dòng): vòng đời bản nháp, mốc, chuyển trạng thái | CHỈNH | tách `drafts.service.ts`, `milestones.ts`, `transitions.ts`; bảng chuyển thành union type + `canTransition` (§5.1 thiết kế); route REST (C10); tiền (C6) | BR-A02…A08 |
| `domain/contract-templates.ts`, `domain/templates.ts` | GIỮ | đọc mẫu từ bảng của contract, không đọc CSV Data Pack lúc chạy | N2 |
| `domain/contract-rules.ts`, `domain/rule-versions.ts`, `trust/milestone-library.ts` | CHỈNH | contract giữ luật **riêng của hợp đồng**; bộ luật chung có phiên bản thuộc decision; contract gửi kèm vào gói v1 | ranh giới với decision |
| `domain/late-payment.ts` | GIỮ | thêm căn cứ Điều 306 trong chú thích; tham số cấu hình | P2 |
| Hồ sơ pháp lý theo loại hợp đồng | MỚI (nhỏ) | bảng loại → trần phạt, cảnh báo/chặn | P1, BR-A05 |
| `trust/extraction*.ts`, `term-provider.ts` | CHỈNH | giữ luồng đề xuất → xác nhận, nguồn đề xuất là nhập tay | T1 |
| `trust/gemini-extractor.ts` | BỎ (mặc định) | chỉ chuyển nếu dư thời gian, sau cờ tắt | T1, P8 |
| Phát `contract.review_requested`, `contract.agreed` | MỚI | ghi vào outbox | §7 thiết kế |

### 4.2. signing, gồm tài liệu (TV3)

| Phần cũ | Hành động | Sửa cụ thể | Ghi chú |
| --- | --- | --- | --- |
| `domain/signing.ts` (830 dòng), `domain/signing-layout.ts` | CHỈNH | phiên ký, lượt; gọi contract qua HTTP để khoá, kích hoạt (C3); `Idempotency-Key` cho lượt ký | BR-A09, A10 |
| `signing-service.ts`, `trust/remote-signer.ts`, `trust/signing-provider.ts`, `trust/crypto.ts` | CHỈNH | gọi nhà ký qua `ServiceClient` (timeout 3 s) → `PENDING_PROVIDER` + job đối soát | saga A2, F3 |
| `apps/signer/src/*` (nhà ký, QR, điện thoại) | GIỮ | chạy như tiến trình riêng `simulator/` trong repo signing; thêm biến làm chậm/lỗi cho thí nghiệm | T4 |
| `documents.ts`, `document-preview.ts`, `pdf-layout.ts`, `contract-files.ts` | GIỮ | đổi lưu trữ sang bảng của signing + thư mục volume | BR-A11 |
| `evidence-store.ts`, `evidence-documents.ts` | CHỈNH | API tải tệp chứng từ; execution gọi sang | |
| `mock-originals.ts`, `sample-documents.ts` | GIỮ | chỉ cho dữ liệu mẫu | D1 |
| Saga S1, phát `contract.activated` kèm gói v1 | MỚI | điều phối, bù trừ, outbox | S1, S2 |
| Xác minh công khai (`/public/verify`) | CHỈNH | thêm route công khai ở `gateway/routes.json` | khách (LT-T2) |

### 4.3. execution (TV4)

| Phần cũ | Hành động | Sửa cụ thể | Ghi chú |
| --- | --- | --- | --- |
| `domain/records.ts`, `domain/context.ts`, `domain/service.ts` | CHỈNH | đọc ghi chỉ bảng của execution | C2 |
| `domain/datapack.ts`, `csv.ts`, `seed.ts`, `factory.ts` | CHỈNH | chỉ nạp dữ liệu mẫu (tổ chức demo); nhân đơn vị tiền | D1, D3 |
| `domain/actions/{evidence,acceptance,approvals,disputes,exceptions,amendments,liquidation,shared}.ts` | **GIỮ logic**, CHỈNH vỏ | route REST, DTO, mỗi hành động xong gọi chấm lại (C3) | BR-B03, B05, B08, B09, B11, B12; N4 |
| `domain/views/{contracts,milestones,tasks,responsibility,evidence,approvals,disputes,exceptions,dashboard}.ts` | GIỮ | phần "việc còn lại" (`responsibility.ts`, `tasks.ts`) là điểm mạnh, giữ nguyên | đường đọc không gọi chéo |
| `domain/vocabulary.ts` | GIỮ | bên nào được tạo sự kiện gì | BR-B03 |
| `domain/engine.ts`, `engine-contract.ts` | CHỈNH | gọi decision qua HTTP, gửi trọn gói dữ kiện của mốc; timeout 2 s → `PENDING_EVALUATION` + job | S3, F1 |
| Hoá đơn | CHỈNH | đủ trường hoá đơn điện tử, kiểm tổng | P6 |
| Nhập gói hợp đồng (`POST /contract-imports`), consumer `contract.activated`, `payment.settled` | MỚI | idempotent theo `contract.id`, `orderId` | S2, MS-B1 |

### 4.4. decision, Python (TV5)

| Phần cũ | Hành động | Sửa cụ thể | Ghi chú |
| --- | --- | --- | --- |
| `apps/engine/codecash_engine/*` (9 bước đánh giá) | **GIỮ** nguyên | không sửa logic; nếu D4 chọn (b) thì thêm tham số đơn vị và làm tròn, mặc định như cũ | BR-B01…B07 |
| `cli.py`, `server.py`, `policy/`, `rule_language.json`, `validate_rules.py` | CHỈNH | `server.py` thay bằng FastAPI: `POST /evaluations`, `GET /decisions/...`, `/rule-sets`; nhận gói dữ kiện qua JSON thay vì đọc thư mục | §6 thiết kế |
| Profiles, switches của cách hiểu đề | GIỮ trong engine, ẩn khỏi API sản phẩm | N1 | |
| `trust/rules-service.ts`, `rule-workflows.ts`, `domain/policy.ts` (TypeScript) | CHỈNH | viết lại phần quản lý phiên bản luật (lưu, công bố, kiểm an toàn) bằng Python trong decision, theo đúng logic cũ: một service một ngôn ngữ | quy trình phiên bản giữ nguyên |
| `domain/views/verification.ts` (gói kiểm chứng, chạy thử) | CHỈNH | `dryRun` của `POST /evaluations` | |
| `engine.ts` (chạy cả bộ, xuất mẫu ban tổ chức) | CHỈNH | thành màn "Kiểm chứng bộ luật" (D2) | |
| `tests/*.py`, `tests/golden/*`, `tools/verify_decision.py`, `tools/mutation_check.py` | **GIỮ** | phải xanh như cũ; chạy trong CI của repo decision | chứng cứ chương đánh giá |

### 4.5. payment (TV5)

| Phần cũ | Hành động | Sửa cụ thể | Ghi chú |
| --- | --- | --- | --- |
| `domain/actions/payments.ts` | CHỈNH | lệnh chi từ quyết định; gọi decision xác nhận, gọi execution khoá mốc | BR-B10, S4 |
| `payment-gateway.ts` | CHỈNH | thành ngân hàng mô phỏng riêng (tiến trình hoặc route giả lập) có biến chậm/lỗi; gọi qua `ServiceClient` + circuit breaker + bulkhead | F2, MS-B3 |
| `domain/views/approvals.ts` (phần duyệt chi) | GIỮ | | |
| `Idempotency-Key`, `PENDING` + đối soát, `saga-log` | MỚI | | P7 |

### 4.6. audit, gồm thông báo (TV6)

| Phần cũ | Hành động | Sửa cụ thể | Ghi chú |
| --- | --- | --- | --- |
| `trust/service.ts`, `anchor-provider.ts`, `timestamp.ts`, `controller.ts`, `types.ts` | CHỈNH | neo đầu chuỗi của **từng service**; gọi là neo nội bộ | P5 |
| `domain/views/integrity.ts`, `activity.ts` | CHỈNH | đọc từ bản sao nhật ký nhận qua hàng đợi | L7 |
| `notifications.ts` | CHỈNH | consumer idempotent, DLQ; email mô phỏng | N5, MS-B1 |
| `tools/verify_audit.py` | GIỮ | bộ kiểm độc lập, dùng khi demo kiểm toán | |
| Outbox relay, consumer, DLQ, màn xem DLQ | MỚI | phần nền cùng TV1 | `LUAN_CU_KIEN_TRUC.md` §6 |

## 5. Web theo tính năng

Bảng màn đến từng tệp: `btl-frontend/docs/DOI_CHIEU_CODECASH.md` §2. Ở đây chỉ chốt hành động.

| Tính năng cũ | Hành động | Sửa cụ thể |
| --- | --- | --- |
| `features/platform` (tổ chức, người dùng, quyền) | CHỈNH, **xong một phần** | mời thành viên đã làm; bỏ `DataPage`, `AnchorsPage`, `BenchmarkCard`, `DatasetPanel` (công cụ chấm của cuộc thi) trừ màn "Kiểm chứng bộ luật" (D2) |
| `features/contracts` (danh sách, wizard soạn) | GIỮ màn, CHỈNH API | `api.ts` theo `openapi.yaml` contract; tiền (C6); thêm Compound `<MilestoneBuilder>` và `usePersistentDraft<T>` nếu chưa có (LT-02) |
| `features/signing` (vị trí ký, trình tự, cách ký, thiết bị, xác minh, số hoá) | GIỮ màn, CHỈNH API | trang xác minh chạy không cần đăng nhập; số hoá chuyển sang chủ TV2 |
| `features/milestones` (việc cần làm, chi tiết, chứng từ, quyết định, duyệt chi) | GIỮ màn, CHỈNH API | bảng mốc ảo hoá và đo Profiler (LT-04); hiển thị `PENDING_EVALUATION`, `PENDING` |
| `features/disputes` | GIỮ | |
| `features/dashboard` | GIỮ, CHỈNH nguồn số liệu | số liệu lấy từ API execution, payment; không tự tính tiền trên trình duyệt |
| `features/audit` | GIỮ | thêm màn DLQ |
| `src/guide` + ảnh | CHỈNH | đổi tên sản phẩm, bỏ phần Data Pack, chụp lại bằng script (§7) |
| Lớp gọi API cũ (`shared/api/domain.ts`, `workflow.ts`) | BỎ dần | mỗi tính năng có `api.ts` riêng |

## 6. Test

| Test cũ | Đi đâu | Hành động |
| --- | --- | --- |
| `tests/foundation/resource.test.mjs`, `listing.test.mjs`, `postgres.test.mjs` | chassis, identity | **xong** |
| `tests/foundation/workflow.test.mjs`, `business-rules.test.mjs` | chia theo service (contract, execution, payment) | CHỈNH: mỗi phần vào repo của service sở hữu nó |
| `signer.test.mjs`, `pdf-gemini.test.mjs` (bỏ phần Gemini) | signing | CHỈNH |
| `trust.test.mjs`, `notifications.test.mjs` | audit | CHỈNH |
| `engine-integration.test.mjs` | execution (gọi decision giả) + decision | CHỈNH |
| `i18n.test.mjs`, `ui-tokens.test.mjs` | web | GIỮ (đưa vào Vitest) |
| `benchmark.test.mjs`, `demo-input.test.mjs` | decision, execution | GIỮ nếu còn dùng |
| `tests/*.py`, `tests/golden` | decision | GIỮ nguyên |
| Test cạnh màn web (`*.test.tsx` cũ) | `btl-frontend` | CHỈNH sang `renderWithApp` + MSW |

## 7. Script và công cụ

| Cũ | Hành động | Dùng vào |
| --- | --- | --- |
| `scripts/guide-screenshots.mjs` (chụp màn hình tự động bằng Chrome DevTools, đăng nhập từng vai trò, làm thao tác thật, khoanh số đỏ) | **CHỈNH**: đổi địa chỉ sang gateway, đổi tên ảnh nếu màn đổi | chụp lại toàn bộ ảnh hướng dẫn và ảnh báo cáo bằng một lệnh, mỗi khi giao diện đổi |
| `scripts/browser-smoke.mjs`, `smoke.mjs`, `real-contract-smoke.mjs`, `signing-device-smoke.mjs` | CHỈNH | kiểm luồng đầu–cuối qua gateway trước buổi demo |
| `scripts/generate-contract-samples.mjs`, `generate-guide-samples.mjs` | GIỮ | tệp mẫu (PDF hợp đồng, hoá đơn) cho demo |
| `tools/kiem_chung_nghiep_vu.py`, `verify_decision.py`, `mutation_check.py`, `verify_audit.py` | GIỮ | chương đánh giá; demo kiểm toán |
| `tools/ra_soat_btc.py` | BỎ | công cụ riêng của cuộc thi |
| `tools/generate_datapack_class_diagram.py` | GIỮ | sơ đồ lớp dữ liệu cho báo cáo |

## 8. Không chuyển

| Phần | Vì sao |
| --- | --- |
| Driver MongoDB | chỉ PostgreSQL (T2) |
| `render.yaml`, `Dockerfile.standalone`, `infra/compose.prod.yaml` | đã thay bằng Dockerfile từng service và `compose.yaml` |
| `workflow.controller.ts` dạng RPC | thay bằng REST (C10); logic bên trong vẫn dùng |
| Công cụ chấm Data Pack trên giao diện (`DataPage`, `BenchmarkCard`, `DatasetPanel`, `AnchorsPage`) | thuộc cuộc thi; số liệu đưa vào báo cáo, không vào sản phẩm (trừ D2) |
| `docs/pitch` | slide của cuộc thi; số liệu dùng lại ở chương đánh giá, hình thức thì không |
| Khoá API, `.env` cũ | không bao giờ chép |
