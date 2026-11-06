-- OPTIONAL: the server creates all of this automatically when it starts.
-- You can also run this file in MySQL Workbench if you want to see the tables yourself.
CREATE DATABASE IF NOT EXISTS vehicle_service_db;
USE vehicle_service_db;

CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(100),
  address VARCHAR(255)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS vehicles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  reg_number VARCHAR(20) NOT NULL UNIQUE,
  make VARCHAR(50) NOT NULL,
  model VARCHAR(50) NOT NULL,
  year INT,
  type VARCHAR(20) NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255),
  price DECIMAL(10,2) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vehicle_id INT NOT NULL,
  service_id INT NOT NULL,
  service_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Pending',
  notes VARCHAR(255),
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
  FOREIGN KEY (service_id) REFERENCES services(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  method VARCHAR(20) NOT NULL,
  pay_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Paid',
  FOREIGN KEY (booking_id) REFERENCES bookings(id)
) ENGINE=InnoDB;
