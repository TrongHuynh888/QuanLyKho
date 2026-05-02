import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import dotenv from "dotenv";
import { supabase } from "./src/lib/supabase.js";
import multer from "multer";

const R2_WORKER_URL = "https://taika-r2-upload.thinhnd-2003.workers.dev";

dotenv.config();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

/**
 * Khởi tạo và cấu hình Express Server để xử lý các yêu cầu API.
 * Định nghĩa các route liên quan đến xác thực, quản lý kho, sản phẩm, v.v.
 */
async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Các route xác thực
  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ error: error.message });
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
    res.json({ user: data.user, session: data.session, profile });
  });

  app.post("/api/auth/signup", async (req, res) => {
    const { email, password, full_name } = req.body;
    const { data, error } = await supabase.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name },
    });
    if (error) return res.status(400).json({ error: error.message });
    res.json({ user: data.user });
  });

  app.get("/api/auth/profile", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No token" });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: "Invalid token" });
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    res.json({ user, profile });
  });

  app.post("/api/auth/logout", async (req, res) => {
    res.json({ message: "Logged out" });
  });

  // Quản lý người dùng
  app.get("/api/users", async (req, res) => {
    const { data, error } = await supabase.from("profiles").select("*").order("updated_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.put("/api/users/:id/role", async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    if (!["admin", "manager", "worker"].includes(role)) return res.status(400).json({ error: "Invalid role" });
    const { data, error } = await supabase.from("profiles").update({ role }).eq("id", id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.delete("/api/users/:id", async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: "User deleted" });
  });

  // Tải lên ảnh đại diện
  app.post("/api/upload/avatar", upload.single("file"), async (req, res) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ error: "No file" });
      const formData = new FormData();
      const blob = new Blob([new Uint8Array(file.buffer)], { type: file.mimetype });
      formData.append("file", blob, file.originalname);
      formData.append("folder", "avatars");
      const workerRes = await fetch(`${R2_WORKER_URL}/upload`, { method: "POST", body: formData });
      const workerData = await workerRes.json() as any;
      if (!workerRes.ok) throw new Error(workerData.error);
      const publicUrl = `${R2_WORKER_URL}/file/${workerData.key}`;
      res.json({ url: publicUrl });
    } catch (err: any) {
      console.error("Upload error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/users/:id/avatar", async (req, res) => {
    const { id } = req.params;
    const { avatar_url } = req.body;
    const { data: oldData } = await supabase.from("profiles").select("avatar_url").eq("id", id).single();
    const oldAvatarUrl = oldData?.avatar_url;
    const { data, error } = await supabase.from("profiles").update({ avatar_url }).eq("id", id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    if (oldAvatarUrl && oldAvatarUrl.startsWith(R2_WORKER_URL + "/file/") && oldAvatarUrl !== avatar_url) {
      try { await fetch(oldAvatarUrl, { method: "DELETE" }); } catch (err) { console.error("Lỗi khi xoá ảnh avatar cũ trên R2:", err); }
    }
    res.json(data);
  });

  // Quản lý sản phẩm
  app.get("/api/products", async (req, res) => {
    const { data, error } = await supabase.from("products").select("*, categories(*), uoms(*)").order("name");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post("/api/products", async (req, res) => {
    const { sku, name, category_id, uom_id, type, size, state, min_stock_level, image_url, description, ingredients, retail_price, wholesale_price, import_price } = req.body;
    if (!sku || !name) return res.status(400).json({ error: "sku and name are required" });
    const { data, error } = await supabase.from("products").insert({ sku, name, category_id, uom_id, type, size, state: state || 'raw', min_stock_level: min_stock_level || 0, image_url, description, ingredients, retail_price: retail_price || 0, wholesale_price: wholesale_price || 0, import_price: import_price || 0 }).select("*, categories(*), uoms(*)");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
  });

  app.put("/api/products/:id", async (req, res) => {
    const { id } = req.params;
    const { sku, name, category_id, uom_id, type, size, state, min_stock_level, image_url, description, ingredients, retail_price, wholesale_price, import_price } = req.body;
    const { data: oldData } = await supabase.from("products").select("image_url").eq("id", id).single();
    const oldImageUrl = oldData?.image_url;
    const { data, error } = await supabase.from("products").update({ sku, name, category_id, uom_id, type, size, state, min_stock_level, image_url, description, ingredients, retail_price, wholesale_price, import_price }).eq("id", id).select("*, categories(*), uoms(*)");
    if (error) return res.status(500).json({ error: error.message });
    if (oldImageUrl && oldImageUrl.startsWith(R2_WORKER_URL + "/file/") && oldImageUrl !== image_url) {
      try { await fetch(oldImageUrl, { method: "DELETE" }); } catch (err) { console.error("Lỗi khi xoá ảnh sản phẩm cũ trên R2:", err); }
    }
    res.json(data?.[0]);
  });

  app.delete("/api/products/:id", async (req, res) => {
    const { id } = req.params;
    
    // Kiểm tra tồn kho
    const { data: invCheck } = await supabase.from("inventory").select("id").eq("product_id", id).gt("quantity", 0).limit(1);
    if (invCheck && invCheck.length > 0) {
      return res.status(400).json({ error: "Sản phẩm đang có tồn kho. Không thể xóa." });
    }

    // Lưu lại danh sách phiếu nhập và phiếu xuất có chứa sản phẩm này để kiểm tra sau khi xóa
    const { data: inItems } = await supabase.from("inbound_shipment_items").select("shipment_id").eq("product_id", id);
    const shipmentIds = [...new Set((inItems || []).map((i: any) => i.shipment_id))];

    const { data: outItems } = await supabase.from("order_items").select("order_id").eq("product_id", id);
    const orderIds = [...new Set((outItems || []).map((i: any) => i.order_id))];

    const { data: oldData } = await supabase.from("products").select("image_url").eq("id", id).single();
    const oldImageUrl = oldData?.image_url;
    
    // Xóa lịch sử hoạt động và điều chuyển liên quan đến sản phẩm này TRƯỚC KHI xóa sản phẩm (để tránh bị set null)
    await supabase.from("activities").delete().eq("product_id", id);
    await supabase.from("stock_movements").delete().eq("product_id", id);

    // Tiến hành xóa sản phẩm
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    
    // Xóa ảnh trên R2
    if (oldImageUrl && oldImageUrl.startsWith(R2_WORKER_URL + "/file/")) {
      try { await fetch(oldImageUrl, { method: "DELETE" }); } catch (err) {}
    }

    // Dọn dẹp cặn: Xóa phiếu nhập nếu trống không còn sản phẩm nào
    if (shipmentIds.length > 0) {
      for (const sId of shipmentIds) {
        const { count } = await supabase.from("inbound_shipment_items").select("*", { count: "exact", head: true }).eq("shipment_id", sId);
        if (count === 0) {
          await supabase.from("inbound_shipments").delete().eq("id", sId);
        }
      }
    }

    // Dọn dẹp cặn: Xóa phiếu xuất nếu trống không còn sản phẩm nào
    if (orderIds.length > 0) {
      for (const oId of orderIds) {
        const { count } = await supabase.from("order_items").select("*", { count: "exact", head: true }).eq("order_id", oId);
        if (count === 0) {
          await supabase.from("outbound_orders").delete().eq("id", oId);
        }
      }
    }

    res.json({ success: true });
  });

  app.post("/api/upload/product-image", upload.single("file"), async (req, res) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ error: "No file" });
      const formData = new FormData();
      const blob = new Blob([new Uint8Array(file.buffer)], { type: file.mimetype });
      formData.append("file", blob, file.originalname);
      formData.append("folder", "products");
      const workerRes = await fetch(`${R2_WORKER_URL}/upload`, { method: "POST", body: formData });
      const workerData = await workerRes.json() as any;
      if (!workerRes.ok) throw new Error(workerData.error);
      const publicUrl = `${R2_WORKER_URL}/file/${workerData.key}`;
      res.json({ url: publicUrl });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/categories", async (req, res) => {
    const { data, error } = await supabase.from("categories").select("*").order("name");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post("/api/categories", async (req, res) => {
    const { name, default_tax_rate } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "name is required" });
    const insertData: any = { name: name.trim() };
    if (default_tax_rate !== undefined) insertData.default_tax_rate = parseFloat(default_tax_rate) || 0;
    const { data, error } = await supabase.from("categories").insert(insertData).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.put("/api/categories/:id", async (req, res) => {
    const { id } = req.params;
    const { name, default_tax_rate } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "name is required" });
    const updateData: any = { name: name.trim() };
    if (default_tax_rate !== undefined) updateData.default_tax_rate = parseFloat(default_tax_rate) || 0;
    const { data, error } = await supabase.from("categories").update(updateData).eq("id", id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.delete("/api/categories/:id", async (req, res) => {
    const { id } = req.params;
    const { data: check } = await supabase.from("products").select("id").eq("category_id", id).limit(1);
    if (check && check.length > 0) return res.status(400).json({ error: "Dậnh mục đang được sử dụng bởi sản phẩm" });
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  app.get("/api/uoms", async (req, res) => {
    const { data, error } = await supabase.from("uoms").select("*").order("name");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post("/api/uoms", async (req, res) => {
    const { name, symbol } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "name is required" });
    const { data, error } = await supabase.from("uoms").insert({ name: name.trim(), symbol: symbol?.trim() || null }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.put("/api/uoms/:id", async (req, res) => {
    const { id } = req.params;
    const { name, symbol } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "name is required" });
    const { data, error } = await supabase.from("uoms").update({ name: name.trim(), symbol: symbol?.trim() || null }).eq("id", id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.delete("/api/uoms/:id", async (req, res) => {
    const { id } = req.params;
    const { data: check } = await supabase.from("products").select("id").eq("uom_id", id).limit(1);
    if (check && check.length > 0) return res.status(400).json({ error: "Don vị đo đang được sử dụng bởi sản phẩm" });
    const { error } = await supabase.from("uoms").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  // API quản lý nhà kho (CRUD)
  app.get("/api/warehouses", async (req, res) => {
    const { data, error } = await supabase.from("warehouses").select("*").order("name");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post("/api/warehouses", async (req, res) => {
    const { name, code, location, temperature_zone, total_zones, zones_per_row, total_floor_area_sqm, max_capacity_kg, managers_info, status, notes, racks_per_zone, bins_per_rack, bin_capacity_kg, zone_prefix, rack_prefix, bin_prefix, zone_categories, pallet_width_cm, pallet_depth_cm, aisle_width_cm } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });
    try {
      const { data, error } = await supabase.from("warehouses")
        .insert({ name, code: code || null, location, temperature_zone, total_zones: total_zones || 1, zones_per_row, total_floor_area_sqm, max_capacity_kg, managers_info: managers_info || [], status: status || 'active', notes, racks_per_zone, bins_per_rack, bin_capacity_kg, zone_prefix: zone_prefix || 'Z', rack_prefix: rack_prefix || 'R', bin_prefix: bin_prefix || 'B', zone_categories: zone_categories || {}, pallet_width_cm: pallet_width_cm || 100, pallet_depth_cm: pallet_depth_cm || 120, aisle_width_cm: aisle_width_cm || 200 })
        .select();
      if (error) throw error;
      res.json(data?.[0] || { name, location, temperature_zone, total_zones });
    } catch (err: any) {
      console.error("[POST /api/warehouses]", err);
      res.status(500).json({ error: err.message || "Insert failed" });
    }
  });

  app.put("/api/warehouses/:id", async (req, res) => {
    const { id } = req.params;
    const { name, code, location, temperature_zone, total_zones, zones_per_row, total_floor_area_sqm, max_capacity_kg, managers_info, status, notes, racks_per_zone, bins_per_rack, bin_capacity_kg, zone_prefix, rack_prefix, bin_prefix, zone_categories, pallet_width_cm, pallet_depth_cm, aisle_width_cm } = req.body;
    try {
      const { data: existingWh } = await supabase.from("warehouses").select("*").eq("id", id).single();
      if (!existingWh) return res.status(404).json({ error: "Warehouse not found" });
      const gridChanged = (existingWh.total_zones !== total_zones || existingWh.racks_per_zone !== racks_per_zone || existingWh.bins_per_rack !== bins_per_rack || existingWh.bin_capacity_kg !== bin_capacity_kg || existingWh.zone_prefix !== (zone_prefix || 'Z') || existingWh.rack_prefix !== (rack_prefix || 'R') || existingWh.bin_prefix !== (bin_prefix || 'B'));
      const zp = zone_prefix || 'Z'; const rp = rack_prefix || 'R'; const bp = bin_prefix || 'B';
      let locsToDelete: any[] = [];
      let rowsToAdd: any[] = [];
      if (gridChanged) {
        const { data: existingLocs } = await supabase.from("storage_locations").select("id, zone, rack, bin").eq("warehouse_id", id);
        const existingMap = new Map((existingLocs || []).map((l: any) => [`${l.zone}-${l.rack}-${l.bin}`, l]));
        const zonesArr = Array.from({ length: total_zones || 1 }, (_, i) => `${zp}${i + 1}`);
        const expectedMap = new Map();
        for (const zone of zonesArr) {
          for (let r = 1; r <= (racks_per_zone || 3); r++) {
            for (let b = 1; b <= (bins_per_rack || 6); b++) {
              const key = `${zone}-${rp}${r}-${bp}${b}`;
              expectedMap.set(key, true);
              if (!existingMap.has(key)) {
                rowsToAdd.push({ warehouse_id: id, zone, rack: `${rp}${r}`, bin: `${bp}${b}`, capacity: bin_capacity_kg || 5000, status: "active" });
              }
            }
          }
        }
        locsToDelete = (existingLocs || []).filter((l: any) => !expectedMap.has(`${l.zone}-${l.rack}-${l.bin}`));
        if (locsToDelete.length > 0) {
          const locIdsToDelete = locsToDelete.map((l: any) => l.id);
          const { data: inv } = await supabase.from("inventory_items").select("id").in("location_id", locIdsToDelete).gt("quantity", 0).limit(1);
          if (inv && inv.length > 0) {
            return res.status(400).json({ error: "Không thể thu hẹp Sơ đồ vì các vị trí sắp bị xoá vẫn đang có sản phẩm lưu trữ!" });
          }
        }
      }
      const { data, error } = await supabase.from("warehouses")
        .update({ name, code: code || null, location, temperature_zone, total_zones, zones_per_row, total_floor_area_sqm, max_capacity_kg, managers_info: managers_info || [], status, notes, racks_per_zone, bins_per_rack, bin_capacity_kg, zone_prefix: zp, rack_prefix: rp, bin_prefix: bp, zone_categories: zone_categories || {}, pallet_width_cm: pallet_width_cm || 100, pallet_depth_cm: pallet_depth_cm || 120, aisle_width_cm: aisle_width_cm || 200 })
        .eq("id", id).select();
      if (error) throw error;
      if (gridChanged) {
        if (locsToDelete.length > 0) {
          const locIdsToDelete = locsToDelete.map((l: any) => l.id);
          const batchSize = 100;
          for (let i = 0; i < locIdsToDelete.length; i += batchSize) {
            await supabase.from("storage_locations").delete().in("id", locIdsToDelete.slice(i, i + batchSize));
          }
        }
        if (rowsToAdd.length > 0) { await supabase.from("storage_locations").insert(rowsToAdd); }
        if (existingWh.bin_capacity_kg !== bin_capacity_kg) {
          await supabase.from("storage_locations").update({ capacity: bin_capacity_kg }).eq("warehouse_id", id);
        }
      }
      res.json(data?.[0] || { id, name, location, temperature_zone, total_zones });
    } catch (err: any) {
      console.error("[PUT /api/warehouses]", err);
      res.status(500).json({ error: err.message || "Update failed" });
    }
  });

  app.delete("/api/warehouses/:id", async (req, res) => {
    const { id } = req.params;
    try {
      await supabase.from("storage_locations").delete().eq("warehouse_id", id);
      const { error } = await supabase.from("warehouses").delete().eq("id", id);
      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      console.error("[DELETE /api/warehouses]", err);
      res.status(500).json({ error: err.message || "Delete failed" });
    }
  });

  // Tạo sơ đồ vị trí lưu trữ
  app.post("/api/warehouses/:id/generate-locations", async (req, res) => {
    const { id } = req.params;
    const { zones, racks_per_zone, bins_per_rack, capacity, rack_prefix, bin_prefix } = req.body;
    const rp = rack_prefix || 'R'; const bp = bin_prefix || 'B';
    const rows: any[] = [];
    for (const zone of (zones as string[])) {
      for (let r = 1; r <= (racks_per_zone || 3); r++) {
        for (let b = 1; b <= (bins_per_rack || 6); b++) {
          rows.push({ warehouse_id: id, zone, rack: `${rp}${r}`, bin: `${bp}${b}`, capacity: capacity || 5000, status: "active" });
        }
      }
    }
    await supabase.from("storage_locations").delete().eq("warehouse_id", id);
    const { data, error } = await supabase.from("storage_locations").upsert(rows, { onConflict: "warehouse_id,zone,rack,bin" }).select();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ created: (data || []).length });
  });

  // API Quản lý vị trí lưu trữ (CRUD)
  app.get("/api/warehouses/:id/storage-locations", async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabase.from("storage_locations").select("*").eq("warehouse_id", id).order("zone").order("rack").order("bin");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  });

  app.post("/api/storage-locations", async (req, res) => {
    const { warehouse_id, zone, rack, bin, capacity, status } = req.body;
    if (!warehouse_id || !zone) return res.status(400).json({ error: "warehouse_id and zone required" });
    const { data, error } = await supabase.from("storage_locations").insert({ warehouse_id, zone, rack, bin, capacity: capacity || 5000, status: status || "active" }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.put("/api/storage-locations/:id", async (req, res) => {
    const { id } = req.params;
    const { zone, rack, bin, capacity, status } = req.body;
    try {
      const { data, error } = await supabase.from("storage_locations").update({ zone, rack, bin, capacity, status }).eq("id", id).select();
      if (error) throw error;
      res.json(data?.[0] || { id, zone, rack, bin, capacity, status });
    } catch (err: any) { res.status(500).json({ error: err.message || "Update failed" }); }
  });

  app.delete("/api/storage-locations/:id", async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from("storage_locations").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  // ──── QUẢN LÝ NHÀ CUNG CẤP CRUD ────
  app.get("/api/suppliers", async (req, res) => {
    try {
      const { data: suppliers, error } = await supabase.from("suppliers").select("*").order("created_at", { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      // Đính kèm danh mục cho mỗi nhà cung cấp
      const supplierIds = (suppliers || []).map((s: any) => s.id);
      let catMap: Record<string, any[]> = {};
      if (supplierIds.length > 0) {
        const { data: scRows } = await supabase.from("supplier_categories").select("supplier_id, categories(id, name)").in("supplier_id", supplierIds);
        (scRows || []).forEach((row: any) => {
          if (!catMap[row.supplier_id]) catMap[row.supplier_id] = [];
          if (row.categories) catMap[row.supplier_id].push(row.categories);
        });
      }
      const result = (suppliers || []).map((s: any) => ({ ...s, categories: catMap[s.id] || [] }));
      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Liên kết danh mục với nhà cung cấp
  app.get("/api/suppliers/:id/categories", async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabase.from("supplier_categories").select("category_id, categories(id, name)").eq("supplier_id", id);
    if (error) return res.status(500).json({ error: error.message });
    res.json((data || []).map((r: any) => r.categories).filter(Boolean));
  });

  app.post("/api/suppliers/:id/categories", async (req, res) => {
    const { id } = req.params;
    const { category_id } = req.body;
    if (!category_id) return res.status(400).json({ error: "category_id is required" });
    const { data, error } = await supabase.from("supplier_categories").upsert({ supplier_id: id, category_id }, { onConflict: "supplier_id,category_id" }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.delete("/api/suppliers/:id/categories/:catId", async (req, res) => {
    const { id, catId } = req.params;
    const { error } = await supabase.from("supplier_categories").delete().eq("supplier_id", id).eq("category_id", catId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  app.get("/api/suppliers/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const { data: supplier, error } = await supabase.from("suppliers").select("*").eq("id", id).single();
      if (error) throw error;
      if (!supplier) return res.status(404).json({ error: "Supplier not found" });
      // Lấy danh sách phiếu nhập của nhà cung cấp này
      const { data: shipments } = await supabase.from("inbound_shipments")
        .select("*, profiles!inbound_shipments_received_by_fkey(full_name, email)")
        .eq("supplier_id", id)
        .order("created_at", { ascending: false });
      // Lấy số lượng sản phẩm cho mỗi phiếu nhập
      const shipmentIds = (shipments || []).map((s: any) => s.id);
      let itemsMap: Record<string, { count: number; qty: number }> = {};
      if (shipmentIds.length > 0) {
        const { data: items } = await supabase.from("inbound_shipment_items").select("shipment_id, quantity").in("shipment_id", shipmentIds);
        (items || []).forEach((it: any) => {
          if (!itemsMap[it.shipment_id]) itemsMap[it.shipment_id] = { count: 0, qty: 0 };
          itemsMap[it.shipment_id].count++;
          itemsMap[it.shipment_id].qty += Number(it.quantity);
        });
      }
      const enrichedShipments = (shipments || []).map((s: any) => ({ ...s, item_count: itemsMap[s.id]?.count || 0, total_quantity: itemsMap[s.id]?.qty || 0 }));
      
      // Lấy danh sách danh mục của nhà cung cấp này
      const { data: scRows } = await supabase.from("supplier_categories").select("categories(id, name)").eq("supplier_id", id);
      const categories = (scRows || []).map((r: any) => r.categories).filter(Boolean);

      res.json({ ...supplier, shipments: enrichedShipments, categories });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/suppliers", async (req, res) => {
    const { name, bank_name, bank_account, email, phone, address, website, notes, status } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Tên nhà cung cấp là bắt buộc" });
    try {
      const { data, error } = await supabase.from("suppliers")
        .insert({ name: name.trim(), bank_name, bank_account, email, phone, address, website, notes, status: status || "active" })
        .select().single();
      if (error) throw error;
      res.json(data);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.put("/api/suppliers/:id", async (req, res) => {
    const { id } = req.params;
    const { name, bank_name, bank_account, email, phone, address, website, notes, status } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Tên nhà cung cấp là bắt buộc" });
    try {
      const { data, error } = await supabase.from("suppliers")
        .update({ name: name.trim(), bank_name, bank_account, email, phone, address, website, notes, status })
        .eq("id", id).select().single();
      if (error) throw error;
      res.json(data);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete("/api/suppliers/:id", async (req, res) => {
    const { id } = req.params;
    try {
      // Check if supplier has linked shipments
      const { data: linked } = await supabase.from("inbound_shipments").select("id").eq("supplier_id", id).limit(1);
      if (linked && linked.length > 0) {
        return res.status(400).json({ error: "Không thể xóa nhà cung cấp đang có phiếu nhập liên kết. Hãy chuyển trạng thái sang 'Ngừng hoạt động' thay vì xóa." });
      }
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Tồn kho
  app.get("/api/inventory", async (req, res) => {
    const { data, error } = await supabase.from("inventory").select("*, products(*, categories(*), uoms(*)), storage_locations(*, warehouses(*)), batches(*)");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // Dữ liệu vị trí kho kèm theo thông tin tồn kho cho Bản đồ
  app.get("/api/warehouses/:id/locations", async (req, res) => {
    const { id } = req.params;
    try {
      const { data: locations, error: locErr } = await supabase.from("storage_locations").select("*").eq("warehouse_id", id).order("zone").order("rack").order("bin");
      if (locErr) throw locErr;
      const { data: inventory, error: invErr } = await supabase.from("inventory").select("*, products(name, sku), batches(lot_number, expiry_date, qc_status)").eq("warehouse_id", id);
      if (invErr) throw invErr;
      const result = (locations || []).map((loc: any) => {
        const items = (inventory || []).filter((inv: any) => inv.location_id === loc.id).map((inv: any) => ({
          product_id: inv.product_id, batch_id: inv.batch_id,
          product_name: inv.products?.name || "—", sku: inv.products?.sku || "—", quantity: Number(inv.quantity),
          lot_number: inv.batches?.lot_number || inv.batch_number || "—", expiry_date: inv.batches?.expiry_date || inv.expiry_date, qc_status: inv.batches?.qc_status || "Hold",
        }));
        const total_quantity = items.reduce((sum: number, i: any) => sum + i.quantity, 0);
        const capacity = loc.capacity || 5000;
        // Kiểm tra trộn lô: ô chứa ≥2 product_id khác hoặc cùng product nhưng khác expiry_date
        const uniqueProducts = [...new Set(items.filter((i: any) => i.quantity > 0).map((i: any) => i.product_id))];
        const uniqueExpiries = [...new Set(items.filter((i: any) => i.quantity > 0).map((i: any) => `${i.product_id}__${i.expiry_date || 'none'}`))];
        const is_mixed = uniqueProducts.length > 1 || uniqueExpiries.length > uniqueProducts.length;
        return { ...loc, inventory_items: items, total_quantity, utilization: Math.min(100, Math.round((total_quantity / capacity) * 100)), is_mixed };
      });
      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/storage-locations", async (req, res) => {
    const { data, error } = await supabase.from("storage_locations").select("*, warehouses(*)").order("zone").order("rack").order("bin");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // Danh mục sản phẩm
  app.get("/api/categories", async (req, res) => {
    const { data, error } = await supabase.from("categories").select("*").order("name");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // ──── NHẬT KÝ HOẠT ĐỘNG ────
  app.get("/api/activities", async (req, res) => {
    try {
      const { data: acts, error } = await supabase
        .from("activities")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;

      // Làm giàu dữ liệu với tên sản phẩm, tên kho và tên người dùng tương ứng
      const productIds = [...new Set((acts || []).map((a: any) => a.product_id).filter(Boolean))];
      const warehouseIds = [...new Set((acts || []).flatMap((a: any) => [a.warehouse_id, a.to_warehouse_id]).filter(Boolean))];
      const profileIds = [...new Set((acts || []).map((a: any) => a.performed_by).filter(Boolean))];

      let productsMap: Record<string, any> = {};
      let warehousesMap: Record<string, any> = {};
      let profilesMap: Record<string, any> = {};

      if (productIds.length > 0) {
        const { data: prods } = await supabase.from("products").select("id, name, sku, uoms(name, abbreviation)").in("id", productIds);
        (prods || []).forEach((p: any) => { productsMap[p.id] = p; });
      }
      if (warehouseIds.length > 0) {
        const { data: whs } = await supabase.from("warehouses").select("id, name, code").in("id", warehouseIds);
        (whs || []).forEach((w: any) => { warehousesMap[w.id] = w; });
      }
      if (profileIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", profileIds);
        (profs || []).forEach((p: any) => { profilesMap[p.id] = p; });
      }

      // Làm giàu thông tin batch (lô hàng, hạn dùng, hợp đồng, quy cách)
      const batchNumbers = [...new Set((acts || []).map((a: any) => a.batch_number).filter(Boolean))];
      let batchesMap: Record<string, any> = {};
      if (batchNumbers.length > 0) {
        const { data: batches } = await supabase.from("batches")
          .select("lot_number, expiry_date, production_date, notes")
          .in("lot_number", batchNumbers);
        (batches || []).forEach((b: any) => { batchesMap[b.lot_number] = b; });
      }

      const result = (acts || []).map((a: any) => ({
        ...a,
        products: productsMap[a.product_id] || null,
        warehouses: warehousesMap[a.warehouse_id] || null,
        to_warehouses: warehousesMap[a.to_warehouse_id] || null,
        profiles: profilesMap[a.performed_by] || null,
        batch_details: batchesMap[a.batch_number] || null,
      }));

      res.json(result);
    } catch (err: any) {
      console.error("[GET /api/activities]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ──── BÁO CÁO XUẤT NHẬP TỒN (Inventory Balance) ────
  app.get("/api/inventory-balance", async (req, res) => {
    try {
      const startDateStr = req.query.startDate as string;
      const endDateStr = req.query.endDate as string;
      
      if (!startDateStr || !endDateStr) {
        return res.status(400).json({ error: "startDate and endDate are required" });
      }

      const startDate = new Date(startDateStr).getTime();
      const endDate = new Date(endDateStr).getTime() + 86400000; // include the whole day

      // 1. Fetch all products and warehouses
      const [{ data: products, error: prodErr }, { data: warehouses }] = await Promise.all([
        supabase.from("products").select("id, name, sku, category_id, uoms(name, abbreviation), categories(name)"),
        supabase.from("warehouses").select("id, name, code")
      ]);
      if (prodErr) throw prodErr;

      const productsMap = new Map((products || []).map((p: any) => [p.id, p]));
      const warehousesMap = new Map((warehouses || []).map((w: any) => [w.id, w]));

      // 2. Fetch completed activities related to inbound and outbound up to endDate
      const endIso = new Date(endDate).toISOString();
      let allActivities: any[] = [];
      let page = 0;
      const pageSize = 1000;
      
      while (true) {
        const { data: acts, error: actErr } = await supabase
          .from("activities")
          .select("product_id, warehouse_id, to_warehouse_id, batch_number, type, quantity, created_at")
          .eq("status", "completed")
          .in("type", ["inbound", "outbound", "transfer"])
          .lte("created_at", endIso)
          .range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (actErr) throw actErr;
        if (!acts || acts.length === 0) break;
        allActivities = allActivities.concat(acts);
        if (acts.length < pageSize) break;
        page++;
      }

      // Fetch batches to extract contract_number
      let contractMap: Record<string, string> = {};
      const batchNumbers = Array.from(new Set(allActivities.map(a => a.batch_number).filter(Boolean)));
      if (batchNumbers.length > 0) {
        const chunk = 500;
        for (let i = 0; i < batchNumbers.length; i += chunk) {
           const batchChunk = batchNumbers.slice(i, i + chunk);
           const { data: batches } = await supabase.from("batches").select("lot_number, notes").in("lot_number", batchChunk);
           (batches || []).forEach((b: any) => {
             if (b.notes) {
                try {
                   const parsed = JSON.parse(b.notes);
                   if (parsed.contract_number) contractMap[b.lot_number] = String(parsed.contract_number);
                } catch {}
             }
           });
        }
      }

      // Compute aggregates grouped by Product + Warehouse + Batch
      let statsMap: Record<string, { product_id: string; warehouse_id: string; batch_number: string; opening_qty: number; in_qty: number; out_qty: number; closing_qty: number }> = {};
      
      for (const act of allActivities) {
        const pId = act.product_id;
        const bNum = act.batch_number || "";
        const actTime = new Date(act.created_at).getTime();
        const qty = Number(act.quantity || 0);

        // Helper func để xử lý giao dịch cho từng kho cụ thể
        const processRecord = (wId: string, roleType: "inbound" | "outbound") => {
          const key = `${pId}_${wId}_${bNum}`;
          if (!statsMap[key]) {
            statsMap[key] = { product_id: pId, warehouse_id: wId, batch_number: bNum, opening_qty: 0, in_qty: 0, out_qty: 0, closing_qty: 0 };
          }
          if (actTime < startDate) {
            // Tồn đầu kỳ
            if (roleType === "inbound") statsMap[key].opening_qty += qty;
            else if (roleType === "outbound") statsMap[key].opening_qty -= qty;
          } else if (actTime >= startDate && actTime <= endDate) {
            // Phát sinh trong kỳ
            if (roleType === "inbound") statsMap[key].in_qty += qty;
            else if (roleType === "outbound") statsMap[key].out_qty += qty;
          }
        };

        if (act.type === "inbound") {
          processRecord(act.warehouse_id || "unknown", "inbound");
        } else if (act.type === "outbound") {
          processRecord(act.warehouse_id || "unknown", "outbound");
        } else if (act.type === "transfer") {
          // Điều chuyển bản chất là Xuất ở Kho Đi và Nhập ở Kho Đến
          if (act.warehouse_id) processRecord(act.warehouse_id, "outbound");
          if (act.to_warehouse_id) processRecord(act.to_warehouse_id, "inbound");
        }
      }

      // Combine and formulate final array
      const results = Object.values(statsMap).map((stats) => {
        const p = productsMap.get(stats.product_id) || {} as any;
        const w = warehousesMap.get(stats.warehouse_id) || {} as any;
        
        stats.closing_qty = stats.opening_qty + stats.in_qty - stats.out_qty;
        
        return {
          product_id: stats.product_id,
          product_name: p.name || "Sản phẩm không xác định",
          sku: p.sku || "",
          category: p.categories?.name || p.category_id || "",
          uom: p.uoms?.abbreviation || p.uoms?.name || "kg",
          warehouse_name: w.name || "Kho không xác định",
          warehouse_code: w.code || "",
          batch_number: stats.batch_number,
          contract_number: contractMap[stats.batch_number] || "",
          opening_qty: stats.opening_qty,

          in_qty: stats.in_qty,
          out_qty: stats.out_qty,
          closing_qty: stats.closing_qty
        };
      });

      // Filter out products that have absolutely 0 in all metrics to keep report clean
      const cleanResults = results.filter(r => r.opening_qty !== 0 || r.in_qty !== 0 || r.out_qty !== 0 || r.closing_qty !== 0);

      res.json(cleanResults);
    } catch (err: any) {
      console.error("[GET /api/inventory-balance]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ──── TÌM KIẾM TOÀN CỤC (Global Search) ────

  app.get("/api/search", async (req, res) => {
    const q = (req.query.q as string || "").toLowerCase().trim();
    if (!q || q.length < 1) return res.json([]);
    
    // Tách keyword theo dấu phẩy hoặc khoảng trắng
    const keywords = q.split(/[,\s]+/).filter(k => k.length > 0);
    const matchAll = (text: string) => keywords.every(kw => text.toLowerCase().includes(kw));
    
    try {
      const results: { type: string; id: string; title: string; subtitle: string; icon: string }[] = [];
      
      // 1. Sản phẩm
      const { data: products } = await supabase.from("products")
        .select("id, name, sku, categories(name)").limit(200);
      (products || []).forEach((p: any) => {
        const text = [p.name, p.sku, p.categories?.name].filter(Boolean).join(" ");
        if (matchAll(text)) results.push({ type: "product", id: p.id, title: p.name, subtitle: p.sku || "", icon: "📦" });
      });
      
      // 2. Nhà cung cấp
      const { data: suppliers } = await supabase.from("suppliers")
        .select("id, name, phone, email, address").limit(200);
      (suppliers || []).forEach((s: any) => {
        const text = [s.name, s.phone, s.email, s.address].filter(Boolean).join(" ");
        if (matchAll(text)) results.push({ type: "supplier", id: s.id, title: s.name, subtitle: s.phone || s.email || "", icon: "🚚" });
      });
      
      // 3. Khách hàng
      const { data: customers } = await supabase.from("customers")
        .select("id, name, phone, email").limit(200);
      (customers || []).forEach((c: any) => {
        const text = [c.name, c.phone, c.email].filter(Boolean).join(" ");
        if (matchAll(text)) results.push({ type: "customer", id: c.id, title: c.name, subtitle: c.phone || c.email || "", icon: "👥" });
      });
      
      // 4. Kho hàng
      const { data: warehouses } = await supabase.from("warehouses")
        .select("id, name, code, location, notes, temperature_zone").limit(100);
      (warehouses || []).forEach((w: any) => {
        const text = [w.name, w.code, w.location, w.notes, w.temperature_zone].filter(Boolean).join(" ");
        if (matchAll(text)) results.push({ type: "warehouse", id: w.id, title: w.name, subtitle: [w.code, w.location].filter(Boolean).join(" • "), icon: "🏭" });
      });
      
      // 5. Phiếu nhập kho
      const { data: shipments } = await supabase.from("inbound_shipments")
        .select("id, supplier_name, notes, status, created_at").limit(200);
      (shipments || []).forEach((s: any) => {
        const text = [s.supplier_name, s.id, s.notes].filter(Boolean).join(" ");
        if (matchAll(text)) results.push({ type: "inbound", id: s.id, title: s.supplier_name || "Phiếu nhập", subtitle: `#${s.id.slice(0, 8)} • ${s.status}`, icon: "📥" });
      });
      
      // 6. Phiếu xuất kho
      const { data: orders } = await supabase.from("outbound_orders")
        .select("id, customer_name, notes, status, created_at").limit(200);
      (orders || []).forEach((o: any) => {
        const text = [o.customer_name, o.id, o.notes].filter(Boolean).join(" ");
        if (matchAll(text)) results.push({ type: "outbound", id: o.id, title: o.customer_name || "Phiếu xuất", subtitle: `#${o.id.slice(0, 8)} • ${o.status}`, icon: "📤" });
      });
      
      res.json(results.slice(0, 20)); // Tối đa 20 kết quả
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ──── PHIẾU NHẬP KHO ────

  app.get("/api/inbound-shipments", async (req, res) => {
    try {
      const { data: shipments, error } = await supabase.from("inbound_shipments")
        .select("*, suppliers(name, phone)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = (shipments || []).map((s: any) => s.id);
      let itemsMap: Record<string, { count: number; qty: number; searchParts: string[] }> = {};
      if (ids.length > 0) {
        const { data: items } = await supabase.from("inbound_shipment_items")
          .select("shipment_id, quantity, products(name, sku), batches(lot_number, notes), warehouses(name, code)")
          .in("shipment_id", ids);
        (items || []).forEach((it: any) => {
          if (!itemsMap[it.shipment_id]) itemsMap[it.shipment_id] = { count: 0, qty: 0, searchParts: [] };
          itemsMap[it.shipment_id].count++;
          itemsMap[it.shipment_id].qty += Number(it.quantity);
          // Collect searchable text from items
          if (it.products?.sku) itemsMap[it.shipment_id].searchParts.push(it.products.sku);
          if (it.products?.name) itemsMap[it.shipment_id].searchParts.push(it.products.name);
          if (it.batches?.lot_number) itemsMap[it.shipment_id].searchParts.push(it.batches.lot_number);
          if (it.warehouses?.code) itemsMap[it.shipment_id].searchParts.push(it.warehouses.code);
          if (it.warehouses?.name) itemsMap[it.shipment_id].searchParts.push(it.warehouses.name);
          if (it.batches?.notes) {
            try {
              const n = JSON.parse(it.batches.notes);
              if (n.contract_number) itemsMap[it.shipment_id].searchParts.push(n.contract_number);
              if (n.packaging_spec) itemsMap[it.shipment_id].searchParts.push(n.packaging_spec);
            } catch {}
          }
        });
      }
      
      // Lấy thông tin user nhận hàng
      const userIds = [...new Set((shipments || []).map((s: any) => s.received_by).filter(Boolean))];
      let profilesMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
        (profiles || []).forEach((p: any) => { profilesMap[p.id] = p.full_name; });
      }
      
      const result = (shipments || []).map((s: any) => {
        const creatorName = profilesMap[s.received_by] || "";
        const searchParts = itemsMap[s.id]?.searchParts || [];
        searchParts.push(s.supplier_name || "", creatorName, s.id, s.notes || "", "TKA");
        // Thêm chữ viết tắt tên người tạo (HPT = Huỳnh Phú Trọng)
        if (creatorName) {
          searchParts.push(creatorName.split(" ").map((w: string) => w.charAt(0)).join(""));
        }
        return { 
          ...s, 
          item_count: itemsMap[s.id]?.count || 0, 
          total_quantity: itemsMap[s.id]?.qty || 0,
          creator_name: creatorName || null,
          search_text: searchParts.join(" ").toLowerCase()
        };
      });
      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/inbound-shipments/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { data: shipment, error } = await supabase.from("inbound_shipments")
        .select("*, suppliers(name, phone), profiles!inbound_shipments_received_by_fkey(full_name, email)")
        .eq("id", id).single();
      if (error) throw error;
      const { data: items } = await supabase.from("inbound_shipment_items")
        .select("*, products(name, sku, image_url, categories(name), uoms(name, abbreviation)), batches(lot_number, expiry_date, qc_status, production_date, notes), warehouses(name), storage_locations(zone, rack, bin)")
        .eq("shipment_id", id);
      res.json({ ...shipment, items: items || [] });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/inbound-shipments", async (req, res) => {
    const { supplier_id, supplier_name, notes, received_by } = req.body;
    try {
      const { data, error } = await supabase.from("inbound_shipments")
        .insert({ supplier_id, supplier_name, notes, received_by, status: "pending" }).select().single();
      if (error) throw error;
      res.json(data);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/inbound-shipments/:id/items", async (req, res) => {
    const { id } = req.params;
    const { product_id, quantity, lot_number, production_date, expiry_date, qc_status, warehouse_id, location_id, user_id, cost_price, tax_rate, import_fee, notes, allow_mix } = req.body;
    try {
      // ── Kiểm tra quy tắc chống trộn lô (Mức B: cùng product + cùng expiry) ──
      if (location_id) {
        const { data: locInventory } = await supabase.from("inventory").select("product_id, expiry_date, quantity").eq("location_id", location_id).gt("quantity", 0);
        if (locInventory && locInventory.length > 0) {
          const incompatible = locInventory.some((inv: any) => {
            if (inv.product_id !== product_id) return true;
            const invExp = inv.expiry_date ? new Date(inv.expiry_date).toISOString().slice(0, 10) : null;
            const newExp = expiry_date ? new Date(expiry_date).toISOString().slice(0, 10) : null;
            return invExp !== newExp;
          });
          if (incompatible && !allow_mix) {
            return res.status(400).json({ error: "BIN_MIX_CONFLICT", message: "Ô này đang chứa sản phẩm/hạn khác. Vui lòng chọn ô khác hoặc xác nhận trộn lô." });
          }
        }
      }

      const { data: batch, error: batchErr } = await supabase.from("batches")
        .upsert({ lot_number, product_id, supplier_id: null, production_date: production_date || null, expiry_date: expiry_date || null, qc_status: qc_status || "Hold", notes: notes || null }, { onConflict: 'lot_number' })
        .select().single();
      if (batchErr) throw batchErr;
      const { data: shipment } = await supabase.from("inbound_shipments").select("supplier_id").eq("id", id).single();
      if (shipment?.supplier_id) { await supabase.from("batches").update({ supplier_id: shipment.supplier_id }).eq("id", batch.id); }
      const { data: existingInv } = await supabase.from("inventory").select("id, quantity").eq("product_id", product_id).eq("warehouse_id", warehouse_id).eq("batch_id", batch.id).maybeSingle();
      if (existingInv) {
        await supabase.from("inventory").update({ quantity: Number(existingInv.quantity) + Number(quantity), location_id, expiry_date, batch_number: lot_number }).eq("id", existingInv.id);
      } else {
        const { error: invErr } = await supabase.from("inventory").insert({ product_id, warehouse_id, location_id, batch_id: batch.id, quantity, batch_number: lot_number, expiry_date });
        if (invErr) throw invErr;
      }
      await supabase.from("stock_movements").insert({ product_id, batch_id: batch.id, from_location_id: null, to_location_id: location_id, quantity, movement_type: "inbound", user_id: user_id || null });
      await supabase.from("activities").insert({ type: "inbound", product_id, warehouse_id, quantity, batch_number: lot_number, status: "completed", performed_by: user_id || null, notes: `Nhập kho từ phiếu #${id.slice(0, 8)}` });
      const { data: item, error: itemErr } = await supabase.from("inbound_shipment_items")
        .insert({ shipment_id: id, product_id, batch_id: batch.id, warehouse_id, location_id, quantity, cost_price: cost_price || 0, tax_rate: tax_rate || 0, import_fee: import_fee || 0 })
        .select("*, products(name, sku), batches(lot_number, expiry_date, qc_status, production_date, notes), warehouses(name), storage_locations(zone, rack, bin)")
        .single();
      if (itemErr) throw itemErr;
      res.json(item);
    } catch (err: any) {
      console.error("[POST /api/inbound-shipments/:id/items]", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/inbound-shipments/:id/complete", async (req, res) => {
    const { id } = req.params;
    try {
      const { data, error } = await supabase.from("inbound_shipments")
        .update({ status: "completed", received_at: new Date().toISOString() }).eq("id", id).select().single();
      if (error) throw error;
      res.json(data);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/warehouses/:id/available-locations", async (req, res) => {
    const { id } = req.params;
    try {
      const { data: locations, error: locErr } = await supabase.from("storage_locations").select("*").eq("warehouse_id", id).eq("status", "active").order("zone").order("rack").order("bin");
      if (locErr) throw locErr;
      const { data: inventory } = await supabase.from("inventory").select("location_id, quantity, product_id, expiry_date, batch_id, products(name), batches(lot_number, production_date, notes)").eq("warehouse_id", id);
      const usageMap: Record<string, number> = {};
      const existingItemsMap: Record<string, { product_id: string; product_name: string; expiry_date: string | null; lot_number: string | null; contract_number: string | null; production_date: string | null; quantity: number }[]> = {};
      (inventory || []).forEach((inv: any) => {
        if (!inv.location_id) return;
        usageMap[inv.location_id] = (usageMap[inv.location_id] || 0) + Number(inv.quantity);
        if (Number(inv.quantity) > 0) {
          if (!existingItemsMap[inv.location_id]) existingItemsMap[inv.location_id] = [];
          // Parse contract_number from batches.notes JSON
          let contractNumber: string | null = null;
          try {
            const notesObj = inv.batches?.notes ? (typeof inv.batches.notes === "string" ? JSON.parse(inv.batches.notes) : inv.batches.notes) : null;
            contractNumber = notesObj?.contract_number || null;
          } catch {}
          existingItemsMap[inv.location_id].push({
            product_id: inv.product_id,
            product_name: (inv.products as any)?.name || "",
            expiry_date: inv.expiry_date || null,
            lot_number: inv.batches?.lot_number || null,
            contract_number: contractNumber,
            production_date: inv.batches?.production_date || null,
            quantity: Number(inv.quantity),
          });
        }
      });
      const result = (locations || []).map((loc: any) => ({
        ...loc, current_quantity: usageMap[loc.id] || 0, capacity: loc.capacity || 5000,
        remaining_capacity: (loc.capacity || 5000) - (usageMap[loc.id] || 0),
        existing_items: existingItemsMap[loc.id] || [],
      })).filter((loc: any) => loc.remaining_capacity > 0);
      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Di chuyển hàng hóa — Điều chuyển
  app.post("/api/movements", async (req, res) => {
    const { product_id, batch_id, from_location_id, to_location_id, quantity, movement_type, user_id, notes, from_warehouse_id, to_warehouse_id, allow_mix, expiry_date } = req.body;
    try {
      // Kiểm tra tính hợp lệ
      if (!product_id || !from_location_id || !to_location_id || !quantity || quantity <= 0) {
        return res.status(400).json({ error: "Thiếu thông tin: product_id, from/to location, quantity" });
      }
      if (from_location_id === to_location_id) {
        return res.status(400).json({ error: "Vị trí nguồn và đích không được trùng nhau" });
      }

      // ── Kiểm tra quy tắc chống trộn lô tại ô đích ──
      const { data: destExisting } = await supabase.from("inventory").select("product_id, expiry_date, quantity").eq("location_id", to_location_id).gt("quantity", 0);
      if (destExisting && destExisting.length > 0) {
        const movingExp = expiry_date ? new Date(expiry_date).toISOString().slice(0, 10) : null;
        const incompatible = destExisting.some((inv: any) => {
          if (inv.product_id !== product_id) return true;
          const invExp = inv.expiry_date ? new Date(inv.expiry_date).toISOString().slice(0, 10) : null;
          return invExp !== movingExp;
        });
        if (incompatible && !allow_mix) {
          return res.status(400).json({ error: "BIN_MIX_CONFLICT", message: "Ô đích đang chứa sản phẩm/hạn khác. Xác nhận trộn lô để tiếp tục." });
        }
      }

      // Kiểm tra lượng tồn kho tại nguồn có đủ không
      const { data: srcInv } = await supabase.from("inventory")
        .select("id, quantity")
        .eq("product_id", product_id)
        .eq("location_id", from_location_id)
        .eq("batch_id", batch_id)
        .maybeSingle();
      if (!srcInv || Number(srcInv.quantity) < quantity) {
        return res.status(400).json({ error: `Tồn kho không đủ. Hiện có: ${srcInv?.quantity || 0}, cần: ${quantity}` });
      }

      // Tạo bản ghi di chuyển hàng
      const { data: movement, error: moveError } = await supabase.from("stock_movements")
        .insert({ product_id, batch_id, from_location_id, to_location_id, quantity, movement_type: movement_type || "transfer", user_id: user_id || null, notes: notes || null })
        .select()
        .single();
      if (moveError) throw moveError;

      // Cập nhật tồn kho: Giảm số lượng ở vị trí nguồn
      const newSrcQty = Number(srcInv.quantity) - quantity;
      if (newSrcQty <= 0) {
        await supabase.from("inventory").delete().eq("id", srcInv.id);
      } else {
        await supabase.from("inventory").update({ quantity: newSrcQty }).eq("id", srcInv.id);
      }

      // Cập nhật tồn kho: Tăng số lượng ở vị trí đích
      const { data: destInv } = await supabase.from("inventory")
        .select("id, quantity")
        .eq("product_id", product_id)
        .eq("location_id", to_location_id)
        .eq("batch_id", batch_id)
        .maybeSingle();
      if (destInv) {
        await supabase.from("inventory").update({ quantity: Number(destInv.quantity) + quantity }).eq("id", destInv.id);
      } else {
        await supabase.from("inventory").insert({
          product_id, warehouse_id: to_warehouse_id || from_warehouse_id, location_id: to_location_id, batch_id,
          quantity, batch_number: null, expiry_date: null,
        });
      }

      // Ghi nhật ký hoạt động
      await supabase.from("activities").insert({
        type: "transfer", product_id, warehouse_id: from_warehouse_id || null, to_warehouse_id: to_warehouse_id || null,
        quantity, batch_number: null, status: "completed", performed_by: user_id || null,
        notes: notes || `Điều chuyển ${quantity} kg`,
      });

      res.json(movement);
    } catch (err: any) {
      console.error("[POST /api/movements]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Lịch sử điều chuyển
  app.get("/api/movements", async (req, res) => {
    try {
      const { data: movements, error } = await supabase.from("stock_movements")
        .select("*")
        .eq("movement_type", "transfer")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;

      // Làm giàu dữ liệu với tên sản phẩm, nhãn vị trí
      const productIds = [...new Set((movements || []).map((m: any) => m.product_id).filter(Boolean))];
      const locationIds = [...new Set((movements || []).flatMap((m: any) => [m.from_location_id, m.to_location_id]).filter(Boolean))];

      let productsMap: Record<string, any> = {};
      let locationsMap: Record<string, any> = {};

      if (productIds.length > 0) {
        const { data: prods } = await supabase.from("products").select("id, name, sku").in("id", productIds);
        (prods || []).forEach((p: any) => { productsMap[p.id] = p; });
      }
      if (locationIds.length > 0) {
        const { data: locs } = await supabase.from("storage_locations").select("id, zone, rack, bin, warehouse_id, warehouses(name)").in("id", locationIds);
        (locs || []).forEach((l: any) => { locationsMap[l.id] = l; });
      }

      const enriched = (movements || []).map((m: any) => ({
        ...m,
        product: productsMap[m.product_id] || null,
        from_location: locationsMap[m.from_location_id] || null,
        to_location: locationsMap[m.to_location_id] || null,
      }));

      res.json(enriched);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ──── CUSTOMERS CRUD ────
  app.get("/api/customers", async (req, res) => {
    try {
      const { data, error } = await supabase.from("customers").select("*").order("created_at", { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      res.json(data || []);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/customers/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const { data: customer, error } = await supabase.from("customers").select("*").eq("id", id).single();
      if (error) throw error;
      if (!customer) return res.status(404).json({ error: "Customer not found" });
      // Get outbound orders for this customer
      const { data: orders } = await supabase.from("outbound_orders")
        .select("*")
        .eq("customer_id", id)
        .order("created_at", { ascending: false });
      // Get item counts for each order
      const orderIds = (orders || []).map((o: any) => o.id);
      let itemsMap: Record<string, { count: number; qty: number }> = {};
      if (orderIds.length > 0) {
        const { data: items } = await supabase.from("order_items").select("order_id, quantity_requested").in("order_id", orderIds);
        (items || []).forEach((it: any) => {
          if (!itemsMap[it.order_id]) itemsMap[it.order_id] = { count: 0, qty: 0 };
          itemsMap[it.order_id].count++;
          itemsMap[it.order_id].qty += Number(it.quantity_requested);
        });
      }
      const enrichedOrders = (orders || []).map((o: any) => ({ ...o, item_count: itemsMap[o.id]?.count || 0, total_quantity: itemsMap[o.id]?.qty || 0 }));
      res.json({ ...customer, orders: enrichedOrders });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/customers", async (req, res) => {
    const { name, contact_person, email, phone, address, status, notes } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Tên khách hàng là bắt buộc" });
    try {
      const { data, error } = await supabase.from("customers")
        .insert({ name: name.trim(), contact_person, email, phone, address, status: status || "active", notes })
        .select().single();
      if (error) throw error;
      res.json(data);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.put("/api/customers/:id", async (req, res) => {
    const { id } = req.params;
    const { name, contact_person, email, phone, address, status, notes } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Tên khách hàng là bắt buộc" });
    try {
      const { data, error } = await supabase.from("customers")
        .update({ name: name.trim(), contact_person, email, phone, address, status, notes })
        .eq("id", id).select().single();
      if (error) throw error;
      res.json(data);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete("/api/customers/:id", async (req, res) => {
    const { id } = req.params;
    try {
      // Check if customer has linked outbound orders
      const { data: linked } = await supabase.from("outbound_orders").select("id").eq("customer_id", id).limit(1);
      if (linked && linked.length > 0) {
        return res.status(400).json({ error: "Không thể xóa khách hàng đang có đơn hàng xuất liên kết. Hãy chuyển trạng thái sang 'Ngừng hoạt động'." });
      }
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ──── OUTBOUND ORDERS ────
  app.get("/api/outbound-orders", async (req, res) => {
    try {
      const { data: orders, error } = await supabase.from("outbound_orders")
        .select("*, customers(name, email, phone)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      
      const ids = (orders || []).map((o: any) => o.id);
      let itemsMap: Record<string, { count: number; qty: number }> = {};
      if (ids.length > 0) {
        const { data: items } = await supabase.from("order_items").select("order_id, quantity_requested").in("order_id", ids);
        (items || []).forEach((it: any) => {
          if (!itemsMap[it.order_id]) itemsMap[it.order_id] = { count: 0, qty: 0 };
          itemsMap[it.order_id].count++;
          itemsMap[it.order_id].qty += Number(it.quantity_requested);
        });
      }
      
      // Fetch profiles for created_by
      const userIds = [...new Set((orders || []).map((o: any) => o.created_by).filter(Boolean))];
      let profilesMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
        (profiles || []).forEach((p: any) => { profilesMap[p.id] = p.full_name; });
      }
      
      const enriched = (orders || []).map((o: any) => ({ 
        ...o, 
        item_count: itemsMap[o.id]?.count || 0, 
        total_quantity: itemsMap[o.id]?.qty || 0,
        creator_name: profilesMap[o.created_by] || null
      }));
      res.json(enriched);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/outbound-orders/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const { data: order, error } = await supabase.from("outbound_orders")
        .select("*, customers(name, email, phone)")
        .eq("id", id).single();
      if (error) throw error;
      
      // Fetch creator profile
      let creator_name = null;
      if (order.created_by) {
        const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", order.created_by).single();
        creator_name = profile?.full_name || null;
      }
      
      const { data: items } = await supabase.from("order_items")
        .select("*, products(name, sku, image_url, categories(name)), batches(lot_number, expiry_date, qc_status, origin)")
        .eq("order_id", id);
        
      res.json({ ...order, creator_name, items: items || [] });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/outbound-orders", async (req, res) => {
    const { customer_id, customer_name, shipping_address, notes, created_by } = req.body;
    try {
      const { data, error } = await supabase.from("outbound_orders")
        .insert({ customer_id, customer_name, shipping_address, notes, created_by, status: "pending" })
        .select().single();
      if (error) throw error;
      res.json(data);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/outbound-orders/:id/items", async (req, res) => {
    const { id } = req.params;
    const { product_id, batch_id, quantity, user_id } = req.body;
    try {
      const { data: inventory } = await supabase.from("inventory")
        .select("id, quantity, location_id, warehouse_id, batch_number")
        .eq("product_id", product_id)
        .eq("batch_id", batch_id)
        .gt("quantity", 0);
        
      if (!inventory || inventory.length === 0) {
        return res.status(400).json({ error: "Không tìm thấy tồn kho cho lô hàng này" });
      }
      
      let remaining = Number(quantity);
      for (const inv of inventory) {
        if (remaining <= 0) break;
        
        const take = Math.min(Number(inv.quantity), remaining);
        remaining -= take;
        
        if (take === Number(inv.quantity)) {
          await supabase.from("inventory").delete().eq("id", inv.id);
        } else {
          await supabase.from("inventory").update({ quantity: Number(inv.quantity) - take }).eq("id", inv.id);
        }
        
        if (inv.location_id) {
          await supabase.from("stock_movements").insert({
            product_id, batch_id, 
            from_location_id: inv.location_id, to_location_id: null, 
            quantity: take, movement_type: "outbound", 
            user_id: user_id || null 
          });
        }
        
        await supabase.from("activities").insert({ 
          type: "outbound", product_id, warehouse_id: inv.warehouse_id, 
          quantity: take, batch_number: inv.batch_number, 
          status: "completed", performed_by: user_id || null, 
          notes: `Xuất kho cho phiếu #${id.slice(0, 8)}` 
        });
      }
      
      if (remaining > 0) {
         return res.status(400).json({ error: "Không đủ số lượng trong kho" });
      }

      const { data: item, error: itemErr } = await supabase.from("order_items")
        .insert({ 
          order_id: id, product_id, batch_id, 
          quantity_requested: quantity, quantity_allocated: quantity 
        })
        .select("*, products(name, sku), batches(lot_number, expiry_date)")
        .single();
        
      if (itemErr) throw itemErr;
      
      res.json(item);
    } catch (err: any) { 
      res.status(500).json({ error: err.message }); 
    }
  });

  app.put("/api/outbound-orders/:id/complete", async (req, res) => {
    const { id } = req.params;
    try {
      const { data, error } = await supabase.from("outbound_orders")
        .update({ status: "completed", order_date: new Date().toISOString() }).eq("id", id).select().single();
      if (error) throw error;
      res.json(data);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/inventory/by-product/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const { data, error } = await supabase.from("inventory")
        .select("quantity, warehouse_id, location_id, batches(*), storage_locations(zone, rack, bin, warehouse_id), warehouses:warehouse_id(id, name)")
        .eq("product_id", id)
        .gt("quantity", 0);
        
      if (error) throw error;
      
      const map = new Map<string, any>();
      (data || []).forEach((inv: any) => {
        if (!inv.batches) return;
        const bid = inv.batches.id;
        if (!map.has(bid)) {
          map.set(bid, { ...inv.batches, total_quantity: 0, locations: [] });
        }
        const b = map.get(bid);
        b.total_quantity += Number(inv.quantity);
        if (inv.storage_locations) {
          b.locations.push({
            qty: Number(inv.quantity),
            name: `${inv.storage_locations.zone}-${inv.storage_locations.rack}-${inv.storage_locations.bin}`,
            location_id: inv.location_id,
            warehouse_id: inv.warehouse_id,
            warehouse_name: (inv.warehouses as any)?.name || ""
          });
        }
      });
      
      const batches = Array.from(map.values()).sort((a, b) => {
         if (!a.expiry_date) return 1;
         if (!b.expiry_date) return -1;
         return new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime();
      });
      
      res.json(batches);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ──── STOCK TAKES ────
  app.get("/api/stock-takes", async (req, res) => {
    try {
      const { data: stockTakes, error } = await supabase.from("stock_takes").select("*, warehouses(name), profiles(full_name)").order("created_at", { ascending: false });
      if (error) throw error;
      
      const stIds = (stockTakes || []).map((st: any) => st.id);
      let sumsMap: Record<string, { items: number; variances: number }> = {};
      if (stIds.length > 0) {
        const { data: items } = await supabase.from("stock_take_items").select("stock_take_id, variance, system_qty, actual_qty").in("stock_take_id", stIds);
        (items || []).forEach((it: any) => {
          if (!sumsMap[it.stock_take_id]) sumsMap[it.stock_take_id] = { items: 0, variances: 0 };
          sumsMap[it.stock_take_id].items++;
          // variance is generated column in postgres, it may or may not return if it's evaluated, let's calculate here physically if needed, but it should return if fetched.
          const variance = it.actual_qty !== null ? (Number(it.actual_qty) - Number(it.system_qty)) : 0;
          if (variance !== 0) sumsMap[it.stock_take_id].variances++;
        });
      }
      
      const result = (stockTakes || []).map((st: any) => ({
        ...st,
        item_count: sumsMap[st.id]?.items || 0,
        variance_count: sumsMap[st.id]?.variances || 0
      }));
      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/stock-takes/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const { data: st, error } = await supabase.from("stock_takes").select("*, warehouses(name), profiles(full_name)").eq("id", id).single();
      if (error) throw error;
      const { data: items } = await supabase.from("stock_take_items").select("*, products(name, sku, uoms(abbreviation)), batches(lot_number), storage_locations(zone, rack, bin)").eq("stock_take_id", id).order("created_at");
      res.json({ ...st, items: items || [] });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/stock-takes", async (req, res) => {
    const { warehouse_id, title, notes, created_by } = req.body;
    try {
      const { data: st, error: stErr } = await supabase.from("stock_takes")
        .insert({ warehouse_id, title, notes, created_by })
        .select().single();
      if (stErr) throw stErr;

      const { data: inventory } = await supabase.from("inventory")
        .select("*").eq("warehouse_id", warehouse_id);
        
      if (inventory && inventory.length > 0) {
        const itemsToInsert = inventory.map((inv: any) => ({
          stock_take_id: st.id,
          inventory_id: inv.id,
          product_id: inv.product_id,
          batch_id: inv.batch_id,
          location_id: inv.location_id,
          system_qty: inv.quantity
        }));
        await supabase.from("stock_take_items").insert(itemsToInsert);
      }
      res.json(st);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.put("/api/stock-takes/:id/items", async (req, res) => {
    const { items } = req.body; // Array of { id, actual_qty }
    try {
      const promises = items.map((it: any) => 
        supabase.from("stock_take_items").update({ actual_qty: it.actual_qty }).eq("id", it.id)
      );
      await Promise.all(promises);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.put("/api/stock-takes/:id/complete", async (req, res) => {
    const { id } = req.params;
    const { user_id } = req.body;
    try {
      const { data: st, error: stErr } = await supabase.from("stock_takes").select("*").eq("id", id).single();
      if (stErr || !st) throw new Error("Stock take not found");

      const { data: items } = await supabase.from("stock_take_items").select("*, batches(lot_number)").eq("stock_take_id", id);
      
      const variances = (items || []).filter((it: any) => it.actual_qty !== null && Number(it.actual_qty) !== Number(it.system_qty));
      
      for (const item of variances) {
        const actualQty = Number(item.actual_qty);
        if (actualQty <= 0) {
          if (item.inventory_id) await supabase.from("inventory").delete().eq("id", item.inventory_id);
        } else {
          if (item.inventory_id) {
            await supabase.from("inventory").update({ quantity: actualQty, updated_at: new Date().toISOString() }).eq("id", item.inventory_id);
          } else {
            // Unlikely to happen with the current logic, since only existing inv inserted.
          }
        }
        
        const diff = actualQty - Number(item.system_qty);
        await supabase.from("stock_movements").insert({
          product_id: item.product_id,
          batch_id: item.batch_id,
          from_location_id: item.location_id,
          to_location_id: item.location_id,
          quantity: Math.abs(diff),
          movement_type: "adjustment",
          user_id: user_id || null,
          notes: `Kiểm kê kho (${st.title}): ${diff > 0 ? '+' : ''}${diff}`
        });
        
        await supabase.from("activities").insert({
          type: "stocktake",
          product_id: item.product_id,
          warehouse_id: st.warehouse_id,
          quantity: diff,
          batch_number: item.batches?.lot_number || null,
          status: "completed",
          performed_by: user_id || null,
          notes: `Kiểm kê kho (${st.title}): Hệ thống tự động ghi nhận chênh lệch ${diff > 0 ? '+' : ''}${diff}.`
        });
      }
      
      const { data: result, error: updateErr } = await supabase.from("stock_takes")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", id).select().single();
      if (updateErr) throw updateErr;

      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.get("/api/preferences", async (req, res) => {
    try {
      const { data, error } = await supabase.from("system_preferences").select("*").eq("id", 1).single();
      if (error && error.code !== "PGRST116") throw error; // ignore no rows
      res.json(data || {});
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.put("/api/preferences", async (req, res) => {
    try {
      const { data, error } = await supabase.from("system_preferences").update(req.body).eq("id", 1).select().single();
      if (error) throw error;
      res.json(data);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => { res.sendFile(path.join(distPath, "index.html")); });
  }

  app.listen(PORT, "0.0.0.0", () => { console.log(`Server running on http://localhost:${PORT}`); });
}

startServer();
