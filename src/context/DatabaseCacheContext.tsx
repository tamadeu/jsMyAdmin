"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { apiService, DatabaseTablesResponse } from '@/services/api';
import { useAuth } from './AuthContext';
import { useToast } from '@/hooks/use-toast';

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

const CACHE_EXPIRATION_TIME = 5 * 60 * 1000; // 5 minutos em milissegundos

export function DatabaseCacheProvider({ children }: { children: ReactNode }) {
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
      const errorMessage = error instanceof Error ? error.message : 'Failed to load databases';
      setDatabaseError(errorMessage);
      toast({
        title: "Error loading databases",
        description: "Please check your database connection in Configuration",
        variant: "destructive"
      });
    } finally {
      setIsLoadingDatabases(false);
    }
  }, [isAuthenticated, user, getCacheKey, toast]);

  const refreshDatabases = useCallback(async (options?: { force?: boolean; databaseName?: string }) => {
    const cacheKey = getCacheKey();
    if (cacheKey) {
      if (options?.databaseName) {
        // If a specific database is named, try to update only that part of the cache
        const cachedData = localStorage.getItem(cacheKey);
        if (cachedData) {
          const parsedCache = JSON.parse(cachedData);
          const existingDbIndex = parsedCache.data.findIndex((db: DatabaseInfo) => db.name === options.databaseName);
          if (existingDbIndex !== -1) {
            // Temporarily remove the specific database from cache to force reload for it
            parsedCache.data.splice(existingDbIndex, 1);
            localStorage.setItem(cacheKey, JSON.stringify(parsedCache));
          }
        }
      } else {
        // Invalidate entire cache
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
        localStorage.removeItem(cacheKey); // Corrupt cache, remove it
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