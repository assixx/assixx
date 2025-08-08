const mysql = require("mysql2/promise");
require("dotenv").config();

async function setupDatabase() {
  let connection;

  try {
    console.info("Setting up database...");

    // First connect without database to create it if needed
    const config = {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
    };

    if (process.env.DB_PASSWORD && process.env.DB_PASSWORD.trim() !== "") {
      config.password = process.env.DB_PASSWORD;
    }

    console.info(`Connecting to MySQL with user: ${config.user}`);
    connection = await mysql.createConnection(config);

    // Check if database exists
    const [databases] = await connection.query("SHOW DATABASES");
    const databaseExists = databases.some(
      (db) => db.Database === process.env.DB_NAME,
    );

    if (!databaseExists) {
      console.info(`Creating database ${process.env.DB_NAME}...`);
      await connection.query(`CREATE DATABASE ${process.env.DB_NAME}`);
      console.info("Database created successfully!");
    } else {
      console.info(`Database ${process.env.DB_NAME} already exists.`);
    }

    // Connect to the database
    await connection.query(`USE ${process.env.DB_NAME}`);

    // Check and create tables
    await createTablesIfNotExist(connection);

    console.info("Database setup completed successfully!");
  } catch (error) {
    console.error("Error setting up database:", error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

async function createTablesIfNotExist(connection) {
  // Define the tables to create
  const tables = [
    {
      name: "users",
      createSQL: `CREATE TABLE users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        first_name VARCHAR(50),
        last_name VARCHAR(50),
        email VARCHAR(100) UNIQUE,
        role ENUM('root', 'admin', 'employee') NOT NULL DEFAULT 'employee',
        status ENUM('active', 'inactive') DEFAULT 'active',
        department_id INT,
        position VARCHAR(100),
        profile_picture VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
    },
    {
      name: "departments",
      createSQL: `CREATE TABLE departments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
    },
    {
      name: "documents",
      createSQL: `CREATE TABLE documents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(255) NOT NULL,
        category VARCHAR(50),
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status ENUM('active', 'archived', 'deleted') DEFAULT 'active',
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
    },
    {
      name: "admin_logs",
      createSQL: `CREATE TABLE admin_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        action VARCHAR(100) NOT NULL,
        details TEXT,
        ip_address VARCHAR(45),
        status VARCHAR(50),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
    },
  ];

  // Create each table if it doesn't exist
  for (const table of tables) {
    try {
      const [rows] = await connection.query(`SHOW TABLES LIKE '${table.name}'`);
      if (rows.length === 0) {
        console.info(`Creating table ${table.name}...`);
        await connection.query(table.createSQL);
        console.info(`Table ${table.name} created successfully!`);
      } else {
        console.info(`Table ${table.name} already exists.`);
      }
    } catch (error) {
      console.error(`Error creating table ${table.name}:`, error);
    }
  }

  // Check if we need to create a default admin user
  try {
    const [users] = await connection.query(
      'SELECT * FROM users WHERE role = "root" LIMIT 1',
    );
    if (users.length === 0) {
      console.info("Creating default root admin user...");
      // Generate a bcrypt hash for password "admin123"
      const bcrypt = require("bcrypt");
      const hashedPassword = await bcrypt.hash("admin123", 10);

      await connection.query(
        `
        INSERT INTO users
        (username, password, first_name, last_name, email, role)
        VALUES
        ('admin', ?, 'System', 'Administrator', 'admin@example.com', 'root')
      `,
        [hashedPassword],
      );

      console.info(
        "Default admin user created with username: admin and password: admin123",
      );
    } else {
      console.info("Root admin user already exists.");
    }
  } catch (error) {
    console.error("Error creating default admin user:", error);
  }
}

setupDatabase().catch(console.error);
