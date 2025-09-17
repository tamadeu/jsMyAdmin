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

// Global connection pool
let connectionPool = null;

// Helper function to convert JavaScript dates to MySQL format
function convertDateForMySQL(value) {
  if (value === null || value === undefined) {
    return null;
  }
  
  // If it's already a string that looks like a MySQL datetime, return as is
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    return value;
  }
  
  // Only convert if it's clearly an ISO date string (contains T and Z)
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/.test(value)) {
    try {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        return value; // Return original if not a valid date
      }
      
      // Convert to MySQL datetime format (YYYY-MM-DD HH:MM:SS)
      return date.toISOString().slice(0, 19).replace('T', ' ');
    } catch (error) {
      return value; // Return original if conversion fails
    }
  }
  
  // If it's a Date object, convert it
  if (value instanceof Date) {
    try {
      if (isNaN(value.getTime())) {
        return value; // Return original if not a valid date
      }
      
      // Convert to MySQL datetime format (YYYY-MM-DD HH:MM:SS)
      return value.toISOString().slice(0, 19).replace('T', ' ');
    } catch (error) {
      return value; // Return original if conversion fails
    }
  }
  
  // For all other cases (strings, numbers, etc.), return as is
  return value;
}

// Helper function to process data object for MySQL
function processDataForMySQL(data) {
  const processedData = {};
  
  for (const [key, value] of Object.entries(data)) {
    processedData[key] = convertDateForMySQL(value);
  }
  
  return processedData;
}

// Load database configuration
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

// Create connection pool
async function createConnectionPool(config) {
  try {
    if (connectionPool) {
      await connectionPool.end();
    }

    connectionPool = mysql.createPool({
      host: config.database.host,
      port: config.database.port,
      user: config.database.username,
      password: config.database.password,
      database: config.database.defaultDatabase,
      charset: config.database.charset,
      connectionLimit: config.database.maxConnections,
      ssl: config.database.ssl ? {
        ca: config.database.sslCA || undefined,
        cert: config.database.sslCertificate || undefined,
        key: config.database.sslKey || undefined,
      } : false,
      multipleStatements: config.security.allowMultipleStatements,
      timezone: '+00:00' // Use UTC timezone
    });

    return true;
  } catch (error) {
    console.error('Error creating connection pool:', error);
    return false;
  }
}

// Test database connection
app.post('/api/test-connection', async (req, res) => {
  try {
    const config = req.body;
    
    // Create temporary connection for testing
    const testConnection = mysql.createConnection({
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
    await testConnection.end();

    res.json({ success: true, message: 'Connection successful' });
  } catch (error) {
    console.error('Connection test failed:', error);
    res.status(400).json({ 
      success: false, 
      message: error.message || 'Connection failed' 
    });
  }
});

// Save configuration
app.post('/api/save-config', async (req, res) => {
  try {
    const config = req.body;
    const configPath = path.join(__dirname, '../database-config.json');
    
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    
    // Recreate connection pool with new config
    await createConnectionPool(config);
    
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
  try {
    if (!connectionPool) {
      const config = await loadConfig();
      if (!config || !await createConnectionPool(config)) {
        return res.status(500).json({ error: 'Database connection not configured' });
      }
    }

    const [rows] = await connectionPool.query('SHOW DATABASES');
    const databases = rows.map(row => row.Database);
    
    res.json(databases);
  } catch (error) {
    console.error('Error fetching databases:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get tables and views for a database
app.get('/api/databases/:database/tables', async (req, res) => {
  try {
    if (!connectionPool) {
      const config = await loadConfig();
      if (!config || !await createConnectionPool(config)) {
        return res.status(500).json({ error: 'Database connection not configured' });
      }
    }

    const { database } = req.params;
    
    // Get detailed information about tables and views
    const [tablesAndViews] = await connectionPool.execute(`
      SELECT 
        TABLE_NAME as table_name,
        TABLE_TYPE as table_type,
        TABLE_ROWS as table_rows,
        ROUND(((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024), 2) AS size_mb,
        ENGINE as engine,
        TABLE_COLLATION as table_collation
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_TYPE, TABLE_NAME
    `, [database]);

    // Separate tables and views
    const tables = [];
    const views = [];

    tablesAndViews.forEach(item => {
      const tableInfo = {
        name: item.table_name,
        rows: item.table_rows || 0,
        size: item.size_mb ? `${item.size_mb} MB` : '0 MB',
        engine: item.engine || 'N/A',
        collation: item.table_collation || 'Unknown'
      };

      if (item.table_type === 'VIEW') {
        views.push(tableInfo);
      } else if (item.table_type === 'BASE TABLE') {
        tables.push(tableInfo);
      } else {
        // Fallback for other types, treat as table
        tables.push(tableInfo);
      }
    });
    
    const result = {
      tables,
      views,
      totalTables: tables.length,
      totalViews: views.length
    };
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching tables:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get table data with column filters
app.get('/api/databases/:database/tables/:table/data', async (req, res) => {
  try {
    if (!connectionPool) {
      const config = await loadConfig();
      if (!config || !await createConnectionPool(config)) {
        return res.status(500).json({ error: 'Database connection not configured' });
      }
    }

    const { database, table } = req.params;
    const { limit = 25, offset = 0, search = '' } = req.query;
    
    // Extract column filters from query parameters
    const columnFilters = {};
    Object.keys(req.query).forEach(key => {
      if (key.startsWith('filter_')) {
        const columnName = key.replace('filter_', '');
        const filterValue = req.query[key];
        if (filterValue && filterValue.trim()) {
          columnFilters[columnName] = filterValue.trim();
        }
      }
    });
    
    // Get a connection from the pool
    const connection = await connectionPool.getConnection();
    
    try {
      // Switch to the specific database
      await connection.query(`USE \`${database}\``);
      
      // Get table structure
      const [columns] = await connection.query(`DESCRIBE \`${table}\``);
      
      // Build WHERE clause
      const whereConditions = [];
      const queryParams = [];
      
      // Add search condition (global search across all columns)
      if (search && search.trim()) {
        const concatColumns = columns.map(col => `COALESCE(\`${col.Field}\`, '')`).join(', ');
        whereConditions.push(`CONCAT(${concatColumns}) LIKE ?`);
        queryParams.push(`%${search}%`);
      }
      
      // Add column-specific filters
      Object.entries(columnFilters).forEach(([columnName, filterValue]) => {
        // Verify column exists
        const columnExists = columns.some(col => col.Field === columnName);
        if (columnExists) {
          whereConditions.push(`\`${columnName}\` LIKE ?`);
          queryParams.push(`%${filterValue}%`);
        }
      });
      
      // Build final query
      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
      
      const dataQuery = `SELECT * FROM \`${table}\` ${whereClause} LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;
      const countQuery = `SELECT COUNT(*) as total FROM \`${table}\` ${whereClause}`;
      
      // Execute queries
      const [rows] = await connection.query(dataQuery, queryParams);
      const [countResult] = await connection.query(countQuery, queryParams);
      
      res.json({
        columns: columns.map(col => ({
          name: col.Field,
          type: col.Type,
          null: col.Null === 'YES',
          key: col.Key,
          default: col.Default,
          extra: col.Extra
        })),
        data: rows,
        total: countResult[0].total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
    } finally {
      // Always release the connection back to the pool
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching table data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update a single cell
app.put('/api/databases/:database/tables/:table/cell', async (req, res) => {
  try {
    if (!connectionPool) {
      const config = await loadConfig();
      if (!config || !await createConnectionPool(config)) {
        return res.status(500).json({ error: 'Database connection not configured' });
      }
    }

    const { database, table } = req.params;
    const { primaryKey, columnName, newValue } = req.body;

    if (!primaryKey || !columnName) {
      return res.status(400).json({ error: 'Primary key and column name are required' });
    }

    const connection = await connectionPool.getConnection();
    
    try {
      await connection.query(`USE \`${database}\``);
      
      // Get table structure to find primary key column
      const [columns] = await connection.query(`DESCRIBE \`${table}\``);
      const pkColumn = columns.find(col => col.Key === 'PRI');
      
      if (!pkColumn) {
        return res.status(400).json({ error: 'Table has no primary key' });
      }

      // Convert date values if needed
      const processedValue = convertDateForMySQL(newValue);

      // Build UPDATE query
      const updateQuery = `UPDATE \`${table}\` SET \`${columnName}\` = ? WHERE \`${pkColumn.Field}\` = ?`;
      const [result] = await connection.execute(updateQuery, [processedValue, primaryKey]);

      res.json({
        success: true,
        message: `Cell updated successfully`,
        affectedRows: result.affectedRows
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error updating cell:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update entire row
app.put('/api/databases/:database/tables/:table/row', async (req, res) => {
  try {
    if (!connectionPool) {
      const config = await loadConfig();
      if (!config || !await createConnectionPool(config)) {
        return res.status(500).json({ error: 'Database connection not configured' });
      }
    }

    const { database, table } = req.params;
    const { primaryKey, data } = req.body;

    if (!primaryKey || !data) {
      return res.status(400).json({ error: 'Primary key and data are required' });
    }

    const connection = await connectionPool.getConnection();
    
    try {
      await connection.query(`USE \`${database}\``);
      
      // Get table structure to find primary key column
      const [columns] = await connection.query(`DESCRIBE \`${table}\``);
      const pkColumn = columns.find(col => col.Key === 'PRI');
      
      if (!pkColumn) {
        return res.status(400).json({ error: 'Table has no primary key' });
      }

      // Process data for MySQL compatibility
      const processedData = processDataForMySQL(data);

      // Build UPDATE query
      const setClause = Object.keys(processedData)
        .filter(key => key !== pkColumn.Field) // Don't update PK
        .map(key => `\`${key}\` = ?`)
        .join(', ');
      
      const values = Object.keys(processedData)
        .filter(key => key !== pkColumn.Field)
        .map(key => processedData[key]);
      
      const updateQuery = `UPDATE \`${table}\` SET ${setClause} WHERE \`${pkColumn.Field}\` = ?`;
      
      const [result] = await connection.execute(updateQuery, [...values, primaryKey]);

      res.json({
        success: true,
        message: `Row updated successfully`,
        affectedRows: result.affectedRows
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error updating row:', error);
    res.status(500).json({ error: error.message });
  }
});

// Insert new row (copy)
app.post('/api/databases/:database/tables/:table/row', async (req, res) => {
  try {
    if (!connectionPool) {
      const config = await loadConfig();
      if (!config || !await createConnectionPool(config)) {
        return res.status(500).json({ error: 'Database connection not configured' });
      }
    }

    const { database, table } = req.params;
    const { data } = req.body;

    if (!data) {
      return res.status(400).json({ error: 'Data is required' });
    }

    const connection = await connectionPool.getConnection();
    
    try {
      await connection.query(`USE \`${database}\``);
      
      // Get table structure
      const [columns] = await connection.query(`DESCRIBE \`${table}\``);
      const pkColumn = columns.find(col => col.Key === 'PRI');
      
      // Process data for MySQL compatibility
      let processedData = processDataForMySQL(data);
      
      // Remove primary key from data if it's auto increment
      if (pkColumn && pkColumn.Extra.includes('auto_increment')) {
        delete processedData[pkColumn.Field];
      }

      // Filter out any undefined or empty values that shouldn't be inserted
      const insertData = {};
      Object.entries(processedData).forEach(([key, value]) => {
        if (value !== undefined) {
          insertData[key] = value;
        }
      });

      if (Object.keys(insertData).length === 0) {
        return res.status(400).json({ error: 'No valid data to insert' });
      }

      // Build INSERT query
      const columnNames = Object.keys(insertData).map(key => `\`${key}\``).join(', ');
      const placeholders = Object.keys(insertData).map(() => '?').join(', ');
      const values = Object.values(insertData);
      
      const insertQuery = `INSERT INTO \`${table}\` (${columnNames}) VALUES (${placeholders})`;
      
      const [result] = await connection.execute(insertQuery, values);

      res.json({
        success: true,
        message: `Row inserted successfully`,
        insertId: result.insertId,
        affectedRows: result.affectedRows
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error inserting row:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete row
app.delete('/api/databases/:database/tables/:table/row', async (req, res) => {
  try {
    if (!connectionPool) {
      const config = await loadConfig();
      if (!config || !await createConnectionPool(config)) {
        return res.status(500).json({ error: 'Database connection not configured' });
      }
    }

    const { database, table } = req.params;
    const { primaryKey } = req.body;

    if (!primaryKey) {
      return res.status(400).json({ error: 'Primary key is required' });
    }

    const connection = await connectionPool.getConnection();
    
    try {
      await connection.query(`USE \`${database}\``);
      
      // Get table structure to find primary key column
      const [columns] = await connection.query(`DESCRIBE \`${table}\``);
      const pkColumn = columns.find(col => col.Key === 'PRI');
      
      if (!pkColumn) {
        return res.status(400).json({ error: 'Table has no primary key' });
      }

      // Build DELETE query
      const deleteQuery = `DELETE FROM \`${table}\` WHERE \`${pkColumn.Field}\` = ?`;
      const [result] = await connection.execute(deleteQuery, [primaryKey]);

      res.json({
        success: true,
        message: `Row deleted successfully`,
        affectedRows: result.affectedRows
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error deleting row:', error);
    res.status(500).json({ error: error.message });
  }
});

// Execute SQL query
app.post('/api/query', async (req, res) => {
  try {
    if (!connectionPool) {
      const config = await loadConfig();
      if (!config || !await createConnectionPool(config)) {
        return res.status(500).json({ error: 'Database connection not configured' });
      }
    }

    const { query, database } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Get a connection from the pool
    const connection = await connectionPool.getConnection();
    
    try {
      // Switch to database if specified
      if (database) {
        await connection.query(`USE \`${database}\``);
      }

      const startTime = Date.now();
      
      // Use query() for most SQL commands
      const [rows, fields] = await connection.query(query);
      const executionTime = Date.now() - startTime;

      // Determine if it's a SELECT query
      const isSelect = query.trim().toLowerCase().startsWith('select');
      
      if (isSelect) {
        res.json({
          success: true,
          data: rows,
          fields: fields?.map(field => ({
            name: field.name,
            type: field.type,
            table: field.table
          })) || [],
          rowCount: Array.isArray(rows) ? rows.length : 0,
          executionTime: `${executionTime}ms`
        });
      } else {
        res.json({
          success: true,
          message: `Query executed successfully. ${rows.affectedRows || 0} rows affected.`,
          affectedRows: rows.affectedRows || 0,
          executionTime: `${executionTime}ms`
        });
      }
    } finally {
      // Always release the connection back to the pool
      connection.release();
    }
  } catch (error) {
    console.error('Error executing query:', error);
    res.status(400).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get server status
app.get('/api/status', async (req, res) => {
  try {
    if (!connectionPool) {
      const config = await loadConfig();
      if (!config || !await createConnectionPool(config)) {
        return res.status(500).json({ error: 'Database connection not configured' });
      }
    }

    const [variables] = await connectionPool.query('SHOW VARIABLES LIKE "version"');
    const [status] = await connectionPool.query('SHOW STATUS LIKE "Uptime"');
    const [processes] = await connectionPool.query('SHOW PROCESSLIST');

    res.json({
      version: variables[0]?.Value || 'Unknown',
      uptime: status[0]?.Value || '0',
      connections: processes.length,
      status: 'connected'
    });
  } catch (error) {
    console.error('Error fetching server status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Initialize server
async function startServer() {
  try {
    // Load initial configuration
    const config = await loadConfig();
    if (config) {
      await createConnectionPool(config);
      console.log('Database connection pool initialized');
    }

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`API available at http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('Error starting server:', error);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  if (connectionPool) {
    await connectionPool.end();
  }
  process.exit(0);
});

startServer();