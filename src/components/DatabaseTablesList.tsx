"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Table, Eye, Loader2, AlertCircle, RefreshCw, Search, X, Plus, Trash2, Eraser, LayoutPanelTop, Play } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table as ShadcnTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiService, TableInfo } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useDatabaseCache } from "@/context/DatabaseCacheContext";
import CreateTableDialog from "@/components/CreateTableDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useTabs } from "@/context/TabContext";
import { useTranslation } from "react-i18next"; // Import useTranslation

interface DatabaseTablesListProps {
  database: string;
  filterType?: 'all' | 'tables' | 'views';
}

const DatabaseTablesList = ({ database, filterType = 'all' }: DatabaseTablesListProps) => {
  const { t } = useTranslation(); // Initialize useTranslation
  const { toast } = useToast();
  const navigate = useNavigate();
  const { hasPrivilege } = useAuth();
  const { databases, isLoadingDatabases, databaseError, refreshDatabases } = useDatabaseCache();
  const { addTab, removeTab, activeTabId } = useTabs();

  const [allTables, setAllTables] = useState<TableInfo[]>([]);
  const [allViews, setAllViews] = useState<TableInfo[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateTableDialogOpen, setIsCreateTableDialogOpen] = useState(false);
  const [deleteTableConfirm, setDeleteTableConfirm] = useState<string | null>(null);
  const [truncateTableConfirm, setTruncateTableConfirm] = useState<string | null>(null);

  useEffect(() => {
    const dbInfo = databases.find(db => db.name === database);
    if (dbInfo) {
      setAllTables(dbInfo.tables);
      setAllViews(dbInfo.views);
    } else {
      setAllTables([]);
      setAllViews([]);
    }
  }, [databases, database]);

  const filteredItems = useMemo(() => {
    let items: TableInfo[] = [];
    if (filterType === 'tables' || filterType === 'all') {
      items = items.concat(allTables);
    }
    if (filterType === 'views' || filterType === 'all') {
      items = items.concat(allViews);
    }

    return items.filter(item =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allTables, allViews, searchTerm, filterType]);

  const handleOpenTable = (tableName: string) => {
    navigate(`/${database}/${tableName}`);
  };

  const handleOpenTableStructure = (tableName: string) => {
    navigate(`/${database}/${tableName}/structure`);
  };

  const handleOpenSqlEditor = (tableName: string) => {
    const query = `SELECT * FROM \`${database}\`.\`${tableName}\`;`;
    addTab({
      title: t("header.sqlEditorTitle"),
      type: "sql-editor",
      closable: true,
      sqlQueryContent: query,
    });
    removeTab(activeTabId);
  };

  const handleDeleteTable = async (tableName: string) => {
    try {
      await apiService.deleteTable(database, tableName);
      toast({
        title: t("databaseTablesList.tableDeleted"),
        description: t("databaseTablesList.tableDeletedSuccessfully", { tableName: tableName }),
      });
      refreshDatabases({ databaseName: database });
    } catch (err) {
      toast({
        title: t("databaseTablesList.errorDeletingTable"),
        description: err instanceof Error ? err.message : t("databaseTablesList.failedToToDeleteTable"),
        variant: "destructive",
      });
    } finally {
      setDeleteTableConfirm(null);
    }
  };

  const handleTruncateTable = async (tableName: string) => {
    try {
      await apiService.truncateTable(database, tableName);
      toast({
        title: t("databaseTablesList.tableTruncated"),
        description: t("databaseTablesList.tableTruncatedSuccessfully", { tableName: tableName }),
      });
      refreshDatabases({ databaseName: database });
    } catch (err) {
      toast({
        title: t("databaseTablesList.errorTruncatingTable"),
        description: err instanceof Error ? err.message : t("databaseTablesList.failedToTruncateTable"),
        variant: "destructive",
      });
    } finally {
      setTruncateTableConfirm(null);
    }
  };

  const getTitle = () => {
    switch (filterType) {
      case 'tables': return t("databaseTablesList.tablesTitle", { databaseName: database });
      case 'views': return t("databaseTablesList.viewsTitle", { databaseName: database });
      default: return t("databaseTablesList.tablesAndViewsTitle", { databaseName: database });
    }
  };

  const getDescription = () => {
    switch (filterType) {
      case 'tables': return t("databaseTablesList.tablesDescription", { databaseName: database });
      case 'views': return t("databaseTablesList.viewsDescription", { databaseName: database });
      default: return t("databaseTablesList.tablesAndViewsDescription", { databaseName: database });
    }
  };

  if (isLoadingDatabases) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">{t("databaseTablesList.loadingTablesAndViews", { databaseName: database })}</p>
        </div>
      </div>
    );
  }

  if (databaseError) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 mx-auto mb-4 text-red-500" />
          <p className="text-red-500 mb-4">{databaseError}</p>
          <Button onClick={() => refreshDatabases({ force: true })} variant="outline">
            {t("databaseTablesList.retry")}
          </Button>
        </div>
      </div>
    );
  }

  const hasContent = filteredItems.length > 0;

  return (
    <div className="p-6 space-y-6 h-full overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{getTitle()}</h1>
          <p className="text-muted-foreground">{getDescription()}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refreshDatabases({ databaseName: database, force: true })}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {t("databaseTablesList.refresh")}
          </Button>
          {hasPrivilege("CREATE") && filterType !== 'views' && (
            <Button size="sm" onClick={() => setIsCreateTableDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t("databaseTablesList.createTable")}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("databaseTablesList.searchFilter")}</CardTitle>
          <CardDescription>{t("databaseTablesList.searchFilterDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("databaseTablesList.searchPlaceholder")}
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setSearchTerm("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {!hasContent && (
        <div className="text-center py-8">
          <Table className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">
            {searchTerm ? t("databaseTablesList.noItemsFound") : 
              filterType === 'tables' ? t("databaseTablesList.noTablesInDb") : 
              filterType === 'views' ? t("databaseTablesList.noViewsInDb") : 
              t("databaseTablesList.noTablesOrViewsInDb")}
          </p>
        </div>
      )}

      {filteredItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Table className="h-5 w-5" />
              {filterType === 'tables' ? t("databaseTablesList.tables") : filterType === 'views' ? t("databaseTablesList.views") : t("databaseTablesList.items")} ({filteredItems.length})
            </CardTitle>
            <CardDescription>{t("databaseTablesList.listOfItems", { type: filterType === 'tables' ? t("databaseTablesList.tables") : filterType === 'views' ? t("databaseTablesList.views") : t("databaseTablesList.items"), databaseName: database })}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <ShadcnTable>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("databaseTablesList.name")}</TableHead>
                    <TableHead>{t("databaseTablesList.type")}</TableHead>
                    <TableHead>{t("databaseTablesList.rows")}</TableHead>
                    <TableHead>{t("databaseTablesList.size")}</TableHead>
                    <TableHead>{t("databaseTablesList.engine")}</TableHead>
                    <TableHead>{t("databaseTablesList.collation")}</TableHead>
                    <TableHead className="text-right">{t("databaseTablesList.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.name}>
                      <TableCell className="font-medium">
                        <span 
                          className="cursor-pointer text-blue-600 hover:underline" 
                          onClick={() => handleOpenTable(item.name)}
                        >
                          {item.name}
                        </span>
                      </TableCell>
                      <TableCell>{allTables.some(t => t.name === item.name) ? t("databaseTablesList.table") : t("databaseTablesList.view")}</TableCell>
                      <TableCell>{item.rows.toLocaleString()}</TableCell>
                      <TableCell>{item.size}</TableCell>
                      <TableCell>{item.engine}</TableCell>
                      <TableCell>{item.collation}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleOpenTableStructure(item.name)}>
                            <LayoutPanelTop className="h-4 w-4 mr-2" />
                            {t("databaseTablesList.structure")}
                          </Button>
                          {allTables.some(t => t.name === item.name) && hasPrivilege("DELETE") && (
                            <Button variant="ghost" size="sm" onClick={() => setTruncateTableConfirm(item.name)} className="text-orange-500 hover:text-orange-600">
                              <Eraser className="h-4 w-4 mr-2" />
                              {t("databaseTablesList.empty")}
                            </Button>
                          )}
                          {allTables.some(t => t.name === item.name) && hasPrivilege("DROP") && (
                            <Button variant="ghost" size="sm" onClick={() => setDeleteTableConfirm(item.name)} className="text-red-500 hover:bg-red-600">
                              <Trash2 className="h-4 w-4 mr-2" />
                              {t("databaseTablesList.delete")}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </ShadcnTable>
            </div>
          </CardContent>
        </Card>
      )}

      <CreateTableDialog
        open={isCreateTableDialogOpen}
        onOpenChange={setIsCreateTableDialogOpen}
        database={database}
      />

      {/* Delete Table Confirmation Dialog */}
      {deleteTableConfirm && (
        <AlertDialog open={!!deleteTableConfirm} onOpenChange={setDeleteTableConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("databaseTablesList.confirmDeleteTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("databaseTablesList.confirmDeleteDescription", { tableName: deleteTableConfirm, databaseName: database })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("databaseTablesList.cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleDeleteTable(deleteTableConfirm)} className="bg-red-500 hover:bg-red-600">
                <Trash2 className="h-4 w-4 mr-2" />
                {t("databaseTablesList.deleteTable")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Truncate Table Confirmation Dialog */}
      {truncateTableConfirm && (
        <AlertDialog open={!!truncateTableConfirm} onOpenChange={setTruncateTableConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("databaseTablesList.confirmTruncateTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("databaseTablesList.confirmTruncateDescription", { tableName: truncateTableConfirm, databaseName: database })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("databaseTablesList.cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleTruncateTable(truncateTableConfirm)} className="bg-orange-500 hover:bg-orange-600">
                <Eraser className="h-4 w-4 mr-2" />
                {t("databaseTablesList.emptyTable")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
};

export default DatabaseTablesList;