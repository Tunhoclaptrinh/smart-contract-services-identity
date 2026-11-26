# TV5: decision và payment (quyết định và chi tiền)

| | |
| --- | --- |
| Repo | `smart-contract-services-decision` (`btl-backend-decision`, cổng 3006), `smart-contract-services-payment` (`btl-backend-payment`, cổng 3007) |
| Màn web | quyết định (`<DecisionTrace>`, bộ luật, chạy thử, kiểm chứng bộ luật), duyệt chi |
| Quy tắc bạn giữ | BR-B01, B02, B04, B06, B07 (decision), BR-B10 (payment) |
| Saga, thí nghiệm | S4 (điều phối); F2 |
| Duyệt chéo | TV4 |

**Mục tiêu**: mỗi mốc được chấm ra trả, giữ, phạt, từ chối kèm vết luật, tái lập được theo phiên bản
luật; lệnh chi chỉ tạo từ quyết định trả tiền, không bao giờ chi hai lần.

## Đọc trước (30 phút)

`../NHIEM_VU.md`; `../LUAN_CU_KIEN_TRUC.md` §2.1b, §8 L6; `../PHAN_TICH_THIET_KE.md` §6, §7, §8 (S4);
`../TAN_DUNG_CODECASH.md` §4.4–4.5; `../../codecash/docs/NGHIEP_VU.md` §5–7.

## Việc theo thứ tự

| # | Việc | Xong khi |
| --- | --- | --- |
| 1 | Bước 1 của `NHIEM_VU.md` §4; repo decision (Python) nhóm trưởng dựng sẵn | `pytest` xanh |
| 2 | `openapi.yaml` của decision (gói dữ kiện vào, quyết định + vết ra) và payment | TV4 duyệt |
| 3 | **Chốt D4** (làm tròn tiền phạt khi tiền tính bằng đồng) với nhóm trưởng | ghi `DINH_VI_SAN_PHAM.md` §7 |
| 4 | decision: `POST /evaluations` nhận gói dữ kiện qua JSON, gọi engine, lưu kết quả và vết | bộ kiểm hồi quy khớp đáp án |
| 5 | `GET /decisions/{milestoneId}`, `/trace`; `dryRun` | |
| 6 | Bộ luật có phiên bản: `GET/POST /rule-sets`, `publish`, kiểm an toàn; phát `rule_set.published` | 422, 409 có test |
| 7 | payment: `POST /payment-orders` + `Idempotency-Key`, duyệt, ngân hàng mô phỏng có biến chậm/lỗi | BR-B10 có test |
| 8 | Saga S4: khoá mốc ở execution → xác nhận quyết định → lệnh `APPROVED` → ngân hàng; timeout → `PENDING` + đối soát; lỗi rõ → bù trừ | test ba nhánh |
| 9 | Circuit breaker + bulkhead quanh ngân hàng; phát `payment.settled` | |
| 10 | Màn web: `<DecisionTrace>` (Compound), bộ luật, duyệt chi (hiển thị `PENDING`, gửi lại), kiểm chứng bộ luật | ≥ 5 test mỗi màn; type guard `isPayableDecision` |
| 11 | Compose (hai service + ngân hàng mô phỏng), gateway, ≥ 5 request Postman (có ca 409 `ORDER_EXISTS`) | job `stack` xanh |
| 12 | F2: ngân hàng chậm 5 s, lỗi 30%; đo lệnh trùng, tỷ lệ lỗi, thời gian breaker mở, số lệnh đối soát | bảng số liệu |

## Phối hợp

| Bạn cung cấp | Cho | | Bạn cần | Từ |
| --- | --- | --- | --- | --- |
| `POST /evaluations` | TV4 | | gói dữ kiện của mốc, khoá mốc | TV4 |
| `payment.settled`, `decision.made` | TV4, TV6 | | phong bì sự kiện, hàng đợi | TV6 |

## Tự kiểm riêng

- Gửi lại cùng `Idempotency-Key` → trả lệnh cũ (200), không tạo lệnh mới; lệnh thứ hai cho cùng mốc → 409.
- Quyết định HOLD → không lập được lệnh (409 `DECISION_NOT_PAYABLE`).
- Ngân hàng không trả lời → `PENDING`; trả lời sau → đối soát đúng một lần.
- Công thức phạt: trễ đúng ân hạn, trễ hơn ân hạn 1 ngày, vượt trần; làm tròn đúng D4.

## Báo cáo và vấn đáp

MS 2.5 (L6), MS 3 (decision, payment), MS 4.2 (S4), MS 4.4 (circuit breaker), MS 5.4 (F2), MS 6.3 (độ
đúng của engine); LT d (`<DecisionTrace>`). Câu hỏi: luật first-match; công thức phạt, làm tròn;
`Idempotency-Key`; thay engine thì làm sao không đổi kết quả (chạy bóng).

## Khi chậm

Cắt: kiểm chứng bộ luật trên giao diện (giữ bộ kiểm trong CI) → circuit breaker (giữ timeout + PENDING).
Không cắt `Idempotency-Key`, S4, BR-B10.
