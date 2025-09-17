import { useState, useEffect } from "react";
import { Settings, Database, Shield, Globe, Save, TestTube, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

interface DatabaseConfig {
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    defaultDatabase: string;
    charset: string;
    collation: string;
    connectionTimeout: number;
    maxConnections: number;
    ssl: boolean;
    sslCertificate: string;
    sslKey: string;
    sslCA: string;
  };
  application: {
    theme: string;
    language: string;
    queryTimeout: number;
    maxQueryResults: number;
    autoRefresh: boolean;
    refreshInterval: number;
  };
  security: {
    allowMultipleStatements: boolean;
    allowLocalInfile: boolean;
    requireSSL: boolean;
  };
}

const DatabaseConfigComponent = () => {
  const { toast } = useToast();
  const [config, setConfig] = useState<DatabaseConfig | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      // Em um ambiente real, isso seria uma chamada para API
      // Por enquanto, vamos simular carregando do localStorage ou valores padrão
      const savedConfig = localStorage.getItem('database-config');
      if (savedConfig) {
        setConfig(JSON.parse(savedConfig));
      } else {
        // Valores padrão
        setConfig({
          database: {
            host: "localhost",
            port: 3306,
            username: "root",
            password: "",
            defaultDatabase: "mysql",
            charset: "utf8mb4",
            collation: "utf8mb4_unicode_ci",
            connectionTimeout: 10000,
            maxConnections: 10,
            ssl: false,
            sslCertificate: "",
            sslKey: "",
            sslCA: ""
          },
          application: {
            theme: "dark",
            language: "en",
            queryTimeout: 30000,
            maxQueryResults: 1000,
            autoRefresh: false,
            refreshInterval: 30000
          },
          security: {
            allowMultipleStatements: false,
            allowLocalInfile: false,
            requireSSL: false
          }
        });
      }
    } catch (error) {
      toast({
        title: "Error loading configuration",
        description: "Failed to load database configuration",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!config) return;

    try {
      // Em um ambiente real, isso seria uma chamada para API
      localStorage.setItem('database-config', JSON.stringify(config));
      toast({
        title: "Configuration saved",
        description: "Database configuration has been saved successfully"
      });
    } catch (error) {
      toast({
        title: "Error saving configuration",
        description: "Failed to save database configuration",
        variant: "destructive"
      });
    }
  };

  const testConnection = async () => {
    if (!config) return;

    setConnectionStatus('testing');
    
    // Simular teste de conexão
    setTimeout(() => {
      // Em um ambiente real, isso seria uma chamada real para testar a conexão
      const isValid = config.database.host && config.database.username;
      setConnectionStatus(isValid ? 'success' : 'error');
      
      toast({
        title: isValid ? "Connection successful" : "Connection failed",
        description: isValid 
          ? "Successfully connected to the database" 
          : "Please check your connection settings",
        variant: isValid ? "default" : "destructive"
      });
    }, 2000);
  };

  const updateConfig = (section: keyof DatabaseConfig, key: string, value: any) => {
    if (!config) return;

    setConfig(prev => ({
      ...prev!,
      [section]: {
        ...prev![section],
        [key]: value
      }
    }));
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
          <h2 className="text-2xl font-bold">Database Configuration</h2>
          <p className="text-muted-foreground">Configure your MySQL database connection settings</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={testConnection} disabled={connectionStatus === 'testing'}>
            <TestTube className="h-4 w-4 mr-2" />
            {connectionStatus === 'testing' ? 'Testing...' : 'Test Connection'}
          </Button>
          <Button onClick={saveConfig}>
            <Save className="h-4 w-4 mr-2" />
            Save Configuration
          </Button>
        </div>
      </div>

      {/* Connection Status */}
      {connectionStatus !== 'idle' && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              {connectionStatus === 'testing' && (
                <>
                  <Database className="h-4 w-4 animate-spin" />
                  <span>Testing connection...</span>
                </>
              )}
              {connectionStatus === 'success' && (
                <>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-green-500">Connection successful</span>
                </>
              )}
              {connectionStatus === 'error' && (
                <>
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span className="text-red-500">Connection failed</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="database" className="space-y-4">
        <TabsList>
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="application">Application</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="database" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Connection Settings
              </CardTitle>
              <CardDescription>Configure your MySQL database connection parameters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="host">Host</Label>
                  <Input
                    id="host"
                    value={config.database.host}
                    onChange={(e) => updateConfig('database', 'host', e.target.value)}
                    placeholder="localhost"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="port">Port</Label>
                  <Input
                    id="port"
                    type="number"
                    value={config.database.port}
                    onChange={(e) => updateConfig('database', 'port', parseInt(e.target.value))}
                    placeholder="3306"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={config.database.username}
                    onChange={(e) => updateConfig('database', 'username', e.target.value)}
                    placeholder="root"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={config.database.password}
                    onChange={(e) => updateConfig('database', 'password', e.target.value)}
                    placeholder="Enter password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="defaultDatabase">Default Database</Label>
                  <Input
                    id="defaultDatabase"
                    value={config.database.defaultDatabase}
                    onChange={(e) => updateConfig('database', 'defaultDatabase', e.target.value)}
                    placeholder="mysql"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="charset">Charset</Label>
                  <Select
                    value={config.database.charset}
                    onValueChange={(value) => updateConfig('database', 'charset', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="utf8mb4">utf8mb4</SelectItem>
                      <SelectItem value="utf8">utf8</SelectItem>
                      <SelectItem value="latin1">latin1</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="connectionTimeout">Connection Timeout (ms)</Label>
                  <Input
                    id="connectionTimeout"
                    type="number"
                    value={config.database.connectionTimeout}
                    onChange={(e) => updateConfig('database', 'connectionTimeout', parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxConnections">Max Connections</Label>
                  <Input
                    id="maxConnections"
                    type="number"
                    value={config.database.maxConnections}
                    onChange={(e) => updateConfig('database', 'maxConnections', parseInt(e.target.value))}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable SSL</Label>
                    <p className="text-sm text-muted-foreground">Use SSL encryption for database connections</p>
                  </div>
                  <Switch
                    checked={config.database.ssl}
                    onCheckedChange={(checked) => updateConfig('database', 'ssl', checked)}
                  />
                </div>

                {config.database.ssl && (
                  <div className="space-y-4 pl-4 border-l-2 border-muted">
                    <div className="space-y-2">
                      <Label htmlFor="sslCertificate">SSL Certificate Path</Label>
                      <Input
                        id="sslCertificate"
                        value={config.database.sslCertificate}
                        onChange={(e) => updateConfig('database', 'sslCertificate', e.target.value)}
                        placeholder="/path/to/client-cert.pem"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sslKey">SSL Key Path</Label>
                      <Input
                        id="sslKey"
                        value={config.database.sslKey}
                        onChange={(e) => updateConfig('database', 'sslKey', e.target.value)}
                        placeholder="/path/to/client-key.pem"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sslCA">SSL CA Path</Label>
                      <Input
                        id="sslCA"
                        value={config.database.sslCA}
                        onChange={(e) => updateConfig('database', 'sslCA', e.target.value)}
                        placeholder="/path/to/ca-cert.pem"
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="application" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Application Settings
              </CardTitle>
              <CardDescription>Configure application behavior and preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="queryTimeout">Query Timeout (ms)</Label>
                  <Input
                    id="queryTimeout"
                    type="number"
                    value={config.application.queryTimeout}
                    onChange={(e) => updateConfig('application', 'queryTimeout', parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxQueryResults">Max Query Results</Label>
                  <Input
                    id="maxQueryResults"
                    type="number"
                    value={config.application.maxQueryResults}
                    onChange={(e) => updateConfig('application', 'maxQueryResults', parseInt(e.target.value))}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto Refresh</Label>
                    <p className="text-sm text-muted-foreground">Automatically refresh data at intervals</p>
                  </div>
                  <Switch
                    checked={config.application.autoRefresh}
                    onCheckedChange={(checked) => updateConfig('application', 'autoRefresh', checked)}
                  />
                </div>

                {config.application.autoRefresh && (
                  <div className="space-y-2 pl-4 border-l-2 border-muted">
                    <Label htmlFor="refreshInterval">Refresh Interval (ms)</Label>
                    <Input
                      id="refreshInterval"
                      type="number"
                      value={config.application.refreshInterval}
                      onChange={(e) => updateConfig('application', 'refreshInterval', parseInt(e.target.value))}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Settings
              </CardTitle>
              <CardDescription>Configure security and safety options</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Allow Multiple Statements</Label>
                    <p className="text-sm text-muted-foreground">Allow executing multiple SQL statements in one query</p>
                  </div>
                  <Switch
                    checked={config.security.allowMultipleStatements}
                    onCheckedChange={(checked) => updateConfig('security', 'allowMultipleStatements', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Allow Local Infile</Label>
                    <p className="text-sm text-muted-foreground">Allow LOAD DATA LOCAL INFILE statements</p>
                  </div>
                  <Switch
                    checked={config.security.allowLocalInfile}
                    onCheckedChange={(checked) => updateConfig('security', 'allowLocalInfile', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Require SSL</Label>
                    <p className="text-sm text-muted-foreground">Force SSL connections only</p>
                  </div>
                  <Switch
                    checked={config.security.requireSSL}
                    onCheckedChange={(checked) => updateConfig('security', 'requireSSL', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DatabaseConfigComponent;