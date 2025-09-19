const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

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

async function loadConfig() {
  try {
    const configPath = path.join(__dirname, '../database-config.json');
    const configData = await fs.readFile(configPath, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    console.error('Error loading config:', error);
    return null;
  }
}

async function createConnectionFromRequest(req) {
  const baseConfig = await loadConfig();
  if (!baseConfig) {
    throw new Error('Server configuration file not found.');
  }

  const dbUser = req.headers['x-db-user'];
  const dbPassword = req.headers['x-db-password'];
  const dbHost = req.headers['x-db-host'];

  if (!dbUser || !dbHost) {
    throw new Error('Authentication credentials not provided in headers.');
  }

  const userConfig = {
    host: baseConfig.database.host,
    port: baseConfig.database.port,
    user: dbUser,
    password: dbPassword,
    host_user: dbHost,
    charset: baseConfig.database.charset,
    ssl: baseConfig.database.ssl ? {
      ca: baseConfig.database.sslCA || undefined,
      cert: baseConfig.database.sslCertificate || undefined,
      key: baseConfig.database.sslKey || undefined,
    } : false,
    multipleStatements: baseConfig.security.allowMultipleStatements,
    timezone: '+00:00'
  };

  return mysql.createConnection(userConfig);
}

// Login endpoint
app.post('/api/login', async (req, res) => {
  let connection;
  try {
    const { username, password, host } = req.body;
    const baseConfig = await loadConfig();
    if (!baseConfig) {
      return res.status(500).json({ success: false, message: 'Server configuration not found.' });
    }

    connection = await mysql.createConnection({
      host: baseConfig.database.host,
      port: baseConfig.database.port,
      user: username,
      password: password,
      host_user: host,
      connectTimeout: 5000,
      timezone: '+00:00'
    });

    await connection.execute('SELECT 1');

    // Fetch global privileges
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

    if (hasGrantOption) {
      globalPrivileges.add('GRANT OPTION');
    }

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
      success: true, 
      message: 'Login successful',
      user: {
        username: username,
        host: host,
        globalPrivileges: finalPrivileges
      }
    });
  } catch (error) {
    console.error('Login failed:', error);
    res.status(401).json({ success: false, message: error.message });
  } finally {
    if (connection) {
      await connection.end();
    }
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
      await testConnection.end();
    }
  }
});

// Save configuration (file operation, no DB connection needed here)
app.post('/api/save-config', async (req, res) => {
  try {
    const config = req.body;
    const configPath = path.join(__dirname, '../database-config.json');
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
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
app.get('/api/databases', async (req, res) => {
  let connection;
  try {
    connection = await createConnectionFromRequest(req);
    const [rows] = await connection.query('SHOW DATABASES');
    const databases = rows.map(row => row.Database);
    res.json(databases);
  } catch (error) {
    console.error('Error fetching databases:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

// Get tables and views for a database
app.get('/api/databases/:database/tables', async (req, res) => {
  let connection;
  try {
    connection = await createConnectionFromRequest(req);
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
    if (connection) await connection.end();
  }
});

// Get table data
app.get('/api/databases/:database/tables/:table/data', async (req, res) => {
  let connection;
  try {
    connection = await createConnectionFromRequest(req);
    const { database, table } = req.params;
    const { limit = 25, offset = 0, search = '' } = req.query;
    
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
    const dataQuery = `SELECT * FROM \`${table}\` ${whereClause} LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;
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
    if (connection) await connection.end();
  }
});

// Update a single cell
app.put('/api/databases/:database/tables/:table/cell', async (req, res) => {
  let connection;
  try {
    connection = await createConnectionFromRequest(req);
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
    if (connection) await connection.end();
  }
});

// Update entire row
app.put('/api/databases/:database/tables/:table/row', async (req, res) => {
  let connection;
  try {
    connection = await createConnectionFromRequest(req);
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
    if (connection) await connection.end();
  }
});

// Insert new row
app.post('/api/databases/:database/tables/:table/row', async (req, res) => {
  let connection;
  try {
    connection = await createConnectionFromRequest(req);
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
    if (connection) await connection.end();
  }
});

// Delete row
app.delete('/api/databases/:database/tables/:table/row', async (req, res) => {
  let connection;
  try {
    connection = await createConnectionFromRequest(req);
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
    if (connection) await connection.end();
  }
});

// Execute SQL query
app.post('/api/query', async (req, res) => {
  let connection;
  try {
    connection = await createConnectionFromRequest(req);
    const { query, database } = req.body;
    if (!query) return res.status(400).json({ error: 'Query is required' });

    if (database) await connection.query(`USE \`${database}\``);

    const startTime = Date.now();
    const [rows, fields] = await connection.query(query);
    const executionTime = Date.now() - startTime;

    if (query.trim().toLowerCase().startsWith('select')) {
      res.json({
        success: true, data: rows,
        fields: fields?.map(f => ({ name: f.name, type: f.type, table: f.table })) || [],
        rowCount: Array.isArray(rows) ? rows.length : 0,
        executionTime: `${executionTime}ms`
      });
    } else {
      res.json({
        success: true, message: `Query executed successfully. ${rows.affectedRows || 0} rows affected.`,
        affectedRows: rows.affectedRows || 0, executionTime: `${executionTime}ms`
      });
    }
  } catch (error) {
    console.error('Error executing query:', error);
    res.status(400).json({ success: false, error: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

// Get server status
app.get('/api/status', async (req, res) => {
  let connection;
  try {
    connection = await createConnectionFromRequest(req);
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
    if (connection) await connection.end();
  }
});

// Get MySQL users
app.get('/api/users', async (req, res) => {
  let connection;
  try {
    connection = await createConnectionFromRequest(req);
    const [rows] = await connection.query("SELECT user, host FROM mysql.user ORDER BY user, host");
    res.json(rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

// Get user privileges (global and database-specific)
app.get('/api/users/:user/:host/privileges', async (req, res) => {
  let connection;
  try {
    connection = await createConnectionFromRequest(req);
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
    if (connection) await connection.end();
  }
});

// Update global user privileges
app.post('/api/users/:user/:host/privileges', async (req, res) => {
  let connection;
  try {
    connection = await createConnectionFromRequest(req);
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
    if (connection) await connection.end();
  }
});

// Update/Add database privileges
app.post('/api/users/:user/:host/database-privileges', async (req, res) => {
  let connection;
  try {
    connection = await createConnectionFromRequest(req);
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
    if (connection) await connection.end();
  }
});

// Revoke all privileges on a database
app.delete('/api/users/:user/:host/database-privileges', async (req, res) => {
  let connection;
  try {
    connection = await createConnectionFromRequest(req);
    const { user, host } = req.params;
    const { database } = req.body;

    await connection.query('REVOKE ALL PRIVILEGES, GRANT OPTION ON `??`.* FROM ?@?', [database, user, host]);
    
    res.json({ success: true, message: 'Database privileges revoked' });
  } catch (error) {
    console.error('Error revoking database privileges:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
});

process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  process.exit(0);
});