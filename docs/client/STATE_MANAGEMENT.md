# State Management Guide

## Context Usage

- AuthContext for user authentication
- ThemeContext for application theming
- WebSocketContext for real-time updates
- NotificationContext for system messages

## Query Management

Using React Query for server state management:

```typescript
const { data } = useQuery(["key"], fetchFunction);
```
