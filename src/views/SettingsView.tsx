import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth, UserProfile } from "../contexts/AuthContext";
import { usePreferences } from "../contexts/PreferencesContext";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import {
  LayoutDashboard,
  Boxes,
  Package,
  Settings,
  Plus,
  X,
  Users,
  Shield,
  ShieldCheck,
  UserCog,
  Trash2,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  ChevronDown,
  Upload,
  Link,
  Camera,
  Pencil,
  CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import CategoriesUoMSection from "./CategoriesUomSection";

export default function SettingsView() {
  const { t, i18n } = useTranslation();
  const { profile: currentUser, hasRole, setProfile } = useAuth();
  const [activeSection, setActiveSection] = useState("profile");
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatar_url || "");
  const [avatarLinkInput, setAvatarLinkInput] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarTab, setAvatarTab] = useState<"upload" | "link">("upload");
  const { preferences, updatePreferences } = usePreferences();

  const isAdmin = hasRole("admin");
  const sections = [
    { id: "profile", label: t("user_profile"), icon: LayoutDashboard },
    { id: "users", label: t("user_management"), icon: Users },
    { id: "warehouse", label: t("warehouse_management"), icon: Boxes },
    ...(isAdmin ? [
      { id: "system", label: t("system_preferences"), icon: Settings },
      { id: "categories", label: t("categories_uom"), icon: Package },
    ] : []),
  ];

  const getRoleLabel = (role: string) => {
    if (role === "admin") return t("role_admin");
    if (role === "manager") return t("role_manager");
    return t("role_worker");
  };

  const getUserInitials = (name?: string | null, email?: string | null) => {
    const n = name || email || "U";
    const parts = n.split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return n.substring(0, 2).toUpperCase();
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 w-full max-w-[1600px] mx-auto transition-all duration-300">
      {/* Settings Navigation */}
      <div className="lg:w-64 flex flex-col gap-2">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={cn(
              "flex items-center gap-3 p-4 rounded-2xl font-bold text-sm transition-all text-left",
              activeSection === section.id
                ? "bg-taika-blue text-white shadow-lg shadow-taika-blue/10"
                : "bg-white dark:bg-neutral-950 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-50 border border-neutral-200 dark:border-neutral-700"
            )}
          >
            <section.icon size={18} />
            <span>{section.label}</span>
          </button>
        ))}
      </div>

      {/* Settings Content */}
      <div className="flex-1 bg-white dark:bg-neutral-950 rounded-[2rem] border border-neutral-200 dark:border-neutral-700 shadow-sm p-8">
        {/* ────── Profile Section ────── */}
        {activeSection === "profile" && (
          <div className="space-y-8">
            <div className="flex items-center gap-6">
              <div
                className="relative w-24 h-24 rounded-3xl overflow-hidden bg-taika-blue-light dark:bg-blue-500/10 flex items-center justify-center text-taika-blue dark:text-blue-400 font-bold text-3xl shadow-inner cursor-pointer group"
                onClick={() => setShowAvatarModal(true)}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  getUserInitials(currentUser?.full_name, currentUser?.email)
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-3xl">
                  <Camera size={24} className="text-white" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">{currentUser?.full_name || "—"}</h3>
                <p className="text-neutral-400 dark:text-neutral-500 font-medium">{getRoleLabel(currentUser?.role || "worker")} • TAIKA SEAFOOD</p>
                <button onClick={() => setShowAvatarModal(true)} className="mt-2 text-sm font-bold text-taika-blue dark:text-blue-400 hover:underline">{t("change_avatar")}</button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest">{t("full_name")}</label>
                <input type="text" defaultValue={currentUser?.full_name || ""} className="w-full p-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-taika-blue font-medium text-neutral-900 dark:text-neutral-50" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest">{t("email_address")}</label>
                <input type="email" defaultValue={currentUser?.email || ""} disabled className="w-full p-3 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none font-medium text-neutral-500 dark:text-neutral-400 cursor-not-allowed" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest">{t("role")}</label>
                <input type="text" value={getRoleLabel(currentUser?.role || "worker")} disabled className="w-full p-3 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none font-medium text-neutral-500 dark:text-neutral-400 cursor-not-allowed" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest">{t("language")}</label>
                <select 
                  value={i18n.language}
                  onChange={(e) => i18n.changeLanguage(e.target.value)}
                  className="w-full p-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-taika-blue font-medium text-neutral-900 dark:text-neutral-50"
                >
                  <option value="en">English</option>
                  <option value="vi">Tiếng Việt</option>
                </select>
              </div>
            </div>

            <div className="pt-6 border-t border-neutral-100 dark:border-neutral-800 flex justify-end gap-3">
              <button className="px-6 py-2.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 rounded-xl font-bold text-sm hover:bg-neutral-200 transition-all">{t("cancel")}</button>
              <button className="px-6 py-2.5 bg-taika-blue text-white rounded-xl font-bold text-sm hover:bg-taika-blue/90 shadow-lg shadow-taika-blue/10 transition-all">{t("save_changes")}</button>
            </div>
          </div>
        )}

        {/* ────── User Management Section ────── */}
        {activeSection === "users" && (
          <UserManagementSection isAdmin={isAdmin} currentUserId={currentUser?.id || ""} />
        )}

        {/* ────── Warehouse Section ────── */}
        {activeSection === "warehouse" && (
          <WarehouseManagementSection isAdmin={isAdmin} />
        )}

        {/* ────── System Preferences (Admin only) ────── */}
        {activeSection === "system" && isAdmin && (
          <div className="space-y-8">
            <div>
              <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">{t("system_preferences")}</h3>
              <p className="text-sm text-neutral-400 dark:text-neutral-500 mt-1">Cấu hình tự động & quy trình nòng cốt của phần mềm</p>
            </div>
            
            <div className="space-y-8">
              {/* Approval Workflows */}
              <div className="space-y-4">
                <h4 className="text-sm font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest">Quy trình & Kiểm duyệt</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start justify-between p-4 border border-neutral-100 dark:border-neutral-800 rounded-2xl bg-white dark:bg-neutral-950">
                    <div className="pr-4">
                      <p className="font-bold text-neutral-900 dark:text-neutral-50 text-sm">Bắt buộc QA Nhập Kho</p>
                      <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium mt-1">Hàng nhập mới tự động bị Hold chờ kiểm duyệt</p>
                    </div>
                    <button onClick={() => updatePreferences({ require_qa_inbound: !preferences.require_qa_inbound })} className={cn("w-12 h-6 rounded-full relative transition-colors shrink-0", preferences.require_qa_inbound ? "bg-taika-blue" : "bg-neutral-200 dark:bg-neutral-700")}>
                      <div className={cn("absolute top-1 w-4 h-4 bg-white dark:bg-neutral-950 rounded-full transition-all", preferences.require_qa_inbound ? "right-1" : "left-1")} />
                    </button>
                  </div>
                  
                  <div className="flex items-start justify-between p-4 border border-neutral-100 dark:border-neutral-800 rounded-2xl bg-white dark:bg-neutral-950">
                    <div className="pr-4">
                      <p className="font-bold text-neutral-900 dark:text-neutral-50 text-sm">Xuất kho 2 bước (2-Step)</p>
                      <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium mt-1">Phiếu xuất tạo ra sẽ lưu ở dạng Pending Pick chờ xác nhận lần 2</p>
                    </div>
                    <button onClick={() => updatePreferences({ two_step_outbound: !preferences.two_step_outbound })} className={cn("w-12 h-6 rounded-full relative transition-colors shrink-0", preferences.two_step_outbound ? "bg-taika-blue" : "bg-neutral-200 dark:bg-neutral-700")}>
                      <div className={cn("absolute top-1 w-4 h-4 bg-white dark:bg-neutral-950 rounded-full transition-all", preferences.two_step_outbound ? "right-1" : "left-1")} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Formats & Defaults */}
              <div className="space-y-4">
                <h4 className="text-sm font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest">Tiêu chuẩn Hệ thống & Tài chính</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-900 dark:text-neutral-50">Định dạng Mã Lô tự động</label>
                    <input type="text" value={preferences.lot_number_format} onChange={(e) => updatePreferences({ lot_number_format: e.target.value })} className="w-full p-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-taika-blue font-mono text-sm" placeholder="LOT-{YYYYMMDD}-{XXXX}" />
                    <p className="text-[10px] text-neutral-400">Từ khóa hỗ trợ: {'{YYYYMMDD}'}, {'{XXXX}'}</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-900 dark:text-neutral-50">Thuế Nhập Kho mặc định (%)</label>
                    <input type="number" step="0.1" value={preferences.default_tax_rate} onChange={(e) => updatePreferences({ default_tax_rate: parseFloat(e.target.value) || 0 })} className="w-full p-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-taika-blue font-bold text-sm" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-900 dark:text-neutral-50">Ngày cảnh báo cận Date (FEFO)</label>
                    <input type="number" value={preferences.fefo_warning_days} onChange={(e) => updatePreferences({ fefo_warning_days: parseInt(e.target.value) || 0 })} className="w-full p-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-taika-blue font-bold text-sm" />
                    <p className="text-[10px] text-neutral-400">Đánh dấu đỏ những lô hàng Seafood sát date hơn ngưỡng này</p>
                  </div>
                </div>
              </div>

              {/* Advanced UI & Visuals */}
              <div className="space-y-4">
                <h4 className="text-sm font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest">Giao diện & Tiện ích</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-900 dark:text-neutral-50">Giao diện toàn hệ thống (Theme)</label>
                    <select value={preferences.theme_mode} onChange={(e) => updatePreferences({ theme_mode: e.target.value })} className="w-full p-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-taika-blue font-bold text-sm">
                      <option value="auto">Tự động (Theo thiết bị)</option>
                      <option value="light">Chế độ Sáng (Light Mode)</option>
                      <option value="dark">Chế độ Tối (Dark Mode)</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between p-4 border border-neutral-100 dark:border-neutral-800 rounded-2xl bg-white dark:bg-neutral-950 h-[50px] mt-6">
                    <span className="font-bold text-neutral-900 dark:text-neutral-50 text-sm">Âm thanh quét mã (Beep)</span>
                    <button onClick={() => updatePreferences({ scanner_sound_enabled: !preferences.scanner_sound_enabled })} className={cn("w-12 h-6 rounded-full relative transition-colors shrink-0", preferences.scanner_sound_enabled ? "bg-taika-blue" : "bg-neutral-200 dark:bg-neutral-700")}>
                      <div className={cn("absolute top-1 w-4 h-4 bg-white dark:bg-neutral-950 rounded-full transition-all", preferences.scanner_sound_enabled ? "right-1" : "left-1")} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ────── Categories (Admin only) ────── */}
        {activeSection === "categories" && isAdmin && (
          <CategoriesUoMSection />
        )}
      </div>

      {/* ── Avatar Modal ── */}
      <AnimatePresence>
        {showAvatarModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAvatarModal(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative bg-white dark:bg-neutral-950 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden">
              <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">{t("change_avatar")}</h3>
                <button onClick={() => setShowAvatarModal(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl"><X size={20} /></button>
              </div>

              <div className="p-8 space-y-6">
                {/* Preview */}
                <div className="flex justify-center">
                  <div className="w-28 h-28 rounded-3xl overflow-hidden bg-taika-blue-light dark:bg-blue-500/10 flex items-center justify-center text-taika-blue dark:text-blue-400 font-bold text-4xl shadow-inner">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      getUserInitials(currentUser?.full_name, currentUser?.email)
                    )}
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex bg-neutral-100 dark:bg-neutral-800 rounded-2xl p-1">
                  <button
                    onClick={() => setAvatarTab("upload")}
                    className={cn("flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all",
                      avatarTab === "upload" ? "bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50 shadow-sm" : "text-neutral-500")}
                  >
                    <Upload size={16} /> {t("upload_image_tab", "Tải ảnh lên")}
                  </button>
                  <button
                    onClick={() => setAvatarTab("link")}
                    className={cn("flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all",
                      avatarTab === "link" ? "bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50 shadow-sm" : "text-neutral-500")}
                  >
                    <Link size={16} /> {t("online_image_link_tab", "Link ảnh online")}
                  </button>
                </div>

                {avatarTab === "upload" ? (
                  <div>
                    <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-2xl cursor-pointer hover:border-taika-blue dark:hover:border-blue-400 transition-colors bg-neutral-50/50 dark:bg-neutral-900/50">
                      <Upload size={32} className="text-neutral-400 dark:text-neutral-500 mb-2" />
                      <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{t("click_to_upload_avatar", "Click để chọn ảnh (max 5MB)")}</span>
                      <span className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">JPG, PNG, WebP</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 5 * 1024 * 1024) { toast.error(t("avatar_size_error", "Ảnh tối đa 5MB")); return; }
                          setAvatarUploading(true);
                          try {
                            const formData = new FormData();
                            formData.append("file", file);
                            const res = await fetch("/api/upload/avatar", { method: "POST", body: formData });
                            const data = await res.json();
                            if (!res.ok) throw new Error(data.error);
                            // Save to DB
                            await fetch(`/api/users/${currentUser?.id}/avatar`, {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ avatar_url: data.url }),
                            });
                            setAvatarUrl(data.url);
                            if (currentUser) setProfile({ ...currentUser, avatar_url: data.url });
                            toast.success(t("avatar_updated", "Đã cập nhật ảnh đại diện!"));
                            setShowAvatarModal(false);
                          } catch (err: any) { toast.error(err.message || t("upload_error", "Lỗi upload")); }
                          setAvatarUploading(false);
                        }}
                      />
                    </label>
                    {avatarUploading && (
                      <div className="flex items-center justify-center gap-2 mt-4 text-sm text-neutral-500">
                        <Loader2 size={16} className="animate-spin" /> {t("uploading", "Đang tải lên...")}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em] mb-2">{t("image_url", "URL ảnh")}</label>
                      <input
                        type="url"
                        value={avatarLinkInput}
                        onChange={(e) => setAvatarLinkInput(e.target.value)}
                        className="w-full px-5 py-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-taika-blue text-neutral-900 dark:text-neutral-50"
                        placeholder="https://example.com/avatar.jpg"
                      />
                    </div>
                    <button
                      onClick={async () => {
                        if (!avatarLinkInput) return;
                        setAvatarUploading(true);
                        try {
                          await fetch(`/api/users/${currentUser?.id}/avatar`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ avatar_url: avatarLinkInput }),
                          });
                          setAvatarUrl(avatarLinkInput);
                          if (currentUser) setProfile({ ...currentUser, avatar_url: avatarLinkInput });
                          toast.success(t("avatar_updated", "Đã cập nhật ảnh đại diện!"));
                          setShowAvatarModal(false);
                          setAvatarLinkInput("");
                        } catch { toast.error(t("update_error", "Không thể cập nhật")); }
                        setAvatarUploading(false);
                      }}
                      disabled={avatarUploading || !avatarLinkInput}
                      className="w-full py-3 bg-taika-blue text-white rounded-2xl font-bold text-sm hover:bg-taika-blue/90 shadow-lg shadow-taika-blue/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {avatarUploading ? <Loader2 size={16} className="animate-spin" /> : null}
                      {t("save_image_link", "Lưu link ảnh")}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ══════════════════════════════════════════
// User Management Sub-component
// ══════════════════════════════════════════
function UserManagementSection({ isAdmin, currentUserId }: { isAdmin: boolean; currentUserId: string }) {
  const { t } = useTranslation();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<string | null>(null);

  // Create user form
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newRole, setNewRole] = useState("worker");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => { fetchUsers(); }, []);

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed");
      setUsers(await res.json());
    } catch { toast.error(t("error_loading_data")); }
    setLoading(false);
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail, password: newPassword, full_name: newFullName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (newRole !== "worker" && data.user) {
        await fetch(`/api/users/${data.user.id}/role`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: newRole }),
        });
      }
      toast.success(t("account_created", { email: newEmail }));
      setShowCreateModal(false);
      setNewEmail(""); setNewPassword(""); setNewFullName(""); setNewRole("worker");
      fetchUsers();
    } catch (err: any) { toast.error(err.message || t("signup_error")); }
    setCreating(false);
  }

  async function handleChangeRole(userId: string, role: string) {
    try {
      const res = await fetch(`/api/users/${userId}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("role_updated", "Đã cập nhật vai trò"));
      setEditingRole(null);
      fetchUsers();
    } catch { toast.error(t("role_update_error", "Không thể cập nhật vai trò")); }
  }

  async function handleDeleteUser(userId: string) {
    try {
      const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("account_deleted", "Đã xóa tài khoản"));
      setShowDeleteConfirm(null);
      fetchUsers();
    } catch { toast.error(t("account_delete_error", "Không thể xóa tài khoản")); }
  }

  const getRoleIcon = (role: string) => {
    if (role === "admin") return <ShieldCheck size={14} className="text-taika-red" />;
    if (role === "manager") return <Shield size={14} className="text-taika-blue" />;
    return <UserCog size={14} className="text-neutral-400" />;
  };

  const getRoleBadge = (role: string) => {
    const styles: Record<string, string> = {
      admin: "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400",
      manager: "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400",
      worker: "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400",
    };
    const labels: Record<string, string> = {
      admin: t("role_admin"), manager: t("role_manager"), worker: t("role_worker"),
    };
    return (
      <span className={cn("px-3 py-1 text-xs font-bold rounded-full flex items-center gap-1.5 w-fit", styles[role])}>
        {getRoleIcon(role)} {labels[role]}
      </span>
    );
  };

  const getInitials = (name?: string | null, email?: string | null) => {
    const n = name || email || "U";
    const parts = n.split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return n.substring(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-taika-blue" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">{t("user_management")}</h3>
          <p className="text-sm text-neutral-400 dark:text-neutral-500 mt-1">{t("accounts_count", { count: users.length })}</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 bg-taika-blue text-white rounded-2xl text-sm font-bold hover:bg-taika-blue/90 shadow-lg shadow-taika-blue/10 transition-all flex items-center gap-2"
          >
            <Plus size={16} /> {t("create_account")}
          </button>
        )}
      </div>

      {/* Users List */}
      <div className="space-y-3">
        {users.map((user, i) => {
          const isSelf = user.id === currentUserId;
          return (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="p-5 border border-neutral-100 dark:border-neutral-800 rounded-2xl bg-neutral-50/50 dark:bg-neutral-900/50 flex items-center justify-between hover:border-taika-blue/20 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm",
                  user.role === "admin" ? "bg-gradient-to-br from-red-500 to-red-600" :
                  user.role === "manager" ? "bg-gradient-to-br from-taika-blue to-blue-600" :
                  "bg-gradient-to-br from-neutral-400 to-neutral-500"
                )}>
                  {getInitials(user.full_name, user.email)}
                </div>
                <div>
                  <p className="font-bold text-neutral-900 dark:text-neutral-50 text-sm">
                    {user.full_name || "—"}
                    {isSelf && <span className="text-xs text-taika-blue ml-2">({t("you")})</span>}
                  </p>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 font-mono">{user.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Role badge or editor */}
                {isAdmin && editingRole === user.id ? (
                  <div className="flex items-center gap-2">
                    <select
                      defaultValue={user.role}
                      onChange={(e) => handleChangeRole(user.id, e.target.value)}
                      className="px-3 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-taika-blue"
                    >
                      <option value="admin">{t("role_admin")}</option>
                      <option value="manager">{t("role_manager")}</option>
                      <option value="worker">{t("role_worker")}</option>
                    </select>
                    <button onClick={() => setEditingRole(null)} className="p-1 text-neutral-400 hover:text-neutral-600">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => isAdmin && !isSelf && setEditingRole(user.id)}
                    className={cn("group flex items-center gap-1", isAdmin && !isSelf && "cursor-pointer")}
                    disabled={!isAdmin || isSelf}
                  >
                    {getRoleBadge(user.role)}
                    {isAdmin && !isSelf && <ChevronDown size={12} className="text-neutral-300 opacity-0 group-hover:opacity-100 transition-opacity" />}
                  </button>
                )}

                {/* Delete button (admin only, not self) */}
                {isAdmin && !isSelf && (
                  <button
                    onClick={() => setShowDeleteConfirm(user.id)}
                    className="p-2 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg text-neutral-300 dark:text-neutral-600 hover:text-red-500 dark:hover:text-red-400 transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── Create User Modal ── */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCreateModal(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative bg-white dark:bg-neutral-950 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden">
              <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">{t("create_new_account", "Tạo tài khoản mới")}</h3>
                <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl"><X size={20} /></button>
              </div>
              <form onSubmit={handleCreateUser} className="p-8 space-y-5">
                <div>
                  <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em] mb-2">{t("full_name_label")}</label>
                  <input type="text" value={newFullName} onChange={(e) => setNewFullName(e.target.value)} className="w-full px-5 py-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-taika-blue text-neutral-900 dark:text-neutral-50" placeholder="Nguyễn Văn A" required />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em] mb-2">Email</label>
                  <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-full px-5 py-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-taika-blue text-neutral-900 dark:text-neutral-50" placeholder="nhanvien@taika.vn" required />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em] mb-2">{t("password")}</label>
                  <div className="relative">
                    <input type={showNewPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-5 py-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-taika-blue pr-12 text-neutral-900 dark:text-neutral-50" placeholder={t("min_6_chars", "Tối thiểu 6 ký tự")} required minLength={6} />
                    <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
                      {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em] mb-2">{t("role")}</label>
                  <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="w-full px-5 py-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-taika-blue text-neutral-900 dark:text-neutral-50">
                    <option value="worker">{t("role_worker")}</option>
                    <option value="manager">{t("role_manager")}</option>
                    <option value="admin">{t("role_admin")}</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 py-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl font-bold text-sm text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all">{t("cancel")}</button>
                  <button type="submit" disabled={creating} className="flex-1 py-4 bg-taika-blue text-white rounded-2xl font-bold text-sm hover:bg-taika-blue/90 shadow-xl shadow-taika-blue/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {creating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />} {t("create_btn", "Tạo")}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Delete Confirmation ── */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDeleteConfirm(null)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative bg-white dark:bg-neutral-950 w-full max-w-md rounded-[2rem] shadow-2xl p-8 text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <AlertCircle size={32} className="text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-50 mb-2">{t("delete_account_title", "Xóa tài khoản?")}</h3>
              <p className="text-sm text-neutral-400 dark:text-neutral-500 mb-8">{t("delete_account_warn", "Hành động này không thể hoàn tác.")}</p>
              <div className="flex gap-3">
                <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 py-3 bg-neutral-100 dark:bg-neutral-800 rounded-2xl font-bold text-sm text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all">{t("cancel")}</button>
                <button onClick={() => handleDeleteUser(showDeleteConfirm)} className="flex-1 py-3 bg-red-500 text-white rounded-2xl font-bold text-sm hover:bg-red-600 shadow-lg shadow-red-500/20 transition-all">{t("delete_btn", "Xóa")}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ══════════════════════════════════════════════
// Warehouse Management Sub-component
// ══════════════════════════════════════════════
type WHForm = { name: string; code: string; location: string; temperature_zone: string; total_zones: number; zones_per_row: number | null; area_sqm: number | null; max_capacity_kg: number | null; manager_name: string; manager_phone: string; status: string; notes: string; racks_per_zone: number; bins_per_rack: number; bin_capacity_kg: number; zone_prefix: string; rack_prefix: string; bin_prefix: string; };
type SLoc = { id: string; zone: string; rack: string | null; bin: string | null; capacity: number; status: string };

function WarehouseManagementSection({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useTranslation();
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedWh, setExpandedWh] = useState<string | null>(null);
  const [locations, setLocations] = useState<Record<string, SLoc[]>>({});
  const [loadingLoc, setLoadingLoc] = useState<string | null>(null);

  const [showAddWh, setShowAddWh] = useState(false);
  const [editingWh, setEditingWh] = useState<any | null>(null);
  const [deleteWhId, setDeleteWhId] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);

  const emptyForm: WHForm = { name: "", code: "", location: "", temperature_zone: "", total_zones: 4, zones_per_row: null, area_sqm: null, max_capacity_kg: null, manager_name: "", manager_phone: "", status: "active", notes: "", racks_per_zone: 3, bins_per_rack: 6, bin_capacity_kg: 5000, zone_prefix: "Z", rack_prefix: "R", bin_prefix: "B" };
  const [form, setForm] = useState<WHForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [editingLocId, setEditingLocId] = useState<string | null>(null);
  const [locStatus, setLocStatus] = useState<string>("active");
  const [locCapacity, setLocCapacity] = useState<number>(5000);
  const [deletingLocId, setDeletingLocId] = useState<string | null>(null);

  useEffect(() => { fetchWarehouses(); }, []);

  async function fetchWarehouses() {
    setLoading(true);
    try {
      const res = await fetch("/api/warehouses");
      setWarehouses(await res.json());
    } catch { toast.error(t("error_loading_data")); }
    setLoading(false);
  }

  async function fetchLocations(whId: string) {
    setLoadingLoc(whId);
    try {
      const res = await fetch(`/api/warehouses/${whId}/storage-locations`);
      const data = await res.json();
      setLocations((prev) => ({ ...prev, [whId]: data }));
    } catch { }
    setLoadingLoc(null);
  }

  async function handleSaveWarehouse(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      const isNew = !editingWh;
      const url = editingWh ? `/api/warehouses/${editingWh.id}` : "/api/warehouses";
      const res = await fetch(url, { method: editingWh ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (isNew && data?.id) {
        const zp = form.zone_prefix || "Z"; const rp = form.rack_prefix || "R"; const bp = form.bin_prefix || "B";
        const zones = Array.from({ length: form.total_zones }, (_, i) => `${zp}${i + 1}`);
        await fetch(`/api/warehouses/${data.id}/generate-locations`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ zones, racks_per_zone: form.racks_per_zone, bins_per_rack: form.bins_per_rack, capacity: form.bin_capacity_kg, rack_prefix: rp, bin_prefix: bp }),
        });
      }

      toast.success(isNew ? "Đã thêm kho mới và tạo lưới!" : "Đã cập nhật kho");
      setShowAddWh(false); setEditingWh(null); setForm(emptyForm); fetchWarehouses();
    } catch (err: any) { toast.error(err.message); }
    setSaving(false);
  }

  async function handleDeleteWarehouse() {
    if (!deleteWhId) return;
    try {
      const res = await fetch(`/api/warehouses/${deleteWhId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Đã xóa kho"); setDeleteWhId(null); fetchWarehouses();
    } catch (err: any) { toast.error(err.message); }
  }



  async function handleSaveLocation(locId: string, whId: string) {
    try {
      const res = await fetch(`/api/storage-locations/${locId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: locStatus, capacity: locCapacity }) });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Đã cập nhật vị trí"); setEditingLocId(null); fetchLocations(whId);
    } catch (err: any) { toast.error(err.message); }
  }

  async function handleDeleteLocation(locId: string, whId: string) {
    try {
      const res = await fetch(`/api/storage-locations/${locId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Đã xóa vị trí"); setDeletingLocId(null); fetchLocations(whId);
    } catch (err: any) { toast.error(err.message); }
  }

  const statusColors: Record<string, string> = {
    active: "bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400",
    maintenance: "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400",
    blocked: "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400",
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-taika-blue w-8 h-8" /></div>;

  return (
    <div className="space-y-6">
      {/* Left Column: Warehouse List */}
      <div className="w-full transition-all duration-300 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">{t("warehouse_management")}</h3>
            <p className="text-sm text-neutral-400 dark:text-neutral-500 mt-0.5">{t("warehouses_count", { count: warehouses.length })}</p>
          </div>
          {isAdmin && !showAddWh && (
            <button onClick={() => { setEditingWh(null); setForm(emptyForm); setShowAddWh(true); }}
              className="px-5 py-2.5 bg-taika-blue text-white rounded-2xl text-sm font-bold hover:bg-taika-blue/90 shadow-lg shadow-taika-blue/10 transition-all flex items-center gap-2">
              <Plus size={16} /> {t("add_warehouse")}
            </button>
          )}
        </div>

        <div className="space-y-3">
        {warehouses.map((wh, i) => {
          const isExpanded = expandedWh === wh.id;
          const locs = locations[wh.id] || [];
          return (
            <motion.div key={wh.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="border border-neutral-200 dark:border-neutral-700 rounded-2xl overflow-hidden bg-neutral-50/50 dark:bg-neutral-900/50">
              <div className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white dark:bg-neutral-950 rounded-xl border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-taika-blue dark:text-blue-400 shadow-sm">
                    <Boxes size={22} />
                  </div>
                  <div>
                    <h4 className="font-bold text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
                      {wh.name}
                      {wh.code && <span className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-[10px] font-black rounded-lg text-neutral-500">{wh.code}</span>}
                    </h4>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium mt-0.5">
                      {wh.location || "—"} • {wh.temperature_zone || "—"} • {wh.total_zones} zone
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <>
                      <button onClick={() => { setEditingWh(wh); setForm({ name: wh.name, code: wh.code || "", location: wh.location || "", temperature_zone: wh.temperature_zone || "", total_zones: wh.total_zones, zones_per_row: wh.zones_per_row || null, area_sqm: wh.area_sqm || null, max_capacity_kg: wh.max_capacity_kg || null, manager_name: wh.manager_name || "", manager_phone: wh.manager_phone || "", status: wh.status || "active", notes: wh.notes || "", racks_per_zone: wh.racks_per_zone || 3, bins_per_rack: wh.bins_per_rack || 6, bin_capacity_kg: wh.bin_capacity_kg || 5000, zone_prefix: wh.zone_prefix || "Z", rack_prefix: wh.rack_prefix || "R", bin_prefix: wh.bin_prefix || "B" }); setShowAddWh(true); }}
                        className="p-2 text-neutral-400 hover:text-taika-blue hover:bg-taika-blue/10 rounded-xl transition-all"><Settings size={16} /></button>
                      <button onClick={() => setDeleteWhId(wh.id)}
                        className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all"><Trash2 size={16} /></button>
                    </>
                  )}
                  <button onClick={() => { if (isExpanded) { setExpandedWh(null); } else { setExpandedWh(wh.id); if (!locations[wh.id]) fetchLocations(wh.id); } }}
                    className="p-2 text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-50 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-all">
                    <ChevronDown size={16} className={cn("transition-transform", isExpanded && "rotate-180")} />
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                    <div className="border-t border-neutral-200 dark:border-neutral-700 px-5 py-4 bg-white dark:bg-neutral-950">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
                          {t("storage_locations_count", { count: locs.length })}
                        </p>
                        {loadingLoc === wh.id && <Loader2 size={14} className="animate-spin text-taika-blue" />}
                      </div>
                      {locs.length === 0 ? (
                        <div className="py-8 text-center border border-dashed border-neutral-200 dark:border-neutral-700 rounded-xl">
                          <p className="text-sm text-neutral-400 dark:text-neutral-500">
                            {t("no_locations_empty_state", "Chưa có vị trí. Hãy chỉnh sửa Cấu hình Sơ đồ của kho để hệ thống tự động tạo lại lưới.")}
                          </p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm border-collapse">
                            <thead>
                              <tr className="border-b border-neutral-100 dark:border-neutral-800">
                                {["Zone", "Rack", "Bin", t("col_capacity_kg", "Sức chứa (kg)"), t("col_status", "Trạng thái"), ""].map((h, index) => (
                                  <th key={index} className="pb-2.5 pr-4 text-[10px] font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-50 dark:divide-neutral-900">
                              {locs.map((loc) => (
                                <tr key={loc.id} className="group hover:bg-neutral-50 dark:hover:bg-neutral-900/50">
                                  <td className="py-2.5 pr-4 font-mono font-bold text-neutral-900 dark:text-neutral-50 text-xs">{loc.zone}</td>
                                  <td className="py-2.5 pr-4 font-mono text-neutral-500 dark:text-neutral-400 text-xs">{loc.rack || "—"}</td>
                                  <td className="py-2.5 pr-4 font-mono text-neutral-500 dark:text-neutral-400 text-xs">{loc.bin || "—"}</td>
                                  <td className="py-2.5 pr-4 text-neutral-500 dark:text-neutral-400 text-xs">
                                    {editingLocId === loc.id
                                      ? <input type="number" value={locCapacity} onChange={(e) => setLocCapacity(Number(e.target.value))} className="w-24 px-2 py-1 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs outline-none focus:ring-1 focus:ring-taika-blue" />
                                      : (loc.capacity || 5000).toLocaleString()}
                                  </td>
                                  <td className="py-2.5 pr-4">
                                    {editingLocId === loc.id
                                      ? <select value={locStatus} onChange={(e) => setLocStatus(e.target.value)} className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-bold outline-none">
                                          <option value="active">{t("active")}</option>
                                          <option value="maintenance">{t("maintenance")}</option>
                                          <option value="blocked">{t("blocked")}</option>
                                        </select>
                                      : <span className={cn("px-2 py-0.5 text-[11px] font-bold rounded-md", statusColors[loc.status] || statusColors.active)}>{t(loc.status) || loc.status}</span>
                                    }
                                  </td>
                                  <td className="py-2.5">
                                    {isAdmin && (
                                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {editingLocId === loc.id
                                          ? <>
                                              <button onClick={() => handleSaveLocation(loc.id, wh.id)} className="px-2.5 py-1 bg-taika-blue text-white text-xs font-bold rounded-lg hover:bg-taika-blue/90">Lưu</button>
                                              <button onClick={() => setEditingLocId(null)} className="p-1 text-neutral-400 hover:text-neutral-600 rounded-lg"><X size={14} /></button>
                                            </>
                                          : <>
                                              <button onClick={() => { setEditingLocId(loc.id); setLocStatus(loc.status || "active"); setLocCapacity(loc.capacity || 5000); }}
                                                className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-taika-blue transition-all"><Settings size={13} /></button>
                                              <button onClick={() => setDeletingLocId(loc.id)}
                                                className="p-1.5 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg text-neutral-400 hover:text-red-500 transition-all"><Trash2 size={13} /></button>
                                            </>
                                        }
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
        {warehouses.length === 0 && (
          <div className="py-16 text-center border border-dashed border-neutral-300 dark:border-neutral-700 rounded-2xl">
            <Boxes size={40} className="mx-auto text-neutral-300 dark:text-neutral-600 mb-3" />
            <p className="text-neutral-400 dark:text-neutral-500 font-medium">{t("no_warehouses_empty_state", "Chưa có kho nào. Hãy thêm kho đầu tiên!")}</p>
          </div>
        )}
      </div>
      </div>

      {/* Add/Edit Modal (Wide) */}
      <AnimatePresence>
        {showAddWh && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddWh(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white dark:bg-neutral-950 w-full max-w-5xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-7 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between shrink-0">
                <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">{editingWh ? t("edit_warehouse", "Chỉnh sửa kho") : t("add_new_warehouse", "Thêm kho mới")}</h3>
                <button onClick={() => setShowAddWh(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl"><X size={20} /></button>
              </div>
              <form id="wh-form" onSubmit={handleSaveWarehouse} className="p-7 overflow-y-auto flex-1 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                  {/* Cột 1: Thông tin cơ bản & Quản lý */}
                  <div className="space-y-6">
                    {/* === Thông tin cơ bản === */}
                    <div>
                      <p className="text-[10px] font-black text-taika-blue uppercase tracking-[0.2em] mb-4">{t("basic_info", "Thông tin cơ bản")}</p>
                {[
                  { label: "Tên kho *", key: "name", placeholder: "Kho lạnh A", required: true },
                  { label: "Mã kho (Code) *", key: "code", placeholder: "KLA", required: true, uppercase: true },
                  { label: t("warehouse_location", "Địa điểm"), key: "location", placeholder: "KCN Trà Nóc, Cần Thơ" },
                  { label: t("warehouse_temp_zone", "Vùng nhiệt độ"), key: "temperature_zone", placeholder: "-18", unit: "°C" },
                ].map(({ label, key, placeholder, required, unit, uppercase }) => (
                  <div key={key} className="mb-4">
                    <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em] mb-2">{label}</label>
                    <div className="relative">
                      <input value={(form as any)[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: uppercase ? e.target.value.toUpperCase() : e.target.value }))}
                        placeholder={placeholder} required={required}
                        className={cn(
                          "w-full px-5 py-3.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-taika-blue text-neutral-900 dark:text-neutral-50",
                          unit && "pr-12"
                        )} />
                      {unit && <span className="absolute right-5 top-1/2 -translate-y-1/2 text-sm font-bold text-neutral-400 select-none pointer-events-none">{unit}</span>}
                    </div>
                  </div>
                ))}
                    <div className="mb-4">
                    <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em] mb-2">{t("warehouse_status", "Trạng thái")}</label>
                    <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                      className="w-full px-5 py-3.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-taika-blue text-neutral-900 dark:text-neutral-50">
                      <option value="active">🟢 {t("active", "Hoạt động")}</option>
                      <option value="maintenance">🟡 {t("maintenance", "Bảo trì")}</option>
                      <option value="inactive">🔴 {t("inactive", "Ngừng hoạt động")}</option>
                    </select>
                    </div>
                    </div>

                    {/* === Thông số kho === */}
                    <div className="border-t border-neutral-100 dark:border-neutral-800 pt-5">
                      <p className="text-[10px] font-black text-taika-blue uppercase tracking-[0.2em] mb-4">{t("warehouse_stats", "Thông số kho")}</p>
                      <div className="flex gap-4 mb-4">
                        <div className="flex-1">
                          <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em] mb-2">{t("area_sqm", "Diện tích (m²)")}</label>
                          <div className="relative">
                            <input type="number" min="0" step="0.1" value={form.area_sqm || ''} placeholder="VD: 500" onChange={(e) => setForm((f) => ({ ...f, area_sqm: e.target.value ? Number(e.target.value) : null }))}
                              className="w-full pl-5 pr-12 py-3.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-taika-blue text-neutral-900 dark:text-neutral-50" />
                            <span className="absolute right-5 top-1/2 -translate-y-1/2 text-sm font-bold text-neutral-400 select-none pointer-events-none">m²</span>
                          </div>
                        </div>
                        <div className="flex-1">
                          <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em] mb-2">{t("max_capacity_kg", "Sức chứa tối đa (kg)")}</label>
                          <div className="relative">
                            <input type="number" min="0" step="1" value={form.max_capacity_kg || ''} placeholder="VD: 50000" onChange={(e) => setForm((f) => ({ ...f, max_capacity_kg: e.target.value ? Number(e.target.value) : null }))}
                              className="w-full pl-5 pr-12 py-3.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-taika-blue text-neutral-900 dark:text-neutral-50" />
                            <span className="absolute right-5 top-1/2 -translate-y-1/2 text-sm font-bold text-neutral-400 select-none pointer-events-none">kg</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* === Người quản lý === */}
                    <div className="border-t border-neutral-100 dark:border-neutral-800 pt-5">
                      <p className="text-[10px] font-black text-taika-blue uppercase tracking-[0.2em] mb-4">{t("manager", "Người quản lý")}</p>
                      <div className="flex gap-4 mb-4">
                        <div className="flex-1">
                          <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em] mb-2">{t("manager_name", "Họ tên quản lý")}</label>
                          <input value={form.manager_name} onChange={(e) => setForm((f) => ({ ...f, manager_name: e.target.value }))}
                            placeholder="Nguyễn Văn A"
                            className="w-full px-5 py-3.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-taika-blue text-neutral-900 dark:text-neutral-50" />
                        </div>
                        <div className="flex-1">
                          <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em] mb-2">{t("manager_phone", "Số điện thoại")}</label>
                          <input value={form.manager_phone} onChange={(e) => setForm((f) => ({ ...f, manager_phone: e.target.value }))}
                            placeholder="0901 234 567"
                            className="w-full px-5 py-3.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-taika-blue text-neutral-900 dark:text-neutral-50" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Cột 2: Cấu hình lưới & Ghi chú */}
                  <div className="space-y-6">
                    {/* === Cấu hình Zone === */}
                    <div>
                      <p className="text-[10px] font-black text-taika-blue uppercase tracking-[0.2em] mb-4">{t("grid_config", "Cấu hình Sơ đồ")}</p>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em] mb-2">{t("num_zones", "Số khu vực (Zone)")}</label>
                      <input type="number" min="1" max="50" value={form.total_zones} onChange={(e) => setForm((f) => ({ ...f, total_zones: Number(e.target.value) }))}
                        className="w-full px-5 py-3.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-taika-blue text-neutral-900 dark:text-neutral-50" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em] mb-2">{t("racks_per_zone", "Số kệ (Rack) MỖI KHU")}</label>
                      <input type="number" min="1" max="50" value={form.racks_per_zone} onChange={(e) => setForm((f) => ({ ...f, racks_per_zone: Number(e.target.value) }))}
                        className="w-full px-5 py-3.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-taika-blue text-neutral-900 dark:text-neutral-50" />
                    </div>
                  </div>
                  
                  <div className="flex gap-4 mt-4">
                    <div className="flex-1">
                      <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em] mb-2">{t("bins_per_rack", "Số ô (Bin) MỖI KỆ")}</label>
                      <input type="number" min="1" max="50" value={form.bins_per_rack} onChange={(e) => setForm((f) => ({ ...f, bins_per_rack: Number(e.target.value) }))}
                        className="w-full px-5 py-3.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-taika-blue text-neutral-900 dark:text-neutral-50" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em] mb-2">{t("capacity_per_bin_kg", "Sức chứa 1 ô (kg)")}</label>
                      <div className="relative">
                        <input type="number" min="1" value={form.bin_capacity_kg} onChange={(e) => setForm((f) => ({ ...f, bin_capacity_kg: Number(e.target.value) }))}
                          className="w-full pl-5 pr-12 py-3.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-taika-blue text-neutral-900 dark:text-neutral-50" />
                        <span className="absolute right-5 top-1/2 -translate-y-1/2 text-sm font-bold text-neutral-400 select-none pointer-events-none">kg</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex mt-4">
                    <div className="flex-1">
                      <label className="flex items-center gap-2 text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em] mb-2">
                         {t("grid_layout", "Giao diện: Khu vực / Cột")}
                         <div className="group relative cursor-help">
                           <AlertCircle size={12} />
                           <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 opacity-0 group-hover:opacity-100 transition-opacity bg-neutral-800 text-white text-xs p-2 rounded-lg z-50">
                             {t("grid_layout_hint", "Gói gọn số zone trên mỗi hàng để vừa màn hình. Để trống = 1 hàng ngang.")}
                           </div>
                         </div>
                      </label>
                      <input type="number" min="0" max="50" value={form.zones_per_row || ''} placeholder="Mặc định" onChange={(e) => setForm((f) => ({ ...f, zones_per_row: e.target.value ? Number(e.target.value) : null }))}
                        className="w-full px-5 py-3.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-taika-blue text-neutral-900 dark:text-neutral-50" />
                    </div>
                    </div>

                    {/* === Mã tiền tố === */}
                    <div className="border-t border-neutral-100 dark:border-neutral-800 pt-5 mt-5">
                      <p className="text-[10px] font-black text-taika-blue uppercase tracking-[0.2em] mb-4">{t("prefix_config", "Mã tiền tố")}</p>
                      <div className="flex gap-3">
                        {[
                          { label: "Khu vực (Zone)", key: "zone_prefix", placeholder: "Z" },
                          { label: "Kệ (Rack)", key: "rack_prefix", placeholder: "R" },
                          { label: "Ô (Bin)", key: "bin_prefix", placeholder: "B" },
                        ].map(({ label, key, placeholder }) => (
                          <div key={key} className="flex-1">
                            <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em] mb-2">{label}</label>
                            <input
                              value={(form as any)[key]}
                              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value.toUpperCase() }))}
                              placeholder={placeholder}
                              maxLength={5}
                              className="w-full px-4 py-3.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-sm font-bold text-center outline-none focus:ring-2 focus:ring-taika-blue text-neutral-900 dark:text-neutral-50 tracking-widest uppercase"
                            />
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-2">
                        {t("prefix_preview", "VD vị trí:")}{" "}
                        <span className="font-bold text-neutral-600 dark:text-neutral-300 font-mono">
                          {form.code ? `${form.code}-` : ""}{form.zone_prefix || "Z"}1 → {form.rack_prefix || "R"}1 → {form.bin_prefix || "B"}1
                        </span>
                      </p>
                    </div>
                    </div>

                  {/* Kết quả dự kiến */}
                  <div className="mt-5 p-5 bg-neutral-50 dark:bg-[#0a0f14] border border-neutral-200 dark:border-neutral-800/50 rounded-2xl">
                    <p className="text-sm font-bold text-taika-blue mb-4">{t("expected_result", "Kết quả dự kiến")}</p>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-2xl font-black text-neutral-900 dark:text-neutral-50 tabular-nums">{form.total_zones * form.racks_per_zone * form.bins_per_rack} <span className="text-sm font-bold text-neutral-400">{t("locations_count", "vị trí")}</span></p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">{form.total_zones} khu vực ({form.zone_prefix || "Z"}) × {form.racks_per_zone} kệ ({form.rack_prefix || "R"}) × {form.bins_per_rack} ô ({form.bin_prefix || "B"})</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black text-taika-blue tabular-nums">{(form.total_zones * form.racks_per_zone * form.bins_per_rack * form.bin_capacity_kg).toLocaleString()} <span className="text-sm font-bold text-neutral-400">kg</span></p>
                        <button type="button" onClick={() => setForm(f => ({ ...f, max_capacity_kg: form.total_zones * form.racks_per_zone * form.bins_per_rack * form.bin_capacity_kg }))} 
                          className="mt-2 px-3 py-1.5 bg-taika-blue/10 dark:bg-taika-blue/20 text-taika-blue rounded hover:bg-taika-blue hover:text-white transition-all text-xs font-bold">
                          {t("fill_max_capacity", "Điền vào Sức chứa tối đa")}
                        </button>
                      </div>
                    </div>
                    {/* === Ghi chú === */}
                    <div className="border-t border-neutral-100 dark:border-neutral-800 pt-5">
                      <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em] mb-2">{t("notes", "Ghi chú")}</label>
                      <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                        placeholder={t("notes_placeholder", "Ghi chú thêm về kho...")}
                        rows={3}
                        className="w-full px-5 py-3.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-taika-blue text-neutral-900 dark:text-neutral-50 resize-none" />
                    </div>
                  </div>
                </div>
                </div>
              </form>
              <div className="p-5 border-t border-neutral-100 dark:border-neutral-800 flex gap-3 shrink-0 bg-neutral-50 dark:bg-neutral-900/50">
                <button type="button" onClick={() => setShowAddWh(false)} className="flex-1 py-3.5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-2xl font-bold text-sm text-neutral-500 hover:bg-neutral-50 transition-all">{t("cancel")}</button>
                <button type="submit" form="wh-form" disabled={saving} className="flex-1 py-3.5 bg-taika-blue text-white rounded-2xl font-bold text-sm hover:bg-taika-blue/90 shadow-xl shadow-taika-blue/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />} {editingWh ? t("update", "Cập nhật") : t("add_warehouse_btn", "Thêm kho")}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>



      {/* Delete Warehouse Confirm */}
      <AnimatePresence>
        {deleteWhId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteWhId(null)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="relative bg-white dark:bg-neutral-950 w-full max-w-md rounded-[2rem] shadow-2xl p-8 text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6"><AlertCircle size={32} className="text-red-500" /></div>
              <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-50 mb-2">{t("delete_warehouse_title", "Xóa kho hàng?")}</h3>
              <p className="text-sm text-neutral-400 dark:text-neutral-500 mb-8">{t("delete_warehouse_warn", "Tất cả vị trí lưu trữ sẽ bị xóa. Không thể hoàn tác.")}</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteWhId(null)} className="flex-1 py-3 bg-neutral-100 dark:bg-neutral-800 rounded-2xl font-bold text-sm text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 transition-all">{t("cancel")}</button>
                <button onClick={handleDeleteWarehouse} className="flex-1 py-3 bg-red-500 text-white rounded-2xl font-bold text-sm hover:bg-red-600 shadow-lg transition-all">{t("delete_warehouse_btn", "Xóa kho")}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Location Confirm */}
      <AnimatePresence>
        {deletingLocId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeletingLocId(null)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="relative bg-white dark:bg-neutral-950 w-full max-w-sm rounded-[2rem] shadow-2xl p-8 text-center">
              <div className="w-14 h-14 bg-red-100 dark:bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5"><AlertCircle size={28} className="text-red-500" /></div>
              <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-50 mb-2">{t("delete_location_title", "Xóa vị trí này?")}</h3>
              <p className="text-sm text-neutral-400 dark:text-neutral-500 mb-6">{t("delete_warn", "Không thể hoàn tác.")}</p>
              <div className="flex gap-3">
                <button onClick={() => setDeletingLocId(null)} className="flex-1 py-3 bg-neutral-100 dark:bg-neutral-800 rounded-2xl font-bold text-sm text-neutral-600 dark:text-neutral-300">{t("cancel")}</button>
                <button onClick={() => {
                  const whId = Object.keys(locations).find((wid) => locations[wid].some((l) => l.id === deletingLocId));
                  if (whId) handleDeleteLocation(deletingLocId, whId);
                }} className="flex-1 py-3 bg-red-500 text-white rounded-2xl font-bold text-sm hover:bg-red-600 shadow-lg transition-all">{t("delete_btn", "Xóa")}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
