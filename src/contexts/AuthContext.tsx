import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type UserProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: "admin" | "manager" | "worker";
  avatar_url: string | null;
};

type AuthState = {
  user: any | null;
  profile: UserProfile | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  signup: (email: string, password: string, fullName: string) => Promise<{ error?: string }>;
  logout: () => void;
  hasRole: (...roles: string[]) => boolean;
  setProfile: (p: UserProfile) => void;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

/**
 * Provider cung cấp ngữ cảnh xác thực (AuthContext) cho toàn bộ ứng dụng.
 * Quản lý trạng thái đăng nhập, đăng xuất, đăng ký, và session token của người dùng.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("auth_token"));
  const [loading, setLoading] = useState(true);

  // Khi khởi chạy, thử khôi phục phiên bản đăng nhập
  useEffect(() => {
    if (token) {
      restoreSession(token);
    } else {
      setLoading(false);
    }
  }, []);

  /**
   * Khôi phục phiên đăng nhập (session) dựa vào token đã lưu.
   * Chạy tự động khi ứng dụng khởi chạy nếu phát hiện có token trong bộ nhớ.
   * @param savedToken Token phiên làm việc được lưu trong localStorage
   */
  async function restoreSession(savedToken: string) {
    try {
      const res = await fetch("/api/auth/profile", {
        headers: { Authorization: `Bearer ${savedToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setProfile(data.profile);
        setToken(savedToken);
      } else {
        // Token đã hết hạn hoặc không hợp lệ
        localStorage.removeItem("auth_token");
        setToken(null);
        setUser(null);
        setProfile(null);
      }
    } catch {
      localStorage.removeItem("auth_token");
      setToken(null);
    }
    setLoading(false);
  }

  /**
   * Gọi API đăng nhập với email và mật khẩu.
   * Xử lý lưu token và cập nhật state thông tin người dùng nếu thành công.
   * @param email Email đăng nhập
   * @param password Mật khẩu đăng nhập
   * @returns Lỗi nếu thất bại, hoặc object rỗng nếu thành công
   */
  async function login(email: string, password: string): Promise<{ error?: string }> {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error || "Login failed" };
      
      setUser(data.user);
      setProfile(data.profile);
      setToken(data.session.access_token);
      localStorage.setItem("auth_token", data.session.access_token);
      return {};
    } catch (err: any) {
      return { error: err.message };
    }
  }

  /**
   * Gọi API tạo tài khoản mới.
   * @param email Địa chỉ email
   * @param password Mật khẩu
   * @param fullName Họ và tên
   */
  async function signup(email: string, password: string, fullName: string): Promise<{ error?: string }> {
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, full_name: fullName }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error || "Signup failed" };
      return {};
    } catch (err: any) {
      return { error: err.message };
    }
  }

  /**
   * Hủy phiên đăng nhập hiện tại và xóa token khỏi bộ nhớ trình duyệt.
   */
  function logout() {
    setUser(null);
    setProfile(null);
    setToken(null);
    localStorage.removeItem("auth_token");
  }

  /**
   * Hàm hỗ trợ kiểm tra vai trò người dùng (Role-Based Access Control).
   * Dùng để hạn chế hoặc cấp quyền truy cập vào các giao diện tính năng.
   * @param roles Danh sách các vai trò được phép
   * @returns {boolean} True nếu người dùng hiện tại nằm trong số các vai trò được cấp quyền
   */
  function hasRole(...roles: string[]) {
    return profile ? roles.includes(profile.role) : false;
  }

  return (
    <AuthContext.Provider value={{ user, profile, token, loading, login, signup, logout, hasRole, setProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook tùy chỉnh để sử dụng context xác thực.
 * Phải được bọc bên trong AuthProvider thì mới sử dụng được.
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
