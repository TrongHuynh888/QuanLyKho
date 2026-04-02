# TAIKA SEAFOOD - Warehouse Management System (WMS)

A production-grade Warehouse Management System designed for seafood processing and export industries. This application features real-time inventory tracking, mobile QR/Barcode scanning, and comprehensive reporting.

## 🚀 Key Features

- **Smart Dashboard**: Real-time analytics and KPIs for inventory levels, inbound/outbound flow, and stock distribution.
- **Inventory Management**: Track stock across multiple warehouses with support for batch numbers, expiry dates, and FEFO (First Expired, First Out) logic.
- **Mobile QR/Barcode Scanner**: Integrated camera-based scanning for rapid inbound/outbound operations and inventory audits.
- **Product & Supplier Management**: Comprehensive database for raw materials, processed goods, and trusted suppliers.
- **Activity Logs**: Detailed audit trail for every stock movement (Inbound, Outbound, Transfer).
- **Multi-language Support**: Fully localized in English and Vietnamese.
- **Responsive Design**: Optimized for both desktop management and mobile warehouse floor operations.

## 🎨 Branding & UI

- **Primary Colors**: 
  - Taika Blue: `#004A99` (Professionalism & Trust)
  - Taika Red: `#E31E24` (Energy & Precision)
- **Typography**: Inter (Sans-serif) for high legibility.
- **Animations**: Smooth transitions using `motion/react`.

## 🛠 Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS 4.
- **Icons**: Lucide React.
- **Charts**: Recharts.
- **Scanning**: html5-qrcode.
- **Notifications**: Sonner.
- **Internationalization**: i18next.
- **Database**: Supabase (PostgreSQL) with Row Level Security (RLS).

## 📊 Database Setup (Supabase)

All database schema, tables, and security policies are contained in the `supabase_schema.sql` file.

### Steps to Setup:
1. Create a new project on [Supabase](https://supabase.com).
2. Go to the **SQL Editor** in your Supabase dashboard.
3. Copy the contents of `supabase_schema.sql` and run it.
4. Enable **Google Auth** in the Authentication settings if you wish to use the profile trigger.

## 📱 Mobile Scanning Setup

The application requires camera permissions for the QR/Barcode scanner to function.
- **Local Dev**: Ensure your browser has camera access enabled.
- **Production**: The app is configured with `requestFramePermissions: ["camera"]` in `metadata.json`.

## 📂 Project Structure

- `/src/App.tsx`: Main application logic and UI views.
- `/src/index.css`: Global styles and Tailwind configuration.
- `/supabase_schema.sql`: Database initialization script.
- `/metadata.json`: App metadata and permissions.

---
*Developed for TAIKA SEAFOOD - Precision in Seafood Logistics.*
