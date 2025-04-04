import "dotenv/config";
import { readFile, readdir } from "fs/promises";
import { resolve } from "path";
import postgres from "postgres";

// Function to retry operations with exponential backoff
async function withRetry(operation, maxRetries = 3, initialDelay = 1000) {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.error(
        `Attempt ${attempt + 1}/${maxRetries} failed:`,
        error.message,
      );
      lastError = error;

      // Wait with exponential backoff before retrying
      const delay = initialDelay * Math.pow(2, attempt);
      console.log(`Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// Original custom migration function
const main = async () => {
  console.log("Migration started...");

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  let sql;

  try {
    // Establish connection with shorter timeouts for Replit environment
    sql = postgres(process.env.DATABASE_URL, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      max_lifetime: 60 * 5,
    });

    // Get all migration files
    const migrationsDir = resolve(process.cwd(), "drizzle/migrations");
    console.log(`Looking for migrations in: ${migrationsDir}`);
    const files = await readdir(migrationsDir);
    console.log(`Found files in migrations directory:`, files);

    // Sort files to ensure they run in the correct order
    const migrationFiles = files
      .filter((file) => file.endsWith(".sql"))
      .sort((a, b) => {
        const numA = parseInt(a.split("_")[0]);
        const numB = parseInt(b.split("_")[0]);
        return numA - numB;
      });

    console.log(
      `Found ${migrationFiles.length} migration files:`,
      migrationFiles,
    );

    // Create migrations table if it doesn't exist
    await withRetry(async () => {
      await sql.unsafe(`
        CREATE TABLE IF NOT EXISTS migrations (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);
    });

    // Create drizzle_migrations table if it doesn't exist (needed for Drizzle ORM)
    await withRetry(async () => {
      await sql.unsafe(`
        CREATE TABLE IF NOT EXISTS drizzle_migrations (
          id SERIAL PRIMARY KEY,
          hash text NOT NULL,
          created_at timestamp with time zone DEFAULT now(),
          name text
        );
      `);
    });

    // Get list of already applied migrations
    const appliedMigrations = await withRetry(async () => {
      return await sql`SELECT name FROM migrations`;
    });

    const appliedMigrationNames = new Set(appliedMigrations.map((m) => m.name));
    console.log(
      `Already applied migrations:`,
      Array.from(appliedMigrationNames),
    );

    // Apply each migration that hasn't been applied yet
    for (const file of migrationFiles) {
      if (appliedMigrationNames.has(file)) {
        console.log(`Migration ${file} already applied, skipping`);
        continue;
      }

      console.log(`Applying migration: ${file}`);
      const migrationPath = resolve(migrationsDir, file);
      const migrationSql = await readFile(migrationPath, "utf-8");
      console.log(
        `Migration SQL content (first 100 chars): ${migrationSql.substring(0, 100)}...`,
      );

      // Generate a consistent hash for Drizzle
      const fileHash = Buffer.from(file).toString("base64").substring(0, 22);

      // Use a transaction for each migration with retry logic
      await withRetry(async () => {
        await sql.begin(async (sql) => {
          // Execute the migration
          await sql.unsafe(migrationSql);

          // Record this migration as applied
          await sql`INSERT INTO migrations (name) VALUES (${file})`;

          // Add a record in drizzle_migrations table as well with the name field
          await sql`INSERT INTO drizzle_migrations (hash, name) VALUES (${fileHash}, ${file})`;
        });
      });

      console.log(`Successfully applied migration: ${file}`);
    }

    console.log("All migrations completed successfully");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  } finally {
    if (sql) {
      await sql
        .end()
        .catch((err) => console.error("Error closing DB connection:", err));
    }
  }
};

// Replace the migrateDB function to use our custom migration system
export async function migrateDB() {
  console.log("Running database migrations...");

  // Get the database connection string from environment variables
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL not set in environment");
  }

  try {
    // Run the custom migration system with retry logic
    await withRetry(main, 5, 2000);
    console.log("Migrations completed successfully");
  } catch (error) {
    console.error("Migration failed after retries:", error);
    // Don't throw - let the server start anyway for Replit environment
    console.warn("Continuing server startup despite migration failure");
  }
}

// Check if file is being run directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch(console.error);
}
