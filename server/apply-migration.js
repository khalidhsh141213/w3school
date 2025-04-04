import postgres from "postgres";
import "dotenv/config";

async function applyMigration() {
  console.log("Applying economic events migration...");

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  let sql;

  try {
    // Establish connection
    sql = postgres(process.env.DATABASE_URL, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      max_lifetime: 60 * 5,
    });

    // Execute migration directly
    await sql.unsafe(`
      -- Add new columns to economic_events table
      ALTER TABLE economic_events ADD COLUMN IF NOT EXISTS event_time TEXT;
      ALTER TABLE economic_events ADD COLUMN IF NOT EXISTS country TEXT;
      ALTER TABLE economic_events ADD COLUMN IF NOT EXISTS source TEXT;
      ALTER TABLE economic_events ADD COLUMN IF NOT EXISTS source_id TEXT;
      ALTER TABLE economic_events ADD COLUMN IF NOT EXISTS actual_value TEXT;
      ALTER TABLE economic_events ADD COLUMN IF NOT EXISTS forecast_value TEXT;
      ALTER TABLE economic_events ADD COLUMN IF NOT EXISTS previous_value TEXT;
      ALTER TABLE economic_events ADD COLUMN IF NOT EXISTS affected_markets TEXT;
      ALTER TABLE economic_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL;
      ALTER TABLE economic_events ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL;

      -- Create indexes for better performance
      CREATE INDEX IF NOT EXISTS idx_economic_events_date ON economic_events(event_date);
      CREATE INDEX IF NOT EXISTS idx_economic_events_country ON economic_events(country);
      CREATE INDEX IF NOT EXISTS idx_economic_events_importance ON economic_events(importance_level);
      CREATE INDEX IF NOT EXISTS idx_economic_events_source ON economic_events(source);
    `);

    console.log("Economic events migration applied successfully");
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
}

applyMigration().catch(console.error);
