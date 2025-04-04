# Validation Guide

## Form Validation

- Zod schema validation
- Real-time validation
- Custom validation rules
- Error message handling

## Data Validation

- API request validation
- Response data validation
- WebSocket message validation
- Type checking

## Input Sanitization

- XSS prevention
- SQL injection prevention
- Data normalization
- Character encoding

## Error Messages

- User-friendly messages
- Multi-language support
- Contextual help
- Validation feedback

# Runtime Type Validation Guide

This guide explains how to use the runtime validation utilities for ensuring type safety in the Trading App.

## Table of Contents

- [Introduction](#introduction)
- [Basic Usage](#basic-usage)
- [Available Validators](#available-validators)
- [Advanced Usage](#advanced-usage)
- [Handling Validation Errors](#handling-validation-errors)
- [Integration with API Client](#integration-with-api-client)
- [Integration with WebSocket Data](#integration-with-websocket-data)
- [Automated Integration](#automated-integration)
- [Best Practices](#best-practices)
- [Example Components](#example-components)

## Introduction

While TypeScript provides static type checking at compile time, runtime type validation is crucial for ensuring that data from external sources (like API responses or WebSocket messages) conforms to expected structures. Our validation utilities allow you to:

- Validate data structures at runtime
- Provide meaningful error messages when data doesn't match expectations
- Create reusable validation schemas for common data types
- Safely process API responses and external inputs

## Basic Usage

### Importing the Validators

```typescript
import {
  string,
  number,
  boolean,
  date,
  object,
  array,
  optional,
  oneOf,
  literal,
  enumValue,
  validateApiResponse,
} from "../lib/validation";
```

### Creating and Using a Validator

```typescript
// Define a validator for a user object
const userValidator = object({
  id: string,
  name: string,
  age: number,
  isActive: boolean,
  tags: array(string),
  lastLogin: optional(date),
});

// Use the validator
try {
  const validatedUser = userValidator(userData);
  // validatedUser is now typed correctly and guaranteed to match the schema
} catch (error) {
  if (error instanceof ValidationError) {
    console.error(
      `Validation failed at ${error.path}: Expected ${error.expected}, got ${error.received}`,
    );
  }
}
```

## Available Validators

### Primitive Types

- `string()`: Validates that a value is a string
- `number()`: Validates that a value is a number (and not NaN)
- `boolean()`: Validates that a value is a boolean
- `date()`: Validates that a value is a Date object or a valid date string

### Complex Types

- `object({ key: validator, ... })`: Validates that a value is an object with specific properties
- `array(validator)`: Validates that a value is an array with items matching the specified validator
- `optional(validator)`: Makes a validator optional (allows undefined or null)
- `oneOf([validator1, validator2, ...])`: Validates that a value matches one of several validators
- `literal(value)`: Validates that a value exactly matches the specified literal value
- `enumValue(enum)`: Validates that a value is one of the specified enum values

## Advanced Usage

### Nested Validation

You can create complex validation schemas with nested objects and arrays:

```typescript
const addressValidator = object({
  street: string,
  city: string,
  zipCode: string,
  country: string,
});

const userValidator = object({
  id: string,
  name: string,
  addresses: array(addressValidator),
  primaryAddress: optional(addressValidator),
});
```

### Union Types

You can validate union types using the `oneOf` validator:

```typescript
const idValidator = oneOf([
  string, // String ID
  number, // Numeric ID
]);

const responseValidator = oneOf([
  object({ success: literal(true), data: any }), // Success response
  object({ success: literal(false), error: string }), // Error response
]);
```

### Enums

You can validate against enum values:

```typescript
enum OrderStatus {
  Pending = "pending",
  Completed = "completed",
  Cancelled = "cancelled",
}

const orderStatusValidator = enumValue(OrderStatus);
// or
const orderStatusValidator = enumValue([
  "pending",
  "completed",
  "cancelled",
] as const);
```

## Handling Validation Errors

The validation utilities throw a `ValidationError` when validation fails. This error includes:

- `path`: The path to the property that failed validation
- `expected`: The expected type
- `received`: The actual value received

```typescript
try {
  const validatedData = userValidator(data);
} catch (error) {
  if (error instanceof ValidationError) {
    console.error(
      `Validation failed at ${error.path}: Expected ${error.expected}, got ${JSON.stringify(error.received)}`,
    );
  }
}
```

## Integration with API Client

The validation utilities can be easily integrated with the API client using the `validateApiResponse` helper:

```typescript
// Safely validate API responses
import { api } from "../lib/api";
import { validateApiResponse, userValidator } from "../lib/validation";

async function fetchUser(userId: string) {
  try {
    const response = await api.users.getById(userId);

    // Validate the response
    const validatedUser = validateApiResponse(
      response,
      userValidator,
      (error) => {
        // Optional error handler
        console.error(`API validation error: ${error.message}`);
      },
    );

    if (validatedUser) {
      // Process the validated user data
      return validatedUser;
    }

    return null;
  } catch (error) {
    // Handle API errors
    console.error("API error:", error);
    return null;
  }
}
```

## Integration with WebSocket Data

The validation utilities can also be used to validate WebSocket messages, ensuring that real-time data conforms to expected structures:

```typescript
import { WebSocketManager } from "../lib/websocket/WebSocketManager";
import { validateApiResponse, object, string, number } from "../lib/validation";

// Define a validator for real-time updates
const marketUpdateValidator = object({
  type: string,
  symbol: string,
  price: number,
  volume: number,
  timestamp: string,
});

// In your component:
const wsManager = new WebSocketManager("wss://api.example.com/ws");

wsManager.subscribe("market:BTC-USD", (message) => {
  // Validate the incoming message
  const validatedMessage = validateApiResponse(
    message,
    marketUpdateValidator,
    (error) => {
      console.error("Validation error:", error);
    },
  );

  // Only process the message if it's valid
  if (validatedMessage) {
    // Update UI or state with the validated data
    updateMarketData(validatedMessage);
  } else {
    // Handle invalid message (log, ignore, or show error)
    logInvalidMessage(message);
  }
});
```

For a complete example, see the `ValidatedWebSocketExample` component, which demonstrates:

- Validating real-time WebSocket messages
- Tracking validation statistics
- Handling invalid messages
- Integrating WebSocket manager with validation utilities

## Automated Integration

The Trading App includes a script to automatically add validation to components that use the API client:

```bash
# Run from the project root
node scripts/add-validation.js
```

This script:

1. Scans all components for API client usage
2. Identifies components that don't currently use validation
3. Adds appropriate imports for validation utilities
4. Inserts validation code for each API response
5. Preserves existing code structure and logic

The script handles both async/await and Promise-based API calls, and automatically selects the appropriate validator based on the API endpoint being used.

## Best Practices

1. **Create reusable validators** for common data structures and store them in a central location.
2. **Validate all external data** including API responses, WebSocket messages, and user inputs.
3. **Handle validation errors gracefully** by providing meaningful feedback to users.
4. **Use the appropriate validator** for each data type to ensure precise validation.
5. **Keep validators in sync** with TypeScript interfaces to maintain consistency.
6. **Test your validators** to ensure they correctly validate and reject data.
7. **Use the `validateApiResponse` helper** for safe API response handling.

## Example Components

The Trading App includes two example components that demonstrate the use of validation utilities:

1. `ValidationExample` - Demonstrates API response validation

   ```tsx
   <ValidationExample symbol="BTC-USD" />
   ```

2. `ValidatedWebSocketExample` - Demonstrates WebSocket message validation
   ```tsx
   <ValidatedWebSocketExample symbol="BTC-USD" />
   ```

These components demonstrate:

- Real-time validation of API and WebSocket data
- Custom validator creation
- Error handling for validation failures
- UI feedback for validation results
- Integration with both the API client and WebSocket manager

## Common Validation Schemas

The validation library includes pre-built validators for common data structures:

- `marketDataValidator`: Validates market data objects
- `userValidator`: Validates user objects
- `portfolioValidator`: Validates portfolio objects
- `orderValidator`: Validates order objects

These can be imported and used directly:

```typescript
import { marketDataValidator } from "../lib/validation";

const validatedMarketData = validateApiResponse(response, marketDataValidator);
```

## Conclusion

Runtime validation is an essential part of building robust applications, especially when dealing with external data sources. The validation utilities provide a flexible and type-safe way to ensure data integrity throughout the application.

By incorporating these validation utilities into your workflow, you can catch data inconsistencies early, provide better error messages, and ensure that your application behaves predictably even when faced with unexpected data.
