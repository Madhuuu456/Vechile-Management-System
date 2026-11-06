# Madhu - Vehicle Service Management System

A website to manage customers, vehicles, services, bookings and payments.

**Built with:** HTML, CSS, JavaScript, Node.js, Express.js, MySQL

## Pages
Dashboard, Customers, Vehicles, Services, Bookings, Payments, Reports, About

## How to run on your computer

1. Install Node.js (https://nodejs.org) and MySQL Server.
2. Click the green **Code** button, then **Download ZIP**, and unzip it.
3. Open the folder in VS Code.
4. Open `config.js` and replace `your_mysql_password` with your MySQL password.
5. In the terminal, run: `npm install`
6. Then run: `npm start`
7. Open http://localhost:3000 in your browser.

The database `vehicle_service_db` and all tables are created automatically.

## Common problems
- Access denied: wrong password in config.js
- ECONNREFUSED: MySQL is not running
- Port in use: change appPort in config.js
- "scripts is disabled" in PowerShell: use Command Prompt, or run
  `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`
