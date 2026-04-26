# User Management Specs (Directus + Lumibase + Firebase Bridge)

## 1) Mục tiêu

- Xây dựng **tính năng quản lý user hoàn chỉnh** cho WordAI (desktop Tauri), ưu tiên chất lượng production.
- Dùng **Directus (qua bộ mã nguồn Lumibase)** để quản lý schema PostgreSQL/Supabase, API config, CMS data và permission policy.
- Kết hợp Firebase theo mô hình **bridge 2 hệ thống qua API** (identity/session từ Firebase, profile/permission/AI entitlement từ Directus).
- Đảm bảo mọi hành vi auth + authorization + quota + audit đều nhất quán, truy vết được, rollback an toàn.

---

## 2) Kiến trúc tổng thể

## 2.1 Thành phần

1. **Client app (React + Tauri)**
   - Login UI, session state, gọi IPC/API.
2. **Firebase Auth**
   - Cấp ID token, refresh token, xác thực danh tính.
3. **Lumibase + Directus**
   - Quản lý schema DB trên Supabase/Postgres.
   - Cấu hình collection/API/permission/audit workflow.
4. **Bridge API (Auth Sync Service)**
   - Verify Firebase token.
   - Upsert user vào Directus.
   - Trả entitlement + role + policy cho client.

## 2.2 Nguyên tắc phân tách trách nhiệm

- Firebase = **Identity Provider (AuthN)**.
- Directus/Lumibase = **Source of truth cho User domain (AuthZ + data + config)**.
- Bridge API = **điểm hợp nhất** để tránh client gọi chéo hai hệ thống theo cách khó kiểm soát.

---

## 3) Phạm vi triển khai

### In scope (MVP+)

1. User lifecycle đầy đủ: create, activate, suspend, reactivate, soft-delete.
2. Role/permission theo policy tập trung trên Directus.
3. AI entitlement + quota + model policy per-user/per-plan.
4. Multi-device session control (desktop) và revoke session.
5. Audit log cho hành vi nhạy cảm (role change, permission change, quota override).
6. Bridge Firebase ↔ Directus với cơ chế idempotent sync.

### Out of scope

- Billing gateway chi tiết (Stripe webhook full workflow).
- SSO enterprise nâng cao (SCIM/SAML provisioning).

---

## 4) Domain model chuẩn cho User Management

## 4.1 Collections (Directus/PostgreSQL)

1. `users`
   - `id` (uuid, PK)
   - `firebase_uid` (unique)
   - `email` (unique, normalized)
   - `display_name`
   - `avatar_url`
   - `status` (`pending` | `active` | `suspended` | `deleted`)
   - `risk_level` (`low` | `medium` | `high`)
   - `created_at`, `updated_at`, `last_login_at`

2. `user_roles`
   - `id`, `user_id`, `role_code`, `assigned_at`, `assigned_by`

3. `roles`
   - `role_code` (`guest`, `user`, `pro`, `admin`, `support`)
   - `description`

4. `permissions`
   - `permission_code` (vd: `ai.use`, `ai.use.pro_model`, `user.manage`, `quota.override`)

5. `role_permissions`
   - map role ↔ permission

6. `user_entitlements`
   - `id`, `user_id`
   - `ai_enabled` (bool)
   - `plan_code` (`free` | `pro` | `enterprise`)
   - `monthly_quota`
   - `used_quota`
   - `quota_reset_at`
   - `allowed_models` (jsonb)
   - `max_requests_per_minute`

7. `user_sessions`
   - `id`, `user_id`, `device_id`, `session_state`, `last_seen_at`, `revoked_at`

8. `audit_logs`
   - `id`, `actor_user_id`, `action`, `resource`, `before_data`, `after_data`, `created_at`

## 4.2 Ràng buộc dữ liệu bắt buộc

- `firebase_uid` luôn unique.
- `email` lưu lowercase + trim.
- `used_quota <= monthly_quota` (check constraint).
- `status=deleted` => không cấp session mới.

---

## 5) Specs chức năng chi tiết

## 5.1 Identity & Session

### FS-ID-01 — Login chuẩn
- Client đăng nhập qua Firebase.
- Client gửi Firebase ID token tới Bridge API `POST /auth/exchange`.
- Bridge verify token, upsert `users` trong Directus và trả `access_context`.

### FS-ID-02 — Session bind theo thiết bị
- Mỗi desktop instance có `device_id` riêng.
- Exchange token thành công sẽ tạo/cập nhật `user_sessions`.
- Cho phép admin revoke từng session hoặc tất cả session user.

### FS-ID-03 — Logout nhất quán
- Logout tại client gọi:
  1) Firebase signOut
  2) Bridge API revoke session
  3) clear local auth cache

## 5.2 User profile management

### FS-USER-01 — Upsert profile idempotent
- Lần login đầu: tạo bản ghi user.
- Các lần sau: chỉ cập nhật field cho phép (display_name, avatar_url, last_login_at).
- Không cho client update role/permission trực tiếp.

### FS-USER-02 — User status machine
- Trạng thái hợp lệ:
  - `pending -> active`
  - `active -> suspended`
  - `suspended -> active`
  - `active|suspended -> deleted` (soft-delete)
- Mọi chuyển trạng thái phải lưu audit.

## 5.3 Authorization (Directus-driven)

### FS-AUTHZ-01 — Policy evaluation
- Bridge lấy role + permission từ Directus.
- Tạo `access_context` trả về client gồm:
  - `role_codes[]`
  - `permission_codes[]`
  - `entitlement`

### FS-AUTHZ-02 — Permission gate cho AI
- Mọi call AI phải thỏa:
  - user status `active`
  - có permission `ai.use`
  - quota chưa vượt
  - model nằm trong `allowed_models`

### FS-AUTHZ-03 — Error taxonomy chuẩn
- `AUTH_REQUIRED`
- `TOKEN_EXPIRED_OR_INVALID`
- `ACCOUNT_SUSPENDED`
- `PERMISSION_DENIED`
- `AI_QUOTA_EXCEEDED`
- `MODEL_NOT_ALLOWED`
- `SESSION_REVOKED`

## 5.4 AI entitlement & quota

### FS-ENT-01 — Chính sách quota
- Hỗ trợ 2 mode:
  - Request-based quota.
  - Token-based quota (phase nâng cao).
- MVP dùng request-based để đơn giản hóa vận hành.

### FS-ENT-02 — Atomic usage update
- Sau mỗi request AI thành công: tăng `used_quota` bằng transaction SQL.
- Chống race condition khi đa tab/multi-device.

### FS-ENT-03 — Quota reset job
- Cron job hằng ngày kiểm tra `quota_reset_at`.
- Khi đến kỳ, reset `used_quota=0`, set `quota_reset_at` tháng tiếp theo.

## 5.5 Admin capability

### FS-ADMIN-01 — User admin panel (Directus CMS)
- Tìm user theo email/firebase_uid.
- Đổi status, gán role, override quota, revoke session.
- Toàn bộ thao tác ghi vào `audit_logs`.

### FS-ADMIN-02 — Permission config API
- Quản lý mapping role-permission qua Lumibase migration + Directus collections.
- Mọi thay đổi permission cần staging + approval trước production.

---

## 6) API specs (Bridge layer)

## 6.1 Auth & context

1. `POST /auth/exchange`
   - Input: `{ firebaseIdToken, deviceId, clientVersion }`
   - Output: `{ user, roles, permissions, entitlement, session }`

2. `POST /auth/logout`
   - Input: `{ sessionId }`
   - Output: `{ revoked: true }`

3. `GET /auth/context`
   - Output: access context mới nhất từ Directus.

## 6.2 User management

4. `GET /users/me`
5. `PATCH /users/me` (chỉ field profile cho phép)
6. `GET /users/me/sessions`
7. `POST /users/me/sessions/revoke`

## 6.3 AI entitlement

8. `GET /ai/entitlement`
9. `POST /ai/usage/consume`
   - Bridge validate + consume quota atomically.

---

## 7) Lumibase specs (schema + migration + config)

1. Mọi collection Directus ở mục 4 phải được định nghĩa bằng migration có version rõ ràng.
2. Tách migration theo nhóm:
   - `001_users_core`
   - `002_roles_permissions`
   - `003_entitlements_sessions`
   - `004_audit`
3. Có seed data mặc định:
   - roles: guest/user/pro/admin/support
   - permission baseline cho AI và user management
4. Có rollback script cho từng migration để phục hồi nhanh.

---

## 8) Security specs

1. Bridge API phải verify Firebase JWT bằng public keys chính thức.
2. Directus admin token không xuất hiện ở client.
3. Không trust dữ liệu role/quota từ client payload.
4. Sensitive action cần `actor_user_id` và trace id.
5. Rate limit endpoint `/auth/exchange` và `/ai/usage/consume`.

---

## 9) Observability & vận hành

1. Metrics bắt buộc:
   - login_success_rate
   - auth_exchange_latency_p95
   - ai_denied_rate_by_reason
   - quota_exhausted_users
2. Audit events:
   - role_changed
   - permission_changed
   - entitlement_overridden
   - session_revoked
3. Alerting:
   - tăng đột biến `TOKEN_EXPIRED_OR_INVALID`
   - lỗi DB transaction ở `consume_quota`

---

## 10) Acceptance criteria (định nghĩa “quản lý user thật hoàn hảo” cho MVP production)

1. User login lần đầu qua Firebase được sync Directus trong < 2 giây.
2. User bị suspended không gọi được AI ở mọi endpoint liên quan.
3. Revoke session có hiệu lực tối đa sau 60 giây.
4. Không có trường hợp âm quota hoặc vượt quota do race condition.
5. Mọi thay đổi role/quota/status đều truy vết được trong audit log.
6. App hiển thị đúng 4 trạng thái AI: guest / active / quota_exceeded / suspended.

---

## 11) Danh sách specs cần chốt trước khi code (ưu tiên thực thi)

1. **S1 — User Lifecycle Spec**
   - State machine + business rules cho `pending/active/suspended/deleted`.
2. **S2 — Role/Permission Matrix Spec**
   - Bảng quyền chi tiết theo role cho AI + user management.
3. **S3 — Entitlement & Quota Spec**
   - Công thức đếm quota, reset cycle, override policy.
4. **S4 — Bridge API Contract Spec**
   - Request/response schema, error mapping, idempotency key.
5. **S5 — Directus Permission Config Spec**
   - Field-level access, collection-level policy, admin workflow.
6. **S6 — Session Security Spec**
   - Device binding, revoke semantics, token refresh policy.
7. **S7 — Audit & Compliance Spec**
   - Danh mục event bắt buộc, retention, truy vấn điều tra sự cố.
8. **S8 — Rollout & Migration Spec**
   - Kế hoạch chuyển từ hệ cũ (Firebase-centric) sang Directus-centric domain.

> Nếu bạn xác nhận danh sách S1-S8, bước tiếp theo tôi sẽ tách thành từng tài liệu implementation-ready (sequence diagram, JSON schema, SQL migration draft, test cases theo từng spec).
