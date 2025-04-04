# Component Structure Documentation

This document outlines the organization and structure of the components in the application. The goal is to maintain a clean, well-organized codebase with minimal duplication and logical grouping of components.

## Directory Structure

```
src/
├── components/
│   ├── common/       # Shared components
│   ├── dashboard/    # Dashboard components
│   ├── trading/     # Trading components
│   ├── portfolio/   # Portfolio components
│   └── ui/          # UI primitives
├── hooks/           # Custom React hooks
├── services/        # API and WebSocket services
└── utils/          # Utility functions
```

## Component Types

### Common Components

These are shared components that can be used in multiple features, such as:

- `PortfolioSummary.tsx` - A unified portfolio summary component with variants
- `AiChatBox.tsx` - Chat interface for AI interactions
- `MarketTicker.tsx` - Real-time market ticker display

### Feature-Specific Components

Components that are specific to a feature area:

- `dashboard/` - Components specifically for the dashboard
- `trading/` - Trading components like `OrderPlacement.tsx`
- `portfolio/` - Components related to portfolio management

### UI Components

Base UI components that implement design system elements:

- `button.tsx`, `card.tsx`, `input.tsx`, etc.
- These components should be kept simple and focused on presentation

## Services

Centralized services for API interactions:

- `aiService.ts` - Handles AI-related API calls
- `authService.ts` - Authentication service
- `marketService.ts` - Market data service

## Best Practices

1. **Component Organization**:

   - Place components in the appropriate directory based on their purpose
   - Use the `common/` directory for shared components

2. **Component Variants**:

   - Use props to define variants rather than creating duplicate components
   - Example: `<PortfolioSummary variant="dashboard" />` vs. separate components

3. **Imports**:

   - Import components using absolute paths, e.g., `@/components/ui/button`
   - Group imports by type (React, components, hooks, types)

4. **Component Structure**:

   - Keep components focused on a single responsibility
   - Extract complex logic to custom hooks
   - Use composition over inheritance

5. **UI Components**:
   - Maintain consistent styling and behavior across UI components
   - Document component props with appropriate TypeScript types
   - Consider merging related UI components (e.g., alert and alert-dialog)

## Component Merging Guidelines

When two components have similar functionality, consider merging them:

1. Identify common functionality and props
2. Create a unified component with variants or options
3. Use sensible defaults for backward compatibility
4. Update imports throughout the codebase
5. Remove the duplicate component

## Recent Merges

- `PortfolioSummary` - Combined dashboard and trading variants
- `OrderPlacement` - Merged with `OrderPlacementImproved`
- `alert.tsx` - Combined alert and alert-dialog functionality

## Maintenance

Regularly review the component structure for:

- Unused components that can be removed
- Duplicated functionality that can be merged
- Components that could be moved to more appropriate directories
- Opportunities to extract common patterns into shared components

## Component Guidelines

- Use TypeScript for all components
- Implement error boundaries
- Follow React best practices
- Maintain consistent styling
- Include proper documentation

## State Management

- React Context for global state
- Local state for component-specific data
- Redux for complex state management
- Proper state initialization

## Performance Optimization

- Memoization where needed
- Lazy loading for routes
- Code splitting
- Bundle optimization
