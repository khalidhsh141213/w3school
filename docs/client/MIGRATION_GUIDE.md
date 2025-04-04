# Migration Guide

## Version Updates

- Breaking changes
- Deprecation notices
- New features
- Migration steps

## State Management

- Context API migration
- Redux integration
- Local state management
- Performance improvements

## Component Updates

### PortfolioSummary Component

#### Before

```jsx
// Old Widget Usage
import PortfolioSummaryWidget from "@/components/portfolio/PortfolioSummaryWidget";

function Dashboard() {
  return (
    <div>
      <PortfolioSummaryWidget userId={user.id} />
    </div>
  );
}

// Old PortfolioSummary Usage
import PortfolioSummary from "@/components/common/PortfolioSummary";

function PortfolioPage() {
  return (
    <div>
      <PortfolioSummary userId={user.id} />
    </div>
  );
}
```

#### After

```jsx
// New Unified Usage
import PortfolioSummary from "@/components/common/PortfolioSummary";

function Dashboard() {
  return (
    <div>
      <PortfolioSummary userId={user.id} variant="widget" />
    </div>
  );
}

function PortfolioPage() {
  return (
    <div>
      <PortfolioSummary userId={user.id} variant="detailed" />
    </div>
  );
}

function TradingPage() {
  return (
    <div>
      <PortfolioSummary userId={user.id} variant="compact" />
    </div>
  );
}
```

#### Available Variants

- `detailed`: Full dashboard display with charts (default)
- `compact`: Smaller version for trading pages
- `dashboard`: Specialized version for the main dashboard
- `widget`: Optimized for sidebar widgets

### OrderPlacement Component

#### Before

```jsx
// Old Component Usage
import OrderPlacement from "@/components/trading/OrderPlacement";
// Or in some places
import OrderPlacementImproved from "@/components/trading/OrderPlacementImproved";

function TradingPage() {
  return (
    <div>
      <OrderPlacement
        selectedAsset={asset}
        marketData={marketData}
        userId={user.id}
      />
    </div>
  );
}
```

#### After

```jsx
// New Consolidated Usage
import OrderPlacement from "@/components/trading/OrderPlacement";

function TradingPage() {
  return (
    <div>
      <OrderPlacement
        selectedAsset={asset}
        marketData={marketData}
        userId={user.id}
      />
    </div>
  );
}
```

#### New Features

The consolidated OrderPlacement component includes:

- Enhanced validation with Zod schema
- Quick quantity selection buttons (25%, 50%, 75%, 100%)
- Improved error handling and user feedback
- Better margin warnings and balance checks
- More detailed tooltips for all controls

## Networking Updates

### WebSocket Connections

#### Before

```jsx
// Direct WebSocket handling in component
useEffect(() => {
  const ws = new WebSocket(WS_URL);

  ws.onmessage = (event) => {
    // Handle message
  };

  return () => {
    ws.close();
  };
}, []);
```

#### After

```jsx
// Using reference for proper cleanup
const isMounted = useRef(true);

useEffect(() => {
  // Function to handle WebSocket messages
  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "update" && isMounted.current) {
        // Process data
      }
    } catch (error) {
      console.error("Error handling WebSocket message:", error);
    }
  };

  // Add event listener to existing WebSocket connection
  window.addEventListener("message", handleMessage);

  // Clean up on unmount
  return () => {
    isMounted.current = false;
    window.removeEventListener("message", handleMessage);
  };
}, []);
```

## API Changes

- Endpoint updates
- Response format changes
- Authentication updates
- WebSocket improvements

## Troubleshooting

### Common Issues During Migration

#### 1. Missing Props

If you encounter errors about missing props, check the component interface:

```typescript
interface PortfolioSummaryProps {
  userId?: string;
  variant?: "compact" | "detailed" | "dashboard" | "widget";
  className?: string;
}
```

#### 2. Import Path Errors

Update import paths to use the consolidated component locations:

```jsx
// Old paths - no longer valid
import PortfolioSummaryWidget from "@/components/portfolio/PortfolioSummaryWidget";
import OrderPlacementImproved from "@/components/trading/OrderPlacementImproved";

// New paths - use these instead
import PortfolioSummary from "@/components/common/PortfolioSummary";
import OrderPlacement from "@/components/trading/OrderPlacement";
```

#### 3. Real-time Updates

The consolidated PortfolioSummary component handles real-time updates differently:

- `variant="widget"` - Uses WebSocket for real-time updates
- Other variants - Uses polling with refetchInterval

If you need real-time updates in other variants, set the variant prop to "widget".

## Testing Your Migration

After updating your components, check for:

1. Correct rendering of all variants
2. Proper error state handling
3. Working WebSocket connections and updates
4. Proper cleanup when components unmount

## Need Help?

Refer to the updated documentation or check the component source code for detailed implementation.
