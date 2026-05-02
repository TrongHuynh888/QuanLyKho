# 🐟 TAIKA SEAFOOD - Hệ Thống Quản Lý Kho (WMS)

[![React](https://img.shields.io/badge/React-19-blue.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-6-purple.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38B2AC.svg)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E.svg)](https://supabase.com/)
[![Express](https://img.shields.io/badge/Express.js-Backend-black.svg)](https://expressjs.com/)

**Taika Seafood WMS** là một Hệ thống Quản lý Kho (Warehouse Management System) cấp doanh nghiệp, được thiết kế chuyên biệt cho ngành chế biến và xuất khẩu hải sản. Ứng dụng cung cấp khả năng theo dõi hàng tồn kho theo thời gian thực, quét mã vạch/QR trên thiết bị di động, tích hợp API Backend và hệ thống báo cáo toàn diện.

## ✨ Tính năng nổi bật

- 📊 **Dashboard Thông minh**: Phân tích dữ liệu thực tế và các chỉ số KPI về mức tồn kho, lưu lượng nhập/xuất và phân bổ hàng hóa.
- 📦 **Quản lý Tồn kho**: Theo dõi hàng hóa trên nhiều kho bãi, hỗ trợ số lô (batch numbers), ngày hết hạn và nguyên tắc FEFO (Hết hạn trước - Xuất trước).
- 📷 **Quét Mã vạch/QR**: Tích hợp máy quét trực tiếp trên trình duyệt (sử dụng camera thiết bị) giúp thao tác nhập/xuất và kiểm kê kho cực kỳ nhanh chóng.
- 🏢 **Quản lý Sản phẩm & Đối tác**: Hệ cơ sở dữ liệu toàn diện cho nguyên vật liệu, thành phẩm, khách hàng và nhà cung cấp.
- 📋 **Nhật ký Hoạt động (Activity Logs)**: Lưu vết chi tiết mọi biến động kho (Nhập, Xuất, Điều chuyển).
- 🌐 **Đa Ngôn ngữ**: Hỗ trợ đầy đủ tiếng Việt và tiếng Anh.
- 📱 **Thiết kế Responsive**: Tối ưu hiển thị cho cả màn hình máy tính (quản trị viên) và thiết bị di động (nhân viên thao tác tại kho).

## 🛠 Công nghệ sử dụng

### Frontend
- **Framework**: React 19, Vite, TypeScript
- **Styling**: Tailwind CSS v4, Framer Motion (Animation)
- **UI Components**: Lucide React (Icons), Sonner (Notifications)
- **Data Viz**: Recharts, D3.js
- **Quét Mã/QR**: html5-qrcode, jsbarcode
- **Tiện ích khác**: React-i18next (Đa ngôn ngữ), Zod (Validation)

### Backend & Database
- **Server**: Node.js, Express.js (Chạy chung dưới `server.ts`)
- **Database**: Supabase (PostgreSQL) tích hợp Row Level Security (RLS)
- **Lưu trữ tệp (Storage)**: Cloudflare R2 / AWS S3 (Upload avatar, hình ảnh sản phẩm qua API backend)

## 📂 Cấu trúc thư mục dự án

```text
taika-seafood/
├── src/
│   ├── components/    # Các thành phần giao diện tái sử dụng (UI components)
│   ├── contexts/      # React Context (Ví dụ: AuthProvider)
│   ├── data/          # Dữ liệu tĩnh hoặc mock data
│   ├── lib/           # Tiện ích cấu hình thư viện (Supabase client, utils)
│   ├── views/         # Các màn hình chính (Dashboard, Nhập kho, Xuất kho,...)
│   ├── App.tsx        # Router và Entry point chính của ứng dụng
│   └── main.tsx       # Khởi tạo React DOM
├── server.ts          # Express Backend API server (Xử lý Auth, Upload, Inventory logic)
├── supabase_schema.sql# Script khởi tạo cấu trúc Bảng và RLS cho Database
├── package.json       # Danh sách dependencies & scripts chạy dự án
└── tsconfig.json      # Cấu hình TypeScript
```

## 🚀 Hướng dẫn cài đặt và Chạy dự án

### 1. Yêu cầu hệ thống
- [Node.js](https://nodejs.org/) (Khuyến nghị phiên bản 20.x trở lên)
- Có tài khoản [Supabase](https://supabase.com/) để làm Database.

### 2. Thiết lập Database (Supabase)
1. Tạo một project mới trên Dashboard của Supabase.
2. Truy cập vào mục **SQL Editor**.
3. Copy toàn bộ nội dung trong file `supabase_schema.sql` và nhấn Run để hệ thống tự động khởi tạo các bảng và thiết lập chính sách bảo mật (RLS).
4. Bật tính năng xác thực qua Email/Password trong phần **Authentication** > **Providers**.

### 3. Cấu hình biến môi trường
Tạo file `.env` ở thư mục gốc của dự án (ngang hàng với `package.json`) và thêm các cấu hình sau:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Cài đặt và Chạy tại môi trường Local

Cài đặt các thư viện (dependencies):
```bash
npm install
```

Chạy dự án ở chế độ phát triển (bao gồm Frontend Vite và Backend Express, thông qua `tsx`):
```bash
npm run dev
```
Hệ thống sẽ chạy và tự động reload khi bạn thay đổi code. 
- Frontend thường chạy ở `http://localhost:5173`
- Backend API chạy ở `http://localhost:3000`

### 5. Build dự án (Dành cho Production)

Để build toàn bộ code ra bản tối ưu hóa cho production:
```bash
npm run build
```
Chạy bản build ở local để kiểm tra:
```bash
npm run start
```

## 📱 Lưu ý về tính năng Quét Mã (Scanner)

Tính năng quét QR/Barcode yêu cầu quyền truy cập vào Camera của thiết bị.
- **Localhost**: Trình duyệt sẽ cho phép truy cập camera vì `localhost` được xem là nguồn an toàn.
- **Production Deploy**: Ứng dụng **BẮT BUỘC** phải được chạy trên giao thức **HTTPS**. Nếu chạy qua HTTP thông thường trên IP/Domain ngoài localhost, trình duyệt sẽ chặn API Camera vì lý do bảo mật.

## 📄 Bản quyền & Giấy phép (License)

Dự án này là sản phẩm phục vụ cho thực tập tốt nghiệp phát triển hệ thống cho **TAIKA SEAFOOD**.
© 2026 Bản quyền thuộc về **Huỳnh Phú Trọng**. Vui lòng liên hệ tác giả trước khi sử dụng lại mã nguồn vào mục đích thương mại.

---
*Phát triển bởi Huỳnh Phú Trọng x TAIKA SEAFOOD - Precision in Seafood Logistics.*
