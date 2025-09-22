export interface TableInfo {
  name: string;
  rows: number;
  size: string;
  engine: string;
  collation: string;
}

export interface DatabaseTablesResponse {
  tables: TableInfo[];
  views: TableInfo[];
  totalTables: number;
  totalViews: number;
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

export interface QueryResult {
  success: boolean;
  data?: any[];
  fields?: Array<{
    name: string;
    type: string;
    table: string;
  }>;
  rowCount?: number;
  message?: string;
  affectedRows?: number;
  executionTime: number;
  error?: string;
  originalQuery?: string; // Adicionado aqui
}

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

export interface LoginCredentials {
  host: string;
  port: number;
  username: string;
  password?: string;
}

export interface UserProfile {
  username: string;
  host: string;
  globalPrivileges: string[];
}

export interface LoginResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: UserProfile;
}

export interface DatabasePrivilege {
  database: string;
  privileges: string[];
  grantOption: boolean;
}

export interface UserPrivilegesResponse {
  globalPrivileges: string[];
  databasePrivileges: DatabasePrivilege[];
}

export interface QueryHistoryPayload {
  query_text: string;
  database_context?: string;
  execution_time_ms: number;
  status: 'success' | 'error';
  error_message?: string;
}

interface SystemStatusResponse {
  status: 'ready' | 'needs_initialization';
  message: string;
}

export interface TableColumnDefinition {
  id: string; // Used for React keys
  name: string;
  type: string;
  length?: number; // For VARCHAR, INT, etc.
  nullable: boolean;
  isPrimaryKey: boolean;
  isAutoIncrement: boolean;
  defaultValue: string | null;
}

class ApiService {
  private baseUrl = "http://localhost:3001/api";
  private sessionToken: string | null = null;

  constructor() {
    this.loadToken();
  }

  loadToken() {
    this.sessionToken = localStorage.getItem('sessionToken');
  }

  setToken(token: string | null) {
    this.sessionToken = token;
    if (token) {
      localStorage.setItem('sessionToken', token);
    } else {
      localStorage.removeItem('sessionToken');
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.sessionToken) {
      headers["Authorization"] = `Bearer ${this.sessionToken}`;
    }
    return headers;
  }

  async getSystemStatus(): Promise<SystemStatusResponse> {
    const response = await fetch(`${this.baseUrl}/system/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      const errorText = await response.text();
      return { status: 'needs_initialization', message: `Server error: ${errorText}` };
    }
    return response.json();
  }

  async initializeSystem(): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${this.baseUrl}/system/initialize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.json();
  }

  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const response = await fetch(`${this.baseUrl}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(credentials),
    });
    return response.json();
  }

  async logout(): Promise<void> {
    if (!this.sessionToken) return;
    try {
      await fetch(`${this.baseUrl}/logout`, {
        method: 'POST',
        headers: this.getHeaders(),
      });
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      this.setToken(null);
    }
  }

  async validateSession(): Promise<UserProfile> {
    const response = await fetch(`${this.baseUrl}/session/validate`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      throw new Error("Session is not valid");
    }
    return response.json();
  }

  async testConnection(
    config: DatabaseConfig,
  ): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${this.baseUrl}/test-connection`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(config),
    });

    return response.json();
  }

  async saveConfig(
    config: DatabaseConfig,
  ): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${this.baseUrl}/save-config`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(config),
    });

    return response.json();
  }

  async getDatabases(): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/databases`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      throw new Error("Failed to fetch databases");
    }
    return response.json();
  }

  async createDatabase(
    databaseName: string,
    charset: string,
    collation: string
  ): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${this.baseUrl}/databases`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ databaseName, charset, collation }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create database");
    }
    return response.json();
  }

  async getTables(database: string): Promise<DatabaseTablesResponse> {
    const response = await fetch(
      `${this.baseUrl}/databases/${encodeURIComponent(database)}/tables`,
      {
        headers: this.getHeaders(),
      },
    );
    if (!response.ok) {
      throw new Error("Failed to fetch tables");
    }
    return response.json();
  }

  async createTable(
    database: string,
    tableName: string,
    columns: TableColumnDefinition[]
  ): Promise<{ success: boolean; message: string }> {
    const response = await fetch(
      `${this.baseUrl}/databases/${encodeURIComponent(database)}/tables`,
      {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({ tableName, columns }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create table");
    }
    return response.json();
  }

  async deleteTable(
    database: string,
    tableName: string
  ): Promise<{ success: boolean; message: string }> {
    const response = await fetch(
      `${this.baseUrl}/databases/${encodeURIComponent(database)}/tables/${encodeURIComponent(tableName)}`,
      {
        method: "DELETE",
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete table");
    }
    return response.json();
  }

  async truncateTable(
    database: string,
    tableName: string
  ): Promise<{ success: boolean; message: string }> {
    const response = await fetch(
      `${this.baseUrl}/databases/${encodeURIComponent(database)}/tables/${encodeURIComponent(tableName)}/data`,
      {
        method: "DELETE",
        headers: this.getHeaders(),
        body: JSON.stringify({ truncate: true }), // Indicate truncate action
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to truncate table");
    }
    return response.json();
  }

  async updateTableStructure(
    database: string,
    tableName: string,
    columns: TableColumnDefinition[]
  ): Promise<{ success: boolean; message: string }> {
    const response = await fetch(
      `${this.baseUrl}/databases/${encodeURIComponent(database)}/tables/${encodeURIComponent(tableName)}/structure`,
      {
        method: "PUT",
        headers: this.getHeaders(),
        body: JSON.stringify({ columns }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update table structure");
    }
    return response.json();
  }

  async getTableData(
    database: string,
    table: string,
    options: {
      limit?: number;
      offset?: number;
      search?: string;
      columnFilters?: Record<string, string>;
    } = {},
  ): Promise<TableData> {
    const params = new URLSearchParams();

    if (options.limit) params.append("limit", options.limit.toString());
    if (options.offset) params.append("offset", options.offset.toString());
    if (options.search) params.append("search", options.search);

    if (options.columnFilters) {
      Object.entries(options.columnFilters).forEach(([column, value]) => {
        if (value) {
          params.append(`filter_${column}`, value);
        }
      });
    }

    const response = await fetch(
      `${this.baseUrl}/databases/${encodeURIComponent(database)}/tables/${encodeURIComponent(table)}/data?${params}`,
      {
        headers: this.getHeaders(),
      },
    );

    if (!response.ok) {
      throw new Error("Failed to fetch table data");
    }

    return response.json();
  }

  async updateCell(
    database: string,
    table: string,
    primaryKey: any,
    columnName: string,
    newValue: any,
  ): Promise<{ success: boolean; message: string; affectedRows: number }> {
    const response = await fetch(
      `${this.baseUrl}/databases/${encodeURIComponent(database)}/tables/${encodeURIComponent(table)}/cell`,
      {
        method: "PUT",
        headers: this.getHeaders(),
        body: JSON.stringify({
          primaryKey,
          columnName,
          newValue,
        }),
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update cell");
    }

    return response.json();
  }

  async updateRow(
    database: string,
    table: string,
    primaryKey: any,
    data: Record<string, any>,
  ): Promise<{ success: boolean; message: string; affectedRows: number }> {
    const response = await fetch(
      `${this.baseUrl}/databases/${encodeURIComponent(database)}/tables/${encodeURIComponent(table)}/row`,
      {
        method: "PUT",
        headers: this.getHeaders(),
        body: JSON.stringify({
          primaryKey,
          data,
        }),
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update row");
    }

    return response.json();
  }

  async insertRow(
    database: string,
    table: string,
    data: Record<string, any>,
  ): Promise<{
    success: boolean;
    message: string;
    insertId: number;
    affectedRows: number;
  }> {
    const response = await fetch(
      `${this.baseUrl}/databases/${encodeURIComponent(database)}/tables/${encodeURIComponent(table)}/row`,
      {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          data,
        }),
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to insert row");
    }

    return response.json();
  }

  async deleteRow(
    database: string,
    table: string,
    primaryKey: any,
  ): Promise<{ success: boolean; message: string; affectedRows: number }> {
    const response = await fetch(
      `${this.baseUrl}/databases/${encodeURIComponent(database)}/tables/${encodeURIComponent(table)}/row`,
      {
        method: "DELETE",
        headers: this.getHeaders(),
        body: JSON.stringify({
          primaryKey,
        }),
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete row");
    }

    return response.json();
  }

  async executeQuery(query: string, database?: string): Promise<QueryResult> {
    const response = await fetch(`${this.baseUrl}/query`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        query,
        database,
      }),
    });

    const result = await response.json();
    return { ...result, originalQuery: query };
  }

  async saveQueryToHistory(payload: QueryHistoryPayload): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/query-history`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        console.error('Failed to save query history. Status:', response.status);
        return response.json();
      }
      return response.json();
    } catch (error) {
      console.error('Network error while saving query history:', error);
      return { success: false, message: error instanceof Error ? error.message : 'Network error' };
    }
  }

  async getServerStatus(): Promise<{
    version: string;
    uptime: string;
    connections: number;
    status: string;
  }> {
    const response = await fetch(`${this.baseUrl}/status`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      throw new Error("Failed to fetch server status");
    }
    return response.json();
  }

  async getUsers(): Promise<Array<{ user: string; host: string }>> {
    const response = await fetch(`${this.baseUrl}/users`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch users");
    }
    return response.json();
  }

  async getUserPrivileges(
    user: string,
    host: string,
  ): Promise<UserPrivilegesResponse> {
    const response = await fetch(
      `${this.baseUrl}/users/${encodeURIComponent(user)}/${encodeURIComponent(host)}/privileges`,
      {
        headers: this.getHeaders(),
      },
    );
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch user privileges");
    }
    return response.json();
  }

  async updateUserPrivileges(
    user: string,
    host: string,
    data: { privileges: string[] },
  ): Promise<{ success: boolean; message: string }> {
    const response = await fetch(
      `${this.baseUrl}/users/${encodeURIComponent(user)}/${encodeURIComponent(host)}/privileges`,
      {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update privileges");
    }
    return response.json();
  }

  async updateDatabasePrivileges(
    user: string,
    host: string,
    database: string,
    privileges: string[],
    grantOption: boolean,
  ): Promise<{ success: boolean; message: string }> {
    const response = await fetch(
      `${this.baseUrl}/users/${encodeURIComponent(user)}/${encodeURIComponent(host)}/database-privileges`,
      {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({ database, privileges, grantOption }),
      },
    );
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update database privileges");
    }
    return response.json();
  }

  async revokeDatabasePrivileges(
    user: string,
    host: string,
    database: string,
  ): Promise<{ success: boolean; message: string }> {
    const response = await fetch(
      `${this.baseUrl}/users/${encodeURIComponent(user)}/${encodeURIComponent(host)}/database-privileges`,
      {
        method: "DELETE",
        headers: this.getHeaders(),
        body: JSON.stringify({ database }),
      },
    );
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to revoke database privileges");
    }
    return response.json();
  }
}

export const apiService = new ApiService();