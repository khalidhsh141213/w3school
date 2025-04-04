# Testing Guide

## Testing Stack

- Jest for unit testing
- React Testing Library for component testing
- MSW for API mocking
- Cypress for E2E testing

## Writing Tests

```typescript
describe('Component', () => {
  it('renders correctly', () => {
    render(<Component />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
```
