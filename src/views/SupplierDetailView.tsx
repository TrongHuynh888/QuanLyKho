import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { ArrowLeft, Edit2, Package, Search, Plus, MapPin, Truck, Calendar, Phone, Mail, FileText, CheckCircle2, Factory, Trash2, ShieldCheck, Tag, Clock, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import type { Supplier } from "../types/supabase";

interface SupplierDetailViewProps {
  supplierId: string;
  defaultSection?: "details" | "history";
  onBack: () => void;
}

export default function SupplierDetailView({ supplierId, defaultSection = "details", onBack }: SupplierDetailViewProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<{ supplier: Supplier; shipments: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchDetail(); }, [supplierId]);

  useEffect(() => {
    if (data && defaultSection === "history" && historyRef.current) {
      // Small timeout ensures the DOM is fully rendered horizontally/vertically before scrolling
      setTimeout(() => {
        historyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [data, defaultSection]);

  async function fetchDetail() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/suppliers/${supplierId}`);
      if (!res.ok) throw new Error("Could not fetch supplier details");
      const d = await res.json();
      setData({ supplier: d, shipments: d.shipments || [] });
    } catch (err: any) {
      setError(err.message);
      toast.error(t("error_loading_data"));
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-taika-blue" />
        <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">{t("loading")}...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-red-500 font-medium">{error || t("error_loading_data")}</p>
        <button onClick={onBack} className="px-4 py-2 bg-neutral-100 rounded-xl font-bold">{t("back")}</button>
      </div>
    );
  }

  const { supplier, shipments } = data;

  const filteredShipments = shipments.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.id.toLowerCase().includes(q) || s.notes?.toLowerCase().includes(q);
  });

  const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
    pending: { label: t("pending"), color: "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400", icon: Clock },
    completed: { label: t("completed"), color: "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400", icon: CheckCircle2 },
    cancelled: { label: t("status_inactive"), color: "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400", icon: XCircle },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 transition-all">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 flex items-center gap-3">
            {supplier.name}
            <span className={cn(
              "text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md",
              supplier.status === "active" ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400" :
                supplier.status === "pending" ? "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400" :
                  "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400"
            )}>
              {supplier.status === "active" ? t("status_active") : supplier.status === "pending" ? t("status_pending") : t("status_inactive")}
            </span>
          </h3>
          <p className="text-sm text-neutral-400 dark:text-neutral-500 font-medium mt-1">{t("supplier_detail")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info Card */}
        <div className="lg:col-span-1 space-y-6">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-neutral-950 p-6 rounded-[2rem] border border-neutral-200 dark:border-neutral-700 shadow-sm">
            <h4 className="font-bold text-neutral-900 dark:text-neutral-50 mb-6 flex items-center gap-2">
              <Truck size={18} className="text-taika-blue" /> {t("supplier_info")}
            </h4>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center text-neutral-400 shrink-0">
                  <span className="font-bold text-xs">{supplier.contact_person?.[0]?.toUpperCase() || "—"}</span>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">{t("contact_person")}</p>
                  <p className="font-bold text-neutral-900 dark:text-neutral-50 text-sm">{supplier.contact_person || "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Phone size={16} className="text-neutral-400 w-8" />
                <div className="flex-1">
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">{t("phone_number")}</p>
                  <p className="font-semibold text-neutral-900 dark:text-neutral-50 text-sm">{supplier.phone || "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Mail size={16} className="text-neutral-400 w-8" />
                <div className="flex-1">
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">Email</p>
                  <p className="font-semibold text-neutral-900 dark:text-neutral-50 text-sm break-all">{supplier.email || "—"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin size={16} className="text-neutral-400 w-8 mt-1" />
                <div className="flex-1">
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">{t("address")}</p>
                  <p className="font-semibold text-neutral-900 dark:text-neutral-50 text-sm line-clamp-3">{supplier.address || "—"}</p>
                </div>
              </div>
              {/* Category tags */}
              {(supplier as any).categories?.length > 0 && (
                <div className="flex items-start gap-3">
                  <Tag size={16} className="text-neutral-400 w-8 mt-1" />
                  <div className="flex-1">
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">{t("supplier_categories", "Danh mục")}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(supplier as any).categories.map((c: any) => (
                        <span key={c.id} className="text-[10px] font-bold px-2 py-0.5 bg-taika-blue/10 dark:bg-blue-500/10 text-taika-blue dark:text-blue-400 rounded-md">
                          {c.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-6 pt-6 border-t border-neutral-100 dark:border-neutral-800">
               <p className="text-[10px] text-neutral-400 font-medium uppercase tracking-widest">{t("created_at")}: {new Date(supplier.created_at).toLocaleDateString()}</p>
            </div>
          </motion.div>

           {/* Stats Summary */}
           <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 dark:bg-blue-500/10 p-5 rounded-3xl border border-blue-100 dark:border-blue-500/20">
                <p className="text-[10px] font-black text-blue-400/80 uppercase tracking-widest mb-1">{t("shipment_count")}</p>
                <p className="text-2xl font-black text-taika-blue dark:text-blue-400">{shipments.length}</p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-500/10 p-5 rounded-3xl border border-purple-100 dark:border-purple-500/20">
                <p className="text-[10px] font-black text-purple-400/80 uppercase tracking-widest mb-1">{t("total_imported_qty")}</p>
                <p className="text-2xl font-black text-purple-600 dark:text-purple-400">
                  {shipments.reduce((sum, s) => sum + (s.total_quantity || 0), 0).toLocaleString()} <span className="text-xs font-semibold">kg</span>
                </p>
              </div>
           </motion.div>
        </div>

        {/* History Tab */}
        <div className="lg:col-span-2" ref={historyRef} id="history-section">
          <div className="bg-white dark:bg-neutral-950 rounded-[2rem] border border-neutral-200 dark:border-neutral-700 shadow-sm overflow-hidden flex flex-col h-full min-h-[500px]">
            <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
              <h4 className="font-bold text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
                <Clock size={18} className="text-taika-blue" /> {t("shipment_history")}
              </h4>
              <div className="relative">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={14} />
                 <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t("search")} className="pl-9 pr-3 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-taika-blue text-xs font-medium w-48" />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2">
              {filteredShipments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
                   <Truck size={40} className="mb-3 opacity-20" />
                   <p className="text-sm font-medium">{search ? t("no_scans_yet") : t("no_shipments_yet")}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredShipments.map((ship, i) => {
                    const st = statusConfig[ship.status] || statusConfig.pending;
                    const StIcon = st.icon;
                    return (
                      <motion.div key={ship.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center justify-between p-4 rounded-2xl hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors border border-transparent hover:border-neutral-100 dark:hover:border-neutral-800">
                        <div className="flex items-center gap-4">
                           <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", st.color)}>
                             <StIcon size={18} />
                           </div>
                           <div>
                              <p className="font-bold text-neutral-900 dark:text-neutral-50 text-sm flex items-center gap-2">
                                #{ship.id.slice(0,8)}
                                <span className={cn("text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded", st.color)}>{st.label}</span>
                              </p>
                              <p className="text-xs text-neutral-400 font-medium mt-0.5">{new Date(ship.created_at).toLocaleDateString()} • {ship.profiles?.full_name || t("automated")}</p>
                           </div>
                        </div>
                        <div className="text-right">
                           <p className="font-black text-neutral-900 dark:text-neutral-50 text-base">{(ship.total_quantity || 0).toLocaleString()} <span className="text-xs text-neutral-400">kg</span></p>
                           <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-0.5">{ship.item_count || 0} {t("items_count")}</p>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
