import { useState, useEffect } from "react";
import { Settings, Database, Shield, Save, AlertCircle, CheckCircle, Wrench, Loader2, Brain } from "lucide-react";
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
import { useTranslation } from "react-i18next"; // Import useTranslation

const SYSTEM_DATABASE = "javascriptmyadmin_meta";
const SYSTEM_TABLES = ["_jsma_query_history", "_jsma_favorite_queries", "_jsma_favorite_tables", "_jsma_sessions"];

const DatabaseConfigComponent = () => {
  const { t } = useTranslation(); // Initialize useTranslation
  const { toast } = useToast();
  const [config, setConfig] = useState<DatabaseConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [systemStatus, setSystemStatus] = useState<'loading' | 'ready' | 'error' | 'initializing' | 'initialized'>('loading');
  const [existingTables, setExistingTables] = useState<string[]>([]);
  const [systemMessage, setSystemMessage] = useState<string>('');

  useEffect(() => {
    loadConfig();
    checkSystemTables();
  }, []);

  const loadConfig = async () => {
    try {
      const savedConfig = localStorage.getItem('database-config');
      if (savedConfig) {
        const parsedConfig = JSON.parse(savedConfig);
        // Ensure AI section exists and has default values if not present
        if (!parsedConfig.ai) {
          parsedConfig.ai = { geminiApiKey: "", openAIApiKey: "", anthropicApiKey: "" };
        }
        parsedConfig.database.username = ""; 
        parsedConfig.database.password = "";
        setConfig(parsedConfig);
      } else {
        setConfig({
          database: { host: "localhost", port: 3306, username: "", password: "", defaultDatabase: "mysql", charset: "utf8mb4", collation: "utf8mb4_unicode_ci", connectionTimeout: 10000, maxConnections: 10, ssl: false, sslCertificate: "", sslKey: "", sslCA: "" },
          application: { theme: "dark", language: "en", queryTimeout: 30000, maxQueryResults: 1000, autoRefresh: false, refreshInterval: 30000 },
          security: { allowMultipleStatements: false, allowLocalInfile: false, requireSSL: false },
          ai: { geminiApiKey: "", openAIApiKey: "", anthropicApiKey: "" } // Default AI config
        });
      }
    } catch (error) {
      toast({ title: t("configurationPage.errorLoadingConfig"), description: t("configurationPage.failedToLoadConfig"), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!config) return;
    try {
      setIsSaving(true);
      const configToSave = {
        database: {
          host: config.database.host,
          port: config.database.port,
          defaultDatabase: config.database.defaultDatabase,
          charset: config.database.charset,
          collation: config.database.collation,
          connectionTimeout: config.database.connectionTimeout,
          maxConnections: config.database.maxConnections,
          ssl: config.database.ssl,
          sslCertificate: config.database.sslCertificate,
          sslKey: config.database.sslKey,
          sslCA: config.database.sslCA,
        },
        application: config.application,
        security: config.security,
        ai: config.ai // Include AI config
      };

      const result = await apiService.saveConfig(configToSave);
      if (result.success) {
        const localStorageConfig = JSON.parse(JSON.stringify(configToSave));
        localStorage.setItem('database-config', JSON.stringify(localStorageConfig));
        toast({ title: t("configurationPage.configurationSaved"), description: result.message || t("configurationPage.configurationSavedSuccessfully") });
      } else {
        throw new Error(result.message || t('configurationPage.failedToSaveConfig'));
      }
    } catch (error) {
      console.error('Error saving config:', error);
      toast({ title: t("configurationPage.errorSavingConfig"), description: error instanceof Error ? error.message : t("configurationPage.failedToSaveConfig"), variant: "destructive" });
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
    setSystemMessage(t('configurationPage.checkingStatus'));
    try {
      const statusResponse = await apiService.getSystemStatus();
      setSystemMessage(statusResponse.message);
      if (statusResponse.status === 'ready') {
        setSystemStatus('initialized');
        const { tables } = await apiService.getTables(SYSTEM_DATABASE);
        setExistingTables(tables.map(t => t.name));
      } else {
        setSystemStatus('ready');
        setExistingTables([]);
      }
    } catch (error) {
      console.error("Error checking system tables:", error);
      setSystemStatus('error');
      setSystemMessage(error instanceof Error ? error.message : t("configurationPage.errorCheckingSystemStatus"));
    }
  };

  const initializeSystem = async () => {
    setSystemStatus('initializing');
    setSystemMessage(t('configurationPage.initializingSystemTables'));
    try {
      const result = await apiService.initializeSystem();
      if (result.success) {
        toast({ title: t("configurationPage.systemInitialized"), description: t("configurationPage.systemInitializedSuccess") });
        setSystemStatus('initialized');
        setSystemMessage(result.message);
        await checkSystemTables();
      } else {
        throw new Error(result.message || t('configurationPage.failedToInitializeSystemTables'));
      }
    } catch (error) {
      console.error("Error initializing system:", error);
      toast({ title: t("configurationPage.initializationFailed"), description: error instanceof Error ? error.message : t("configurationPage.unknownError"), variant: "destructive" });
      setSystemStatus('error');
      setSystemMessage(error instanceof Error ? error.message : t("configurationPage.unknownErrorDuringInitialization"));
    }
  };

  const renderSystemStatus = () => {
    if (systemStatus === 'loading') return <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> {systemMessage}</div>;
    if (systemStatus === 'error') return <div className="flex items-center gap-2 text-red-500"><AlertCircle className="h-4 w-4" /> {systemMessage}</div>;
    if (systemStatus === 'initialized') return <div className="flex items-center gap-2 text-green-500"><CheckCircle className="h-4 w-4" /> {systemMessage}</div>;
    return <div className="flex items-center gap-2 text-yellow-500"><AlertCircle className="h-4 w-4" /> {systemMessage}</div>;
  };

  if (isLoading || !config) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Database className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">{t("configurationPage.loadingConfiguration")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t("configurationPage.title")}</h2>
          <p className="text-muted-foreground">{t("configurationPage.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={saveConfig} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? t('configurationPage.saving') : t('configurationPage.saveConfiguration')}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="database" className="space-y-4">
        <TabsList>
          <TabsTrigger value="database">{t("configurationPage.databaseServer")}</TabsTrigger>
          <TabsTrigger value="application">{t("configurationPage.application")}</TabsTrigger>
          <TabsTrigger value="security">{t("configurationPage.security")}</TabsTrigger>
          <TabsTrigger value="ai">{t("configurationPage.ai")}</TabsTrigger> {/* New AI Tab Trigger */}
          <TabsTrigger value="system">{t("configurationPage.system")}</TabsTrigger>
        </TabsList>

        <TabsContent value="database" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" />{t("configurationPage.connectionSettings")}</CardTitle>
              <CardDescription>{t("configurationPage.connectionSettingsDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label htmlFor="defaultDatabase">{t("configurationPage.defaultDatabase")}</Label><Input id="defaultDatabase" value={config.database.defaultDatabase} onChange={(e) => updateConfig('database', 'defaultDatabase', e.target.value)} placeholder="mysql" /></div>
                <div className="space-y-2"><Label htmlFor="charset">{t("configurationPage.charset")}</Label><Select value={config.database.charset} onValueChange={(value) => updateConfig('database', 'charset', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="utf8mb4">utf8mb4</SelectItem><SelectItem value="utf8">utf8</SelectItem><SelectItem value="latin1">latin1</SelectItem></SelectContent></Select></div>
              </div>
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label htmlFor="connectionTimeout">{t("configurationPage.connectionTimeout")}</Label><Input id="connectionTimeout" type="number" value={config.database.connectionTimeout} onChange={(e) => updateConfig('database', 'connectionTimeout', parseInt(e.target.value))} /></div>
                <div className="space-y-2"><Label htmlFor="maxConnections">{t("configurationPage.maxConnections")}</Label><Input id="maxConnections" type="number" value={config.database.maxConnections} onChange={(e) => updateConfig('database', 'maxConnections', parseInt(e.target.value))} /></div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between"><div className="space-y-0.5"><Label>{t("configurationPage.enableSsl")}</Label><p className="text-sm text-muted-foreground">{t("configurationPage.enableSslDescription")}</p></div><Switch checked={config.database.ssl} onCheckedChange={(checked) => updateConfig('database', 'ssl', checked)} /></div>
                {config.database.ssl && (<div className="space-y-4 pl-4 border-l-2 border-muted"><div className="space-y-2"><Label htmlFor="sslCertificate">{t("configurationPage.sslCertificatePath")}</Label><Input id="sslCertificate" value={config.database.sslCertificate} onChange={(e) => updateConfig('database', 'sslCertificate', e.target.value)} placeholder="/path/to/client-cert.pem" /></div><div className="space-y-2"><Label htmlFor="sslKey">{t("configurationPage.sslKeyPath")}</Label><Input id="sslKey" value={config.database.sslKey} onChange={(e) => updateConfig('database', 'sslKey', e.target.value)} placeholder="/path/to/client-key.pem" /></div><div className="space-y-2"><Label htmlFor="sslCA">{t("configurationPage.sslCaPath")}</Label><Input id="sslCA" value={config.database.sslCA} onChange={(e) => updateConfig('database', 'sslCA', e.target.value)} placeholder="/path/to/ca-cert.pem" /></div></div>)}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="application" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" />{t("configurationPage.applicationSettings")}</CardTitle><CardDescription>{t("configurationPage.applicationSettingsDescription")}</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label htmlFor="queryTimeout">{t("configurationPage.queryTimeout")}</Label><Input id="queryTimeout" type="number" value={config.application.queryTimeout} onChange={(e) => updateConfig('application', 'queryTimeout', parseInt(e.target.value))} /></div>
                <div className="space-y-2"><Label htmlFor="maxQueryResults">{t("configurationPage.maxQueryResults")}</Label><Input id="maxQueryResults" type="number" value={config.application.maxQueryResults} onChange={(e) => updateConfig('application', 'maxQueryResults', parseInt(e.target.value))} /></div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between"><div className="space-y-0.5"><Label>{t("configurationPage.autoRefresh")}</Label><p className="text-sm text-muted-foreground">{t("configurationPage.autoRefreshDescription")}</p></div><Switch checked={config.application.autoRefresh} onCheckedChange={(checked) => updateConfig('application', 'autoRefresh', checked)} /></div>
                {config.application.autoRefresh && (<div className="space-y-2 pl-4 border-l-2 border-muted"><Label htmlFor="refreshInterval">{t("configurationPage.refreshInterval")}</Label><Input id="refreshInterval" type="number" value={config.application.refreshInterval} onChange={(e) => updateConfig('application', 'refreshInterval', parseInt(e.target.value))} /></div>)}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />{t("configurationPage.securitySettings")}</CardTitle><CardDescription>{t("configurationPage.securitySettingsDescription")}</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between"><div className="space-y-0.5"><Label>{t("configurationPage.allowMultipleStatements")}</Label><p className="text-sm text-muted-foreground">{t("configurationPage.allowMultipleStatementsDescription")}</p></div><Switch checked={config.security.allowMultipleStatements} onCheckedChange={(checked) => updateConfig('security', 'allowMultipleStatements', checked)} /></div>
                <div className="flex items-center justify-between"><div className="space-y-0.5"><Label>{t("configurationPage.allowLocalInfile")}</Label><p className="text-sm text-muted-foreground">{t("configurationPage.allowLocalInfileDescription")}</p></div><Switch checked={config.security.allowLocalInfile} onCheckedChange={(checked) => updateConfig('security', 'allowLocalInfile', checked)} /></div>
                <div className="flex items-center justify-between"><div className="space-y-0.5"><Label>{t("configurationPage.requireSsl")}</Label><p className="text-sm text-muted-foreground">{t("configurationPage.requireSslDescription")}</p></div><Switch checked={config.security.requireSSL} onCheckedChange={(checked) => updateConfig('security', 'requireSsl', checked)} /></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* New AI Tab Content */}
        <TabsContent value="ai" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5" />{t("configurationPage.aiSettings")}</CardTitle>
              <CardDescription>{t("configurationPage.aiSettingsDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="geminiApiKey">{t("configurationPage.geminiApiKey")}</Label>
                <Input 
                  id="geminiApiKey" 
                  type="password" 
                  value={config.ai.geminiApiKey} 
                  onChange={(e) => updateConfig('ai', 'geminiApiKey', e.target.value)} 
                  placeholder={t("configurationPage.geminiApiKeyPlaceholder")} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="openAIApiKey">{t("configurationPage.openAIApiKey")}</Label>
                <Input 
                  id="openAIApiKey" 
                  type="password" 
                  value={config.ai.openAIApiKey} 
                  onChange={(e) => updateConfig('ai', 'openAIApiKey', e.target.value)} 
                  placeholder={t("configurationPage.openAIApiKeyPlaceholder")} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="anthropicApiKey">{t("configurationPage.anthropicApiKey")}</Label>
                <Input 
                  id="anthropicApiKey" 
                  type="password" 
                  value={config.ai.anthropicApiKey} 
                  onChange={(e) => updateConfig('ai', 'anthropicApiKey', e.target.value)} 
                  placeholder={t("configurationPage.anthropicApiKeyPlaceholder")} 
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Wrench className="h-5 w-5" />{t("configurationPage.systemSetup")}</CardTitle>
              <CardDescription>{t("configurationPage.systemSetupDescription")}</CardDescription>
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
                    <span className="text-sm text-muted-foreground">{existingTables.includes(table) ? t("configurationPage.exists") : t("configurationPage.missing")}</span>
                  </li>
                ))}
              </ul>
              <div className="pt-4">
                <Button onClick={initializeSystem} disabled={systemStatus === 'loading' || systemStatus === 'initializing' || systemStatus === 'initialized'}>
                  {systemStatus === 'initializing' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {systemStatus === 'initializing' ? t('configurationPage.initializingSystemTables') : t('configurationPage.initializeSystemTables')}
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