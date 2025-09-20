import { useState, useEffect } from "react";
import { Settings, Database, Shield, Save, AlertCircle, CheckCircle, Wrench, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiService, DatabaseConfig } from "@/services/api";

const SYSTEM_DATABASE = "javascriptmyadmin_meta";
const SYSTEM_TABLES = ["_jsma_query_history", "_jsma_favorite_queries", "_jsma_favorite_tables"];

const DatabaseConfigComponent = () => {
  const { toast } = useToast();
  const [config, setConfig] = useState<DatabaseConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // System Setup State
  const [systemStatus, setSystemStatus] = useState<'loading' | 'ready' | 'error' | 'initializing' | 'initialized'>('loading');
  const [existingTables, setExistingTables] = useState<string[]>([]);

  useEffect(() => {
    loadConfig();
    checkSystemTables();
  }, []);

  const loadConfig = async () => {
    try {
      const savedConfig = localStorage.getItem('database-config');
      if (savedConfig) {
        setConfig(JSON.parse(savedConfig));
      } else {
        setConfig({
          database: { host: "localhost", port: 3306, username: "", password: "", defaultDatabase: "mysql", charset: "utf8mb4", collation: "utf8mb4_unicode_ci", connectionTimeout: 10000, maxConnections: 10, ssl: false, sslCertificate: "", sslKey: "", sslCA: "" },
          application: { theme: "dark", language: "en", queryTimeout: 30000, maxQueryResults: 1000, autoRefresh: false, refreshInterval: 30000 },
          security: { allowMultipleStatements: false, allowLocalInfile: false, requireSSL: false }
        });
      }
    } catch (error) {
      toast({ title: "Error loading configuration", description: "Failed to load database configuration", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!config) return;
    try {
      setIsSaving(true);
      const result = await apiService.saveConfig(config);
      if (result.success) {
        localStorage.setItem('database-config', JSON.stringify(config));
        toast({ title: "Configuration saved", description: result.message || "Database configuration has been saved successfully" });
      } else {
        throw new Error(result.message || 'Failed to save configuration');
      }
    } catch (error) {
      console.error('Error saving config:', error);
      toast({ title: "Error saving configuration", description: error instanceof Error ? error.message : "Failed to save database configuration", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const updateConfig = (section: keyof DatabaseConfig, key: string, value: any) => {
    if (!config) return;
    setConfig(prev => ({ ...prev!, [section]: { ...prev![section], [key]: value } }));
  };

  const checkSystemTables = async () => {
    setSystemStatus('loading');
    try {
      const databases = await apiService.getDatabases();
      if (!databases.includes(SYSTEM_DATABASE)) {
        setExistingTables([]);
        setSystemStatus('ready');
        return;
      }
      const { tables } = await apiService.getTables(SYSTEM_DATABASE);
      const foundTables = tables.map(t => t.name).filter(name => SYSTEM_TABLES.includes(name));
      setExistingTables(foundTables);
      if (foundTables.length === SYSTEM_TABLES.length) {
        setSystemStatus('initialized');
      } else {
        setSystemStatus('ready');
      }
    } catch (error) {
      console.error("Error checking system tables:", error);
      setSystemStatus('error');
    }
  };

  const initializeSystem = async () => {
    setSystemStatus('initializing');
    try {
      await apiService.executeQuery(`CREATE DATABASE IF NOT EXISTS ${SYSTEM_DATABASE};`);
      const queries = [
        `CREATE TABLE IF NOT EXISTS ${SYSTEM_DATABASE}._jsma_query_history ( id INT AUTO_INCREMENT PRIMARY KEY, query_text TEXT NOT NULL, database_context VARCHAR(255), executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, execution_time_ms INT, status ENUM('success', 'error') NOT NULL, error_message TEXT );`,
        `CREATE TABLE IF NOT EXISTS ${SYSTEM_DATABASE}._jsma_favorite_queries ( id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NOT NULL, query_text TEXT NOT NULL, database_context VARCHAR(255), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP );`,
        `CREATE TABLE IF NOT EXISTS ${SYSTEM_DATABASE}._jsma_favorite_tables ( id INT AUTO_INCREMENT PRIMARY KEY, database_name VARCHAR(255) NOT NULL, table_name VARCHAR(255) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY unique_favorite (database_name, table_name) );`
      ];
      for (const query of queries) {
        const result = await apiService.executeQuery(query);
        if (!result.success) throw new Error(result.error || 'Failed to execute a setup query.');
      }
      toast({ title: "System Initialized", description: "System tables have been created successfully." });
      setSystemStatus('initialized');
      await checkSystemTables();
    } catch (error) {
      console.error("Error initializing system:", error);
      toast({ title: "Initialization Failed", description: error instanceof Error ? error.message : "An unknown error occurred.", variant: "destructive" });
      setSystemStatus('error');
    }
  };

  const renderSystemStatus = () => {
    if (systemStatus === 'loading') return <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Checking status...</div>;
    if (systemStatus === 'error') return <div className="flex items-center gap-2 text-red-500"><AlertCircle className="h-4 w-4" /> Error checking status.</div>;
    if (systemStatus === 'initialized') return <div className="flex items-center gap-2 text-green-500"><CheckCircle className="h-4 w-4" /> System is initialized.</div>;
    return <div className="flex items-center gap-2 text-yellow-500"><AlertCircle className="h-4 w-4" /> System tables need to be created.</div>;
  };

  if (isLoading || !config) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Database className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Loading configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Application Configuration</h2>
          <p className="text-muted-foreground">Configure application and database server settings</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={saveConfig} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="database" className="space-y-4">
        <TabsList>
          <TabsTrigger value="database">Database Server</TabsTrigger>
          <TabsTrigger value="application">Application</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        <TabsContent value="database" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" />Connection Settings</CardTitle>
              <CardDescription>Configure your MySQL database server connection parameters. User credentials are provided at login.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label htmlFor="host">Host</Label><Input id="host" value={config.database.host} onChange={(e) => updateConfig('database', 'host', e.target.value)} placeholder="localhost" /></div>
                <div className="space-y-2"><Label htmlFor="port">Port</Label><Input id="port" type="number" value={config.database.port} onChange={(e) => updateConfig('database', 'port', parseInt(e.target.value))} placeholder="3306" /></div>
                <div className="space-y-2"><Label htmlFor="defaultDatabase">Default Database</Label><Input id="defaultDatabase" value={config.database.defaultDatabase} onChange={(e) => updateConfig('database', 'defaultDatabase', e.target.value)} placeholder="mysql" /></div>
                <div className="space-y-2"><Label htmlFor="charset">Charset</Label><Select value={config.database.charset} onValueChange={(value) => updateConfig('database', 'charset', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="utf8mb4">utf8mb4</SelectItem><SelectItem value="utf8">utf8</SelectItem><SelectItem value="latin1">latin1</SelectItem></SelectContent></Select></div>
              </div>
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label htmlFor="connectionTimeout">Connection Timeout (ms)</Label><Input id="connectionTimeout" type="number" value={config.database.connectionTimeout} onChange={(e) => updateConfig('database', 'connectionTimeout', parseInt(e.target.value))} /></div>
                <div className="space-y-2"><Label htmlFor="maxConnections">Max Connections</Label><Input id="maxConnections" type="number" value={config.database.maxConnections} onChange={(e) => updateConfig('database', 'maxConnections', parseInt(e.target.value))} /></div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between"><div className="space-y-0.5"><Label>Enable SSL</Label><p className="text-sm text-muted-foreground">Use SSL encryption for database connections</p></div><Switch checked={config.database.ssl} onCheckedChange={(checked) => updateConfig('database', 'ssl', checked)} /></div>
                {config.database.ssl && (<div className="space-y-4 pl-4 border-l-2 border-muted"><div className="space-y-2"><Label htmlFor="sslCertificate">SSL Certificate Path</Label><Input id="sslCertificate" value={config.database.sslCertificate} onChange={(e) => updateConfig('database', 'sslCertificate', e.target.value)} placeholder="/path/to/client-cert.pem" /></div><div className="space-y-2"><Label htmlFor="sslKey">SSL Key Path</Label><Input id="sslKey" value={config.database.sslKey} onChange={(e) => updateConfig('database', 'sslKey', e.target.value)} placeholder="/path/to/client-key.pem" /></div><div className="space-y-2"><Label htmlFor="sslCA">SSL CA Path</Label><Input id="sslCA" value={config.database.sslCA} onChange={(e) => updateConfig('database', 'sslCA', e.target.value)} placeholder="/path/to/ca-cert.pem" /></div></div>)}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="application" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" />Application Settings</CardTitle><CardDescription>Configure application behavior and preferences</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label htmlFor="queryTimeout">Query Timeout (ms)</Label><Input id="queryTimeout" type="number" value={config.application.queryTimeout} onChange={(e) => updateConfig('application', 'queryTimeout', parseInt(e.target.value))} /></div>
                <div className="space-y-2"><Label htmlFor="maxQueryResults">Max Query Results</Label><Input id="maxQueryResults" type="number" value={config.application.maxQueryResults} onChange={(e) => updateConfig('application', 'maxQueryResults', parseInt(e.target.value))} /></div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between"><div className="space-y-0.5"><Label>Auto Refresh</Label><p className="text-sm text-muted-foreground">Automatically refresh data at intervals</p></div><Switch checked={config.application.autoRefresh} onCheckedChange={(checked) => updateConfig('application', 'autoRefresh', checked)} /></div>
                {config.application.autoRefresh && (<div className="space-y-2 pl-4 border-l-2 border-muted"><Label htmlFor="refreshInterval">Refresh Interval (ms)</Label><Input id="refreshInterval" type="number" value={config.application.refreshInterval} onChange={(e) => updateConfig('application', 'refreshInterval', parseInt(e.target.value))} /></div>)}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />Security Settings</CardTitle><CardDescription>Configure security and safety options</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between"><div className="space-y-0.5"><Label>Allow Multiple Statements</Label><p className="text-sm text-muted-foreground">Allow executing multiple SQL statements in one query</p></div><Switch checked={config.security.allowMultipleStatements} onCheckedChange={(checked) => updateConfig('security', 'allowMultipleStatements', checked)} /></div>
                <div className="flex items-center justify-between"><div className="space-y-0.5"><Label>Allow Local Infile</Label><p className="text-sm text-muted-foreground">Allow LOAD DATA LOCAL INFILE statements</p></div><Switch checked={config.security.allowLocalInfile} onCheckedChange={(checked) => updateConfig('security', 'allowLocalInfile', checked)} /></div>
                <div className="flex items-center justify-between"><div className="space-y-0.5"><Label>Require SSL</Label><p className="text-sm text-muted-foreground">Force SSL connections only</p></div><Switch checked={config.security.requireSSL} onCheckedChange={(checked) => updateConfig('security', 'requireSSL', checked)} /></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Wrench className="h-5 w-5" />System Setup</CardTitle>
              <CardDescription>Create necessary tables for system features like query history and favorites.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-md">{renderSystemStatus()}</div>
              <ul className="space-y-2">
                {SYSTEM_TABLES.map(table => (
                  <li key={table} className="flex items-center justify-between p-3 bg-accent rounded-lg">
                    <div className="flex items-center gap-3">
                      {existingTables.includes(table) ? <CheckCircle className="h-5 w-5 text-green-500" /> : <AlertCircle className="h-5 w-5 text-yellow-500" />}
                      <span className="font-mono text-sm">{table}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{existingTables.includes(table) ? "Exists" : "Missing"}</span>
                  </li>
                ))}
              </ul>
              <div className="pt-4">
                <Button onClick={initializeSystem} disabled={systemStatus === 'loading' || systemStatus === 'initializing' || systemStatus === 'initialized'}>
                  {systemStatus === 'initializing' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {systemStatus === 'initializing' ? 'Initializing...' : 'Initialize System Tables'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DatabaseConfigComponent;