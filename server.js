const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const config = require('./config');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let pool;

// Wraps every route so errors are sent back as friendly messages
const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    console.error('Error:', err.message);
    let msg = err.sqlMessage || err.message;
    if (err.code === 'ER_DUP_ENTRY') msg = 'This record already exists (duplicate value).';
    if (err.code === 'ER_ROW_IS_REFERENCED_2') msg = 'Cannot delete: this record is used on other pages. Delete the related records first.';
    if (err.code === 'ER_NO_REFERENCED_ROW_2') msg = 'Please choose a valid related record.';
    if (err.code === 'ER_BAD_NULL_ERROR') msg = 'Please fill in all required fields.';
    res.status(400).json({ error: msg });
  }
};

const clean = (v) => (v === undefined || v === null || v === '' ? null : v);

// Builds GET / POST / PUT / DELETE routes for one table
function crud(route, table, fields, listSql) {
  app.get(`/api/${route}`, wrap(async (req, res) => {
    const [rows] = await pool.query(listSql);
    res.json(rows);
  }));

  app.post(`/api/${route}`, wrap(async (req, res) => {
    const values = fields.map((f) => clean(req.body[f]));
    const sql = `INSERT INTO ${table} (${fields.join(', ')}) VALUES (${fields.map(() => '?').join(', ')})`;
    const [result] = await pool.query(sql, values);
    res.json({ id: result.insertId });
  }));

  app.put(`/api/${route}/:id`, wrap(async (req, res) => {
    const values = fields.map((f) => clean(req.body[f]));
    const sql = `UPDATE ${table} SET ${fields.map((f) => f + ' = ?').join(', ')} WHERE id = ?`;
    await pool.query(sql, [...values, req.params.id]);
    res.json({ ok: true });
  }));

  app.delete(`/api/${route}/:id`, wrap(async (req, res) => {
    await pool.query(`DELETE FROM ${table} WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  }));
}

const BOOKING_BASE = `
  SELECT b.*, v.reg_number, c.name AS customer_name, s.name AS service_name, s.price
  FROM bookings b
  JOIN vehicles v ON v.id = b.vehicle_id
  JOIN customers c ON c.id = v.customer_id
  JOIN services s ON s.id = b.service_id`;

async function setupDatabase() {
  // Step 1: connect to MySQL (without a database) and create our database
  const first = await mysql.createConnection({
    host: config.host, port: config.port, user: config.user, password: config.password
  });
  await first.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\``);
  await first.end();

  // Step 2: connect to our database
  pool = mysql.createPool({
    host: config.host, port: config.port, user: config.user, password: config.password,
    database: config.database, waitForConnections: true, connectionLimit: 10,
    dateStrings: true
  });

  // Step 3: create the tables if they do not exist
  await pool.query(`CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(100),
    address VARCHAR(255)
  ) ENGINE=InnoDB`);

  await pool.query(`CREATE TABLE IF NOT EXISTS vehicles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    reg_number VARCHAR(20) NOT NULL UNIQUE,
    make VARCHAR(50) NOT NULL,
    model VARCHAR(50) NOT NULL,
    year INT,
    type VARCHAR(20) NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  ) ENGINE=InnoDB`);

  await pool.query(`CREATE TABLE IF NOT EXISTS services (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    price DECIMAL(10,2) NOT NULL
  ) ENGINE=InnoDB`);

  await pool.query(`CREATE TABLE IF NOT EXISTS bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id INT NOT NULL,
    service_id INT NOT NULL,
    service_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Pending',
    notes VARCHAR(255),
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
    FOREIGN KEY (service_id) REFERENCES services(id)
  ) ENGINE=InnoDB`);

  await pool.query(`CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    method VARCHAR(20) NOT NULL,
    pay_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Paid',
    FOREIGN KEY (booking_id) REFERENCES bookings(id)
  ) ENGINE=InnoDB`);

  // Step 4: add a few starter services (only the first time)
  const [[row]] = await pool.query('SELECT COUNT(*) AS n FROM services');
  if (row.n === 0) {
    await pool.query(
      'INSERT INTO services (name, description, price) VALUES ?',
      [[
        ['General Service', 'Oil change, filter check and washing', 1500],
        ['Oil Change', 'Engine oil and oil filter replacement', 800],
        ['Brake Repair', 'Brake pad and brake oil check/replacement', 1200],
        ['Tyre Replacement', 'Tyre fitting and wheel balancing', 3000],
        ['Battery Replacement', 'New battery with fitting', 4500]
      ]]
    );
  }
}

crud('customers', 'customers', ['name', 'phone', 'email', 'address'],
  'SELECT * FROM customers ORDER BY id DESC');

crud('vehicles', 'vehicles', ['customer_id', 'reg_number', 'make', 'model', 'year', 'type'],
  `SELECT v.*, c.name AS customer_name FROM vehicles v
   JOIN customers c ON c.id = v.customer_id ORDER BY v.id DESC`);

crud('services', 'services', ['name', 'description', 'price'],
  'SELECT * FROM services ORDER BY id DESC');

crud('bookings', 'bookings', ['vehicle_id', 'service_id', 'service_date', 'status', 'notes'],
  BOOKING_BASE + ' ORDER BY b.id DESC');

crud('payments', 'payments', ['booking_id', 'amount', 'method', 'pay_date', 'status'],
  `SELECT p.*, v.reg_number, c.name AS customer_name, s.name AS service_name
   FROM payments p
   JOIN bookings b ON b.id = p.booking_id
   JOIN vehicles v ON v.id = b.vehicle_id
   JOIN customers c ON c.id = v.customer_id
   JOIN services s ON s.id = b.service_id
   ORDER BY p.id DESC`);

// Numbers for the dashboard and reports page
app.get('/api/stats', wrap(async (req, res) => {
  const count = async (sql) => (await pool.query(sql))[0][0].n;
  const list = async (sql) => (await pool.query(sql))[0];

  res.json({
    customers: await count('SELECT COUNT(*) AS n FROM customers'),
    vehicles: await count('SELECT COUNT(*) AS n FROM vehicles'),
    services: await count('SELECT COUNT(*) AS n FROM services'),
    bookings: await count('SELECT COUNT(*) AS n FROM bookings'),
    activeBookings: await count("SELECT COUNT(*) AS n FROM bookings WHERE status IN ('Pending','In Progress')"),
    revenue: await count("SELECT COALESCE(SUM(amount),0) AS n FROM payments WHERE status = 'Paid'"),
    pendingPayments: await count("SELECT COALESCE(SUM(amount),0) AS n FROM payments WHERE status = 'Pending'"),
    recent: await list(BOOKING_BASE + ' ORDER BY b.id DESC LIMIT 5'),
    byStatus: await list('SELECT status, COUNT(*) AS c FROM bookings GROUP BY status'),
    topServices: await list(`SELECT s.name, COUNT(b.id) AS c FROM services s
      LEFT JOIN bookings b ON b.service_id = s.id GROUP BY s.id, s.name ORDER BY c DESC, s.name LIMIT 5`),
    monthly: await list(`SELECT DATE_FORMAT(pay_date, '%Y-%m') AS m, SUM(amount) AS total
      FROM payments WHERE status = 'Paid' GROUP BY DATE_FORMAT(pay_date, '%Y-%m')
      ORDER BY m DESC LIMIT 6`)
  });
}));

setupDatabase()
  .then(() => {
    app.listen(config.appPort, () => {
      console.log('');
      console.log('  Madhu Vehicle Service Management System is running!');
      console.log(`  Open this in your browser:  http://localhost:${config.appPort}`);
      console.log('');
    });
  })
  .catch((err) => {
    console.error('\nCould not connect to MySQL: ' + err.message);
    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('-> Your MySQL user or password is wrong. Open config.js and change the password.');
    } else if (err.code === 'ECONNREFUSED') {
      console.error('-> MySQL is not running. Start the MySQL server first, then run again.');
    }
    process.exit(1);
  });
