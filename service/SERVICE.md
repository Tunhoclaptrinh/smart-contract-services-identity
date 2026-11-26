# Service `identity`

Thẻ của service: AI và người đọc tệp này trước khi sửa mã. Chủ service cập nhật nó trong mỗi PR
làm đổi phạm vi (luật ở mục 4 của `CLAUDE.md`, CI `pnpm check:docs`). Đây là **service mẫu**: các service khác chép cách tổ chức của nó.

## Thông tin

| | |
| --- | --- |
| Chủ | TV1 — Nguyễn Tiến Tuấn |
| Cổng mặc định | 3001 (`bootstrapService({ port: 3001 })`; `API_PORT`/`PORT` ghi đè) |
| Schema PostgreSQL | `PG_SCHEMA=identity` |
| Gọi qua gateway | `/api/v1/auth/*`, `/api/v1/resources/{organizations,users,settings}` |

## Sơ đồ mã

| Tệp | Làm gì |
| --- | --- |
| `main.ts` | Module gốc: `AuthController`, `JwksController`, `BaseController` (CRUD `/resources`), `PermissionsController`, `AuditExportController`, `HealthController`; `ThrottlerModule`; guard toàn cục theo thứ tự `ClientThrottlerGuard` → `AuthGuard` → `RolesGuard`; `bootstrapService({ port: 3001 })`, seed trước khi nghe |
| `auth.ts` | `AuthService`: phiên (`login` có khoá tài khoản, `refresh` xoay vòng, `logout`), mật khẩu (`changePassword`, `forgotPassword`, `resetPasswordWithToken`, `resetPassword` của quản trị), lời mời (`invite`, `invitation`, `acceptInvitation`), `outbox` (demo), `register`, `demoAccounts`/`demoLogin`, `authenticate`, `seed`; `AuthGuard`; `JwksController`; `AuthController` (route `/auth/*`, đặt cookie `sc_refresh`) |
| `dto.ts` | DTO `class-validator` của mọi body `/auth/*` (lớp kiểm 1: hình dạng) |
| `credentials.ts` | Chính sách mật khẩu (`passwordProblem`), sinh và băm bí mật, hàng refresh token và mã một lần, hộp thư đi (`sendMail`), `webLink` |
| `throttle.ts` | `ClientThrottlerGuard`: giới hạn theo địa chỉ client (`x-forwarded-for` sau gateway), 429 `TOO_MANY_REQUESTS` |
| `seed-directory.ts` | Danh bạ seed: tổ chức `OPS`, các công ty và tài khoản mẫu (`buildDirectory`), tài khoản nổi bật cho màn đăng nhập demo |

## Sơ đồ luồng

Đăng nhập, gọi API, làm mới phiên:

```mermaid
sequenceDiagram
  participant W as Web (qua gateway)
  participant A as AuthController
  participant S as AuthService
  participant R as Repository (schema identity)
  W->>A: POST /auth/login { email, password }
  A->>S: login
  S->>R: user theo email; đang bị khoá? → 429 ACCOUNT_TEMPORARILY_LOCKED
  S->>S: bcrypt.compare (email lạ cũng so với một hash giả)
  alt sai
    S->>R: failedLogins + 1 (lần thứ 5 trong 15 phút: khoá 15 phút, ghi ACCOUNT_LOCKED)
    S-->>W: 401 INVALID_CREDENTIALS
  else đúng
    S->>R: xoá bộ đếm, ghi LOGIN, lưu hash refresh token (họ mới)
    S-->>W: accessToken (RS256, 15 phút) + refreshToken, Set-Cookie sc_refresh (HttpOnly)
  end
  W->>A: GET /auth/me + Bearer
  A->>S: AuthGuard → authenticate: chữ ký, tài khoản active, tokenVersion khớp
  Note over W,A: access token hết hạn
  W->>A: POST /auth/refresh (cookie hoặc body)
  A->>S: refresh
  alt token chưa dùng, còn hạn, tokenVersion khớp
    S->>R: đánh dấu đã dùng, thêm token mới cùng họ
    S-->>W: cặp token mới
  else token đã dùng rồi (bị chép)
    S->>R: thu hồi cả họ, ghi REFRESH_TOKEN_REUSED
    S-->>W: 401 REFRESH_TOKEN_REUSED
  end
```

Quên mật khẩu và mời thành viên (mã một lần, chỉ lưu hash):

```mermaid
sequenceDiagram
  participant U as Người dùng
  participant Q as Quản trị (ORG_ADMIN / SYSTEM_ADMIN)
  participant S as identity
  participant M as mail-outbox
  U->>S: POST /auth/forgot-password { email }
  S-->>U: 202 (như nhau dù email có hay không)
  S->>M: mã 30 phút (mã cũ hết hiệu lực)
  U->>S: POST /auth/reset-password { token, newPassword }
  S-->>U: 200; mọi phiên cũ kết thúc
  Q->>S: POST /auth/invitations { email, displayName, role }
  S->>S: orgAdminRefusal (đúng công ty, vai trò được cấp)
  S->>M: mã 7 ngày; tài khoản INVITED, chưa hoạt động
  U->>S: GET /auth/invitations/:token (xem lời mời)
  U->>S: POST /auth/invitations/accept { token, password }
  S-->>U: phiên đăng nhập; tài khoản ACTIVE
```

## Dữ liệu sở hữu

| Collection | Ý nghĩa | Khai báo trong `packages/contracts/resources.json`? |
| --- | --- | --- |
| organizations | Công ty (bên mua, nhà cung cấp) và đơn vị vận hành `OPS` | Có (mục nền) |
| users | Tài khoản, vai trò, `status` (`INVITED`/`ACTIVE`), `tokenVersion`, bộ đếm đăng nhập sai, `lockedUntil` | Có (mục nền) |
| settings | Cấu hình hệ thống | Có (mục nền) |
| refresh-tokens | Hash refresh token, họ (`familyId`), hạn, đã dùng, đã thu hồi | Không: không lộ qua `/resources` |
| one-time-tokens | Hash mã đặt lại mật khẩu và mã mời, mục đích, hạn, đã dùng | Không |
| mail-outbox | Thư chờ gửi (200 thư gần nhất); demo xem qua `GET /auth/outbox` | Không |

## Endpoint

Chi tiết ở `service/openapi.yaml`. Body kiểm bằng DTO (`dto.ts`); lỗi theo trường nằm trong `errors[]`.

| Phương thức, đường dẫn | Quyền | Lỗi nghiệp vụ |
| --- | --- | --- |
| `POST /auth/login` | công khai, giới hạn theo IP | 401 `INVALID_CREDENTIALS`; 429 `ACCOUNT_TEMPORARILY_LOCKED`, `TOO_MANY_REQUESTS` |
| `POST /auth/register` | công khai (tắt bằng `SIGNUP=false`), giới hạn | 400 lỗi trường, `PASSWORD_TOO_COMMON`, `PASSWORD_CONTAINS_EMAIL`; 409 `EMAIL_TAKEN`, `ORGANIZATION_CODE_TAKEN`; 404 `SIGNUP_DISABLED` |
| `POST /auth/refresh` | công khai (refresh token trong cookie hoặc body) | 401 `INVALID_REFRESH_TOKEN`, `REFRESH_TOKEN_REUSED` |
| `POST /auth/logout` | đã đăng nhập | — (thu hồi mọi access và refresh token) |
| `GET /auth/me` | đã đăng nhập | 401 `AUTHENTICATION_REQUIRED`, `INVALID_SESSION` |
| `POST /auth/password` | đã đăng nhập | 400 `CURRENT_PASSWORD_INCORRECT`, `PASSWORD_UNCHANGED`, chính sách mật khẩu |
| `POST /auth/forgot-password` | công khai, giới hạn | — (luôn 202) |
| `POST /auth/reset-password` | công khai, giới hạn | 400 `INVALID_OR_EXPIRED_TOKEN`, chính sách mật khẩu |
| `POST /auth/invitations` | `users:create` (ORG_ADMIN, SYSTEM_ADMIN) | 403 `ROLE_NOT_ASSIGNABLE`, `OTHER_ORGANIZATION`, `PERMISSION_DENIED`; 404 `ORGANIZATION_NOT_FOUND`; 409 `EMAIL_TAKEN` |
| `GET /auth/invitations/:token` | công khai | 404 `INVITATION_NOT_FOUND` |
| `POST /auth/invitations/accept` | công khai | 404 `INVITATION_NOT_FOUND`; 400 chính sách mật khẩu |
| `GET /auth/outbox` | công khai, chỉ khi bật demo | 404 `OUTBOX_DISABLED` |
| `GET /auth/demo-accounts`, `POST /auth/demo-login` | công khai, chỉ khi bật demo | 404 `DEMO_LOGIN_DISABLED` |
| `GET /.well-known/jwks.json` | công khai | — (khoá công khai RS256 cho gateway và service khác) |
| `POST /auth/users/:id/password` | `users:reset-password` | 404 `USER_NOT_FOUND`; 403 khi `ORG_ADMIN` đụng tài khoản không được quản |
| `POST /auth/reset-demo` | `demo:reset` | 404 `DEMO_LOGIN_DISABLED` |
| CRUD `/resources/{organizations,users,settings}` | theo `permissions.json` | lỗi của chassis (`MODULES.md`) |

## Token

- **Access token** RS256, 15 phút (`TOKEN_TTL`): identity ký bằng `JWT_PRIVATE_KEY` (dev tự sinh),
  công bố khoá công khai ở `/.well-known/jwks.json`; gateway và service khác kiểm bằng
  `JwtAuthGuard` (khoá từ `JWKS_URL`), không gọi identity. Riêng identity (`AuthGuard`) kiểm thêm
  tài khoản còn hoạt động và `tokenVersion`.
- **Refresh token** 14 ngày (`REFRESH_TTL_DAYS`), dùng một lần, xoay vòng; chỉ lưu SHA-256. Web nhận
  qua cookie `sc_refresh` (HttpOnly, SameSite=Strict, Path=/api/v1/auth, Secure ở production), Postman
  qua trường `refreshToken`.
- Đổi hoặc đặt lại mật khẩu, đăng xuất: `tokenVersion + 1` và thu hồi mọi refresh token, nên mọi
  phiên kết thúc ở identity ngay; ở service khác access token cũ chạy tới khi hết 15 phút.

## Sự kiện

| Phát | Nhận |
| --- | --- |
| (sau) `user.disabled` để service khác chặn sớm | — |

## Nguồn CodeCash

| Tệp cũ | Sang | Trạng thái |
| --- | --- | --- |
| `apps/api/src/auth.ts` | `service/src/auth.ts` | Xong; token RS256 (`signActorToken`/`verifyActorToken`) |
| Danh bạ seed (`OPS`, Nova An B010, Phú Minh S015) | `service/src/seed-directory.ts` | Xong |
| `tests/foundation/resource.test.mjs` | `service/test/resource.test.mjs` | Xong |
| Đăng ký công ty (bản BTL) | `service/test/auth.test.mjs` | Xong |

## Test

| Tệp | Kiểm gì |
| --- | --- |
| `test/auth.test.mjs` | Đăng ký, đăng nhập, demo, SoD khi đặt lại mật khẩu |
| `test/resource.test.mjs` | CRUD chung trên dữ liệu của identity |
| `test/auth-flows.test.mjs` | Chính sách mật khẩu, refresh xoay vòng và phát hiện dùng lại, đăng xuất, khoá tài khoản, đổi và đặt lại mật khẩu, lời mời |
| `test/http.test.mjs` | Chạy service thật: DTO 400 kèm `errors[]`, cookie refresh, 401/403/404, JWKS, 202 quên mật khẩu, 429 theo IP |

## Rà soát nghiệp vụ

- SoD-1 giữ nguyên: tự đăng ký chỉ tạo được công ty mới + `ORG_ADMIN`; `ORG_ADMIN` không tạo, không
  mời, không đổi mật khẩu tài khoản kiểm soát viên hay vai trò nền tảng (`orgAdminRefusal`); lời mời
  của `ORG_ADMIN` luôn vào công ty của chính nó (bỏ qua `organizationId` gửi lên).

## Cải tiến so với CodeCash

- Token mang người gọi trong claims, ký RS256: service khác xác thực không cần gọi identity và không
  giữ bí mật ký (bản cũ là một khối, tra người dùng trong cùng cơ sở dữ liệu).
- Access token ngắn + refresh token xoay vòng có phát hiện dùng lại (OAuth 2.0 Security BCP).
- Chống dò mật khẩu: khoá tài khoản sau 5 lần sai, giới hạn số request theo IP, so hash giả với email
  lạ để không lộ email nào tồn tại; quên mật khẩu luôn trả 202.
- Chính sách mật khẩu theo NIST SP 800-63B (độ dài, danh sách mật khẩu phổ biến, không chứa email).
- Mời thành viên thay cho việc quản trị đặt sẵn mật khẩu: người dùng tự chọn mật khẩu, quản trị không
  biết mật khẩu của ai.
- DTO cho mọi body, lỗi RFC 9457 có `errors[]` theo trường.
