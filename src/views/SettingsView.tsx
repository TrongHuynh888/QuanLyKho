import React, { useState, useEffect, useRef } from "react";
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
  Info,
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

/**
 * Component hiển thị giao diện cài đặt hệ thống
 * Cung cấp khả năng cập nhật hồ sơ, quản lý người dùng, quản lý kho bãi tùy theo phân quyền
 *
 * @returns {JSX.Element} Giao diện Cài đặt
 */
export default function SettingsView() {
  const { t, i18n } = useTranslation();
  const { profile: currentUser, hasRole, setProfile } = useAuth();
  const [activeSection, setActiveSection] = useState("profile");
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatar_url || "");
  const [avatarLinkInput, setAvatarLinkInput] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarTab, setAvatarTab] = useState<"upload" | "link">("upload");
  const [showBorderHint, setShowBorderHint] = useState(false);
  const borderHintRef = useRef<HTMLDivElement>(null);
  const { preferences, updatePreferences } = usePreferences();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (borderHintRef.current && !borderHintRef.current.contains(e.target as Node)) {
        setShowBorderHint(false);
      }
    }
    if (showBorderHint) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showBorderHint]);

  const isAdmin = hasRole("admin");
  const sections = [
    { id: "profile", label: t("user_profile"), icon: LayoutDashboard },
    ...(isAdmin ? [
      { id: "users", label: t("user_management"), icon: Users },
      { id: "warehouse", label: t("warehouse_management"), icon: Boxes },
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
      {/* Điều hướng Cài đặt */}
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

      {/* Nội dung Cài đặt */}
      <div className="flex-1 bg-white dark:bg-neutral-950 rounded-[2rem] border border-neutral-200 dark:border-neutral-700 shadow-sm p-8">
        {/* ────── Phần Hồ sơ cá nhân ────── */}
        {activeSection === "profile" && (
          <div className="space-y-8">
            <div className="flex items-center gap-6">
              <div
                className={cn(
                  "p-[3px] rounded-[1.5rem] cursor-pointer",
                  currentUser?.role === "admin"
                    ? "bg-gradient-to-br from-red-500 via-red-400 to-orange-500 shadow-lg shadow-red-500/20"
                    : currentUser?.role === "manager"
                    ? "bg-gradient-to-br from-blue-500 via-taika-blue to-cyan-400 shadow-lg shadow-blue-500/20"
                    : "bg-gradient-to-br from-neutral-400 via-neutral-300 to-neutral-400 shadow-lg shadow-neutral-400/10"
                )}
                onClick={() => setShowAvatarModal(true)}
              >
                <div
                  className="relative w-24 h-24 rounded-[calc(1.5rem-3px)] overflow-hidden bg-taika-blue-light dark:bg-blue-500/10 flex items-center justify-center text-taika-blue dark:text-blue-400 font-bold text-3xl shadow-inner group"
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

        {/* ────── Phần Quản lý Người dùng ────── */}
        {activeSection === "users" && (
          <UserManagementSection isAdmin={isAdmin} currentUserId={currentUser?.id || ""} />
        )}

        {/* ────── Phần Quản lý Kho bãi ────── */}
        {activeSection === "warehouse" && (
          <WarehouseManagementSection isAdmin={isAdmin} />
        )}

        {/* ────── Phần Cấu hình Hệ thống (Chỉ dành cho Admin) ────── */}
        {activeSection === "system" && isAdmin && (
          <div className="space-y-8">
            <div>
              <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">{t("system_preferences")}</h3>
              <p className="text-sm text-neutral-400 dark:text-neutral-500 mt-1">{t("sp_subtitle")}</p>
            </div>
            
            <div className="space-y-8">
              {/* Approval Workflows */}
              <div className="space-y-4">
                <h4 className="text-sm font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest">{t("sp_workflow")}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start justify-between p-4 border border-neutral-100 dark:border-neutral-800 rounded-2xl bg-white dark:bg-neutral-950">
                    <div className="pr-4">
                      <p className="font-bold text-neutral-900 dark:text-neutral-50 text-sm">{t("sp_require_qa")}</p>
                      <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium mt-1">{t("sp_require_qa_desc")}</p>
                    </div>
                    <button onClick={() => updatePreferences({ require_qa_inbound: !preferences.require_qa_inbound })} className={cn("w-12 h-6 rounded-full relative transition-colors shrink-0", preferences.require_qa_inbound ? "bg-taika-blue" : "bg-neutral-200 dark:bg-neutral-700")}>
                      <div className={cn("absolute top-1 w-4 h-4 bg-white dark:bg-neutral-950 rounded-full transition-all", preferences.require_qa_inbound ? "right-1" : "left-1")} />
                    </button>
                  </div>
                  
                  <div className="flex items-start justify-between p-4 border border-neutral-100 dark:border-neutral-800 rounded-2xl bg-white dark:bg-neutral-950">
                    <div className="pr-4">
                      <p className="font-bold text-neutral-900 dark:text-neutral-50 text-sm">{t("sp_two_step_outbound")}</p>
                      <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium mt-1">{t("sp_two_step_outbound_desc")}</p>
                    </div>
                    <button onClick={() => updatePreferences({ two_step_outbound: !preferences.two_step_outbound })} className={cn("w-12 h-6 rounded-full relative transition-colors shrink-0", preferences.two_step_outbound ? "bg-taika-blue" : "bg-neutral-200 dark:bg-neutral-700")}>
                      <div className={cn("absolute top-1 w-4 h-4 bg-white dark:bg-neutral-950 rounded-full transition-all", preferences.two_step_outbound ? "right-1" : "left-1")} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Formats & Defaults */}
              <div className="space-y-4">
                <h4 className="text-sm font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest">{t("sp_standards")}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-900 dark:text-neutral-50">{t("sp_lot_format")}</label>
                    <input type="text" value={preferences.lot_number_format} onChange={(e) => updatePreferences({ lot_number_format: e.target.value })} className="w-full p-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-taika-blue font-mono text-sm" placeholder="{YYYYMMDD}{HHmm}{XXXX}" />
                    <p className="text-[10px] text-neutral-400">{t("sp_lot_format_hint")}</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-900 dark:text-neutral-50">{t("sp_default_tax")}</label>
                    <input type="number" step="0.1" value={preferences.default_tax_rate} onChange={(e) => updatePreferences({ default_tax_rate: parseFloat(e.target.value) || 0 })} className="w-full p-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-taika-blue font-bold text-sm" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-900 dark:text-neutral-50">{t("sp_fefo_days")}</label>
                    <input type="number" value={preferences.fefo_warning_days} onChange={(e) => updatePreferences({ fefo_warning_days: parseInt(e.target.value) || 0 })} className="w-full p-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-taika-blue font-bold text-sm" />
                    <p className="text-[10px] text-neutral-400">{t("sp_fefo_days_hint")}</p>
                  </div>
                </div>
              </div>

              {/* Advanced UI & Visuals */}
              <div className="space-y-4">
                <h4 className="text-sm font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest">{t("sp_ui_section")}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-900 dark:text-neutral-50">{t("sp_theme")}</label>
                    <select value={preferences.theme_mode} onChange={(e) => updatePreferences({ theme_mode: e.target.value })} className="w-full p-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-taika-blue font-bold text-sm">
                      <option value="auto">{t("sp_theme_auto")}</option>
                      <option value="light">{t("sp_theme_light")}</option>
                      <option value="dark">{t("sp_theme_dark")}</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between p-4 border border-neutral-100 dark:border-neutral-800 rounded-2xl bg-white dark:bg-neutral-950 h-[50px] mt-6">
                    <span className="font-bold text-neutral-900 dark:text-neutral-50 text-sm">{t("sp_scanner_sound")}</span>
                    <button onClick={() => updatePreferences({ scanner_sound_enabled: !preferences.scanner_sound_enabled })} className={cn("w-12 h-6 rounded-full relative transition-colors shrink-0", preferences.scanner_sound_enabled ? "bg-taika-blue" : "bg-neutral-200 dark:bg-neutral-700")}>
                      <div className={cn("absolute top-1 w-4 h-4 bg-white dark:bg-neutral-950 rounded-full transition-all", preferences.scanner_sound_enabled ? "right-1" : "left-1")} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ────── Phần Danh mục (Chỉ dành cho Admin) ────── */}
        {activeSection === "categories" && isAdmin && (
          <CategoriesUoMSection />
        )}
      </div>

      {/* ── Cửa sổ Ảnh đại diện ── */}
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
                  <div className="flex items-start gap-2">
                    {/* Info icon — outside top-left */}
                    <div ref={borderHintRef} className="relative mt-1">
                      <button
                        onClick={() => setShowBorderHint(!showBorderHint)}
                        className={cn("w-6 h-6 rounded-full flex items-center justify-center transition-colors cursor-pointer shadow-sm", showBorderHint ? "bg-taika-blue text-white" : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 hover:text-taika-blue hover:bg-blue-50 dark:hover:bg-blue-500/10")}
                      >
                        <Info size={12} />
                      </button>
                      <AnimatePresence>
                        {showBorderHint && (
                          <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 4 }}
                            className="absolute top-full mt-2 left-0 w-[240px] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl shadow-black/5 p-3 z-20"
                          >
                            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium leading-relaxed">{t("avatar_border_hint")}</p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    {/* Avatar with gradient ring */}
                    <div className={cn(
                      "p-[3px] rounded-[1.5rem]",
                      currentUser?.role === "admin"
                        ? "bg-gradient-to-br from-red-500 via-red-400 to-orange-500"
                        : currentUser?.role === "manager"
                        ? "bg-gradient-to-br from-blue-500 via-taika-blue to-cyan-400"
                        : "bg-gradient-to-br from-neutral-400 via-neutral-300 to-neutral-400"
                    )}>
                      <div className="w-28 h-28 rounded-[calc(1.5rem-3px)] overflow-hidden bg-taika-blue-light dark:bg-blue-500/10 flex items-center justify-center text-taika-blue dark:text-blue-400 font-bold text-4xl shadow-inner">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          getUserInitials(currentUser?.full_name, currentUser?.email)
                        )}
                      </div>
                    </div>
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
// Component con: Quản lý người dùng
// ══════════════════════════════════════════
/**
 * Component con hiển thị quản lý người dùng trong cài đặt
 *
 * @param {Object} props - Cấu hình được đưa vào con
 * @param {boolean} props.isAdmin - Cờ đánh dấu người dùng hiện tại là Admin
 * @param {string} props.currentUserId - ID của người dùng hệ thống hiện tại
 * @returns {JSX.Element}
 */
function UserManagementSection({ isAdmin, currentUserId }: { isAdmin: boolean; currentUserId: string }) {
  const { t } = useTranslation();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [showRbacInfo, setShowRbacInfo] = useState(false);
  const rbacRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (rbacRef.current && !rbacRef.current.contains(event.target as Node)) {
        setShowRbacInfo(false);
      }
    }
    if (showRbacInfo) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showRbacInfo]);

  // Create user form
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newRole, setNewRole] = useState("worker");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => { fetchUsers(); }, []);

  /**
   * Lấy danh sách người dùng từ hệ thống
   * @async
   */
  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed");
      setUsers(await res.json());
    } catch { toast.error(t("error_loading_data")); }
    setLoading(false);
  }

  /**
   * Khởi tạo và tạo một tài khoản mới trên hệ thống
   * @async
   * @param {React.FormEvent} e - Sự kiện form submit
   */
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

  /**
   * Thay đổi vai trò người dùng (Chỉ cho Admin)
   * @async
   * @param {string} userId - ID người dùng
   * @param {string} role - Vai trò mới
   */
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

  /**
   * Xóa một người dùng khỏi hệ thống
   * @async
   * @param {string} userId - ID người dùng
   */
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
          <div ref={rbacRef} className="flex items-center gap-2 relative">
            <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">{t("user_management")}</h3>
            <button 
              onClick={() => setShowRbacInfo(!showRbacInfo)}
              className={cn("p-1 rounded-full transition-colors cursor-pointer", showRbacInfo ? "text-taika-blue bg-blue-50 dark:bg-blue-500/10" : "text-neutral-400 hover:text-taika-blue hover:bg-neutral-100 dark:hover:bg-neutral-800")}
            >
               <Info size={16} />
            </button>
            
            <AnimatePresence>
              {showRbacInfo && (
                <motion.div 
                  initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                  className="absolute top-10 left-0 lg:left-0 w-[340px] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl shadow-xl shadow-black/5 dark:shadow-black/20 p-5 z-20"
                >
                   <p className="text-xs font-bold text-neutral-900 dark:text-neutral-50 mb-4 tracking-wide uppercase">{t("rbac_title")}</p>
                   <ul className="space-y-4">
                      <li className="flex items-start gap-3">
                         <div className="w-7 h-7 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center shrink-0">
                            <ShieldCheck size={14} className="text-red-500" />
                         </div>
                         <div>
                            <span className="text-sm font-bold text-red-600 dark:text-red-400 block mb-0.5">{t("role_admin")}</span> 
                            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium leading-relaxed">{t("rbac_admin_desc")}</span>
                         </div>
                      </li>
                      <li className="flex items-start gap-3">
                         <div className="w-7 h-7 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center shrink-0">
                            <Shield size={14} className="text-taika-blue dark:text-blue-400" />
                         </div>
                         <div>
                            <span className="text-sm font-bold text-taika-blue dark:text-blue-400 block mb-0.5">{t("role_manager")}</span> 
                            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium leading-relaxed">{t("rbac_manager_desc")}</span>
                         </div>
                      </li>
                      <li className="flex items-start gap-3">
                         <div className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
                            <UserCog size={14} className="text-neutral-500" />
                         </div>
                         <div>
                            <span className="text-sm font-bold text-neutral-700 dark:text-neutral-300 block mb-0.5">{t("role_worker")}</span> 
                            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium leading-relaxed">{t("rbac_worker_desc")}</span>
                         </div>
                      </li>
                   </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
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

      {/* Danh sách Người dùng */}
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
                  "w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm overflow-hidden",
                  user.role === "admin" ? "bg-gradient-to-br from-red-500 to-red-600" :
                  user.role === "manager" ? "bg-gradient-to-br from-taika-blue to-blue-600" :
                  "bg-gradient-to-br from-neutral-400 to-neutral-500"
                )}>
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.full_name || ""} className="w-full h-full object-cover" />
                  ) : (
                    getInitials(user.full_name, user.email)
                  )}
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

      {/* ── Cửa sổ Tạo người dùng ── */}
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

      {/* ── Xác nhận xóa ── */}
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
type WHForm = { name: string; code: string; location: string; temperature_zone: string; total_zones: number; zones_per_row: number | null; total_floor_area_sqm: number | null; max_capacity_kg: number | null; managers_info: { role: string; name: string; phone: string }[]; status: string; notes: string; racks_per_zone: number; bins_per_rack: number; bin_capacity_kg: number; zone_prefix: string; rack_prefix: string; bin_prefix: string; zone_categories: Record<string, string>; pallet_width_cm: number; pallet_depth_cm: number; aisle_width_cm: number; };
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

  const emptyForm: WHForm = { name: "", code: "", location: "", temperature_zone: "", total_zones: 4, zones_per_row: null, total_floor_area_sqm: null, max_capacity_kg: null, managers_info: [], status: "active", notes: "", racks_per_zone: 3, bins_per_rack: 6, bin_capacity_kg: 5000, zone_prefix: "Z", rack_prefix: "R", bin_prefix: "B", zone_categories: {}, pallet_width_cm: 100, pallet_depth_cm: 120, aisle_width_cm: 200 };
  const [form, setForm] = useState<WHForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [editingLocId, setEditingLocId] = useState<string | null>(null);
  const [locStatus, setLocStatus] = useState<string>("active");
  const [locCapacity, setLocCapacity] = useState<number>(5000);
  const [deletingLocId, setDeletingLocId] = useState<string | null>(null);

  const [roleDropdownOpen, setRoleDropdownOpen] = useState<number | null>(null);
  const ROLES_LIST = ["Quản lý", "Nhân viên", "Bảo vệ", "Thay ca"];

  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => { fetchWarehouses(); fetchCategories(); }, []);

  async function fetchCategories() {
    try {
      const res = await fetch("/api/categories");
      setCategories(await res.json());
    } catch { }
  }

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
    e.preventDefault(); 
    
    // Bỏ qua bước validate layout khắt khe bắt buộc phải là một khối hình chữ nhật hoàn hảo.
    // Thực tế kho có thể chia zone theo hình chữ L hoặc không cần liền khối.


    setSaving(true);
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
                      <button onClick={() => { setEditingWh(wh); setForm({ name: wh.name, code: wh.code || "", location: wh.location || "", temperature_zone: wh.temperature_zone || "", total_zones: wh.total_zones, zones_per_row: wh.zones_per_row || null, total_floor_area_sqm: wh.total_floor_area_sqm || null, max_capacity_kg: wh.max_capacity_kg || null, managers_info: wh.managers_info || [], status: wh.status || "active", notes: wh.notes || "", racks_per_zone: wh.racks_per_zone || 3, bins_per_rack: wh.bins_per_rack || 6, bin_capacity_kg: wh.bin_capacity_kg || 5000, zone_prefix: wh.zone_prefix || "Z", rack_prefix: wh.rack_prefix || "R", bin_prefix: wh.bin_prefix || "B", zone_categories: wh.zone_categories || {}, pallet_width_cm: wh.pallet_width_cm || 100, pallet_depth_cm: wh.pallet_depth_cm || 120, aisle_width_cm: wh.aisle_width_cm || 200 }); setShowAddWh(true); }}
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
              className="relative bg-white dark:bg-neutral-950 w-full max-w-[1400px] xl:max-w-[90vw] rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
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
                          unit && "pr-16"
                        )} />
                      {unit && (
                        <button 
                          type="button"
                          onClick={() => {
                            const val = (form as any)[key] || "";
                            if (val.trim().endsWith(unit)) {
                              setForm(f => ({ ...f, [key]: val.replace(new RegExp(`\\s*${unit}$`), "").trim() }));
                            } else {
                              setForm(f => ({ ...f, [key]: `${val.trim()} ${unit}`.trim() }));
                            }
                          }}
                          title={t("toggle_unit", "Bật/tắt đơn vị")}
                          className={cn(
                            "absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold px-2.5 py-1.5 rounded-xl transition-all cursor-pointer",
                            ((form as any)[key] || "").includes(unit) 
                              ? "bg-taika-blue text-white shadow-md shadow-taika-blue/20" 
                              : "bg-neutral-200 dark:bg-neutral-800 text-neutral-500 hover:bg-neutral-300 dark:hover:bg-neutral-700"
                          )}
                        >
                          {unit}
                        </button>
                      )}
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
                      
                      {/* Kích thước vật lý */}
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div>
                          <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em] mb-2">Rộng Pallet (cm)</label>
                          <div className="relative">
                            <input type="number" min="50" value={form.pallet_width_cm} onChange={(e) => {
                              const v = Number(e.target.value) || 100;
                              const totalBins = form.total_zones * form.racks_per_zone * form.bins_per_rack;
                              const palletArea = totalBins * (v / 100) * (form.pallet_depth_cm / 100);
                              const est = Math.round(palletArea * 1.667);
                              setForm(f => ({ ...f, pallet_width_cm: v, total_floor_area_sqm: est }));
                            }}
                              className="w-full pl-4 pr-10 py-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-taika-blue text-neutral-900 dark:text-neutral-50" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400 select-none pointer-events-none">cm</span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em] mb-2">Sâu Pallet (cm)</label>
                          <div className="relative">
                            <input type="number" min="50" value={form.pallet_depth_cm} onChange={(e) => {
                              const v = Number(e.target.value) || 120;
                              const totalBins = form.total_zones * form.racks_per_zone * form.bins_per_rack;
                              const palletArea = totalBins * (form.pallet_width_cm / 100) * (v / 100);
                              const est = Math.round(palletArea * 1.667);
                              setForm(f => ({ ...f, pallet_depth_cm: v, total_floor_area_sqm: est }));
                            }}
                              className="w-full pl-4 pr-10 py-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-taika-blue text-neutral-900 dark:text-neutral-50" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400 select-none pointer-events-none">cm</span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em] mb-2">Lối đi (cm)</label>
                          <div className="relative">
                            <input type="number" min="200" value={form.aisle_width_cm} onChange={(e) => {
                              const v = Math.max(200, Number(e.target.value) || 200);
                              setForm(f => ({ ...f, aisle_width_cm: v }));
                            }}
                              className="w-full pl-4 pr-10 py-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-taika-blue text-neutral-900 dark:text-neutral-50" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400 select-none pointer-events-none">cm</span>
                          </div>
                        </div>
                      </div>

                      <div className="mb-4">
                        <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em] mb-2">{t("total_floor_area_sqm", "Tổng diện tích sàn (m²)")}</label>
                        <div className="relative">
                          <input type="number" min="0" step="1" value={form.total_floor_area_sqm || ''} placeholder="Tự tính hoặc nhập tay" onChange={(e) => {
                            const area = Number(e.target.value) || 0;
                            if (area > 0) {
                              const usableArea = area / 1.667;
                              const palletSqm = (form.pallet_width_cm / 100) * (form.pallet_depth_cm / 100);
                              const maxPallets = Math.floor(usableArea / palletSqm);
                              const binsPerZone = form.racks_per_zone * form.bins_per_rack;
                              const suggestedZones = Math.max(1, Math.round(maxPallets / binsPerZone));
                              setForm(f => ({ ...f, total_floor_area_sqm: area, total_zones: suggestedZones }));
                            } else {
                              setForm(f => ({ ...f, total_floor_area_sqm: null }));
                            }
                          }}
                            className="w-full pl-5 pr-12 py-3.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-taika-blue text-neutral-900 dark:text-neutral-50" />
                          <span className="absolute right-5 top-1/2 -translate-y-1/2 text-sm font-bold text-neutral-400 select-none pointer-events-none">m²</span>
                        </div>
                      </div>

                      {/* Summary tính toán */}
                      {(() => {
                        const totalBins = form.total_zones * form.racks_per_zone * form.bins_per_rack;
                        const palletArea = totalBins * (form.pallet_width_cm / 100) * (form.pallet_depth_cm / 100);
                        const aisleArea = Math.round(palletArea * 0.667);
                        const total = Math.round(palletArea + aisleArea);
                        return (
                          <div className="px-4 py-2.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl text-xs text-amber-700 dark:text-amber-400 font-medium">
                            📦 {totalBins} pallet ({form.total_zones} zone × {form.racks_per_zone} rack × {form.bins_per_rack} bin) × {form.pallet_width_cm/100}m × {form.pallet_depth_cm/100}m = {Math.round(palletArea)}m² + {aisleArea}m² lối đi ≈ <strong>{total} m²</strong>
                          </div>
                        );
                      })()}
                    </div>

                    {/* === Người quản lý === */}
                    <div className="border-t border-neutral-100 dark:border-neutral-800 pt-5">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-[10px] font-black text-taika-blue uppercase tracking-[0.2em]">{t("manager", "Người quản lý")}</p>
                        <button type="button" onClick={() => setForm((f) => ({ ...f, managers_info: [...f.managers_info, { role: "Quản lý", name: "", phone: "" }] }))} className="text-[10px] font-bold text-taika-blue hover:underline flex items-center gap-1 uppercase tracking-widest">
                          <Plus size={12} /> Thêm người
                        </button>
                      </div>
                      <div className="space-y-3">
                        {form.managers_info.length === 0 && (
                          <div className="text-center py-4 border border-dashed border-neutral-200 dark:border-neutral-700 rounded-2xl">
                            <p className="text-xs text-neutral-400 font-medium">Chưa có người quản lý</p>
                          </div>
                        )}
                        {form.managers_info.map((m, idx) => (
                          <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                            <div className="relative w-full sm:w-1/3">
                              <input 
                                value={m.role} 
                                onChange={(e) => { const newArr = [...form.managers_info]; newArr[idx] = { ...newArr[idx], role: e.target.value }; setForm((f) => ({ ...f, managers_info: newArr })); }} 
                                onFocus={() => setRoleDropdownOpen(idx)}
                                onBlur={() => setTimeout(() => setRoleDropdownOpen(null), 200)}
                                placeholder="Chức danh" 
                                className="w-full p-3.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-taika-blue text-sm font-bold text-neutral-900 dark:text-neutral-50 transition-all pr-10" 
                              />
                              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400" size={16} />
                              
                              <AnimatePresence>
                                {roleDropdownOpen === idx && (
                                  <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} transition={{ duration: 0.1 }}
                                    className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-lg z-50 py-2 overflow-hidden">
                                    {ROLES_LIST.map(r => (
                                      <div 
                                        key={r} 
                                        onClick={() => { const newArr = [...form.managers_info]; newArr[idx] = { ...newArr[idx], role: r }; setForm({...form, managers_info: newArr}); setRoleDropdownOpen(null); }}
                                        className="px-5 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer text-sm font-bold text-neutral-900 dark:text-neutral-50 transition-colors"
                                      >
                                        {r}
                                      </div>
                                    ))}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                            <input value={m.name} onChange={(e) => { const newArr = [...form.managers_info]; newArr[idx] = { ...newArr[idx], name: e.target.value }; setForm((f) => ({ ...f, managers_info: newArr })); }} placeholder="Họ tên" className="w-full sm:w-1/3 p-3.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-taika-blue text-sm font-medium text-neutral-900 dark:text-neutral-50 transition-all" />
                            <div className="flex flex-1 w-full gap-2 items-center">
                              <input value={m.phone} onChange={(e) => { const newArr = [...form.managers_info]; newArr[idx] = { ...newArr[idx], phone: e.target.value }; setForm((f) => ({ ...f, managers_info: newArr })); }} placeholder="Số điện thoại" className="flex-1 p-3.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-taika-blue text-sm font-medium text-neutral-900 dark:text-neutral-50 transition-all" />
                              <button type="button" onClick={() => { const newArr = form.managers_info.filter((_, i) => i !== idx); setForm((f) => ({ ...f, managers_info: newArr })); }} className="p-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors shrink-0">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* === Quy định Vùng vật liệu (Zone Categories) === */}
                    <div className="border-t border-neutral-100 dark:border-neutral-800 pt-5 mt-5">
                      <p className="text-[10px] font-black text-taika-blue uppercase tracking-[0.2em] mb-4">Các loại danh mục theo Vùng</p>
                      <div className="grid grid-cols-2 gap-4">
                        {Array.from({ length: form.total_zones }).map((_, i) => {
                          const zName = `${form.zone_prefix || "Z"}${i + 1}`;
                          return (
                            <div key={zName} className="flex gap-2 items-center bg-white dark:bg-neutral-950 p-2 border border-neutral-200 dark:border-neutral-800 rounded-xl">
                              <span className="w-10 text-center font-bold text-xs text-neutral-500">{zName}</span>
                              <select 
                                value={form.zone_categories?.[zName] || ""}
                                onChange={(e) => setForm(f => ({ ...f, zone_categories: { ...f.zone_categories, [zName]: e.target.value } }))}
                                className="flex-1 px-3 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-xs font-medium outline-none focus:ring-1 focus:ring-taika-blue"
                              >
                                <option value="">-- Mọi loại --</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                            </div>
                          );
                        })}
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
                        <input type="number" min="1" value={form.bin_capacity_kg} onChange={(e) => {
                          const val = Number(e.target.value);
                          setForm((f) => ({ 
                            ...f, 
                            bin_capacity_kg: val,
                            max_capacity_kg: val * f.total_zones * f.racks_per_zone * f.bins_per_rack
                          }));
                        }}
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
                      </div>
                    </div>
                    {/* === Ghi chú === */}
                    <div className="border-t border-neutral-100 dark:border-neutral-800 pt-5 mt-5">
                      <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em] mb-2">{t("notes", "Ghi chú")}</label>
                      <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                        placeholder={t("notes_placeholder", "Ghi chú thêm về kho...")}
                        rows={3}
                        className="w-full px-5 py-3.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-taika-blue text-neutral-900 dark:text-neutral-50 resize-none" />
                    </div>
                  </div>

                  {/* Bản đồ trực quan */}
                  <div className="mt-5 flex flex-col min-h-[300px]">
                    <p className="text-sm font-bold text-taika-blue mb-4">Sơ đồ trực quan (Review)</p>
                    <div className="flex-1 bg-neutral-100/50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 overflow-auto custom-scrollbar flex items-start justify-center relative overflow-hidden">
                      <div className="absolute inset-0 opacity-[0.04] dark:opacity-[0.02]" style={{ backgroundImage: "radial-gradient(#000 1px, transparent 1px)", backgroundSize: "16px 16px" }}></div>
                      
                      {(() => {
                        const previewCols = form.zones_per_row || Math.ceil(Math.sqrt(Math.max(1, form.total_zones)));
                        // Tối đa preview 200 zones để tránh lag khi gõ số quá lớn
                        const displayZones = Math.min(200, form.total_zones || 0);
                        const uniqueCats = Array.from(new Set(Object.values(form.zone_categories || {}).filter(Boolean)));
                        
                        const CAT_COLORS = [
                          "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-400",
                          "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400",
                          "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-400",
                          "bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-500/10 dark:border-purple-500/30 dark:text-purple-400",
                          "bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-400",
                          "bg-cyan-50 border-cyan-200 text-cyan-700 dark:bg-cyan-500/10 dark:border-cyan-500/30 dark:text-cyan-400"
                        ];

                        if (displayZones === 0) return <p className="text-sm text-neutral-400 m-auto">Chưa có zone</p>;

                        return (
                          <div 
                            className="grid gap-2.5 p-2 m-auto relative z-10" 
                            style={{ gridTemplateColumns: `repeat(${previewCols}, minmax(0, 1fr))` }}
                          >
                            {Array.from({ length: displayZones }).map((_, i) => {
                              const zName = `${form.zone_prefix || "Z"}${i + 1}`;
                              const catId = form.zone_categories?.[zName];
                              const catName = categories.find(c => c.id === catId)?.name || "—";
                              
                              let colorClass = "bg-white border-neutral-200 text-neutral-500 dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-400";
                              if (catId) {
                                const idx = uniqueCats.indexOf(catId);
                                colorClass = CAT_COLORS[idx % CAT_COLORS.length];
                              }
                      
                              return (
                                <div key={zName} 
                                  className={cn("p-2 rounded-xl border flex flex-col justify-center items-center shadow-sm w-[72px] h-[60px] transition-all hover:scale-105", colorClass)}
                                >
                                  <span className="font-black text-sm">{zName}</span>
                                  <span className="text-[9px] font-bold mt-1 line-clamp-1 truncate w-full text-center px-1 opacity-80" title={catName}>{catName}</span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
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
