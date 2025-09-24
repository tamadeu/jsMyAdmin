#!/usr/bin/env node
'use strict';
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// --- Criptografia de Sessão ---
const SESSION_SECRET_KEY = process.env.SESSION_SECRET_KEY;
if (!SESSION_SECRET_KEY || SESSION_SECRET_KEY === 'sua_chave_secreta_super_segura_aqui') {
  console.error("FATAL ERROR: SESSION_SECRET_KEY não está definida no arquivo .env.");
  console.error("Por favor, gere uma chave segura e adicione-a ao seu arquivo .env.");
  process.exit(1);
}

const ALGORITHM = 'aes-256-cbc';
const KEY = crypto.createHash('sha256').update(String(SESSION_SECRET_KEY)).digest('base64').substr(0, 32);

function encrypt(text) {
  const iv = crypto.scryptSync(SESSION_SECRET_KEY, 'salt', 16); // IV determinístico
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

function decrypt(encryptedText) {
  const iv = crypto.scryptSync(SESSION_SECRET_KEY, 'salt', 16); // IV determinístico
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Middleware
app.use(cors());
app.use(express.json());

// Variável para armazenar a configuração do servidor em memória
let serverConfig = null;
// Variável para armazenar o pool de conexões
let dbPool = null;

// Credenciais do usuário do sistema (para operações internas do backend)
const MYSQL_SYSTEM_USER = process.env.MYSQL_SYSTEM_USER;
const MYSQL_SYSTEM_PASSWORD = process.env.MYSQL_SYSTEM_PASSWORD;

if (!MYSQL_SYSTEM_USER || !MYSQL_SYSTEM_PASSWORD) {
  console.error("FATAL ERROR: MYSQL_SYSTEM_USER ou MYSQL_SYSTEM_PASSWORD não estão definidos no arquivo .env.");
  console.error("Por favor, adicione as credenciais de um usuário MySQL com privilégios de CREATE DATABASE e CREATE TABLE para o backend.");
  process.exit(1);
}

// Função para carregar a configuração do servidor uma vez
async function loadServerConfig() {
  try {
    const configPath = path.join(__dirname, '../database-config.json');
    const configData = await fs.readFile(configPath, 'utf8');
    serverConfig = JSON.parse(configData);
    // Adiciona as credenciais do usuário do sistema à configuração em memória
    serverConfig.database.username = MYSQL_SYSTEM_USER;
    serverConfig.database.password = MYSQL_SYSTEM_PASSWORD;
    console.log('Server configuration loaded successfully.');
  } catch (error) {
    console.error('Error loading server config at startup:', error);
    serverConfig = null; // Garante que seja nulo se o carregamento falhar
    throw error; // Re-lança o erro para que a inicialização do servidor falhe se a config não puder ser carregada
  }
}

// Helper function to convert JavaScript dates to MySQL format
function convertDateForMySQL(value) {
  if (value === null || value === undefined) {
    return null;
  }
  
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    return value;
  }
  
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/.test(value)) {
    try {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        return value;
      }
      return date.toISOString().slice(0, 19).replace('T', ' ');
    } catch (error) {
      return value;
    }
  }
  
  if (value instanceof Date) {
    try {
      if (isNaN(value.getTime())) {
        return value;
      }
      return value.toISOString().slice(0, 19).replace('T', ' ');
    } catch (error) {
      return value;
    }
  }
  
  return value;
}

function processDataForMySQL(data) {
  const processedData = {};
  for (const [key, value] of Object.entries(data)) {
    processedData[key] = convertDateForMySQL(value);
  }
  return processedData;
}

// Helper function to get a connection from the pool (already authenticated as system user)
async function getSystemPooledConnection() {
  if (!dbPool || !serverConfig) {
    throw new Error('Database connection pool or server configuration not initialized.');
  }
  console.log("Attempting to get system pooled connection with user:", serverConfig.database.username);
  // Connections from the pool are already authenticated as the system user
  return await dbPool.getConnection();
}

// Helper function to get a connection from the pool and change to authenticated user
async function getUserPooledConnection(req) {
  if (!dbPool || !serverConfig) {
    throw new Error('Database connection pool or server configuration not initialized.');
  }
  if (!req.dbCredentials) {
    throw new Error('Authentication credentials not found in request.');
  }

  const connection = await dbPool.getConnection();
  try {
    // Try to change user AND set default database (the original behavior).
    // Some users may not have access to the configured defaultDatabase (commonly 'mysql').
    // If that happens (ER_DBACCESS_DENIED_ERROR), retry without the database property so the user is still authenticated.
    const changeUserPayloadBase = {
      user: req.dbCredentials.user,
      password: req.dbCredentials.password,
      charset: serverConfig.database.charset,
      ssl: serverConfig.database.ssl ? {
        ca: serverConfig.database.sslCA || undefined,
        cert: serverConfig.database.sslCertificate || undefined,
        key: serverConfig.database.sslKey || undefined, // keep same mapping used elsewhere
      } : false,
      multipleStatements: serverConfig.security.allowMultipleStatements,
      timezone: '+00:00'
    };

    // First attempt: include database (keeps previous behavior when possible)
    try {
      const payloadWithDb = { ...changeUserPayloadBase, database: serverConfig.database.defaultDatabase };
      await connection.changeUser(payloadWithDb);
      return connection;
    } catch (err) {
      // If the user simply doesn't have access to the serverConfig default database, retry without database
      if (err && err.code === 'ER_DBACCESS_DENIED_ERROR') {
        console.warn(`changeUser with database '${serverConfig.database.defaultDatabase}' failed for user '${req.dbCredentials.user}'; retrying without setting database to avoid access denied error.`);
        // Retry without database property — this authenticates the user but doesn't switch to the protected schema
        await connection.changeUser(changeUserPayloadBase);
        return connection;
      }
      // rethrow other errors
      throw err;
    }
  } catch (error) {
    connection.release(); // Release connection on error
    throw error;
  }
}

const SYSTEM_DATABASE = "javascriptmyadmin_meta";

// --- Auth Middleware ---
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }
  const token = authHeader.split(' ')[1];
  
  let connection;
  try {
    connection = await getSystemPooledConnection(); // Obter conexão do pool para o usuário do sistema

    const [sessions] = await connection.execute(
      'SELECT * FROM `javascriptmyadmin_meta`.`_jsma_sessions` WHERE `session_token` = ? AND `expires_at` > NOW()',
      [token]
    );

    if (sessions.length === 0) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
    }

    const session = sessions[0];
    const decryptedPassword = decrypt(session.encrypted_password);

    req.dbCredentials = {
      user: session.user,
      password: decryptedPassword,
      host_user: session.host
    };
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Internal server error during authentication' });
  } finally {
    if (connection) connection.release(); // Liberar conexão de volta para o pool
  }
};

// Login endpoint
app.post('/api/login', async (req, res) => {
  let userConnection; // Conexão temporária para testar as credenciais do usuário
  let systemConnection; // Conexão do pool para operações do sistema
  try {
    const { host, port, username, password } = req.body;

    // 1. Testar conexão com as credenciais fornecidas pelo usuário
    userConnection = await mysql.createConnection({
      host: host,
      port: parseInt(port, 10),
      user: username,
      password: password,
      connectTimeout: 5000,
      timezone: '+00:00'
    });
    await userConnection.execute('SELECT 1'); // Verifica se a conexão é válida

    // 2. Atualizar o arquivo de configuração com o novo host e porta (para o frontend)
    const configPath = path.join(__dirname, '../database-config.json');
    const configData = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(configData);
    
    config.database.host = host;
    config.database.port = parseInt(port, 10);
    
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));

    // IMPORTANTE: Recarrega a configuração em memória após escrever no arquivo
    await loadServerConfig();
    // Se o pool já existe, ele precisa ser reconfigurado ou recriado para usar o novo host/port
    if (dbPool) {
      await dbPool.end(); // Fecha o pool existente
      console.log('Existing database connection pool closed.');
    }
    dbPool = mysql.createPool({ // Recria o pool com a nova configuração
      host: serverConfig.database.host,
      port: serverConfig.database.port,
      user: serverConfig.database.username, // Usuário do sistema
      password: serverConfig.database.password, // Senha do usuário do sistema
      waitForConnections: true,
      connectionLimit: serverConfig.database.maxConnections || 10,
      queueLimit: 0,
      timezone: '+00:00'
    });
    console.log('Database connection pool re-initialized with new config.');

    // 3. Obter o host do usuário conectado
    const [currentUserRows] = await userConnection.query('SELECT CURRENT_USER() as user');
    const currentUser = currentUserRows[0].user;
    const [connectedUser, connectedHost] = currentUser.split('@');

    // 4. Obter privilégios globais do usuário
    const [grants] = await userConnection.query('SHOW GRANTS FOR CURRENT_USER()');
    let globalPrivileges = new Set();
    let hasGrantOption = false;
    grants.forEach(grantRow => {
      const grantString = Object.values(grantRow)[0];
      if (grantString.includes('ON *.*')) {
        const onGlobalRegex = /^GRANT (.*?) ON \*\.\*/;
        const match = grantString.match(onGlobalRegex);
        if (match && match[1]) {
          match[1].split(',').forEach(p => globalPrivileges.add(p.trim().toUpperCase()));
        }
        if (grantString.includes('WITH GRANT OPTION')) {
          hasGrantOption = true;
        }
      }
    });
    if (hasGrantOption) globalPrivileges.add('GRANT OPTION');
    let finalPrivileges = Array.from(globalPrivileges);
    if (finalPrivileges.includes('ALL PRIVILEGES')) {
      finalPrivileges = [
        "SELECT", "INSERT", "UPDATE", "DELETE", "FILE", "CREATE", "ALTER", "INDEX", "DROP", 
        "CREATE TEMPORARY TABLES", "SHOW VIEW", "CREATE ROUTINE", "ALTER ROUTINE", "EXECUTE", 
        "CREATE VIEW", "EVENT", "TRIGGER", "GRANT OPTION", "SUPER", "PROCESS", "RELOAD", 
        "SHUTDOWN", "SHOW DATABASES", "LOCK TABLES", "REFERENCES", "REPLICATION CLIENT", 
        "REPLICATION SLAVE", "CREATE USER"
      ];
    }

    // 5. Criar sessão no banco de dados do sistema usando a conexão do pool do sistema
    systemConnection = await getSystemPooledConnection();
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const encryptedPassword = encrypt(password);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await systemConnection.query(
      `INSERT INTO \`${SYSTEM_DATABASE}\`.\`_jsma_sessions\` (session_token, user, host, encrypted_password, expires_at) VALUES (?, ?, ?, ?, ?)`,
      [sessionToken, username, connectedHost, encryptedPassword, expiresAt]
    );

    // 6. Enviar resposta
    res.json({ 
      success: true, 
      message: 'Login successful',
      token: sessionToken,
      user: {
        username: username,
        host: connectedHost,
        globalPrivileges: finalPrivileges
      }
    });
  } catch (error) {
    console.error('Login failed:', error);
    res.status(401).json({ success: false, message: error.message });
  } finally {
    if (userConnection) await userConnection.end(); // Conexão direta deve ser encerrada
    if (systemConnection) systemConnection.release(); // Liberar conexão do pool
  }
});

// Logout endpoint
app.post('/api/logout', authMiddleware, async (req, res) => {
  let connection;
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader.split(' ')[1];
    
    connection = await getSystemPooledConnection(); // Obter conexão do pool

    await connection.execute('DELETE FROM `javascriptmyadmin_meta`.`_jsma_sessions` WHERE `session_token` = ?', [token]);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout failed:', error);
    res.status(500).json({ success: false, message: 'Failed to logout' });
  } finally {
    if (connection) connection.release(); // Liberar conexão de volta para o pool
  }
});

// Session validation endpoint
app.get('/api/session/validate', authMiddleware, async (req, res) => {
  let connection;
  try {
    // The middleware already validated the session. Now, just get user privileges.
    connection = await getUserPooledConnection(req); // Obter conexão do pool
    const [grants] = await connection.query('SHOW GRANTS FOR CURRENT_USER()');
    
    let globalPrivileges = new Set();
    let hasGrantOption = false;
    grants.forEach(grantRow => {
      const grantString = Object.values(grantRow)[0];
      if (grantString.includes('ON *.*')) {
        const onGlobalRegex = /^GRANT (.*?) ON \*\.\*/;
        const match = grantString.match(onGlobalRegex);
        if (match && match[1]) {
          match[1].split(',').forEach(p => globalPrivileges.add(p.trim().toUpperCase()));
        }
        if (grantString.includes('WITH GRANT OPTION')) {
          hasGrantOption = true;
        }
      }
    });
    if (hasGrantOption) globalPrivileges.add('GRANT OPTION');

    let finalPrivileges = Array.from(globalPrivileges);
    if (finalPrivileges.includes('ALL PRIVILEGES')) {
      finalPrivileges = [
        "SELECT", "INSERT", "UPDATE", "DELETE", "FILE", "CREATE", "ALTER", "INDEX", "DROP", 
        "CREATE TEMPORARY TABLES", "SHOW VIEW", "CREATE ROUTINE", "ALTER ROUTINE", "EXECUTE", 
        "CREATE VIEW", "EVENT", "TRIGGER", "GRANT OPTION", "SUPER", "PROCESS", "RELOAD", 
        "SHUTDOWN", "SHOW DATABASES", "LOCK TABLES", "REFERENCES", "REPLICATION CLIENT", 
        "REPLICATION SLAVE", "CREATE USER"
      ];
    }

    res.json({
      username: req.dbCredentials.user,
      host: req.dbCredentials.host_user,
      globalPrivileges: finalPrivileges
    });
  } catch (error) {
    console.error('Session validation failed:', error);
    res.status(401).json({ error: 'Session validation failed' });
  } finally {
    if (connection) connection.release(); // Liberar conexão de volta para o pool
  }
});


// Test database connection (uses provided config, not headers)
app.post('/api/test-connection', async (req, res) => {
  let testConnection;
  try {
    const config = req.body;
    
    testConnection = await mysql.createConnection({
      host: config.database.host,
      port: config.database.port,
      user: config.database.username,
      password: config.database.password,
      database: config.database.defaultDatabase,
      charset: config.database.charset,
      ssl: config.database.ssl ? {
        ca: config.database.sslCA || undefined,
        cert: config.database.sslCertificate || undefined,
        key: config.database.sslKey || undefined,
      } : false,
      connectTimeout: config.database.connectionTimeout,
      timezone: '+00:00'
    });

    await testConnection.execute('SELECT 1');
    res.json({ success: true, message: 'Connection successful' });
  } catch (error) {
    console.error('Connection test failed:', error);
    res.status(400).json({ 
      success: false, 
      message: error.message || 'Connection failed' 
    });
  } finally {
    if (testConnection) {
      await testConnection.end(); // Conexão direta deve ser encerrada
    }
  }
});

// Save configuration (file operation, no DB connection needed here)
app.post('/api/save-config', async (req, res) => {
  try {
    const config = req.body;
    const configPath = path.join(__dirname, '../database-config.json');
    const existingConfigData = await fs.readFile(configPath, 'utf8');
    const existingConfig = JSON.parse(existingConfigData);

    // Update only host and port from the new config, preserve system user credentials
    existingConfig.database.host = config.database.host;
    existingConfig.database.port = config.database.port;
    
    // Also update other application/security settings
    existingConfig.application = config.application;
    existingConfig.security = config.security;
    existingConfig.ai = config.ai; // Save AI configuration

    await fs.writeFile(configPath, JSON.stringify(existingConfig, null, 2));

    // IMPORTANTE: Recarrega a configuração em memória após escrever no arquivo
    await loadServerConfig();
    // Se o host ou a porta mudaram, recria o pool
    if (dbPool) {
      await dbPool.end(); // Fecha o pool existente
      console.log('Existing database connection pool closed.');
    }
    dbPool = mysql.createPool({ // Recria o pool com a nova configuração
      host: serverConfig.database.host,
      port: serverConfig.database.port,
      user: serverConfig.database.username, // Usuário do sistema
      password: serverConfig.database.password, // Senha do usuário do sistema
      waitForConnections: true,
      connectionLimit: serverConfig.database.maxConnections || 10, // Usar maxConnections da config
      queueLimit: 0, // Sem limite na fila de requisições
      timezone: '+00:00'
    });
    console.log('Database connection pool re-initialized with new config.');

    res.json({ success: true, message: 'Configuration saved successfully' });
  } catch (error) {
    console.error('Error saving config:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to save configuration' 
    });
  }
});

// Get server status
app.get('/api/status', authMiddleware, async (req, res) => {
  let connection;
  try {
    connection = await getUserPooledConnection(req);
    const [statusRows] = await connection.execute('SHOW STATUS LIKE "Uptime";');
    const uptime = statusRows.find(row => row.Variable_name === 'Uptime')?.Value || 'N/A';

    const [versionRows] = await connection.execute('SELECT VERSION() as version;');
    const version = versionRows[0]?.version || 'N/A';

    const [connectionsRows] = await connection.execute('SHOW STATUS LIKE "Threads_connected";');
    const connections = connectionsRows.find(row => row.Variable_name === 'Threads_connected')?.Value || 0;

    res.json({
      version: version,
      uptime: uptime,
      connections: parseInt(connections, 10),
      status: 'OK'
    });
  } catch (error) {
    console.error('Error fetching server status:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch server status' });
  } finally {
    if (connection) connection.release();
  }
});

// Get list of databases
app.get('/api/databases', authMiddleware, async (req, res) => {
  let connection;
  try {
    connection = await getUserPooledConnection(req);
    const [rows] = await connection.execute('SHOW DATABASES');
    const databases = rows.map(row => row.Database);
    res.json(databases);
  } catch (error) {
    console.error('Error fetching databases:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch databases' });
  } finally {
    if (connection) connection.release();
  }
});

// Create a new database
app.post('/api/databases', authMiddleware, async (req, res) => {
  let connection;
  try {
    const { databaseName, charset, collation } = req.body;
    if (!databaseName) {
      return res.status(400).json({ error: 'Database name is required.' });
    }

    connection = await getUserPooledConnection(req);
    await connection.execute(
      `CREATE DATABASE \`${databaseName}\` CHARACTER SET ${charset || 'utf8mb4'} COLLATE ${collation || 'utf8mb4_unicode_ci'}`
    );
    res.json({ success: true, message: `Database '${databaseName}' created successfully.` });
  } catch (error) {
    console.error('Error creating database:', error);
    res.status(500).json({ error: error.message || 'Failed to create database.' });
  } finally {
    if (connection) connection.release();
  }
});

// Get tables and views for a database
app.get('/api/databases/:db/tables', authMiddleware, async (req, res) => {
  let connection;
  try {
    const { db } = req.params;
    connection = await getUserPooledConnection(req);

    const [tablesResult] = await connection.execute(
      `SELECT 
        TABLE_NAME as name, 
        TABLE_ROWS as rows, 
        (DATA_LENGTH + INDEX_LENGTH) as size_bytes, 
        ENGINE as engine, 
        TABLE_COLLATION as collation,
        TABLE_TYPE as type
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_TYPE IN ('BASE TABLE', 'VIEW')`,
      [db]
    );

    const tables = [];
    const views = [];

    for (const row of tablesResult) {
      const size = row.size_bytes !== null ? `${(row.size_bytes / 1024 / 1024).toFixed(2)} MB` : 'N/A';
      const item = {
        name: row.name,
        rows: row.rows !== null ? parseInt(row.rows, 10) : 0,
        size: size,
        engine: row.engine || 'N/A',
        collation: row.collation || 'N/A',
      };
      if (row.type === 'BASE TABLE') {
        tables.push(item);
      } else if (row.type === 'VIEW') {
        views.push(item);
      }
    }

    res.json({
      tables: tables,
      views: views,
      totalTables: tables.length,
      totalViews: views.length,
    });
  } catch (error) {
    console.error('Error fetching tables and views:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch tables and views.' });
  } finally {
    if (connection) connection.release();
  }
});

// Create a new table
app.post('/api/databases/:database/tables', authMiddleware, async (req, res) => {
  let connection;
  try {
    const { database } = req.params;
    const { tableName, columns } = req.body;

    if (!tableName || !columns || !Array.isArray(columns) || columns.length === 0) {
      return res.status(400).json({ error: 'Table name and columns are required.' });
    }

    const columnDefinitions = columns.map(col => {
      let definition = `\`${col.name}\` ${col.type}`;
      if (col.length) {
        definition += `(${col.length})`;
      }
      if (!col.nullable) {
        definition += ` NOT NULL`;
      }
      if (col.defaultValue !== null && col.defaultValue !== undefined && col.defaultValue !== '') {
        if (typeof col.defaultValue === 'string' && !['CURRENT_TIMESTAMP'].includes(col.defaultValue.toUpperCase())) {
          definition += ` DEFAULT '${String(col.defaultValue).replace(/'/g, "''")}'`;
        } else {
          definition += ` DEFAULT ${col.defaultValue}`;
        }
      } else if (col.defaultValue === '') { // Handle empty string default for non-nullable
        definition += ` DEFAULT ''`;
      }
      if (col.isAutoIncrement) {
        definition += ` AUTO_INCREMENT`;
      }
      return definition;
    });

    const primaryKeyColumns = columns.filter(col => col.isPrimaryKey).map(col => `\`${col.name}\``);
    if (primaryKeyColumns.length > 0) {
      columnDefinitions.push(`PRIMARY KEY (${primaryKeyColumns.join(', ')})`);
    }

    const createTableSql = `CREATE TABLE \`${database}\`.\`${tableName}\` (\n  ${columnDefinitions.join(',\n  ')}\n);`;

    connection = await getUserPooledConnection(req);
    await connection.execute(createTableSql);

    res.json({ success: true, message: `Table '${tableName}' created successfully in database '${database}'.` });
  } catch (error) {
    console.error('Error creating table:', error);
    res.status(500).json({ error: error.message || 'Failed to create table.' });
  } finally {
    if (connection) connection.release();
  }
});

// Delete a table
app.delete('/api/databases/:database/tables/:table', authMiddleware, async (req, res) => {
  let connection;
  try {
    const { database, table } = req.params;
    connection = await getUserPooledConnection(req);
    await connection.execute(`DROP TABLE \`${database}\`.\`${table}\``);
    res.json({ success: true, message: `Table '${table}' deleted successfully.` });
  } catch (error) {
    console.error('Error deleting table:', error);
    res.status(500).json({ error: error.message || 'Failed to delete table.' });
  } finally {
    if (connection) connection.release();
  }
});

// Truncate (empty) a table
app.delete('/api/databases/:database/tables/:table/data', authMiddleware, async (req, res) => {
  let connection;
  try {
    const { database, table } = req.params;
    connection = await getUserPooledConnection(req);
    await connection.execute(`TRUNCATE TABLE \`${database}\`.\`${table}\``);
    res.json({ success: true, message: `Table '${table}' truncated successfully.` });
  } catch (error) {
    console.error('Error truncating table:', error);
    res.status(500).json({ error: error.message || 'Failed to truncate table.' });
  } finally {
    if (connection) connection.release();
  }
});

// Update table structure
app.put('/api/databases/:database/tables/:table/structure', authMiddleware, async (req, res) => {
  let connection;
  try {
    const { database, table } = req.params;
    const { columns } = req.body;

    if (!columns || !Array.isArray(columns)) {
      return res.status(400).json({ error: 'Columns array is required.' });
    }

    connection = await getUserPooledConnection(req);

    // Fetch current structure to compare
    const [currentColumnsRaw] = await connection.execute(
      `SELECT COLUMN_NAME as name, COLUMN_TYPE as type, IS_NULLABLE as nullable, COLUMN_KEY as \`key\`, COLUMN_DEFAULT as \`default\`, EXTRA as extra
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
       ORDER BY ORDINAL_POSITION`,
      [database, table]
    );

    const currentColumns = currentColumnsRaw.map(col => ({
      name: col.name,
      type: col.type,
      nullable: col.nullable === 'YES',
      key: col.key,
      default: col.default,
      extra: col.extra,
    }));

    const alterStatements = [];

    // 1. Handle dropped columns
    for (const currentCol of currentColumns) {
      if (!columns.some(newCol => newCol.name === currentCol.name)) {
        alterStatements.push(`DROP COLUMN \`${currentCol.name}\``);
      }
    }

    // 2. Handle added/modified columns
    for (let i = 0; i < columns.length; i++) {
      const newCol = columns[i];
      const currentCol = currentColumns.find(c => c.name === newCol.name);

      let columnDefinition = `\`${newCol.name}\` ${newCol.type}`;
      if (newCol.length) {
        columnDefinition += `(${newCol.length})`;
      }
      columnDefinition += newCol.nullable ? ' NULL' : ' NOT NULL';
      if (newCol.defaultValue !== null && newCol.defaultValue !== undefined && newCol.defaultValue !== '') {
        if (typeof newCol.defaultValue === 'string' && !['CURRENT_TIMESTAMP'].includes(newCol.defaultValue.toUpperCase())) {
          columnDefinition += ` DEFAULT '${String(newCol.defaultValue).replace(/'/g, "''")}'`;
        } else {
          columnDefinition += ` DEFAULT ${newCol.defaultValue}`;
        }
      } else if (newCol.defaultValue === '') {
        columnDefinition += ` DEFAULT ''`;
      }
      if (newCol.isAutoIncrement) {
        columnDefinition += ` AUTO_INCREMENT`;
      }

      if (!currentCol) {
        // Add new column
        alterStatements.push(`ADD COLUMN ${columnDefinition}`);
      } else {
        // Modify existing column
        // This is a simplified check. A real-world scenario would compare all properties.
        // For now, we'll just assume if it exists, we might need to MODIFY.
        // A more robust solution would compare type, nullability, default, extra, etc.
        alterStatements.push(`MODIFY COLUMN ${columnDefinition}`);
      }
    }

    // Handle primary key changes (simplified: drop existing, add new)
    const currentPk = currentColumns.find(col => col.key === 'PRI');
    const newPk = columns.find(col => col.isPrimaryKey);

    if (currentPk && (!newPk || currentPk.name !== newPk.name)) {
      alterStatements.push(`DROP PRIMARY KEY`);
    }
    if (newPk && (!currentPk || currentPk.name !== newPk.name)) {
      alterStatements.push(`ADD PRIMARY KEY (\`${newPk.name}\`)`);
    }

    if (alterStatements.length > 0) {
      const fullAlterSql = `ALTER TABLE \`${database}\`.\`${table}\`\n  ${alterStatements.join(',\n  ')};`;
      await connection.execute(fullAlterSql);
    }

    res.json({ success: true, message: `Table '${table}' structure updated successfully.` });
  } catch (error) {
    console.error('Error updating table structure:', error);
    res.status(500).json({ error: error.message || 'Failed to update table structure.' });
  } finally {
    if (connection) connection.release();
  }
});

// Get table data with pagination, search, and filters
app.get('/api/databases/:db/tables/:table/data', authMiddleware, async (req, res) => {
  let connection;
  try {
    const { db, table } = req.params;
    const { limit = 25, offset = 0, search, ...columnFilters } = req.query;

    connection = await getUserPooledConnection(req);

    // Get column info
    const [columnsRaw] = await connection.execute(
      `SELECT COLUMN_NAME as name, COLUMN_TYPE as type, IS_NULLABLE as \`null\`, COLUMN_KEY as \`key\`, COLUMN_DEFAULT as \`default\`, EXTRA as extra
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
       ORDER BY ORDINAL_POSITION`,
      [db, table]
    );

    const columns = columnsRaw.map(col => ({
      name: col.name,
      type: col.type,
      null: col.null === 'YES',
      key: col.key,
      default: col.default,
      extra: col.extra,
    }));

    let whereClauses = [];
    let queryParams = [];

    // Global search
    if (search) {
      const searchTerms = columns.map(col => `\`${col.name}\` LIKE ?`);
      whereClauses.push(`(${searchTerms.join(' OR ')})`);
      for (let i = 0; i < columns.length; i++) {
        queryParams.push(`%${search}%`);
      }
    }

    // Column-specific filters
    for (const key in columnFilters) {
      if (key.startsWith('filter_')) {
        const columnName = key.substring('filter_'.length);
        const filterValue = columnFilters[key];
        if (filterValue) {
          whereClauses.push(`\`${columnName}\` LIKE ?`);
          queryParams.push(`%${filterValue}%`);
        }
      }
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Count total rows (with filters)
    const [countRows] = await connection.execute(
      `SELECT COUNT(*) as total FROM \`${db}\`.\`${table}\` ${whereSql}`,
      queryParams
    );
    const total = countRows[0].total;

    // Fetch data
    const [dataRows] = await connection.execute(
      `SELECT * FROM \`${db}\`.\`${table}\` ${whereSql} LIMIT ? OFFSET ?`,
      [...queryParams, parseInt(limit, 10), parseInt(offset, 10)]
    );

    res.json({
      columns: columns,
      data: dataRows,
      total: total,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });
  } catch (error) {
    console.error('Error fetching table data:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch table data.' });
  } finally {
    if (connection) connection.release();
  }
});

// Update a single cell
app.put('/api/databases/:db/tables/:table/cell', authMiddleware, async (req, res) => {
  let connection;
  try {
    const { db, table } = req.params;
    const { primaryKey, columnName, newValue } = req.body;

    if (!primaryKey || !columnName) {
      return res.status(400).json({ error: 'Primary key and column name are required.' });
    }

    connection = await getUserPooledConnection(req);

    // Get primary key column name
    const [pkColumnRows] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_KEY = 'PRI'`,
      [db, table]
    );
    if (pkColumnRows.length === 0) {
      return res.status(400).json({ error: 'Table does not have a primary key, cannot update cell.' });
    }
    const pkColumnName = pkColumnRows[0].COLUMN_NAME;

    const [result] = await connection.execute(
      `UPDATE \`${db}\`.\`${table}\` SET \`${columnName}\` = ? WHERE \`${pkColumnName}\` = ?`,
      [newValue, primaryKey]
    );

    res.json({ success: true, message: 'Cell updated successfully.', affectedRows: result.affectedRows });
  } catch (error) {
    console.error('Error updating cell:', error);
    res.status(500).json({ error: error.message || 'Failed to update cell.' });
  } finally {
    if (connection) connection.release();
  }
});

// Update an entire row
app.put('/api/databases/:db/tables/:table/row', authMiddleware, async (req, res) => {
  let connection;
  try {
    const { db, table } = req.params;
    const { primaryKey, data } = req.body;

    if (!primaryKey || !data) {
      return res.status(400).json({ error: 'Primary key and data are required.' });
    }

    connection = await getUserPooledConnection(req);

    // Get primary key column name
    const [pkColumnRows] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_KEY = 'PRI'`,
      [db, table]
    );
    if (pkColumnRows.length === 0) {
      return res.status(400).json({ error: 'Table does not have a primary key, cannot update row.' });
    }
    const pkColumnName = pkColumnRows[0].COLUMN_NAME;

    const updates = [];
    const updateValues = [];
    for (const key in data) {
      if (key !== pkColumnName) { // Don't update the primary key itself
        updates.push(`\`${key}\` = ?`);
        updateValues.push(processDataForMySQL({ [key]: data[key] })[key]);
      }
    }

    if (updates.length === 0) {
      return res.json({ success: true, message: 'No updatable fields provided.', affectedRows: 0 });
    }

    const [result] = await connection.execute(
      `UPDATE \`${db}\`.\`${table}\` SET ${updates.join(', ')} WHERE \`${pkColumnName}\` = ?`,
      [...updateValues, primaryKey]
    );

    res.json({ success: true, message: 'Row updated successfully.', affectedRows: result.affectedRows });
  } catch (error) {
    console.error('Error updating row:', error);
    res.status(500).json({ error: error.message || 'Failed to update row.' });
  } finally {
    if (connection) connection.release();
  }
});

// Insert a new row
app.post('/api/databases/:db/tables/:table/row', authMiddleware, async (req, res) => {
  let connection;
  try {
    const { db, table } = req.params;
    const { data } = req.body;

    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'Data for insertion is required.' });
    }

    connection = await getUserPooledConnection(req);

    const columns = [];
    const placeholders = [];
    const values = [];

    const processedData = processDataForMySQL(data);

    for (const key in processedData) {
      if (processedData[key] !== undefined) { // Only include if value is explicitly provided
        columns.push(`\`${key}\``);
        placeholders.push('?');
        values.push(processedData[key]);
      }
    }

    const [result] = await connection.execute(
      `INSERT INTO \`${db}\`.\`${table}\` (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`,
      values
    );

    res.json({ success: true, message: 'Row inserted successfully.', insertId: result.insertId, affectedRows: result.affectedRows });
  } catch (error) {
    console.error('Error inserting row:', error);
    res.status(500).json({ error: error.message || 'Failed to insert row.' });
  } finally {
    if (connection) connection.release();
  }
});

// Delete a row
app.delete('/api/databases/:db/tables/:table/row', authMiddleware, async (req, res) => {
  let connection;
  try {
    const { db, table } = req.params;
    const { primaryKey } = req.body;

    if (!primaryKey) {
      return res.status(400).json({ error: 'Primary key is required for deletion.' });
    }

    connection = await getUserPooledConnection(req);

    // Get primary key column name
    const [pkColumnRows] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_KEY = 'PRI'`,
      [db, table]
    );
    if (pkColumnRows.length === 0) {
      return res.status(400).json({ error: 'Table does not have a primary key, cannot delete row.' });
    }
    const pkColumnName = pkColumnRows[0].COLUMN_NAME;

    const [result] = await connection.execute(
      `DELETE FROM \`${db}\`.\`${table}\` WHERE \`${pkColumnName}\` = ?`,
      [primaryKey]
    );

    res.json({ success: true, message: 'Row deleted successfully.', affectedRows: result.affectedRows });
  } catch (error) {
    console.error('Error deleting row:', error);
    res.status(500).json({ error: error.message || 'Failed to delete row.' });
  } finally {
    if (connection) connection.release();
  }
});

// Execute arbitrary SQL query
app.post('/api/query', authMiddleware, async (req, res) => {
  let connection;
  const startTime = process.hrtime.bigint();
  try {
    const { query, database } = req.body;
    if (!query) {
      return res.status(400).json({ success: false, error: 'Query is required.' });
    }

    connection = await getUserPooledConnection(req);

    if (database) {
      await connection.execute(`USE \`${database}\``);
    }

    const [rows, fields] = await connection.execute(query);
    const endTime = process.hrtime.bigint();
    const executionTime = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds

    let responseData = {
      success: true,
      executionTime: executionTime,
      message: 'Query executed successfully.',
    };

    if (Array.isArray(rows)) {
      // It's a SELECT query or similar returning rows
      responseData.data = rows;
      responseData.fields = fields.map(f => ({ name: f.name, type: f.columnType, table: f.table }));
      responseData.rowCount = rows.length;
    } else {
      // It's an INSERT, UPDATE, DELETE, DDL, etc.
      responseData.affectedRows = rows.affectedRows;
      responseData.message = rows.info || `Query executed. Affected rows: ${rows.affectedRows}`;
    }

    res.json(responseData);
  } catch (error) {
    const endTime = process.hrtime.bigint();
    const executionTime = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds
    console.error('Error executing query:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to execute query.',
      executionTime: executionTime,
    });
  } finally {
    if (connection) connection.release();
  }
});

// Save query to history
app.post('/api/query-history', authMiddleware, async (req, res) => {
  let connection;
  try {
    const { query_text, database_context, execution_time_ms, status, error_message } = req.body;
    const { user, host_user } = req.dbCredentials;

    connection = await getSystemPooledConnection();

    await connection.execute(
      `INSERT INTO \`${SYSTEM_DATABASE}\`.\`_jsma_query_history\` 
       (query_text, database_context, executed_by, execution_time_ms, status, error_message, executed_at) 
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [query_text, database_context, `${user}@${host_user}`, execution_time_ms, status, error_message]
    );
    res.json({ success: true, message: 'Query saved to history.' });
  } catch (error) {
    console.error('Error saving query to history:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to save query to history.' });
  } finally {
    if (connection) connection.release();
  }
});

// Get query history
app.get('/api/query-history', authMiddleware, async (req, res) => {
  let connection;
  try {
    const { user, host_user } = req.dbCredentials;
    connection = await getSystemPooledConnection();

    const [history] = await connection.execute(
      `SELECT id, query_text, database_context, executed_by, execution_time_ms, status, error_message, executed_at 
       FROM \`${SYSTEM_DATABASE}\`.\`_jsma_query_history\` 
       WHERE executed_by = ? 
       ORDER BY executed_at DESC LIMIT 50`,
      [`${user}@${host_user}`]
    );
    res.json(history);
  } catch (error) {
    console.error('Error fetching query history:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch query history.' });
  } finally {
    if (connection) connection.release();
  }
});

// Get list of MySQL users
app.get('/api/users', authMiddleware, async (req, res) => {
  let connection;
  try {
    connection = await getUserPooledConnection(req);
    const [users] = await connection.execute('SELECT user, host FROM mysql.user');
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch users.' });
  } finally {
    if (connection) connection.release();
  }
});

// Get user privileges
app.get('/api/users/:user/:host/privileges', authMiddleware, async (req, res) => {
  let connection;
  try {
    const { user, host } = req.params;
    connection = await getUserPooledConnection(req);

    const [grants] = await connection.execute(`SHOW GRANTS FOR '${user}'@'${host}'`);

    let globalPrivileges = [];
    let databasePrivileges = [];

    grants.forEach(grantRow => {
      const grantString = Object.values(grantRow)[0];
      if (grantString.includes('ON *.*')) {
        const onGlobalRegex = /^GRANT (.*?) ON \*\.\*/;
        const match = grantString.match(onGlobalRegex);
        if (match && match[1]) {
          globalPrivileges = match[1].split(',').map(p => p.trim().toUpperCase());
        }
      } else if (grantString.includes('ON `')) {
        const onDbRegex = /^GRANT (.*?) ON `(.*?)`\.\* TO/;
        const match = grantString.match(onDbRegex);
        if (match && match[1] && match[2]) {
          const privs = match[1].split(',').map(p => p.trim().toUpperCase());
          const dbName = match[2];
          const grantOption = grantString.includes('WITH GRANT OPTION');
          databasePrivileges.push({ database: dbName, privileges: privs, grantOption: grantOption });
        }
      }
    });

    res.json({ globalPrivileges, databasePrivileges });
  } catch (error) {
    console.error('Error fetching user privileges:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch user privileges.' });
  } finally {
    if (connection) connection.release();
  }
});

// Update global user privileges
app.post('/api/users/:user/:host/privileges', authMiddleware, async (req, res) => {
  let connection;
  try {
    const { user, host } = req.params;
    const { privileges } = req.body;

    connection = await getUserPooledConnection(req);

    // Revoke all existing global privileges first
    await connection.execute(`REVOKE ALL PRIVILEGES ON *.* FROM '${user}'@'${host}'`);

    if (privileges && privileges.length > 0) {
      const grantSql = `GRANT ${privileges.join(', ')} ON *.* TO '${user}'@'${host}'`;
      await connection.execute(grantSql);
    }

    res.json({ success: true, message: 'Global privileges updated successfully.' });
  } catch (error) {
    console.error('Error updating global user privileges:', error);
    res.status(500).json({ error: error.message || 'Failed to update global privileges.' });
  } finally {
    if (connection) connection.release();
  }
});

// Update/add database-specific privileges for a user
app.post('/api/users/:user/:host/database-privileges', authMiddleware, async (req, res) => {
  let connection;
  try {
    const { user, host } = req.params;
    const { database, privileges, grantOption } = req.body;

    connection = await getUserPooledConnection(req);

    // Revoke existing privileges on this database first
    await connection.execute(`REVOKE ALL PRIVILEGES ON \`${database}\`.* FROM '${user}'@'${host}'`);

    if (privileges && privileges.length > 0) {
      let grantSql = `GRANT ${privileges.join(', ')} ON \`${database}\`.* TO '${user}'@'${host}'`;
      if (grantOption) {
        grantSql += ` WITH GRANT OPTION`;
      }
      await connection.execute(grantSql);
    }

    res.json({ success: true, message: `Privileges on database '${database}' updated successfully.` });
  } catch (error) {
    console.error('Error updating database privileges:', error);
    res.status(500).json({ error: error.message || 'Failed to update database privileges.' });
  } finally {
    if (connection) connection.release();
  }
});

// Revoke all privileges on a specific database for a user
app.delete('/api/users/:user/:host/database-privileges', authMiddleware, async (req, res) => {
  let connection;
  try {
    const { user, host } = req.params;
    const { database } = req.body;

    connection = await getUserPooledConnection(req);
    await connection.execute(`REVOKE ALL PRIVILEGES ON \`${database}\`.* FROM '${user}'@'${host}'`);

    res.json({ success: true, message: `All privileges on database '${database}' revoked successfully.` });
  } catch (error) {
    console.error('Error revoking database privileges:', error);
    res.status(500).json({ error: error.message || 'Failed to revoke database privileges.' });
  } finally {
    if (connection) connection.release();
  }
});

// Check system tables status
app.get('/api/system/status', async (req, res) => {
  let connection;
  try {
    connection = await getSystemPooledConnection();
    const [rows] = await connection.execute(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (?, ?, ?, ?)`,
      [SYSTEM_DATABASE, '_jsma_query_history', '_jsma_favorite_queries', '_jsma_favorite_tables', '_jsma_sessions']
    );

    const existingTables = new Set(rows.map(row => row.TABLE_NAME));
    const missingTables = SYSTEM_TABLES.filter(table => !existingTables.has(table));

    if (missingTables.length === 0) {
      // Check for 'executed_by' column in _jsma_query_history
      const [columns] = await connection.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = 'executed_by'`,
        [SYSTEM_DATABASE, '_jsma_query_history']
      );
      if (columns.length === 0) {
        return res.json({ status: 'needs_initialization', message: 'Missing `executed_by` column in `_jsma_query_history` table. Please re-initialize system tables.' });
      }
      return res.json({ status: 'ready', message: 'System tables are initialized and up-to-date.' });
    } else {
      return res.json({ status: 'needs_initialization', message: `Missing system tables: ${missingTables.join(', ')}. Please initialize system tables.` });
    }
  } catch (error) {
    // If the database itself doesn't exist, it's also 'needs_initialization'
    if (error.code === 'ER_BAD_DB_ERROR') {
      return res.json({ status: 'needs_initialization', message: `System database '${SYSTEM_DATABASE}' not found. Please initialize system tables.` });
    }
    console.error('Error checking system status:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Failed to check system status.' });
  } finally {
    if (connection) connection.release();
  }
});

// Initialize system tables
app.post('/api/system/initialize', async (req, res) => {
  let connection;
  try {
    connection = await getSystemPooledConnection();

    // Create database if it doesn't exist
    await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${SYSTEM_DATABASE}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);

    // Create _jsma_query_history table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS \`${SYSTEM_DATABASE}\`.\`_jsma_query_history\` (
        id INT AUTO_INCREMENT PRIMARY KEY,
        query_text TEXT NOT NULL,
        database_context VARCHAR(255),
        executed_by VARCHAR(255) NOT NULL,
        execution_time_ms INT,
        status ENUM('success', 'error') NOT NULL,
        error_message TEXT,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);

    // Add executed_by column if missing (for backward compatibility)
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = 'executed_by'`,
      [SYSTEM_DATABASE, '_jsma_query_history']
    );
    if (columns.length === 0) {
      await connection.execute(`ALTER TABLE \`${SYSTEM_DATABASE}\`.\`_jsma_query_history\` ADD COLUMN executed_by VARCHAR(255) NOT NULL AFTER database_context`);
    }

    // Create _jsma_favorite_queries table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS \`${SYSTEM_DATABASE}\`.\`_jsma_favorite_queries\` (
        id INT AUTO_INCREMENT PRIMARY KEY,
        query_text TEXT NOT NULL,
        database_context VARCHAR(255),
        user VARCHAR(255) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);

    // Create _jsma_favorite_tables table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS \`${SYSTEM_DATABASE}\`.\`_jsma_favorite_tables\` (
        id INT AUTO_INCREMENT PRIMARY KEY,
        database_name VARCHAR(255) NOT NULL,
        table_name VARCHAR(255) NOT NULL,
        user VARCHAR(255) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY (database_name, table_name, user)
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);

    // Create _jsma_sessions table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS \`${SYSTEM_DATABASE}\`.\`_jsma_sessions\` (
        session_token VARCHAR(255) PRIMARY KEY,
        user VARCHAR(255) NOT NULL,
        host VARCHAR(255) NOT NULL,
        encrypted_password TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);

    res.json({ success: true, message: 'System tables initialized successfully.' });
  } catch (error) {
    console.error('Error initializing system tables:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to initialize system tables.' });
  } finally {
    if (connection) connection.release();
  }
});

// AI SQL Generation Endpoint
app.post('/api/ai/generate-sql', authMiddleware, async (req, res) => {
  let connection;
  try {
    const { prompt, model, database } = req.body;
    if (!prompt) {
      return res.status(400).json({ success: false, message: 'Prompt is required.' });
    }

    // Load AI config from serverConfig
    if (!serverConfig || !serverConfig.ai) {
      return res.status(400).json({ success: false, message: 'AI configuration not found on server.' });
    }

    let apiKey;
    let modelName;
    let apiUrl;

    if (model === 'gemini') {
      apiKey = serverConfig.ai.geminiApiKey;
      modelName = 'gemini-pro'; // Or other specific Gemini model
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    } else if (model === 'openai') {
      apiKey = serverConfig.ai.openAIApiKey;
      modelName = 'gpt-3.5-turbo'; // Or other specific OpenAI model
      apiUrl = 'https://api.openai.com/v1/chat/completions';
    } else if (model === 'anthropic') {
      apiKey = serverConfig.ai.anthropicApiKey;
      modelName = 'claude-3-haiku-20240307'; // Or other specific Anthropic model
      apiUrl = 'https://api.anthropic.com/v1/messages';
    } else {
      return res.status(400).json({ success: false, message: 'Invalid AI model selected.' });
    }

    if (!apiKey) {
      return res.status(400).json({ success: false, message: `API key for ${model} is not configured.` });
    }

    let systemPrompt = `You are an AI assistant that generates MySQL SQL queries based on natural language descriptions.
    Always respond with only the SQL query, without any additional text, explanations, or markdown formatting.
    If the request is ambiguous or requires more information, generate a reasonable default query or a simple example.
    Assume the user wants to interact with a MySQL database.`;

    let userPrompt = `Generate a MySQL SQL query for the following request: "${prompt}".`;

    if (database) {
      // Fetch table schemas for the current database
      connection = await getUserPooledConnection(req);
      const [tablesResult] = await connection.execute(
        `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_KEY, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = ?`,
        [database]
      );

      const schemaInfo = {};
      tablesResult.forEach(row => {
        if (!schemaInfo[row.TABLE_NAME]) {
          schemaInfo[row.TABLE_NAME] = [];
        }
        schemaInfo[row.TABLE_NAME].push({
          column_name: row.COLUMN_NAME,
          data_type: row.DATA_TYPE,
          column_key: row.COLUMN_KEY,
          is_nullable: row.IS_NULLABLE,
          column_default: row.COLUMN_DEFAULT,
          extra: row.EXTRA,
        });
      });

      systemPrompt += `\n\nConsider the following schema for the database '${database}':\n${JSON.stringify(schemaInfo, null, 2)}\n`;
      userPrompt = `Using the provided schema for database '${database}', generate a MySQL SQL query for the following request: "${prompt}".`;
    }

    let aiResponse;
    if (model === 'gemini') {
      const geminiPayload = {
        contents: [
          { role: "user", parts: [{ text: systemPrompt + "\n" + userPrompt }] }
        ]
      };
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiPayload),
      });
      const data = await response.json();
      aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
    } else if (model === 'openai') {
      const openaiPayload = {
        model: modelName,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 500,
      };
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(openaiPayload),
      });
      const data = await response.json();
      aiResponse = data.choices?.[0]?.message?.content;
    } else if (model === 'anthropic') {
      const anthropicPayload = {
        model: modelName,
        messages: [
          { role: "user", content: systemPrompt + "\n" + userPrompt }
        ],
        max_tokens: 500,
        temperature: 0.7,
      };
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(anthropicPayload),
      });
      const data = await response.json();
      aiResponse = data.content?.[0]?.text;
    }

    if (!aiResponse) {
      throw new Error('AI did not return a valid SQL query.');
    }

    // Clean up response (remove markdown code blocks if present)
    let cleanedSql = aiResponse.replace(/```sql\n|```/g, '').trim();

    res.json({ success: true, sql: cleanedSql });

  } catch (error) {
    console.error('Error generating SQL with AI:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to generate SQL with AI.' });
  } finally {
    if (connection) connection.release();
  }
});


// Initialize server config and DB pool at startup, then start listening
(async () => {
  try {
    await loadServerConfig();
    if (serverConfig) {
      dbPool = mysql.createPool({
        host: serverConfig.database.host,
        port: serverConfig.database.port,
        user: serverConfig.database.username, // Usuário do sistema
        password: serverConfig.database.password, // Senha do usuário do sistema
        waitForConnections: true,
        connectionLimit: serverConfig.database.maxConnections || 10,
        queueLimit: 0,
        timezone: '+00:00'
      });
      console.log('Database connection pool initialized.');
    }

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();

module.exports = app;