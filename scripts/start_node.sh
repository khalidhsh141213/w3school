#!/bin/bash

# تحديد الألوان للإخراج
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # بدون لون

echo -e "${GREEN}==== تشغيل خادم Node.js ====${NC}"
echo -e "${GREEN}$(date)${NC}"

# تحديد المنفذ
export PORT=3000
echo -e "${GREEN}سيتم استخدام المنفذ: $PORT${NC}"

# إعداد تحقق من مجلد السجلات
LOGS_DIR="/home/runner/workspace/logs"
mkdir -p "$LOGS_DIR"

# إيقاف العمليات الحالية
echo -e "${YELLOW}إيقاف العمليات الحالية للـ Node.js...${NC}"
pgrep -f "node.*server" | xargs kill 2>/dev/null || true
sleep 2

# تعديل النص config للـ TSX
echo -e "${YELLOW}تكوين TSX...${NC}"
cat > /home/runner/workspace/server/tsconfig.json <<EOF
{
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "..",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2020",
    "baseUrl": "..",
    "paths": {
      "@shared/*": ["../shared/*"]
    },
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "skipLibCheck": true
  },
  "include": ["./**/*", "../shared/**/*"],
  "exclude": ["node_modules", "**/*.test.ts"]
}
EOF

# تشغيل الخادم
echo -e "${YELLOW}تشغيل الخادم...${NC}"
cd /home/runner/workspace/server
NODE_PATH=/home/runner/workspace NODE_OPTIONS="--loader ts-node/esm" \
  tsx --no-warnings \
    --tsconfig ./tsconfig.json \
    index.ts > "$LOGS_DIR/node-server.log" 2>&1 &

NODE_PID=$!
sleep 2

# التحقق من حالة الخادم
if kill -0 $NODE_PID 2>/dev/null; then
  echo -e "${GREEN}تم تشغيل خادم Node.js بنجاح. PID: $NODE_PID${NC}"
  echo -e "${GREEN}الخادم متاح على العنوان: http://0.0.0.0:$PORT${NC}"
else
  echo -e "${RED}فشل في تشغيل الخادم. تحقق من السجلات في $LOGS_DIR/node-server.log${NC}"
  cat "$LOGS_DIR/node-server.log"
fi 