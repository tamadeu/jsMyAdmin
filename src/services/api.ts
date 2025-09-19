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
  executionTime: string;
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

class ApiService {
  private baseUrl = "http://localhost:3001/api";
  private credentials: LoginCredentials | null = null;

  setCredentials(credentials: LoginCredentials | null) {
    this.credentials = credentials;
  }

  private getAuthHeaders(): Record<string, string> {
    if (!this.credentials) {
      // Lança um erro se as credenciais não estiverem definidas para chamadas autenticadas
      throw new Error("User is not authenticated.");
    }
    return {
      "X-DB-User": this.credentials.username,
      "X-DB-Password": this.credentials.password || "",
      "X-DB-Host": this.credentials.host,
    };
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
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(config),
    });

    return response.json();
  }

  async getDatabases(): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/databases`, {
      headers: this.getAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error("Failed to fetch databases");
    }
    return response.json();
  }

  async getTables(database: string): Promise<DatabaseTablesResponse> {
    const response = await fetch(
      `${this.baseUrl}/databases/${encodeURIComponent(database)}/tables`,
      {
        headers: this.getAuthHeaders(),
      },
    );
    if (!response.ok) {
      throw new Error("Failed to fetch tables");
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
        headers: this.getAuthHeaders(),
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
        headers: {
          "Content-Type": "application/json",
          ...this.getAuthHeaders(),
        },
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
        headers: {
          "Content-Type": "application/json",
          ...this.getAuthHeaders(),
        },
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
        headers: {
          "Content-Type": "application/json",
          ...this.getAuthHeaders(),
        },
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
        headers: {
          "Content-Type": "application/json",
          ...this.getAuthHeaders(),
        },
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
      headers: {
        "Content-Type": "application/json",
        ...this.getAuthHeaders(),
      },
      body: JSON.stringify({
        query,
        database,
      }),
    });

    const result = await response.json();
    return { ...result, originalQuery: query };
  }

  async getServerStatus(): Promise<{
    version: string;
    uptime: string;
    connections: number;
    status: string;
  }> {
    const response = await fetch(`${this.baseUrl}/status`, {
      headers: this.getAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error("Failed to fetch server status");
    }
    return response.json();
  }

  async getUsers(): Promise<Array<{ user: string; host: string }>> {
    const response = await fetch(`${this.baseUrl}/users`, {
      headers: this.getAuthHeaders(),
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
        headers: this.getAuthHeaders(),
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
        headers: {
          "Content-Type": "application/json",
          ...this.getAuthHeaders(),
        },
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
        headers: {
          "Content-Type": "application/json",
          ...this.getAuthHeaders(),
        },
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
        headers: {
          "Content-Type": "application/json",
          ...this.getAuthHeaders(),
        },
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