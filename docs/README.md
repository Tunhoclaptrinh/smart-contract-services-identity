# Bộ tài liệu của nhóm

Mọi tài liệu chung nằm ở đây (nhánh `base`, có trong mọi repo service). Đọc theo thứ tự của vai trò
mình; mỗi tệp tự nói tệp nào đọc tiếp.

## Bắt đầu từ đây

1. **`NHIEM_VU.md`** (10 phút): làm gì, ai làm gì, ai cần gì của ai, làm theo thứ tự nào, tự kiểm ra sao.
2. **Thẻ nhiệm vụ của bạn** `nhiem-vu/TV<số>.md`: việc theo thứ tự có tiêu chí xong, phối hợp, quy tắc
   bạn giữ, tự kiểm, phần báo cáo.
3. Các tệp dưới đây khi thẻ nhiệm vụ trỏ tới.

| Bạn cần | Đọc thêm |
| --- | --- |
| Chuyển mã cũ | `TAN_DUNG_CODECASH.md` (mục service của bạn) → `DOI_CHIEU_CODECASH.md` → `CLAUDE.md` §5 |
| Viết báo cáo, slide, bảo vệ | `BAO_CAO_VA_BAO_VE.md` → `LUAN_CU_KIEN_TRUC.md` → `PHAN_TICH_THIET_KE.md` |
| Điều phối (nhóm trưởng) | `TRIEN_KHAI_NHOM.md` → `DINH_VI_SAN_PHAM.md` §7 → `KICH_BAN_VIBE_CODE.md` §4 |
| Dùng AI (Claude Code, Cursor…) | `CLAUDE.md` của repo (bảng "Cần biết gì thì đọc đâu") |

## Các tệp

| Tệp | Trả lời câu hỏi | Ai giữ |
| --- | --- | --- |
| `NHIEM_VU.md` | Bản nhiệm vụ ngắn của cả nhóm | nhóm trưởng |
| `nhiem-vu/TV1.md` … `TV6.md` | Việc chi tiết của từng người | từng người (nhóm trưởng sửa khi đổi phân công) |
| `DINH_VI_SAN_PHAM.md` | BTL làm sản phẩm gì, khác bài dự thi ở đâu, sửa gì cho sát thực tế, nhật ký quyết định | trưởng nhóm |
| `HE_THONG.md` | Toàn cảnh: service, cổng, database, token, luồng chính, chạy cả hệ | TV1 |
| `PHAN_TICH_THIET_KE.md` | Phạm vi, vai trò, 27 quy tắc, API từng service, saga, thí nghiệm, ma trận yêu cầu hai môn | chủ từng service sửa mục của mình |
| `LUAN_CU_KIEN_TRUC.md` | Vì sao kiến trúc, công nghệ, hàng đợi, CI; luồng L1–L8 đồng bộ hay bất đồng bộ | TV1, TV6 |
| `TAN_DUNG_CODECASH.md` | Từng phần mã cũ: giữ, chỉnh, mới, bỏ; sửa chung C1–C12 | chủ từng service |
| `DOI_CHIEU_CODECASH.md` | Tệp cũ nào sang service nào (backend); web: `btl-frontend/docs/DOI_CHIEU_CODECASH.md` | chủ từng service |
| `BAO_CAO_VA_BAO_VE.md` | Tài liệu, ảnh, sơ đồ cũ dùng vào đâu; dàn ý hai báo cáo; slide; demo; câu hỏi vấn đáp | cả nhóm |
| `KICH_BAN_VIBE_CODE.md` | Ai làm gì, lịch, "xong là thế nào", prompt mẫu, bẫy khi dùng AI | trưởng nhóm |
| `TRIEN_KHAI_NHOM.md` | Ngày 0, ba ngày đầu từng người, checklist chuyển mô-đun, nhịp làm việc, cắt gì khi trễ | trưởng nhóm |
| `KIEN_TRUC_REPO.md`, `QUY_TRINH_NHANH.md` | Mỗi service một repo, kéo phần nền, quy trình nhánh | TV1 |
| `PHAN_TICH.md` | Phân tích phần nền lúc mới dựng (lịch sử) | — |
| `../packages/nest-common/MODULES.md` | Chassis có gì, CRUD chung, định dạng lỗi | TV1 |

Tài liệu tham khảo ngoài repo (thư mục `docs/` của thư mục làm việc chung, chỉ trưởng nhóm có): đề
bài, phân tích yêu cầu hai môn, phân tích pháp lý, mẫu văn bản. Nội dung cần cho cả nhóm đã được chép
vào các tệp trên.
