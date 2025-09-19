"use client";

import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { apiService, LoginCredentials, UserProfile } from "@/services/api";

interface AuthContextType {
  isAuthenticated: boolean;
  user: UserProfile | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  hasPrivilege: (privilege: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);

  const login = useCallback(async (credentials: LoginCredentials) => {
    try {
      const result = await apiService.login(credentials);
      if (result.success && result.user) {
        apiService.setCredentials(credentials);
        setIsAuthenticated(true);
        setUser(result.user);
      } else {
        throw new Error(result.message || "Login falhou");
      }
    } catch (error) {
      apiService.setCredentials(null);
      setIsAuthenticated(false);
      setUser(null);
      throw error; // Re-lança para ser capturado pela UI
    }
  }, []);

  const logout = useCallback(() => {
    apiService.setCredentials(null);
    setIsAuthenticated(false);
    setUser(null);
  }, []);

  const hasPrivilege = useCallback(
    (privilege: string): boolean => {
      if (!user || !user.globalPrivileges) {
        return false;
      }
      // Check for specific privilege or for 'ALL PRIVILEGES'
      return (
        user.globalPrivileges.includes(privilege.toUpperCase()) ||
        user.globalPrivileges.includes("ALL PRIVILEGES")
      );
    },
    [user],
  );

  const value = { isAuthenticated, user, login, logout, hasPrivilege };

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