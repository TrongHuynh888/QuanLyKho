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
    const { data, error } = await supabase.from("products").select("*, categories(*)");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post("/api/products", async (req, res) => {
    const { data, error } = await supabase.from("products").insert(req.body).select();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
  });

  // Warehouses CRUD
  app.get("/api/warehouses", async (req, res) => {
    const { data, error } = await supabase.from("warehouses").select("*").order("name");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post("/api/warehouses", async (req, res) => {
    const { name, location, temperature_zone, total_zones, zones_per_row, area_sqm, max_capacity_kg, manager_name, manager_phone, status, notes, racks_per_zone, bins_per_rack, bin_capacity_kg } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });
    try {
      const { data, error } = await supabase.from("warehouses")
        .insert({ name, location, temperature_zone, total_zones: total_zones || 1, zones_per_row, area_sqm, max_capacity_kg, manager_name, manager_phone, status: status || 'active', notes, racks_per_zone, bins_per_rack, bin_capacity_kg })
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
    const { name, location, temperature_zone, total_zones, zones_per_row, area_sqm, max_capacity_kg, manager_name, manager_phone, status, notes, racks_per_zone, bins_per_rack, bin_capacity_kg } = req.body;
    try {
      const { data: existingWh } = await supabase.from("warehouses").select("*").eq("id", id).single();
      if (!existingWh) return res.status(404).json({ error: "Warehouse not found" });
      const gridChanged = (existingWh.total_zones !== total_zones || existingWh.racks_per_zone !== racks_per_zone || existingWh.bins_per_rack !== bins_per_rack || existingWh.bin_capacity_kg !== bin_capacity_kg);
      let locsToDelete: any[] = [];
      let rowsToAdd: any[] = [];
      if (gridChanged) {
        const { data: existingLocs } = await supabase.from("storage_locations").select("id, zone, rack, bin").eq("warehouse_id", id);
        const existingMap = new Map((existingLocs || []).map((l: any) => [`${l.zone}-${l.rack}-${l.bin}`, l]));
        const zonesArr = Array.from({ length: total_zones || 1 }, (_, i) => `Z${i + 1}`);
        const expectedMap = new Map();
        for (const zone of zonesArr) {
          for (let r = 1; r <= (racks_per_zone || 3); r++) {
            for (let b = 1; b <= (bins_per_rack || 6); b++) {
              const key = `${zone}-R${r}-B${b}`;
              expectedMap.set(key, true);
              if (!existingMap.has(key)) {
                rowsToAdd.push({ warehouse_id: id, zone, rack: `R${r}`, bin: `B${b}`, capacity: bin_capacity_kg || 5000, status: "active" });
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
        .update({ name, location, temperature_zone, total_zones, zones_per_row, area_sqm, max_capacity_kg, manager_name, manager_phone, status, notes, racks_per_zone, bins_per_rack, bin_capacity_kg })
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
    const { zones, racks_per_zone, bins_per_rack, capacity } = req.body;
    const rows: any[] = [];
    for (const zone of (zones as string[])) {
      for (let r = 1; r <= (racks_per_zone || 3); r++) {
        for (let b = 1; b <= (bins_per_rack || 6); b++) {
          rows.push({ warehouse_id: id, zone, rack: `R${r}`, bin: `B${b}`, capacity: capacity || 5000, status: "active" });
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

  // Suppliers
  app.get("/api/suppliers", async (req, res) => {
    const { data, error } = await supabase.from("suppliers").select("*");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // Inventory
  app.get("/api/inventory", async (req, res) => {
    const { data, error } = await supabase.from("inventory").select("*, products(*), storage_locations(*, warehouses(*)), batches(*)");
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

      // Enrich with product & warehouse names separately
      const productIds = [...new Set((acts || []).map((a: any) => a.product_id).filter(Boolean))];
      const warehouseIds = [...new Set((acts || []).map((a: any) => a.warehouse_id).filter(Boolean))];

      let productsMap: Record<string, any> = {};
      let warehousesMap: Record<string, any> = {};

      if (productIds.length > 0) {
        const { data: prods } = await supabase.from("products").select("id, name, sku").in("id", productIds);
        (prods || []).forEach((p: any) => { productsMap[p.id] = p; });
      }
      if (warehouseIds.length > 0) {
        const { data: whs } = await supabase.from("warehouses").select("id, name").in("id", warehouseIds);
        (whs || []).forEach((w: any) => { warehousesMap[w.id] = w; });
      }

      const result = (acts || []).map((a: any) => ({
        ...a,
        products: productsMap[a.product_id] || null,
        warehouses: warehousesMap[a.warehouse_id] || null,
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
        .select("*, suppliers(name, contact_person), profiles!inbound_shipments_received_by_fkey(full_name, email)")
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
      const result = (shipments || []).map((s: any) => ({ ...s, item_count: itemsMap[s.id]?.count || 0, total_quantity: itemsMap[s.id]?.qty || 0 }));
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
        .select("*, products(name, sku), batches(lot_number, expiry_date, qc_status, production_date), warehouses(name), storage_locations(zone, rack, bin)")
        .eq("shipment_id", id).order("created_at");
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

  // Stock Movements
  app.post("/api/movements", async (req, res) => {
    const { product_id, batch_id, from_location_id, to_location_id, quantity, movement_type, user_id } = req.body;
    const { data: movement, error: moveError } = await supabase.from("stock_movements").insert({ product_id, batch_id, from_location_id, to_location_id, quantity, movement_type, user_id }).select();
    if (moveError) return res.status(500).json({ error: moveError.message });
    if (from_location_id) { await supabase.rpc('decrement_inventory', { pid: product_id, lid: from_location_id, bid: batch_id, qty: quantity }); }
    if (to_location_id) { await supabase.rpc('increment_inventory', { pid: product_id, lid: to_location_id, bid: batch_id, qty: quantity }); }
    res.json(movement[0]);
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
