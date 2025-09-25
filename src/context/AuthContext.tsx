"use client";

import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useEffect,
} from "react";
import { apiService, LoginCredentials, UserProfile } from "@/services/api";
import { useTranslation } from "react-i18next"; // Import useTranslation

interface AuthContextType {
  isAuthenticated: boolean;
  isInitializing: boolean;
  user: UserProfile | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  hasPrivilege: (privilege: string) => boolean;
  canPerformDatabaseAction: (action: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation(); // Initialize useTranslation
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const logout = useCallback(async () => {
    console.log('AuthContext: Starting logout process');
    await apiService.logout();
    setIsAuthenticated(false);
    setUser(null);
    console.log('AuthContext: Logout completed');
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    try {
      const result = await apiService.login(credentials);
      if (result.success && result.user && result.token) {
        apiService.setToken(result.token);
        setIsAuthenticated(true);
        setUser(result.user);
      } else {
        throw new Error(result.message || t("loginPage.connectionFailed"));
      }
    } catch (error) {
      await logout();
      throw error;
    }
  }, [logout, t]);

  useEffect(() => {
    const validateSession = async () => {
      try {
        const userProfile = await apiService.validateSession();
        setUser(userProfile);
        setIsAuthenticated(true);
      } catch (error) {
        console.error("Session validation failed, logging out.", error);
        await apiService.logout();
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setIsInitializing(false);
      }
    };

    validateSession();
  }, []);

  const hasPrivilege = useCallback(
    (privilege: string): boolean => {
      if (!user || !user.globalPrivileges) {
        return false;
      }
      return (
        user.globalPrivileges.includes(privilege.toUpperCase()) ||
        user.globalPrivileges.includes("ALL PRIVILEGES")
      );
    },
    [user],
  );

  // New function for database-specific privilege checking
  // This is optimistic - shows UI elements and lets backend handle actual permission validation
  const canPerformDatabaseAction = useCallback(
    (action: string): boolean => {
      if (!user) return false;
      
      // If user has global privileges, they can definitely perform the action
      if (hasPrivilege(action)) return true;
      
      // For users without global privileges, we optimistically allow actions
      // The backend will handle the actual permission validation
      // This prevents the UI from being overly restrictive for users with database-specific privileges
      const basicActions = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'INDEX'];
      
      return basicActions.includes(action.toUpperCase());
    },
    [user, hasPrivilege],
  );

  const value = { isAuthenticated, isInitializing, user, login, logout, hasPrivilege, canPerformDatabaseAction };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};