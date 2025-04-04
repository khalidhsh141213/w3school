# توثيق هيكلة التطبيق الشامل

## 1. هيكل الملفات الأساسية

### الملفات الجذرية
- `package.json` - تكوين التطبيق والتبعيات
- `tsconfig.json` - تكوين TypeScript
- `tailwind.config.ts` - تكوين Tailwind CSS
- `drizzle.config.ts` - تكوين Drizzle ORM
- `vite.config.ts` - تكوين Vite
- `.env.development` - متغيرات البيئة للتطوير
- `schema-updates.sql` - تحديثات مخطط قاعدة البيانات لدعم نظام المحفظة
- `wallet-system-documentation.txt` - توثيق تفصيلي لنظام المحفظة

### مجلدات التطبيق الرئيسية

#### `/server` - ملفات الخادم (Backend)
- `server/index.ts` - نقطة دخول الخادم
- `server/routes.ts` - تعريف جميع نقاط النهاية API
- `server/db.ts` - اتصال قاعدة البيانات
- `server/storage.ts` - واجهات التخزين (DatabaseStorage)
- `server/wallet-storage.ts` - واجهات التخزين المتعلقة بالمحفظة
- `server/auth.ts` - المصادقة والتفويض
- `server/cache.ts` - التخزين المؤقت
- `server/health.ts` - مراقبة حالة التطبيق
- `server/validation.ts` - التحقق من صحة الطلبات
- `server/websocket.ts` - تكامل WebSocket

#### `/server/routes` - المسارات المنظمة
- `server/routes/index.ts` - مُصدّر المسارات للتحكم بمسارات التطبيق
- `server/routes/admin/index.js` - نقاط نهاية المشرف العامة
- `server/routes/admin/wallet-admin-routes.ts` - نقاط نهاية إدارة المحفظة للمشرف
- `server/routes/trade.ts` - نقاط نهاية التداول
- `server/routes/wallet-routes.ts` - نقاط نهاية المحفظة للمستخدمين
- `server/routes/bonus.js` - نقاط نهاية المكافآت
- `server/routes/economic-calendar.js` - نقاط نهاية التقويم الاقتصادي

#### `/server/services` - خدمات الخادم
- `server/services/market-data-service.js` - خدمة بيانات السوق
- `server/services/notificationService.js` - خدمة الإشعارات
- `server/services/errorHandlingService.js` - خدمة معالجة الأخطاء

#### `/shared` - الملفات المشتركة بين الخادم والعميل
- `shared/schema.ts` - تعريفات المخطط والأنواع المشتركة
- `shared/wallet-schema.ts` - تعريفات مخطط نظام المحفظة

#### `/client` - ملفات العميل (Frontend)
- `client/src/App.tsx` - مكون التطبيق الرئيسي
- `client/src/main.tsx` - نقطة دخول العميل
- `client/src/config/api.ts` - تكوين طلبات API

#### `/client/src/components` - مكونات واجهة المستخدم
- `client/src/components/ui` - مكونات واجهة المستخدم الأساسية (shadcn/ui)
- `client/src/components/trading` - مكونات خاصة بالتداول
- `client/src/components/wallet` - مكونات خاصة بالمحفظة
- `client/src/components/admin` - مكونات لوحة تحكم المشرف

#### `/client/src/pages` - صفحات التطبيق
- `client/src/pages/dashboard.tsx` - صفحة لوحة التحكم
- `client/src/pages/login.tsx` - صفحة تسجيل الدخول
- `client/src/pages/register.tsx` - صفحة التسجيل
- `client/src/pages/trade.tsx` - صفحة التداول
- `client/src/pages/portfolio.tsx` - صفحة المحفظة
- `client/src/pages/wallet.tsx` - صفحة المحفظة وإدارة الأموال
- `client/src/pages/economic-calendar.tsx` - صفحة التقويم الاقتصادي
- `client/src/pages/admin` - صفحات لوحة تحكم المشرف

#### `/client/src/context` - سياقات React
- `client/src/context/AuthContext.tsx` - سياق المصادقة
- `client/src/context/SocketContext.tsx` - سياق WebSocket
- `client/src/context/WalletContext.tsx` - سياق المحفظة

#### `/client/src/hooks` - خطافات React المخصصة
- `client/src/hooks/use-toast.ts` - خطاف لإشعارات التوست
- `client/src/hooks/use-wallet.ts` - خطاف لعمليات المحفظة

#### `/drizzle` - ملفات وترحيلات Drizzle ORM
- `drizzle/migrations` - ترحيلات قاعدة البيانات

---

## 2. نقاط النهاية (API Endpoints)

### نقاط نهاية المصادقة
- `POST /api/auth/login` - تسجيل الدخول
- `POST /api/auth/logout` - تسجيل الخروج
- `POST /api/auth/register` - تسجيل مستخدم جديد
- `POST /api/auth/change-password` - تغيير كلمة المرور

### نقاط نهاية المستخدم
- `GET /api/user` - الحصول على بيانات المستخدم الحالي
- `GET /api/user/:id` - الحصول على بيانات مستخدم محدد
- `PATCH /api/user/:id` - تحديث بيانات مستخدم
- `PATCH /api/user/profile` - تحديث الملف الشخصي للمستخدم الحالي
- `GET /api/user-settings` - الحصول على إعدادات المستخدم الحالي
- `GET /api/user-settings/:id` - الحصول على إعدادات مستخدم محدد
- `POST /api/user-settings` - تحديث إعدادات المستخدم

### نقاط نهاية التداول
- `POST /api/trade/open` - فتح صفقة جديدة
- `POST /api/trade/close` - إغلاق صفقة
- `POST /api/trade/check-conditions` - فحص شروط وقف الخسارة وجني الأرباح
- `POST /api/trade/cancel` - إلغاء صفقة مفتوحة
- `GET /api/trades` - الحصول على صفقات المستخدم الحالي
- `GET /api/trades/user/:id` - الحصول على صفقات مستخدم محدد
- `GET /api/trades/recent` - الحصول على أحدث الصفقات
- `POST /api/trades` - إنشاء صفقة جديدة (مماثلة لـ /api/trade/open)

### نقاط نهاية نظام المحفظة
- `GET /api/wallet` - الحصول على جميع محافظ المستخدم الحالي
- `GET /api/wallet/:id` - الحصول على محفظة محددة
- `GET /api/wallet/transactions` - الحصول على معاملات محفظة المستخدم
- `GET /api/wallet/transactions/:walletId` - الحصول على معاملات محفظة محددة
- `POST /api/wallet/deposit` - إيداع أموال في محفظة
- `POST /api/wallet/withdraw` - سحب أموال من محفظة
- `POST /api/wallet/transfer` - تحويل أموال بين محافظ

### نقاط نهاية إدارة المحفظة (للمشرف)
- `GET /api/admin/wallets` - الحصول على جميع المحافظ
- `GET /api/admin/wallets/summary` - الحصول على ملخص لجميع المحافظ
- `GET /api/admin/wallets/user/:userId` - الحصول على محافظ مستخدم محدد
- `PATCH /api/admin/wallets/:id` - تعديل محفظة
- `GET /api/admin/wallet-transactions` - الحصول على جميع معاملات المحافظ
- `POST /api/admin/wallet/bonus` - إضافة مكافأة لمستخدم
- `POST /api/admin/wallet/adjust-balance` - تعديل رصيد محفظة

### نقاط نهاية المحفظة
- `GET /api/portfolio` - الحصول على محفظة المستخدم الحالي
- `GET /api/portfolio-details` - تفاصيل محفظة المستخدم الحالي
- `GET /api/watchlist` - الحصول على قائمة المراقبة للمستخدم
- `POST /api/watchlist` - إضافة رمز إلى قائمة المراقبة

### نقاط نهاية بيانات السوق
- `GET /api/market-data` - الحصول على بيانات السوق الحالية
- `PUT /api/market-data` - تحديث بيانات السوق
- `GET /api/assets` - الحصول على قائمة الأصول المتاحة
- `GET /api/assets/trending` - الحصول على الأصول الرائجة
- `GET /api/assets/featured` - الحصول على الأصول المميزة
- `GET /api/assets/movers` - الحصول على أكبر المتحركين في السوق
- `GET /api/assets/live` - الحصول على بيانات الأصول في الوقت الفعلي
- `GET /api/assets/:symbol` - الحصول على معلومات أصل محدد
- `GET /api/price-history/:symbol` - الحصول على تاريخ أسعار أصل محدد
- `GET /api/analysis/:symbol` - الحصول على تحليل لأصل محدد

### نقاط نهاية التقويم الاقتصادي
- `GET /api/economic-events` - الحصول على الأحداث الاقتصادية
- `GET /api/economic-events/range` - الحصول على الأحداث الاقتصادية ضمن نطاق زمني

### نقاط نهاية الصحة والمراقبة
- `GET /api/health` - التحقق من صحة التطبيق
- `GET /api/health/simple` - فحص صحة بسيط
- `GET /api/ai/health` - فحص صحة خدمة الذكاء الاصطناعي

### نقاط نهاية المشرف
- `GET /api/admin/metrics` - مقاييس لوحة التحكم
- `GET /api/admin/users` - الحصول على قائمة المستخدمين
- `GET /api/admin/kyc` - الحصول على طلبات KYC
- `GET /api/admin/trades` - الحصول على جميع الصفقات
- `GET /api/admin/error-stats` - إحصائيات الأخطاء
- `GET /api/admin/recent-errors` - الأخطاء الأخيرة
- `POST /api/admin/reset-error-stats` - إعادة تعيين إحصائيات الأخطاء
- `GET /api/admin/cache-stats` - إحصائيات التخزين المؤقت
- `POST /api/admin/clear-cache` - مسح التخزين المؤقت

---

## 3. هيكل قاعدة البيانات

### جداول قاعدة البيانات الأساسية

#### جدول `users` - المستخدمين
- `id` - معرف فريد
- `username` - اسم المستخدم
- `password` - كلمة المرور المشفرة
- `email` - البريد الإلكتروني
- `fullName` - الاسم الكامل
- `phoneNumber` - رقم الهاتف
- `profilePictureUrl` - رابط صورة الملف الشخصي
- `isVerified` - حالة التحقق
- `verificationStatus` - حالة التحقق التفصيلية
- `verificationNotes` - ملاحظات التحقق
- `country` - البلد
- `city` - المدينة
- `address` - العنوان
- `userRole` - دور المستخدم (admin, user)
- `languagePreference` - تفضيل اللغة
- `currencyPreference` - تفضيل العملة
- `themePreference` - تفضيل المظهر
- `notificationPreference` - تفضيلات الإشعارات
- `privacySettings` - إعدادات الخصوصية
- `interfaceSettings` - إعدادات الواجهة
- `referralCode` - رمز الإحالة
- `referredBy` - معرف من قام بالإحالة
- `createdAt` - تاريخ الإنشاء
- `updatedAt` - تاريخ التحديث

#### جدول `trades` - الصفقات (محدث)
- `id` - معرف فريد
- `userId` - معرف المستخدم (مفتاح خارجي لجدول users)
- `symbol` - رمز الأصل
- `type` - نوع الصفقة (buy, sell)
- `shares` - عدد الأسهم/الوحدات
- `price` - سعر الدخول
- `total` - المبلغ الإجمالي
- `commission` - العمولة
- `tradeDate` - تاريخ فتح الصفقة
- `status` - حالة الصفقة (open, closed, cancelled)
- `closedAt` - تاريخ إغلاق الصفقة
- `closePrice` - سعر الإغلاق
- `profitLoss` - الربح/الخسارة
- `stopLoss` - سعر وقف الخسارة
- `takeProfit` - سعر جني الأرباح
- `closedBy` - سبب الإغلاق (manual, stop_loss, take_profit, cancelled)
- `walletId` - معرف المحفظة المستخدمة
- `usedBonus` - هل تم استخدام المكافأة في الصفقة
- `bonusAmount` - قيمة المكافأة المستخدمة
- `openTransactionId` - معرف معاملة فتح الصفقة
- `closeTransactionId` - معرف معاملة إغلاق الصفقة
- `leverage` - الرافعة المالية المستخدمة

#### جدول `portfolio` - المحفظة
- `id` - معرف فريد
- `userId` - معرف المستخدم
- `symbol` - رمز الأصل
- `shares` - عدد الأسهم/الوحدات
- `averagePrice` - متوسط سعر الشراء
- `purchaseDate` - تاريخ الشراء
- `currentPrice` - السعر الحالي
- `value` - القيمة الحالية
- `updatedAt` - آخر تحديث

#### جدول `assets` - الأصول المتاحة
- `id` - معرف فريد
- `symbol` - رمز الأصل
- `name` - اسم الأصل
- `type` - نوع الأصل (stock, forex, crypto)
- `sector` - القطاع
- `exchange` - البورصة
- `logoUrl` - رابط الشعار
- `description` - وصف الأصل
- `price` - السعر الحالي
- `dailyChange` - التغيير اليومي
- `dailyChangePercent` - نسبة التغيير اليومي
- `volume` - حجم التداول
- `marketCap` - القيمة السوقية
- `high24h` - أعلى سعر خلال 24 ساعة
- `low24h` - أدنى سعر خلال 24 ساعة
- `updatedAt` - آخر تحديث

### جداول نظام المحفظة الجديدة

#### جدول `wallets` - المحافظ
- `id` - معرف فريد
- `userId` - معرف المستخدم
- `name` - اسم المحفظة
- `type` - نوع المحفظة (main, bonus, trading)
- `currency` - عملة المحفظة
- `balance` - الرصيد الكلي
- `availableBalance` - الرصيد المتاح
- `lockedBalance` - الرصيد المحجوز للصفقات المفتوحة
- `createdAt` - تاريخ الإنشاء
- `updatedAt` - تاريخ التحديث
- `isActive` - حالة تفعيل المحفظة
- `lastTransactionDate` - آخر تاريخ معاملة

#### جدول `wallet_transactions` - معاملات المحفظة
- `id` - معرف فريد
- `walletId` - معرف المحفظة
- `userId` - معرف المستخدم
- `amount` - قيمة المعاملة
- `type` - نوع المعاملة (deposit, withdrawal, trade_open, trade_close, bonus, referral)
- `status` - حالة المعاملة (pending, completed, failed, cancelled)
- `referenceId` - معرف المرجع (مثل معرف الصفقة)
- `description` - وصف المعاملة
- `balanceBefore` - الرصيد قبل المعاملة
- `balanceAfter` - الرصيد بعد المعاملة
- `createdAt` - تاريخ الإنشاء
- `processedAt` - تاريخ المعالجة
- `notes` - ملاحظات إضافية
- `metadata` - بيانات إضافية (JSON)

#### جدول `wallet_transfers` - تحويلات المحفظة
- `id` - معرف فريد
- `userId` - معرف المستخدم
- `sourceWalletId` - معرف المحفظة المصدر
- `destinationWalletId` - معرف المحفظة الوجهة
- `amount` - قيمة التحويل
- `sourceType` - نوع المحفظة المصدر
- `destinationType` - نوع المحفظة الوجهة
- `status` - حالة التحويل
- `createdAt` - تاريخ الإنشاء
- `processedAt` - تاريخ المعالجة
- `notes` - ملاحظات إضافية

#### جدول `bonuses` - المكافآت
- `id` - معرف فريد
- `userId` - معرف المستخدم
- `walletId` - معرف المحفظة
- `amount` - قيمة المكافأة
- `currency` - عملة المكافأة
- `type` - نوع المكافأة (welcome, deposit, referral, promotion)
- `status` - حالة المكافأة (active, used, expired)
- `expiryDate` - تاريخ انتهاء الصلاحية
- `usageConditions` - شروط الاستخدام (JSON)
- `usedAmount` - المبلغ المستخدم من المكافأة
- `remainingAmount` - المبلغ المتبقي من المكافأة
- `createdAt` - تاريخ الإنشاء
- `usedAt` - تاريخ الاستخدام
- `createdBy` - معرف المشرف الذي أنشأ المكافأة
- `notes` - ملاحظات إضافية

#### جدول `referrals` - الإحالات
- `id` - معرف فريد
- `referrerId` - معرف المُحيل
- `referredId` - معرف المُحال
- `code` - رمز الإحالة المستخدم
- `status` - حالة الإحالة
- `reward` - قيمة المكافأة
- `bonusId` - معرف المكافأة المرتبطة
- `createdAt` - تاريخ الإنشاء
- `processedAt` - تاريخ المعالجة

---

## 4. العلاقات بين جداول قاعدة البيانات

### العلاقات الأساسية

1. **علاقة المستخدم والصفقات**:
   - جدول `users` → جدول `trades` (علاقة 1:N)
   - كل مستخدم يمكن أن يكون لديه عدة صفقات

2. **علاقة المستخدم والمحفظة**:
   - جدول `users` → جدول `portfolio` (علاقة 1:N)
   - كل مستخدم يمكن أن يكون لديه عدة أصول في المحفظة

3. **علاقة المستخدم وقائمة المراقبة**:
   - جدول `users` → جدول `watchlist` (علاقة 1:N)
   - كل مستخدم يمكن أن يكون لديه عدة أصول في قائمة المراقبة

### العلاقات الجديدة لنظام المحفظة

4. **علاقة المستخدم والمحافظ**:
   - جدول `users` → جدول `wallets` (علاقة 1:N)
   - كل مستخدم لديه عدة محافظ (رئيسية، مكافآت، تداول)

5. **علاقة المحفظة والمعاملات**:
   - جدول `wallets` → جدول `wallet_transactions` (علاقة 1:N)
   - كل محفظة لديها سجل معاملات

6. **علاقة المستخدم والتحويلات**:
   - جدول `users` → جدول `wallet_transfers` (علاقة 1:N)
   - كل مستخدم يمكن أن يقوم بعدة تحويلات بين محافظه

7. **علاقة المحفظة والتحويلات**:
   - جدول `wallets` → جدول `wallet_transfers` (علاقة 1:N كمصدر)
   - جدول `wallets` → جدول `wallet_transfers` (علاقة 1:N كوجهة)
   - كل محفظة يمكن أن تكون مصدر أو وجهة لعدة تحويلات

8. **علاقة المستخدم والمكافآت**:
   - جدول `users` → جدول `bonuses` (علاقة 1:N)
   - كل مستخدم يمكن أن يحصل على عدة مكافآت

9. **علاقة المحفظة والمكافآت**:
   - جدول `wallets` → جدول `bonuses` (علاقة 1:N)
   - كل محفظة يمكن أن تحتوي على عدة مكافآت

10. **علاقة المستخدم والإحالات (كمُحيل)**:
    - جدول `users` → جدول `referrals` (علاقة 1:N)
    - كل مستخدم يمكن أن يُحيل عدة مستخدمين

11. **علاقة المستخدم والإحالات (كمُحال)**:
    - جدول `users` → جدول `referrals` (علاقة 1:1)
    - كل مستخدم يمكن أن يكون مُحال مرة واحدة فقط

12. **علاقة الصفقات ومعاملات المحفظة**:
    - جدول `trades` → جدول `wallet_transactions` (علاقة 1:2)
    - كل صفقة مرتبطة بمعاملتين: معاملة فتح ومعاملة إغلاق
    - يتم تخزين معرفات المعاملات في حقول `openTransactionId` و `closeTransactionId`

13. **علاقة المكافآت ومعاملات المحفظة**:
    - جدول `bonuses` → جدول `wallet_transactions` (علاقة 1:1)
    - كل مكافأة ترتبط بمعاملة محفظة واحدة

---

## 5. مفاهيم وتعريفات نظام المحفظة والتعاملات المالية

### تعريفات أساسية

1. **نظام المحفظة**: نظام يدير الأموال والمعاملات المالية للمستخدمين مع تمييز واضح بين أنواع المحافظ وأنواع المعاملات، مع تتبع الأرصدة المتاحة والمحجوزة.

2. **أنواع المحافظ**:
   - **محفظة رئيسية (Main)**: المحفظة الأساسية للمستخدم، تستخدم للإيداع والسحب والتداول.
   - **محفظة المكافآت (Bonus)**: محفظة تحتوي على المكافآت والعروض الترويجية التي حصل عليها المستخدم.
   - **محفظة التداول (Trading)**: محفظة مخصصة للتداول فقط، يمكن تحويل الأموال إليها من المحفظة الرئيسية أو محفظة المكافآت.

3. **رصيد المستخدم (User Balance)**: تم الاستغناء عن هذا الحقل في جدول المستخدمين واستبداله بنظام المحافظ المتعدد. إجمالي رصيد المستخدم هو مجموع أرصدة جميع محافظه النشطة.

4. **رصيد المحفظة (Wallet Balance)**: إجمالي المبلغ في المحفظة، ويتكون من:
   - **الرصيد المتاح (Available Balance)**: المبلغ المتاح للاستخدام في عمليات التداول أو السحب.
   - **الرصيد المحجوز (Locked Balance)**: المبلغ المحجوز/المحتجز للصفقات المفتوحة.

5. **أنواع المعاملات المالية**:
   - **إيداع (Deposit)**: إضافة أموال من مصادر خارجية إلى محفظة.
   - **سحب (Withdrawal)**: سحب أموال من المحفظة إلى مصادر خارجية.
   - **فتح صفقة (Trade Open)**: حجز أموال عند فتح صفقة.
   - **إغلاق صفقة (Trade Close)**: تحرير الأموال المحجوزة وإضافة/خصم الربح/الخسارة عند إغلاق الصفقة.
   - **مكافأة (Bonus)**: إضافة مبلغ مكافأة إلى محفظة.
   - **إحالة (Referral)**: إضافة مكافأة الإحالة إلى محفظة.
   - **تحويل (Transfer)**: تحويل أموال بين محافظ المستخدم.

### المكافآت (Bonuses)

1. **تعريف المكافأة**: مبلغ نقدي يمنح للمستخدم كحافز أو مكافأة، ويمكن استخدامه في التداول وفق شروط محددة.

2. **أنواع المكافآت**:
   - **مكافأة ترحيبية (Welcome Bonus)**: تمنح للمستخدمين الجدد عند التسجيل.
   - **مكافأة إيداع (Deposit Bonus)**: نسبة من مبلغ الإيداع تضاف كمكافأة.
   - **مكافأة إحالة (Referral Bonus)**: تمنح للمستخدم عند إحالة مستخدم جديد.
   - **مكافأة ترويجية (Promotion Bonus)**: تمنح كجزء من حملات ترويجية محددة.

3. **شروط استخدام المكافآت**:
   - المكافآت لها فترة صلاحية محددة (expiryDate).
   - يمكن استخدام المكافآت في التداول فقط ولا يمكن سحبها مباشرة.
   - الأرباح الناتجة عن استخدام المكافأة في التداول تعتبر أموالاً حقيقية ويمكن سحبها بعد تحقيق شروط محددة.
   - شروط الاستخدام مخزنة في حقل (usageConditions) كـ JSON وتشمل:
     - الحد الأدنى لحجم التداول قبل السماح بالسحب (minimum_trading_volume).
     - عدد الصفقات المطلوب قبل تحويل المكافأة إلى أموال حقيقية (minimum_trades).
     - أنواع الأصول المسموح التداول بها باستخدام المكافأة (allowed_asset_types).

4. **حساب المكافآت**:
   - **مكافأة الإيداع**: نسبة مئوية من مبلغ الإيداع، مثل 10% من قيمة الإيداع.
   - **مكافأة الإحالة**: مبلغ ثابت أو نسبة من إيداعات أو تداولات المستخدم المُحال.
   - **مكافأة الترحيب**: مبلغ ثابت محدد مسبقاً.
   - تتم إدارة المكافآت بواسطة مشرفي النظام عبر واجهة خاصة.

### نظام الإحالات (Referrals)

1. **تعريف الإحالة**: آلية تسمح للمستخدمين بدعوة أشخاص آخرين للانضمام إلى المنصة مقابل مكافأة.

2. **آلية الإحالة**:
   - كل مستخدم لديه رمز إحالة فريد (referralCode).
   - عند تسجيل مستخدم جديد باستخدام رمز إحالة، يتم ربط المستخدم الجديد بالمُحيل.
   - يحصل المُحيل على مكافأة عند تحقق شروط معينة (مثل قيام المُحال بإيداع أول مبلغ).

3. **حساب مكافأة الإحالة**:
   - **مكافأة المستوى الأول**: مبلغ ثابت أو نسبة من الإيداع الأول للمستخدم المُحال.
   - **عمولة مستمرة**: نسبة صغيرة من عمولات تداول المستخدم المُحال (مثل 5%).
   - يمكن تكوين هذه القيم من قبل مشرفي النظام.

### العلاقة بين المحفظة والبورتفوليو والمستخدم

1. **المحفظة (Wallet)**:
   - تمثل الأموال النقدية التي يمتلكها المستخدم.
   - تستخدم في الإيداع والسحب والتداول.
   - تتكون من عدة محافظ فرعية (رئيسية، مكافآت، تداول).

2. **البورتفوليو (Portfolio)**:
   - يمثل الأصول التي يملكها المستخدم (الأسهم، العملات المشفرة، إلخ).
   - يتم تحديثه عند شراء/بيع الأصول في تداول الملكية (Spot Trading).
   - لا يتأثر بتداول العقود الآجلة أو المستقبليات.

3. **التمييز بين أنواع التداول**:
   - **تداول الملكية (Spot Trading)**: يشتري المستخدم الأصل فعلياً ويضاف إلى محفظته الاستثمارية (البورتفوليو).
   - **تداول العقود الآجلة/المستقبليات (Futures Trading)**: لا يمتلك المستخدم الأصل، بل يتداول عقوداً تعتمد على سعر الأصل، ويؤثر فقط على رصيد المحفظة النقدية.

4. **آلية الربط**:
   - **المستخدم (User)**: الكيان الرئيسي الذي يملك محافظ وبورتفوليو.
   - **المحفظة (Wallet)**: مرتبطة بالمستخدم من خلال حقل `userId`.
   - **البورتفوليو (Portfolio)**: مرتبط بالمستخدم من خلال حقل `userId` ويحتوي على أصول مختلفة.
   - **الصفقات (Trades)**: مرتبطة بالمستخدم من خلال حقل `userId` وبالمحفظة من خلال حقل `walletId`.
     - صفقات تداول الملكية تؤثر على البورتفوليو بالإضافة إلى المحفظة.
     - صفقات تداول العقود تؤثر على المحفظة فقط.

## 6. نقاط تحسين عملية التداول

### ميزة وقف الخسارة وجني الأرباح

1. **تم إضافة حقول جديدة إلى جدول الصفقات (trades)**:
   - `stopLoss`: سعر وقف الخسارة الذي سيتم إغلاق الصفقة عنده تلقائياً لتقليل الخسائر.
   - `takeProfit`: سعر جني الأرباح الذي سيتم إغلاق الصفقة عنده تلقائياً لجني الأرباح.
   - `closedBy`: سبب إغلاق الصفقة (manual, stop_loss, take_profit, cancelled).

2. **آلية التنفيذ**:
   - يتم التحقق دورياً من أسعار الأصول مقابل شروط وقف الخسارة وجني الأرباح للصفقات المفتوحة.
   - عند تحقق أحد الشروط، يتم إغلاق الصفقة تلقائياً وتحديث حالتها وتسجيل سبب الإغلاق.
   - تتم معالجة تحرير الأموال المحجوزة وحساب الربح/الخسارة من خلال المحفزات (Triggers).

3. **مزايا الميزة**:
   - تساعد المستخدمين على إدارة المخاطر بشكل أفضل.
   - تمكن المستخدمين من تحديد استراتيجيات خروج واضحة مسبقاً.
   - تعمل حتى عندما يكون المستخدم غير متصل بالمنصة.

### التعامل مع الصفقات والمحفظة

1. **مستودع التخزين المحسن (Storage Repository)**:
   - تم تحسين واجهة التخزين لدعم عمليات المحفظة والصفقات المحسنة.
   - `wallet-storage.ts`: واجهة تخزين خاصة بعمليات المحفظة.
   - تم تحديث `storage.ts` لدعم الحقول الجديدة في جدول الصفقات.

2. **محفزات قاعدة البيانات (Database Triggers)**:
   - **محفز إنشاء المحافظ الافتراضية**: ينشئ محافظ افتراضية للمستخدمين الجدد (رئيسية، مكافآت).
   - **محفز فتح الصفقة**: يحجز الأموال من المحفظة عند فتح صفقة ويحدث الرصيد المتاح والمحجوز.
   - **محفز إغلاق الصفقة**: يحرر الأموال المحجوزة ويضيف/يخصم الربح/الخسارة.
   - **محفز إلغاء الصفقة**: يلغي الصفقة ويعيد الأموال المحجوزة إلى الرصيد المتاح.

3. **معاملات المحفظة المتقدمة**:
   - تتبع كامل لجميع المعاملات المالية في النظام.
   - سجل تاريخي للرصيد قبل وبعد كل معاملة.
   - دعم لإضافة بيانات تعريفية (metadata) لكل معاملة.
   - تكامل مع نظام الإشعارات لإعلام المستخدمين بالمعاملات الهامة.

## 7. التحديثات الأخيرة والإنجازات

### تحسينات وإصلاحات نظام التداول (آخر تحديث: 04 أبريل 2025)

1. **إصلاح استجابات API للتداول**:
   - تم إصلاح نقاط النهاية `/api/trade/open` و `/api/trade/close` لإعادة استجابات JSON بدلاً من HTML
   - تم تحسين التعامل مع معرف المحفظة (walletId) في استجابات API
   - تم تنفيذ استدعاءات مباشرة لقاعدة البيانات للتأكد من استرجاع جميع البيانات المطلوبة
   - تم تنسيق استجابات JSON بشكل موحد وإضافة معلومات إضافية للاستجابات

2. **معالجة مشكلة الارتباط بين المحفظة والصفقات**:
   - تم إصلاح خطأ "Wallet not found for trade" من خلال تحسين عملية البحث عن المحفظة
   - تم التأكد من تعيين `wallet_id` بشكل صحيح في جدول الصفقات عند إنشاء صفقات جديدة
   - تم تحسين عمليات نقل الأموال بين المحفظة الرئيسية ومحفظة التداول

3. **تتبع معاملات المحفظة**:
   - تم تحسين آلية تتبع معاملات المحفظة المرتبطة بالصفقات
   - تم تنفيذ آلية لتحديث أرصدة المحفظة تلقائياً عند فتح وإغلاق الصفقات
   - إضافة تسجيل مفصل للعمليات المالية بين المحافظ

4. **تحسينات على مستوى قاعدة البيانات**:
   - تم تحسين الوظائف المخزنة (Stored Functions) في قاعدة البيانات للتعامل مع المحافظ والصفقات بشكل أفضل
   - تم التأكد من تضمين معرف المحفظة في نتائج الوظائف المخزنة
   - تم تنفيذ تحقق إضافي للحماية من الأخطاء المتعلقة بالمحافظ

## 8. خصائص التطبيق الرئيسية

### ميزات المستخدم العام
1. **التسجيل وتسجيل الدخول** - إنشاء حساب وتسجيل الدخول
2. **التداول** - فتح وإغلاق الصفقات مع وقف الخسارة وجني الأرباح
3. **المحفظة** - عرض وإدارة الأصول
4. **قائمة المراقبة** - متابعة أصول محددة
5. **الأحداث الاقتصادية** - عرض التقويم الاقتصادي والأحداث القادمة
6. **بيانات السوق المباشرة** - عرض أسعار وبيانات الأصول في الوقت الفعلي
7. **التحليلات** - تحليلات مدعومة بالذكاء الاصطناعي للأصول
8. **إدارة المحفظة** - إيداع وسحب وتحويل الأموال بين المحافظ
9. **المكافآت** - الحصول على واستخدام المكافآت
10. **الإحالات** - إحالة أصدقاء ومعارف وكسب مكافآت

### ميزات المشرف
1. **إدارة المستخدمين** - عرض وإدارة حسابات المستخدمين
2. **إدارة KYC** - التحقق من وثائق التحقق من الهوية
3. **مراقبة الصفقات** - مراقبة جميع الصفقات في النظام
4. **إدارة المحافظ** - مراقبة وتعديل محافظ المستخدمين
5. **إدارة المكافآت** - إنشاء وإدارة المكافآت والعروض الترويجية
6. **إحصائيات النظام** - عرض أداء النظام وإحصائيات الأخطاء
7. **إدارة التخزين المؤقت** - مراقبة ومسح التخزين المؤقت للنظام

### تكامل WebSocket
1. **بيانات السوق المباشرة** - استلام تحديثات أسعار الأصول في الوقت الفعلي
2. **إشعارات** - إشعارات في الوقت الفعلي للمستخدمين
3. **تنبيهات الأحداث الاقتصادية** - تنبيهات بالأحداث الاقتصادية المقبلة والمنشورة
4. **تنبيهات المعاملات** - إشعارات فورية عند اكتمال المعاملات أو تغير حالة الصفقات# توثيق هيكلة التطبيق الشامل (محدثة)

## 7. تحديثات نظام التداول وإدارة الصفقات

### 7.1. ميزة وقف الخسارة وجني الأرباح (Stop Loss & Take Profit)

#### الوصف
تم تطوير ميزة وقف الخسارة وجني الأرباح لتمكين المتداولين من إدارة المخاطر بشكل أفضل والحماية من التقلبات السلبية في السوق. تسمح هذه الميزة بتحديد مستويات أسعار لإغلاق الصفقات تلقائياً إما للحد من الخسائر (وقف الخسارة) أو لتأمين الأرباح (جني الأرباح).

#### المكونات الرئيسية
1. **حقول الصفقة الجديدة**:
   - `stopLoss`: سعر وقف الخسارة الذي سيتم إغلاق الصفقة عنده تلقائياً لتقليل الخسائر.
   - `takeProfit`: سعر جني الأرباح الذي سيتم إغلاق الصفقة عنده تلقائياً لتأمين الأرباح.
   - `closedBy`: يحدد سبب إغلاق الصفقة (manual, stop_loss, take_profit, system).

2. **نقطة نهاية جديدة**:
   - `POST /api/trade/check-conditions`: لفحص شروط وقف الخسارة وجني الأرباح وإغلاق الصفقات التي استوفت الشروط.

3. **آلية فحص الشروط**:
   - تم تطوير خدمة لفحص أسعار الأصول بشكل دوري ومقارنتها بشروط وقف الخسارة وجني الأرباح.
   - عند استيفاء الشروط، يتم إغلاق الصفقة تلقائياً وتحديث حقل `closedBy` بسبب الإغلاق.
   - يتم تحديث أرصدة المحافظ وفقاً لنتيجة إغلاق الصفقة (ربح أو خسارة).

#### التحسينات المرتبطة
1. **تنسيق استجابات API**:
   - تم تحسين جميع نقاط نهاية التداول لإرجاع استجابات JSON بدلاً من HTML.
   - تم إضافة رسائل خطأ مفصلة في حالة فشل العمليات.

2. **معالجة أرصدة المحافظ**:
   - تم تحسين آلية تحديث الأرصدة المتاحة والمحجوزة عند إغلاق الصفقات.
   - تم إضافة تسجيل دقيق للمعاملات في جدول `wallet_transactions`.

### 7.2. تحسينات نقاط نهاية API

#### استجابات JSON بدلاً من HTML
تم تصحيح مشكلة استجابات HTML في نقاط نهاية التداول الرئيسية وتحويلها لإرجاع استجابات JSON بالتنسيق الصحيح. هذا يشمل:

1. **نقاط النهاية المحسنة**:
   - `POST /api/trade/open`: لفتح صفقة جديدة.
   - `POST /api/trade/close`: لإغلاق صفقة مفتوحة.
   - `POST /api/trade/check-conditions`: لفحص شروط وقف الخسارة وجني الأرباح.

2. **تنسيق الاستجابات**:
   - استجابات موحدة تتضمن بيانات الصفقة كاملة.
   - رسائل خطأ واضحة عند فشل العمليات.
   - تضمين معلومات المحفظة المرتبطة بالصفقة.

#### تكامل أفضل مع نظام المحفظة
تم تحسين تكامل نقاط نهاية التداول مع نظام المحفظة لضمان:

1. **ربط صحيح بين الصفقات والمحافظ**:
   - تحديد وتحديث محفظة التداول المناسبة عند فتح وإغلاق الصفقات.
   - التأكد من وجود رصيد كافٍ قبل فتح صفقات جديدة.

2. **سجل معاملات دقيق**:
   - تسجيل معاملات المحفظة المرتبطة بفتح وإغلاق الصفقات.
   - تتبع التغييرات في الأرصدة المتاحة والمحجوزة.

### 7.3. اختبارات وتحقق

تم تطوير وتنفيذ مجموعة من الاختبارات لضمان عمل نظام التداول المحسن بشكل صحيح:

1. **اختبارات وقف الخسارة وجني الأرباح**:
   - اختبار إنشاء صفقات مع شروط وقف الخسارة وجني الأرباح.
   - اختبار فحص الشروط وإغلاق الصفقات تلقائياً.
   - اختبار تحديث أرصدة المحافظ بعد إغلاق الصفقات.

2. **اختبارات نقاط نهاية التداول**:
   - اختبار فتح وإغلاق الصفقات باستخدام نقاط نهاية API.
   - اختبار حالات الخطأ المختلفة (رصيد غير كافٍ، محفظة غير موجودة، إلخ).
   - اختبار تنسيق استجابات JSON والتحقق من صحة البيانات المرجعة.
