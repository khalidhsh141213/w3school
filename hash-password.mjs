import crypto from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(crypto.scrypt);

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  const hashedPassword = `${buf.toString("hex")}.${salt}`;
  console.log(`Hashed password: ${hashedPassword}`);
  return hashedPassword;
}

async function main() {
  const password = "12345678";
  await hashPassword(password);
}

main().catch(console.error);
