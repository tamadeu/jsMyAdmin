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

interface AuthContextType {
  isAuthenticated: boolean;
  isInitializing: boolean;
  user: UserProfile | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  hasPrivilege: (privilege: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
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
        throw new Error(result.message || "Login falhou");
      }
    } catch (error) {
      await logout(); // Garante que o estado seja limpo em caso de falha
      throw error; // Re-lança para ser capturado pela UI
    }
  }, [logout]);

  useEffect(() => {
    const validateSession = async () => {
      try {
        // O construtor do apiService já carrega o token do localStorage
        const userProfile = await apiService.validateSession();
        setUser(userProfile);
        setIsAuthenticated(true);
      } catch (error) {
        console.error("Session validation failed, logging out.", error);
        await apiService.logout(); // Limpa qualquer token inválido
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
      // Check for specific privilege or for 'ALL PRIVILEGES'
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