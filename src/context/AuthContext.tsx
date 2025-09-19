"use client";

import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { apiService, LoginCredentials } from "@/services/api";

interface AuthContextType {
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const login = useCallback(async (credentials: LoginCredentials) => {
    try {
      const result = await apiService.login(credentials);
      if (result.success) {
        apiService.setCredentials(credentials);
        setIsAuthenticated(true);
      } else {
        throw new Error(result.message || "Login falhou");
      }
    } catch (error) {
      apiService.setCredentials(null);
      setIsAuthenticated(false);
      throw error; // Re-lança para ser capturado pela UI
    }
  }, []);

  const logout = useCallback(() => {
    apiService.setCredentials(null);
    setIsAuthenticated(false);
  }, []);

  const value = { isAuthenticated, login, logout };

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