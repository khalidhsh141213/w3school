import crypto from "crypto";
import { promisify } from "util";
import postgres from "postgres";
import dotenv from "dotenv";

// تحميل المتغيرات البيئية
dotenv.config();

const scryptAsync = promisify(crypto.scrypt);

/**
 * أداة إدارة المستخدمين - تتيح إدارة حسابات المستخدمين بسهولة
 * - تغيير كلمات المرور
 * - تعيين صلاحيات المستخدمين
 * - تفعيل/تعطيل الحسابات
 */

// دالة لتشفير كلمة المرور بنفس خوارزمية auth.ts
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  const hashedPassword = `${buf.toString("hex")}.${salt}`;
  return hashedPassword;
}

// إنشاء اتصال بقاعدة البيانات
const sql = postgres(process.env.DATABASE_URL);

// أداة تغيير كلمة المرور
async function changeUserPassword(username, newPassword) {
  try {
    // البحث عن المستخدم
    const users =
      await sql`SELECT id, username FROM users WHERE username = ${username}`;

    if (users.length === 0) {
      console.error(`المستخدم ${username} غير موجود`);
      return false;
    }

    // تشفير كلمة المرور الجديدة
    const hashedPassword = await hashPassword(newPassword);

    // تحديث كلمة المرور
    await sql`UPDATE users SET password = ${hashedPassword} WHERE username = ${username}`;

    console.log(`✅ تم تحديث كلمة مرور المستخدم ${username} بنجاح`);
    return true;
  } catch (error) {
    console.error("❌ خطأ في تغيير كلمة المرور:", error);
    return false;
  }
}

// أداة تعيين صلاحيات المستخدم
async function setUserRole(username, role) {
  if (!["user", "admin", "moderator", "analyst"].includes(role)) {
    console.error(
      "❌ نوع المستخدم غير صالح. الأنواع المتاحة: user, admin, moderator, analyst",
    );
    return false;
  }

  try {
    // البحث عن المستخدم
    const users =
      await sql`SELECT id, username FROM users WHERE username = ${username}`;

    if (users.length === 0) {
      console.error(`المستخدم ${username} غير موجود`);
      return false;
    }

    // تحديث نوع المستخدم
    await sql`UPDATE users SET user_role = ${role} WHERE username = ${username}`;

    console.log(`✅ تم تحديث صلاحيات المستخدم ${username} إلى ${role} بنجاح`);
    return true;
  } catch (error) {
    console.error("❌ خطأ في تعيين صلاحيات المستخدم:", error);
    return false;
  }
}

// أداة تفعيل/تعطيل الحساب
async function setUserVerificationStatus(username, status) {
  if (!["pending", "verified", "rejected", "disabled"].includes(status)) {
    console.error(
      "❌ حالة الحساب غير صالحة. الحالات المتاحة: pending, verified, rejected, disabled",
    );
    return false;
  }

  try {
    // البحث عن المستخدم
    const users =
      await sql`SELECT id, username FROM users WHERE username = ${username}`;

    if (users.length === 0) {
      console.error(`المستخدم ${username} غير موجود`);
      return false;
    }

    // تحديث حالة الحساب
    const is_verified = status === "verified";
    await sql`
      UPDATE users 
      SET 
        verification_status = ${status},
        is_verified = ${is_verified}
      WHERE username = ${username}
    `;

    console.log(
      `✅ تم تحديث حالة حساب المستخدم ${username} إلى ${status} بنجاح`,
    );
    return true;
  } catch (error) {
    console.error("❌ خطأ في تعيين حالة الحساب:", error);
    return false;
  }
}

// عرض قائمة المستخدمين
async function listUsers() {
  try {
    const users = await sql`
      SELECT 
        id, 
        username, 
        email, 
        user_role, 
        verification_status, 
        is_verified,
        created_at
      FROM users
      ORDER BY id
    `;

    console.log("\n📋 قائمة المستخدمين:");
    console.log("--------------------------------------------------");
    users.forEach((user) => {
      console.log(
        `ID: ${user.id} | اسم المستخدم: ${user.username} | البريد: ${user.email}`,
      );
      console.log(
        `الصلاحية: ${user.user_role} | الحالة: ${user.verification_status} | مفعل: ${user.is_verified ? "نعم" : "لا"}`,
      );
      console.log(`تاريخ الإنشاء: ${user.created_at}`);
      console.log("--------------------------------------------------");
    });

    return users;
  } catch (error) {
    console.error("❌ خطأ في عرض قائمة المستخدمين:", error);
    return [];
  }
}

// تحليل البارامترات المدخلة
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case "change-password":
        if (args.length < 3) {
          console.log("❌ الرجاء إدخال اسم المستخدم وكلمة المرور الجديدة");
          console.log(
            "الاستخدام: node admin-tools.mjs change-password <username> <new-password>",
          );
          break;
        }
        await changeUserPassword(args[1], args[2]);
        break;

      case "set-role":
        if (args.length < 3) {
          console.log("❌ الرجاء إدخال اسم المستخدم ونوع الصلاحية");
          console.log(
            "الاستخدام: node admin-tools.mjs set-role <username> <role>",
          );
          console.log("الأدوار المتاحة: user, admin, moderator, analyst");
          break;
        }
        await setUserRole(args[1], args[2]);
        break;

      case "set-status":
        if (args.length < 3) {
          console.log("❌ الرجاء إدخال اسم المستخدم وحالة الحساب");
          console.log(
            "الاستخدام: node admin-tools.mjs set-status <username> <status>",
          );
          console.log("الحالات المتاحة: pending, verified, rejected, disabled");
          break;
        }
        await setUserVerificationStatus(args[1], args[2]);
        break;

      case "list":
        await listUsers();
        break;

      default:
        console.log("📌 أداة إدارة المستخدمين - الإصدار 1.0");
        console.log("الاستخدامات المتاحة:");
        console.log(
          "  node admin-tools.mjs change-password <username> <new-password>",
        );
        console.log("  node admin-tools.mjs set-role <username> <role>");
        console.log("  node admin-tools.mjs set-status <username> <status>");
        console.log("  node admin-tools.mjs list");
    }
  } finally {
    await sql.end();
  }
}

main().catch(console.error);
