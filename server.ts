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

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Auth routes
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

  // User Management
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

  // Avatar Upload
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

  // Products
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
    const { data: invCheck } = await supabase.from("inventory_items").select("id").eq("product_id", id).gt("quantity", 0).limit(1);
    if (invCheck && invCheck.length > 0) {
      return res.status(400).json({ error: "Sản phẩm đang có tồn kho. Không thể xóa." });
    }
    const { data: oldData } = await supabase.from("products").select("image_url").eq("id", id).single();
    const oldImageUrl = oldData?.image_url;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    if (oldImageUrl && oldImageUrl.startsWith(R2_WORKER_URL + "/file/")) {
      try { await fetch(oldImageUrl, { method: "DELETE" }); } catch (err) { console.error("Lỗi khi xoá ảnh sản phẩm cũ trên R2:", err); }
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
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "name is required" });
    const { data, error } = await supabase.from("categories").insert({ name: name.trim() }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.put("/api/categories/:id", async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "name is required" });
    const { data, error } = await supabase.from("categories").update({ name: name.trim() }).eq("id", id).select().single();
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

  // Warehouses CRUD
  app.get("/api/warehouses", async (req, res) => {
    const { data, error } = await supabase.from("warehouses").select("*").order("name");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post("/api/warehouses", async (req, res) => {
    const { name, code, location, temperature_zone, total_zones, zones_per_row, area_sqm, max_capacity_kg, manager_name, manager_phone, status, notes, racks_per_zone, bins_per_rack, bin_capacity_kg, zone_prefix, rack_prefix, bin_prefix } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });
    try {
      const { data, error } = await supabase.from("warehouses")
        .insert({ name, code: code || null, location, temperature_zone, total_zones: total_zones || 1, zones_per_row, area_sqm, max_capacity_kg, manager_name, manager_phone, status: status || 'active', notes, racks_per_zone, bins_per_rack, bin_capacity_kg, zone_prefix: zone_prefix || 'Z', rack_prefix: rack_prefix || 'R', bin_prefix: bin_prefix || 'B' })
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
    const { name, code, location, temperature_zone, total_zones, zones_per_row, area_sqm, max_capacity_kg, manager_name, manager_phone, status, notes, racks_per_zone, bins_per_rack, bin_capacity_kg, zone_prefix, rack_prefix, bin_prefix } = req.body;
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
        .update({ name, code: code || null, location, temperature_zone, total_zones, zones_per_row, area_sqm, max_capacity_kg, manager_name, manager_phone, status, notes, racks_per_zone, bins_per_rack, bin_capacity_kg, zone_prefix: zp, rack_prefix: rp, bin_prefix: bp })
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

  // Generate locations grid
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

  // Storage Locations CRUD
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

  // ──── SUPPLIERS CRUD ────
  app.get("/api/suppliers", async (req, res) => {
    try {
      const { data: suppliers, error } = await supabase.from("suppliers").select("*").order("created_at", { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      // Attach categories for each supplier
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

  // Supplier categories linking
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
      // Get inbound shipments for this supplier
      const { data: shipments } = await supabase.from("inbound_shipments")
        .select("*, profiles!inbound_shipments_received_by_fkey(full_name, email)")
        .eq("supplier_id", id)
        .order("created_at", { ascending: false });
      // Get item counts for each shipment
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
      
      // Get categories for this supplier
      const { data: scRows } = await supabase.from("supplier_categories").select("categories(id, name)").eq("supplier_id", id);
      const categories = (scRows || []).map((r: any) => r.categories).filter(Boolean);

      res.json({ ...supplier, shipments: enrichedShipments, categories });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/suppliers", async (req, res) => {
    const { name, contact_person, email, phone, address, status } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Tên nhà cung cấp là bắt buộc" });
    try {
      const { data, error } = await supabase.from("suppliers")
        .insert({ name: name.trim(), contact_person, email, phone, address, status: status || "active" })
        .select().single();
      if (error) throw error;
      res.json(data);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.put("/api/suppliers/:id", async (req, res) => {
    const { id } = req.params;
    const { name, contact_person, email, phone, address, status } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Tên nhà cung cấp là bắt buộc" });
    try {
      const { data, error } = await supabase.from("suppliers")
        .update({ name: name.trim(), contact_person, email, phone, address, status })
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

  // Inventory
  app.get("/api/inventory", async (req, res) => {
    const { data, error } = await supabase.from("inventory").select("*, products(*, categories(*), uoms(*)), storage_locations(*, warehouses(*)), batches(*)");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // Warehouse Map locations with inventory
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
        return { ...loc, inventory_items: items, total_quantity, utilization: Math.min(100, Math.round((total_quantity / capacity) * 100)) };
      });
      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/storage-locations", async (req, res) => {
    const { data, error } = await supabase.from("storage_locations").select("*, warehouses(*)").order("zone").order("rack").order("bin");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // Categories
  app.get("/api/categories", async (req, res) => {
    const { data, error } = await supabase.from("categories").select("*").order("name");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // ──── ACTIVITIES LOG ────
  app.get("/api/activities", async (req, res) => {
    try {
      const { data: acts, error } = await supabase
        .from("activities")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;

      // Enrich with product, warehouse & profile names separately
      const productIds = [...new Set((acts || []).map((a: any) => a.product_id).filter(Boolean))];
      const warehouseIds = [...new Set((acts || []).flatMap((a: any) => [a.warehouse_id, a.to_warehouse_id]).filter(Boolean))];
      const profileIds = [...new Set((acts || []).map((a: any) => a.performed_by).filter(Boolean))];

      let productsMap: Record<string, any> = {};
      let warehousesMap: Record<string, any> = {};
      let profilesMap: Record<string, any> = {};

      if (productIds.length > 0) {
        const { data: prods } = await supabase.from("products").select("id, name, sku").in("id", productIds);
        (prods || []).forEach((p: any) => { productsMap[p.id] = p; });
      }
      if (warehouseIds.length > 0) {
        const { data: whs } = await supabase.from("warehouses").select("id, name").in("id", warehouseIds);
        (whs || []).forEach((w: any) => { warehousesMap[w.id] = w; });
      }
      if (profileIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", profileIds);
        (profs || []).forEach((p: any) => { profilesMap[p.id] = p; });
      }

      const result = (acts || []).map((a: any) => ({
        ...a,
        products: productsMap[a.product_id] || null,
        warehouses: warehousesMap[a.warehouse_id] || null,
        to_warehouses: warehousesMap[a.to_warehouse_id] || null,
        profiles: profilesMap[a.performed_by] || null,
      }));

      res.json(result);
    } catch (err: any) {
      console.error("[GET /api/activities]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ──── INBOUND SHIPMENTS ────

  app.get("/api/inbound-shipments", async (req, res) => {
    try {
      const { data: shipments, error } = await supabase.from("inbound_shipments")
        .select("*, suppliers(name, contact_person)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = (shipments || []).map((s: any) => s.id);
      let itemsMap: Record<string, { count: number; qty: number }> = {};
      if (ids.length > 0) {
        const { data: items } = await supabase.from("inbound_shipment_items").select("shipment_id, quantity").in("shipment_id", ids);
        (items || []).forEach((it: any) => {
          if (!itemsMap[it.shipment_id]) itemsMap[it.shipment_id] = { count: 0, qty: 0 };
          itemsMap[it.shipment_id].count++;
          itemsMap[it.shipment_id].qty += Number(it.quantity);
        });
      }
      
      // Fetch profiles for received_by
      const userIds = [...new Set((shipments || []).map((s: any) => s.received_by).filter(Boolean))];
      let profilesMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
        (profiles || []).forEach((p: any) => { profilesMap[p.id] = p.full_name; });
      }
      
      const result = (shipments || []).map((s: any) => ({ 
        ...s, 
        item_count: itemsMap[s.id]?.count || 0, 
        total_quantity: itemsMap[s.id]?.qty || 0,
        creator_name: profilesMap[s.received_by] || null
      }));
      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/inbound-shipments/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { data: shipment, error } = await supabase.from("inbound_shipments")
        .select("*, suppliers(name, contact_person), profiles!inbound_shipments_received_by_fkey(full_name, email)")
        .eq("id", id).single();
      if (error) throw error;
      const { data: items } = await supabase.from("inbound_shipment_items")
        .select("*, products(name, sku, image_url, categories(name), uoms(name, abbreviation)), batches(lot_number, expiry_date, qc_status, production_date), warehouses(name), storage_locations(zone, rack, bin)")
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
    const { product_id, quantity, lot_number, production_date, expiry_date, qc_status, warehouse_id, location_id, user_id, cost_price, tax_rate, import_fee } = req.body;
    try {
      const { data: batch, error: batchErr } = await supabase.from("batches")
        .insert({ lot_number, product_id, supplier_id: null, production_date: production_date || null, expiry_date: expiry_date || null, qc_status: qc_status || "Hold" })
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
        .select("*, products(name, sku), batches(lot_number, expiry_date, qc_status, production_date), warehouses(name), storage_locations(zone, rack, bin)")
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
      const { data: inventory } = await supabase.from("inventory").select("location_id, quantity").eq("warehouse_id", id);
      const usageMap: Record<string, number> = {};
      (inventory || []).forEach((inv: any) => { if (inv.location_id) { usageMap[inv.location_id] = (usageMap[inv.location_id] || 0) + Number(inv.quantity); } });
      const result = (locations || []).map((loc: any) => ({
        ...loc, current_quantity: usageMap[loc.id] || 0, capacity: loc.capacity || 5000,
        remaining_capacity: (loc.capacity || 5000) - (usageMap[loc.id] || 0),
      })).filter((loc: any) => loc.remaining_capacity > 0);
      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Stock Movements — Transfer
  app.post("/api/movements", async (req, res) => {
    const { product_id, batch_id, from_location_id, to_location_id, quantity, movement_type, user_id, notes, from_warehouse_id, to_warehouse_id } = req.body;
    try {
      // Validation
      if (!product_id || !from_location_id || !to_location_id || !quantity || quantity <= 0) {
        return res.status(400).json({ error: "Thiếu thông tin: product_id, from/to location, quantity" });
      }
      if (from_location_id === to_location_id) {
        return res.status(400).json({ error: "Vị trí nguồn và đích không được trùng nhau" });
      }
      // Check sufficient inventory at source
      const { data: srcInv } = await supabase.from("inventory")
        .select("id, quantity")
        .eq("product_id", product_id)
        .eq("location_id", from_location_id)
        .eq("batch_id", batch_id)
        .maybeSingle();
      if (!srcInv || Number(srcInv.quantity) < quantity) {
        return res.status(400).json({ error: `Tồn kho không đủ. Hiện có: ${srcInv?.quantity || 0}, cần: ${quantity}` });
      }

      // Create movement record
      const { data: movement, error: moveError } = await supabase.from("stock_movements")
        .insert({ product_id, batch_id, from_location_id, to_location_id, quantity, movement_type: movement_type || "transfer", user_id: user_id || null, notes: notes || null })
        .select()
        .single();
      if (moveError) throw moveError;

      // Update inventory: decrement source
      const newSrcQty = Number(srcInv.quantity) - quantity;
      if (newSrcQty <= 0) {
        await supabase.from("inventory").delete().eq("id", srcInv.id);
      } else {
        await supabase.from("inventory").update({ quantity: newSrcQty }).eq("id", srcInv.id);
      }

      // Update inventory: increment destination
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

      // Activity log
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

  // Transfer history
  app.get("/api/movements", async (req, res) => {
    try {
      const { data: movements, error } = await supabase.from("stock_movements")
        .select("*")
        .eq("movement_type", "transfer")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;

      // Enrich with product names, location labels
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

  // System Preferences
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
