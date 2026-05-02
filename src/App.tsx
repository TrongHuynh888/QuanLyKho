/**
 * src/App.tsx
 * Đây là Khung xương và Trung tâm điều phối giao diện chính (App Shell & Router) của hệ thống.
 * File này quy định:
 * 1. Cấu trúc hiển thị chung (Sidebar, Header, Khu vực nội dung Content ở giữa).
 * 2. Phân luồng điều hướng màn hình (Tab) thao tác trong kho và chặn thao tác khi chưa đăng nhập.
 * 3. Chứa các trạng thái chung của ứng dụng như Sáng/Tối (Dark mode), Đổi ngôn ngữ.
 */
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
  Info,
  Truck,
  Activity,
  FileText,
  BarChart3,
  Loader2,
  ArrowDownLeft,
  ArrowUpRight,
  Users,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "./lib/utils";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { PreferencesProvider, usePreferences } from "./contexts/PreferencesContext";

// Giao diện (Views)
import DashboardView from "./views/DashboardView";
import InventoryView from "./views/InventoryView";
import ProductsView from "./views/ProductsView";
import SuppliersView from "./views/SuppliersView";
import ActivitiesView from "./views/ActivitiesView";
import InboundView from "./views/InboundView";
import OutboundView from "./views/OutboundView";
import StatisticsView from "./views/StatisticsView";
import ReportsView from "./views/ReportsView";
import ProductDetailView from "./views/ProductDetailView";
import ScannerView from "./views/ScannerView";
import SettingsView from "./views/SettingsView";
import LoginView from "./views/LoginView";
import SupplierDetailView from "./views/SupplierDetailView";
import CustomersView from "./views/CustomersView";
import CustomerDetailView from "./views/CustomerDetailView";
import StockTakeModal from "./components/inventory/StockTakeModal";

// Cấu hình thanh điều hướng dựa trên vai trò (Role-based nav config)
type NavItem = {
  id: string;
  labelKey: string;
  icon: any;
  roles: string[]; // Các vai trò có thể nhìn thấy mục này
};

const NAV_CONFIG: NavItem[] = [
  { id: "dashboard", labelKey: "dashboard", icon: LayoutDashboard, roles: ["admin", "manager", "worker"] },
  { id: "inventory", labelKey: "inventory", icon: Boxes, roles: ["admin", "manager", "worker"] },
  { id: "products", labelKey: "products", icon: Package, roles: ["admin", "manager", "worker"] },
  { id: "suppliers", labelKey: "suppliers", icon: Truck, roles: ["admin", "manager", "worker"] },
  { id: "customers", labelKey: "customers", icon: Users, roles: ["admin", "manager", "worker"] },
  { id: "inbound", labelKey: "inbound", icon: ArrowDownLeft, roles: ["admin", "manager", "worker"] },
  { id: "outbound", labelKey: "outbound", icon: ArrowUpRight, roles: ["admin", "manager", "worker"] },
  { id: "activities", labelKey: "activities", icon: Activity, roles: ["admin", "manager", "worker"] },
  { id: "statistics", labelKey: "statistics", icon: BarChart3, roles: ["admin", "manager", "worker"] },
  { id: "reports", labelKey: "reports", icon: FileText, roles: ["admin", "manager", "worker"] },
  { id: "scan", labelKey: "scan", icon: ScanLine, roles: ["admin", "manager", "worker"] },
  { id: "settings", labelKey: "settings", icon: Settings, roles: ["admin", "manager", "worker"] },
];

/**
 * Component chính chứa layout tổng quan của ứng dụng.
 * Bao gồm Sidebar (thanh điều hướng) và Header, quản lý trạng thái điều hướng,
 * modal, giao diện sáng/tối và đa ngôn ngữ.
 * @returns {JSX.Element} Giao diện hệ thống
 */
function AppShell() {
  const { t, i18n } = useTranslation();
  const { profile, logout, hasRole } = useAuth();
  const [isSidebarOpen, setSidebarOpen] = useState(window.innerWidth > 1024);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [activeSupplierId, setActiveSupplierId] = useState<string | null>(null);
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [activeCustomerId, setActiveCustomerId] = useState<string | null>(null);
  const [supplierSection, setSupplierSection] = useState<"details" | "history">("details");
  const [showModal, setShowModal] = useState<string | null>(null);
  const [globalSearch, setGlobalSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchTip, setShowSearchTip] = useState(false);
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

  useEffect(() => {
    const handleNavSupplier = (e: any) => {
      if (e.detail?.id) {
        setActiveTab("suppliers");
        setActiveSupplierId(e.detail.id);
        setSupplierSection(e.detail.section || "details");
      }
    };
    const handleNavProduct = (e: any) => {
      if (e.detail?.id) {
        setActiveTab("products");
        setActiveProductId(e.detail.id);
      }
    };
    const handleNavCustomer = (e: any) => {
      if (e.detail?.id) {
        setActiveTab("customers");
        setActiveCustomerId(e.detail.id);
      }
    };
    const handleNavWarehouseLocation = (e: any) => {
      if (e.detail?.warehouseId) {
        const detail = { warehouseId: e.detail.warehouseId, locationId: e.detail.locationId };
        // Lưu cờ điều hướng tạm để InventoryView nhận diện khi mount
        (window as any).__pendingWarehouseNav = detail;
        setActiveTab("inventory");
        // Đồng thời dispatch sự kiện như một phương án dự phòng
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("navigate-to-warehouse-map", { detail }));
        }, 400);
      }
    };
    const handleNavShipment = (e: any) => {
      if (e.detail?.id) {
        (window as any).__pendingShipmentNav = e.detail.id;
        setActiveTab("inbound");
        setTimeout(() => window.dispatchEvent(new CustomEvent("focus-shipment", { detail: { id: e.detail.id } })), 400);
      }
    };
    const handleNavOrder = (e: any) => {
      if (e.detail?.id) {
        (window as any).__pendingOrderNav = e.detail.id;
        setActiveTab("outbound");
        setTimeout(() => window.dispatchEvent(new CustomEvent("focus-order", { detail: { id: e.detail.id } })), 400);
      }
    };

    const handleNavNewInbound = (e: any) => {
      if (e.detail?.items) {
        (window as any).__pendingScannedItems = e.detail.items;
        setActiveTab("inbound");
      }
    };
    const handleNavNewOutbound = (e: any) => {
      if (e.detail?.items) {
        (window as any).__pendingScannedItems = e.detail.items;
        setActiveTab("outbound");
      }
    };

    window.addEventListener("nav-supplier", handleNavSupplier);
    window.addEventListener("nav-product", handleNavProduct);
    window.addEventListener("nav-customer", handleNavCustomer);
    window.addEventListener("nav-warehouse-location", handleNavWarehouseLocation);
    window.addEventListener("nav-shipment", handleNavShipment);
    window.addEventListener("nav-order", handleNavOrder);
    window.addEventListener("nav-new-inbound-wizard", handleNavNewInbound);
    window.addEventListener("nav-new-outbound-wizard", handleNavNewOutbound);
    return () => {
      window.removeEventListener("nav-supplier", handleNavSupplier);
      window.removeEventListener("nav-product", handleNavProduct);
      window.removeEventListener("nav-customer", handleNavCustomer);
      window.removeEventListener("nav-customer", handleNavCustomer);
      window.removeEventListener("nav-warehouse-location", handleNavWarehouseLocation);
      window.removeEventListener("nav-shipment", handleNavShipment);
      window.removeEventListener("nav-order", handleNavOrder);
      window.removeEventListener("nav-new-inbound-wizard", handleNavNewInbound);
      window.removeEventListener("nav-new-outbound-wizard", handleNavNewOutbound);
    };
  }, []);

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

      {/* Lớp phủ Sidebar trên thiết bị di động */}
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

      {/* Thanh điều hướng bên (Sidebar) */}
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
                setActiveSupplierId(null);
                setActiveProductId(null);
                setActiveCustomerId(null);
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

      {/* Khu vực nội dung chính */}
      <main className="flex-1 flex flex-col overflow-hidden w-full">
        {/* Phần đầu trang (Header) */}
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
            <div className="relative hidden md:block" ref={(() => {
              const ref = { current: null as HTMLDivElement | null };
              return (el: HTMLDivElement | null) => {
                ref.current = el;
                // Close dropdown on outside click
                const handler = (e: MouseEvent) => {
                  if (ref.current && !ref.current.contains(e.target as Node)) {
                    setSearchResults([]);
                  }
                };
                if (el) {
                  document.addEventListener("mousedown", handler);
                } else {
                  document.removeEventListener("mousedown", handler);
                }
              };
            })()}>
              <input
                type="text"
                placeholder={t("search")}
                value={globalSearch}
                onChange={async (e) => {
                  const val = e.target.value;
                  setGlobalSearch(val);
                  if (val.trim().length >= 1) {
                    try {
                      const res = await fetch(`/api/search?q=${encodeURIComponent(val.trim())}`);
                      const data = await res.json();
                      setSearchResults(data);
                    } catch { setSearchResults([]); }
                  } else {
                    setSearchResults([]);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") { setSearchResults([]); setGlobalSearch(""); }
                }}
                className="pl-10 pr-4 py-2 bg-neutral-100 dark:bg-neutral-800 border-none rounded-xl text-sm text-neutral-900 dark:text-neutral-50 focus:ring-2 focus:ring-taika-blue w-48 lg:w-64 transition-all outline-none"
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500">
                <Search size={16} />
              </div>
              {/* Dropdown kết quả tìm kiếm */}
              {searchResults.length > 0 && (
                <div className="absolute top-full mt-2 left-0 w-[360px] bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-2xl shadow-2xl shadow-black/10 dark:shadow-black/30 overflow-hidden z-[200] max-h-[420px] overflow-y-auto">
                  <div className="p-3 border-b border-neutral-100 dark:border-neutral-800">
                    <p className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Tìm thấy {searchResults.length} kết quả</p>
                  </div>
                  {searchResults.map((r: any, i: number) => (
                    <button
                      key={`${r.type}-${r.id}-${i}`}
                      onClick={() => {
                        setSearchResults([]);
                        setGlobalSearch("");
                        // Điều hướng đến đúng tab + chi tiết
                        if (r.type === "product") {
                          setActiveTab("products");
                          setActiveProductId(r.id);
                        } else if (r.type === "supplier") {
                          setActiveTab("suppliers");
                          setActiveSupplierId(r.id);
                          setSupplierSection("details");
                        } else if (r.type === "customer") {
                          setActiveTab("customers");
                          setActiveCustomerId(r.id);
                        } else if (r.type === "warehouse") {
                          (window as any).__pendingWarehouseNav = { warehouseId: r.id };
                          setActiveTab("inventory");
                          setTimeout(() => window.dispatchEvent(new CustomEvent("navigate-to-warehouse-map", { detail: { warehouseId: r.id } })), 400);
                        } else if (r.type === "inbound") {
                          (window as any).__pendingShipmentNav = r.id;
                          setActiveTab("inbound");
                          setTimeout(() => window.dispatchEvent(new CustomEvent("focus-shipment", { detail: { id: r.id } })), 400);
                        } else if (r.type === "outbound") {
                          (window as any).__pendingOrderNav = r.id;
                          setActiveTab("outbound");
                          setTimeout(() => window.dispatchEvent(new CustomEvent("focus-order", { detail: { id: r.id } })), 400);
                        }
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors text-left border-b border-neutral-50 dark:border-neutral-900 last:border-0"
                    >
                      <span className="text-lg shrink-0">{r.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate">{r.title}</p>
                        <p className="text-[11px] text-neutral-400 dark:text-neutral-500 truncate">{r.subtitle}</p>
                      </div>
                      <span className="text-[9px] font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-wider shrink-0">
                        {r.type === "product" ? "Sản phẩm" : 
                         r.type === "supplier" ? "NCC" : 
                         r.type === "customer" ? "Khách hàng" : 
                         r.type === "warehouse" ? "Kho" : 
                         r.type === "inbound" ? "Nhập kho" : "Xuất kho"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Nút hướng dẫn tìm kiếm */}
            <div className="relative hidden md:block">
              <button
                onClick={() => setShowSearchTip(!showSearchTip)}
                className={cn("p-2 rounded-lg transition-colors", showSearchTip ? "bg-taika-blue-light dark:bg-blue-500/10 text-taika-blue dark:text-blue-400" : "text-neutral-400 dark:text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-600")}
              >
                <Info size={16} />
              </button>
              <AnimatePresence>
                {showSearchTip && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute top-full mt-2 right-0 w-[320px] bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-2xl shadow-2xl shadow-black/10 p-5 z-[200]"
                  >
                    <p className="text-xs font-black text-neutral-900 dark:text-neutral-50 mb-3 uppercase tracking-wide">📖 Hướng dẫn tìm kiếm</p>
                    <ul className="space-y-2.5 text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                      <li className="flex gap-2"><span className="shrink-0">📦</span><span><b className="text-neutral-700 dark:text-neutral-300">Sản phẩm:</b> tên, mã SKU, danh mục</span></li>
                      <li className="flex gap-2"><span className="shrink-0">🚚</span><span><b className="text-neutral-700 dark:text-neutral-300">Nhà cung cấp:</b> tên, SĐT, email, địa chỉ</span></li>
                      <li className="flex gap-2"><span className="shrink-0">👥</span><span><b className="text-neutral-700 dark:text-neutral-300">Khách hàng:</b> tên, SĐT, email</span></li>
                      <li className="flex gap-2"><span className="shrink-0">🏭</span><span><b className="text-neutral-700 dark:text-neutral-300">Kho hàng:</b> tên, mã kho, vị trí, ghi chú</span></li>
                      <li className="flex gap-2"><span className="shrink-0">📥</span><span><b className="text-neutral-700 dark:text-neutral-300">Phiếu nhập/xuất:</b> tên NCC/khách, mã phiếu</span></li>
                    </ul>
                    <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                      <p className="text-[10px] text-neutral-400 dark:text-neutral-500"><b>💡 Mẹo:</b> Dùng <kbd className="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded text-[9px] font-mono font-bold">dấu phẩy</kbd> hoặc <kbd className="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded text-[9px] font-mono font-bold">khoảng trắng</kbd> để tìm nhiều từ khóa cùng lúc. Nhập càng nhiều → lọc càng chính xác.</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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
              <div className={cn(
                  "p-[3px] rounded-lg lg:rounded-xl",
                  role === "admin"
                    ? "bg-gradient-to-br from-red-500 via-red-400 to-orange-500"
                    : role === "manager"
                    ? "bg-gradient-to-br from-blue-500 via-taika-blue to-cyan-400"
                    : "bg-gradient-to-br from-neutral-400 via-neutral-300 to-neutral-400"
                )}>
                <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-[calc(0.5rem-3px)] lg:rounded-[calc(0.75rem-3px)] bg-taika-blue flex items-center justify-center text-white font-bold text-xs lg:text-sm overflow-hidden">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  getUserInitials()
                )}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Khu vực hiển thị nội dung tùy theo Tab */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 bg-neutral-50/50 dark:bg-neutral-900/50 transition-colors duration-300">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === "dashboard" && <DashboardView onAction={(action) => {
                if (action === "internal_transfer") {
                  setActiveTab("inventory");
                  // Bắn sự kiện để InventoryView kích hoạt chế độ chuyển kho (bulk mode)
                  setTimeout(() => window.dispatchEvent(new CustomEvent("activate-bulk-transfer")), 100);
                } else if (action === "activities") {
                  setActiveTab("activities");
                } else {
                  setShowModal(action);
                }
              }} />}
              {activeTab === "inventory" && <InventoryView onAction={(action) => setShowModal(action)} />}
              {activeTab === "products" && (
                activeProductId ? (
                  <ProductDetailView productId={activeProductId} onBack={() => setActiveProductId(null)} />
                ) : (
                  <ProductsView onAction={(action) => setShowModal(action)} />
                )
              )}
              {activeTab === "suppliers" && (
                activeSupplierId ? (
                  <SupplierDetailView supplierId={activeSupplierId} defaultSection={supplierSection} onBack={() => setActiveSupplierId(null)} />
                ) : (
                  <SuppliersView onNavigateDetail={(id, section) => { setActiveSupplierId(id); setSupplierSection(section || "details"); }} />
                )
              )}
              {activeTab === "customers" && (
                activeCustomerId ? (
                  <CustomerDetailView customerId={activeCustomerId} onBack={() => setActiveCustomerId(null)} />
                ) : (
                  <CustomersView onNavigateDetail={(id) => setActiveCustomerId(id)} />
                )
              )}
              {activeTab === "inbound" && <InboundView />}
              {activeTab === "outbound" && <OutboundView />}
              {activeTab === "activities" && <ActivitiesView />}
              {activeTab === "statistics" && <StatisticsView />}
              {activeTab === "reports" && <ReportsView />}
              {activeTab === "scan" && <ScannerView />}
              {activeTab === "settings" && <SettingsView />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Các Modal dùng chung (Global Modals) */}
        <AnimatePresence>
          {showModal && showModal !== "stock_take" && (
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

        <StockTakeModal isOpen={showModal === "stock_take"} onClose={() => setShowModal(null)} />
      </main>
    </div>
  );
}

/**
 * Component gốc của ứng dụng (Root Component).
 * Bọc toàn bộ ứng dụng bằng các Provider (Auth, Preferences) để chia sẻ state toàn cục.
 * @returns {JSX.Element}
 */
export default function App() {
  return (
    <AuthProvider>
      <PreferencesProvider>
        <AppContent />
      </PreferencesProvider>
    </AuthProvider>
  );
}

/**
 * Component điều hướng dựa trên trạng thái xác thực (Authentication).
 * Hiển thị màn hình chờ khi đang tải, màn hình Login nếu chưa đăng nhập,
 * hoặc layout chính (AppShell) nếu đã đăng nhập thành công. Lắng nghe cấu hình đổi nền tối/sáng.
 * @returns {JSX.Element}
 */
function AppContent() {
  const { user, loading } = useAuth();
  const { preferences } = usePreferences();

  useEffect(() => {
    if (preferences.theme_mode === "dark") {
      document.documentElement.classList.add("dark");
    } else if (preferences.theme_mode === "light") {
      document.documentElement.classList.remove("dark");
    } else {
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  }, [preferences.theme_mode]);

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
