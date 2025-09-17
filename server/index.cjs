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
      multipleStatements: config.security.allowMultipleStatements
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
      connectTimeout: config.database.connectionTimeout
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

// Get tables for a database
app.get('/api/databases/:database/tables', async (req, res) => {
  try {
    if (!connectionPool) {
      const config = await loadConfig();
      if (!config || !await createConnectionPool(config)) {
        return res.status(500).json({ error: 'Database connection not configured' });
      }
    }

    const { database } = req.params;
    
    const [tables] = await connectionPool.query(`SHOW TABLES FROM \`${database}\``);
    const [status] = await connectionPool.execute(`
      SELECT 
        table_name,
        table_rows,
        ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb,
        engine,
        table_collation
      FROM information_schema.tables 
      WHERE table_schema = ?
    `, [database]);

    const tableList = tables.map(table => {
      const tableName = Object.values(table)[0];
      const tableInfo = status.find(s => s.table_name === tableName);
      
      return {
        name: tableName,
        rows: tableInfo?.table_rows || 0,
        size: tableInfo?.size_mb ? `${tableInfo.size_mb} MB` : '0 MB',
        engine: tableInfo?.engine || 'Unknown',
        collation: tableInfo?.table_collation || 'Unknown'
      };
    });
    
    res.json(tableList);
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