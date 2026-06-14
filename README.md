# Chấm Công — Hệ thống điểm danh & chấm công giáo viên

Web app quản lý điểm danh, chấm công giáo viên cho trung tâm giáo dục.
Xây dựng bằng React (Vite) + Tailwind CSS + Firebase (Firestore + Auth) trên Spark Plan (miễn phí).

## Vai trò

- **Quản lý (admin)**: duyệt tài khoản, tạo lịch dạy cố định, tạo/điều chỉnh lịch tháng,
  đổi giáo viên dạy thay, xem báo cáo và xuất Excel, cài đặt quy định.
- **Giám thị (supervisor)**: điểm danh giáo viên đến dạy theo từng buổi.
- **Giáo viên (teacher)**: xem lịch dạy, xác nhận hoàn thành buổi dạy (Done),
  xem tổng hợp các buổi dạy trong tháng.

## Công nghệ

- React 18 + Vite
- Tailwind CSS
- Firebase Auth (Email/Password)
- Firestore (Spark Plan — miễn phí)
- react-calendar, date-fns, xlsx + file-saver, react-hot-toast

## Cấu trúc dữ liệu Firestore

- `users` — tài khoản, vai trò (admin/supervisor/teacher/pending), mã GV/GT
- `classTemplates` — lịch dạy cố định, mỗi template có nhiều `slots` (thứ + giờ)
- `schedules` — từng buổi dạy cụ thể (điểm danh, done, dạy thay, huỷ buổi...)
- `settings` — quy định trễ, phạt

## Luồng tài khoản

1. Giáo viên/Giám thị tự đăng ký (email + mật khẩu) → trạng thái `pending`
2. Quản lý duyệt tại **Tài khoản** → cấp mã GV/GT tự động theo môn học → cấp quyền
3. Tài khoản hoạt động → đăng nhập vào đúng giao diện theo vai trò