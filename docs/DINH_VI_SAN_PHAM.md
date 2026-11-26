# Định vị sản phẩm: từ bài dự thi lên bài tập lớn

Đọc trước tiên nếu bạn mới vào nhóm. Tệp này trả lời: **BTL làm sản phẩm gì, cho ai, khác bài dự thi
CodeCash ở đâu, và sửa những gì cho sát thực tế.** Tận dụng mã và tài
liệu cũ cụ thể ra sao: `TAN_DUNG_CODECASH.md`. Báo cáo và bảo vệ: `BAO_CAO_VA_BAO_VE.md`. Triển khai
từng ngày: `TRIEN_KHAI_NHOM.md`.

**Luật cập nhật**: mỗi khi nhóm quyết định đổi một điểm ở §4 (thêm, bỏ, đổi mức ưu tiên), sửa bảng đó
và ghi một dòng vào §7 "Nhật ký quyết định".

## 1. Một câu

> **Một nền tảng SaaS B2B để bên mua và nhà cung cấp soạn, ký và thực hiện hợp đồng trả tiền theo
> mốc; hệ thống tự kiểm điều kiện chi của từng mốc theo luật đã thoả thuận, cho biết trả, giữ, phạt hay
> từ chối và vì sao, chống chi trùng, và lưu vết không sửa được để kiểm toán.**

Tên sản phẩm trong BTL: **Smart Contract Workflow** (gọi tắt SCW). "CodeCash" là tên bài dự thi; trên
giao diện, tài liệu và báo cáo BTL dùng tên SCW (thay chuỗi thương hiệu `brand.*` trong `locales`, logo
`BrandMark`, tiêu đề tài liệu). Tài khoản demo của đơn vị vận hành dùng tên miền `@scw.vn` (`sysadmin@scw.vn`, `auditor@scw.vn`); tài khoản
của các công ty mẫu (`@novaan.vn`, `@phuminh.vn`) giữ nguyên.

## 2. Bài dự thi và bài tập lớn khác nhau ở đâu

| | Bài dự thi CodeCash (Festival, Case 4 của ban tổ chức) | Bài tập lớn SCW |
| --- | --- | --- |
| Người chấm | Ban giám khảo cuộc thi | Hai giảng viên: Microservices (MS), Lập trình Web nâng cao (LTWNC) |
| Câu hỏi được chấm | Engine có ra đúng quyết định trên **Data Pack** cho sẵn không (405 mốc), có giải thích được không | Sản phẩm có **kiến trúc đúng** (service, gateway, độ tin cậy, container) và **web đúng kỹ thuật** (TypeScript, state, hiệu năng, test, phân quyền) không; nhóm có hiểu và giải thích được không |
| Dữ liệu vào | Data Pack cố định: 100 hợp đồng, 405 mốc, 1.134 sự kiện, 65 bên, 128 luật | Người dùng **tự tạo** trong ứng dụng: đăng ký công ty, soạn hợp đồng, ký, nộp chứng từ. Data Pack chỉ còn là **dữ liệu mẫu** và **bộ kiểm hồi quy** |
| Kiến trúc | Một API NestJS (monolith mô-đun) + engine Python gọi như tiến trình con + web | 6 service nghiệp vụ + identity + gateway, mỗi service một database, saga, outbox, hàng đợi |
| Người làm | Nhóm dự thi | **Nhóm BTL 6 người**, mỗi người một lát dọc, commit bằng tài khoản của mình |
| Thước đo thành công | Macro-F1, số ca kiểm, đầu ra đúng mẫu ban tổ chức | Đủ yêu cầu hai đề (`PHAN_TICH_THIET_KE.md` §10), demo trực tiếp chạy đủ luồng, thí nghiệm lỗi có số liệu, từng người trả lời được vấn đáp |
| Sản phẩm hướng tới | Chứng minh ý tưởng trước ban giám khảo | Một sản phẩm dùng được thật ở quy mô doanh nghiệp vừa (§4 sửa cho sát thực tế) |

Hệ quả quan trọng nhất: **những gì chỉ có ý nghĩa với ban tổ chức (định dạng đầu ra Case 4, các "cách
hiểu đề", màn "Kết quả Data Pack" như màn chính) không còn là trung tâm**; chúng chuyển thành bằng
chứng engine đúng, đưa vào chương đánh giá của báo cáo (§5).

## 3. Ai dùng, dùng để làm gì

| Ai | Tình huống thật | Hệ thống giúp gì |
| --- | --- | --- |
| Chủ hợp đồng bên mua (phòng dự án, mua sắm) | Theo dõi hàng chục hợp đồng, mỗi hợp đồng 3–5 mốc; không biết mốc nào đang chờ ai | "Việc còn lại" theo người: ai phải nộp gì, ai phải duyệt gì, hạn khi nào |
| Kế toán, phê duyệt tài chính | Trước khi chi phải gom biên bản, hoá đơn, chữ ký duyệt; tính phạt trễ bằng tay | Quyết định có số tiền chi, số phạt, vết luật; lệnh chi không thể tạo hai lần |
| Pháp chế | Điều khoản phạt vượt mức luật cho phép, sửa điều khoản sau khi đã chốt | Chặn trần phạt theo loại hợp đồng; khoá điều khoản khi hai bên xác nhận |
| Nhà cung cấp | Không biết hồ sơ đã đủ chưa, vì sao chưa được thanh toán | Thấy đúng mốc của mình, chứng từ còn thiếu, lý do bị giữ |
| Kiểm soát viên | Xử lý chứng từ sai mà không ai được tự duyệt cho mình | Ngoại lệ hai người (SoD-2) |
| Kiểm toán (nội bộ, độc lập) | Hỏi "vì sao chi mốc này", "ai sửa gì" | Nhật ký chuỗi băm, kiểm toàn vẹn, quyết định tái lập được |
| Khách (đối tác bên ngoài) | Muốn biết văn bản cầm trong tay có đúng bản đã ký | Xác minh bằng mã băm, không cần tài khoản |

## 4. Sửa cho sát thực tế

Mỗi dòng: hiện trạng ở CodeCash, sửa thành gì, vì sao, mức ưu tiên (M = Must, S = Should, C = Could),
service và người chịu trách nhiệm. **Không sửa mục nào làm đổi kết quả nghiệp vụ (tiền, quyết định,
trạng thái) mà chưa ghi vào §7 và được trưởng nhóm đồng ý** (luật ở `CLAUDE.md` §5).

### 4.1. Dữ liệu và nguồn vào

| # | Hiện trạng CodeCash | Sửa thành | Vì sao | Mức | Ai |
| --- | --- | --- | --- | --- | --- |
| D1 | Hợp đồng chủ yếu nạp từ Data Pack (`domain/datapack.ts`, `seed.ts`) | Luồng chính là **tạo trong ứng dụng** (soạn từ mẫu → rà soát → ký → thực hiện). Data Pack nạp vào **một tổ chức demo** để có sẵn dữ liệu xem | Người dùng thật không có Data Pack | M | TV2 (soạn), TV4 (nạp mẫu) |
| D2 | Màn "Kết quả Data Pack" là một màn chính | Đổi thành "Kiểm chứng bộ luật" chỉ cho quản trị và kiểm toán: chạy bộ luật đang dùng trên dữ liệu mẫu, so với đáp án, xuất CSV | Giữ bằng chứng engine đúng, không đặt một màn của ban tổ chức vào giữa sản phẩm | S | TV5 |
| D3 | Đơn vị tiền "triệu đồng" (`valueMillion`, `plannedMillion`, `payableMillion` theo Data Pack) | Sản phẩm lưu **đồng** dạng chuỗi số nguyên (`valueVnd`); hiển thị định dạng vi-VN. Nạp Data Pack thì nhân 1.000.000 | Hoá đơn, lệnh chi ngân hàng tính bằng đồng; "triệu" chỉ là cách ghi của Data Pack | M | TV2, TV4, TV5 |
| D4 | Làm tròn phạt HALF_UP 0,01 (triệu) | **Cần quyết định**: (a) giữ làm tròn tới 10.000 đồng để khớp đáp án cũ, hoặc (b) làm tròn tới 1 đồng cho hợp đồng tạo trong ứng dụng, giữ (a) khi chạy bộ kiểm Data Pack | Đổi cách làm tròn đổi số tiền; bộ kiểm hồi quy phải vẫn xanh | M | TV5 quyết, trưởng nhóm duyệt |
| D5 | Mã hợp đồng, mã bên theo Data Pack (`CT0103`, `B010`, `S015`) | Mã sinh tự động theo tổ chức và năm (`NOVA-2026-0001`); mã Data Pack giữ cho dữ liệu mẫu | Doanh nghiệp tự đặt quy tắc mã | S | TV2 |
| D6 | `parties` (bên của Data Pack) nằm cùng chỗ với hợp đồng | identity sở hữu tổ chức; execution giữ bản sao chỉ đọc theo mã (`LUAN_CU_KIEN_TRUC.md` §2) | Một nguồn sự thật cho thông tin công ty | M | TV1, TV4 |

### 4.2. Pháp lý (đối chiếu chi tiết: `../docs/tham-khao/03_PHAN_TICH_PHAP_LY.md`, ngoài repo)

| # | Hiện trạng | Sửa thành | Căn cứ | Mức | Ai |
| --- | --- | --- | --- | --- | --- |
| P1 | Data Pack có mốc trần phạt 10–12% | Hồ sơ pháp lý theo **loại hợp đồng**: thương mại ≤ 8% (chặn khi soạn, BR-A05); dân sự theo thoả thuận (cảnh báo); xây dựng vốn nhà nước ≤ 12% (nếu mở rộng) | Luật Thương mại 2005 Điều 301; Bộ luật Dân sự 2015 Điều 418; Luật Xây dựng 2014 Điều 146 | M | TV2 |
| P2 | Lãi chậm thanh toán có ở `late-payment.ts` | Giữ, ghi rõ căn cứ, tham số lãi suất cấu hình theo hợp đồng | Luật Thương mại Điều 306 | S | TV2 (điều khoản), TV5 (tính) |
| P3 | Văn bản hợp đồng dàn trang theo Nghị định 30/2020 | Giữ cách dàn trang (đẹp, quen mắt) nhưng **không ghi là bắt buộc**: Nghị định 30 là thể thức văn bản hành chính, hợp đồng giữa doanh nghiệp không bắt buộc | Nghị định 30/2020/NĐ-CP | S | TV3 |
| P4 | Chữ ký mô phỏng, khoá do máy chủ giữ | Gọi đúng tên: **chữ ký điện tử mô phỏng** (mức `SIMULATED`); ghi trong báo cáo rằng muốn tương đương chữ ký tay phải dùng chữ ký số qua tổ chức cung cấp dịch vụ được cấp phép | Luật Giao dịch điện tử 2023 Điều 22–27; Nghị định 23/2025/NĐ-CP | M | TV3 |
| P5 | Dấu thời gian, neo chuỗi băm tự làm | Giữ, gọi là "neo nội bộ"; nêu hạn chế: dịch vụ dấu thời gian có giá trị pháp lý phải do đơn vị được cấp phép | Luật GDĐT 2023 Điều 28–32 | S | TV6 |
| P6 | Hoá đơn là một sự kiện `INVOICE` với vài trường | Trường của hoá đơn điện tử thật: ký hiệu, số, ngày, MST người bán và người mua, tiền trước thuế, thuế suất, tiền thuế, tổng; kiểm tổng khớp giá trị mốc | Nghị định 123/2020/NĐ-CP (sửa đổi bởi 70/2025/NĐ-CP) | M | TV4 |
| P7 | Lệnh chi đi qua "cổng thanh toán" giả lập | **Không giữ tiền**: hệ thống chỉ tạo lệnh và gửi sang ngân hàng của bên mua (mô phỏng); ghi trong báo cáo vì sao (giữ tiền là trung gian thanh toán, cần giấy phép) | Nghị định 52/2024/NĐ-CP | M | TV5 |
| P8 | Dữ liệu cá nhân của người dùng, gửi hợp đồng cho AI nước ngoài (Gemini) | Không gửi dữ liệu thật ra nước ngoài; trích xuất AI **tắt mặc định** (xem §4.4); ghi chính sách lưu giữ | Luật Bảo vệ dữ liệu cá nhân 2025 | M | TV2, TV1 |
| P9 | Lưu chứng từ không có chính sách thời hạn | Ghi chính sách lưu ≥ 10 năm cho chứng từ kế toán (không xoá cứng, chỉ lưu trữ) | Luật Kế toán 2015 Điều 41 | C | TV4, TV6 |
| P10 | Chứng từ chỉ là tệp, không kiểm chữ ký số trên đó | Xác minh chữ ký số trên chứng từ (chứng thư còn hiệu lực, chưa thu hồi, dấu thời gian) và tra cứu hoá đơn điện tử, **mô phỏng** các dịch vụ bên ngoài; lưu bằng chứng lúc ký | Luật GDĐT 2023 Điều 22–27; Nghị định 23/2025/NĐ-CP; Nghị định 123/2020/NĐ-CP | S | TV3 (xác minh), TV4 (trạng thái chứng từ) |

### 4.3. Nghiệp vụ

| # | Hiện trạng | Sửa thành | Vì sao | Mức | Ai |
| --- | --- | --- | --- | --- | --- |
| N1 | Engine có "profiles" và "switches" cho các cách hiểu đề của ban tổ chức (`BTC_SUBMISSION`…) | Sản phẩm chỉ dùng **một bộ luật đã công bố** cho mỗi hợp đồng (có phiên bản); profiles giữ trong engine để chạy bộ kiểm, không lộ ra giao diện người dùng | Người dùng thật không chọn "cách hiểu đề"; luật là thứ hai bên đã thoả thuận | M | TV5 |
| N2 | Thư viện mốc theo 4 loại quy trình của Data Pack (`WF_GOODS_4STAGE`…) | Giữ làm **mẫu hợp đồng** có sẵn; cho phép doanh nghiệp tạo mẫu riêng (bản sao từ mẫu có sẵn) | Mẫu Data Pack đã sát thực tế (hàng hoá, dịch vụ, phần mềm, bảo trì) | S | TV2 |
| N3 | Phê duyệt theo vai trò cố định của Data Pack | Chính sách phê duyệt cấu hình theo hợp đồng (một người, hai người, theo ngưỡng tiền) dựa trên vai trò sẵn có | Doanh nghiệp vừa duyệt theo ngưỡng | C | TV4 |
| N4 | Thanh lý, phụ lục đã có | Giữ nguyên; đây là phần làm sản phẩm khác hẳn một bài CRUD (LT-T3) | — | M | TV4 |
| N5 | Thông báo trong ứng dụng | Thêm email mô phỏng (hộp thư đi như identity đã làm, hoặc MailHog) | Người dùng thật không ngồi canh màn hình | S | TV6 |
| N6 | Một tài khoản có thể thuộc một tổ chức | Giữ một tổ chức mỗi tài khoản (đơn giản, đủ cho đề); ghi hạn chế | Tránh phạm vi phình | — | — |

### 4.4. Công nghệ và phạm vi

| # | Hiện trạng | Sửa thành | Vì sao | Mức | Ai |
| --- | --- | --- | --- | --- | --- |
| T1 | Trích xuất điều khoản bằng Gemini (`trust/gemini-extractor.ts`) | **Tắt mặc định**; giữ luồng "đề xuất trích xuất → người xác nhận" với nhập tay. Chỉ bật nếu TV2 dư thời gian và có dữ liệu giả | MoSCoW đã xếp AI vào Won't; cần khoá API (bí mật); P8 | Won't | TV2 |
| T2 | Lưu trữ file JSON / MongoDB / PostgreSQL | Chỉ PostgreSQL (file JSON giữ cho test); bỏ MongoDB | Một loại database có giao dịch, dễ vận hành, đủ cho mọi service | M | đã xong ở chassis |
| T3 | Engine Python gọi như tiến trình con | Service `decision` sau một hợp đồng API (hiện FastAPI bọc engine Python; engine thay được, chạy bóng trước khi bật) | thay và mở rộng engine không đụng phần khác; lời gọi có timeout | M | TV5 |
| T4 | Nhà ký từ xa và ký trên điện thoại (`apps/signer`, QR) | Giữ làm **nhà cung cấp ký mô phỏng** riêng: chính là phụ thuộc ngoài để làm PENDING_PROVIDER và thí nghiệm F3 | Có sẵn, đúng chỗ cần cho môn MS | S | TV3 |
| T5 | TanStack Query cho dữ liệu máy chủ | **Giữ** TanStack Query; Redux Toolkit giữ phiên (đã có). Ghi lý do trong báo cáo LTWNC | Đề yêu cầu Redux Toolkit **hoặc** Zustand cho state toàn cục: phiên là state toàn cục và đã ở Redux; dữ liệu máy chủ là cache, không phải state ứng dụng. Nếu giảng viên yêu cầu chặt, chuyển dần sang RTK Query (cùng họ Redux Toolkit) theo từng tính năng | M | TV1 ghi lý do; hỏi giảng viên sớm |

## 5. Data Pack còn được dùng vào đâu

| Dùng vào | Cách dùng |
| --- | --- |
| Dữ liệu demo | Nạp vào tổ chức mẫu (Nova An, Phú Minh…) để mở máy là có hợp đồng ở mọi trạng thái |
| Bộ kiểm hồi quy của engine | `tests/golden` và đáp án 405 mốc: mỗi lần đổi decision phải chạy, kết quả phải giữ nguyên (trừ thay đổi đã ghi §7) |
| Thí nghiệm tải (k6) | Dùng hợp đồng mẫu để có tải thật, không phải dữ liệu bịa |
| Chương đánh giá của báo cáo | Số liệu đúng sai của engine, bộ ca kiểm, kiểm đột biến (`BAO_CAO_VA_BAO_VE.md` §4) |
| Mẫu hợp đồng | 4 quy trình mốc thành mẫu hợp đồng có sẵn (N2) |

## 6. Phần nhóm BTL làm mới

Chassis microservice, tách 6 service, gateway, token RS256 và refresh, saga, outbox, hàng đợi, độ tin
cậy, compose, CI, Postman, thí nghiệm lỗi, các màn xác thực, test front-end, và mọi sửa đổi ở §4. Đây
là phần mỗi người nói sâu khi vấn đáp (cùng phần nghiệp vụ mình chuyển và sửa).

## 7. Nhật ký quyết định

| Ngày | Quyết định | Ai quyết | Ảnh hưởng |
| --- | --- | --- | --- |
| 26/11 | Một sản phẩm cho hai môn, mỗi service một repo, phần nền kéo từ repo cha | Trưởng nhóm | `KIEN_TRUC_REPO.md` |
| 26/11 | Token RS256 + JWKS, access 15 phút, refresh xoay vòng | Trưởng nhóm | identity, gateway, mọi service |
| 27/11 | BTL tách khỏi khung bài dự thi: sản phẩm SCW, tận dụng tối đa mã cũ có sửa cho sát thực tế, Data Pack thành dữ liệu mẫu và bộ kiểm | Trưởng nhóm | tệp này, `TAN_DUNG_CODECASH.md` |
| (chờ) | D4: cách làm tròn tiền phạt | TV5 + trưởng nhóm | decision, bộ kiểm |
