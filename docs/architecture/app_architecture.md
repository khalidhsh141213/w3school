# Application Architecture

## System Overview

The application follows a microservices architecture with the following main components:

### Frontend (Client)

- React-based SPA with TypeScript
- WebSocket integration for real-time updates
- Centralized state management
- Component-based architecture

### Backend Services

- Main API Server (Node.js/Express)
- WebSocket Server for real-time data
- Market Data Service
- AI Analysis Service
- Authentication Service

### Data Storage

- PostgreSQL for persistent data
- Redis for caching
- Real-time market data streams

## Service Communication

```mermaid
graph TD
    Client[Client App] --> API[API Gateway]
    Client --> WS[WebSocket Server]
    API --> Auth[Auth Service]
    API --> Market[Market Data Service]
    API --> AI[AI Analysis]
    WS --> Market
    Market --> DB[(Database)]
    AI --> DB
```

## Security Layer

- JWT Authentication
- Role-based access control
- API rate limiting
- Data encryption

## مخطط بنية تطبيق منصة التداول

## المخطط الهيكلي

```mermaid
graph TD
    subgraph "واجهة المستخدم (Client)"
        A[App.tsx] --> |يبدأ| B[main.tsx]
        B --> C[Components]
        B --> D[Services]
        D --> D1[API Client]
        D --> D2[WebSocket Manager]
        D --> D3[Validation Utils]
        C --> C1[Examples]
        C --> C2[UI Components]

        subgraph "Scripts"
            E1[refactor-codebase.js]
            E2[add-validation.js]
            E3[find-duplicates.js]
            E4[identify-websocket-usage.js]
            E5[update-imports.js]
            E6[identify-type-issues.js]
        end
    end

    subgraph "الخادم (Server)"
        F[index.ts] --> |يبدأ| G[Routes]
        F --> H[Middleware]
        F --> I[Controllers]
        H --> H1[auth.ts]
        H --> H2[redirects.ts]
        G --> G1[admin routes]
        G --> G2[trade.ts]
        G --> G3[economic-calendar.ts]
        G --> G4[AI routes]
    end

    subgraph "خدمات الذكاء الاصطناعي (AI Services)"
        J[start-all-services.sh] --> K[start-basic-server.sh]
        J --> L[start-arabic-ai.sh]
        J --> M[start-ai-service.sh]
        J --> N[start-mock-ai.sh]
    end

    subgraph "قاعدة البيانات (Database)"
        O[PostgreSQL] --> P[Migrations]
        P --> P1[0000_initial_migration.sql]
        P --> P2[0001_add_price_data.sql]
        P --> P3[0002_add_portfolios.sql]
        P --> P4[0003_trades_currentprice...]
        P --> P5[0004_optimize_database...]
        P --> P6[0005_upgrade_economic...]
        O --> Q[Seeds]
        O --> R[Verification Scripts]
    end

    subgraph "بيانات السوق (Market Data)"
        S[update-market-data.js] --> T[Polygon API]
        S --> U[crypto-price-updater.mjs]
    end

    %% العلاقات بين المكونات الرئيسية
    D1 --> F
    D2 --> V[WebSocket Server]
    V --> F
    F --> O
    I --> O
    S --> O
    F --> J
```

## مخطط تدفق البيانات

```mermaid
flowchart TB
    subgraph "طبقة العرض (Presentation Layer)"
        A[React Components] --> B[Type-safe API Client]
        A --> C[WebSocket Manager]
    end

    subgraph "طبقة الخدمات (Service Layer)"
        B --> D[Express RESTful API]
        C --> E[WebSocket Server]
    end

    subgraph "طبقة المنطق (Business Logic)"
        D --> F[Controllers]
        E --> G[Real-time Handlers]
        F --> H[Services]
        G --> H
    end

    subgraph "طبقة الوصول للبيانات (Data Access)"
        H --> I[Database Models]
        I --> J[(PostgreSQL)]
    end

    subgraph "خدمات خارجية (External Services)"
        K[Polygon API] --> L[Market Data Updater]
        M[AI Models] --> N[Prediction Service]
        L --> H
        N --> H
    end

    %% تدفق البيانات
    O[User] --> A
    A --> O
    L --> J
    H --> J
    N --> J
```

## مخطط تشغيل التطبيق

```mermaid
sequenceDiagram
    participant User
    participant Scripts as Startup Scripts
    participant Client as Client (Vite)
    participant Server as Server (Node.js)
    participant AI as AI Services
    participant DB as Database
    participant Market as Market Data

    User->>Scripts: تشغيل npm run dev
    Scripts->>DB: تنفيذ الترحيلات (Migrations)
    Scripts->>Server: بدء تشغيل الخادم (index.ts)
    Scripts->>AI: بدء خدمات الذكاء الاصطناعي
    Scripts->>Market: بدء تحديث بيانات السوق
    Scripts->>Client: بدء تشغيل واجهة المستخدم

    Server->>DB: التحقق من اتصال قاعدة البيانات
    Server-->>User: جاهز على المنفذ 3000
    AI-->>User: جاهز على المنفذ 5000
    Client-->>User: متاح على متصفح الويب

    User->>Client: طلب البيانات
    Client->>Server: طلب API
    Server->>DB: استعلام البيانات
    DB-->>Server: نتائج الاستعلام
    Server-->>Client: استجابة API
    Client-->>User: عرض البيانات

    User->>Client: طلب بيانات مباشرة
    Client->>Server: اتصال WebSocket
    Server->>Market: الاشتراك في التحديثات
    Market-->>Server: بيانات الأسعار المباشرة
    Server-->>Client: إرسال البيانات عبر WebSocket
    Client-->>User: تحديث الواجهة
```

## مخطط دورة حياة البيانات

```mermaid
stateDiagram-v2
    [*] --> MarketData: الحصول على البيانات
    MarketData --> Validation: التحقق من صحة البيانات
    Validation --> Processing: معالجة البيانات
    Processing --> Storage: تخزين البيانات
    Processing --> AI: تحليل البيانات
    Storage --> Query: استعلام العميل
    AI --> Prediction: التنبؤ
    Prediction --> UserDisplay: عرض التنبؤات
    Query --> UserDisplay: عرض البيانات
    UserDisplay --> UserAction: تفاعل المستخدم
    UserAction --> Processing: معالجة الإجراء
    UserAction --> [*]: إنهاء الجلسة
```

## ملاحظات التنفيذ

1. **تشغيل التطبيق**:

   - يستخدم `npm run dev` لتشغيل وضع التطوير
   - يستخدم `npm run start` لوضع الإنتاج مع `NODE_ENV=production`

2. **إدارة الذكاء الاصطناعي**:

   - يتوفر API خاص بنموذج اللغة العربية
   - يمكن إعادة تشغيل خدمات الذكاء الاصطناعي بشكل مستقل

3. **إدارة قاعدة البيانات**:

   - تنفذ الترحيلات تلقائيًا عند بدء التشغيل
   - توجد أدوات للتحقق من أداء قاعدة البيانات

4. **بيانات السوق**:

   - تحديث تلقائي باستخدام وظائف Cron
   - مصدر البيانات هو Polygon API

5. **واجهة المستخدم**:
   - مكتوبة باستخدام React و TypeScript
   - تستخدم مكتبات التحقق من صحة البيانات
   - تدعم WebSocket للبيانات في الوقت الفعلي
