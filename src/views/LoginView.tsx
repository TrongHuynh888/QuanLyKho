import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Languages, Moon, Sun } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Password input that briefly shows the last typed character (like mobile)
function PasswordInput({ value, onChange, placeholder, className, required, minLength }: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  minLength?: number;
}) {
  const [displayValue, setDisplayValue] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (showAll) {
      setDisplayValue(value);
      return;
    }
    // Show last char briefly, mask the rest
    if (value.length === 0) {
      setDisplayValue("");
      return;
    }
    const masked = "•".repeat(Math.max(0, value.length - 1)) + value.slice(-1);
    setDisplayValue(masked);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDisplayValue("•".repeat(value.length));
    }, 800);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [value, showAll]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const newDisplay = input.value;
    const cursor = input.selectionStart || 0;

    if (showAll) {
      onChange(newDisplay);
      return;
    }

    // Figure out what changed
    const lenDiff = newDisplay.length - displayValue.length;
    if (lenDiff > 0) {
      // Characters added
      const added = newDisplay.slice(cursor - lenDiff, cursor);
      const newVal = value.slice(0, cursor - lenDiff) + added + value.slice(cursor - lenDiff);
      onChange(newVal);
    } else if (lenDiff < 0) {
      // Characters removed
      const newVal = value.slice(0, cursor) + value.slice(cursor - lenDiff);
      onChange(newVal);
    }
  }

  return (
    <div className="relative">
      <input
        type="text"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        value={showAll ? value : displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        className={className}
        required={required}
        minLength={minLength}
        style={{ fontFamily: "'Inter', sans-serif", letterSpacing: showAll ? "normal" : "0.12em" }}
      />
      <button
        type="button"
        onClick={() => setShowAll(!showAll)}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
      >
        {showAll ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

export default function LoginView() {
  const { t, i18n } = useTranslation();
  const { login, signup } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("darkMode");
      if (saved !== null) return saved === "true";
      return true; // default dark
    }
    return true;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("darkMode", isDarkMode.toString());
  }, [isDarkMode]);

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === "en" ? "vi" : "en");
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;

    if (isSignUp) {
      if (password !== confirmPassword) {
        toast.error(t("password_mismatch"));
        return;
      }
      setLoading(true);
      const { error } = await signup(email, password, fullName);
      setLoading(false);
      if (error) {
        toast.error(error);
      } else {
        toast.success(t("signup_success"));
        setIsSignUp(false);
        setConfirmPassword("");
        setFullName("");
      }
    } else {
      setLoading(true);
      const { error } = await login(email, password);
      setLoading(false);
      if (error) {
        toast.error(t("login_error"));
      }
    }
  }

  const inputClass = "w-full px-5 py-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-taika-blue focus:border-transparent transition-all text-neutral-900 dark:text-neutral-50";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-sky-50 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950 relative overflow-hidden transition-colors duration-300">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-taika-blue/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-taika-red/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-taika-blue/3 to-sky-300/3 rounded-full blur-3xl" />
      </div>

      {/* Top-right controls: Dark mode + Language */}
      <div className="absolute top-6 right-6 flex items-center gap-2 z-20">
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="p-3 bg-white/80 dark:bg-neutral-800/80 backdrop-blur-xl rounded-2xl text-neutral-500 dark:text-neutral-400 hover:bg-white dark:hover:bg-neutral-700 transition-all shadow-sm border border-neutral-200/50 dark:border-neutral-700/50"
          title={isDarkMode ? "Light Mode" : "Dark Mode"}
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <button
          onClick={toggleLanguage}
          className="p-3 bg-white/80 dark:bg-neutral-800/80 backdrop-blur-xl rounded-2xl text-neutral-500 dark:text-neutral-400 hover:bg-white dark:hover:bg-neutral-700 transition-all shadow-sm border border-neutral-200/50 dark:border-neutral-700/50"
        >
          <Languages size={20} />
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md mx-4 relative z-10"
      >
        <div className="bg-white/80 dark:bg-neutral-950/80 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl shadow-neutral-300/50 dark:shadow-taika-blue/5 border border-neutral-300 dark:border-neutral-700/50 overflow-hidden">
          {/* Header */}
          <div className="px-10 pt-12 pb-8 text-center">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex items-center justify-center gap-3 mb-6"
            >
              <div className="w-14 h-14 flex items-center justify-center">
                <img
                  src="https://taikaseafood.com.vn/wp-content/uploads/2024/02/Layer_1.svg"
                  alt="TAIKA Logo"
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <h1 className="font-black text-3xl tracking-tight text-taika-blue dark:text-blue-400">
                TAIKA
              </h1>
            </motion.div>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 mb-2">
              {t("login_welcome")}
            </h2>
            <p className="text-sm text-neutral-400 dark:text-neutral-500 font-medium">
              {t("login_subtitle")}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-10 pb-10 space-y-5">
            <AnimatePresence mode="wait">
              {isSignUp && (
                <motion.div
                  key="fullname"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em] mb-2">
                    {t("full_name_label")}
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={inputClass}
                    placeholder="Nguyễn Văn A"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em] mb-2">
                {t("email")}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="email@taika.vn"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em] mb-2">
                {t("password")}
              </label>
              <PasswordInput
                value={password}
                onChange={setPassword}
                placeholder=""
                className={inputClass + " pr-12"}
                required
                minLength={6}
              />
            </div>

            <AnimatePresence mode="wait">
              {isSignUp && (
                <motion.div
                  key="confirm"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em] mb-2">
                    {t("confirm_password")}
                  </label>
                  <PasswordInput
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    placeholder=""
                    className={inputClass + " pr-12"}
                    minLength={6}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-taika-blue text-white rounded-2xl font-bold text-sm hover:bg-taika-blue/90 shadow-xl shadow-taika-blue/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                isSignUp ? t("sign_up") : t("sign_in")
              )}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setConfirmPassword("");
                  setFullName("");
                }}
                className="text-sm text-taika-blue dark:text-blue-400 font-medium hover:underline"
              >
                {isSignUp ? t("already_have_account") : t("no_account")}
              </button>
            </div>
          </form>
        </div>

        <p className="text-center text-xs text-neutral-400 dark:text-neutral-600 mt-6 font-medium">
          © 2026 TAIKA Seafood. All rights reserved.
        </p>
      </motion.div>
    </div>
  );
}
