import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Toaster } from "sonner";
import { 
  LayoutDashboard, 
  Package, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  Languages, 
  Moon,
  Sun,
  ScanLine,
  Boxes,
  Search,
  Truck,
  Activity,
  FileText,
  BarChart3,
  Loader2,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "./lib/utils";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

// Views
import DashboardView from "./views/DashboardView";
import InventoryView from "./views/InventoryView";
import ProductsView from "./views/ProductsView";
import SuppliersView from "./views/SuppliersView";
import ActivitiesView from "./views/ActivitiesView";
import InboundView from "./views/InboundView";
import OutboundView from "./views/OutboundView";
import StatisticsView from "./views/StatisticsView";
import ReportsView from "./views/ReportsView";
import ScannerView from "./views/ScannerView";
import SettingsView from "./views/SettingsView";
import LoginView from "./views/LoginView";

// Role-based nav config
type NavItem = {
  id: string;
  labelKey: string;
  icon: any;
  roles: string[]; // which roles can see this
};

const NAV_CONFIG: NavItem[] = [
  { id: "dashboard", labelKey: "dashboard", icon: LayoutDashboard, roles: ["admin", "manager", "worker"] },
  { id: "inventory", labelKey: "inventory", icon: Boxes, roles: ["admin", "manager", "worker"] },
  { id: "products", labelKey: "products", icon: Package, roles: ["admin", "manager", "worker"] },
  { id: "suppliers", labelKey: "suppliers", icon: Truck, roles: ["admin", "manager"] },
  { id: "inbound", labelKey: "inbound", icon: ArrowDownLeft, roles: ["admin", "manager", "worker"] },
  { id: "outbound", labelKey: "outbound", icon: ArrowUpRight, roles: ["admin", "manager", "worker"] },
  { id: "activities", labelKey: "activities", icon: Activity, roles: ["admin", "manager"] },
  { id: "statistics", labelKey: "statistics", icon: BarChart3, roles: ["admin", "manager"] },
  { id: "reports", labelKey: "reports", icon: FileText, roles: ["admin", "manager"] },
  { id: "scan", labelKey: "scan", icon: ScanLine, roles: ["admin", "manager", "worker"] },
  { id: "settings", labelKey: "settings", icon: Settings, roles: ["admin", "manager"] },
];

function AppShell() {
  const { t, i18n } = useTranslation();
  const { profile, logout, hasRole } = useAuth();
  const [isSidebarOpen, setSidebarOpen] = useState(window.innerWidth > 1024);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showModal, setShowModal] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('darkMode');
      if (saved !== null) return saved === 'true';
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', isDarkMode.toString());
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);
  const toggleSidebar = () => setSidebarOpen(!isSidebarOpen);
  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === "en" ? "vi" : "en");
  };

  const role = profile?.role || "worker";
  const navItems = NAV_CONFIG.filter((item) => item.roles.includes(role));

  const getRoleLabel = () => {
    if (role === "admin") return t("role_admin");
    if (role === "manager") return t("role_manager");
    return t("role_worker");
  };

  const getUserInitials = () => {
    const name = profile?.full_name || profile?.email || "U";
    const parts = name.split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="flex h-screen bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50 font-sans overflow-hidden relative transition-colors duration-300">
      <Toaster position="top-center" richColors theme={isDarkMode ? 'dark' : 'light'} />

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ 
          width: isSidebarOpen ? 260 : 80,
          x: isSidebarOpen ? 0 : (window.innerWidth < 1024 ? -260 : 0)
        }}
        className={cn(
          "bg-white dark:bg-neutral-950 border-r border-neutral-200 dark:border-neutral-700 flex flex-col h-full overflow-hidden z-50 transition-colors duration-300",
          "fixed inset-y-0 left-0 lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out",
          !isSidebarOpen && window.innerWidth < 1024 && "-translate-x-full"
        )}
      >
        <div className="p-6 flex items-center justify-between">
          <AnimatePresence mode="wait">
            {isSidebarOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2"
              >
                <div className="w-10 h-10 flex items-center justify-center overflow-hidden">
                  <img 
                    src="https://taikaseafood.com.vn/wp-content/uploads/2024/02/Layer_1.svg" 
                    alt="TAIKA Logo" 
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <h1 className="font-black text-xl tracking-tight text-taika-blue dark:text-blue-400">
                  TAIKA
                </h1>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={toggleSidebar}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors text-neutral-400 dark:text-neutral-500"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-4 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                if (window.innerWidth < 1024) setSidebarOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-4 p-3 rounded-xl transition-all duration-200 group relative",
                activeTab === item.id
                  ? "bg-taika-blue-light dark:bg-blue-500/10 text-taika-blue dark:text-blue-400 font-bold"
                  : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-50"
              )}
            >
              <item.icon size={22} className={cn(
                activeTab === item.id ? "text-taika-blue dark:text-blue-400" : "text-neutral-400 dark:text-neutral-500 group-hover:text-neutral-900 dark:hover:text-neutral-50"
              )} />
              <AnimatePresence mode="wait">
                {isSidebarOpen && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="whitespace-nowrap"
                  >
                    {t(item.labelKey)}
                  </motion.span>
                )}
              </AnimatePresence>
              {activeTab === item.id && (
                <motion.div
                  layoutId="activeNav"
                  className="absolute left-0 w-1.5 h-6 bg-taika-red rounded-r-full"
                />
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-neutral-100 dark:border-neutral-800 space-y-1 transition-colors duration-300">
          <button
            onClick={toggleLanguage}
            className="w-full flex items-center gap-4 p-3 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-xl transition-all"
          >
            <Languages size={22} />
            {isSidebarOpen && <span className="font-medium">{i18n.language.toUpperCase()}</span>}
          </button>
          <button 
            onClick={logout}
            className="w-full flex items-center gap-4 p-3 text-taika-red dark:text-red-400 hover:bg-taika-red-light dark:bg-red-500/10 rounded-xl transition-all"
          >
            <LogOut size={22} />
            {isSidebarOpen && <span className="font-medium">{t("logout")}</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden w-full">
        {/* Header */}
        <header className="h-16 bg-white dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between px-4 lg:px-8 z-10 transition-colors duration-300">
          <div className="flex items-center gap-3 lg:gap-4">
            <button
              onClick={toggleSidebar}
              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg lg:hidden text-neutral-400 dark:text-neutral-500"
            >
              <Menu size={20} />
            </button>
            <h2 className="text-base lg:text-lg font-bold text-neutral-900 dark:text-neutral-50 capitalize truncate max-w-[120px] sm:max-w-none">{t(activeTab)}</h2>
            <div className="hidden sm:block h-4 w-px bg-neutral-200" />
            <p className="hidden sm:block text-sm text-neutral-400 dark:text-neutral-500 font-medium">{new Date().toLocaleDateString()}</p>
          </div>
          <div className="flex items-center gap-3 lg:gap-6">
            <div className="relative hidden md:block">
              <input
                type="text"
                placeholder={t("search")}
                className="pl-10 pr-4 py-2 bg-neutral-100 dark:bg-neutral-800 border-none rounded-xl text-sm text-neutral-900 dark:text-neutral-50 focus:ring-2 focus:ring-taika-blue w-48 lg:w-64 transition-all outline-none"
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500">
                <Search size={16} />
              </div>
            </div>
            <div className="flex items-center gap-2 lg:gap-3 lg:pl-6 lg:border-l lg:border-neutral-200 dark:border-neutral-700 transition-colors duration-300">
              <button
                onClick={toggleDarkMode}
                className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-400 dark:text-neutral-500 transition-colors"
                title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-neutral-900 dark:text-neutral-50">{profile?.full_name || profile?.email || "User"}</p>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">{getRoleLabel()}</p>
              </div>
              <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-lg lg:rounded-xl bg-taika-blue flex items-center justify-center text-white font-bold shadow-lg shadow-taika-blue/10 text-xs lg:text-sm overflow-hidden">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  getUserInitials()
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 bg-neutral-50/50 dark:bg-neutral-900/50 transition-colors duration-300">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === "dashboard" && <DashboardView onAction={(action) => setShowModal(action)} />}
              {activeTab === "inventory" && <InventoryView onAction={(action) => setShowModal(action)} />}
              {activeTab === "products" && <ProductsView onAction={(action) => setShowModal(action)} />}
              {activeTab === "suppliers" && hasRole("admin", "manager") && <SuppliersView onAction={(action) => setShowModal(action)} />}
              {activeTab === "inbound" && <InboundView />}
              {activeTab === "outbound" && <OutboundView />}
              {activeTab === "activities" && hasRole("admin", "manager") && <ActivitiesView />}
              {activeTab === "statistics" && hasRole("admin", "manager") && <StatisticsView />}
              {activeTab === "reports" && hasRole("admin", "manager") && <ReportsView />}
              {activeTab === "scan" && <ScannerView />}
              {activeTab === "settings" && hasRole("admin", "manager") && <SettingsView />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Global Modals */}
        <AnimatePresence>
          {showModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowModal(null)}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative bg-white dark:bg-neutral-950 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden"
              >
                <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                  <h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 capitalize">
                    {showModal.replace("_", " ")}
                  </h3>
                  <button 
                    onClick={() => setShowModal(null)}
                    className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
                
                <div className="p-8 max-h-[70vh] overflow-y-auto">
                  {showModal === "add_product" && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-xs font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest">Product Name</label>
                          <input type="text" className="w-full p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-taika-blue font-medium" placeholder="e.g. Black Tiger Shrimp" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest">SKU Code</label>
                          <input type="text" className="w-full p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-taika-blue font-medium" placeholder="BT-HOSO-3040" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-xs font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest">Category</label>
                          <select className="w-full p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-medium">
                            <option>Raw Material</option>
                            <option>Processed</option>
                            <option>Finished Goods</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest">Unit</label>
                          <select className="w-full p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-medium">
                            <option>Kilogram (kg)</option>
                            <option>Metric Ton (MT)</option>
                            <option>Box (bx)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {showModal === "stock_take" && (
                    <div className="space-y-6">
                      <p className="text-neutral-500 dark:text-neutral-400 font-medium">Perform a physical inventory count for selected items.</p>
                      <div className="p-6 bg-taika-blue-light dark:bg-blue-500/10 rounded-3xl border border-taika-blue/20 flex items-center gap-4">
                        <div className="w-12 h-12 bg-white dark:bg-neutral-950 rounded-2xl flex items-center justify-center text-taika-blue dark:text-blue-400 shadow-sm">
                          <Boxes size={24} />
                        </div>
                        <div>
                          <p className="font-bold text-neutral-900 dark:text-neutral-50">Current Session: Monthly Audit</p>
                          <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">Started by {profile?.full_name || "Admin"} • {new Date().toLocaleTimeString()}</p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="flex items-center justify-between p-4 border border-neutral-100 dark:border-neutral-800 rounded-2xl">
                            <div>
                              <p className="font-bold text-neutral-900 dark:text-neutral-50">Product SKU #{i}00{i}</p>
                              <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">System: 450 kg</p>
                            </div>
                            <input type="number" className="w-32 p-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-taika-blue font-bold text-right" placeholder="Actual" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {showModal === "internal_transfer" && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-xs font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest">From Warehouse</label>
                          <select className="w-full p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-medium">
                            <option>Cold Storage A</option>
                            <option>Cold Storage B</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest">To Warehouse</label>
                          <select className="w-full p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-medium">
                            <option>Cold Storage B</option>
                            <option>Cold Storage A</option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest">Reason for Transfer</label>
                        <textarea className="w-full p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-taika-blue font-medium h-32" placeholder="e.g. Re-organizing stock for export shipment..." />
                      </div>
                    </div>
                  )}

                  {showModal === "add_supplier" && (
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-xs font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest">Supplier Name</label>
                        <input type="text" className="w-full p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-medium" placeholder="e.g. Mekong Delta Seafood Co." />
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-xs font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest">Contact Person</label>
                          <input type="text" className="w-full p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-medium" placeholder="Nguyen Van A" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest">Phone Number</label>
                          <input type="text" className="w-full p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-medium" placeholder="+84 123 456 789" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest">Address</label>
                        <input type="text" className="w-full p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-medium" placeholder="123 Tran Hung Dao, Can Tho" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-8 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex justify-end gap-4">
                  <button 
                    onClick={() => setShowModal(null)}
                    className="px-8 py-3 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 rounded-2xl font-bold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all"
                  >
                    {t("cancel")}
                  </button>
                  <button 
                    onClick={() => setShowModal(null)}
                    className="px-8 py-3 bg-taika-blue text-white rounded-2xl font-bold hover:bg-taika-blue/90 shadow-xl shadow-taika-blue/10 transition-all"
                  >
                    {t("confirm_action")}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <Toaster position="top-center" richColors />
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-taika-blue" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <Toaster position="top-center" richColors />
        <LoginView />
      </>
    );
  }

  return <AppShell />;
}
