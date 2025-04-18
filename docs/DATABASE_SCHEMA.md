# توثيق قاعدة بيانات منصة التداول

هذا الملف يحتوي على توثيق شامل لقاعدة البيانات المستخدمة في منصة التداول. يشرح جميع الجداول وحقولها وعلاقاتها.

## الجداول الرئيسية

### جدول المستخدمين (users)

يحتوي على بيانات جميع المستخدمين المسجلين في النظام.

| اسم الحقل              | النوع     | الوصف                                    |
| ---------------------- | --------- | ---------------------------------------- |
| id                     | SERIAL    | المعرف الفريد للمستخدم (المفتاح الأساسي) |
| username               | TEXT      | اسم المستخدم                             |
| password               | TEXT      | كلمة المرور المشفرة                      |
| email                  | TEXT      | البريد الإلكتروني                        |
| fullName               | TEXT      | الاسم الكامل                             |
| phoneNumber            | TEXT      | رقم الهاتف                               |
| profilePictureUrl      | TEXT      | رابط صورة الملف الشخصي                   |
| isVerified             | BOOLEAN   | هل تم التحقق من الحساب                   |
| verificationStatus     | TEXT      | حالة التحقق (معلق، مكتمل، مرفوض)         |
| role                   | TEXT      | دور المستخدم (مستخدم، مشرف)              |
| registrationDate       | TIMESTAMP | تاريخ التسجيل                            |
| lastLoginDate          | TIMESTAMP | تاريخ آخر تسجيل دخول                     |
| accountStatus          | TEXT      | حالة الحساب (نشط، معلق، محظور)           |
| languagePreference     | TEXT      | تفضيل اللغة                              |
| notificationPreference | JSONB     | تفضيلات الإشعارات                        |
| privacySettings        | JSONB     | إعدادات الخصوصية                         |
| activeToken            | TEXT      | رمز التنشيط الحالي                       |
| accountBalance         | NUMERIC   | رصيد الحساب                              |
| bonus_balance          | NUMERIC   | رصيد المكافآت                            |
| referral_code          | TEXT      | رمز الإحالة الفريد                       |
| referred_by            | INTEGER   | معرف المستخدم الذي قام بالإحالة          |
| createdAt              | TIMESTAMP | تاريخ الإنشاء                            |
| updatedAt              | TIMESTAMP | تاريخ التحديث                            |

### جدول الأصول (assets)

يحتوي على بيانات جميع الأسهم والعملات المشفرة المتاحة للتداول.

| اسم الحقل        | النوع     | الوصف                                 |
| ---------------- | --------- | ------------------------------------- |
| id               | SERIAL    | المعرف الفريد للأصل (المفتاح الأساسي) |
| symbol           | TEXT      | رمز الأصل                             |
| name             | TEXT      | اسم الأصل                             |
| type             | TEXT      | نوع الأصل (سهم، عملة مشفرة)           |
| description      | TEXT      | وصف الأصل                             |
| logo_url         | TEXT      | رابط شعار الأصل                       |
| sector           | TEXT      | قطاع الأصل (للأسهم فقط)               |
| current_price    | NUMERIC   | السعر الحالي                          |
| price_change_24h | NUMERIC   | تغير السعر خلال 24 ساعة               |
| market_cap       | NUMERIC   | القيمة السوقية                        |
| total_volume     | NUMERIC   | إجمالي حجم التداول                    |
| high_24h         | NUMERIC   | أعلى سعر خلال 24 ساعة                 |
| low_24h          | NUMERIC   | أدنى سعر خلال 24 ساعة                 |
| is_active        | BOOLEAN   | هل الأصل نشط للتداول                  |
| last_updated     | TIMESTAMP | آخر تحديث للبيانات                    |
| meta_data        | JSONB     | بيانات إضافية                         |
| createdAt        | TIMESTAMP | تاريخ الإنشاء                         |
| updatedAt        | TIMESTAMP | تاريخ التحديث                         |

### جدول تاريخ الأسعار (price_history)

يحتوي على بيانات تاريخية لأسعار الأصول.

| اسم الحقل | النوع     | الوصف                                 |
| --------- | --------- | ------------------------------------- |
| id        | UUID      | المعرف الفريد للسجل (المفتاح الأساسي) |
| symbol    | TEXT      | رمز الأصل                             |
| timestamp | TIMESTAMP | وقت السعر                             |
| open      | NUMERIC   | سعر الافتتاح                          |
| high      | NUMERIC   | أعلى سعر                              |
| low       | NUMERIC   | أدنى سعر                              |
| close     | NUMERIC   | سعر الإغلاق                           |
| volume    | NUMERIC   | حجم التداول                           |
| interval  | TEXT      | الفاصل الزمني (دقيقة، ساعة، يوم)      |
| createdAt | TIMESTAMP | تاريخ الإنشاء                         |

### جدول الأحداث الاقتصادية (economic_events)

يحتوي على بيانات الأحداث الاقتصادية التي قد تؤثر على أسعار الأصول.

| اسم الحقل      | النوع     | الوصف                                 |
| -------------- | --------- | ------------------------------------- |
| id             | UUID      | المعرف الفريد للحدث (المفتاح الأساسي) |
| title          | TEXT      | عنوان الحدث                           |
| description    | TEXT      | وصف الحدث                             |
| date           | TIMESTAMP | تاريخ الحدث                           |
| impact         | TEXT      | تأثير الحدث (منخفض، متوسط، عالي)      |
| country        | TEXT      | البلد المرتبط بالحدث                  |
| related_assets | TEXT[]    | الأصول المرتبطة بالحدث                |
| forecast       | TEXT      | التوقعات                              |
| previous       | TEXT      | القيمة السابقة                        |
| actual         | TEXT      | القيمة الفعلية                        |
| url            | TEXT      | رابط للمزيد من المعلومات              |
| created_by     | INTEGER   | معرف المستخدم الذي أضاف الحدث         |
| createdAt      | TIMESTAMP | تاريخ الإنشاء                         |
| updatedAt      | TIMESTAMP | تاريخ التحديث                         |

### جدول المكافآت (bonuses)

يحتوي على بيانات المكافآت والعروض الترويجية للمستخدمين.

| اسم الحقل   | النوع     | الوصف                                          |
| ----------- | --------- | ---------------------------------------------- |
| id          | UUID      | المعرف الفريد للمكافأة (المفتاح الأساسي)       |
| user_id     | INTEGER   | معرف المستخدم                                  |
| amount      | NUMERIC   | قيمة المكافأة                                  |
| currency    | TEXT      | عملة المكافأة                                  |
| type        | TEXT      | نوع المكافأة (ترحيب، إيداع، إحالة، عرض ترويجي) |
| description | TEXT      | وصف المكافأة                                   |
| status      | TEXT      | حالة المكافأة (نشطة، مستخدمة، منتهية)          |
| conditions  | JSONB     | شروط استخدام المكافأة                          |
| start_date  | TIMESTAMP | تاريخ بدء المكافأة                             |
| expiry_date | TIMESTAMP | تاريخ انتهاء المكافأة                          |
| used_amount | NUMERIC   | المبلغ المستخدم من المكافأة                    |
| created_at  | TIMESTAMP | تاريخ الإنشاء                                  |
| updated_at  | TIMESTAMP | تاريخ التحديث                                  |

### جدول الأنشطة (activities)

يحتوي على بيانات أنشطة المستخدمين على المنصة.

| اسم الحقل           | النوع     | الوصف                                                                     |
| ------------------- | --------- | ------------------------------------------------------------------------- |
| id                  | UUID      | المعرف الفريد للنشاط (المفتاح الأساسي)                                    |
| user_id             | INTEGER   | معرف المستخدم                                                             |
| type                | TEXT      | نوع النشاط (تسجيل دخول، تداول، إيداع، سحب، استلام مكافأة، استخدام مكافأة) |
| description         | TEXT      | وصف النشاط                                                                |
| metadata            | JSONB     | بيانات إضافية عن النشاط                                                   |
| ip                  | TEXT      | عنوان IP                                                                  |
| user_agent          | TEXT      | معلومات متصفح المستخدم                                                    |
| timestamp           | TIMESTAMP | وقت النشاط                                                                |
| related_entity_type | TEXT      | نوع الكيان المرتبط (صفقة، معاملة، مكافأة)                                 |
| related_entity_id   | TEXT      | معرف الكيان المرتبط                                                       |

### جدول الإحالات (referrals)

يحتوي على بيانات إحالات المستخدمين.

| اسم الحقل     | النوع     | الوصف                                   |
| ------------- | --------- | --------------------------------------- |
| id            | UUID      | المعرف الفريد للإحالة (المفتاح الأساسي) |
| referrer_id   | INTEGER   | معرف المستخدم المحيل                    |
| referred_id   | INTEGER   | معرف المستخدم المحال                    |
| referral_code | TEXT      | رمز الإحالة المستخدم                    |
| status        | TEXT      | حالة الإحالة (معلقة، مكتملة، مكافأة)    |
| reward_id     | UUID      | معرف المكافأة المرتبطة                  |
| created_at    | TIMESTAMP | تاريخ الإنشاء                           |
| completed_at  | TIMESTAMP | تاريخ اكتمال الإحالة                    |

### جدول قائمة المراقبة (watchlist)

يحتوي على بيانات قوائم مراقبة المستخدمين للأصول.

| اسم الحقل   | النوع     | الوصف                                 |
| ----------- | --------- | ------------------------------------- |
| id          | SERIAL    | المعرف الفريد للسجل (المفتاح الأساسي) |
| user_id     | INTEGER   | معرف المستخدم                         |
| symbol      | TEXT      | رمز الأصل                             |
| added_at    | TIMESTAMP | تاريخ الإضافة                         |
| notes       | TEXT      | ملاحظات المستخدم                      |
| alert_price | NUMERIC   | سعر التنبيه                           |
| createdAt   | TIMESTAMP | تاريخ الإنشاء                         |
| updatedAt   | TIMESTAMP | تاريخ التحديث                         |

### جدول المحفظة (portfolio)

يحتوي على بيانات محافظ المستخدمين.

| اسم الحقل     | النوع     | الوصف                                   |
| ------------- | --------- | --------------------------------------- |
| id            | SERIAL    | المعرف الفريد للمحفظة (المفتاح الأساسي) |
| user_id       | INTEGER   | معرف المستخدم                           |
| symbol        | TEXT      | رمز الأصل                               |
| shares        | NUMERIC   | عدد الأسهم أو الوحدات                   |
| avg_price     | NUMERIC   | متوسط سعر الشراء                        |
| purchase_date | TIMESTAMP | تاريخ الشراء                            |
| createdAt     | TIMESTAMP | تاريخ الإنشاء                           |
| updatedAt     | TIMESTAMP | تاريخ التحديث                           |

### جدول الصفقات (trades)

يحتوي على بيانات صفقات المستخدمين.

| اسم الحقل    | النوع     | الوصف                                  |
| ------------ | --------- | -------------------------------------- |
| id           | SERIAL    | المعرف الفريد للصفقة (المفتاح الأساسي) |
| user_id      | INTEGER   | معرف المستخدم                          |
| symbol       | TEXT      | رمز الأصل                              |
| type         | TEXT      | نوع الصفقة (شراء، بيع)                 |
| shares       | NUMERIC   | عدد الأسهم أو الوحدات                  |
| price        | NUMERIC   | سعر الصفقة                             |
| total        | NUMERIC   | إجمالي قيمة الصفقة                     |
| commission   | NUMERIC   | العمولة                                |
| trade_date   | TIMESTAMP | تاريخ الصفقة                           |
| used_bonus   | BOOLEAN   | هل تم استخدام مكافأة                   |
| bonus_amount | NUMERIC   | قيمة المكافأة المستخدمة                |
| bonus_id     | UUID      | معرف المكافأة المستخدمة                |
| createdAt    | TIMESTAMP | تاريخ الإنشاء                          |
| updatedAt    | TIMESTAMP | تاريخ التحديث                          |

### جدول بيانات السوق (market_data)

يحتوي على بيانات السوق الحالية للأصول.

| اسم الحقل      | النوع     | الوصف                                 |
| -------------- | --------- | ------------------------------------- |
| id             | SERIAL    | المعرف الفريد للسجل (المفتاح الأساسي) |
| symbol         | TEXT      | رمز الأصل                             |
| price          | NUMERIC   | السعر الحالي                          |
| change         | NUMERIC   | التغير في السعر                       |
| change_percent | NUMERIC   | نسبة التغير                           |
| volume         | NUMERIC   | حجم التداول                           |
| high_24h       | NUMERIC   | أعلى سعر خلال 24 ساعة                 |
| low_24h        | NUMERIC   | أدنى سعر خلال 24 ساعة                 |
| createdAt      | TIMESTAMP | تاريخ الإنشاء                         |
| updatedAt      | TIMESTAMP | تاريخ التحديث                         |

### جدول تحليل الذكاء الاصطناعي (ai_analysis)

يحتوي على بيانات تحليل الذكاء الاصطناعي للأصول.

| اسم الحقل       | النوع     | الوصف                                   |
| --------------- | --------- | --------------------------------------- |
| id              | SERIAL    | المعرف الفريد للتحليل (المفتاح الأساسي) |
| symbol          | TEXT      | رمز الأصل                               |
| analysis        | TEXT      | التحليل باللغة الإنجليزية               |
| arabic_analysis | TEXT      | التحليل باللغة العربية                  |
| indicators      | JSONB     | مؤشرات التحليل الفني                    |
| prediction      | JSONB     | التوقعات                                |
| confidence      | NUMERIC   | مستوى الثقة                             |
| createdAt       | TIMESTAMP | تاريخ الإنشاء                           |
| updatedAt       | TIMESTAMP | تاريخ التحديث                           |

### جدول الجلسات (sessions)

يحتوي على بيانات جلسات المستخدمين.

| اسم الحقل  | النوع     | الوصف                                  |
| ---------- | --------- | -------------------------------------- |
| id         | VARCHAR   | المعرف الفريد للجلسة (المفتاح الأساسي) |
| user_id    | INTEGER   | معرف المستخدم                          |
| data       | JSONB     | بيانات الجلسة                          |
| expires_at | TIMESTAMP | تاريخ انتهاء الجلسة                    |
| createdAt  | TIMESTAMP | تاريخ الإنشاء                          |
| updatedAt  | TIMESTAMP | تاريخ التحديث                          |

### جدول المعاملات (transactions)

يحتوي على بيانات المعاملات المالية للمستخدمين.

| اسم الحقل          | النوع     | الوصف                                    |
| ------------------ | --------- | ---------------------------------------- |
| id                 | UUID      | المعرف الفريد للمعاملة (المفتاح الأساسي) |
| user_id            | INTEGER   | معرف المستخدم                            |
| type               | TEXT      | نوع المعاملة (إيداع، سحب، تحويل)         |
| amount             | NUMERIC   | قيمة المعاملة                            |
| currency           | TEXT      | عملة المعاملة                            |
| status             | TEXT      | حالة المعاملة (معلقة، مكتملة، مرفوضة)    |
| transaction_date   | TIMESTAMP | تاريخ المعاملة                           |
| processed_by_admin | BOOLEAN   | هل تمت معالجتها بواسطة المشرف            |
| notes              | TEXT      | ملاحظات                                  |
| related_trade_id   | INTEGER   | معرف الصفقة المرتبطة                     |
| bonus_amount       | NUMERIC   | قيمة المكافأة المستخدمة                  |
| bonus_id           | UUID      | معرف المكافأة المستخدمة                  |
| createdAt          | TIMESTAMP | تاريخ الإنشاء                            |
| updatedAt          | TIMESTAMP | تاريخ التحديث                            |

## العلاقات بين الجداول

1. **المستخدمين والمحفظة**: كل مستخدم لديه محفظة واحدة أو أكثر، وكل محفظة تنتمي لمستخدم واحد.
2. **المستخدمين وقائمة المراقبة**: كل مستخدم لديه قائمة مراقبة واحدة أو أكثر، وكل قائمة مراقبة تنتمي لمستخدم واحد.
3. **المستخدمين والصفقات**: كل مستخدم لديه عدة صفقات، وكل صفقة تنتمي لمستخدم واحد.
4. **المستخدمين والمعاملات**: كل مستخدم لديه عدة معاملات، وكل معاملة تنتمي لمستخدم واحد.
5. **المستخدمين والجلسات**: كل مستخدم لديه عدة جلسات، وكل جلسة تنتمي لمستخدم واحد.
6. **المستخدمين والمكافآت**: كل مستخدم لديه عدة مكافآت، وكل مكافأة تنتمي لمستخدم واحد.
7. **المستخدمين والأنشطة**: كل مستخدم لديه عدة أنشطة، وكل نشاط ينتمي لمستخدم واحد.
8. **المستخدمين والإحالات**: كل مستخدم يمكن أن يكون محيلًا لعدة مستخدمين، وكل مستخدم يمكن أن يكون محالًا من قِبل مستخدم واحد.
9. **الأصول وتاريخ الأسعار**: كل أصل له عدة سجلات في تاريخ الأسعار، وكل سجل في تاريخ الأسعار ينتمي لأصل واحد.
10. **الأصول وبيانات السوق**: كل أصل له سجل واحد في بيانات السوق، وكل سجل في بيانات السوق ينتمي لأصل واحد.
11. **الأصول وتحليل الذكاء الاصطناعي**: كل أصل له عدة تحليلات، وكل تحليل ينتمي لأصل واحد.
12. **المكافآت والصفقات**: كل مكافأة يمكن استخدامها في عدة صفقات، وكل صفقة يمكن أن تستخدم مكافأة واحدة.
13. **المكافآت والمعاملات**: كل مكافأة يمكن استخدامها في عدة معاملات، وكل معاملة يمكن أن تستخدم مكافأة واحدة.
14. **المكافآت والإحالات**: كل مكافأة يمكن أن ترتبط بإحالة واحدة، وكل إحالة يمكن أن ترتبط بمكافأة واحدة.

## الفهارس

تم إنشاء الفهارس التالية لتحسين أداء قاعدة البيانات:

1. فهرس على حقل `symbol` في جدول `assets`
2. فهرس على حقل `user_id` في جدول `portfolio`
3. فهرس على حقل `user_id` في جدول `watchlist`
4. فهرس على حقل `user_id` في جدول `trades`
5. فهرس على حقل `symbol` في جدول `price_history`
6. فهرس على حقل `date` في جدول `economic_events`
7. فهرس على حقل `user_id` في جدول `bonuses`
8. فهرس على حقل `type` في جدول `bonuses`
9. فهرس على حقل `status` في جدول `bonuses`
10. فهرس على حقل `user_id` في جدول `activities`
11. فهرس على حقل `type` في جدول `activities`
12. فهرس على حقل `timestamp` في جدول `activities`
13. فهرس على حقل `referrer_id` في جدول `referrals`
14. فهرس على حقل `referred_id` في جدول `referrals`
15. فهرس على حقل `status` في جدول `referrals`
16. فهرس على حقل `bonus_id` في جدول `trades`
17. فهرس على حقل `bonus_id` في جدول `transactions`
18. فهرس على حقل `referral_code` في جدول `users`
19. فهرس على حقل `referred_by` في جدول `users`
