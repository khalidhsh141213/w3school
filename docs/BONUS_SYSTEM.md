# نظام المكافآت والإحالات وتتبع الأنشطة

تم إضافة نظام متكامل للمكافآت والإحالات وتتبع الأنشطة إلى منصة التداول لزيادة مشاركة المستخدمين وتوفير تجربة مستخدم أفضل.

## الجداول الرئيسية

### جدول المكافآت (bonuses)

يتم استخدام هذا الجدول لتخزين جميع أنواع المكافآت التي يمكن للمستخدمين الحصول عليها، مثل مكافآت الترحيب، ومكافآت الإيداع، ومكافآت الإحالة، والعروض الترويجية. كل مكافأة لها نوع ووصف وقيمة وشروط استخدام.

### جدول الأنشطة (activities)

يتتبع هذا الجدول جميع أنشطة المستخدمين على المنصة، مثل تسجيل الدخول، وإجراء الصفقات، والإيداع، والسحب، واستلام المكافآت واستخدامها، وتغيير كلمة المرور، وتحديث الإعدادات. يمكن استخدام هذه البيانات لتحليل سلوك المستخدم وتوفير تجربة مخصصة.

### جدول الإحالات (referrals)

يتتبع هذا الجدول إحالات المستخدمين. عندما يقوم مستخدم بإحالة مستخدم جديد، يتم تسجيل هذه الإحالة وتحديث حالتها حسب اكتمال شروط الإحالة.

## كيفية استخدام النظام

### إضافة مكافأة جديدة

```typescript
import { db } from "./server/db";
import { bonuses } from "./shared/schema";

async function addBonus(
  userId: number,
  amount: number,
  type: string,
  description: string,
) {
  const [bonus] = await db
    .insert(bonuses)
    .values({
      userId,
      amount,
      type,
      description,
      // القيم الاختيارية الأخرى...
    })
    .returning();

  return bonus;
}
```

### تسجيل نشاط المستخدم

```typescript
import { db } from "./server/db";
import { activities } from "./shared/schema";

async function logUserActivity(
  userId: number,
  type: string,
  description: string,
  metadata = {},
) {
  const [activity] = await db
    .insert(activities)
    .values({
      userId,
      type,
      description,
      metadata,
      // القيم الاختيارية الأخرى...
    })
    .returning();

  return activity;
}
```

### إضافة إحالة جديدة

```typescript
import { db } from "./server/db";
import { referrals } from "./shared/schema";

async function addReferral(
  referrerId: number,
  referredId: number,
  referralCode: string,
) {
  const [referral] = await db
    .insert(referrals)
    .values({
      referrerId,
      referredId,
      referralCode,
      // القيم الاختيارية الأخرى...
    })
    .returning();

  return referral;
}
```

## تنفيذ وتحديث قاعدة البيانات

لإنشاء وتحديث الجداول الجديدة في قاعدة البيانات، يمكن استخدام السكريبت الموجود في `server/create-bonus-system.ts`.

```bash
# تنفيذ السكريبت
npm run create-bonus-system
# أو
npx tsx server/create-bonus-system.ts
```

## مخطط قاعدة البيانات

يمكن الاطلاع على التوثيق الكامل لجميع الجداول في ملف `docs/DATABASE_SCHEMA.md` الذي يشرح بالتفصيل جميع الجداول وحقولها وعلاقاتها.

## التكامل مع المنصة

### المكافآت في الصفقات

تم تحديث جدول الصفقات (trades) لدعم استخدام المكافآت أثناء التداول. يمكن للمستخدمين استخدام رصيد المكافآت الخاص بهم لتقليل تكاليف العمولة أو لزيادة قدرتهم على التداول.

### المكافآت في المعاملات المالية

تم تحديث جدول المعاملات المالية (transactions) لدعم استخدام المكافآت في المعاملات. يمكن للمستخدمين استخدام المكافآت للحصول على خصومات أو مزايا أخرى.

### تتبع الأنشطة للتحليلات

يمكن استخدام بيانات الأنشطة لإنشاء تحليلات متقدمة وفهم سلوك المستخدمين بشكل أفضل. يمكن استخدام هذه البيانات لتحسين المنصة وتوفير تجربة مخصصة للمستخدمين.

### برنامج الإحالات

يمكن للمستخدمين الحصول على مكافآت من خلال إحالة مستخدمين جدد إلى المنصة. يتم تتبع الإحالات وتحديث حالتها حسب اكتمال شروط الإحالة.
