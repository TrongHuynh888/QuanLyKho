import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus, X, Loader2, AlertCircle, Trash2, Pencil, CheckCircle2,
} from "lucide-react";

type CatItem = { id: string; name: string };
type UomItem = { id: string; name: string; symbol?: string | null };

export default function CategoriesUoMSection() {
  const { t } = useTranslation();

  const [categories, setCategories] = useState<CatItem[]>([]);
  const [uoms, setUoms] = useState<UomItem[]>([]);
  const [loadingCat, setLoadingCat] = useState(true);
  const [loadingUom, setLoadingUom] = useState(true);

  // Category state
  const [newCat, setNewCat] = useState("");
  const [addingCat, setAddingCat] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatVal, setEditCatVal] = useState("");
  const [deleteCatId, setDeleteCatId] = useState<string | null>(null);

  // UoM state
  const [newUomName, setNewUomName] = useState("");
  const [newUomSymbol, setNewUomSymbol] = useState("");
  const [addingUom, setAddingUom] = useState(false);
  const [editingUomId, setEditingUomId] = useState<string | null>(null);
  const [editUomName, setEditUomName] = useState("");
  const [editUomSymbol, setEditUomSymbol] = useState("");
  const [deleteUomId, setDeleteUomId] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories();
    fetchUoms();
  }, []);

  async function fetchCategories() {
    setLoadingCat(true);
    try {
      const res = await fetch("/api/categories");
      if (!res.ok) throw new Error("Failed");
      setCategories(await res.json());
    } catch { toast.error(t("error_loading_data")); }
    setLoadingCat(false);
  }

  async function fetchUoms() {
    setLoadingUom(true);
    try {
      const res = await fetch("/api/uoms");
      if (!res.ok) throw new Error("Failed");
      setUoms(await res.json());
    } catch { toast.error(t("error_loading_data")); }
    setLoadingUom(false);
  }

  async function handleAddCategory() {
    if (!newCat.trim()) return;
    setAddingCat(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCat.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNewCat("");
      toast.success(t("cat_added", "Đã thêm danh mục"));
      fetchCategories();
    } catch (err: any) { toast.error(err.message); }
    setAddingCat(false);
  }

  async function handleEditCategory(id: string) {
    if (!editCatVal.trim()) return;
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editCatVal.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEditingCatId(null);
      toast.success(t("cat_updated", "Đã cập nhật danh mục"));
      fetchCategories();
    } catch (err: any) { toast.error(err.message); }
  }

  async function handleDeleteCategory(id: string) {
    try {
      const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDeleteCatId(null);
      toast.success(t("cat_deleted", "Đã xóa danh mục"));
      fetchCategories();
    } catch (err: any) { toast.error(err.message); }
  }

  async function handleAddUom() {
    if (!newUomName.trim()) return;
    setAddingUom(true);
    try {
      const res = await fetch("/api/uoms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newUomName.trim(), symbol: newUomSymbol.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNewUomName("");
      setNewUomSymbol("");
      toast.success(t("uom_added", "Đã thêm đơn vị đo"));
      fetchUoms();
    } catch (err: any) { toast.error(err.message); }
    setAddingUom(false);
  }

  async function handleEditUom(id: string) {
    if (!editUomName.trim()) return;
    try {
      const res = await fetch(`/api/uoms/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editUomName.trim(), symbol: editUomSymbol.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEditingUomId(null);
      toast.success(t("uom_updated", "Đã cập nhật đơn vị đo"));
      fetchUoms();
    } catch (err: any) { toast.error(err.message); }
  }

  async function handleDeleteUom(id: string) {
    try {
      const res = await fetch(`/api/uoms/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDeleteUomId(null);
      toast.success(t("uom_deleted", "Đã xóa đơn vị đo"));
      fetchUoms();
    } catch (err: any) { toast.error(err.message); }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">{t("categories_uom")}</h3>
        <p className="text-sm text-neutral-400 dark:text-neutral-500 mt-1">{t("categories_uom_desc", "Quản lý danh mục sản phẩm và đơn vị đo lường")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* ──────── CATEGORIES COLUMN ──────── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-5 rounded-full bg-taika-blue" />
            <h4 className="font-bold text-neutral-900 dark:text-neutral-50">{t("categories", "Danh mục")}</h4>
            <span className="text-xs text-neutral-400 font-medium">({categories.length})</span>
          </div>

          {/* Add input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newCat}
              onChange={e => setNewCat(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAddCategory()}
              placeholder={t("cat_name_placeholder", "Tên danh mục mới...")}
              className="flex-1 px-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-taika-blue text-neutral-900 dark:text-neutral-50"
            />
            <button
              onClick={handleAddCategory}
              disabled={addingCat || !newCat.trim()}
              className="px-4 py-2.5 bg-taika-blue text-white rounded-xl text-sm font-bold hover:bg-taika-blue/90 transition-all disabled:opacity-50 flex items-center gap-1.5 shrink-0"
            >
              {addingCat ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {t("add", "Thêm")}
            </button>
          </div>

          {/* List */}
          <div className="space-y-2 min-h-[120px]">
            {loadingCat ? (
              <div className="py-10 flex justify-center"><Loader2 size={22} className="animate-spin text-taika-blue" /></div>
            ) : categories.length === 0 ? (
              <div className="py-10 text-center text-sm text-neutral-400 dark:text-neutral-500 border border-dashed border-neutral-200 dark:border-neutral-700 rounded-xl">
                {t("no_categories", "Chưa có danh mục nào")}
              </div>
            ) : (
              <AnimatePresence>
                {categories.map((cat, i) => (
                  <motion.div
                    key={cat.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center gap-2 p-3 bg-neutral-50 dark:bg-neutral-900 rounded-xl border border-neutral-100 dark:border-neutral-800 group hover:border-taika-blue/20 hover:shadow-sm transition-all"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-taika-blue shrink-0" />

                    {editingCatId === cat.id ? (
                      <input
                        autoFocus
                        value={editCatVal}
                        onChange={e => setEditCatVal(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") handleEditCategory(cat.id);
                          if (e.key === "Escape") setEditingCatId(null);
                        }}
                        className="flex-1 bg-white dark:bg-neutral-950 border border-taika-blue rounded-lg px-2 py-1 text-sm font-medium outline-none text-neutral-900 dark:text-neutral-50"
                      />
                    ) : (
                      <span className="flex-1 text-sm font-medium text-neutral-800 dark:text-neutral-200">{cat.name}</span>
                    )}

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {editingCatId === cat.id ? (
                        <>
                          <button onClick={() => handleEditCategory(cat.id)} className="p-1.5 text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10 rounded-lg transition-all">
                            <CheckCircle2 size={14} />
                          </button>
                          <button onClick={() => setEditingCatId(null)} className="p-1.5 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-all">
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => { setEditingCatId(cat.id); setEditCatVal(cat.name); }}
                            className="p-1.5 text-neutral-400 hover:text-taika-blue hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-all"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => setDeleteCatId(cat.id)}
                            className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* ──────── UoM COLUMN ──────── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-5 rounded-full bg-purple-500" />
            <h4 className="font-bold text-neutral-900 dark:text-neutral-50">{t("units_of_measurement", "Đơn vị đo lường")}</h4>
            <span className="text-xs text-neutral-400 font-medium">({uoms.length})</span>
          </div>

          {/* Add form */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newUomName}
              onChange={e => setNewUomName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAddUom()}
              placeholder={t("uom_name_placeholder", "Tên đơn vị (vd: Kilogram)...")}
              className="flex-1 px-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-purple-500 text-neutral-900 dark:text-neutral-50"
            />
            <input
              type="text"
              value={newUomSymbol}
              onChange={e => setNewUomSymbol(e.target.value)}
              placeholder={t("uom_symbol_placeholder", "KH")}
              className="w-20 px-3 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-purple-500 text-neutral-900 dark:text-neutral-50"
            />
            <button
              onClick={handleAddUom}
              disabled={addingUom || !newUomName.trim()}
              className="px-4 py-2.5 bg-purple-500 text-white rounded-xl text-sm font-bold hover:bg-purple-600 transition-all disabled:opacity-50 flex items-center gap-1.5 shrink-0"
            >
              {addingUom ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {t("add", "Thêm")}
            </button>
          </div>

          {/* List */}
          <div className="space-y-2 min-h-[120px]">
            {loadingUom ? (
              <div className="py-10 flex justify-center"><Loader2 size={22} className="animate-spin text-purple-500" /></div>
            ) : uoms.length === 0 ? (
              <div className="py-10 text-center text-sm text-neutral-400 dark:text-neutral-500 border border-dashed border-neutral-200 dark:border-neutral-700 rounded-xl">
                {t("no_uoms", "Chưa có đơn vị đo nào")}
              </div>
            ) : (
              <AnimatePresence>
                {uoms.map((uom, i) => (
                  <motion.div
                    key={uom.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center gap-2 p-3 bg-neutral-50 dark:bg-neutral-900 rounded-xl border border-neutral-100 dark:border-neutral-800 group hover:border-purple-200 dark:hover:border-purple-500/30 hover:shadow-sm transition-all"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />

                    {editingUomId === uom.id ? (
                      <>
                        <input
                          autoFocus
                          value={editUomName}
                          onChange={e => setEditUomName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter") handleEditUom(uom.id);
                            if (e.key === "Escape") setEditingUomId(null);
                          }}
                          className="flex-1 bg-white dark:bg-neutral-950 border border-purple-500 rounded-lg px-2 py-1 text-sm font-medium outline-none text-neutral-900 dark:text-neutral-50"
                        />
                        <input
                          value={editUomSymbol}
                          onChange={e => setEditUomSymbol(e.target.value)}
                          placeholder="KH"
                          className="w-16 bg-white dark:bg-neutral-950 border border-purple-500 rounded-lg px-2 py-1 text-sm font-medium outline-none text-neutral-900 dark:text-neutral-50"
                        />
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm font-medium text-neutral-800 dark:text-neutral-200">{uom.name}</span>
                        {uom.symbol && (
                          <span className="text-xs font-bold px-2 py-0.5 bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-md">
                            {uom.symbol}
                          </span>
                        )}
                      </>
                    )}

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {editingUomId === uom.id ? (
                        <>
                          <button onClick={() => handleEditUom(uom.id)} className="p-1.5 text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10 rounded-lg transition-all">
                            <CheckCircle2 size={14} />
                          </button>
                          <button onClick={() => setEditingUomId(null)} className="p-1.5 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-all">
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => { setEditingUomId(uom.id); setEditUomName(uom.name); setEditUomSymbol(uom.symbol || ""); }}
                            className="p-1.5 text-neutral-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-500/10 rounded-lg transition-all"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => setDeleteUomId(uom.id)}
                            className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>

      {/* ── Delete Category Confirm ── */}
      <AnimatePresence>
        {deleteCatId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteCatId(null)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative bg-white dark:bg-neutral-950 w-full max-w-sm rounded-[2rem] shadow-2xl p-8 text-center">
              <div className="w-14 h-14 bg-red-100 dark:bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <AlertCircle size={28} className="text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-50 mb-2">{t("delete_category_title", "Xóa danh mục?")}</h3>
              <p className="text-sm text-neutral-400 dark:text-neutral-500 mb-6">{t("delete_category_warn", "Danh mục sẽ bị xóa vĩnh viễn. Không thể hoàn tác.")}</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteCatId(null)} className="flex-1 py-3 bg-neutral-100 dark:bg-neutral-800 rounded-2xl font-bold text-sm text-neutral-600 dark:text-neutral-300">{t("cancel")}</button>
                <button onClick={() => handleDeleteCategory(deleteCatId)} className="flex-1 py-3 bg-red-500 text-white rounded-2xl font-bold text-sm hover:bg-red-600 shadow-lg transition-all">{t("delete_btn", "Xóa")}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Delete UoM Confirm ── */}
      <AnimatePresence>
        {deleteUomId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteUomId(null)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative bg-white dark:bg-neutral-950 w-full max-w-sm rounded-[2rem] shadow-2xl p-8 text-center">
              <div className="w-14 h-14 bg-red-100 dark:bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <AlertCircle size={28} className="text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-50 mb-2">{t("delete_uom_title", "Xóa đơn vị đo?")}</h3>
              <p className="text-sm text-neutral-400 dark:text-neutral-500 mb-6">{t("delete_warn", "Không thể hoàn tác.")}</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteUomId(null)} className="flex-1 py-3 bg-neutral-100 dark:bg-neutral-800 rounded-2xl font-bold text-sm text-neutral-600 dark:text-neutral-300">{t("cancel")}</button>
                <button onClick={() => handleDeleteUom(deleteUomId)} className="flex-1 py-3 bg-red-500 text-white rounded-2xl font-bold text-sm hover:bg-red-600 shadow-lg transition-all">{t("delete_btn", "Xóa")}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
