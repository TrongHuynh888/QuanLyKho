import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { Users, Phone, Mail, Plus, Search, Filter, Pencil, Trash2, ArrowRight, User, MapPin, FileText } from "lucide-react";
import type { Customer } from "../types/supabase";
import CustomerFormModal from "../components/customers/CustomerFormModal";

interface CustomersViewProps {
  onNavigateDetail: (id: string) => void;
}

export default function CustomersView({ onNavigateDetail }: CustomersViewProps) {
  const { t } = useTranslation();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/customers");
      if (!res.ok) throw new Error("Could not fetch customers");
      const data = await res.json();
      setCustomers(data || []);
    } catch (err: any) {
      toast.error(err.message);
    }
    setLoading(false);
  };

  useEffect(() => { fetchCustomers(); }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm(t("confirm_delete_customer"))) return;
    try {
      const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      toast.success(t("customer_deleted"));
      fetchCustomers();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const filtered = customers.filter(c => {
    const matchesSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search);
    const matchesFilter = statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesFilter;
  });

  const handleSaved = () => {
    setShowModal(false);
    setEditCustomer(null);
    fetchCustomers();
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
          <h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">{t("customers")}</h3>
          <p className="text-sm text-neutral-400 dark:text-neutral-500 font-medium mt-1">
            {t("total_customers")}: {customers.length}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
             <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t("search_customers")} className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 text-sm font-medium transition-all text-neutral-900 dark:text-neutral-50" />
          </div>
          <div className="relative">
             <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
             <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="appearance-none pl-9 pr-8 py-2.5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 text-sm font-medium transition-all text-neutral-900 dark:text-neutral-50 cursor-pointer">
                <option value="all">{t("all_statuses")}</option>
                <option value="active">{t("status_active")}</option>
                <option value="pending">{t("status_pending")}</option>
                <option value="inactive">{t("status_inactive")}</option>
             </select>
          </div>
          <button 
            onClick={() => { setEditCustomer(null); setShowModal(true); }}
            className="px-5 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-orange-500/10 hover:bg-orange-600 transition-all shrink-0"
          >
            <Plus size={16} /> {t("add_customer")}
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
            <Users size={48} className="text-neutral-300 dark:text-neutral-600 mb-4" />
            <p className="text-neutral-500 font-medium">{search ? t("no_customers_found") : t("no_customers_yet")}</p>
         </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((customer, i) => {
            const st = statusConfig[customer.status] || statusConfig.active;
            return (
              <motion.div
                key={customer.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white dark:bg-neutral-950 p-5 rounded-3xl border border-neutral-200 dark:border-neutral-700/80 shadow-sm hover:shadow-md hover:border-neutral-300 dark:hover:border-neutral-700 transition-all group flex flex-col"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="w-10 h-10 bg-orange-50 dark:bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-500 dark:text-orange-400 shrink-0">
                    <Users size={20} />
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditCustomer(customer); setShowModal(true); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:text-orange-500 dark:hover:text-orange-400 transition-colors">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDelete(customer.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                
                <div className="mb-4">
                  <h4 className="text-base font-bold text-neutral-900 dark:text-neutral-50 truncate" title={customer.name}>{customer.name}</h4>
                  <span className={cn("inline-block px-2 py-0.5 mt-1 rounded text-[10px] font-black uppercase tracking-widest", st.color)}>
                    {st.label}
                  </span>
                </div>

                <div className="space-y-2 mb-4 flex-1">
                  <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                    <User size={12} className="text-neutral-400 dark:text-neutral-500 shrink-0" />
                    <span className="truncate">{customer.contact_person || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                    <Phone size={12} className="text-neutral-400 dark:text-neutral-500 shrink-0" />
                    <span className="truncate">{customer.phone || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                    <Mail size={12} className="text-neutral-400 dark:text-neutral-500 shrink-0" />
                    <span className="truncate" title={customer.email || ""}>{customer.email || "—"}</span>
                  </div>
                  {customer.address && (
                    <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                      <MapPin size={12} className="text-neutral-400 dark:text-neutral-500 shrink-0" />
                      <span className="truncate" title={customer.address}>{customer.address}</span>
                    </div>
                  )}
                </div>

                <button 
                  type="button"
                  onClick={() => onNavigateDetail(customer.id)}
                  className="w-full py-2.5 bg-neutral-50 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:text-orange-500 dark:hover:text-orange-400 rounded-xl text-xs font-bold hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-all flex items-center justify-center gap-2 group border border-transparent hover:border-orange-200 dark:hover:border-orange-500/20"
                >
                  {t("details")} & {t("export_history")} 
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
          <CustomerFormModal 
            customer={editCustomer} 
            onClose={() => { setShowModal(false); setEditCustomer(null); }} 
            onSaved={handleSaved} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
