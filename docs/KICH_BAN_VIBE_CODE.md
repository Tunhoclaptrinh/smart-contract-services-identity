# Kịch bản chia việc để vibe code nhanh

Mục tiêu: 6 người làm song song từ 27/11, không giẫm chân nhau, AI làm phần chép và chỉnh mã cũ,
người giữ đúng nghiệp vụ. Hạn: bảo vệ khoảng 15/12.

## 1. Năm nguyên tắc tăng tốc

1. **Mỗi người một lát dọc**: một repo service + các màn web gọi service đó. Không ai sửa thư mục
   của người khác, nên gần như không có xung đột merge.
2. **Hợp đồng API trước, mã sau**: ngày đầu mỗi người viết `service/openapi.yaml` và handler MSW
   bên web. Web và service làm song song, không chờ nhau.
3. **Không chờ identity**: service nào cũng tự ký token trong test bằng `signActorToken` của chassis
   (xem `scripts/smoke-service.mjs`), nên chạy, test độc lập từ ngày 1.
4. **AI chép, người duyệt nghiệp vụ**: AI đọc `../codecash`, chép và chỉnh; người đọc lại theo
   `NGHIEP_VU.md` và kiểm số liệu. CI (typecheck, lint, test, kiểm phần nền) là người duyệt đầu tiên.
5. **PR nhỏ, merge mỗi ngày**: một PR một việc (một endpoint, một màn), dưới khoảng 400 dòng tự
   viết (tệp chép nguyên không tính). Cuối ngày không để nhánh treo.

## 2. Chuẩn bị (mỗi người, 30 phút, ngày 27/11)

```bash
mkdir -p ~/btl && cd ~/btl
git clone https://github.com/Tunhoclaptrinh/Code-n-Cash.git codecash          # mã cũ, chỉ đọc
git clone git@github.com:Tunhoclaptrinh/smart-contract-web.git btl-frontend
git clone git@github.com:Tunhoclaptrinh/smart-contract-services.git btl-backend
git clone git@github.com:Tunhoclaptrinh/smart-contract-services-<tên>.git btl-backend-<tên>
cd btl-backend-<tên> && git remote add upstream git@github.com:Tunhoclaptrinh/smart-contract-services.git
pnpm install && pnpm test        # phải xanh trước khi viết dòng đầu tiên
```

Tên thư mục phải **đúng như trên**: `CLAUDE.md` của các repo chỉ tới `../codecash`. Mở công cụ AI ở
thư mục repo đang làm (không mở ở `~/btl`), để nó đọc đúng `CLAUDE.md`.

Trưởng nhóm làm trước, sáng 27/11: tạo repo service cho từng người (`scripts/new-service.sh <tên>`,
`gh repo create`, push, `scripts/protect-branches.sh`), thêm người vào repo (quyền Write), điền
`service/SERVICE.md` phần "Thông tin". Riêng `decision` là Python: tạo repo trống theo mục 3.

## 3. Chia việc

Bản ngắn cho thành viên: `docs/NHIEM_VU.md`; việc chi tiết từng người: `docs/nhiem-vu/TV<số>.md`.

Thiết kế chốt (tính năng, quy tắc, API, saga, ma trận yêu cầu hai môn):
`docs/PHAN_TICH_THIET_KE.md`. Mỗi người sở hữu trọn **một lát dọc**: service + màn web gọi nó +
test + request Postman + một chương báo cáo; lịch sử commit tự nói ai làm gì, vấn đáp ai cũng có
phần sâu của mình.

| Người | Repo service | Màn web (`btl-frontend/src/features/…`) | Quy tắc (§4 thiết kế) | Saga, thí nghiệm | Pattern LTWNC trình bày |
| --- | --- | --- | --- | --- | --- |
| TV1 (trưởng nhóm) | identity; gateway, `compose.yaml`, chassis (repo cha) | đăng nhập, đăng ký, mời, đổi và quên mật khẩu; `platform` | BR-I01, I02 | — (MS-B2, MS-B4) | Redux slice phiên, `ApiClient` tự làm mới token, Render Props `<Can>`, HOC `withPermission` |
| TV2 | contract | `contracts`: danh sách, wizard soạn có lưu nháp, số hoá mốc, rà soát, bình luận | BR-A01…A08 | bước 1 của S1 | Compound `<MilestoneBuilder>`, hook `usePersistentDraft<T>`, một schema kiểm cả web và service |
| TV3 | signing (gồm tài liệu và xác minh) | `signing`: vị trí ký, trình tự, ký; trang khách xác minh mã băm; trạng thái xác minh chứng từ | BR-A09…A12 | S1, phát S2; F3 | vai trò khách, upload kiểm loại tệp, giao diện đúng lượt |
| TV4 | execution | `milestones` (việc cần làm, bảng mốc, chi tiết, chứng từ), `disputes`, ngoại lệ | BR-B03, B05, B08, B09, B11, B12 | S3, nhận S2; F1 | bảng ≥ 200 dòng ảo hoá + Profiler trước/sau, `useListQuery<T>`, `useDebouncedValue<T>` |
| TV5 | decision (engine sau hợp đồng API; hiện Python FastAPI), payment | `decisions` (`<DecisionTrace>`, bộ luật, chạy thử), `payments` | BR-B01, B02, B04, B06, B07, B10 | S4; F2 | Compound `<DecisionTrace>`, type guard `isPayableDecision`, tiền chuỗi thập phân |
| TV6 | audit (gồm thông báo); outbox, consumer, DLQ (phần nền, cùng TV1) | `audit` (nhật ký, kiểm toàn vẹn), `dashboard`, thông báo | — | F4, k6 | Lighthouse trước/sau tách bundle, hạ tầng test web |

Ai sở hữu tệp cũ nào: `docs/DOI_CHIEU_CODECASH.md` (backend), `btl-frontend/docs/DOI_CHIEU_CODECASH.md` (web).

### 3.1. Mỗi người nộp gì ("xong" là thế nào)

| Hạng mục | Tối thiểu | Kiểm ở đâu |
| --- | --- | --- |
| `service/openapi.yaml` | ≥ 4 endpoint nghiệp vụ, mỗi endpoint có lỗi 4xx kèm `code`, khớp §6 thiết kế | PR, CI |
| `service/SERVICE.md` | thông tin, sơ đồ mã, sơ đồ luồng, dữ liệu, endpoint, nguồn CodeCash, rà soát, cải tiến | `pnpm check:docs` |
| Test service | mỗi endpoint một ca đúng + một ca lỗi; mỗi quy tắc mình phụ trách một ca vi phạm | `pnpm test` |
| Màn web | route lazy, quyền trong `navConfig.ts`, chữ vi/en, ≥ 5 test mỗi màn (hàm thuần, tương tác, MSW đúng + lỗi) | `pnpm check` (độ phủ ≥ 50%) |
| Postman | ≥ 5 request qua gateway (đúng + lỗi nghiệp vụ), có script kiểm, thêm vào `postman/` | job CI `stack` |
| Compose, gateway | service trong `compose.yaml` (database riêng), tiền tố trong `gateway/routes.json` | job CI `stack` |
| Saga, thí nghiệm | luồng của mình chạy được qua lỗi (§8, §9 thiết kế), số liệu trước/sau | báo cáo |
| Báo cáo | một chương MS (service, quy tắc, API, độ tin cậy) + phần LTWNC (pattern, state, test) | 11–12/12 |

Thêm service vào hệ chạy chung (người tạo repo service làm một lần, PR vào repo cha `main`): mục
"Chạy cả hệ" của `docs/HE_THONG.md`.

## 4. Lịch

Đã xong trước 27/11 (TV1): chassis (lỗi RFC 9457, DTO, lọc/nhập/xuất, `ServiceClient`, token RS256),
identity đầy đủ, gateway, `compose.yaml`, Postman identity, các màn xác thực của web. Từ 27/11 TV1 lo
nối service mới vào hệ, gỡ vướng phần nền trong ngày, và làm phần nền outbox cùng TV6.

| Ngày | Tất cả | Mốc kiểm |
| --- | --- | --- |
| T6 27/11 | Chuẩn bị (mục 2); điền `SERVICE.md` (dữ liệu, endpoint, nguồn CodeCash); viết `openapi.yaml` | Mỗi repo service CI xanh |
| T7 28/11 | Endpoint đầu tiên + test; màn đầu tiên trên MSW | Mỗi người 1 PR merge |
| CN 29/11 | Endpoint còn lại của luồng chính | |
| T2 30/11 | Mỗi service vào `compose.yaml` và `gateway/routes.json`; web gọi qua gateway | job CI `stack` xanh |
| 01–03/12 | Nghiệp vụ chính từng service; S1, S3 | |
| T6 04/12 | **Ngày tích hợp**: chạy luồng demo §5 từ đầu tới cuối, sửa chỗ gãy | Luồng demo chạy hết |
| 05–07/12 | S2, S4; outbox, RabbitMQ, DLQ; màn còn lại | |
| T3 08/12 | **Đóng tính năng**: chỉ sửa lỗi, test, đo | |
| 08–10/12 | F1, F2 có số liệu; Postman ≥ 5 request mỗi service; độ phủ web ≥ 50% | |
| 11–12/12 | Báo cáo, slide, ảnh chụp | |
| 13–14/12 | Diễn tập 2 lần, có bấm giờ | |

Mỗi ngày: sáng `git pull` (repo service thêm `git fetch upstream` xem có phần nền mới không), tối
PR những gì đã xong. Vướng phần nền: nhắn trưởng nhóm, xử lý trong ngày.

## 5. Luồng demo (thứ tự ưu tiên khi thiếu thời gian)

1. Đăng ký công ty, tạo tài khoản (identity). 2. Soạn hợp đồng từ mẫu, mốc (contract). 3. Ký theo
lượt, niêm phong, hợp đồng có hiệu lực (signing, S1, S2). 4. Nộp chứng từ, phê duyệt (execution).
5. Engine ra quyết định có vết (decision). 6. Lập và chi lệnh (payment, S4). 7. Kiểm chuỗi băm,
thông báo (audit).

## 6. Vòng làm một việc (60–90 phút)

1. `git switch main && git pull && git switch -c feat/<phần>-<việc>`
2. Đưa AI prompt ở mục 7 (thay `<…>`).
3. Đọc danh sách luật AI liệt kê **trước** khi cho nó viết mã; sai nguồn thì sửa ngay lúc này.
4. Chạy dịch vụ, gọi thử qua Swagger (`/api/docs`) hoặc màn web.
5. `pnpm typecheck && pnpm lint && pnpm test` (web: `pnpm check`) xanh.
6. Commit, push, PR: mô tả "chuyển từ `codecash/<tệp>`, đã đổi …", có ảnh hoặc ví dụ request.

## 7. Prompt mẫu

**Viết hợp đồng API cho service (ngày đầu)**

> Đọc `CLAUDE.md`, `service/SERVICE.md`, `docs/DOI_CHIEU_CODECASH.md` mục <service>, và các tệp cũ
> được liệt kê trong `../codecash/apps/api/src`. Viết `service/openapi.yaml` (OpenAPI 3.1) cho các
> endpoint ở `SERVICE.md`: schema request/response lấy đúng tên trường cũ, mỗi endpoint có lỗi 4xx
> nghiệp vụ kèm `code`. Cập nhật bảng Endpoint trong `SERVICE.md`. Chưa viết mã.

**Chuyển một endpoint**

> Theo quy trình mục 5 của `CLAUDE.md`, chuyển `<phương thức đường dẫn>` từ
> `../codecash/apps/api/src/<tệp>` (hàm `<tên>`) vào service này. Trước khi viết mã: liệt kê các
> luật nghiệp vụ hàm cũ làm, mỗi luật kèm mục `NGHIEP_VU.md`. Sau đó chép, chỉnh import sang
> `@sc/nest-common`, chỉ dùng bảng của service này, viết test (một ca đúng, một ca lỗi), chạy kiểm
> tra đến xanh. Ghi rà soát và cải tiến vào `SERVICE.md`.

**Rà soát nghiệp vụ một phần đã chuyển**

> So `service/src/<tệp>` với `../codecash/apps/api/src/<tệp cũ>` và `../codecash/docs/NGHIEP_VU.md`
> mục <số>. Liệt kê: luật bị mất, luật đổi kết quả, mã lỗi đổi, trường hợp biên chưa có test. Không
> sửa mã; ghi kết quả vào mục "Rà soát" của `SERVICE.md`.

**Chuyển một màn web**

> Đọc `CLAUDE.md` của `btl-frontend`. Chuyển màn `<tên>` từ `../codecash/apps/web/src/features/<x>/`
> vào `src/features/<x>/`: route lazy trong `src/router.tsx`, mục menu trong
> `src/shared/layout/navConfig.ts`, chữ trong `src/locales/{vi,en}/<x>.json`, API theo
> `openapi.yaml` của service trong `src/features/<x>/api.ts`, handler MSW cho test. Viết ≥ 5 test.

**CI đỏ**

> CI báo lỗi sau: <dán log>. Tìm nguyên nhân, sửa trong phạm vi được sửa của `CLAUDE.md`. Nếu lỗi
> do kiểm phần nền thì hoàn tác tệp nền và cho tôi biết cần đổi gì ở repo cha.

## 8. Bẫy hay gặp khi vibe code

| Bẫy | Cách tránh |
| --- | --- |
| AI sửa chassis, cấu hình cho "chạy được" | CI chặn (`check-base-untouched`); yêu cầu thay đổi phần nền qua trưởng nhóm |
| AI bịa luật nghiệp vụ | Bắt nó trích mục `NGHIEP_VU.md` trước khi viết mã (bước 3 mục 6) |
| Dùng số thực cho tiền | Chuỗi thập phân như CodeCash; test với số lẻ |
| Đọc thẳng bảng của service khác | Gọi API qua gateway hoặc nhận sự kiện |
| Tin vai trò, mã tổ chức client gửi | Lấy từ `req.user` |
| PR khổng lồ, nhánh sống nhiều ngày | Một PR một việc, merge mỗi ngày |
| Nhánh tụt sau phần nền | `git merge origin/main` (repo service: PR `sync/base-<ngày>` theo `KIEN_TRUC_REPO.md`) |
