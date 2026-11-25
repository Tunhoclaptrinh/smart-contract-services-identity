# Changelog — identity

Thay đổi của service này; mới nhất ở trên. `CHANGELOG.md` ở gốc repo là của phần nền (kéo từ repo
cha), không ghi vào đó để khỏi xung đột khi đồng bộ.

- **feat(identity): move sign-in, sign-up and accounts into the identity service** — `service/src/auth.ts` (đăng nhập, đăng ký công ty + `ORG_ADMIN`, tài khoản demo, đổi mật khẩu, đăng xuất, `me`), danh bạ seed; token ký bằng `signActorToken` của chassis, `AuthGuard` kiểm thêm tài khoản và `tokenVersion`; cổng 3001; 19 test trong `service/test`; `service/SERVICE.md`, `service/openapi.yaml`
