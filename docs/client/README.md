# Trading App Client

This is the client portion of the Trading App, a web application for tracking and trading financial assets.

## Project Overview

The Trading App is undergoing a significant refactoring process to improve code quality, type safety, and performance. Key improvements include:

- Consolidated components with consistent APIs
- A typed API client for backend communication
- A WebSocket manager for real-time data
- Runtime validation utilities for data integrity
- Comprehensive documentation and examples

## Getting Started

### Prerequisites

- Node.js 14+ and npm
- Replit environment

### Installation

This project is designed to be run in a Replit environment. Clone the repository and install dependencies:

```bash
npm install
```

### Running the Development Server

```bash
npm run dev
```

## Project Structure

- `/src` - Application source code
  - `/components` - React components
    - `/examples` - Example components showcasing best practices
  - `/lib` - Utilities and services
    - `/api.ts` - Typed API client
    - `/validation.ts` - Runtime validation utilities
    - `/websocket` - WebSocket management
  - `/types` - TypeScript type definitions
  - `/pages` - Page components

## Documentation

Comprehensive documentation is available in the following files:

- `IMPLEMENTATION_PLAN.md` - Overall plan for the refactoring project
- `API_CLIENT_USAGE.md` - Guide to using the typed API client
- `WEBSOCKET_USAGE.md` - Guide to using the WebSocket manager
- `VALIDATION_GUIDE.md` - Guide to using the validation utilities
- `TODO.md` - Current tasks and their status
- `COMPLETION_CHECKLIST.md` - Checklist of implementation tasks
- `IMPLEMENTATION_PROGRESS.md` - Summary of progress made

## Example Components

The project includes several example components that demonstrate best practices:

- `ValidationExample` - Demonstrates API response validation
- `ValidatedWebSocketExample` - Shows WebSocket message validation
- `AssetTracker` - Combines API client and WebSocket manager
- `MarketDataExample` - Basic market data display

You can view all these examples in the Examples page at `/examples`.

## Automation Scripts

The project includes several automation scripts to help with the refactoring process:

- `scripts/add-validation.js` - Adds validation to components that use the API client
- `scripts/find-duplicates.js` - Identifies potential duplicate components
- `scripts/identify-websocket-usage.js` - Finds components using WebSockets
- `scripts/identify-type-issues.js` - Identifies components with type issues
- `scripts/update-imports.js` - Updates import references to use consolidated components

To run these scripts individually:

```bash
node scripts/script-name.js
```

### Master Refactoring Script

For convenience, a master script is provided that runs all automation scripts in sequence:

```bash
node scripts/refactor-codebase.js
```

This script handles backing up the codebase before making changes and supports various options:

- `--dry-run` - Run without making changes
- `--components` - Run only component-related transformations
- `--validation` - Run only validation-related transformations
- `--imports` - Run only import-related transformations

Example:

```bash
# Run in dry-run mode to see what would change
node scripts/refactor-codebase.js --dry-run

# Run only validation-related transformations
node scripts/refactor-codebase.js --validation
```

## Testing

Run tests with:

```bash
npm test
```

The project includes tests for:

- API client
- WebSocket manager
- Validation utilities

## Contributing

1. Follow the code style and organization guidelines
2. Ensure all components use the shared infrastructure (API client, WebSocket manager, validation)
3. Add comprehensive tests for new components and utilities
4. Update documentation with any changes

## License

This project is proprietary and confidential.

## Contact

For questions or issues, please contact the development team.
