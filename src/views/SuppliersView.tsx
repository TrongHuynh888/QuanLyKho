import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { Truck, Phone, Mail, Plus, Search, Filter, Pencil, Trash2, ArrowRight, User, MapPin, Tag } from "lucide-react";
import type { Supplier } from "../types/supabase";
import SupplierFormModal from "../components/suppliers/SupplierFormModal";

interface SuppliersViewProps {
  onNavigateDetail: (id: string, section?: "details" | "history") => void;
}

export default function SuppliersView({ onNavigateDetail }: SuppliersViewProps) {
  const { t } = useTranslation();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/suppliers");
      if (!res.ok) throw new Error("Could not fetch suppliers");
      const data = await res.json();
      setSuppliers(data || []);
    } catch (err: any) {
      toast.error(err.message);
    }
    setLoading(false);
  };

  useEffect(() => { fetchSuppliers(); }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm(t("confirm_delete_supplier"))) return;
    try {
      const res = await fetch(`/api/suppliers/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      toast.success(t("supplier_deleted"));
      fetchSuppliers();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const filtered = suppliers.filter(s => {
    const matchesSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.email?.toLowerCase().includes(search.toLowerCase()) || s.phone?.includes(search);
    const matchesFilter = statusFilter === "all" || s.status === statusFilter;
    return matchesSearch && matchesFilter;
  });

  const handleSaved = () => {
    setShowModal(false);
    fetchSuppliers();
  };

  const handleNavigate = (id: string, section: "details" | "history") => {
    if (typeof onNavigateDetail === "function") {
      onNavigateDetail(id, section);
    } else {
      // Fallback
      window.dispatchEvent(new CustomEvent("nav-supplier", { detail: { id, section } }));
    }
  };

  const statusConfig: Record<string, { label: string; color: string }> = {
    active: { label: t("status_active"), color: "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400" },
    pending: { label: t("status_pending"), color: "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400" },
    inactive: { label: t("status_inactive"), color: "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400" },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">{t("suppliers")}</h3>
          <p className="text-sm text-neutral-400 dark:text-neutral-500 font-medium mt-1">
            {t("total_suppliers")}: {suppliers.length}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
             <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t("search_suppliers")} className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-taika-blue text-sm font-medium transition-all text-neutral-900 dark:text-neutral-50" />
          </div>
          <div className="relative">
             <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
             <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="appearance-none pl-9 pr-8 py-2.5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-taika-blue text-sm font-medium transition-all text-neutral-900 dark:text-neutral-50 cursor-pointer">
                <option value="all">{t("all_statuses")}</option>
                <option value="active">{t("status_active")}</option>
                <option value="pending">{t("status_pending")}</option>
                <option value="inactive">{t("status_inactive")}</option>
             </select>
          </div>
          <button 
            onClick={() => { setEditSupplier(null); setShowModal(true); }}
            className="px-5 py-2.5 bg-taika-blue text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-taika-blue/10 hover:bg-taika-blue/90 transition-all shrink-0"
          >
            <Plus size={16} /> {t("add_supplier")}
          </button>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
         <div className="animate-pulse grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-40 bg-white dark:bg-neutral-950 rounded-3xl border border-neutral-100 dark:border-neutral-800"></div>)}
         </div>
      ) : filtered.length === 0 ? (
         <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-neutral-950 rounded-3xl border border-neutral-200 dark:border-neutral-700">
            <Truck size={48} className="text-neutral-300 dark:text-neutral-600 mb-4" />
            <p className="text-neutral-500 font-medium">{search ? t("no_suppliers_found") : t("no_suppliers_yet")}</p>
         </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((supplier, i) => {
            const st = statusConfig[supplier.status] || statusConfig.active;
            return (
              <motion.div
                key={supplier.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white dark:bg-neutral-950 p-5 rounded-3xl border border-neutral-200 dark:border-neutral-700/80 shadow-sm hover:shadow-md hover:border-neutral-300 dark:hover:border-neutral-700 transition-all group flex flex-col"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="w-10 h-10 bg-taika-blue-light dark:bg-blue-500/10 rounded-xl flex items-center justify-center text-taika-blue dark:text-blue-400 shrink-0">
                    <Truck size={20} />
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditSupplier(supplier); setShowModal(true); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:bg-taika-blue-light dark:hover:bg-blue-500/10 hover:text-taika-blue dark:hover:text-blue-400 transition-colors">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDelete(supplier.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:bg-taika-red-light dark:hover:bg-red-500/10 hover:text-taika-red dark:hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                
                <div className="mb-4">
                  <h4 className="text-base font-bold text-neutral-900 dark:text-neutral-50 truncate" title={supplier.name}>{supplier.name}</h4>
                  <span className={cn("inline-block px-2 py-0.5 mt-1 rounded text-[10px] font-black uppercase tracking-widest", st.color)}>
                    {st.label}
                  </span>
                </div>

                <div className="space-y-2 mb-4 flex-1">
                  <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                    <User size={12} className="text-neutral-400 dark:text-neutral-500 shrink-0" />
                    <span className="truncate">{supplier.contact_person || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                    <Phone size={12} className="text-neutral-400 dark:text-neutral-500 shrink-0" />
                    <span className="truncate">{supplier.phone || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                    <Mail size={12} className="text-neutral-400 dark:text-neutral-500 shrink-0" />
                    <span className="truncate" title={supplier.email || ""}>{supplier.email || "—"}</span>
                  </div>
                  {/* Category tags */}
                  {(supplier as any).categories?.length > 0 && (
                    <div className="flex items-start gap-1.5 pt-1">
                      <Tag size={11} className="text-neutral-400 shrink-0 mt-0.5" />
                      <div className="flex flex-wrap gap-1">
                        {(supplier as any).categories.map((c: any) => (
                          <span key={c.id} className="text-[10px] font-bold px-1.5 py-0.5 bg-taika-blue/10 dark:bg-blue-500/10 text-taika-blue dark:text-blue-400 rounded">
                            {c.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button 
                  type="button"
                  onClick={() => handleNavigate(supplier.id, "details")}
                  className="w-full py-2.5 bg-neutral-50 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:text-taika-blue dark:hover:text-blue-400 rounded-xl text-xs font-bold hover:bg-taika-blue-light dark:hover:bg-blue-500/10 transition-all flex items-center justify-center gap-2 group border border-transparent hover:border-taika-blue/10 dark:hover:border-blue-500/20"
                >
                  {t("details")} & {t("import_history")} 
                  <ArrowRight size={14} className="opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </button>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <SupplierFormModal 
            supplier={editSupplier} 
            onClose={() => setShowModal(false)} 
            onSaved={handleSaved} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

