const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const axios = require('axios');

// Load .env only if it exists and has required variables
const envPath = path.join(__dirname, '../.env');
let envExists = false;

try {
  const envContent = require('fs').readFileSync(envPath, 'utf8');
  const hasSystemUser = envContent.includes('MYSQL_SYSTEM_USER=');
  const hasSystemPassword = envContent.includes('MYSQL_SYSTEM_PASSWORD=');
  const hasSessionKey = envContent.includes('SESSION_SECRET_KEY=');
  
  if (hasSystemUser && hasSystemPassword && hasSessionKey) {
    require('dotenv').config();
    envExists = true;
    console.log('.env file found and loaded with required variables.');
  } else {
    console.log('.env file exists but missing required setup variables. Running in setup mode.');
  }
} catch (error) {
  console.log('No .env file found or error reading it. Running in setup mode.');
}

const app = express();
const PORT = process.env.PORT || 3001;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
const SSL_KEY_PATH = process.env.SSL_KEY_PATH;
const SSL_CERT_PATH = process.env.SSL_CERT_PATH;
const SSL_CA_PATH = process.env.SSL_CA_PATH;

// --- Session Encryption ---
let SESSION_SECRET_KEY = process.env.SESSION_SECRET_KEY;

// If we don't have a session key and we're in setup mode, create a temporary one
if (!SESSION_SECRET_KEY && !envExists) {
  SESSION_SECRET_KEY = 'temp_setup_key_' + crypto.randomBytes(32).toString('hex');
  console.log('Using temporary session key for setup mode.');
} else if (!SESSION_SECRET_KEY) {
  console.error("FATAL ERROR: SESSION_SECRET_KEY is not defined in the .env file.");
  console.error("Please generate a secure key and add it to your .env file.");
  process.exit(1);
}

const ALGORITHM = 'aes-256-cbc';
const KEY = crypto.createHash('sha256').update(String(SESSION_SECRET_KEY)).digest('base64').substr(0, 32);

function encrypt(text) {
  const iv = crypto.scryptSync(SESSION_SECRET_KEY, 'salt', 16); // Deterministic IV
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

function decrypt(encryptedText) {
  const iv = crypto.scryptSync(SESSION_SECRET_KEY, 'salt', 16); // Deterministic IV
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Middleware
app.use(cors());
app.use(express.json());

// Variable to store server configuration in memory
let serverConfig = null;
// Variable to store the connection pool (for system operations)
let systemDbPool = null;

// System user credentials (for internal backend operations)
let MYSQL_SYSTEM_USER = process.env.MYSQL_SYSTEM_USER;
let MYSQL_SYSTEM_PASSWORD = process.env.MYSQL_SYSTEM_PASSWORD;

// Only require system credentials if we have a complete .env file
if (envExists && (!MYSQL_SYSTEM_USER || !MYSQL_SYSTEM_PASSWORD)) {
  console.error("FATAL ERROR: MYSQL_SYSTEM_USER or MYSQL_SYSTEM_PASSWORD are not defined in the .env file.");
  console.error("Please add the credentials for a MySQL user with CREATE DATABASE and CREATE TABLE privileges for the backend.");
  process.exit(1);
} else if (!envExists) {
  console.log('Running without system credentials - setup mode active.');
}

// Function to load server configuration once
async function loadServerConfig() {
  try {
    const configPath = path.join(__dirname, '../database-config.json');
    const configData = await fs.readFile(configPath, 'utf8');
    serverConfig = JSON.parse(configData);
    
    // Only add system user credentials if they exist (post-setup)
    if (MYSQL_SYSTEM_USER && MYSQL_SYSTEM_PASSWORD) {
      serverConfig.database.username = MYSQL_SYSTEM_USER;
      serverConfig.database.password = MYSQL_SYSTEM_PASSWORD;
      console.log('Server configuration loaded successfully with system credentials.');
    } else {
      console.log('Server configuration loaded in setup mode (no system credentials).');
    }
  } catch (error) {
    console.error('Error loading server config at startup:', error);
    serverConfig = null;
    throw error;
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

// Helper function to get a connection from the system pool (always authenticated as system user)
async function getSystemPooledConnection() {
  if (!systemDbPool || !serverConfig) {
    throw new Error('Database connection pool or server configuration not initialized.');
  }
  // Connections from the system pool are always authenticated as the system user
  return await systemDbPool.getConnection();
}

// Helper function specifically for administrative operations (uses system user)
async function getAdminPooledConnection() {
  if (!systemDbPool || !serverConfig) {
    throw new Error('Database connection pool or server configuration not initialized.');
  }
  console.log("Getting admin pooled connection with user:", serverConfig.database.username);
  // Use system connection for administrative operations that require elevated privileges
  return await systemDbPool.getConnection();
}

// Helper function to create a temporary connection for authenticated user operations
async function getUserPooledConnection(req) {
  if (!serverConfig) {
    throw new Error('Server configuration not initialized.');
  }
  if (!req.dbCredentials) {
    throw new Error('Authentication credentials not found in request.');
  }

  // Create a temporary connection for this user (not from pool to avoid contamination)
  const connection = await mysql.createConnection({
    host: serverConfig.database.host,
    port: serverConfig.database.port,
    user: req.dbCredentials.user,
    password: req.dbCredentials.password,
    database: null, // Don't specify a default database to avoid access denied errors
    charset: serverConfig.database.charset,
    ssl: serverConfig.database.ssl ? {
      ca: serverConfig.database.sslCA || undefined,
      cert: serverConfig.database.sslCertificate || undefined,
      key: serverConfig.database.key || undefined,
    } : false,
    multipleStatements: serverConfig.security.allowMultipleStatements,
    timezone: '+00:00',
    connectTimeout: serverConfig.database.connectionTimeout || 10000
  });

  // Add a custom release method that actually ends the connection
  connection.release = () => connection.end();
  
  return connection;
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
    connection = await getSystemPooledConnection(); // Get connection from pool for system user

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
    if (connection) connection.release(); // Release connection back to pool
  }
};

// Login endpoint
app.post('/api/login', async (req, res) => {
  let userConnection; // Temporary connection to test user-provided credentials
  let systemConnection; // Pool connection for system operations
  try {
    const { host, port, username, password } = req.body;

    // 1. Test connection with user-provided credentials
    userConnection = await mysql.createConnection({
      host: host,
      port: parseInt(port, 10),
      user: username,
      password: password,
      connectTimeout: 5000,
      timezone: '+00:00'
    });
    await userConnection.execute('SELECT 1'); // Check if connection is valid

    // 2. Update configuration file with new host and port (for frontend)
    const configPath = path.join(__dirname, '../database-config.json');
    const configData = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(configData);
    
    config.database.host = host;
    config.database.port = parseInt(port, 10);
    
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));

    // IMPORTANT: Reload in-memory configuration after writing to file
    await loadServerConfig();
    // If pool already exists, it needs to be reconfigured or recreated to use new host/port
    if (systemDbPool) {
      await systemDbPool.end(); // Close existing pool
      console.log('Existing database connection pool closed.');
    }
    systemDbPool = mysql.createPool({ // Recreate pool with new configuration
      host: serverConfig.database.host,
      port: serverConfig.database.port,
      user: serverConfig.database.username, // System user
      password: serverConfig.database.password, // Senha do System user
      waitForConnections: true,
      connectionLimit: serverConfig.database.maxConnections || 10,
      queueLimit: 0,
      timezone: '+00:00'
    });
    console.log('Database connection pool re-initialized with new config.');

    // 3. Get host of connected user
    const [currentUserRows] = await userConnection.query('SELECT CURRENT_USER() as user');
    const currentUser = currentUserRows[0].user;
    const [connectedUser, connectedHost] = currentUser.split('@');

    // 4. Get global privileges of the user
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

    // 5. Create session in system database using system pool connection
    systemConnection = await getSystemPooledConnection();
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const encryptedPassword = encrypt(password);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await systemConnection.query(
      `INSERT INTO \`${SYSTEM_DATABASE}\`.\`_jsma_sessions\` (session_token, user, host, encrypted_password, expires_at) VALUES (?, ?, ?, ?, ?)`,
      [sessionToken, username, connectedHost, encryptedPassword, expiresAt]
    );

    // 6. Send response
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
    if (userConnection) await userConnection.end(); // Direct connection must be closed
    if (systemConnection) systemConnection.release(); // Release pool connection
  }
});

// Logout endpoint
app.post('/api/logout', authMiddleware, async (req, res) => {
  let connection;
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader.split(' ')[1];
    
    connection = await getSystemPooledConnection(); // Get pool connection

    await connection.execute('DELETE FROM `javascriptmyadmin_meta`.`_jsma_sessions` WHERE `session_token` = ?', [token]);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout failed:', error);
    res.status(500).json({ success: false, message: 'Failed to logout' });
  } finally {
    if (connection) connection.release(); // Release connection back to pool
  }
});

// Session validation endpoint
app.get('/api/session/validate', authMiddleware, async (req, res) => {
  let connection;
  try {
    // The middleware already validated the session. Now, just get user privileges.
    connection = await getUserPooledConnection(req); // Get pool connection
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
    if (connection) connection.release(); // Release connection back to pool
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
      await testConnection.end(); // Direct connection must be closed
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

    // IMPORTANT: Reload in-memory configuration after writing to file
    await loadServerConfig();
    // If host or port changed, recreate the pool
    if (systemDbPool) {
      await systemDbPool.end(); // Close existing pool
      console.log('Existing database connection pool closed.');
    }
    systemDbPool = mysql.createPool({ // Recreate pool with new configuration
      host: serverConfig.database.host,
      port: serverConfig.database.port,
      user: serverConfig.database.username, // System user
      password: serverConfig.database.password, // System user password
      waitForConnections: true,
      connectionLimit: serverConfig.database.maxConnections || 10, // Use maxConnections from config
      queueLimit: 0, // No limit on request queue
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

// Get databases
app.get('/api/databases', authMiddleware, async (req, res) => {
  let connection;
  try {
    connection = await getUserPooledConnection(req); // Get pool connection
    const [rows] = await connection.query('SHOW DATABASES');
    const databases = rows.map(row => row.Database);
    res.json(databases);
  } catch (error) {
    console.error('Error fetching databases:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release(); // Release connection back to pool
  }
});

// Create new database
app.post('/api/databases', authMiddleware, async (req, res) => {
  let connection;
  try {
    connection = await getUserPooledConnection(req);
    const { databaseName, charset, collation } = req.body;

    if (!databaseName) {
      return res.status(400).json({ success: false, error: 'Database name is required.' });
    }

    // Basic sanitization for database name
    if (!/^[a-zA-Z0-9_]+$/.test(databaseName)) {
      return res.status(400).json({ success: false, error: 'Invalid database name. Only alphanumeric characters and underscores are allowed.' });
    }

    let createQuery = `CREATE DATABASE \`${databaseName}\``;
    if (charset) {
      createQuery += ` CHARACTER SET ${connection.escapeId(charset)}`;
    }
    if (collation) {
      createQuery += ` COLLATE ${connection.escapeId(collation)}`;
    }

    await connection.query(createQuery);
    res.json({ success: true, message: `Database '${databaseName}' created successfully.` });
  } catch (error) {
    console.error('Error creating database:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// Get tables and views for a database
app.get('/api/databases/:database/tables', authMiddleware, async (req, res) => {
  let connection;
  try {
    connection = await getUserPooledConnection(req); // Get pool connection
    const { database } = req.params;
    
    const [tablesAndViews] = await connection.execute(`
      SELECT TABLE_NAME as table_name, TABLE_TYPE as table_type, TABLE_ROWS as table_rows,
      ROUND(((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024), 2) AS size_mb,
      ENGINE as engine, TABLE_COLLATION as table_collation
      FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_TYPE, TABLE_NAME
    `, [database]);

    const tables = [], views = [];
    tablesAndViews.forEach(item => {
      const info = {
        name: item.table_name, rows: item.table_rows || 0,
        size: item.size_mb ? `${item.size_mb} MB` : '0 MB',
        engine: item.engine || 'N/A', collation: item.table_collation || 'Unknown'
      };
      if (item.table_type === 'VIEW') views.push(info);
      else tables.push(info);
    });
    
    res.json({ tables, views, totalTables: tables.length, totalViews: views.length });
  } catch (error) {
    console.error('Error fetching tables:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release(); // Release connection back to pool
  }
});

// Create new table
app.post('/api/databases/:database/tables', authMiddleware, async (req, res) => {
  let connection;
  try {
    connection = await getUserPooledConnection(req);
    const { database } = req.params;
    const { tableName, columns } = req.body;

    if (!tableName || !columns || !Array.isArray(columns) || columns.length === 0) {
      return res.status(400).json({ success: false, error: 'Table name and column definitions are required.' });
    }

    // Basic sanitization for table name
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
      return res.status(400).json({ success: false, error: 'Invalid table name. Only alphanumeric characters and underscores are allowed.' });
    }

    await connection.query(`USE \`${database}\``);

    const columnDefinitions = columns.map(col => {
      let definition = `\`${col.name}\` ${col.type}`;
      if (col.length !== undefined && col.length !== null && ['VARCHAR', 'CHAR', 'INT', 'TINYINT', 'SMALLINT', 'MEDIUMINT', 'BIGINT', 'DECIMAL'].includes(col.type.toUpperCase())) {
        definition += `(${col.length})`;
      }
      if (!col.nullable) {
        definition += ` NOT NULL`;
      }
      if (col.isAutoIncrement) {
        definition += ` AUTO_INCREMENT`;
      }
      if (col.defaultValue !== null && col.defaultValue !== undefined && col.defaultValue !== '') {
        // Escape default values properly
        if (typeof col.defaultValue === 'string' && !['CURRENT_TIMESTAMP'].includes(col.defaultValue.toUpperCase())) {
          definition += ` DEFAULT ${connection.escape(col.defaultValue)}`;
        } else {
          definition += ` DEFAULT ${col.defaultValue}`;
        }
      } else if (col.nullable && col.defaultValue === null) {
        definition += ` DEFAULT NULL`;
      }
      return definition;
    });

    const primaryKeyColumns = columns.filter(col => col.isPrimaryKey).map(col => `\`${col.name}\``);
    if (primaryKeyColumns.length === 0) {
      return res.status(400).json({ success: false, error: 'A table must have at least one primary key.' });
    }
    columnDefinitions.push(`PRIMARY KEY (${primaryKeyColumns.join(', ')})`);

    const createTableQuery = `CREATE TABLE \`${tableName}\` (${columnDefinitions.join(', ')})`;
    
    await connection.query(createTableQuery);
    res.json({ success: true, message: `Table '${tableName}' created successfully.` });
  } catch (error) {
    console.error('Error creating table:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// Delete table
app.delete('/api/databases/:database/tables/:table', authMiddleware, async (req, res) => {
  let connection;
  try {
    connection = await getUserPooledConnection(req);
    const { database, table } = req.params;

    await connection.query(`USE \`${database}\``);
    await connection.query(`DROP TABLE \`${table}\``);
    
    res.json({ success: true, message: `Table '${table}' deleted successfully.` });
  } catch (error) {
    console.error('Error deleting table:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// Truncate table data
app.delete('/api/databases/:database/tables/:table/data', authMiddleware, async (req, res) => {
  let connection;
  try {
    connection = await getUserPooledConnection(req);
    const { database, table } = req.params;

    await connection.query(`USE \`${database}\``);
    await connection.query(`TRUNCATE TABLE \`${table}\``);
    // Add ANALYZE TABLE to force statistics update in information_schema
    await connection.query(`ANALYZE TABLE \`${table}\``);
    
    res.json({ success: true, message: `Table '${table}' truncated successfully.` });
  } catch (error) {
    console.error('Error truncating table:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// Helper to compare column definitions (excluding name for rename detection)
function areColumnDefinitionsSimilar(col1, col2) {
  const typesWithLength = ['VARCHAR', 'CHAR', 'INT', 'TINYINT', 'SMALLINT', 'MEDIUMINT', 'BIGINT', 'DECIMAL'];

  let lengthMatches = true;
  if (typesWithLength.includes(col1.type) && typesWithLength.includes(col2.type)) {
    lengthMatches = col1.length === col2.length;
  } else if (!typesWithLength.includes(col1.type) && !typesWithLength.includes(col2.type)) {
    lengthMatches = true; // Neither type uses length, so they match on length
  } else {
    lengthMatches = false; // One uses length, the other doesn't, so they don't match
  }

  return (
    col1.type === col2.type &&
    lengthMatches &&
    col1.nullable === col2.nullable &&
    col1.isAutoIncrement === col2.isAutoIncrement &&
    String(col1.defaultValue) === String(col2.defaultValue)
  );
}

// Update table structure
app.put('/api/databases/:database/tables/:table/structure', authMiddleware, async (req, res) => {
  let connection;
  try {
    connection = await getUserPooledConnection(req);
    const { database, table } = req.params;
    const newColumns = req.body.columns; // This array now represents the desired order

    if (!newColumns || !Array.isArray(newColumns)) {
      return res.status(400).json({ success: false, error: 'New column definitions are required.' });
    }

    await connection.query(`USE \`${database}\``);

    // 1. Fetch current table structure
    const [currentDescribe] = await connection.query(`DESCRIBE \`${table}\``);
    const currentColumns = currentDescribe.map(col => ({
      name: col.Field,
      type: col.Type.split('(')[0].toUpperCase(),
      length: col.Type.includes('(') ? parseInt(col.Type.split('(')[1].replace(')', '')) : undefined,
      nullable: col.Null === 'YES',
      isPrimaryKey: col.Key === 'PRI',
      isAutoIncrement: col.Extra.includes('auto_increment'),
      defaultValue: col.Default,
    }));

    const alterStatements = [];
    const currentColumnMap = new Map(currentColumns.map(c => [c.name, c]));
    const newColumnMap = new Map(newColumns.map(c => [c.name, c]));

    // --- Primary Key Handling (before column changes) ---
    const currentPKColumns = currentColumns.filter(c => c.isPrimaryKey).map(c => c.name);
    const newPKColumns = newColumns.filter(c => c.isPrimaryKey).map(c => c.name);

    // Drop existing primary key if it's changing or being removed
    if (currentPKColumns.length > 0 && (!newPKColumns.length || JSON.stringify(currentPKColumns.sort()) !== JSON.stringify(newPKColumns.sort()))) {
      alterStatements.push(`ALTER TABLE \`${table}\` DROP PRIMARY KEY`);
    }

    // --- Identify dropped, added, modified, and renamed columns ---
    const columnsToDrop = []; // Names of columns to drop
    const columnsToAdd = []; // New column definitions to add
    const columnsToModify = []; // New column definitions to modify (same name, different properties)
    const columnsToRename = []; // Objects: { oldName: string, newCol: TableColumnDefinition }

    // First, identify columns that are definitely dropped or potentially renamed (old name gone)
    for (const currentCol of currentColumns) {
      if (!newColumnMap.has(currentCol.name)) {
        columnsToDrop.push(currentCol.name);
      }
    }

    // Then, identify columns that are new or modified, and try to match renames
    const unmatchedDroppedColumns = [...columnsToDrop]; // Copy for matching
    for (const newCol of newColumns) {
      const currentMatchByName = currentColumnMap.get(newCol.name);

      if (currentMatchByName) {
        // Column exists with the same name, check for modifications
        const isModified = 
          currentMatchByName.type !== newCol.type ||
          (currentMatchByName.length !== newCol.length && ['VARCHAR', 'CHAR', 'INT', 'TINYINT', 'SMALLINT', 'MEDIUMINT', 'BIGINT', 'DECIMAL'].includes(newCol.type.toUpperCase())) ||
          currentMatchByName.nullable !== newCol.nullable ||
          currentMatchByName.isAutoIncrement !== newCol.isAutoIncrement ||
          String(currentMatchByName.defaultValue) !== String(newCol.defaultValue);

        if (isModified) {
          columnsToModify.push(newCol);
        }
      } else {
        // This is a new column name. Could be an ADD or a RENAME.
        // Try to find a matching dropped column that is similar.
        let renamed = false;
        for (let i = 0; i < unmatchedDroppedColumns.length; i++) {
          const oldName = unmatchedDroppedColumns[i];
          const oldCol = currentColumnMap.get(oldName); // Get full definition of the old column

          // Check for similarity (excluding name)
          if (oldCol && areColumnDefinitionsSimilar(oldCol, newCol)) {
            columnsToRename.push({ oldName: oldName, newCol: newCol });
            unmatchedDroppedColumns.splice(i, 1); // Remove from unmatched dropped
            renamed = true;
            break;
          }
        }
        if (!renamed) {
          columnsToAdd.push(newCol);
        }
      }
    }

    // Any remaining in unmatchedDroppedColumns are actual drops
    for (const droppedColName of unmatchedDroppedColumns) {
      alterStatements.push(`ALTER TABLE \`${table}\` DROP COLUMN \`${droppedColName}\``);
    }

    // Helper to build column definition string
    const buildColumnDefinition = (col) => {
      let definition = `\`${col.name}\` ${col.type}`;
      if (col.length !== undefined && col.length !== null && ['VARCHAR', 'CHAR', 'INT', 'TINYINT', 'SMALLINT', 'MEDIUMINT', 'BIGINT', 'DECIMAL'].includes(col.type.toUpperCase())) {
        definition += `(${col.length})`;
      }
      if (!col.nullable) {
        definition += ` NOT NULL`;
      }
      if (col.isAutoIncrement) {
        definition += ` AUTO_INCREMENT`;
      }
      if (col.defaultValue !== null && col.defaultValue !== undefined && col.defaultValue !== '') {
        if (typeof col.defaultValue === 'string' && !['CURRENT_TIMESTAMP'].includes(col.defaultValue.toUpperCase())) {
          definition += ` DEFAULT ${connection.escape(col.defaultValue)}`;
        } else {
          definition += ` DEFAULT ${col.defaultValue}`;
        }
      } else if (col.nullable && col.defaultValue === null) {
        definition += ` DEFAULT NULL`;
      }
      return definition;
    };

    // Process renames, modifications, and additions in the order they appear in newColumns
    for (let i = 0; i < newColumns.length; i++) {
      const newCol = newColumns[i];
      const prevColInNewOrder = i > 0 ? newColumns[i - 1] : null;
      const afterClause = prevColInNewOrder ? ` AFTER \`${prevColInNewOrder.name}\`` : (i === 0 ? ` FIRST` : '');

      const currentMatchByName = currentColumnMap.get(newCol.name);
      const renameMatch = columnsToRename.find(r => r.newCol.name === newCol.name);

      if (renameMatch) {
        // Rename and potentially modify
        const oldName = renameMatch.oldName;
        const columnDefinition = buildColumnDefinition(newCol);
        alterStatements.push(`ALTER TABLE \`${table}\` CHANGE COLUMN \`${oldName}\` ${columnDefinition}${afterClause}`);
      } else if (currentMatchByName) {
        // Modify existing column (same name) or reorder
        const isModified = 
          currentMatchByName.type !== newCol.type ||
          (currentMatchByName.length !== newCol.length && ['VARCHAR', 'CHAR', 'INT', 'TINYINT', 'SMALLINT', 'MEDIUMINT', 'BIGINT', 'DECIMAL'].includes(newCol.type.toUpperCase())) ||
          currentMatchByName.nullable !== newCol.nullable ||
          currentMatchByName.isAutoIncrement !== newCol.isAutoIncrement ||
          String(currentMatchByName.defaultValue) !== String(newCol.defaultValue);

        // Check if position changed
        const currentPosition = currentColumns.findIndex(c => c.name === newCol.name);
        const newPosition = i;
        const positionChanged = currentPosition !== newPosition;

        if (isModified || positionChanged) {
          const columnDefinition = buildColumnDefinition(newCol);
          alterStatements.push(`ALTER TABLE \`${table}\` MODIFY COLUMN ${columnDefinition}${afterClause}`);
        }
      } else {
        // Add new column
        const columnDefinition = buildColumnDefinition(newCol);
        alterStatements.push(`ALTER TABLE \`${table}\` ADD COLUMN ${columnDefinition}${afterClause}`);
      }
    }

    // Add new primary key if it's changing or being added
    if (newPKColumns.length > 0 && (!currentPKColumns.length || JSON.stringify(currentPKColumns.sort()) !== JSON.stringify(newPKColumns.sort()))) {
      alterStatements.push(`ALTER TABLE \`${table}\` ADD PRIMARY KEY (${newPKColumns.map(name => `\`${name}\``).join(', ')})`);
    }

    // Execute all alter statements
    for (const statement of alterStatements) {
      console.log("Executing ALTER:", statement);
      await connection.query(statement);
    }
    
    res.json({ success: true, message: 'Table structure updated successfully.' });
  } catch (error) {
    console.error('Error updating table structure:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// Get table data
app.get('/api/databases/:database/tables/:table/data', authMiddleware, async (req, res) => {
  let connection;
  try {
    connection = await getUserPooledConnection(req); // Get pool connection
    const { database, table } = req.params;
    const { limit = 25, offset = 0, search = '', orderBy = '', orderDirection = 'ASC' } = req.query;
    
    const columnFilters = {};
    Object.keys(req.query).forEach(key => {
      if (key.startsWith('filter_')) {
        const columnName = key.replace('filter_', '');
        if (req.query[key] && req.query[key].trim()) {
          columnFilters[columnName] = req.query[key].trim();
        }
      }
    });
    
    await connection.query(`USE \`${database}\``);
    const [columns] = await connection.query(`DESCRIBE \`${table}\``);
    
    const whereConditions = [], queryParams = [];
    if (search && search.trim()) {
      const concatColumns = columns.map(col => `COALESCE(\`${col.Field}\`, '')`).join(', ');
      whereConditions.push(`CONCAT(${concatColumns}) LIKE ?`);
      queryParams.push(`%${search}%`);
    }
    Object.entries(columnFilters).forEach(([columnName, filterValue]) => {
      if (columns.some(col => col.Field === columnName)) {
        whereConditions.push(`\`${columnName}\` LIKE ?`);
        queryParams.push(`%${filterValue}%`);
      }
    });
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Add ORDER BY clause if orderBy is specified
    let orderByClause = '';
    if (orderBy && orderBy.trim()) {
      // Validate that the column exists to prevent SQL injection
      const validColumn = columns.find(col => col.Field === orderBy.trim());
      if (validColumn) {
        const direction = orderDirection.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
        orderByClause = `ORDER BY \`${orderBy.trim()}\` ${direction}`;
      }
    }
    
    const dataQuery = `SELECT * FROM \`${table}\` ${whereClause} ${orderByClause} LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;
    const countQuery = `SELECT COUNT(*) as total FROM \`${table}\` ${whereClause}`;
    
    const [rows] = await connection.query(dataQuery, queryParams);
    const [countResult] = await connection.query(countQuery, queryParams);
    
    res.json({
      columns: columns.map(c => ({ name: c.Field, type: c.Type, null: c.Null === 'YES', key: c.Key, default: c.Default, extra: c.Extra })),
      data: rows, total: countResult[0].total, limit: parseInt(limit), offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching table data:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release(); // Release connection back to pool
  }
});

// Update a single cell
app.put('/api/databases/:database/tables/:table/cell', authMiddleware, async (req, res) => {
  let connection;
  try {
    connection = await getUserPooledConnection(req); // Get pool connection
    const { database, table } = req.params;
    const { primaryKey, columnName, newValue } = req.body;

    if (!primaryKey || !columnName) return res.status(400).json({ error: 'Primary key and column name are required' });

    await connection.query(`USE \`${database}\``);
    const [columns] = await connection.query(`DESCRIBE \`${table}\``);
    const pkColumn = columns.find(col => col.Key === 'PRI');
    if (!pkColumn) return res.status(400).json({ error: 'Table has no primary key' });

    const processedValue = convertDateForMySQL(newValue);
    const [result] = await connection.execute(`UPDATE \`${table}\` SET \`${columnName}\` = ? WHERE \`${pkColumn.Field}\` = ?`, [processedValue, primaryKey]);
    res.json({ success: true, message: `Cell updated successfully`, affectedRows: result.affectedRows });
  } catch (error) {
    console.error('Error updating cell:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release(); // Release connection back to pool
  }
});

// Update entire row
app.put('/api/databases/:database/tables/:table/row', authMiddleware, async (req, res) => {
  let connection;
  try {
    connection = await getUserPooledConnection(req); // Get pool connection
    const { database, table } = req.params;
    const { primaryKey, data } = req.body;
    if (!primaryKey || !data) return res.status(400).json({ error: 'Primary key and data are required' });

    await connection.query(`USE \`${database}\``);
    const [columns] = await connection.query(`DESCRIBE \`${table}\``);
    const pkColumn = columns.find(col => col.Key === 'PRI');
    if (!pkColumn) return res.status(400).json({ error: 'Table has no primary key' });

    const processedData = processDataForMySQL(data);
    const setClause = Object.keys(processedData).filter(k => k !== pkColumn.Field).map(k => `\`${k}\` = ?`).join(', ');
    const values = Object.keys(processedData).filter(k => k !== pkColumn.Field).map(k => processedData[k]);
    
    const [result] = await connection.execute(`UPDATE \`${table}\` SET ${setClause} WHERE \`${pkColumn.Field}\` = ?`, [...values, primaryKey]);
    res.json({ success: true, message: `Row updated successfully`, affectedRows: result.affectedRows });
  } catch (error) {
    console.error('Error updating row:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release(); // Release connection back to pool
  }
});

// Insert new row
app.post('/api/databases/:database/tables/:table/row', authMiddleware, async (req, res) => {
  let connection;
  try {
    connection = await getUserPooledConnection(req); // Get pool connection
    const { database, table } = req.params;
    const { data } = req.body;
    if (!data) return res.status(400).json({ error: 'Data is required' });

    await connection.query(`USE \`${database}\``);
    const [columns] = await connection.query(`DESCRIBE \`${table}\``);
    const pkColumn = columns.find(col => col.Key === 'PRI');
    
    let processedData = processDataForMySQL(data);
    if (pkColumn && pkColumn.Extra.includes('auto_increment')) delete processedData[pkColumn.Field];

    const insertData = {};
    Object.entries(processedData).forEach(([key, value]) => { if (value !== undefined) insertData[key] = value; });
    if (Object.keys(insertData).length === 0) return res.status(400).json({ error: 'No valid data to insert' });

    const columnNames = Object.keys(insertData).map(k => `\`${k}\``).join(', ');
    const placeholders = Object.keys(insertData).map(() => '?').join(', ');
    const values = Object.values(insertData);
    
    const [result] = await connection.execute(`INSERT INTO \`${table}\` (${columnNames}) VALUES (${placeholders})`, values);
    res.json({ success: true, message: `Row inserted successfully`, insertId: result.insertId, affectedRows: result.affectedRows });
  } catch (error) {
    console.error('Error inserting row:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release(); // Release connection back to pool
  }
});

// Delete row
app.delete('/api/databases/:database/tables/:table/row', authMiddleware, async (req, res) => {
  let connection;
  try {
    connection = await getUserPooledConnection(req); // Get pool connection
    const { database, table } = req.params;
    const { primaryKey } = req.body;
    if (!primaryKey) return res.status(400).json({ error: 'Primary key is required' });

    await connection.query(`USE \`${database}\``);
    const [columns] = await connection.query(`DESCRIBE \`${table}\``);
    const pkColumn = columns.find(col => col.Key === 'PRI');
    if (!pkColumn) return res.status(400).json({ error: 'Table has no primary key' });

    const [result] = await connection.execute(`DELETE FROM \`${table}\` WHERE \`${pkColumn.Field}\` = ?`, [primaryKey]);
    res.json({ success: true, message: `Row deleted successfully`, affectedRows: result.affectedRows });
  } catch (error) {
    console.error('Error deleting row:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release(); // Release connection back to pool
  }
});

// Execute SQL query
app.post('/api/query', authMiddleware, async (req, res) => {
  let connection;
  const startTime = Date.now();
  try {
    connection = await getUserPooledConnection(req); // Get pool connection
    const { query, database } = req.body;
    if (!query) return res.status(400).json({ error: 'Query is required' });

    if (database) await connection.query(`USE \`${database}\``);

    const [rows, fields] = await connection.query(query);
    const executionTime = Date.now() - startTime;

    if (query.trim().toLowerCase().startsWith('select')) {
      res.json({
        success: true, data: rows,
        fields: fields?.map(f => ({ name: f.name, type: f.type, table: f.table })) || [],
        rowCount: Array.isArray(rows) ? rows.length : 0,
        executionTime: executionTime
      });
    } else {
      res.json({
        success: true, message: `Query executed successfully. ${rows.affectedRows || 0} rows affected.`,
        affectedRows: rows.affectedRows || 0, executionTime: executionTime
      });
    }
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error('Error executing query:', error);
    res.status(400).json({ success: false, error: error.message, executionTime: executionTime });
  } finally {
    if (connection) connection.release(); // Release connection back to pool
  }
});

// Save query to history
app.post('/api/query-history', authMiddleware, async (req, res) => {
  let connection;
  try {
    const { query_text, database_context, execution_time_ms, status, error_message } = req.body;
    const executed_by = req.dbCredentials.user; // Get user from authenticated session
    
    connection = await getSystemPooledConnection(); // Get pool connection

    const historyQuery = `
      INSERT INTO \`${SYSTEM_DATABASE}\`.\`_jsma_query_history\` 
      (query_text, database_context, executed_by, execution_time_ms, status, error_message) 
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    await connection.execute(historyQuery, [
      query_text,
      database_context || null,
      executed_by, // Store the user who executed the query
      execution_time_ms,
      status,
      error_message || null
    ]);
    
    res.json({ success: true, message: 'Query history saved.' });
  } catch (error) {
    // This is a non-critical, fire-and-forget feature.
    // If it fails (e.g., system tables not set up), log it server-side but don't fail the user's request.
    console.warn('Could not save query history:', error.message);
    res.status(200).json({ success: false, message: 'Could not save query history.' });
  } finally {
    if (connection) connection.release(); // Release connection back to pool
  }
});

// Get query history for the authenticated user
app.get('/api/query-history', authMiddleware, async (req, res) => {
  let connection;
  try {
    const executed_by = req.dbCredentials.user;
    connection = await getSystemPooledConnection();

    const [history] = await connection.execute(
      `SELECT id, query_text, database_context, executed_at, execution_time_ms, status, error_message 
       FROM \`${SYSTEM_DATABASE}\`.\`_jsma_query_history\` 
       WHERE executed_by = ? 
       ORDER BY executed_at DESC LIMIT 10`, // Limit to 10 recent queries
      [executed_by]
    );
    
    res.json(history);
  } catch (error) {
    console.error('Error fetching query history:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// Get server status
app.get('/api/status', authMiddleware, async (req, res) => {
  let connection;
  try {
    // Use admin connection for server status queries that may require elevated privileges
    connection = await getAdminPooledConnection(); // Get admin pool connection
    const [variables] = await connection.query('SHOW VARIABLES LIKE "version"');
    const [status] = await connection.query('SHOW STATUS LIKE "Uptime"');
    const [processes] = await connection.query('SHOW PROCESSLIST');
    res.json({
      version: variables[0]?.Value || 'Unknown', uptime: status[0]?.Value || '0',
      connections: processes.length, status: 'connected'
    });
  } catch (error) {
    console.error('Error fetching server status:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release(); // Release connection back to pool
  }
});

// Get MySQL users
app.get('/api/users', authMiddleware, async (req, res) => {
  let connection;
  try {
    // Use admin connection to access mysql.user table
    connection = await getAdminPooledConnection(); // Get admin pool connection
    const [rows] = await connection.query("SELECT user, host FROM mysql.user ORDER BY user, host");
    res.json(rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release(); // Release connection back to pool
  }
});

// Get user privileges (global and database-specific)
app.get('/api/users/:user/:host/privileges', authMiddleware, async (req, res) => {
  let connection;
  try {
    // Use admin connection to query user privileges
    connection = await getAdminPooledConnection(); // Get admin pool connection
    const { user, host } = req.params;
    const [rows] = await connection.query('SHOW GRANTS FOR ?@?', [user, host]);
    
    const globalRegex = /^GRANT (.*) ON \*\.\* TO/;
    const dbRegex = /^GRANT (.*) ON `(.*?)`\.\* TO/;

    let globalPrivileges = new Set();
    const databasePrivileges = {};

    rows.forEach(row => {
      const grant = Object.values(row)[0];
      const withGrantOption = grant.includes('WITH GRANT OPTION');

      let match = grant.match(globalRegex);
      if (match) {
        const privs = match[1].split(',').map(p => p.trim().toUpperCase());
        privs.forEach(p => globalPrivileges.add(p));
        if (withGrantOption) globalPrivileges.add('GRANT OPTION');
        return;
      }

      match = grant.match(dbRegex);
      if (match) {
        const dbName = match[2];
        if (!databasePrivileges[dbName]) {
          databasePrivileges[dbName] = { database: dbName, privileges: new Set(), grantOption: false };
        }
        const privs = match[1].split(',').map(p => p.trim().toUpperCase());
        privs.forEach(p => databasePrivileges[dbName].privileges.add(p));
        if (withGrantOption) databasePrivileges[dbName].grantOption = true;
      }
    });

    const finalGlobal = Array.from(globalPrivileges).filter(p => p !== 'USAGE');
    const finalDb = Object.values(databasePrivileges).map(db => ({
      ...db,
      privileges: Array.from(db.privileges)
    }));

    res.json({ globalPrivileges: finalGlobal, databasePrivileges: finalDb });
  } catch (error) {
    console.error('Error fetching user privileges:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release(); // Release connection back to pool
  }
});

// Update global user privileges
app.post('/api/users/:user/:host/privileges', authMiddleware, async (req, res) => {
  let connection;
  try {
    // Use admin connection to modify user privileges
    connection = await getAdminPooledConnection(); // Get admin pool connection
    const { user, host } = req.params;
    const { privileges } = req.body;

    await connection.query('REVOKE ALL PRIVILEGES ON *.* FROM ?@?', [user, host]);
    
    if (privileges && privileges.length > 0) {
      const grantQuery = `GRANT ${privileges.join(', ')} ON *.* TO ?@?`;
      await connection.query(grantQuery, [user, host]);
    }
    
    res.json({ success: true, message: 'Global privileges updated successfully' });
  } catch (error) {
    console.error('Error updating global privileges:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release(); // Release connection back to pool
  }
});

// Update/Add database privileges
app.post('/api/users/:user/:host/database-privileges', authMiddleware, async (req, res) => {
  let connection;
  try {
    // Use admin connection to modify database privileges
    connection = await getAdminPooledConnection(); // Get admin pool connection
    const { user, host } = req.params;
    const { database, privileges, grantOption } = req.body;

    await connection.query('REVOKE ALL PRIVILEGES ON `??`.* FROM ?@?', [database, user, host]);
    
    if (privileges && privileges.length > 0) {
      let grantQuery = `GRANT ${privileges.join(', ')} ON \`${database}\`.* TO ?@?`;
      if (grantOption) {
        grantQuery += ' WITH GRANT OPTION';
      }
      await connection.query(grantQuery, [user, host]);
    }
    
    res.json({ success: true, message: 'Database privileges updated' });
  } catch (error) {
    console.error('Error updating database privileges:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release(); // Release connection back to pool
  }
});

// Revoke all privileges on a database
app.delete('/api/users/:user/:host/database-privileges', authMiddleware, async (req, res) => {
  let connection;
  try {
    const { user, host } = req.params;
    const { database } = req.body;

    // Use admin connection to revoke database privileges
    connection = await getAdminPooledConnection(); // Get admin pool connection
    await connection.query('REVOKE ALL PRIVILEGES, GRANT OPTION ON `??`.* FROM ?@?', [database, user, host]);
    
    res.json({ success: true, message: 'Database privileges revoked' });
  } catch (error) {
    console.error('Error revoking database privileges:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release(); // Release connection back to pool
  }
});

// AI Configuration endpoints
// Get AI configuration
app.get('/api/config/ai', authMiddleware, async (req, res) => {
  let connection;
  try {
    connection = await getSystemPooledConnection();
    
    // Check if the config table exists, create it if it doesn't
    try {
      await connection.execute(`DESCRIBE \`${SYSTEM_DATABASE}\`.\`_jsma_config\``);
    } catch (error) {
      if (error.code === 'ER_NO_SUCH_TABLE') {
        console.log('Creating _jsma_config table...');
        await connection.execute(
          `CREATE TABLE IF NOT EXISTS \`${SYSTEM_DATABASE}\`.\`_jsma_config\` (
            id INT AUTO_INCREMENT PRIMARY KEY,
            config_key VARCHAR(255) NOT NULL UNIQUE,
            config_value TEXT,
            encrypted BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          )`
        );
      } else {
        throw error;
      }
    }
    
    const [configs] = await connection.execute(
      `SELECT config_key, config_value, encrypted FROM \`${SYSTEM_DATABASE}\`.\`_jsma_config\` WHERE config_key IN (?, ?, ?)`,
      ['geminiApiKey', 'openAIApiKey', 'anthropicApiKey']
    );
    
    const aiConfig = {
      geminiApiKey: '',
      openAIApiKey: '',
      anthropicApiKey: ''
    };
    
    for (const config of configs) {
      if (config.encrypted && config.config_value) {
        try {
          aiConfig[config.config_key] = decrypt(config.config_value);
        } catch (error) {
          console.error(`Error decrypting ${config.config_key}:`, error);
          aiConfig[config.config_key] = '';
        }
      } else {
        aiConfig[config.config_key] = config.config_value || '';
      }
    }
    
    res.json(aiConfig);
  } catch (error) {
    console.error('Error getting AI configuration:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// Save AI configuration
app.post('/api/config/ai', authMiddleware, async (req, res) => {
  let connection;
  try {
    connection = await getSystemPooledConnection();
    
    // Check if the config table exists, create it if it doesn't
    try {
      await connection.execute(`DESCRIBE \`${SYSTEM_DATABASE}\`.\`_jsma_config\``);
    } catch (error) {
      if (error.code === 'ER_NO_SUCH_TABLE') {
        console.log('Creating _jsma_config table...');
        await connection.execute(
          `CREATE TABLE IF NOT EXISTS \`${SYSTEM_DATABASE}\`.\`_jsma_config\` (
            id INT AUTO_INCREMENT PRIMARY KEY,
            config_key VARCHAR(255) NOT NULL UNIQUE,
            config_value TEXT,
            encrypted BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          )`
        );
      } else {
        throw error;
      }
    }
    
    const { geminiApiKey, openAIApiKey, anthropicApiKey } = req.body;
    
    const configs = [
      { key: 'geminiApiKey', value: geminiApiKey },
      { key: 'openAIApiKey', value: openAIApiKey },
      { key: 'anthropicApiKey', value: anthropicApiKey }
    ];
    
    for (const config of configs) {
      if (config.value && config.value.trim()) {
        // Encrypt and save non-empty values
        const encryptedValue = encrypt(config.value);
        await connection.execute(
          `INSERT INTO \`${SYSTEM_DATABASE}\`.\`_jsma_config\` (config_key, config_value, encrypted) 
           VALUES (?, ?, true) ON DUPLICATE KEY UPDATE config_value = VALUES(config_value), encrypted = VALUES(encrypted), updated_at = CURRENT_TIMESTAMP`,
          [config.key, encryptedValue]
        );
      } else {
        // Remove empty values
        await connection.execute(
          `DELETE FROM \`${SYSTEM_DATABASE}\`.\`_jsma_config\` WHERE config_key = ?`,
          [config.key]
        );
      }
    }
    
    res.json({ success: true, message: 'AI configuration saved successfully' });
  } catch (error) {
    console.error('Error saving AI configuration:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// Helper function to get database schema information
async function getDatabaseSchema(connection, database) {
  try {
    // Get tables information
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME, TABLE_TYPE, TABLE_COMMENT, ENGINE
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? 
      ORDER BY TABLE_NAME
    `, [database]);

    const schema = { database, tables: [] };

    // Get columns for each table
    for (const table of tables) {
      const [columns] = await connection.execute(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY, 
               COLUMN_DEFAULT, EXTRA, COLUMN_COMMENT
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? 
        ORDER BY ORDINAL_POSITION
      `, [database, table.TABLE_NAME]);

      // Get foreign keys for the table
      const [foreignKeys] = await connection.execute(`
        SELECT COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? 
              AND REFERENCED_TABLE_NAME IS NOT NULL
      `, [database, table.TABLE_NAME]);

      schema.tables.push({
        name: table.TABLE_NAME,
        type: table.TABLE_TYPE,
        comment: table.TABLE_COMMENT,
        engine: table.ENGINE,
        columns: columns.map(col => ({
          name: col.COLUMN_NAME,
          type: col.DATA_TYPE,
          nullable: col.IS_NULLABLE === 'YES',
          key: col.COLUMN_KEY,
          default: col.COLUMN_DEFAULT,
          extra: col.EXTRA,
          comment: col.COLUMN_COMMENT
        })),
        foreignKeys: foreignKeys.map(fk => ({
          column: fk.COLUMN_NAME,
          referencedTable: fk.REFERENCED_TABLE_NAME,
          referencedColumn: fk.REFERENCED_COLUMN_NAME
        }))
      });
    }

    // Validate that we have at least some tables
    if (schema.tables.length === 0) {
      throw new Error(`Database '${database}' contains no tables. Cannot generate SQL without table structure.`);
    }

    return schema;
  } catch (error) {
    console.error('Error getting database schema:', error);
    throw error;
  }
}

// Helper function to create a structured prompt for AI
function createSQLGenerationPrompt(userPrompt, schema) {
  // Validate inputs
  if (!schema || !schema.tables || schema.tables.length === 0) {
    throw new Error('Invalid or empty database schema provided');
  }
  
  if (!userPrompt || !userPrompt.trim()) {
    throw new Error('User prompt cannot be empty');
  }
  const schemaDescription = schema.tables.map(table => {
    const tableDesc = `Table: ${table.name} (${table.type})${table.comment ? ` - ${table.comment}` : ''}`;
    const columnsDesc = table.columns.map(col => {
      const keyInfo = col.key === 'PRI' ? ' [PRIMARY KEY]' : col.key === 'UNI' ? ' [UNIQUE]' : '';
      const nullableInfo = col.nullable ? '' : ' [NOT NULL]';
      const extraInfo = col.extra ? ` [${col.extra}]` : '';
      const commentInfo = col.comment ? ` // ${col.comment}` : '';
      return `  - ${col.name}: ${col.type}${keyInfo}${nullableInfo}${extraInfo}${commentInfo}`;
    }).join('\n');
    
    const fkDesc = table.foreignKeys.length > 0 
      ? '\n  Foreign Keys:\n' + table.foreignKeys.map(fk => 
          `    - ${fk.column} -> ${fk.referencedTable}.${fk.referencedColumn}`
        ).join('\n')
      : '';
    
    return `${tableDesc}\n${columnsDesc}${fkDesc}`;
  }).join('\n\n');

  return `You are a SQL expert assistant. Generate a MySQL query based on the user's request and the provided database schema.

Database Schema for "${schema.database}":
${schemaDescription}

User Request: ${userPrompt}

CRITICAL INSTRUCTIONS:
1. ONLY use tables and columns that exist in the "${schema.database}" database schema provided above
2. DO NOT create or assume table names like "users", "products", etc. if they don't exist in the schema
3. Look for the most appropriate table in the schema that matches the user's request
4. Use exact table and column names as shown in the schema (case-sensitive)
5. If asking for "users" but no "users" table exists, look for alternatives like "clients_*", "customers", "pessoas", etc.
6. If asking for "gender" but that column doesn't exist, look for "genero", "sexo", or similar columns
7. Always analyze the schema first to find the right table/columns before generating SQL
8. Use proper MySQL syntax with JOINs, WHERE clauses, ORDER BY, and LIMIT as needed
9. Generate queries that will actually work with the provided schema
10. Always use the database schema "${schema.database}" in the query, por exemple: FROM \`${schema.database}\`.\`my_table\`

EXAMPLE: If user asks "select male users" and there's no "users" table but there's a "clients_viz" table with "genero" column, generate:
SELECT * FROM clients_viz WHERE genero = 'masculino';

Respond with ONLY the SQL query, no explanations or additional text.`;
}

// Helper function to create a generic prompt for AI without specific database context
function createGenericSQLPrompt(userPrompt, database = null) {
  // Validate inputs
  if (!userPrompt || !userPrompt.trim()) {
    throw new Error('User prompt cannot be empty');
  }

  const databaseContext = database ? `for the "${database}" database` : '';
  
  return `You are a SQL expert assistant. Generate a MySQL query based on the user's request ${databaseContext}.

User Request: ${userPrompt}

Please generate a MySQL query that:
1. Uses proper MySQL syntax
2. Uses common table and column naming conventions if specific names aren't provided
3. Includes appropriate JOINs, WHERE clauses, ORDER BY, and LIMIT as needed
4. Is optimized for performance
5. Uses realistic example table and column names if not specified

Note: ${database ? `This query is intended for the "${database}" database.` : 'No specific database context provided - use generic table/column names.'}

Respond with ONLY the SQL query, no explanations or additional text.`;
}

// AI API call functions
async function callGeminiAPI(apiKey, prompt) {
  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        contents: [{
          parts: [{ text: prompt }]
        }]
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 45000,
        validateStatus: function (status) {
          return status >= 200 && status < 300;
        }
      }
    );

    if (response.data && response.data.candidates && response.data.candidates[0]) {
      return response.data.candidates[0].content.parts[0].text.trim();
    }
    throw new Error('Invalid response from Gemini API');
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      throw new Error('Request timeout - Gemini API took too long to respond');
    }
    if (error.response && error.response.status === 429) {
      throw new Error('Rate limit exceeded for Gemini API');
    }
    if (error.response && error.response.status === 401) {
      throw new Error('Invalid API key for Gemini');
    }
    throw error;
  }
}

async function callOpenAIAPI(apiKey, prompt) {
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.1
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 45000,
        validateStatus: function (status) {
          return status >= 200 && status < 300;
        }
      }
    );

    if (response.data && response.data.choices && response.data.choices[0]) {
      return response.data.choices[0].message.content.trim();
    }
    throw new Error('Invalid response from OpenAI API');
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      throw new Error('Request timeout - OpenAI API took too long to respond');
    }
    if (error.response && error.response.status === 429) {
      throw new Error('Rate limit exceeded for OpenAI API');
    }
    if (error.response && error.response.status === 401) {
      throw new Error('Invalid API key for OpenAI');
    }
    if (error.response && error.response.status === 402) {
      throw new Error('Insufficient credits for OpenAI API');
    }
    throw error;
  }
}

async function callAnthropicAPI(apiKey, prompt) {
  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-3-sonnet-20240229',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }]
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        timeout: 45000,
        validateStatus: function (status) {
          return status >= 200 && status < 300;
        }
      }
    );

    if (response.data && response.data.content && response.data.content[0]) {
      return response.data.content[0].text.trim();
    }
    throw new Error('Invalid response from Anthropic API');
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      throw new Error('Request timeout - Anthropic API took too long to respond');
    }
    if (error.response && error.response.status === 429) {
      throw new Error('Rate limit exceeded for Anthropic API');
    }
    if (error.response && error.response.status === 401) {
      throw new Error('Invalid API key for Anthropic');
    }
    if (error.response && error.response.status === 402) {
      throw new Error('Insufficient credits for Anthropic API');
    }
    throw error;
  }
}

// Generate SQL with AI
app.post('/api/ai/generate-sql', authMiddleware, async (req, res) => {
  let connection;
  let userConnection;
  try {
    connection = await getSystemPooledConnection();
    const { prompt, model, database } = req.body;
    
    // Check if the config table exists, create it if it doesn't
    try {
      await connection.execute(`DESCRIBE \`${SYSTEM_DATABASE}\`.\`_jsma_config\``);
    } catch (error) {
      if (error.code === 'ER_NO_SUCH_TABLE') {
        console.log('Creating _jsma_config table...');
        await connection.execute(
          `CREATE TABLE IF NOT EXISTS \`${SYSTEM_DATABASE}\`.\`_jsma_config\` (
            id INT AUTO_INCREMENT PRIMARY KEY,
            config_key VARCHAR(255) NOT NULL UNIQUE,
            config_value TEXT,
            encrypted BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          )`
        );
      } else {
        throw error;
      }
    }
    
    // Get the API key for the selected model
    const [configs] = await connection.execute(
      `SELECT config_value FROM \`${SYSTEM_DATABASE}\`.\`_jsma_config\` WHERE config_key = ? AND encrypted = true`,
      [`${model}ApiKey`]
    );
    
    if (configs.length === 0) {
      return res.status(400).json({ error: `API key not configured for model: ${model}` });
    }
    
    const apiKey = decrypt(configs[0].config_value);
    
    // Validate required parameters
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    
    let aiPrompt;
    
    if (database) {
      // Get user connection to access the specified database
      userConnection = await getUserPooledConnection(req);
      
      try {
        // Get database schema
        const schema = await getDatabaseSchema(userConnection, database);
        
        // Create structured prompt for AI with database context
        aiPrompt = createSQLGenerationPrompt(prompt, schema);
      } catch (schemaError) {
        console.error('Error getting database schema:', schemaError);
        // Fall back to generic prompt if schema retrieval fails
        aiPrompt = createGenericSQLPrompt(prompt, database);
      }
    } else {
      // Create generic SQL prompt without specific database context
      aiPrompt = createGenericSQLPrompt(prompt);
    }
    
    let generatedSQL;
    let aiModel;
    
    // Call the appropriate AI API based on the selected model
    try {
        switch (model) {
          case 'gemini':
            generatedSQL = await callGeminiAPI(apiKey, aiPrompt);
            aiModel = 'Google Gemini';
            break;
          case 'openAI':
            generatedSQL = await callOpenAIAPI(apiKey, aiPrompt);
            aiModel = 'OpenAI GPT';
            break;
          case 'anthropic':
            generatedSQL = await callAnthropicAPI(apiKey, aiPrompt);
            aiModel = 'Anthropic Claude';
            break;
          default:
            return res.status(400).json({ error: `Unsupported model: ${model}` });
        }
    } catch (aiError) {
      console.error(`Error calling ${model} API:`, aiError);
      return res.status(500).json({ 
        error: `Failed to generate SQL using ${model}: ${aiError.message}`,
        details: 'Please check your API key and try again'
      });
    }
    
    // Clean up the generated SQL (remove markdown code blocks if present)
    let cleanSQL = generatedSQL
      .replace(/```sql\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();
    
    // Remove any trailing semicolon and add one back for consistency
    cleanSQL = cleanSQL.replace(/;+$/, '') + ';';
    
    // Basic validation - ensure it looks like SQL
    if (!cleanSQL || cleanSQL.length < 5) {
      return res.status(500).json({ 
        error: 'AI generated invalid or empty SQL',
        generatedText: generatedSQL
      });
    }
    
    res.json({ 
      success: true, 
      sql: cleanSQL,
      message: `SQL generated successfully using ${aiModel}`,
      model: aiModel,
      originalPrompt: prompt,
      databaseContext: database
    });
    
  } catch (error) {
    console.error('Error generating SQL with AI:', error);
    
    // Provide more specific error messages
    let errorMessage = error.message;
    if (error.code === 'ER_BAD_DB_ERROR') {
      errorMessage = `Database '${database}' does not exist or is not accessible`;
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      errorMessage = `Access denied to database '${database}'`;
    } else if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      errorMessage = 'Network error: Unable to reach AI service';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      code: error.code || 'UNKNOWN_ERROR'
    });
  } finally {
    if (userConnection) userConnection.release();
    if (connection) connection.release();
  }
});

// Endpoint to check system status (simplified approach - no DB connection required)
app.get('/api/system/status', async (req, res) => { // No auth required
  try {
    // Check if we have the .env file with required variables
    if (!envExists || !MYSQL_SYSTEM_USER || !MYSQL_SYSTEM_PASSWORD || !SESSION_SECRET_KEY || SESSION_SECRET_KEY.startsWith('temp_setup_key_')) {
      return res.json({ status: 'needs_initialization', message: 'System requires initial setup.' });
    }

    // Check if the configuration file exists and is valid
    if (!serverConfig) {
      return res.json({ status: 'needs_initialization', message: 'Configuration file missing or invalid.' });
    }

    // If we got here, the system is configured
    res.json({ status: 'ready', message: 'System is configured and ready.' });
  } catch (error) {
    console.error('Error checking system status:', error);
    return res.json({ status: 'needs_initialization', message: 'Error checking system configuration.' });
  }
});

// Endpoint to initialize system tables
app.post('/api/system/initialize', async (req, res) => { // Removed authMiddleware
  let connection;
  try {
    connection = await getSystemPooledConnection();
    await connection.query(`CREATE DATABASE IF NOT EXISTS ??`, [SYSTEM_DATABASE]);
        
    const tableCreationQueries = [
      `CREATE TABLE IF NOT EXISTS \`${SYSTEM_DATABASE}\`.\`_jsma_query_history\` ( id INT AUTO_INCREMENT PRIMARY KEY, query_text TEXT NOT NULL, database_context VARCHAR(255), executed_by VARCHAR(255) NOT NULL, executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, execution_time_ms INT, status ENUM('success', 'error') NOT NULL, error_message TEXT );`,
      `CREATE TABLE IF NOT EXISTS \`${SYSTEM_DATABASE}\`.\`_jsma_favorite_queries\` ( id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NOT NULL, query_text TEXT NOT NULL, database_context VARCHAR(255), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP );`,
      `CREATE TABLE IF NOT EXISTS \`${SYSTEM_DATABASE}\`.\`_jsma_favorite_tables\` ( id INT AUTO_INCREMENT PRIMARY KEY, database_name VARCHAR(255) NOT NULL, table_name VARCHAR(255) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY unique_favorite (database_name, table_name) );`,
      `CREATE TABLE IF NOT EXISTS \`${SYSTEM_DATABASE}\`.\`_jsma_sessions\` ( id INT AUTO_INCREMENT PRIMARY KEY, session_token VARCHAR(128) NOT NULL UNIQUE, user VARCHAR(255) NOT NULL, host VARCHAR(255) NOT NULL, encrypted_password TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, expires_at DATETIME NOT NULL, INDEX idx_token (session_token), INDEX idx_expires (expires_at) );`,
      `CREATE TABLE IF NOT EXISTS \`${SYSTEM_DATABASE}\`.\`_jsma_config\` ( id INT AUTO_INCREMENT PRIMARY KEY, config_key VARCHAR(255) NOT NULL UNIQUE, config_value TEXT, encrypted BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP );`
    ];

    for (const query of tableCreationQueries) {
      await connection.query(query);
    }

    // Check if 'executed_by' column exists and add it if not (for existing installations)
    const [columns] = await connection.query(`DESCRIBE \`${SYSTEM_DATABASE}\`.\`_jsma_query_history\``);
    const hasExecutedByColumn = columns.some(col => col.Field === 'executed_by');
    if (!hasExecutedByColumn) {
      console.log("Adding 'executed_by' column to _jsma_query_history table...");
      await connection.query(`ALTER TABLE \`${SYSTEM_DATABASE}\`.\`_jsma_query_history\` ADD COLUMN \`executed_by\` VARCHAR(255) NOT NULL AFTER \`database_context\``);
    }

    res.json({ success: true, message: 'System tables initialized successfully.' });
  } catch (error) {
    console.error('Error initializing system tables:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// Endpoint para testar conexão com credenciais root
app.post('/api/system/test-root-connection', async (req, res) => {
  const { host, port, username, password } = req.body;
  
  let connection;
  try {
    connection = await mysql.createConnection({
      host: host || 'localhost',
      port: port || 3306,
      user: username,
      password: password || '',
      connectionTimeout: 10000
    });
    
    // Testar se o usuário tem privilégios administrativos
    await connection.query('SELECT 1');
    const [privileges] = await connection.query(`SHOW GRANTS FOR '${username}'@'${host || 'localhost'}'`);
    
    // Verificar se tem privilégios de CREATE DATABASE e CREATE USER
    const hasAdminPrivileges = privileges.some(grant => 
      grant[`Grants for ${username}@${host || 'localhost'}`].includes('ALL PRIVILEGES') ||
      (grant[`Grants for ${username}@${host || 'localhost'}`].includes('CREATE') && 
       grant[`Grants for ${username}@${host || 'localhost'}`].includes('GRANT OPTION'))
    );
    
    if (!hasAdminPrivileges) {
      return res.json({ 
        success: false, 
        message: 'O usuário não possui privilégios administrativos suficientes. É necessário um usuário com privilégios de CREATE DATABASE, CREATE USER e GRANT OPTION.' 
      });
    }
    
    res.json({ success: true, message: 'Conexão estabelecida com sucesso e privilégios administrativos confirmados.' });
  } catch (error) {
    console.error('Error testing root connection:', error);
    res.json({ success: false, message: `Erro de conexão: ${error.message}` });
  } finally {
    if (connection) await connection.end();
  }
});

// Endpoint para criar o banco de dados do sistema
app.post('/api/system/create-database', async (req, res) => {
  const { host, port, username, password } = req.body;
  
  let connection;
  try {
    connection = await mysql.createConnection({
      host: host || 'localhost',
      port: port || 3306,
      user: username,
      password: password || '',
      connectionTimeout: 10000
    });
    
    // Criar o banco de dados do sistema
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${SYSTEM_DATABASE}\``);
    
    // Criar as tabelas do sistema
    const tableCreationQueries = [
      `CREATE TABLE IF NOT EXISTS \`${SYSTEM_DATABASE}\`.\`_jsma_query_history\` (
        id INT AUTO_INCREMENT PRIMARY KEY,
        query_text TEXT NOT NULL,
        database_context VARCHAR(255),
        executed_by VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        execution_time_ms INT,
        status ENUM('success', 'error') NOT NULL,
        error_message TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS \`${SYSTEM_DATABASE}\`.\`_jsma_favorite_queries\` (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        query_text TEXT NOT NULL,
        database_context VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS \`${SYSTEM_DATABASE}\`.\`_jsma_favorite_tables\` (
        id INT AUTO_INCREMENT PRIMARY KEY,
        database_name VARCHAR(255) NOT NULL,
        table_name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_favorite (database_name, table_name)
      )`,
      `CREATE TABLE IF NOT EXISTS \`${SYSTEM_DATABASE}\`.\`_jsma_sessions\` (
        id INT AUTO_INCREMENT PRIMARY KEY,
        session_token VARCHAR(128) NOT NULL UNIQUE,
        user VARCHAR(255) NOT NULL,
        host VARCHAR(255) NOT NULL,
        encrypted_password TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        INDEX idx_token (session_token),
        INDEX idx_expires (expires_at)
      )`,
      `CREATE TABLE IF NOT EXISTS \`${SYSTEM_DATABASE}\`.\`_jsma_config\` (
        id INT AUTO_INCREMENT PRIMARY KEY,
        config_key VARCHAR(255) NOT NULL UNIQUE,
        config_value TEXT,
        encrypted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`
    ];
    
    for (const query of tableCreationQueries) {
      await connection.query(query);
    }
    
    res.json({ success: true, message: `Banco de dados ${SYSTEM_DATABASE} e tabelas criados com sucesso.` });
  } catch (error) {
    console.error('Error creating system database:', error);
    res.status(500).json({ success: false, message: `Erro ao criar banco de dados: ${error.message}` });
  } finally {
    if (connection) await connection.end();
  }
});

// Endpoint para criar o usuário do sistema
app.post('/api/system/create-user', async (req, res) => {
  const { connectionData, userConfig } = req.body;
  const { host, port, username, password } = connectionData;
  const { username: sysUsername, password: sysPassword } = userConfig;
  
  let connection;
  try {
    connection = await mysql.createConnection({
      host: host || 'localhost',
      port: port || 3306,
      user: username,
      password: password || '',
      connectionTimeout: 10000
    });
    
    // Criar o usuário do sistema
    await connection.query(`CREATE USER IF NOT EXISTS '${sysUsername}'@'localhost' IDENTIFIED BY ?`, [sysPassword]);
    await connection.query(`CREATE USER IF NOT EXISTS '${sysUsername}'@'%' IDENTIFIED BY ?`, [sysPassword]);
    
    // Dar privilégios ao usuário do sistema
    await connection.query(`GRANT ALL PRIVILEGES ON \`${SYSTEM_DATABASE}\`.* TO '${sysUsername}'@'localhost'`);
    await connection.query(`GRANT ALL PRIVILEGES ON \`${SYSTEM_DATABASE}\`.* TO '${sysUsername}'@'%'`);
    
    // Privilégios para operações administrativas básicas
    await connection.query(`GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX ON *.* TO '${sysUsername}'@'localhost'`);
    await connection.query(`GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX ON *.* TO '${sysUsername}'@'%'`);
    
    // Privilégios para gerenciar usuários (necessário para o jsMyAdmin funcionar)
    await connection.query(`GRANT CREATE USER, RELOAD ON *.* TO '${sysUsername}'@'localhost'`);
    await connection.query(`GRANT CREATE USER, RELOAD ON *.* TO '${sysUsername}'@'%'`);
    
    await connection.query('FLUSH PRIVILEGES');
    
    res.json({ success: true, message: `Usuário ${sysUsername} criado com sucesso.` });
  } catch (error) {
    console.error('Error creating system user:', error);
    res.status(500).json({ success: false, message: `Erro ao criar usuário: ${error.message}` });
  } finally {
    if (connection) await connection.end();
  }
});

// Endpoint para finalizar a configuração do sistema
app.post('/api/system/finalize-setup', async (req, res) => {
  const { systemUser, sessionSecretKey, language } = req.body;
  
  try {
    // Atualizar o arquivo .env com as novas configurações
    const envPath = path.join(__dirname, '../.env');
    let envContent = '';
    
    try {
      envContent = await fs.readFile(envPath, 'utf8');
    } catch (error) {
      // Se o arquivo .env não existir, criar um novo
      envContent = '';
    }
    
    // Atualizar ou adicionar as variáveis de ambiente
    const updateEnvVar = (content, key, value) => {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(content)) {
        return content.replace(regex, `${key}=${value}`);
      } else {
        return content + (content.endsWith('\n') || content === '' ? '' : '\n') + `${key}=${value}\n`;
      }
    };
    
    envContent = updateEnvVar(envContent, 'MYSQL_SYSTEM_USER', systemUser.username);
    envContent = updateEnvVar(envContent, 'MYSQL_SYSTEM_PASSWORD', systemUser.password);
    envContent = updateEnvVar(envContent, 'SESSION_SECRET_KEY', sessionSecretKey);
    
    // Salvar a preferência de idioma
    if (language) {
      envContent = updateEnvVar(envContent, 'DEFAULT_LANGUAGE', language);
    }
    
    // Garantir que temos o PORT se não estiver definido
    if (!envContent.includes('PORT=')) {
      envContent = updateEnvVar(envContent, 'PORT', '3001');
    }
    
    await fs.writeFile(envPath, envContent);
    
    // Recarregar as variáveis de ambiente
    require('dotenv').config({ override: true });
    
    // Atualizar as variáveis globais do servidor
    process.env.MYSQL_SYSTEM_USER = systemUser.username;
    process.env.MYSQL_SYSTEM_PASSWORD = systemUser.password;
    process.env.SESSION_SECRET_KEY = sessionSecretKey;
    if (language) {
      process.env.DEFAULT_LANGUAGE = language;
    }
    
    // Recriar a configuração do servidor em memória
    await reloadServerConfiguration();
    
    res.json({ 
      success: true, 
      message: 'Configuração inicial concluída com sucesso! As configurações foram aplicadas automaticamente.' 
    });
    
  } catch (error) {
    console.error('Error finalizing setup:', error);
    res.status(500).json({ success: false, message: `Erro ao finalizar configuração: ${error.message}` });
  }
});

// Função para recarregar a configuração do servidor
async function reloadServerConfiguration() {
  try {
    console.log('Reloading server configuration...');
    
    // Fechar o pool de conexões atual se existir
    if (systemDbPool) {
      await systemDbPool.end();
      console.log('Previous database pool closed.');
    }
    
    // Atualizar as variáveis globais
    MYSQL_SYSTEM_USER = process.env.MYSQL_SYSTEM_USER;
    MYSQL_SYSTEM_PASSWORD = process.env.MYSQL_SYSTEM_PASSWORD;
    SESSION_SECRET_KEY = process.env.SESSION_SECRET_KEY;
    envExists = true;
    
    // Recarregar a configuração do servidor
    await loadServerConfig();
    
    // Recriar o pool de conexões com as novas credenciais
    systemDbPool = mysql.createPool({
      host: serverConfig.database.host,
      port: serverConfig.database.port,
      user: serverConfig.database.username,
      password: serverConfig.database.password,
      waitForConnections: true,
      connectionLimit: serverConfig.database.maxConnections || 10,
      queueLimit: 0,
      timezone: '+00:00'
    });
    
    console.log('Server configuration reloaded successfully with new credentials.');
  } catch (error) {
    console.error('Error reloading server configuration:', error);
    throw error;
  }
}


// Initialize server configuration and then start the server
async function startServer() {
  try {
    await loadServerConfig();
    
    // Only initialize connection pool if we have system credentials
    if (MYSQL_SYSTEM_USER && MYSQL_SYSTEM_PASSWORD && serverConfig) {
      console.log("Initial serverConfig loaded:", serverConfig.database.username, serverConfig.database.password ? "password_set" : "password_not_set");
      systemDbPool = mysql.createPool({
        host: serverConfig.database.host,
        port: serverConfig.database.port,
        user: serverConfig.database.username,
        password: serverConfig.database.password,
        waitForConnections: true,
        connectionLimit: serverConfig.database.maxConnections || 10,
        queueLimit: 0,
        timezone: '+00:00'
      });
      console.log('Database connection pool initialized.');
    } else {
      console.log('Starting server in setup mode - no database pool initialized yet.');
    }

    // Start HTTP server
    const httpServer = http.createServer(app);
    httpServer.listen(PORT, () => {
      console.log(`HTTP Server running on port ${PORT}`);
      console.log(`HTTP API available at http://localhost:${PORT}/api`);
      if (!envExists) {
        console.log('🔧 Server is running in SETUP MODE - please complete the initial setup wizard.');
      }
    });

    // Start HTTPS server if SSL certificates are configured
    if (SSL_KEY_PATH && SSL_CERT_PATH) {
      try {
        const options = {
          key: await fs.readFile(SSL_KEY_PATH, 'utf8'),
          cert: await fs.readFile(SSL_CERT_PATH, 'utf8')
        };

        // Add CA certificate if provided (for intermediate certificates)
        if (SSL_CA_PATH) {
          options.ca = await fs.readFile(SSL_CA_PATH, 'utf8');
        }

        const httpsServer = https.createServer(options, app);
        httpsServer.listen(HTTPS_PORT, () => {
          console.log(`HTTPS Server running on port ${HTTPS_PORT}`);
          console.log(`HTTPS API available at https://localhost:${HTTPS_PORT}/api`);
        });
      } catch (sslError) {
        console.error('Failed to start HTTPS server:', sslError.message);
        console.log('Continuing with HTTP server only...');
      }
    } else {
      console.log('SSL certificates not configured - running HTTP server only');
      console.log('To enable HTTPS, set SSL_KEY_PATH and SSL_CERT_PATH in your .env file');
    }

  } catch (error) {
    console.error('Failed to start server due to configuration error:', error);
    // In setup mode, we should still start the server even if config loading fails
    if (!envExists) {
      console.log('Starting server in setup mode despite config error...');
      const httpServer = http.createServer(app);
      httpServer.listen(PORT, () => {
        console.log(`Server running on port ${PORT} (SETUP MODE)`);
        console.log(`API available at http://localhost:${PORT}/api`);
        console.log('🔧 Please complete the initial setup wizard.');
      });
    } else {
      process.exit(1);
    }
  }
}

startServer();

process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  if (systemDbPool) {
    await systemDbPool.end();
    console.log('Database connection pool closed.');
  }
  process.exit(0);
});
