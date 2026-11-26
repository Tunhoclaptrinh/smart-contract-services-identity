# Changelog — identity

Thay đổi của service này; mới nhất ở trên. `CHANGELOG.md` ở gốc repo là của phần nền (kéo từ repo
cha), không ghi vào đó để khỏi xung đột khi đồng bộ.

- **feat(identity): complete sign-in: DTOs, refresh tokens, passwords, invitations, lockout** — DTO cho mọi body `/auth/*`; access token RS256 15 phút + refresh token xoay vòng (cookie `sc_refresh` HttpOnly hoặc body), dùng lại token đã dùng thì thu hồi cả họ; `POST /auth/password`, `forgot-password` (luôn 202), `reset-password` (mã 30 phút); lời mời `POST /auth/invitations`, xem và nhận lời mời; hộp thư đi `mail-outbox` (`GET /auth/outbox` khi demo); khoá tài khoản sau 5 lần sai trong 15 phút; giới hạn theo IP (`AUTH_RATE_LIMIT`, mặc định 10/phút); chính sách mật khẩu NIST; `openapi.yaml` viết lại đủ 18 endpoint; test `auth-flows`, `http`
- **feat(identity): move sign-in, sign-up and accounts into the identity service** — `service/src/auth.ts` (đăng nhập, đăng ký công ty + `ORG_ADMIN`, tài khoản demo, đổi mật khẩu, đăng xuất, `me`), danh bạ seed; token ký bằng `signActorToken` của chassis, `AuthGuard` kiểm thêm tài khoản và `tokenVersion`; cổng 3001; 19 test trong `service/test`; `service/SERVICE.md`, `service/openapi.yaml`
