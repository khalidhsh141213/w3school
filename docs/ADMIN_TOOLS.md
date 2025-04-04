# أدوات إدارة المستخدمين

## نظرة عامة

تتيح هذه الأدوات للمشرفين إدارة حسابات المستخدمين، بما في ذلك:

- تغيير كلمات المرور
- تعيين صلاحيات المستخدمين
- تفعيل/تعطيل الحسابات
- عرض قائمة المستخدمين

## استخدام الأدوات

### تغيير كلمة المرور

لتغيير كلمة مرور مستخدم:

```bash
node scripts/admin-tools.mjs change-password <username> <new-password>
```

مثال:

```bash
node scripts/admin-tools.mjs change-password admintest 12345678
```

### تعيين صلاحية المستخدم

لتعيين صلاحية مستخدم:

```bash
node scripts/admin-tools.mjs set-role <username> <role>
```

الصلاحيات المتاحة:

- `user`: مستخدم عادي
- `admin`: مدير كامل الصلاحيات
- `moderator`: مشرف
- `analyst`: محلل

مثال:

```bash
node scripts/admin-tools.mjs set-role testuser user
```

### تعيين حالة الحساب

لتعيين حالة حساب مستخدم:

```bash
node scripts/admin-tools.mjs set-status <username> <status>
```

الحالات المتاحة:

- `pending`: في انتظار التحقق
- `verified`: تم التحقق
- `rejected`: مرفوض
- `disabled`: معطل

مثال:

```bash
node scripts/admin-tools.mjs set-status testuser verified
```

### عرض قائمة المستخدمين

لعرض قائمة بجميع المستخدمين وتفاصيلهم:

```bash
node scripts/admin-tools.mjs list
```

## معالجة أخطاء تسجيل الدخول

إذا واجهت مشكلة في تسجيل الدخول إلى حساب المدير (`admintest`)، يمكنك استخدام أداة تغيير كلمة المرور لإعادة تعيينها:

```bash
node scripts/admin-tools.mjs change-password admintest 12345678
```

بعد تنفيذ هذا الأمر، ستتمكن من تسجيل الدخول باستخدام:

- اسم المستخدم: `admintest`
- كلمة المرور: `12345678`

## تحديث نوع صلاحية المستخدم

إذا كنت بحاجة إلى تغيير نوع صلاحية مستخدم (مثلاً من مستخدم عادي إلى مدير)، استخدم:

```bash
node scripts/admin-tools.mjs set-role username admin
```

## استكشاف الأخطاء وإصلاحها

### خطأ "المستخدم غير موجود"

تأكد من كتابة اسم المستخدم بشكل صحيح والتحقق من القائمة الكاملة للمستخدمين باستخدام:

```bash
node scripts/admin-tools.mjs list
```

### خطأ في الاتصال بقاعدة البيانات

تأكد من أن متغير البيئة `DATABASE_URL` مضبوط بشكل صحيح. يمكنك استخدام الأمر التالي للتحقق:

```bash
echo $DATABASE_URL
```

إذا لم يكن ذلك متاحًا، فالبرنامج سيستخدم الإعدادات المضمنة في ملف `.env`
