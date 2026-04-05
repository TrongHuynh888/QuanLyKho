export type Supplier = {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  status: 'active' | 'pending' | 'inactive';
};

export type Category = {
  id: string;
  name: string;
  description: string | null;
};

export type UnitOfMeasurement = {
  id: string;
  name: string;
  abbreviation: string;
};

export type Product = {
  id: string;
  sku: string;
  name: string;
  category_id: string | null;
  uom_id: string | null;
  type: string | null;
  size: string | null;
  state: 'raw' | 'cooked' | 'processed';
  min_stock_level: number;
  image_url: string | null;
  description?: string | null;
  ingredients?: string | null;
  import_price?: number;
  wholesale_price?: number;
  retail_price?: number;
  created_at?: string;
  categories?: Category;
  uoms?: UnitOfMeasurement;
};

export type Warehouse = {
  id: string;
  name: string;
  location: string | null;
  temperature_zone: string | null;
  total_zones: number;
  zones_per_row?: number | null;
  area_sqm?: number | null;
  max_capacity_kg?: number | null;
  manager_name?: string | null;
  manager_phone?: string | null;
  status?: string | null;
  notes?: string | null;
  racks_per_zone?: number | null;
  bins_per_rack?: number | null;
  bin_capacity_kg?: number | null;
};

export type StorageLocation = {
  id: string;
  warehouse_id: string;
  zone: string;
  rack: string | null;
  bin: string | null;
  capacity: number;
  status: 'active' | 'maintenance' | 'blocked';
  warehouses?: Warehouse;
};

export type LocationInventoryItem = {
  product_id: string;
  batch_id: string | null;
  product_name: string;
  sku: string;
  quantity: number;
  lot_number: string;
  expiry_date: string | null;
  qc_status: 'Pass' | 'Fail' | 'Hold';
};

export type LocationWithInventory = StorageLocation & {
  inventory_items: LocationInventoryItem[];
  total_quantity: number;
  utilization: number; // percentage 0-100
};

export type Batch = {
  id: string;
  lot_number: string;
  product_id: string;
  supplier_id: string | null;
  origin: string | null;
  production_date: string | null;
  expiry_date: string | null;
  qc_status: 'Pass' | 'Fail' | 'Hold';
  certificates: string[] | null;
  notes: string | null;
};

export type InventoryItem = {
  id: string;
  product_id: string;
  warehouse_id: string;
  location_id: string | null;
  batch_id: string | null;
  quantity: number;
  batch_number: string | null;
  expiry_date: string | null;
  updated_at: string;
  products?: Product;
  storage_locations?: StorageLocation;
  batches?: Batch;
};

export type InboundShipment = {
  id: string;
  supplier_id: string | null;
  supplier_name: string | null;
  received_at: string;
  received_by: string | null;
  status: 'pending' | 'completed' | 'cancelled';
  notes: string | null;
  created_at: string;
  suppliers?: Supplier;
  profiles?: { full_name: string; email: string };
  items?: InboundShipmentItem[];
  item_count?: number;
  total_quantity?: number;
};

export type InboundShipmentItem = {
  id: string;
  shipment_id: string;
  product_id: string;
  batch_id: string | null;
  warehouse_id: string | null;
  location_id: string | null;
  quantity: number;
  created_at: string;
  products?: Product;
  batches?: Batch;
  warehouses?: Warehouse;
  storage_locations?: StorageLocation;
};

export type Activity = {
  id: string;
  type: 'inbound' | 'outbound' | 'transfer';
  product_id: string | null;
  warehouse_id: string | null;
  to_warehouse_id: string | null;
  quantity: number;
  batch_number: string | null;
  status: 'completed' | 'pending' | 'cancelled';
  performed_by: string | null;
  notes: string | null;
  created_at: string;
  products?: Product;
  warehouses?: Warehouse;
  profiles?: { full_name: string };
};

export type Customer = {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  status: 'active' | 'pending' | 'inactive';
  notes: string | null;
  created_at: string;
};
