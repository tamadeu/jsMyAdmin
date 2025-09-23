"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { apiService, DatabaseTablesResponse } from '@/services/api';
import { useAuth } from './AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next'; // Import useTranslation

interface DatabaseInfo {
  name: string;
  tables: DatabaseTablesResponse['tables'];
  views: DatabaseTablesResponse['views'];
  totalTables: number;
  totalViews: number;
}

interface DatabaseCacheContextType {
  databases: DatabaseInfo[];
  isLoadingDatabases: boolean;
  databaseError: string | null;
  refreshDatabases: (options?: { force?: boolean; databaseName?: string }) => Promise<void>;
}

const DatabaseCacheContext = createContext<DatabaseCacheContextType | undefined>(undefined);

const CACHE_EXPIRATION_TIME = 5 * 60 * 1000;

export function DatabaseCacheProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation(); // Initialize useTranslation
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  const [isLoadingDatabases, setIsLoadingDatabases] = useState(true);
  const [databaseError, setDatabaseError] = useState<string | null>(null);

  const getCacheKey = useCallback(() => {
    if (!user) return null;
    return `jsmyadmin-db-cache-${user.username}@${user.host}`;
  }, [user]);

  const loadDatabasesFromAPI = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setIsLoadingDatabases(false);
      return;
    }

    setIsLoadingDatabases(true);
    setDatabaseError(null);
    try {
      const databaseNames = await apiService.getDatabases();
      
      const databasesWithTablesAndViews = await Promise.all(
        databaseNames.map(async (dbName) => {
          try {
            const tablesData = await apiService.getTables(dbName);
            return {
              name: dbName,
              tables: tablesData.tables,
              views: tablesData.views,
              totalTables: tablesData.totalTables,
              totalViews: tablesData.totalViews
            };
          } catch (error) {
            console.error(`Error loading tables for ${dbName}:`, error);
            return {
              name: dbName,
              tables: [],
              views: [],
              totalTables: 0,
              totalViews: 0
            };
          }
        })
      );

      const cacheKey = getCacheKey();
      if (cacheKey) {
        localStorage.setItem(cacheKey, JSON.stringify({
          timestamp: Date.now(),
          data: databasesWithTablesAndViews
        }));
      }
      setDatabases(databasesWithTablesAndViews);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('dashboard.failedToLoadDatabases');
      setDatabaseError(errorMessage);
      toast({
        title: t("dashboard.errorLoadingDatabases"),
        description: t("dashboard.checkConfig"),
        variant: "destructive"
      });
    } finally {
      setIsLoadingDatabases(false);
    }
  }, [isAuthenticated, user, getCacheKey, toast, t]);

  const refreshDatabases = useCallback(async (options?: { force?: boolean; databaseName?: string }) => {
    const cacheKey = getCacheKey();
    if (cacheKey) {
      if (options?.databaseName) {
        const cachedData = localStorage.getItem(cacheKey);
        if (cachedData) {
          const parsedCache = JSON.parse(cachedData);
          const existingDbIndex = parsedCache.data.findIndex((db: DatabaseInfo) => db.name === options.databaseName);
          if (existingDbIndex !== -1) {
            parsedCache.data.splice(existingDbIndex, 1);
            localStorage.setItem(cacheKey, JSON.stringify(parsedCache));
          }
        }
      } else {
        localStorage.removeItem(cacheKey);
      }
    }
    await loadDatabasesFromAPI();
  }, [getCacheKey, loadDatabasesFromAPI]);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setDatabases([]);
      setIsLoadingDatabases(false);
      return;
    }

    const cacheKey = getCacheKey();
    if (!cacheKey) {
      loadDatabasesFromAPI();
      return;
    }

    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
      try {
        const parsedCache = JSON.parse(cachedData);
        if (Date.now() - parsedCache.timestamp < CACHE_EXPIRATION_TIME) {
          setDatabases(parsedCache.data);
          setIsLoadingDatabases(false);
          return;
        }
      } catch (e) {
        console.error("Error parsing database cache:", e);
        localStorage.removeItem(cacheKey);
      }
    }
    loadDatabasesFromAPI();
  }, [isAuthenticated, user, getCacheKey, loadDatabasesFromAPI]);

  const value = React.useMemo(() => ({
    databases,
    isLoadingDatabases,
    databaseError,
    refreshDatabases,
  }), [databases, isLoadingDatabases, databaseError, refreshDatabases]);

  return (
    <DatabaseCacheContext.Provider value={value}>
      {children}
    </DatabaseCacheContext.Provider>
  );
}

export function useDatabaseCache() {
  const context = useContext(DatabaseCacheContext);
  if (context === undefined) {
    throw new Error('useDatabaseCache must be used within a DatabaseCacheProvider');
  }
  return context;
}