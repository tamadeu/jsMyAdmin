# phpMyAdmin Clone

A modern web-based MySQL administration tool built with React, TypeScript, and Node.js - a complete replacement for phpMyAdmin.

## Features

- 🗄️ **Database Management**: Browse databases, tables, and data
- 📝 **SQL Editor**: Execute SQL queries with syntax highlighting
- ⚙️ **Configuration**: Easy database connection setup
- 🎨 **Modern UI**: Dark/Light theme with responsive design
- 🔒 **Security**: SSL support and secure connections
- 📊 **Real-time Data**: Live database statistics and monitoring

## Prerequisites

- Node.js (v16 or higher)
- MySQL Server (v5.7 or higher)
- npm or yarn

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd phpmyadmin-clone
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your database credentials.

4. **Configure database connection**
   Edit `database-config.json` with your MySQL connection details:
   ```json
   {
     "database": {
       "host": "localhost",
       "port": 3306,
       "username": "root",
       "password": "your-password",
       "defaultDatabase": "mysql"
     }
   }
   ```

## Running the Application

### Development Mode

Run both frontend and backend simultaneously:
```bash
npm run dev:full
```

Or run them separately:

**Backend only:**
```bash
npm run server
```

**Frontend only:**
```bash
npm run dev
```

### Production Mode

1. **Build the frontend:**
   ```bash
   npm run build
   ```

2. **Start the server:**
   ```bash
   npm run server
   ```

## Usage

1. **Access the application** at `http://localhost:5173`
2. **Configure your database** connection in the Configuration tab
3. **Test the connection** to ensure it's working
4. **Browse databases** and tables in the sidebar
5. **Execute SQL queries** in the SQL Editor
6. **View and edit data** in the Browse Data section

## API Endpoints

- `POST /api/test-connection` - Test database connection
- `POST /api/save-config` - Save database configuration
- `GET /api/databases` - Get list of databases
- `GET /api/databases/:db/tables` - Get tables in a database
- `GET /api/databases/:db/tables/:table/data` - Get table data
- `POST /api/query` - Execute SQL query
- `GET /api/status` - Get server status

## Security Features

- SSL/TLS connection support
- Connection timeout configuration
- Query timeout limits
- Multiple statement control
- Local file access control

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Node.js, Express
- **Database**: MySQL with mysql2 driver
- **Build Tool**: Vite

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details