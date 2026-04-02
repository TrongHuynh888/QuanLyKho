-- ============================================================
-- TAIKA SEAFOOD - Hệ thống Quản lý Kho hàng (WMS)
-- Database Schema cho Supabase (PostgreSQL)
-- 
-- File này thiết lập toàn bộ:
--   • Bảng dữ liệu (Tables)
--   • Chính sách bảo mật hàng (RLS Policies)
--   • Hàm và Trigger tự động
--   • Hàm RPC cho thao tác tồn kho
--
-- Hướng dẫn: Copy toàn bộ nội dung này vào SQL Editor
-- trên Supabase Dashboard và bấm "Run" để tạo database.
-- ============================================================


-- ============================================================
-- 1. PHẦN MỞ RỘNG (EXTENSIONS)
-- Kích hoạt extension uuid-ossp để tạo UUID tự động
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================
-- 2. CÁC BẢNG DỮ LIỆU (TABLES)
-- ============================================================

-- ----------------------------------------------------------
-- 2.1. Bảng Hồ sơ Người dùng (Profiles)
-- Mở rộng từ bảng auth.users của Supabase.
-- Mỗi khi người dùng đăng ký, trigger sẽ tự tạo 1 dòng ở đây.
-- Vai trò (role): admin, manager (quản lý), worker (nhân viên).
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,                -- Họ và tên
  email TEXT,                    -- Email đăng ký
  role TEXT CHECK (role IN ('admin', 'manager', 'worker')) DEFAULT 'worker',
  avatar_url TEXT,               -- Ảnh đại diện (URL)
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ----------------------------------------------------------
-- 2.2. Bảng Kho hàng (Warehouses)
-- Lưu thông tin các kho lạnh / kho thường.
-- temperature_zone: vùng nhiệt độ lưu trữ (VD: -18°C, -25°C)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.warehouses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,             -- Tên kho (VD: Kho lạnh A)
  location TEXT,                  -- Địa chỉ / Vị trí kho
  temperature_zone TEXT,          -- Vùng nhiệt độ (VD: -18°C, Ambient)
  total_zones INTEGER DEFAULT 1,  -- Số lượng khu vực trong kho
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ----------------------------------------------------------
-- 2.3. Bảng Danh mục Sản phẩm (Categories)
-- Phân loại sản phẩm: Nguyên liệu thô, Thành phẩm, v.v.
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,      -- Tên danh mục (duy nhất)
  description TEXT,               -- Mô tả
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ----------------------------------------------------------
-- 2.4. Bảng Đơn vị Tính (Units of Measurement - UoM)
-- VD: Kilogram (kg), Tấn (MT), Thùng (box)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.uoms (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,      -- Tên đơn vị (VD: Kilogram)
  abbreviation TEXT NOT NULL,     -- Viết tắt (VD: kg)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ----------------------------------------------------------
-- 2.5. Bảng Nhà cung cấp (Suppliers)
-- Quản lý danh sách nhà cung cấp nguyên liệu hải sản.
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,              -- Tên nhà cung cấp
  contact_person TEXT,             -- Người liên hệ
  email TEXT,                      -- Email
  phone TEXT,                      -- Số điện thoại
  address TEXT,                    -- Địa chỉ
  status TEXT CHECK (status IN ('active', 'pending', 'inactive')) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ----------------------------------------------------------
-- 2.6. Bảng Sản phẩm (Products)
-- Quản lý tất cả sản phẩm hải sản.
-- type: loại chế biến (PTO, HOSO, HLSO, PD, OTHER)
-- size: cỡ tôm (VD: 20/30, 30/40)
-- state: trạng thái (raw = sống, cooked = chín, processed = đã chế biến)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,        -- Mã SKU (duy nhất)
  name TEXT NOT NULL,              -- Tên sản phẩm
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  uom_id UUID REFERENCES public.uoms(id) ON DELETE SET NULL,
  type TEXT,                       -- Loại chế biến (PTO, HOSO, HLSO, PD)
  size TEXT,                       -- Cỡ sản phẩm (VD: 20/30)
  state TEXT CHECK (state IN ('raw', 'cooked', 'processed')),
  min_stock_level NUMERIC DEFAULT 0, -- Mức tồn kho tối thiểu (cảnh báo)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ----------------------------------------------------------
-- 2.7. Bảng Vị trí Lưu trữ (Storage Locations)
-- Quản lý vị trí cụ thể trong kho: Khu vực → Kệ → Ngăn
-- VD: Z1-R2-B4 = Khu vực 1, Kệ 2, Ngăn 4
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.storage_locations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE CASCADE,
  zone TEXT NOT NULL,              -- Khu vực (VD: Z1, Z2)
  rack TEXT,                       -- Kệ (VD: R1, R2)
  bin TEXT,                        -- Ngăn/Ô (VD: B1, B4)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(warehouse_id, zone, rack, bin)  -- Không cho trùng vị trí trong cùng 1 kho
);

-- ----------------------------------------------------------
-- 2.8. Bảng Lô hàng (Batches)
-- Theo dõi từng lô hàng nhập vào.
-- qc_status: trạng thái kiểm tra chất lượng (Pass/Fail/Hold)
-- certificates: chứng nhận (ASC, BAP, GlobalGAP, v.v.)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.batches (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  lot_number TEXT UNIQUE NOT NULL, -- Số lô (VD: LOT-2024-04-01), duy nhất
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  origin TEXT,                     -- Nguồn gốc / Nông trại
  production_date DATE,            -- Ngày sản xuất
  expiry_date DATE,                -- Ngày hết hạn (quan trọng cho FEFO)
  qc_status TEXT CHECK (qc_status IN ('Pass', 'Fail', 'Hold')) DEFAULT 'Hold',
  certificates TEXT[],             -- Mảng chứng nhận: VD {'ASC', 'BAP'}
  notes TEXT,                      -- Ghi chú thêm
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ----------------------------------------------------------
-- 2.9. Bảng Tồn kho (Inventory)
-- Theo dõi số lượng tồn kho HIỆN TẠI theo sản phẩm + vị trí + lô.
-- Ràng buộc UNIQUE đảm bảo mỗi tổ hợp (sản phẩm, kho, lô) chỉ có 1 dòng.
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.storage_locations(id) ON DELETE SET NULL,
  batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,  -- Số lượng hiện tại
  batch_number TEXT,               -- Số lô (dạng text, dùng cho tra cứu nhanh)
  expiry_date DATE,                -- Ngày hết hạn (copy từ batch, tiện hiển thị)
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(product_id, warehouse_id, batch_number) -- Tránh trùng lặp
);

-- ----------------------------------------------------------
-- 2.10. Bảng Hoạt động / Nhật ký (Activities)
-- Ghi lại mọi hoạt động: Nhập kho, Xuất kho, Điều chuyển.
-- Đây là bảng audit chính cho giao diện "Hoạt động".
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activities (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  type TEXT CHECK (type IN ('inbound', 'outbound', 'transfer')) NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  to_warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL, -- Kho đích (cho điều chuyển)
  quantity NUMERIC NOT NULL,       -- Số lượng
  batch_number TEXT,               -- Số lô liên quan
  status TEXT CHECK (status IN ('completed', 'pending', 'cancelled')) DEFAULT 'completed',
  performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Ai thực hiện
  notes TEXT,                      -- Ghi chú
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ----------------------------------------------------------
-- 2.11. Bảng Di chuyển Kho hàng (Stock Movements)
-- Chi tiết hơn Activities: theo dõi di chuyển ở cấp vị trí (location).
-- Dùng cho logic FEFO/FIFO và API /api/movements.
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  from_location_id UUID REFERENCES public.storage_locations(id) ON DELETE SET NULL, -- Vị trí nguồn
  to_location_id UUID REFERENCES public.storage_locations(id) ON DELETE SET NULL,   -- Vị trí đích
  quantity NUMERIC NOT NULL,       -- Số lượng di chuyển
  movement_type TEXT CHECK (movement_type IN ('inbound', 'outbound', 'transfer', 'adjustment')),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Người thực hiện
  notes TEXT,                      -- Ghi chú
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ----------------------------------------------------------
-- 2.12. Bảng Phiếu nhập hàng (Inbound Shipments)
-- Ghi nhận thông tin mỗi lần nhận hàng từ nhà cung cấp.
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inbound_shipments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name TEXT,              -- Tên NCC (lưu trực tiếp để tra cứu nhanh)
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- Thời gian nhận
  received_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Người nhận
  status TEXT CHECK (status IN ('pending', 'completed', 'cancelled')) DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ----------------------------------------------------------
-- 2.13. Bảng Đơn hàng Xuất (Outbound Orders)
-- Ghi nhận đơn hàng xuất cho khách hàng.
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.outbound_orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_name TEXT NOT NULL,     -- Tên khách hàng
  order_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- Ngày đặt hàng
  status TEXT CHECK (status IN ('pending', 'processing', 'shipped', 'completed', 'cancelled')) DEFAULT 'pending',
  shipping_address TEXT,           -- Địa chỉ giao hàng
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ----------------------------------------------------------
-- 2.14. Bảng Chi tiết Đơn hàng (Order Items)
-- Mỗi dòng = 1 sản phẩm trong 1 đơn hàng xuất.
-- quantity_allocated: số lượng đã phân bổ từ kho.
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID REFERENCES public.outbound_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  quantity_requested NUMERIC NOT NULL,  -- Số lượng yêu cầu
  quantity_allocated NUMERIC DEFAULT 0, -- Số lượng đã cấp phát
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ============================================================
-- 3. BẬT BẢO MẬT HÀNG (ROW LEVEL SECURITY - RLS)
-- 
-- RLS đảm bảo mỗi người dùng chỉ truy cập được dữ liệu
-- phù hợp với vai trò của họ.
-- ============================================================

ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uoms              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbound_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbound_orders   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items       ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 4. HÀM HỖ TRỢ KIỂM TRA VAI TRÒ (Helper Functions)
-- ============================================================

-- Kiểm tra người dùng hiện tại có phải Admin không
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Kiểm tra người dùng hiện tại có phải Admin hoặc Manager không
CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'manager')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 5. CHÍNH SÁCH BẢO MẬT (RLS POLICIES)
--
-- Quy tắc chung:
--   • SELECT (Xem): Tất cả user đã đăng nhập đều được xem
--   • INSERT (Thêm): Admin + Manager được thêm dữ liệu master
--                     Mọi user được thêm hoạt động/tồn kho
--   • UPDATE (Sửa): Admin + Manager được sửa dữ liệu master
--   • DELETE (Xóa): Chỉ Admin được xóa
-- ============================================================

-- ----------------------------------------------------------
-- 5.1. Policies cho bảng PROFILES (Hồ sơ Người dùng)
-- ----------------------------------------------------------

-- Ai cũng được xem hồ sơ (cần cho hiển thị tên người thực hiện)
CREATE POLICY "profiles_select_all"
  ON public.profiles FOR SELECT
  USING (true);

-- Người dùng chỉ được sửa hồ sơ của chính mình
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admin được sửa hồ sơ bất kỳ (VD: đổi role cho nhân viên)
CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE
  USING (public.is_admin());

-- Cho phép trigger tự tạo profile khi đăng ký (dùng service_role)
CREATE POLICY "profiles_insert_system"
  ON public.profiles FOR INSERT
  WITH CHECK (true);

-- ----------------------------------------------------------
-- 5.2. Policies cho bảng WAREHOUSES (Kho hàng)
-- ----------------------------------------------------------

-- Tất cả user đã đăng nhập được xem danh sách kho
CREATE POLICY "warehouses_select_authenticated"
  ON public.warehouses FOR SELECT
  TO authenticated
  USING (true);

-- Chỉ Admin được thêm kho mới
CREATE POLICY "warehouses_insert_admin"
  ON public.warehouses FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Chỉ Admin được sửa thông tin kho
CREATE POLICY "warehouses_update_admin"
  ON public.warehouses FOR UPDATE
  TO authenticated
  USING (public.is_admin());

-- Chỉ Admin được xóa kho
CREATE POLICY "warehouses_delete_admin"
  ON public.warehouses FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------
-- 5.3. Policies cho bảng CATEGORIES (Danh mục)
-- ----------------------------------------------------------

-- Tất cả user đã đăng nhập được xem danh mục
CREATE POLICY "categories_select_authenticated"
  ON public.categories FOR SELECT
  TO authenticated
  USING (true);

-- Admin và Manager được thêm danh mục
CREATE POLICY "categories_insert_admin_manager"
  ON public.categories FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_manager());

-- Admin và Manager được sửa danh mục
CREATE POLICY "categories_update_admin_manager"
  ON public.categories FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_manager());

-- Chỉ Admin được xóa danh mục
CREATE POLICY "categories_delete_admin"
  ON public.categories FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------
-- 5.4. Policies cho bảng UOMS (Đơn vị tính)
-- ----------------------------------------------------------

-- Tất cả user đã đăng nhập được xem đơn vị tính
CREATE POLICY "uoms_select_authenticated"
  ON public.uoms FOR SELECT
  TO authenticated
  USING (true);

-- Admin và Manager được thêm đơn vị tính
CREATE POLICY "uoms_insert_admin_manager"
  ON public.uoms FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_manager());

-- Admin và Manager được sửa đơn vị tính
CREATE POLICY "uoms_update_admin_manager"
  ON public.uoms FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_manager());

-- Chỉ Admin được xóa đơn vị tính
CREATE POLICY "uoms_delete_admin"
  ON public.uoms FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------
-- 5.5. Policies cho bảng SUPPLIERS (Nhà cung cấp)
-- ----------------------------------------------------------

-- Tất cả user đã đăng nhập được xem nhà cung cấp
CREATE POLICY "suppliers_select_authenticated"
  ON public.suppliers FOR SELECT
  TO authenticated
  USING (true);

-- Admin và Manager được thêm nhà cung cấp mới
CREATE POLICY "suppliers_insert_admin_manager"
  ON public.suppliers FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_manager());

-- Admin và Manager được sửa thông tin nhà cung cấp
CREATE POLICY "suppliers_update_admin_manager"
  ON public.suppliers FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_manager());

-- Chỉ Admin được xóa nhà cung cấp
CREATE POLICY "suppliers_delete_admin"
  ON public.suppliers FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------
-- 5.6. Policies cho bảng PRODUCTS (Sản phẩm)
-- ----------------------------------------------------------

-- Tất cả user đã đăng nhập được xem sản phẩm
CREATE POLICY "products_select_authenticated"
  ON public.products FOR SELECT
  TO authenticated
  USING (true);

-- Admin và Manager được thêm sản phẩm
CREATE POLICY "products_insert_admin_manager"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_manager());

-- Admin và Manager được sửa sản phẩm
CREATE POLICY "products_update_admin_manager"
  ON public.products FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_manager());

-- Chỉ Admin được xóa sản phẩm
CREATE POLICY "products_delete_admin"
  ON public.products FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------
-- 5.7. Policies cho bảng STORAGE_LOCATIONS (Vị trí lưu trữ)
-- ----------------------------------------------------------

-- Tất cả user đã đăng nhập được xem vị trí lưu trữ
CREATE POLICY "storage_locations_select_authenticated"
  ON public.storage_locations FOR SELECT
  TO authenticated
  USING (true);

-- Admin và Manager được thêm vị trí mới
CREATE POLICY "storage_locations_insert_admin_manager"
  ON public.storage_locations FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_manager());

-- Admin và Manager được sửa vị trí
CREATE POLICY "storage_locations_update_admin_manager"
  ON public.storage_locations FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_manager());

-- Chỉ Admin được xóa vị trí
CREATE POLICY "storage_locations_delete_admin"
  ON public.storage_locations FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------
-- 5.8. Policies cho bảng BATCHES (Lô hàng)
-- ----------------------------------------------------------

-- Tất cả user đã đăng nhập được xem lô hàng
CREATE POLICY "batches_select_authenticated"
  ON public.batches FOR SELECT
  TO authenticated
  USING (true);

-- Tất cả user đã đăng nhập được tạo lô hàng (khi nhập kho)
CREATE POLICY "batches_insert_authenticated"
  ON public.batches FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Admin và Manager được sửa thông tin lô (VD: cập nhật QC status)
CREATE POLICY "batches_update_admin_manager"
  ON public.batches FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_manager());

-- Chỉ Admin được xóa lô hàng
CREATE POLICY "batches_delete_admin"
  ON public.batches FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------
-- 5.9. Policies cho bảng INVENTORY (Tồn kho)
-- ----------------------------------------------------------

-- Tất cả user đã đăng nhập được xem tồn kho
CREATE POLICY "inventory_select_authenticated"
  ON public.inventory FOR SELECT
  TO authenticated
  USING (true);

-- Tất cả user đã đăng nhập được thêm bản ghi tồn kho (khi nhập hàng)
CREATE POLICY "inventory_insert_authenticated"
  ON public.inventory FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Tất cả user đã đăng nhập được cập nhật tồn kho (khi xuất/nhập/điều chuyển)
CREATE POLICY "inventory_update_authenticated"
  ON public.inventory FOR UPDATE
  TO authenticated
  USING (true);

-- Chỉ Admin được xóa bản ghi tồn kho
CREATE POLICY "inventory_delete_admin"
  ON public.inventory FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------
-- 5.10. Policies cho bảng ACTIVITIES (Hoạt động / Nhật ký)
-- ----------------------------------------------------------

-- Tất cả user đã đăng nhập được xem lịch sử hoạt động
CREATE POLICY "activities_select_authenticated"
  ON public.activities FOR SELECT
  TO authenticated
  USING (true);

-- Tất cả user đã đăng nhập được ghi hoạt động (nhập, xuất, chuyển)
CREATE POLICY "activities_insert_authenticated"
  ON public.activities FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Admin được sửa hoạt động (VD: sửa trạng thái, ghi chú)
CREATE POLICY "activities_update_admin"
  ON public.activities FOR UPDATE
  TO authenticated
  USING (public.is_admin());

-- Không cho xóa hoạt động (audit trail - cần giữ lại để kiểm toán)
-- Nếu cần xóa, Admin phải dùng service_role key qua server.

-- ----------------------------------------------------------
-- 5.11. Policies cho bảng STOCK_MOVEMENTS (Di chuyển kho)
-- ----------------------------------------------------------

-- Tất cả user đã đăng nhập được xem lịch sử di chuyển
CREATE POLICY "stock_movements_select_authenticated"
  ON public.stock_movements FOR SELECT
  TO authenticated
  USING (true);

-- Tất cả user đã đăng nhập được tạo bản ghi di chuyển
CREATE POLICY "stock_movements_insert_authenticated"
  ON public.stock_movements FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Admin được sửa bản ghi di chuyển
CREATE POLICY "stock_movements_update_admin"
  ON public.stock_movements FOR UPDATE
  TO authenticated
  USING (public.is_admin());

-- Không cho xóa di chuyển kho (audit trail)

-- ----------------------------------------------------------
-- 5.12. Policies cho bảng INBOUND_SHIPMENTS (Phiếu nhập hàng)
-- ----------------------------------------------------------

-- Tất cả user đã đăng nhập được xem phiếu nhập
CREATE POLICY "inbound_shipments_select_authenticated"
  ON public.inbound_shipments FOR SELECT
  TO authenticated
  USING (true);

-- Tất cả user đã đăng nhập được tạo phiếu nhập (khi nhận hàng)
CREATE POLICY "inbound_shipments_insert_authenticated"
  ON public.inbound_shipments FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Admin và Manager được sửa phiếu nhập (VD: cập nhật trạng thái)
CREATE POLICY "inbound_shipments_update_admin_manager"
  ON public.inbound_shipments FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_manager());

-- Chỉ Admin được xóa phiếu nhập
CREATE POLICY "inbound_shipments_delete_admin"
  ON public.inbound_shipments FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------
-- 5.13. Policies cho bảng OUTBOUND_ORDERS (Đơn hàng xuất)
-- ----------------------------------------------------------

-- Tất cả user đã đăng nhập được xem đơn hàng xuất
CREATE POLICY "outbound_orders_select_authenticated"
  ON public.outbound_orders FOR SELECT
  TO authenticated
  USING (true);

-- Admin và Manager được tạo đơn hàng xuất
CREATE POLICY "outbound_orders_insert_admin_manager"
  ON public.outbound_orders FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_manager());

-- Admin và Manager được sửa đơn hàng (VD: cập nhật trạng thái)
CREATE POLICY "outbound_orders_update_admin_manager"
  ON public.outbound_orders FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_manager());

-- Chỉ Admin được xóa đơn hàng
CREATE POLICY "outbound_orders_delete_admin"
  ON public.outbound_orders FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------
-- 5.14. Policies cho bảng ORDER_ITEMS (Chi tiết đơn hàng)
-- ----------------------------------------------------------

-- Tất cả user đã đăng nhập được xem chi tiết đơn hàng
CREATE POLICY "order_items_select_authenticated"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (true);

-- Admin và Manager được thêm sản phẩm vào đơn hàng
CREATE POLICY "order_items_insert_admin_manager"
  ON public.order_items FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_manager());

-- Admin và Manager được sửa chi tiết đơn hàng
CREATE POLICY "order_items_update_admin_manager"
  ON public.order_items FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_manager());

-- Admin được xóa chi tiết đơn hàng
CREATE POLICY "order_items_delete_admin"
  ON public.order_items FOR DELETE
  TO authenticated
  USING (public.is_admin());


-- ============================================================
-- 6. HÀM VÀ TRIGGER TỰ ĐỘNG (Functions & Triggers)
-- ============================================================

-- ----------------------------------------------------------
-- 6.1. Trigger tự cập nhật trường updated_at
-- Khi sửa bất kỳ dòng nào, tự động đặt updated_at = thời gian hiện tại.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Áp dụng trigger cho bảng profiles
CREATE TRIGGER on_profile_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Áp dụng trigger cho bảng inventory
CREATE TRIGGER on_inventory_updated
  BEFORE UPDATE ON public.inventory
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- ----------------------------------------------------------
-- 6.2. Trigger tự tạo Profile khi đăng ký tài khoản mới
-- Khi có user mới đăng ký qua Supabase Auth, tự tạo 1 dòng
-- trong bảng profiles với role mặc định là 'worker'.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NEW.email,
    'worker'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Xóa trigger cũ nếu có (tránh lỗi khi chạy lại script)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- Tạo trigger mới
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- ============================================================
-- 7. HÀM RPC CHO THAO TÁC TỒN KHO (Inventory RPC Functions)
--
-- Hai hàm này được gọi từ server.ts qua supabase.rpc()
-- để tăng/giảm số lượng tồn kho một cách an toàn.
-- Sử dụng UPSERT để tự tạo dòng mới nếu chưa tồn tại.
-- ============================================================

-- ----------------------------------------------------------
-- 7.1. Hàm Tăng tồn kho (Increment Inventory)
-- Khi nhập hàng hoặc chuyển hàng ĐẾN một vị trí.
-- Nếu chưa có bản ghi tồn kho → tạo mới với số lượng = qty
-- Nếu đã có → cộng thêm qty vào quantity hiện tại
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_inventory(
  pid UUID,   -- product_id: ID sản phẩm
  lid UUID,   -- location_id (hoặc warehouse_id tùy cách dùng)
  bid UUID,   -- batch_id: ID lô hàng
  qty NUMERIC -- quantity: Số lượng cần tăng
)
RETURNS VOID AS $$
BEGIN
  -- Thử cập nhật bản ghi hiện có
  UPDATE public.inventory
  SET quantity = quantity + qty,
      updated_at = NOW()
  WHERE product_id = pid
    AND (location_id = lid OR warehouse_id = lid)
    AND batch_id = bid;
  
  -- Nếu không tìm thấy bản ghi nào → tạo mới
  IF NOT FOUND THEN
    INSERT INTO public.inventory (product_id, location_id, batch_id, quantity)
    VALUES (pid, lid, bid, qty);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------
-- 7.2. Hàm Giảm tồn kho (Decrement Inventory)
-- Khi xuất hàng hoặc chuyển hàng ĐI khỏi một vị trí.
-- Giảm quantity đi qty. Nếu quantity <= 0 sau khi trừ → xóa dòng.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.decrement_inventory(
  pid UUID,   -- product_id: ID sản phẩm
  lid UUID,   -- location_id (hoặc warehouse_id)
  bid UUID,   -- batch_id: ID lô hàng
  qty NUMERIC -- quantity: Số lượng cần giảm
)
RETURNS VOID AS $$
BEGIN
  -- Giảm số lượng
  UPDATE public.inventory
  SET quantity = quantity - qty,
      updated_at = NOW()
  WHERE product_id = pid
    AND (location_id = lid OR warehouse_id = lid)
    AND batch_id = bid;
  
  -- Xóa bản ghi nếu quantity <= 0 (hết hàng tại vị trí này)
  DELETE FROM public.inventory
  WHERE product_id = pid
    AND (location_id = lid OR warehouse_id = lid)
    AND batch_id = bid
    AND quantity <= 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 8. DỮ LIỆU MẪU BAN ĐẦU (Seed Data)
-- Tạo sẵn một số dữ liệu cơ bản để hệ thống hoạt động ngay.
-- ============================================================

-- Danh mục sản phẩm mặc định
INSERT INTO public.categories (name, description) VALUES
  ('Nguyên liệu thô', 'Hải sản chưa qua chế biến'),
  ('Bán thành phẩm', 'Hải sản đã sơ chế'),
  ('Thành phẩm', 'Hải sản đã chế biến hoàn chỉnh, sẵn sàng xuất khẩu'),
  ('Phụ liệu', 'Vật tư đóng gói, gia vị, phụ gia')
ON CONFLICT (name) DO NOTHING; -- Bỏ qua nếu đã tồn tại

-- Đơn vị tính mặc định
INSERT INTO public.uoms (name, abbreviation) VALUES
  ('Kilogram', 'kg'),
  ('Tấn', 'MT'),
  ('Thùng', 'box'),
  ('Gói', 'pcs'),
  ('Pallet', 'plt')
ON CONFLICT (name) DO NOTHING;

-- Kho hàng mẫu
INSERT INTO public.warehouses (name, location, temperature_zone, total_zones) VALUES
  ('Kho lạnh A', 'Khu công nghiệp Trà Nóc, Cần Thơ', '-18°C', 3),
  ('Kho lạnh B', 'Khu công nghiệp Trà Nóc, Cần Thơ', '-25°C', 2),
  ('Kho thường', 'Khu công nghiệp Trà Nóc, Cần Thơ', 'Nhiệt độ thường', 1);


-- ============================================================
-- HOÀN TẤT!
-- Script đã thiết lập xong:
--   ✅ 14 bảng dữ liệu
--   ✅ RLS bật cho tất cả các bảng
--   ✅ 50+ chính sách bảo mật (policies) chi tiết
--   ✅ 2 hàm kiểm tra vai trò (is_admin, is_admin_or_manager)
--   ✅ 2 hàm RPC tồn kho (increment/decrement)
--   ✅ 3 trigger tự động (updated_at, new user profile)
--   ✅ Dữ liệu mẫu ban đầu (categories, uoms, warehouses)
-- ============================================================
