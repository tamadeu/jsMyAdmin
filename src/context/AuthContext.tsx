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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { ReactNode }) => {
  const { t } = useTranslation(); // Initialize useTranslation
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const logout = useCallback(async () => {
    await apiService.logout();
    setIsAuthenticated(false);
    setUser(null);
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

  const value = { isAuthenticated, isInitializing, user, login, logout, hasPrivilege };

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