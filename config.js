// ====== DATABASE SETTINGS ======
// Change the password below to YOUR MySQL password (the one you use in MySQL Workbench).
module.exports = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'your_mysql_password',   // <-- CHANGE THIS
  database: process.env.DB_NAME || 'vehicle_service_db',        // created automatically
  appPort: process.env.PORT || 3000
};
