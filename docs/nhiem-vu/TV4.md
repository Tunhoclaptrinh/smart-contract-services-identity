# TV4: execution (thực hiện mốc)

| | |
| --- | --- |
| Repo | `smart-contract-services-execution` → `btl-backend-execution`, cổng 3005, database `execution` |
| Màn web | `btl-frontend/src/features/milestones` (việc cần làm, bảng mốc, chi tiết hợp đồng, nộp chứng từ), `disputes`, ngoại lệ |
| Quy tắc bạn giữ | BR-B03, B05, B08, B09, B11, B12, B13 |
| Saga, thí nghiệm | S3, nhận S2; F1 |
| Duyệt chéo | TV5 |

**Mục tiêu**: hợp đồng đã ký tự xuất hiện; các bên nộp chứng từ, phê duyệt, mở tranh chấp; mỗi thao tác
chấm lại mốc; ai cũng thấy "việc còn lại" của mình.

## Đọc trước (30 phút)

`../NHIEM_VU.md`; `../LUAN_CU_KIEN_TRUC.md` §2.9, §8 L4–L5; `../PHAN_TICH_THIET_KE.md` §5.2, §6, §8 (S3);
`../TAN_DUNG_CODECASH.md` §4.3; `../../codecash/docs/09_VIEC_CON_LAI_VA_HOP_VIEC.md`.

## Việc theo thứ tự

| # | Việc | Xong khi |
| --- | --- | --- |
| 1 | Bước 1 của `NHIEM_VU.md` §4 | |
| 2 | `openapi.yaml`, `SERVICE.md`; duyệt gói hợp đồng (TV2, TV3) và gói dữ kiện (TV5) | |
| 3 | Bảng nghiệp vụ, nạp dữ liệu mẫu cho tổ chức demo, tiền bằng đồng (chuyển `records.ts`, `context.ts`, `datapack.ts`) | mở máy có hợp đồng ở mọi trạng thái |
| 4 | Nộp chứng từ, hoá đơn đủ trường (chuyển `actions/evidence.ts`) | BR-B03, B08, B11, B13 có test |
| 5 | Phê duyệt, từ chối (chuyển `actions/approvals.ts`, `acceptance.ts`) | BR-B05 có test |
| 6 | Gọi decision sau mỗi thao tác (gửi gói dữ kiện), timeout 2 s → `PENDING_EVALUATION`, job chấm lại | test với decision giả: tắt thì không mất chứng từ |
| 7 | Việc cần làm, chi tiết mốc (chuyển `views/tasks.ts`, `responsibility.ts`, `milestones.ts`) | màn đọc không gọi service khác |
| 8 | Tranh chấp, ngoại lệ, phụ lục, thanh lý | BR-B09, B12 có test |
| 9 | Nhập hợp đồng từ `contract.activated` (idempotent), nhận `payment.settled`, gửi yêu cầu xác minh và nhận kết quả | nhập hai lần vẫn một hợp đồng |
| 10 | Màn web; bảng mốc ≥ 200 dòng ảo hoá, đo React Profiler trước/sau | ≥ 5 test mỗi màn; ảnh Profiler |
| 11 | Compose, gateway, ≥ 5 request Postman (có ca 403 `NOT_AUTHORIZED_PARTY`) | job `stack` xanh |
| 12 | F1: tắt decision khi đang nộp chứng từ, đo tỷ lệ thành công, p95, thời gian chấm lại hết | bảng số liệu |

## Phối hợp

| Bạn cung cấp | Cho | | Bạn cần | Từ |
| --- | --- | --- | --- | --- |
| khoá mốc `PAYMENT_REQUESTED` (và trả lại khi bù trừ) | TV5 | | gói hợp đồng, `contract.activated` | TV3 |
| gói dữ kiện của mốc | TV5 | | `POST /evaluations` | TV5 |
| sự kiện chứng từ, phê duyệt, tranh chấp | TV6 | | `POST /verifications`, tệp chứng từ | TV3 |

## Tự kiểm riêng

- Bên không có thẩm quyền nộp loại chứng từ → 403; nộp trùng mã → 409; mốc đã chi → 409.
- Cùng một vai trò duyệt hai lần → 409; vai trò không cần → 403.
- Mở tranh chấp thứ hai → 409; nhà cung cấp đóng tranh chấp → 403.
- Tổng hoá đơn lệch giá trị mốc → 422 `INVOICE_AMOUNT_MISMATCH`.

## Báo cáo và vấn đáp

MS 1.2, MS 2.5 (L4, L5, L8), MS 3 (execution), MS 4.2 (S3), MS 5.4 (F1); LT e (Profiler, ảo hoá). Câu
hỏi: vì sao chấm đồng bộ mà không mất chứng từ khi decision sập; "việc còn lại" tính thế nào; vì sao chứng
từ, phê duyệt, tranh chấp ở cùng một service.

## Khi chậm

Cắt: chính sách duyệt theo ngưỡng → phụ lục → ngoại lệ hai người (giữ tranh chấp, thanh lý).
