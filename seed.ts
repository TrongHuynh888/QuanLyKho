import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function seed() {
  console.log('🌱 Seeding Taika Seafood database...');

  // 1. Categories
  const categories = [
    { name: 'Raw Material', description: 'Nguyên liệu thô chưa qua chế biến' },
    { name: 'Processed', description: 'Sản phẩm đã qua chế biến' },
    { name: 'Finished Goods', description: 'Thành phẩm sẵn sàng xuất' },
  ];
  const { data: catData, error: catErr } = await supabase.from('categories').upsert(categories, { onConflict: 'name' }).select();
  if (catErr) console.error('Categories error:', catErr.message);
  else console.log(`✅ ${catData.length} categories`);

  // 2. UoMs
  const uoms = [
    { name: 'Kilogram', abbreviation: 'kg' },
    { name: 'Metric Ton', abbreviation: 'MT' },
    { name: 'Box', abbreviation: 'bx' },
  ];
  const { data: uomData, error: uomErr } = await supabase.from('uoms').upsert(uoms, { onConflict: 'name' }).select();
  if (uomErr) console.error('UoMs error:', uomErr.message);
  else console.log(`✅ ${uomData.length} UoMs`);

  const kgId = uomData?.find(u => u.abbreviation === 'kg')?.id;
  const rawId = catData?.find(c => c.name === 'Raw Material')?.id;
  const processedId = catData?.find(c => c.name === 'Processed')?.id;
  const finishedId = catData?.find(c => c.name === 'Finished Goods')?.id;

  // 3. Products
  const products = [
    { sku: 'VN-PTO-2030', name: 'Vannamei Shrimp PTO 20/30', category_id: rawId, uom_id: kgId, type: 'PTO', size: '20/30', state: 'raw', min_stock_level: 500 },
    { sku: 'BT-HOSO-3040', name: 'Black Tiger HOSO 30/40', category_id: rawId, uom_id: kgId, type: 'HOSO', size: '30/40', state: 'raw', min_stock_level: 300 },
    { sku: 'SC-HLSO-1020', name: 'Scampi HLSO 10/20', category_id: rawId, uom_id: kgId, type: 'HLSO', size: '10/20', state: 'raw', min_stock_level: 200 },
    { sku: 'CK-PTO-3040', name: 'Cooked Shrimp PTO 30/40', category_id: processedId, uom_id: kgId, type: 'PTO', size: '30/40', state: 'cooked', min_stock_level: 100 },
    { sku: 'SH-PD-4050', name: 'PD Vannamei 40/50', category_id: rawId, uom_id: kgId, type: 'PD', size: '40/50', state: 'raw', min_stock_level: 200 },
    { sku: 'BR-OTH-NA', name: 'Breaded Shrimp', category_id: finishedId, uom_id: kgId, type: 'OTHER', size: 'N/A', state: 'processed', min_stock_level: 300 },
  ];
  const { data: prodData, error: prodErr } = await supabase.from('products').upsert(products, { onConflict: 'sku' }).select();
  if (prodErr) console.error('Products error:', prodErr.message);
  else console.log(`✅ ${prodData.length} products`);

  // 4. Suppliers
  // Check if suppliers exist first
  const { data: existingSup } = await supabase.from('suppliers').select('id').limit(1);
  let supData: any[] = [];
  if (!existingSup || existingSup.length === 0) {
    const suppliers = [
      { name: 'Hải Sản Miền Trung', contact_person: 'Nguyễn Văn A', phone: '0901 234 567', email: 'mientrung@seafood.vn', address: 'Đà Nẵng', status: 'active' },
      { name: 'Vannamei Farm Co.', contact_person: 'Trần Thị B', phone: '0902 345 678', email: 'contact@vannamei.com', address: 'Cà Mau', status: 'active' },
      { name: 'Đại Dương Xanh', contact_person: 'Lê Văn C', phone: '0903 456 789', email: 'info@daiduongxanh.vn', address: 'Nha Trang', status: 'pending' },
      { name: 'Mekong Delta Fish', contact_person: 'Phạm Văn D', phone: '0904 567 890', email: 'sales@mekongfish.vn', address: 'Cần Thơ', status: 'active' },
    ];
    const { data, error: supErr } = await supabase.from('suppliers').insert(suppliers).select();
    if (supErr) console.error('Suppliers error:', supErr.message);
    else { supData = data || []; console.log(`✅ ${supData.length} suppliers`); }
  } else {
    const { data } = await supabase.from('suppliers').select('*');
    supData = data || [];
    console.log(`ℹ️ Suppliers already exist (${supData.length}), skipping`);
  }

  // 5. Warehouses
  // Check if warehouses exist first
  const { data: existingWh } = await supabase.from('warehouses').select('id').limit(1);
  let whData: any[] = [];
  if (!existingWh || existingWh.length === 0) {
    const warehousesList = [
      { name: 'Cold Storage A', location: 'Zone 1, Main Plant', temperature_zone: '-18°C', total_zones: 12 },
      { name: 'Cold Storage B', location: 'Zone 2, Export Hub', temperature_zone: '-20°C', total_zones: 8 },
    ];
    const { data, error: whErr } = await supabase.from('warehouses').insert(warehousesList).select();
    if (whErr) console.error('Warehouses error:', whErr.message);
    else { whData = data || []; console.log(`✅ ${whData.length} warehouses`); }
  } else {
    const { data } = await supabase.from('warehouses').select('*');
    whData = data || [];
    console.log(`ℹ️ Warehouses already exist (${whData.length}), skipping`);
  }

  // 6. Storage Locations
  if (whData && whData.length >= 2) {
    const locations = [
      { warehouse_id: whData[0].id, zone: 'Z1', rack: 'R1', bin: 'B1' },
      { warehouse_id: whData[0].id, zone: 'Z1', rack: 'R2', bin: 'B4' },
      { warehouse_id: whData[0].id, zone: 'Z1', rack: 'R5', bin: 'B2' },
      { warehouse_id: whData[1].id, zone: 'Z2', rack: 'R1', bin: 'B1' },
      { warehouse_id: whData[1].id, zone: 'Z3', rack: 'R2', bin: 'B8' },
    ];
    const { data: locData, error: locErr } = await supabase.from('storage_locations').upsert(locations, { onConflict: 'warehouse_id,zone,rack,bin' }).select();
    if (locErr) console.error('Locations error:', locErr.message);
    else console.log(`✅ ${(locData || []).length} storage locations`);

    // 7. Batches
    if (prodData && prodData.length > 0 && supData && supData.length > 0) {
      const batches = [
        { lot_number: 'LOT-2024-04-01', product_id: prodData[0].id, supplier_id: supData[0].id, production_date: '2024-04-01', expiry_date: '2025-04-01', qc_status: 'Pass' },
        { lot_number: 'LOT-2024-03-15', product_id: prodData[1].id, supplier_id: supData[1].id, production_date: '2024-03-15', expiry_date: '2025-03-15', qc_status: 'Pass' },
        { lot_number: 'LOT-2024-02-20', product_id: prodData[4].id, supplier_id: supData[0].id, production_date: '2024-02-20', expiry_date: '2025-02-20', qc_status: 'Hold' },
        { lot_number: 'LOT-2024-05-10', product_id: prodData[2].id, supplier_id: supData[2].id, production_date: '2024-05-10', expiry_date: '2025-05-10', qc_status: 'Pass' },
        { lot_number: 'LOT-2024-01-05', product_id: prodData[3].id, supplier_id: supData[3].id, production_date: '2024-01-05', expiry_date: '2024-07-05', qc_status: 'Pass' },
      ];
      const { data: batchData, error: batchErr } = await supabase.from('batches').upsert(batches, { onConflict: 'lot_number' }).select();
      if (batchErr) console.error('Batches error:', batchErr.message);
      else console.log(`✅ ${(batchData || []).length} batches`);

      // 8. Inventory
      if (batchData && locData) {
        const inventoryItems = [
          { product_id: prodData[0].id, warehouse_id: whData[0].id, location_id: locData[1]?.id, batch_id: batchData[0].id, quantity: 4500, batch_number: 'LOT-2024-04-01', expiry_date: '2025-04-01' },
          { product_id: prodData[1].id, warehouse_id: whData[0].id, location_id: locData[0]?.id, batch_id: batchData[1].id, quantity: 1200, batch_number: 'LOT-2024-03-15', expiry_date: '2025-03-15' },
          { product_id: prodData[4].id, warehouse_id: whData[0].id, location_id: locData[2]?.id, batch_id: batchData[2].id, quantity: 850, batch_number: 'LOT-2024-02-20', expiry_date: '2025-02-20' },
          { product_id: prodData[2].id, warehouse_id: whData[1].id, location_id: locData[4]?.id, batch_id: batchData[3].id, quantity: 2100, batch_number: 'LOT-2024-05-10', expiry_date: '2025-05-10' },
          { product_id: prodData[3].id, warehouse_id: whData[0].id, location_id: locData[0]?.id, batch_id: batchData[4].id, quantity: 300, batch_number: 'LOT-2024-01-05', expiry_date: '2024-07-05' },
        ];
        const { data: invData, error: invErr } = await supabase.from('inventory').upsert(inventoryItems, { onConflict: 'product_id,warehouse_id,batch_number' }).select();
        if (invErr) console.error('Inventory error:', invErr.message);
        else console.log(`✅ ${(invData || []).length} inventory items`);
      }
    }
  }

  console.log('\n🎉 Seeding complete!');
}

seed().catch(console.error);
