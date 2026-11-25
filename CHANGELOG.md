# Changelog

Mỗi bước dựng phần nền ghi một mục; mới nhất ở trên.

- **test: sign the smoke token for the seeded administrator** — identity kiểm cả tài khoản có tồn tại, nên token của smoke dùng `u-sysadmin` (tài khoản seed); service khác chỉ đọc claims
- **feat(nest-common): verify identity tokens in every service** — `JwtAuthGuard`, `signActorToken`, `verifyActorToken`; một `JWT_SECRET` cho mọi service, dev dùng bí mật chung cố định; khuôn service dùng guard này; smoke kiểm token đúng được nhận, token giả bị từ chối
- **ci: refuse base changes outside the base flow** — `scripts/check-base-untouched.mjs` (`pnpm check:base`), `.github/CODEOWNERS`, `protect-branches.sh` bỏ qua nhánh repo không có và yêu cầu code owner duyệt
- **docs: AI guide, CodeCash map, work script** — `CLAUDE.md` + `AGENTS.md`, `service/SERVICE.md` (thẻ service), `docs/DOI_CHIEU_CODECASH.md`, `docs/KICH_BAN_VIBE_CODE.md`; sửa bảng phần nền cũ trong `QUY_TRINH_NHANH.md`
- **test: run each service's own tests** — `pnpm test` chạy thêm `test` của `service/` nếu có; smoke chấp nhận mọi tên service
- **refactor: turn the API into the chassis and a service template** — `services/api/src/common` thành gói `packages/nest-common` (giữ lịch sử từng tệp), thêm `bootstrapService()`, `HealthController`; `service/` là khuôn service mỏng; phần riêng của identity (đăng nhập, đăng ký, tài khoản seed, test CRUD) chuyển sang repo `smart-contract-services-identity`; `docs/KIEN_TRUC_REPO.md`, `scripts/new-service.sh`; `repoRoot` dò thư mục có `packages/contracts`
- **docs: let the repository admin merge when CI is green** — bảo vệ nhánh không áp dụng cho admin, để trưởng nhóm merge việc nền khi chưa có người duyệt; thành viên vẫn cần 1 người duyệt và CI xanh
- **docs: name base task branches core/<task>; allow running CI by hand** — Git không cho có cùng lúc nhánh `base` và `base/<việc>`, nên nhánh việc của phần nền đổi thành `core/<việc>`; CI thêm `workflow_dispatch`
- **docs: keep the base on its own branch** — nhánh `base` chỉ chứa phần nền, `main` chứa nền cộng nghiệp vụ; quy trình sửa nền rồi đồng bộ sang `main`, quy trình làm nghiệp vụ, quy tắc bảo vệ nhánh (`docs/QUY_TRINH_NHANH.md`); script bật bảo vệ nhánh trên GitHub (`scripts/protect-branches.sh`)
- **build: add the API image and CI** — `services/api/Dockerfile` (một image cho mỗi service, build từ gốc repo), CI chạy typecheck, lint, format, test (có PostgreSQL), khởi động API, rồi build và chạy image trên PostgreSQL
- **feat(auth): let a company sign up with its account administrator** — `POST /auth/register`: công ty mới (bên mua hoặc nhà cung cấp) kèm tài khoản quản trị công ty, kiểm trường theo `resources.json`, email và mã không trùng, mật khẩu ≥ 12 ký tự, ghi nhật ký `REGISTER`; tắt bằng `SIGNUP=false`
- **test: add the resource CRUD and PostgreSQL storage tests** — 14 test CRUD (phạm vi tổ chức, lọc, khoá phiên bản, nhập/xuất, quyền, quản trị công ty); test PostgreSQL chạy khi có `DATABASE_URL`
- **feat: add the request pipeline and wire the API module** — lỗi thống nhất (ghi cả lần bị từ chối), bọc phản hồi, log, ghi nhật ký lần đọc, xuất nhật ký, Swagger tại `/api/docs`
- **feat(auth): add sign-in, sessions, seed accounts and the permission API** — đăng nhập JWT, phiên vô hiệu khi đổi mật khẩu hoặc khoá, đăng nhập demo, khôi phục demo, tài khoản seed, `GET /permissions`
- **feat(crud): add the generic resource CRUD** — danh sách có lọc, tìm kiếm, sắp xếp, phân trang; tạo/sửa/xoá có khoá phiên bản và phạm vi tổ chức; nhập kiểm từng dòng, xuất CSV/JSON
- **feat(storage): add file, MongoDB and PostgreSQL storage with an audit hash chain** — mọi lần ghi là một giao dịch kèm mục nhật ký niêm phong chuỗi băm; PostgreSQL có trigger chặn sửa nhật ký; compose local cho MongoDB và PostgreSQL
- **feat: define resources, roles and the permission matrix** — `resources.json` (trường, kiểu, ràng buộc của từng tài nguyên), `permissions.json` (vai trò → quyền và phạm vi), quy tắc vai trò nội bộ và quản trị công ty
- **chore: add ESLint and Prettier** — luật lint và định dạng dùng chung (lấy từ CodeCash)
- **chore: scaffold the API service with NestJS and TypeScript** — NestJS 11, TypeScript `strict`, tiền tố `/api/v1`, `GET /health`
- **docs: plan the backend base** — phân tích phần nền, nguồn lấy từ CodeCash và thứ tự dựng (`docs/PHAN_TICH.md`)
