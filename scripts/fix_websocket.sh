#!/bin/bash

# Replace all error handling references
sed -i 's/errorService\.handleError/errorHandler.logError/g' server/websocket.ts
sed -i 's/ErrorCategory\.SECURITY/ErrorType.WEBSOCKET/g' server/websocket.ts
sed -i 's/ErrorCategory\.BUSINESS_LOGIC/ErrorType.WEBSOCKET/g' server/websocket.ts
sed -i 's/ErrorCategory\.NETWORK/ErrorType.NETWORK/g' server/websocket.ts
sed -i 's/ErrorCategory\.DATABASE/ErrorType.DATABASE/g' server/websocket.ts
sed -i 's/ErrorCategory\.SYSTEM/ErrorType.UNKNOWN/g' server/websocket.ts
sed -i 's/ErrorSeverity\.HIGH/ErrorSeverity.ERROR/g' server/websocket.ts
sed -i 's/ErrorSeverity\.MEDIUM/ErrorSeverity.ERROR/g' server/websocket.ts
sed -i 's/ErrorSeverity\.LOW/ErrorSeverity.WARNING/g' server/websocket.ts

# Fix the handleDatabaseError call
sed -i 's/errorService\.handleDatabaseError(/errorHandler.logDatabaseError(/g' server/websocket.ts

# Convert function parameter format
sed -i "s/'\([A-Z_]*\)',[[:space:]]*{/{[[:space:]]code:[[:space:]]'\1',/g" server/websocket.ts

chmod +x fix_websocket.sh
./fix_websocket.sh
