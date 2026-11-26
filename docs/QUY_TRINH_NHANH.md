# Quy trình nhánh: `base` và `main`

Áp dụng cho repo cha `btl-backend`; repo service chỉ có `main` và kéo phần nền từ repo cha
(`docs/KIEN_TRUC_REPO.md`). Ai cũng đọc trước khi tạo nhánh đầu tiên.

## Hai nhánh dài hạn

| Nhánh | Chứa gì | Ai sửa | Vào bằng |
| --- | --- | --- | --- |
| `base` | **Phần nền dùng chung**: chassis `packages/nest-common` (repository, chuỗi băm, CRUD chung, lỗi, interceptor, guard, kiểm token, khởi động), `packages/contracts/*.json` (mục nền), khuôn `service/`, `scripts/`, `infra/`, cấu hình (TypeScript, ESLint, Prettier, CI, Dockerfile), `CLAUDE.md`, tài liệu chung | Trưởng nhóm (TV1 phụ trách kỹ thuật nền) | PR từ `core/<việc>` |
| `main` | Phần nền **cộng** nghiệp vụ của cả nhóm (màn, service) | Mọi người, mỗi người phần của mình | PR từ `feat/<phần>-<việc>`, `fix/…` |

`main` luôn chứa `base`. `base` **không bao giờ** chứa nghiệp vụ, nên phần nền luôn tách sạch, dùng lại được, và lịch sử commit cho thấy rõ ai làm phần nền, ai làm nghiệp vụ.

```
core/<việc> ──PR──▶ base ──PR "sync: base → main"──▶ main ◀──PR── feat/<phần>-<việc>
```

## Sửa phần nền

Nhánh việc của phần nền tên `core/<việc>`, **không** đặt `base/<việc>`: Git coi tên nhánh như đường dẫn, nên đã có nhánh `base` thì không tạo được `base/…`.

**Trưởng nhóm (chủ phần nền, quản trị repo)** không cần PR:

1. `git switch base && git pull`, sửa (hoặc làm trên `core/<việc>` rồi `git merge` vào `base`).
2. Chạy đủ kiểm tra (`pnpm typecheck && pnpm lint && pnpm format:check && pnpm test`), commit theo Conventional Commits, `git push origin base`. CI chạy lại trên `base`; đỏ thì sửa ngay bằng commit mới.
3. Đồng bộ: `git switch main && git pull && git merge --no-ff base && pnpm test && git push origin main`; mỗi repo service làm như mục "Kéo phần nền về" của `docs/KIEN_TRUC_REPO.md`.

**Thành viên khác** đụng phần nền thì vẫn mở PR từ `core/<việc>` vào `base`, trưởng nhóm duyệt.

Ai đang có nhánh nghiệp vụ thì cập nhật: `git switch feat/… && git merge main`.

Phần nền thiếu thứ gì khi đang làm nghiệp vụ (một thành phần, một hook, một helper)? **Không sửa thẳng trên nhánh nghiệp vụ.** Báo trưởng nhóm hoặc tự làm theo các bước trên, rồi merge `main` vào nhánh của mình.

## Làm nghiệp vụ

1. Tạo nhánh từ `main`: `git switch main && git pull && git switch -c feat/<phần>-<việc>` (ví dụ `feat/contracts-list`, `feat/signing-service-s1`).
2. Chỉ sửa đường dẫn nghiệp vụ (bảng mục 4 của `CLAUDE.md`); dùng phần nền như thư viện. CI chạy
   `scripts/check-base-untouched.mjs` và từ chối PR sửa phần nền (tự kiểm: `pnpm check:base`).
3. PR vào `main`, một người duyệt, CI xanh, **merge commit** (giữ commit của từng người).

## Bảo vệ nhánh (GitHub)

`base` và `main` đều:

- chỉ nhận thay đổi qua Pull Request, cần ít nhất 1 người duyệt, và duyệt lại khi có commit mới;
- phải qua CI (job `verify`) và cập nhật với nhánh đích trước khi merge;
- tệp phần nền cần người trong `.github/CODEOWNERS` duyệt;
- cấm force push, cấm xoá nhánh.

Quy tắc trên áp cho thành viên. Quản trị repo (trưởng nhóm) không bị áp (`enforce_admins: false`), nên push thẳng `base` và đồng bộ `main` được (mục "Sửa phần nền"); việc nghiệp vụ của chính trưởng nhóm vẫn đi PR như mọi người. Push thẳng không bỏ qua kiểm tra: chạy đủ lệnh kiểm tra trước, CI trên nhánh phải xanh sau.

Bật bằng `scripts/protect-branches.sh <chủ-repo>/<tên-repo>` (cần GitHub CLI `gh` đã đăng nhập, quyền admin repo), chạy một lần sau khi repo có remote và đã push hai nhánh. Kiểm lại ở **Settings → Branches**.

## Nhanh

| Muốn | Lệnh |
| --- | --- |
| Bắt đầu việc nền | `git switch base && git pull && git switch -c core/<việc>` |
| Bắt đầu việc nghiệp vụ | `git switch main && git pull && git switch -c feat/<phần>-<việc>` |
| Lấy phần nền mới về nhánh đang làm | `git fetch && git merge origin/main` |
| Xem `main` đã có hết `base` chưa | `git log --oneline main..base` (rỗng là đủ) |

