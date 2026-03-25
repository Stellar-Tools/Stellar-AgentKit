# Testing Guide

## Running Tests

### Local Development
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui
```

### Continuous Integration

This project uses GitHub Actions for automated testing:

#### Test Workflow (`.github/workflows/test.yml`)
- Runs on every push and pull request
- Tests against Node.js 18.x and 20.x
- Executes full test suite
- Verifies build compilation

#### Coverage Workflow (`.github/workflows/coverage.yml`)
- Generates code coverage reports
- Uploads to Codecov (if configured)
- Runs on main branch and pull requests

### Writing Tests

Tests are located in `tests/unit/` and use Vitest framework.

Example:
```typescript
import { describe, it, expect } from 'vitest';

describe('My Feature', () => {
  it('should work correctly', () => {
    expect(true).toBe(true);
  });
});
```

For more details, see [vitest.config.ts](../vitest.config.ts).
