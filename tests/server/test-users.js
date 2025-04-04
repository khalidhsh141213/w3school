import "dotenv/config";
import postgres from "postgres";

async function getUsers() {
  console.log("Getting users from database...");

  try {
    // Create a connection
    const sql = postgres(process.env.DATABASE_URL, { max: 1 });

    // Get users (avoid showing passwords in logs)
    const users = await sql`
      SELECT id, username, email, full_name, user_role
      FROM users
      LIMIT 5
    `;

    console.log("Users:");
    users.forEach((user) => {
      console.log(
        `- ${user.username} (${user.email}), ID: ${user.id}, Role: ${user.user_role}`,
      );
    });

    await sql.end();
  } catch (error) {
    console.error("Database query failed:", error);
  }
}

getUsers();
