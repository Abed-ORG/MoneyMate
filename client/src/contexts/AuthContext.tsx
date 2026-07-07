import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { clearApiCache } from "../services/api";
import { api } from "../services/api";
import {
  clearAuthSession,
  getAuthToken,
  getRefreshToken,
  hasValidAuthToken,
  setAuthSession,
  type AuthTokens,
} from "../utils/auth";

export type AuthUser = {
  id: number;
  full_name: string;
  email: string;
  is_email_verified: boolean;
};

export type SavingsGoal = {
  name: string;
  target_amount: number;
};

export type FinancialProfile = {
  id: number;
  user_id: number;
  monthly_income: number | null;
  currency: string;
  spending_categories: string[];
  savings_goals: SavingsGoal[];
  onboarding_completed: boolean;
  onboarding_skipped: boolean;
};

type LoginPayload = {
  email: string;
  password: string;
};

type RegisterPayload = LoginPayload & {
  full_name: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  profile: FinancialProfile | null;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<FinancialProfile>;
  register: (payload: RegisterPayload) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshAccount: () => Promise<void>;
  setProfile: (profile: FinancialProfile) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<FinancialProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadAccount = useCallback(async () => {
    const [currentUser, currentProfile] = await Promise.all([
      api.get<AuthUser>("/auth/me"),
      api.get<FinancialProfile>("/profile/me"),
    ]);
    setUser(currentUser);
    setProfile(currentProfile);
    return currentProfile;
  }, []);

  useEffect(() => {
    const initialize = async () => {
      const storedToken = getAuthToken();
      const refreshToken = getRefreshToken();

      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        if (!hasValidAuthToken() && refreshToken) {
          const tokens = await api.post<AuthTokens>("/auth/refresh", {
            refresh_token: refreshToken,
          });
          setAuthSession(tokens);
        } else if (!hasValidAuthToken()) {
          clearAuthSession("Your session has expired. Please log in again.");
          return;
        }
        await loadAccount();
      } catch {
        setUser(null);
        setProfile(null);
      } finally {
        setIsLoading(false);
      }
    };

    const handleUnauthorized = () => {
      setUser(null);
      setProfile(null);
      setIsLoading(false);
    };

    void initialize();
    window.addEventListener("moneymate:unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("moneymate:unauthorized", handleUnauthorized);
    };
  }, [loadAccount]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      const tokens = await api.post<AuthTokens>("/auth/login", payload);
      setAuthSession(tokens);
      return loadAccount();
    },
    [loadAccount],
  );

  const register = useCallback(
    (payload: RegisterPayload) => api.post<AuthUser>("/auth/register", payload),
    [],
  );

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    try {
      await api.post<void>("/auth/logout", { refresh_token: refreshToken });
    } finally {
      clearAuthSession();
      clearApiCache();
      setUser(null);
      setProfile(null);
    }
  }, []);

  const refreshAccount = useCallback(async () => {
    await loadAccount();
  }, [loadAccount]);

  const value = useMemo(
    () => ({
      user,
      profile,
      isLoading,
      login,
      register,
      logout,
      refreshAccount,
      setProfile,
    }),
    [isLoading, login, logout, profile, refreshAccount, register, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
