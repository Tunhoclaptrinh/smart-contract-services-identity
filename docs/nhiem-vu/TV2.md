# TV2: contract (soạn và rà soát hợp đồng)

| | |
| --- | --- |
| Repo | `smart-contract-services-contract` → thư mục `btl-backend-contract`, cổng 3002, database `contract` |
| Màn web | `btl-frontend/src/features/contracts` (danh sách, soạn hợp đồng, số hoá mốc, rà soát, bình luận) |
| Quy tắc bạn giữ | BR-A01…A08 (`PHAN_TICH_THIET_KE.md` §4) |
| Duyệt chéo | TV3 |

**Mục tiêu**: bên mua soạn hợp đồng từ mẫu, khai mốc và điều kiện; hai bên rà soát, xác nhận; hợp đồng
đã chốt sẵn sàng để ký.

## Đọc trước (30 phút)

`../NHIEM_VU.md`; `../PHAN_TICH_THIET_KE.md` §3, §4 (BR-A), §5.1 (máy trạng thái), §6 (API contract);
`../TAN_DUNG_CODECASH.md` §4.1; `../../codecash/docs/11_HOP_DONG_TRONG_UNG_DUNG.md` bước 1–6.

## Việc theo thứ tự

| # | Việc | Xong khi |
| --- | --- | --- |
| 1 | Bước 1 của `NHIEM_VU.md` §4 | `pnpm test` xanh, web đăng nhập được |
| 2 | `openapi.yaml`, `SERVICE.md` (dữ liệu, endpoint, nguồn mã cũ) | PR được TV3 duyệt (khoá/kích hoạt), TV4 duyệt phần gói hợp đồng |
| 3 | Viết gói hợp đồng v1 cùng TV3 (trường, phiên bản `SCW_CONTRACT_PACKAGE_V1`, tiền bằng đồng) vào `packages/contracts` qua nhóm trưởng | TV4 đồng ý |
| 4 | Chuyển mẫu hợp đồng (`domain/templates.ts`, `contract-templates.ts`): `GET /templates` | test đúng + lỗi |
| 5 | Chuyển `domain/drafts.ts`, tách `drafts`, `milestones`, `transitions`; `POST /contracts`, `GET /contracts`, `PATCH /contracts/{id}` | BR-A01, A02 có test |
| 6 | `PUT /contracts/{id}/milestones`, `PUT /contracts/{id}/members` | BR-A03…A07 có test vi phạm |
| 7 | `POST /contracts/{id}/transitions` (gửi rà soát, đề nghị sửa, xác nhận, huỷ, khoá, kích hoạt), bình luận | BR-A08; TV3 gọi được khoá/kích hoạt |
| 8 | Hồ sơ pháp lý theo loại hợp đồng (trần phạt 8% thương mại), lãi chậm trả | 422 `PENALTY_CAP_EXCEEDS_LEGAL_LIMIT` |
| 9 | Phát `contract.review_requested`, `contract.agreed` qua outbox | audit nhận được |
| 10 | Màn web: danh sách, soạn (Compound `<MilestoneBuilder>`, `usePersistentDraft<T>`), số hoá mốc, rà soát | ≥ 5 test mỗi màn, chạy trên MSW rồi trên service thật |
| 11 | Nối vào compose, gateway, ≥ 5 request Postman (có ca 422 trần phạt) | job `stack` xanh |

## Phối hợp

| Bạn cung cấp | Cho | | Bạn cần | Từ |
| --- | --- | --- | --- | --- |
| khoá `AGREED → SIGNING`, kích hoạt `SIGNING → ACTIVE` | TV3 | | phong bì sự kiện | TV6 |
| gói hợp đồng (phần điều khoản, mốc, thành viên) | TV3 → TV4 | | tổ chức, người dùng (đọc qua token, không gọi identity) | TV1 |

## Tự kiểm riêng

- Bảng chuyển trạng thái: thử mọi cặp (trạng thái, hành động) sai → 409 `INVALID_TRANSITION`.
- Tổng % mốc 99,99 và 100,01 → 422; tiền thập phân không dùng số thực.
- Bên đối tác chưa được gửi rà soát → 404 (BR-A01).
- Sửa điều khoản sau khi một bên xác nhận → xác nhận bị huỷ (BR-A08).

## Báo cáo và vấn đáp

MS 1.5 (gom bảng quy tắc của cả nhóm), MS 1.1, MS 1.4, MS 1.6, MS 3 (contract); LT a, LT d (Compound
component). Câu hỏi tự chuẩn bị: bảng chuyển dùng chung web–service; vì sao trần phạt theo loại hợp đồng;
khoá điều khoản khi hai bên xác nhận; vì sao contract và execution là hai service (`LUAN_CU_KIEN_TRUC.md` §2.5).

## Khi chậm

Cắt theo thứ tự: trích xuất tự động → mã hợp đồng tự sinh → bình luận (giữ xác nhận). Không cắt BR-A02…A05.
