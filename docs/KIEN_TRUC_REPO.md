# Kiến trúc repo: repo cha và repo service

## Ở máy: các repo nằm cùng cấp

```
CodeCash/
├── btl-backend/              repo cha     → github.com/Tunhoclaptrinh/smart-contract-services
├── btl-backend-identity/     repo service → smart-contract-services-identity
├── btl-backend-contract/     repo service → smart-contract-services-contract   (tạo khi bắt đầu)
└── btl-frontend/             web          → smart-contract-web
```

Thư mục repo service: `btl-backend-<tên>`; repo trên GitHub: `smart-contract-services-<tên>`.

## Ba loại repo

| Repo | Chứa | Ai sửa |
| --- | --- | --- |
| **`smart-contract-services`** (repo cha) | Nhánh `base`: chassis `packages/nest-common`, `packages/contracts` (`resources.json`, `permissions.json`), khuôn `service/`, cấu hình chung (TypeScript, ESLint, Prettier, CI, Dockerfile). Nhánh `main`: `base` + gateway, `compose.yaml`, Postman, script kéo các repo service | Trưởng nhóm (nền), TV1 (gateway, compose) |
| **`smart-contract-services-<tên>`** (repo service) | Bản sao nhánh `base` của repo cha + mã của service trong `service/` | Chủ service đó |
| `smart-contract-services-decision` | Python FastAPI quanh `codecash_engine`; không dùng chassis Node, không có `upstream`. Vẫn giữ `CLAUDE.md` (chép từ repo cha, sửa phần lệnh) và `SERVICE.md` | TV5 |

Mỗi repo service tự build, tự test, có CI và image riêng: đúng "mỗi service có mã và dữ liệu riêng" của đề. Dữ liệu riêng: mỗi service một schema PostgreSQL (`PG_SCHEMA=<tên>`), không đọc bảng của service khác.

## Repo service lấy phần nền mới thế nào

Repo service có hai remote: `origin` (chính nó) và `upstream` (repo cha).

```
repo cha:     base  (trưởng nhóm push thẳng; thành viên: core/<việc> ──PR──▶ base)
                                   │
repo service:  git fetch upstream && git merge upstream/base   (ngay trên main)
                                   │
                                   └── pnpm test xanh ──▶ git push origin main
```

```bash
git switch main && git pull
git fetch upstream && git merge --no-ff upstream/base   # chỉ đổi packages/, cấu hình; service/ không bị đụng
pnpm install && pnpm test && pnpm check:base
git push origin main                                    # trưởng nhóm; thành viên thì đẩy nhánh sync/base-<ngày> và mở PR
```

Quy tắc giữ cho việc merge không xung đột:

- **Không sửa `packages/nest-common` và các tệp nền khác trong repo service.** Thiếu gì ở chassis thì sửa ở repo cha (`core/<việc>` → `base`), rồi kéo về.
- **Sửa trong `service/`** (mã, test, `openapi.yaml`, `SERVICE.md`, `CHANGELOG.md` của service; `CHANGELOG.md` gốc là của phần nền, ghi vào sẽ xung đột mỗi lần đồng bộ), và trong `packages/contracts/*.json` **chỉ** mục của resource service đó sở hữu (đây là dữ liệu khai báo, không phải mã; nếu phần nền cũng đổi tệp này thì xung đột nhỏ, sửa tay khi merge).
- CI kiểm hai quy tắc trên bằng `scripts/check-base-untouched.mjs`: so nhánh với điểm chung gần nhất của nó và `base` của repo cha, nên kéo phần nền mới về không bao giờ làm nó báo lỗi. Danh sách đường dẫn được sửa nằm trong script và ở mục 4 của `CLAUDE.md`.
- Khuôn `service/` của repo cha thay đổi thì repo service **không** tự nhận (đã thay bằng mã riêng); khuôn chỉ dùng khi tạo service mới. Vì vậy khuôn giữ thật mỏng, mọi thứ dùng chung nằm trong `nest-common`.

## Tạo một repo service mới

```bash
# trong repo cha, nhánh base đã cập nhật
scripts/new-service.sh <tên>          # tạo ../btl-backend-<tên>, ví dụ: scripts/new-service.sh contract
```

Script chép lịch sử nhánh `base` sang repo mới, đặt `upstream` trỏ về repo cha, đổi tên gói, tên service trong `main.ts` và `SERVICE.md`. Chủ service điền tiếp `service/SERVICE.md` (dữ liệu, endpoint, nguồn CodeCash; cổng theo `docs/DOI_CHIEU_CODECASH.md`). Sau đó tạo repo trên GitHub (`gh repo create Tunhoclaptrinh/smart-contract-services-<tên> --public`), `git remote add origin …`, push `main`, bật bảo vệ nhánh bằng `scripts/protect-branches.sh Tunhoclaptrinh/smart-contract-services-<tên>` (repo service chỉ có `main`, script bỏ qua `base`).

## Chạy cả hệ thống ở máy

Repo cha (nhánh `main`) có `scripts/clone-services.sh` kéo các repo service về các thư mục cùng cấp `../btl-backend-<tên>` (thiếu cái nào thì clone, có rồi thì `git pull`), rồi `docker compose up --build --wait` build từng service từ thư mục đó.

## Vì sao chọn cách này (để viết vào báo cáo)

- Microservice Chassis (microservices.io): hạ tầng chung một chỗ, service chỉ viết nghiệp vụ.
- Repo riêng cho từng service: quyền sở hữu, lịch sử và CI tách bạch theo người phụ trách.
- Đổi lại: phần nền có trong mọi repo service và phải kéo về khi đổi. Giảm bằng quy tắc "không sửa `packages/` trong repo service"; khi lên môi trường thật, chassis đăng lên registry riêng theo phiên bản thay vì chép.
