# TV1: nhóm trưởng, identity, gateway, phần nền

| | |
| --- | --- |
| Repo | `smart-contract-services` (repo cha: chassis, gateway, `compose.yaml`, Postman, CI), `smart-contract-services-identity`; phần nền của web |
| Màn web | đăng nhập, đăng ký, quên/đặt lại/đổi mật khẩu, mời thành viên, quản trị (`platform`) |
| Quy tắc bạn giữ | BR-I01, I02 |
| Đã xong | chassis, identity (18 endpoint, 34 test), gateway, compose, Postman 25 request, CI job `stack`, xác thực trên web |
| Duyệt chéo | TV6 |

**Mục tiêu**: giữ phần nền chạy, gỡ vướng cho mọi người trong ngày, nối từng service vào hệ chung, giữ
lịch và phạm vi.

## Việc theo thứ tự

| # | Việc | Xong khi |
| --- | --- | --- |
| 1 | Ngày 0 (`TRIEN_KHAI_NHOM.md` §2): thêm quyền repo, tạo 5 repo NestJS + repo Python, điền "Thông tin" `SERVICE.md`, đổi thương hiệu web | mọi người clone và `pnpm test` xanh |
| 2 | Họp khởi động (`TRIEN_KHAI_NHOM.md` §3) | mọi người biết việc 3 ngày đầu |
| 3 | Gói hợp đồng v1 và phong bì sự kiện vào `packages/contracts` (nhận từ TV2, TV3, TV6) | |
| 4 | Outbox relay trong chassis, RabbitMQ trong compose (cùng TV6) | |
| 5 | CI repo cha: thêm checkout repo service mới cho job `stack` khi service vào compose | |
| 6 | Màn quản trị `platform` hoàn thiện | ≥ 5 test |
| 7 | Hằng ngày: họp 9:00, duyệt PR phần nền trong ngày, đồng bộ phần nền sang mọi repo | |
| 8 | 04/12 ngày tích hợp: dẫn chạy luồng demo | luồng chạy hết |
| 9 | Báo cáo: chương 2, 5.1–5.2, 6.1, 7; LT b, c, g, h; ghép hai báo cáo | |

## Can thiệp và hỗ trợ

- Vào mọi repo bất kỳ lúc nào: ngồi cặp, sửa trên nhánh của thành viên (báo trước), nhận bớt việc (ghi
  bảng theo dõi). Code trong service của người khác vẫn qua PR, chủ service duyệt.
- Đổi phạm vi, cắt tính năng theo `TRIEN_KHAI_NHOM.md` §8, ghi `DINH_VI_SAN_PHAM.md` §7.
- Dấu hiệu cần vào ngay: không có PR sau 2 ngày; CI đỏ quá nửa ngày; hai service hiểu hợp đồng API khác nhau.

## Báo cáo và vấn đáp

Câu hỏi: refresh xoay vòng và phát hiện dùng lại; gateway kiểm JWKS khi đổi khoá; vì sao tách 6 service
(`LUAN_CU_KIEN_TRUC.md` §2); outbox gắn với chuỗi băm.
