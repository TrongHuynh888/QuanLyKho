-- =====================================================================
-- TAIKA SEAFOOD - TONG HOP SCHEMA DATABASE CHINH THUC
-- He thong Quan ly Kho hang Hai san (WMS)
-- Database Schema cho Supabase (PostgreSQL)
--
-- File nay thiet lap toan bo:
--   * Bang du lieu (Tables)
--   * Chinh sach bao mat hang (RLS Policies)
--   * Ham va Trigger tu dong
--   * Ham RPC cho thao tac ton kho
--
-- Huong dan: Copy toan bo noi dung nay vao SQL Editor
-- tren Supabase Dashboard va bam "Run" de tao database.
-- =====================================================================

-- =========================
-- PHAN 1: CAU TRUC GOC
-- =========================

-- Extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Bang Ho so Nguoi dung (Profiles)
-- Mo rong tu bang auth.users cua Supabase
-- role: admin, manager (quan ly), worker (nhan vien)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  email TEXT,
  role TEXT CHECK (role IN ('admin', 'manager', 'worker')) DEFAULT 'worker',
  avatar_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bang Kho hang (Warehouses)
-- temperature_zone: vung nhiet do luu tru (VD: -18*C, -25*C)
CREATE TABLE IF NOT EXISTS public.warehouses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  temperature_zone TEXT,
  total_zones INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bang Danh muc San pham (Categories)
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bang Don vi Tinh (UoM)
-- VD: Kilogram (kg), Tan (MT), Thung (box)
CREATE TABLE IF NOT EXISTS public.uoms (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  abbreviation TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bang Nha cung cap (Suppliers)
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  bank_name TEXT,
  bank_account TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  website TEXT,
  notes TEXT,
  status TEXT CHECK (status IN ('active', 'pending', 'inactive')) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bang San pham (Products)
-- type: loai che bien (PTO, HOSO, HLSO, PD, OTHER)
-- size: co tom (VD: 20/30, 30/40)
-- state: trang thai (raw = song, cooked = chin, processed = da che bien)
CREATE TABLE IF NOT EXISTS public.products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  uom_id UUID REFERENCES public.uoms(id) ON DELETE SET NULL,
  type TEXT,
  size TEXT,
  state TEXT CHECK (state IN ('raw', 'cooked', 'processed', 'packaging')),
  min_stock_level NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bang Vi tri Luu tru (Storage Locations)
-- Quan ly vi tri cu the trong kho: Khu vuc -> Ke -> Ngan
-- VD: Z1-R2-B4 = Khu vuc 1, Ke 2, Ngan 4
CREATE TABLE IF NOT EXISTS public.storage_locations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE CASCADE,
  zone TEXT NOT NULL,
  rack TEXT,
  bin TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(warehouse_id, zone, rack, bin)
);

-- Bang Lo hang (Batches)
-- qc_status: trang thai kiem tra chat luong (Pass/Fail/Hold)
-- certificates: chung nhan (ASC, BAP, GlobalGAP, v.v.)
CREATE TABLE IF NOT EXISTS public.batches (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  lot_number TEXT UNIQUE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  origin TEXT,
  production_date DATE,
  expiry_date DATE,
  qc_status TEXT CHECK (qc_status IN ('Pass', 'Fail', 'Hold')) DEFAULT 'Hold',
  certificates TEXT[],
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bang Ton kho (Inventory)
-- Theo doi so luong ton kho HIEN TAI theo san pham + vi tri + lo
-- UNIQUE dam bao moi to hop (san pham, kho, lo) chi co 1 dong
CREATE TABLE IF NOT EXISTS public.inventory (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.storage_locations(id) ON DELETE SET NULL,
  batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  batch_number TEXT,
  expiry_date DATE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(product_id, warehouse_id, batch_number)
);

-- Bang Hoat dong / Nhat ky (Activities)
-- Ghi lai moi hoat dong: Nhap kho, Xuat kho, Dieu chuyen
-- Day la bang audit chinh cho giao dien "Hoat dong" 
CREATE TABLE IF NOT EXISTS public.activities (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  type TEXT CHECK (type IN ('inbound', 'outbound', 'transfer', 'stocktake')) NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  to_warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  quantity NUMERIC NOT NULL,
  batch_number TEXT,
  status TEXT CHECK (status IN ('completed', 'pending', 'cancelled')) DEFAULT 'completed',
  performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bang Di chuyen Kho hang (Stock Movements)
-- Chi tiet hon Activities: theo doi di chuyen o cap vi tri (location)
-- Dung cho logic FEFO/FIFO
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  from_location_id UUID REFERENCES public.storage_locations(id) ON DELETE SET NULL,
  to_location_id UUID REFERENCES public.storage_locations(id) ON DELETE SET NULL,
  quantity NUMERIC NOT NULL,
  movement_type TEXT CHECK (movement_type IN ('inbound', 'outbound', 'transfer', 'adjustment')),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bang Phieu nhap hang (Inbound Shipments)
-- Ghi nhan thong tin moi lan nhan hang tu nha cung cap
CREATE TABLE IF NOT EXISTS public.inbound_shipments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name TEXT,
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  received_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT CHECK (status IN ('pending', 'completed', 'cancelled')) DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bang Don hang Xuat (Outbound Orders)
CREATE TABLE IF NOT EXISTS public.outbound_orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_name TEXT NOT NULL,
  order_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT CHECK (status IN ('pending', 'processing', 'shipped', 'completed', 'cancelled')) DEFAULT 'pending',
  shipping_address TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bang Chi tiet Don hang (Order Items)
-- Moi dong = 1 san pham trong 1 don hang xuat
-- quantity_allocated: so luong da phan bo tu kho
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID REFERENCES public.outbound_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  quantity_requested NUMERIC NOT NULL,
  quantity_allocated NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================
-- BAT BAO MAT HANG (ROW LEVEL SECURITY - RLS)
-- =========================
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

-- =========================
-- HAM HO TRO KIEM TRA VAI TRO
-- =========================

-- Kiem tra nguoi dung hien tai co phai Admin khong
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Kiem tra nguoi dung hien tai co phai Admin hoac Manager khong
CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'manager')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================
-- CHINH SACH BAO MAT (RLS POLICIES)
-- Quy tac chung:
--   SELECT (Xem): Tat ca user da dang nhap deu duoc xem
--   INSERT (Them): Admin + Manager duoc them du lieu master
--   UPDATE (Sua): Admin + Manager duoc sua du lieu master
--   DELETE (Xoa): Chi Admin duoc xoa
-- =========================

-- Policies: PROFILES
-- Ai cung duoc xem ho so (can cho hien thi ten nguoi thuc hien)
CREATE POLICY "profiles_select_all"
  ON public.profiles FOR SELECT
  USING (true);
-- Nguoi dung chi duoc sua ho so cua chinh minh
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
-- Admin duoc sua ho so bat ky (VD: doi role cho nhan vien)
CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE
  USING (public.is_admin());
-- Cho phep trigger tu tao profile khi dang ky (dung service_role)
CREATE POLICY "profiles_insert_system"
  ON public.profiles FOR INSERT
  WITH CHECK (true);

-- Policies: WAREHOUSES
CREATE POLICY "warehouses_select_authenticated"
  ON public.warehouses FOR SELECT
  TO authenticated
  USING (true);
CREATE POLICY "warehouses_insert_admin"
  ON public.warehouses FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "warehouses_update_admin"
  ON public.warehouses FOR UPDATE
  TO authenticated
  USING (public.is_admin());
CREATE POLICY "warehouses_delete_admin"
  ON public.warehouses FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Policies: CATEGORIES
CREATE POLICY "categories_select_authenticated"
  ON public.categories FOR SELECT
  TO authenticated
  USING (true);
CREATE POLICY "categories_insert_admin"
  ON public.categories FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "categories_update_admin"
  ON public.categories FOR UPDATE
  TO authenticated
  USING (public.is_admin());
CREATE POLICY "categories_delete_admin"
  ON public.categories FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Policies: UOMS
CREATE POLICY "uoms_select_authenticated"
  ON public.uoms FOR SELECT
  TO authenticated
  USING (true);
CREATE POLICY "uoms_insert_admin"
  ON public.uoms FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "uoms_update_admin"
  ON public.uoms FOR UPDATE
  TO authenticated
  USING (public.is_admin());
CREATE POLICY "uoms_delete_admin"
  ON public.uoms FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Policies: SUPPLIERS
CREATE POLICY "suppliers_select_authenticated"
  ON public.suppliers FOR SELECT
  TO authenticated
  USING (true);
CREATE POLICY "suppliers_insert_admin"
  ON public.suppliers FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "suppliers_update_admin"
  ON public.suppliers FOR UPDATE
  TO authenticated
  USING (public.is_admin());
CREATE POLICY "suppliers_delete_admin"
  ON public.suppliers FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Policies: PRODUCTS
CREATE POLICY "products_select_authenticated"
  ON public.products FOR SELECT
  TO authenticated
  USING (true);
CREATE POLICY "products_insert_admin"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "products_update_admin"
  ON public.products FOR UPDATE
  TO authenticated
  USING (public.is_admin());
CREATE POLICY "products_delete_admin"
  ON public.products FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Policies: STORAGE_LOCATIONS
CREATE POLICY "storage_locations_select_authenticated"
  ON public.storage_locations FOR SELECT
  TO authenticated
  USING (true);
CREATE POLICY "storage_locations_insert_admin"
  ON public.storage_locations FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "storage_locations_update_admin"
  ON public.storage_locations FOR UPDATE
  TO authenticated
  USING (public.is_admin());
CREATE POLICY "storage_locations_delete_admin"
  ON public.storage_locations FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Policies: BATCHES
CREATE POLICY "batches_select_authenticated"
  ON public.batches FOR SELECT
  TO authenticated
  USING (true);
CREATE POLICY "batches_insert_admin_manager"
  ON public.batches FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_manager());
CREATE POLICY "batches_update_admin_manager"
  ON public.batches FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_manager());
CREATE POLICY "batches_delete_admin"
  ON public.batches FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Policies: INVENTORY
CREATE POLICY "inventory_select_authenticated"
  ON public.inventory FOR SELECT
  TO authenticated
  USING (true);
CREATE POLICY "inventory_insert_admin_manager"
  ON public.inventory FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_manager());
CREATE POLICY "inventory_update_admin_manager"
  ON public.inventory FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_manager());
CREATE POLICY "inventory_delete_admin"
  ON public.inventory FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Policies: ACTIVITIES
CREATE POLICY "activities_select_authenticated"
  ON public.activities FOR SELECT
  TO authenticated
  USING (true);
CREATE POLICY "activities_insert_admin_manager"
  ON public.activities FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_manager());
CREATE POLICY "activities_update_admin"
  ON public.activities FOR UPDATE
  TO authenticated
  USING (public.is_admin());

-- Policies: STOCK_MOVEMENTS
CREATE POLICY "stock_movements_select_authenticated"
  ON public.stock_movements FOR SELECT
  TO authenticated
  USING (true);
CREATE POLICY "stock_movements_insert_admin_manager"
  ON public.stock_movements FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_manager());
CREATE POLICY "stock_movements_update_admin"
  ON public.stock_movements FOR UPDATE
  TO authenticated
  USING (public.is_admin());

-- Policies: INBOUND_SHIPMENTS
CREATE POLICY "inbound_shipments_select_authenticated"
  ON public.inbound_shipments FOR SELECT
  TO authenticated
  USING (true);
CREATE POLICY "inbound_shipments_insert_admin_manager"
  ON public.inbound_shipments FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_manager());
CREATE POLICY "inbound_shipments_update_admin_manager"
  ON public.inbound_shipments FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_manager());
CREATE POLICY "inbound_shipments_delete_admin"
  ON public.inbound_shipments FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Policies: OUTBOUND_ORDERS
CREATE POLICY "outbound_orders_select_authenticated"
  ON public.outbound_orders FOR SELECT
  TO authenticated
  USING (true);
CREATE POLICY "outbound_orders_insert_admin_manager"
  ON public.outbound_orders FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_manager());
CREATE POLICY "outbound_orders_update_admin_manager"
  ON public.outbound_orders FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_manager());
CREATE POLICY "outbound_orders_delete_admin"
  ON public.outbound_orders FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Policies: ORDER_ITEMS
CREATE POLICY "order_items_select_authenticated"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (true);
CREATE POLICY "order_items_insert_admin_manager"
  ON public.order_items FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_manager());
CREATE POLICY "order_items_update_admin_manager"
  ON public.order_items FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_manager());
CREATE POLICY "order_items_delete_admin"
  ON public.order_items FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- =========================
-- HAM VA TRIGGER TU DONG
-- =========================

-- Trigger tu cap nhat truong updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- Ap dung trigger cho bang profiles
CREATE TRIGGER on_profile_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
-- Ap dung trigger cho bang inventory
CREATE TRIGGER on_inventory_updated
  BEFORE UPDATE ON public.inventory
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Trigger tu tao Profile khi dang ky tai khoan moi
-- Khi co user moi dang ky qua Supabase Auth, tu tao 1 dong
-- trong bang profiles voi role mac dinh la 'worker'
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
-- Xoa trigger cu neu co (tranh loi khi chay lai script)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- =========================
-- HAM RPC CHO THAO TAC TON KHO
-- =========================

-- Ham Tang ton kho (Increment Inventory)
-- Khi nhap hang hoac chuyen hang DEN mot vi tri
-- Neu chua co ban ghi ton kho -> tao moi voi so luong = qty
-- Neu da co -> cong them qty vao quantity hien tai
CREATE OR REPLACE FUNCTION public.increment_inventory(
  pid UUID,
  lid UUID,
  bid UUID,
  qty NUMERIC
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.inventory
  SET quantity = quantity + qty,
      updated_at = NOW()
  WHERE product_id = pid
    AND (location_id = lid OR warehouse_id = lid)
    AND batch_id = bid;
  IF NOT FOUND THEN
    INSERT INTO public.inventory (product_id, location_id, batch_id, quantity)
    VALUES (pid, lid, bid, qty);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ham Giam ton kho (Decrement Inventory)
-- Khi xuat hang hoac chuyen hang DI khoi mot vi tri
-- Giam quantity di qty. Neu quantity <= 0 sau khi tru -> xoa dong
CREATE OR REPLACE FUNCTION public.decrement_inventory(
  pid UUID,
  lid UUID,
  bid UUID,
  qty NUMERIC
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.inventory
  SET quantity = quantity - qty,
      updated_at = NOW()
  WHERE product_id = pid
    AND (location_id = lid OR warehouse_id = lid)
    AND batch_id = bid;
  DELETE FROM public.inventory
  WHERE product_id = pid
    AND (location_id = lid OR warehouse_id = lid)
    AND batch_id = bid
    AND quantity <= 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================
-- DU LIEU MAU BAN DAU (Seed Data)
-- =========================

-- Danh muc san pham mac dinh
INSERT INTO public.categories (name, description) VALUES
  ('Nguyên liệu thô', 'Hải sản chưa qua chế biến'),
  ('Bán thành phẩm', 'Hải sản đã sơ chế'),
  ('Thành phẩm', 'Hải sản đã chế biến hoàn chỉnh, sẵn sàng xuất khẩu'),
  ('Phụ liệu', 'Vật tư đóng gói, gia vị, phụ gia')
ON CONFLICT (name) DO NOTHING;
-- Don vi tinh mac dinh
INSERT INTO public.uoms (name, abbreviation) VALUES
  ('Kilogram', 'kg'),
  ('Tấn', 'MT'),
  ('Thùng', 'box'),
  ('Gói', 'pcs'),
  ('Pallet', 'plt')
ON CONFLICT (name) DO NOTHING;
-- Kho hang mau
INSERT INTO public.warehouses (name, location, temperature_zone, total_zones) VALUES
  ('Kho lạnh A', 'Khu công nghiệp Trà Nóc, Cần Thơ', '-18°C', 3),
  ('Kho lạnh B', 'Khu công nghiệp Trà Nóc, Cần Thơ', '-25°C', 2),
  ('Kho thường', 'Khu cÃ´ng nghiá»‡p TrÃ  NÃ³c, Cáº§n ThÆ¡', 'Nhiá»‡t Ä‘á»™ thÆ°á»ng', 1);

-- =========================
-- PHAN 2: CAC GOI CAP NHAT MO RONG (MIGRATIONS)
-- =========================

-- MIGRATION: Them truong suc chua (capacity) va trang thai (status) cho vi tri luu tru
ALTER TABLE public.storage_locations
ADD COLUMN IF NOT EXISTS capacity NUMERIC DEFAULT 5000;
ALTER TABLE public.storage_locations
ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('active', 'maintenance', 'blocked')) DEFAULT 'active';
UPDATE public.storage_locations
SET capacity = 5000
WHERE capacity IS NULL;

-- MIGRATION: Them cac truong chi phi cho chi tiet phieu nhap
-- cost_price: gia nhap/kg, tax_rate: % thue, import_fee: phi nhap hang
ALTER TABLE public.inbound_shipment_items
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS import_fee NUMERIC DEFAULT 0;

-- MIGRATION: Tao bang Khach hang (Customers)
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  status TEXT CHECK (status IN ('active', 'pending', 'inactive')) DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- RLS cho bang customers
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers_select_authenticated"
  ON public.customers FOR SELECT
  TO authenticated
  USING (true);
CREATE POLICY "customers_insert_admin_manager"
  ON public.customers FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_manager());
CREATE POLICY "customers_update_admin_manager"
  ON public.customers FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_manager());
CREATE POLICY "customers_delete_admin"
  ON public.customers FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Them cot customer_id vao outbound_orders (neu chua co)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'outbound_orders' 
    AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE public.outbound_orders 
      ADD COLUMN customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- MIGRATION: Them cau hinh grid cho so do kho UI
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS racks_per_zone INTEGER DEFAULT 3;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS bins_per_rack INTEGER DEFAULT 6;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS bin_capacity_kg NUMERIC DEFAULT 5000;

-- MIGRATION: Them duong dan anh (image_url) cho san pham
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL;

-- MIGRATION: Tao bang chi tiet Phieu Nhap Kho (Inbound Shipment Items)
CREATE TABLE IF NOT EXISTS public.inbound_shipment_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  shipment_id UUID REFERENCES public.inbound_shipments(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  location_id UUID REFERENCES public.storage_locations(id) ON DELETE SET NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- RLS cho bang inbound_shipment_items
ALTER TABLE public.inbound_shipment_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inbound_shipment_items_select_authenticated"
  ON public.inbound_shipment_items FOR SELECT
  TO authenticated
  USING (true);
CREATE POLICY "inbound_shipment_items_insert_admin_manager"
  ON public.inbound_shipment_items FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_manager());
CREATE POLICY "inbound_shipment_items_update_admin_manager"
  ON public.inbound_shipment_items FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_manager());
CREATE POLICY "inbound_shipment_items_delete_admin"
  ON public.inbound_shipment_items FOR DELETE
  TO authenticated
  USING (public.is_admin());
CREATE INDEX IF NOT EXISTS idx_inbound_shipment_items_shipment 
-- Index de query nhanh hon
  ON public.inbound_shipment_items(shipment_id);

-- MIGRATION: Them gia ban/nhap tham khao cho san pham
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS import_price NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wholesale_price NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retail_price NUMERIC DEFAULT 0;

-- MIGRATION: Them mo ta va thanh phan cho san pham
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ingredients TEXT DEFAULT NULL;

-- MIGRATION: Tao bang lien ket nha cung cap - danh muc (supplier_categories)
CREATE TABLE IF NOT EXISTS supplier_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(supplier_id, category_id)
);
-- RLS cho supplier_categories
ALTER TABLE supplier_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read supplier_categories"
  ON supplier_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert supplier_categories"
  ON supplier_categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated delete supplier_categories"
  ON supplier_categories FOR DELETE TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_supplier_categories_supplier_id ON supplier_categories(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_categories_category_id ON supplier_categories(category_id);

-- MIGRATION: Them tien to tu dong sinh ma (Prefixes) cho cau truc Kho
ALTER TABLE public.warehouses 
  ADD COLUMN IF NOT EXISTS code VARCHAR(20) UNIQUE,
  ADD COLUMN IF NOT EXISTS zone_prefix VARCHAR(5) DEFAULT 'Z',
  ADD COLUMN IF NOT EXISTS rack_prefix VARCHAR(5) DEFAULT 'R',
  ADD COLUMN IF NOT EXISTS bin_prefix VARCHAR(5) DEFAULT 'B';
UPDATE public.warehouses SET 
  zone_prefix = COALESCE(zone_prefix, 'Z'),
  rack_prefix = COALESCE(rack_prefix, 'R'),
  bin_prefix = COALESCE(bin_prefix, 'B');

-- MIGRATION: Mo rong cau hinh kho hang
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS zones_per_row INTEGER DEFAULT NULL;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS area_sqm NUMERIC DEFAULT NULL;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS max_capacity_kg NUMERIC DEFAULT NULL;
ALTER TABLE warehouses DROP COLUMN IF EXISTS manager_name;
ALTER TABLE warehouses DROP COLUMN IF EXISTS manager_phone;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS managers_info JSONB DEFAULT '[]'::jsonb; 
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL;

-- MIGRATION: Tao bang Kiem ke kho (Stock Takes)
CREATE TABLE IF NOT EXISTS public.stock_takes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT CHECK (status IN ('in_progress', 'completed', 'cancelled')) DEFAULT 'in_progress',
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Bang chi tiet dong kiem ke
CREATE TABLE IF NOT EXISTS public.stock_take_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  stock_take_id UUID REFERENCES public.stock_takes(id) ON DELETE CASCADE,
  inventory_id UUID REFERENCES public.inventory(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  location_id UUID REFERENCES public.storage_locations(id) ON DELETE SET NULL,
  system_qty NUMERIC NOT NULL DEFAULT 0,
  actual_qty NUMERIC,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- RLS cho stock_takes va stock_take_items
ALTER TABLE public.stock_takes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_take_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_takes_select" ON public.stock_takes FOR SELECT TO authenticated USING (true);
CREATE POLICY "stock_takes_insert" ON public.stock_takes FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_manager());
CREATE POLICY "stock_takes_update" ON public.stock_takes FOR UPDATE TO authenticated USING (public.is_admin_or_manager());
CREATE POLICY "stock_takes_delete" ON public.stock_takes FOR DELETE TO authenticated USING (public.is_admin());
CREATE POLICY "stock_take_items_select" ON public.stock_take_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "stock_take_items_insert" ON public.stock_take_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "stock_take_items_update" ON public.stock_take_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "stock_take_items_delete" ON public.stock_take_items FOR DELETE TO authenticated USING (public.is_admin());

-- MIGRATION: Tao bang Thiet lap he thong (System Preferences)
CREATE TABLE IF NOT EXISTS public.system_preferences (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  require_qa_inbound BOOLEAN DEFAULT true,
  two_step_outbound BOOLEAN DEFAULT false,
  lot_number_format VARCHAR(50) DEFAULT 'LOT-{YYYYMMDD}-{XXXX}',
  default_tax_rate NUMERIC(5,2) DEFAULT 8.0,
  fefo_warning_days INT DEFAULT 30,
  scanner_sound_enabled BOOLEAN DEFAULT true,
  theme_mode VARCHAR(20) DEFAULT 'auto',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
-- Insert dong cau hinh mac dinh
INSERT INTO public.system_preferences (id) VALUES (1) ON CONFLICT DO NOTHING;
-- RLS cho system_preferences
ALTER TABLE public.system_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read preferences" 
ON public.system_preferences FOR SELECT 
USING (true);
CREATE POLICY "Allow authenticated users to update preferences" 
ON public.system_preferences FOR UPDATE 
USING (auth.role() = 'authenticated');

-- MIGRATION: Cap nhat Data Type cho bang Activities
ALTER TABLE public.activities DROP CONSTRAINT activities_type_check;
ALTER TABLE public.activities ADD CONSTRAINT activities_type_check CHECK (type IN ('inbound', 'outbound', 'transfer', 'stocktake'));

-- MIGRATION: Them cau hinh danh muc rieng cho tung zone trong kho
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS zone_categories JSONB DEFAULT '{}'::jsonb;

-- MIGRATION: Doi ten cot va them kich thuoc vat ly cho kho
ALTER TABLE public.warehouses RENAME COLUMN area_sqm TO total_floor_area_sqm;
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS pallet_width_cm INTEGER DEFAULT 100;
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS pallet_depth_cm INTEGER DEFAULT 120;
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS aisle_width_cm INTEGER DEFAULT 200;

-- MIGRATION: Them