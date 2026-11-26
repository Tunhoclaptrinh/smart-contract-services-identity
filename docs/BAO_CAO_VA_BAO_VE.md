# Báo cáo và bảo vệ: dùng lại tài liệu, ảnh cũ thế nào

Tệp này là **kế hoạch viết** cho hai báo cáo, slide, video và buổi bảo vệ. Mỗi mục ghi: viết gì, lấy từ
đâu (tài liệu mới trong repo hay tài liệu, ảnh cũ của CodeCash), sửa gì, ai viết, bao nhiêu trang.
Định vị sản phẩm: `DINH_VI_SAN_PHAM.md`. Phần mã tận dụng: `TAN_DUNG_CODECASH.md`.

Đường dẫn `codecash/…` tính từ thư mục làm việc chung (thư mục cùng cấp với `btl-backend`).

**Luật cập nhật**: viết xong một mục thì đánh dấu ở cột "Trạng thái" của §4, §5; đổi màn hình thì
chụp lại ảnh (§3.3) trước khi dán.

## 1. Năm nguyên tắc dùng lại tài liệu cũ

1. **Dùng nội dung, không dùng khung cuộc thi.** Đoạn nào nói "ban tổ chức", "Data Pack chính thức",
   "Vòng 3", "BTC_SUBMISSION" thì viết lại theo định vị SCW; số liệu engine chỉ xuất hiện ở chương
   đánh giá, đo trên dữ liệu mẫu.
2. **Mô tả kiến trúc cũ là quá khứ.** CodeCash là monolith; đoạn nào tả "một API", "engine chạy như
   tiến trình con" thì chỉ dùng ở mục "Hiện trạng ban đầu và vì sao tách" của báo cáo MS.
3. **Viết lại, không dán nguyên.** Đoạn lấy từ tài liệu cũ được viết lại theo giọng và thuật ngữ của
   báo cáo (từ điển trạng thái), hình vẽ lại hoặc xuất lại theo cùng một bộ màu.
4. **Ảnh giao diện chụp lại trên bản BTL.** Ảnh cũ (96 tệp) cho biết cần chụp màn nào, ở trạng thái
   nào; ảnh dán vào báo cáo phải chụp từ hệ thống SCW chạy qua gateway (§3.3).
5. **Viết khi làm, không để cuối.** Ai chuyển xong một service thì viết luôn phần của mình (§9). Ngày
   11–12/12 chỉ để ghép, sửa thống nhất và dàn trang.

## 2. Kho tài liệu cũ dùng vào đâu

Tài liệu trong `codecash/docs/`. Cột "MS" và "LT" là chương, mục của hai báo cáo ở §4, §5.

| Tài liệu cũ | Nội dung | Dùng vào | Sửa gì |
| --- | --- | --- | --- |
| `NGHIEP_VU.md` (707 dòng) §1–4 | Phạm vi, vai trò và quyền, dữ liệu, vòng đời | MS 1.2–1.4; LT a | bỏ phần Data Pack là đầu vào duy nhất; vai trò giữ nguyên |
| `NGHIEP_VU.md` §5–7 | Engine 9 bước, luật quyết định, tính tiền | MS 1.5 (quy tắc), MS 6.3 (đánh giá engine) | giữ; tiền theo D3/D4 nếu đổi |
| `NGHIEP_VU.md` §8–10 | Confidence, đầu ra và truy vết, KPI | MS 6.3 | KPI đo lại nếu đổi engine |
| `NGHIEP_VU.md` §11 | Ký số và tài liệu | MS 3 (signing), MS 5 (pháp lý của chữ ký) | gọi đúng "chữ ký điện tử mô phỏng" (P4) |
| `NGHIEP_VU.md` §12 | Đối chiếu đề bài và câu trả lời ban tổ chức | **không dùng** | thuộc cuộc thi |
| `NGHIEP_VU.md` §14 | Từ điển trạng thái | Phụ lục cả hai báo cáo | giữ nguyên, thêm `PENDING_*` |
| `33_LUONG_NGHIEP_VU_DAU_CUOI.md` (393 dòng) | Bài toán, các bên, toàn cảnh, từng giai đoạn, câu chuyện Nova An – Phú Minh | MS 1.1, MS 2.5 (luồng); LT a; kịch bản demo §8 | đổi toàn cảnh sang sơ đồ service; câu chuyện giữ |
| `11_HOP_DONG_TRONG_UNG_DUNG.md` (409 dòng) | 10 bước soạn → ký → chứng từ → duyệt chi → phụ lục → thanh lý | MS 2.5 (luồng L2–L8); LT a, f; video | gần như dùng thẳng, đổi tên màn, route |
| `09_VIEC_CON_LAI_VA_HOP_VIEC.md` | "Việc còn lại" theo người, hộp việc | MS 1.4 (giá trị sản phẩm); LT d (thiết kế component) | giữ |
| `10_DICH_VU_KY_SO.md` | Nhà ký từ xa mô phỏng, luồng ký, bảo mật, xử lý lỗi, đối chiếu SOA | MS 3.3, MS 4 (S1, PENDING_PROVIDER, F3) | mục "đối chiếu SOA" viết lại thành đối chiếu microservices |
| `31_THIET_KE_CSDL_POSTGRES.md` (735 dòng) | ERD, nhóm bảng, DDL | MS 3.4 (dữ liệu từng service); LT b (sơ đồ CSDL) | **chia** ERD theo database của từng service; bỏ phần text2sql |
| `34_CSDL_CONTRACT_SMART.md` | CSDL tham khảo | không dùng | |
| `08_HUONG_DAN_PHAT_TRIEN_UI.md` | Quy ước giao diện, cách dựng màn danh sách | LT d (thiết kế giao diện, component dùng chung) | giữ, cắt phần UniFlow nội bộ |
| `06_KIEN_TRUC_MONOREPO_VA_TAI_SU_DUNG.md` | Monorepo, tái sử dụng UniFlow | MS 2.1 (hiện trạng ban đầu) | chỉ dùng làm "trước khi tách" |
| `07_HUONG_DAN_TRIEN_KHAI.md`, `32_KIEM_TRA_VA_KHOI_CHAY_LOCAL.md` | Triển khai, chạy local | MS 5.1 (cách chạy) | viết lại theo `compose.yaml`; giữ phần kiểm tra |
| `30_HUONG_DAN_TIEP_QUAN_VA_PHAT_TRIEN_TIEP.md` | Tiếp quản, phát triển tiếp | MS 7 (hướng phát triển) | lọc ý còn đúng |
| `KICH_BAN_DEMO.md` | Demo 60 giây và 5 phút, câu hỏi thường gặp | §8, §10 của tệp này | đổi sang câu chuyện SCW và luồng lỗi |
| `pitch/GIAI_THICH_SO_LIEU_PITCH.md` | Giải thích số liệu: confidence, baseline, bộ kiểm 6.237 ca, 16 lỗi cố ý | MS 6.3; vấn đáp TV5 | chạy lại lệnh để có số mới nhất; bỏ ngữ cảnh pitch |
| `archive/*` (33 tệp) | Lịch sử thiết kế, rà soát giao diện | tra cứu khi cần lý do một quyết định cũ | không đưa vào báo cáo |
| Tài liệu tham khảo ngoài repo `docs/tham-khao/03_PHAN_TICH_PHAP_LY.md` | Căn cứ pháp lý | MS 1.6 (ràng buộc pháp lý), MS 7 (hạn chế) | giữ, dẫn đúng điều luật |

Tài liệu mới trong repo này đã viết sẵn phần lớn chương kiến trúc:

| Tài liệu mới | Dùng vào |
| --- | --- |
| `docs/LUAN_CU_KIEN_TRUC.md` | MS 2 (vì sao tách, đồng bộ hay bất đồng bộ, công nghệ, CI), MS 4 (hàng đợi), vấn đáp |
| `docs/PHAN_TICH_THIET_KE.md` | MS 1.5 (quy tắc), MS 3 (service, API), MS 4 (saga, thí nghiệm), bảng yêu cầu hai môn |
| `docs/HE_THONG.md` | MS 2.2 (sơ đồ một trang), MS 5.1 (chạy cả hệ) |
| `packages/nest-common/MODULES.md` | MS 3.1 (chassis), LT-07 trong báo cáo LTWNC |
| `service/SERVICE.md`, `openapi.yaml` của từng repo | MS 3.x của từng service |
| `gateway/README.md` | MS 2.3 |

## 3. Kho hình

### 3.1. Sơ đồ có sẵn (`codecash/docs/bpmn`, `codecash/docs/diagrams`)

| Sơ đồ | Tệp gốc | Dùng vào | Làm gì |
| --- | --- | --- | --- |
| Luồng tổng thể theo vai trò (BPMN) | `bpmn/luong-tong-the-theo-vai-tro.drawio`, `@2x.png`, bản màu `_Co_mau` | MS 1.3, LT a | **giữ**, sửa nhãn tên sản phẩm; thêm làn "hệ thống" chỉ service nào làm bước nào |
| Kiến trúc hệ thống cũ | `bpmn/kien-truc-he-thong.drawio` | MS 2.1 "trước khi tách" | giữ để so sánh trước/sau; vẽ **mới** sơ đồ sau (từ `HE_THONG.md` §2) |
| ERD toàn hệ | `diagrams/erd-codebase.drawio`, `.png`, `.svg` | MS 3.4, LT b | **tách** thành một ERD mỗi database service (cùng màu, cùng ký hiệu) |
| ERD Data Pack | `diagrams/erd-datapack-01_data.*` | MS 1.2 (dữ liệu mẫu) | giữ |
| Sơ đồ lớp Data Pack | `diagrams/datapack-class-diagram.*` (có script `tools/generate_datapack_class_diagram.py`) | Phụ lục | giữ |
| DBML | `diagrams/contract-smart/*.dbml` | không dùng | |

Sơ đồ mới cần vẽ (Mermaid đã có trong tài liệu, xuất PNG bằng `mmdc` hoặc vẽ lại draw.io cho đẹp):
toàn cảnh service (`HE_THONG.md` §2), token ba lớp (`HE_THONG.md` §3), đồ thị phụ thuộc
(`LUAN_CU_KIEN_TRUC.md` §5), máy trạng thái hợp đồng (`PHAN_TICH_THIET_KE.md` §5.1), S1, S4, L3, L4
(sơ đồ tuần tự), sơ đồ triển khai compose (container, mạng, volume, cổng duy nhất 3000).

### 3.2. Ảnh chụp có sẵn (`codecash/apps/web/public/guide/images`, 96 tệp)

Nhóm theo màn; mỗi nhóm ghi dùng vào hình nào của báo cáo và ai chụp lại.

| Nhóm | Ảnh cũ | Dùng vào | Ai chụp lại |
| --- | --- | --- | --- |
| Đăng nhập, chào mừng, mẹo | `login`, `login-demo-menu`, `welcome`, `header-tips`, `guide-drawer` | LT f; LT c (đăng nhập) | TV1 (thêm ảnh quên mật khẩu, nhận lời mời, đổi mật khẩu) |
| Menu theo vai trò | `nav-owner`, `nav-finance`, `nav-legal`, `nav-secondary`, `nav-supplier`, `nav-admin`, `nav-auditor`, `nav-sysadmin` | LT c (cùng một ứng dụng, mỗi vai trò thấy khác) | TV1 |
| Quản trị | `admin-organizations`, `admin-users`, `admin-create`, `admin-import`, `admin-permissions`, `admin-contract-templates`, `admin-template-editor` | LT c (ma trận quyền), LT f | TV1, TV2 (mẫu hợp đồng) |
| Bảng dữ liệu dùng chung | `table-search`, `table-filter-builder`, `table-column-filter`, `table-export` | LT d (component dùng chung, lọc theo toán tử) | TV1 |
| Tổng quan, thông báo | `dashboard`, `dashboard-tiles`, `notifications`, `activity` | LT f | TV6 |
| Soạn hợp đồng | `upload-form`, `upload-demo-filled`, `upload-document`, `upload-real-preview`, `upload-positions`, `upload-signers`, `upload-digitize`, `upload-digitize-edit`, `contract-modal` | MS 2.5 (L2), LT f | TV2 |
| Rà soát trích xuất | `review-extraction-start`, `review-extraction-read`, `review-extraction-values`, `review-live-preview`, `review-account-search`, `review-guide-downloads` | LT f (nếu giữ trích xuất) | TV2 |
| Ký | `signing-flow`, `signing-turn`, `signing-method`, `sign-dock-qr`, `sign-dock-token`, `sign-phone-steps`, `sign-remote-waiting`, `sign-verified`, `verify`, `review-signature-*` | MS 2.5 (L3), MS 4 (PENDING_PROVIDER: `sign-remote-waiting`), LT f | TV3 |
| Hợp đồng, việc cần làm | `contracts`, `contracts-supplier`, `contract-detail`, `contract-detail-events`, `tasks`, `tasks-owner`, `tasks-detail`, `mobile-tasks` | LT e (bảng ảo hoá), LT f, LT-09 (390 px: `mobile-tasks`) | TV4 |
| Chứng từ, phê duyệt | `evidence`, `evidence-invoice`, `evidence-ready`, `approval`, `approval-evidence`, `approval-confirm` | MS 2.5 (L4), LT f | TV4 |
| Tranh chấp, ngoại lệ, phụ lục, thanh lý | `dispute`, `dispute-resolved`, `exceptions`, `exception-propose`, `exception-decide`, `amendment-form`, `amendment-review`, `liquidation-review` | MS 2.5 (L5, L8), LT-T3 | TV4 |
| Quyết định | `decision`, `decision-amounts`, `decision-rules`, `decision-events`, `decision-replay`, `decision-history` | MS 6.3, LT d (Compound `<DecisionTrace>`) | TV5 |
| Bộ luật | `rules-editor`, `rules-formulas`, `rules-variables`, `rules-preview`, `rules-syntax-error`, `rules-unit-error` | MS 3 (decision), LT f | TV5 |
| Chi tiền | `transfer` | MS 2.5 (L6), MS 4 (PENDING) | TV5 (thêm ảnh lệnh PENDING, FAILED, gửi lại) |
| Kiểm toán | `integrity` | MS 2.5 (L7) | TV6 (thêm ảnh DLQ) |
| Dữ liệu Data Pack | `data`, `data-kpi`, `data-upload`, `data-trace` | MS 6.3 (màn "Kiểm chứng bộ luật") | TV5 nếu giữ D2 |

Ảnh **mới phải chụp** (không có ở CodeCash): `docker compose ps` và mỗi service một database; Swagger
từng service; Newman xanh; GitHub Actions xanh (job `stack`); thí nghiệm F1–F4 (biểu đồ k6 trước/sau,
log bù trừ, DLQ có message hỏng); React Profiler trước/sau (TV4); Lighthouse trước/sau (TV6); báo cáo
độ phủ Vitest; các màn xác thực mới.

### 3.3. Cách chụp lại hàng loạt

`codecash/scripts/guide-screenshots.mjs` đăng nhập từng vai trò từ menu demo, làm thao tác thật (duyệt,
ký, giải quyết tranh chấp) rồi chụp, khoanh số đỏ. Chuyển nó sang `btl-frontend/scripts/` (TV6, phần
nền web), đổi `WEB_URL` trỏ vào web chạy qua gateway của compose, đổi tên ảnh khi màn đổi. Mỗi lần giao
diện đổi, chạy lại một lệnh là có bộ ảnh mới cho cả hướng dẫn trong ứng dụng lẫn báo cáo.

Quy ước: ảnh báo cáo khổ 1440×900, chế độ sáng, dữ liệu mẫu đã khôi phục; tên `MS-<chương>-<số>-<mô-tả>.png`,
`LT-<mục>-<số>-<mô-tả>.png`; chú thích "Hình x.y. <màn>, vai trò <vai trò>, <điểm cần nhìn>".

## 4. Báo cáo Microservices (≥ 30 trang, đặt mục tiêu 36–40)

Yêu cầu nội dung của đề (MS-D1): bài toán và nghiệp vụ; thiết kế kiến trúc (sơ đồ một trang, bảng
service – dữ liệu – trách nhiệm, vì sao chia, công nghệ); thiết kế API; độ tin cậy và xử lý lỗi; triển
khai và kiểm thử; đánh giá; hạn chế.

| Chương, mục | Nội dung | Trang | Nguồn chính | Hình | Viết | Trạng thái |
| --- | --- | --- | --- | --- | --- | --- |
| Bìa, mục lục, danh mục hình | | 3 | | | TV1 | |
| **1. Bài toán và nghiệp vụ** | | **6** | | | TV2 chủ trì | |
| 1.1 Bài toán chi tiền theo mốc | vấn đề thật, ai bị ảnh hưởng | 1 | `LUAN_CU_KIEN_TRUC.md` §1, `33_…` §2 | | TV2 | |
| 1.2 Dữ liệu mẫu | Data Pack là gì, dùng vào đâu | 0,5 | `DINH_VI_SAN_PHAM.md` §5 | ERD Data Pack | TV4 | |
| 1.3 Vai trò và luồng tổng thể | 9 vai trò + khách | 1,5 | `PHAN_TICH_THIET_KE.md` §2 | BPMN theo vai trò | TV1 | |
| 1.4 Phạm vi | MoSCoW | 0,5 | `PHAN_TICH_THIET_KE.md` §1 | | TV2 | |
| 1.5 Quy tắc nghiệp vụ | bảng 26 quy tắc có mã lỗi (MS-R1) | 2 | `PHAN_TICH_THIET_KE.md` §4 | | TV2 gom, mỗi người viết quy tắc của mình | |
| 1.6 Ràng buộc pháp lý | trần phạt, chữ ký điện tử, hoá đơn, không giữ tiền | 0,5 | `DINH_VI_SAN_PHAM.md` §4.2 | | TV2 | |
| **2. Kiến trúc** | | **8** | | | TV1 chủ trì | |
| 2.1 Hiện trạng ban đầu và vì sao tách | CodeCash monolith; tải thật; lý do thật | 1,5 | `LUAN_CU_KIEN_TRUC.md` §1 | kiến trúc cũ | TV1 | |
| 2.2 Sơ đồ một trang, bảng service – dữ liệu – trách nhiệm | | 1,5 | `HE_THONG.md` §1–2 | toàn cảnh | TV1 | |
| 2.2a Vì sao chia đúng 6 service | sáu tiêu chí, số đo lịch sử mã, kịch bản thay đổi và sự cố, so sánh 4 phương án, ranh giới yếu | 2 | `LUAN_CU_KIEN_TRUC.md` §2 | bảng §2.6 | TV1 |
| 2.3 Gateway và xác thực ba lớp | RS256, JWKS, refresh, giới hạn | 1,5 | `gateway/README.md`, `HE_THONG.md` §3 | token ba lớp | TV1 | |
| 2.4 Đồng bộ, bất đồng bộ, đồ thị phụ thuộc | | 1,5 | `LUAN_CU_KIEN_TRUC.md` §3, §5 | đồ thị phụ thuộc | TV6 | |
| 2.5 Các luồng chính | L1–L8 | 2 | `LUAN_CU_KIEN_TRUC.md` §8 | L3, L4 + ảnh màn | mỗi người luồng của mình | |
| **3. Thiết kế từng service** | mỗi service ≥ 1 trang: dữ liệu, endpoint, quy tắc, sơ đồ mã | **8** | `SERVICE.md`, `openapi.yaml`, `PHAN_TICH_THIET_KE.md` §6 | ERD theo service | chủ service | |
| 3.1 Chassis dùng chung | lỗi RFC 9457, DTO, lọc/nhập/xuất, `ServiceClient` | 1 | `MODULES.md` | | TV1 | |
| **4. Độ tin cậy và xử lý lỗi** | | **6** | | | TV6 chủ trì | |
| 4.1 Bảng lời gọi: timeout, thử lại, khi thất bại | | 1 | `PHAN_TICH_THIET_KE.md` §7 | | TV6 | |
| 4.2 Saga S1–S4 | bù trừ, PENDING, đối soát | 2 | `PHAN_TICH_THIET_KE.md` §8 | S1, S4 | TV3, TV4, TV5 | |
| 4.3 Outbox, hàng đợi, consumer idempotent, DLQ | | 1,5 | `LUAN_CU_KIEN_TRUC.md` §6 | | TV6 | |
| 4.4 Circuit breaker, bulkhead | | 0,5 | | | TV5 | |
| 4.5 Phân loại lỗi trả cho người dùng | 4xx, 503, 504, 202 | 1 | `PHAN_TICH_THIET_KE.md` §7 | | TV1 | |
| **5. Triển khai và kiểm thử** | | **5** | | | TV1 chủ trì | |
| 5.1 Docker, compose, chạy trên máy sạch | | 1 | `HE_THONG.md` §6 | triển khai compose | TV1 | |
| 5.2 CI: các bước và vì sao GitHub Actions | | 1 | `LUAN_CU_KIEN_TRUC.md` §7 | ảnh Actions | TV1 | |
| 5.3 Test từng service, Postman, Newman | số test, số request | 1 | | ảnh Newman | mỗi người số của mình | |
| 5.4 Thí nghiệm lỗi F1–F4 | kịch bản, cách đo, bảng trước/sau | 2 | `PHAN_TICH_THIET_KE.md` §9 | biểu đồ k6 | TV3, TV4, TV5, TV6 | |
| **6. Đánh giá** | | **3** | | | TV5 chủ trì | |
| 6.1 Đối chiếu yêu cầu đề | bảng MS-R1…R8, MS-B1…B4 | 1 | `PHAN_TICH_THIET_KE.md` §10.1 | | TV1 | |
| 6.2 Số liệu thí nghiệm | tỷ lệ lỗi, p95, giao dịch treo, trùng | 1 | 5.4 | | TV6 | |
| 6.3 Độ đúng của engine | kết quả trên dữ liệu mẫu, bộ ca kiểm, kiểm đột biến | 1 | `NGHIEP_VU.md` §8–10, `GIAI_THICH_SO_LIEU_PITCH.md` | ảnh kiểm chứng bộ luật | TV5 | |
| **7. Hạn chế và hướng phát triển** | token còn sống 15 phút ở service khác; chữ ký mô phỏng; neo nội bộ; một máy Postgres | 1 | `LUAN_CU_KIEN_TRUC.md` §9–10, `DINH_VI_SAN_PHAM.md` §4.2 | | TV1 | |
| Phụ lục | từ điển trạng thái, OpenAPI rút gọn, ADR | 3 | `NGHIEP_VU.md` §14, `PHAN_TICH_THIET_KE.md` §11 | | TV2 | |

## 5. Báo cáo LTWNC (≤ 20 trang)

Đề yêu cầu tám mục a–h; ngân sách trang theo phân tích yêu cầu.

| Mục | Nội dung | Trang | Nguồn | Hình | Viết |
| --- | --- | --- | --- | --- | --- |
| a | Đề tài, vai trò, danh sách chức năng (đánh dấu cái chưa xong) | 2 | `DINH_VI_SAN_PHAM.md` §1–3, `PHAN_TICH_THIET_KE.md` §1 | BPMN | TV2 |
| b | Kiến trúc B (React + Vite + NestJS) kèm sơ đồ, cấu trúc thư mục, sơ đồ CSDL | 3 | `btl-frontend/CLAUDE.md`, `HE_THONG.md` | toàn cảnh, cây thư mục, ERD | TV1 |
| c | Ma trận phân quyền và các lớp bảo vệ | 2 | `permissions.json`, `PHAN_TICH_THIET_KE.md` §2 | menu theo vai trò, `<Can>` | TV1 |
| d | Lựa chọn kỹ thuật: state (Redux Toolkit cho phiên, TanStack Query cho dữ liệu máy chủ và lý do), pattern React (Compound, Render Props, HOC), hook generic | 3 | `DINH_VI_SAN_PHAM.md` T5, `08_HUONG_DAN_PHAT_TRIEN_UI.md` | mã trích ngắn kèm đường dẫn | TV2, TV4, TV5 (mỗi người một pattern) |
| e | Hiệu năng (Profiler, Lighthouse trước/sau), kết quả test, độ phủ | 3 | | ảnh Profiler, Lighthouse, coverage | TV4, TV6 |
| f | Ảnh giao diện các màn chính | 3 | §3.2 | 10–12 ảnh | mỗi người 2 ảnh |
| g | Phân công và % đóng góp | 1 | `KICH_BAN_VIBE_CODE.md` §3, thống kê commit | bảng | TV1 |
| h | Kết luận | 1 | | | TV1 |
| | Dự phòng | 2 | | | |

Không dán mã dài (đề cấm); trích ngắn ≤ 15 dòng kèm đường dẫn tệp.

## 6. Tài liệu tham khảo (cuối mỗi báo cáo)

Chỉ liệt kê văn bản pháp luật đã dẫn (`DINH_VI_SAN_PHAM.md` §4.2), tiêu chuẩn và tài liệu kỹ thuật
(RFC 9457, OAuth 2.0 Security BCP, NIST SP 800-63B, tài liệu NestJS, React, RabbitMQ), và đề bài.

## 7. Slide Microservices (≤ 10) và người nói

| # | Slide | Nội dung | Người |
| --- | --- | --- | --- |
| 1 | Bài toán | chi tiền theo mốc bằng tay: chậm, sai, chi trùng, không giải thích được | TV2 |
| 2 | Sản phẩm trong một câu | luồng soạn → ký → chứng từ → quyết định → chi → kiểm toán | TV2 |
| 3 | Vì sao microservices (và vì sao không phải vì hiệu năng) | ranh giới rủi ro, phụ thuộc ngoài, Python, 6 người | TV1 |
| 4 | Sơ đồ một trang + bảng service | 6 + identity + gateway, database riêng | TV1 |
| 5 | Đồng bộ hay hàng đợi | đồ thị phụ thuộc không vòng; 3 chỗ dùng hàng đợi | TV6 |
| 6 | Saga S1 và S4 | bù trừ, PENDING, Idempotency-Key | TV3, TV5 |
| 7 | Thí nghiệm lỗi | bảng trước/sau F1–F4 | TV4, TV6 |
| 8 | Triển khai và CI | một lệnh compose; CI 5 bước, job `stack` | TV1 |
| 9 | Đánh giá | bảng yêu cầu đề đã đạt; độ đúng engine | TV5 |
| 10 | Hạn chế, hướng phát triển | | TV1 |

## 8. Kịch bản demo trực tiếp (khoảng 15 phút cho môn MS)

Dựa trên `codecash/docs/KICH_BAN_DEMO.md` và câu chuyện ở `33_…` §4.2, đổi sang SCW và thêm cảnh lỗi.
Chuẩn bị: `docker compose up --build --wait`; đăng nhập quản trị, khôi phục dữ liệu mẫu; mở sẵn hai cửa
sổ trình duyệt (bên mua, nhà cung cấp) và một cửa sổ terminal.

| Cảnh | Tài khoản | Làm gì | Điểm cần nói | Người |
| --- | --- | --- | --- | --- |
| 1 | — | `docker compose ps`; chỉ gateway có cổng; `GET /api/v1/health` gộp trạng thái | mỗi service một database, một cửa vào | TV1 |
| 2 | khách | đăng ký công ty mới; quản trị công ty mời một chủ hợp đồng; mở hộp thư đi, nhận lời mời | RS256, refresh, mời thay vì đặt mật khẩu hộ | TV1 |
| 3 | `owner@novaan.vn` | soạn hợp đồng từ mẫu; nhập trần phạt 10% cho hợp đồng thương mại → 422 | BR-A05, lỗi có `code` | TV2 |
| 4 | `supplier@phuminh.vn`, rồi bên mua | rà soát, xác nhận hai bên; ký lần lượt; hợp đồng tự hiện ở phần thực hiện | S1, S2 qua hàng đợi | TV3 |
| 5 | nhà cung cấp, rồi `finance@novaan.vn` | nộp biên bản, hoá đơn; mốc HOLD, "việc còn lại" chỉ đúng người; phê duyệt → PENALTY có số tiền và vết luật | L4, chấm đồng bộ | TV4, TV5 |
| 6 | `finance@novaan.vn` | lập và duyệt lệnh chi → đã chi | S4, Idempotency-Key | TV5 |
| 7 | terminal | **F1**: `docker compose stop decision`, nộp chứng từ → 201 + `PENDING_EVALUATION`; bật lại → tự chấm | không mất chứng từ, không đoán quyết định | TV4 |
| 8 | terminal | **F2**: ngân hàng chậm 5 s → lệnh `PENDING`; circuit breaker mở; bật lại → đối soát, không chi trùng | | TV5 |
| 9 | `auditor@…`, khách | kiểm chuỗi băm hợp lệ; khách xác minh văn bản bằng mã băm | L7 | TV6, TV3 |

Video LTWNC (5–10 phút): cắt từ cảnh 2–6, mỗi người khoảng 1 phút, thêm 1 phút kỹ thuật web (Redux
DevTools khi làm mới token, Profiler trước/sau, chạy `pnpm check`).

## 9. Lịch viết (song song với lịch làm ở `KICH_BAN_VIBE_CODE.md` §4)

| Khi | Việc |
| --- | --- |
| 27–29/11 | Mỗi người: mục quy tắc của mình (MS 1.5), `SERVICE.md` đủ mục (dùng thẳng cho MS 3) |
| 30/11–03/12 | Mỗi người: luồng của mình (MS 2.5) kèm ảnh chụp tạm; TV1: chương 2, 5.1–5.2 |
| 04–07/12 | Saga, độ tin cậy (MS 4); chuyển script chụp màn hình (TV6) |
| 08–10/12 | Thí nghiệm F1–F4 và số liệu (MS 5.4, 6.2); Profiler, Lighthouse, coverage (LT e) |
| 11/12 | Chụp lại toàn bộ ảnh bằng script; ghép hai báo cáo; tài liệu tham khảo |
| 12/12 | Đọc chéo (mỗi người đọc chương của người kế), sửa thống nhất thuật ngữ theo từ điển trạng thái, xuất PDF |
| 13–14/12 | Slide, diễn tập hai lần có bấm giờ, tập câu hỏi §10 |

## 10. Câu hỏi vấn đáp thường gặp

Câu trả lời gợi ý ngắn; đọc thêm ở tệp ghi bên cạnh.

| Câu hỏi | Trả lời gợi ý | Đọc |
| --- | --- | --- |
| Tải nhỏ vậy sao phải microservices? | Đúng, monolith đủ; tách vì ranh giới rủi ro, phụ thuộc ngoài, engine Python, làm song song; nhóm trả giá bằng saga, outbox, idempotency | `LUAN_CU_KIEN_TRUC.md` §1 |
| Vì sao 6 service, không 3 hay 10? | mỗi service khác các service khác ở ≥ 3 trong 6 tiêu chí; 47% thay đổi trong lịch sử mã nằm gọn một vùng; gộp thô thì lỗi ngân hàng và cập nhật luật kéo cả phần thực hiện, chia theo bảng thì phê duyệt cần 3–4 lời gọi và phá dòng sự kiện của mốc | `LUAN_CU_KIEN_TRUC.md` §2.1, §2.2, §2.6 |
| contract và execution hay sửa cùng nhau, sao vẫn tách? | đúng, đó là ranh giới yếu nhất (20% đổi một mình); giảm bằng gói hợp đồng có phiên bản là hợp đồng duy nhất giữa hai bên, không chung kiểu; có dấu hiệu để gộp lại nếu vẫn dính | `LUAN_CU_KIEN_TRUC.md` §2.5, §2.8 |
| Thực tế có ai tách như vậy không? | ký số, thanh toán, hoá đơn điện tử, lưu nhật ký vốn là các hệ riêng nối qua API; signing, payment, audit trùng các đường nối đó | `LUAN_CU_KIEN_TRUC.md` §2.7 |
| Service A cần dữ liệu của B thì sao? | gọi API qua `ServiceClient` hoặc nhận sự kiện; không đọc database của nhau; execution giữ ảnh chụp hợp đồng | `LUAN_CU_KIEN_TRUC.md` §2–3 |
| Sao không dùng hàng đợi cho chi tiền? | người duyệt cần kết quả ngay; trường hợp không chắc đã có PENDING và đối soát | `LUAN_CU_KIEN_TRUC.md` §6 |
| Decision sập thì sao? | chứng từ vẫn lưu (201), mốc `PENDING_EVALUATION`, job chấm lại; F1 có số liệu | `PHAN_TICH_THIET_KE.md` §8, §9 |
| Chi trùng được không? | `Idempotency-Key`, một lệnh mỗi mốc, khoá mốc, PENDING thay vì đoán | §4 `LUAN_CU_KIEN_TRUC.md` |
| Token bị lộ thì sao? Đăng xuất có hết hiệu lực không? | access 15 phút; identity kiểm thu hồi ngay, service khác tới khi hết hạn; refresh bị chép thì lộ khi dùng lại, thu hồi cả họ | identity `SERVICE.md` mục Token |
| Gateway có chứa nghiệp vụ không? | không: chỉ định tuyến và chính sách, không đọc body, không import mã service | `gateway/README.md` |
| Vì sao GitHub Actions? | repo public miễn phí không giới hạn phút, gắn bảo vệ nhánh, có Docker cho job `stack` | `LUAN_CU_KIEN_TRUC.md` §7 |
| Engine đúng đến đâu? | kết quả trên dữ liệu mẫu và bộ ca kiểm; bộ kiểm hồi quy chạy trong CI của decision; không suy rộng từ 20 mẫu | `NGHIEP_VU.md` §10, `GIAI_THICH_SO_LIEU_PITCH.md` |
| Chữ ký có giá trị pháp lý không? | đây là chữ ký điện tử mô phỏng; muốn tương đương chữ ký tay phải dùng chữ ký số của tổ chức được cấp phép | `DINH_VI_SAN_PHAM.md` P4 |
| Sao không Redux cho mọi thứ? (LTWNC) | Redux giữ phiên (state toàn cục thật); dữ liệu máy chủ là cache, TanStack Query lo cache, invalidation | `DINH_VI_SAN_PHAM.md` T5 |
| Bảo vệ nhiều lớp ở đâu? (LTWNC) | route ẩn theo quyền; gateway kiểm token; guard kiểm quyền; service kiểm phạm vi dữ liệu | `PHAN_TICH_THIET_KE.md` §2 |

Câu hỏi riêng theo người (mỗi người tự chuẩn bị 3 câu sâu về phần mình, ghi vào cuối `SERVICE.md` của
mình mục "Câu hỏi vấn đáp", trưởng nhóm hỏi thử ngày 13/12):

| Người | Gợi ý chủ đề |
| --- | --- |
| TV1 | luồng refresh và phát hiện dùng lại; gateway kiểm JWKS khi khoá xoay vòng; outbox gắn với chuỗi băm |
| TV2 | bảng chuyển trạng thái dùng chung web–service; vì sao trần phạt theo loại hợp đồng; khoá điều khoản khi hai bên xác nhận |
| TV3 | bù trừ S1 theo thứ tự ngược; PENDING_PROVIDER và đối soát; mã băm văn bản và niêm phong |
| TV4 | vì sao chấm đồng bộ nhưng không mất chứng từ khi decision sập; "việc còn lại" tính thế nào; ảo hoá bảng mốc |
| TV5 | engine 9 bước, luật first-match; công thức phạt và làm tròn; Idempotency-Key và circuit breaker |
| TV6 | consumer idempotent và DLQ; kiểm chuỗi băm chéo giữa các service; cách đo F4 |
