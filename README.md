# Madhu - Vehicle Service Management System

HTML + CSS + JavaScript (front end), Node.js + Express (back end), MySQL (database).

## How to run (step by step)

1. Install Node.js (https://nodejs.org) and make sure MySQL Server is running.
2. Unzip this folder and open it in VS Code (or open a terminal inside it).
3. Open `config.js` and change `your_mysql_password` to your real MySQL password.
4. In the terminal, run:  `npm install`
5. Then run:  `npm start`
6. Open your browser:  http://localhost:3000

The database `vehicle_service_db` and all tables are created automatically.
(`database.sql` is optional - only if you want to create them yourself in MySQL Workbench.)

## Pages
index (Dashboard), customers, vehicles, services, bookings, payments, reports, about

## Problems?
- "Access denied"  -> wrong password in config.js
- "ECONNREFUSED"   -> MySQL server is not running
- "Port in use"    -> change appPort in config.js (e.g. 3001)
