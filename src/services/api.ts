const API_BASE_URL = 'http://localhost:3001/api';

export interface DatabaseConfig {
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

export interface QueryResult {
  success: boolean;
  data?: any[];
  fields?: Array<{
    name: string;
    type: string;
    table: string;
  }>;
  message?: string;
  rowCount?: number;
  affectedRows?: number;
  executionTime?: string;
  error?: string;
}

export interface TableData {
  columns: Array<{
    name: string;
    type: string;
    null: boolean;
    key: string;
    default: any;
    extra: string;
  }>;
  data: any[];
  total: number;
  limit: number;
  offset: number;
}

export interface ServerStatus {
  version: string;
  uptime: string;
  connections: number;
  status: string;
}

class ApiService {
  private async request(endpoint: string, options: RequestInit = {}) {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || 'Request failed');
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  async testConnection(config: DatabaseConfig): Promise<{ success: boolean; message: string }> {
    return this.request('/test-connection', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  async saveConfig(config: DatabaseConfig): Promise<{ success: boolean; message: string }> {
    return this.request('/save-config', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  async getDatabases(): Promise<string[]> {
    return this.request('/databases');
  }

  async getTables(database: string): Promise<Array<{
    name: string;
    rows: number;
    size: string;
    engine: string;
    collation: string;
  }>> {
    return this.request(`/databases/${encodeURIComponent(database)}/tables`);
  }

  async getTableData(
    database: string, 
    table: string, 
    options: {
      limit?: number;
      offset?: number;
      search?: string;
    } = {}
  ): Promise<TableData> {
    const params = new URLSearchParams();
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());
    if (options.search) params.append('search', options.search);

    const queryString = params.toString();
    const endpoint = `/databases/${encodeURIComponent(database)}/tables/${encodeURIComponent(table)}/data${queryString ? `?${queryString}` : ''}`;
    
    return this.request(endpoint);
  }

  async executeQuery(query: string, database?: string): Promise<QueryResult> {
    return this.request('/query', {
      method: 'POST',
      body: JSON.stringify({ query, database }),
    });
  }

  async getServerStatus(): Promise<ServerStatus> {
    return this.request('/status');
  }
}

export const apiService = new ApiService();