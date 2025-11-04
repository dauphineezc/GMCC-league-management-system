# Testing Guide

## Overview

This project uses **Jest** and **React Testing Library** for automated testing. The test suite covers:

- ✅ Unit tests for core business logic (permissions, divisions, utilities)
- ✅ Integration tests for API routes
- 🔄 Component tests (React Testing Library)
- 🔄 End-to-end tests (future: Playwright or Cypress)

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## Test Structure

```
src/
├── lib/
│   ├── __tests__/
│   │   ├── permissions.test.ts      # Permission system logic
│   │   ├── divisions.test.ts        # Division utilities
│   │   └── orgAccess.test.ts        # Email-based access control
├── app/
│   └── api/
│       └── __tests__/
│           ├── teams.test.ts              # Team creation API
│           └── divisions-usage.test.ts    # Division validation
```

## What's Tested

### Core Business Logic

**Permissions (`src/lib/permissions.ts`)**
- ✅ Permission level checking (`hasLeaguePermission`)
- ✅ Role assignment (`getUserLeagueRole`)
- ✅ Permission checker class methods

**Divisions (`src/lib/divisions.ts`)**
- ✅ Division normalization (handles various input formats)
- ✅ Division ID validation
- ✅ Alias handling (case-insensitive)
- ✅ Type guards

**Organizational Access (`src/lib/orgAccess.ts`)**
- ✅ Email domain checking
- ✅ Superadmin email detection
- ✅ Environment variable configuration

### API Endpoints

**Team Creation (`/api/teams`)**
- ✅ Authentication required
- ✅ Team name validation
- ✅ Division/league assignment
- ✅ Default field handling
- ✅ Invalid input rejection

## Test Coverage Goals

| Category | Current Coverage | Goal |
|----------|-----------------|------|
| Core Logic | ~90% | 95% |
| API Routes | ~40% | 80% |
| Components | 0% | 60% |
| E2E | 0% | 30% |

## Writing New Tests

### Unit Test Example

```typescript
import { normalizeDivision } from '@/lib/divisions';

describe('normalizeDivision', () => {
  it('should handle valid inputs', () => {
    expect(normalizeDivision('4v4')).toBe('4v4');
  });

  it('should return null for invalid inputs', () => {
    expect(normalizeDivision('invalid')).toBe(null);
  });
});
```

### API Test Example

```typescript
import { POST } from '../teams/route';

jest.mock('@vercel/kv', () => ({
  kv: {
    set: jest.fn().mockResolvedValue('OK'),
    // ... other mocks
  },
}));

describe('/api/teams', () => {
  it('should create team successfully', async () => {
    const req = new Request('...', { /* ... */ });
    const response = await POST(req);
    expect(response.status).toBe(200);
  });
});
```

### Component Test Example

```typescript
import { render, screen } from '@testing-library/react';
import { Component } from '@/components/Component';

describe('Component', () => {
  it('should render correctly', () => {
    render(<Component />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
});
```

## Mocking Strategies

### External Services

**Vercel KV**
```typescript
jest.mock('@vercel/kv', () => ({
  kv: {
    get: jest.fn(),
    set: jest.fn(),
    sadd: jest.fn(),
    // ... other methods
  },
}));
```

**Firebase Admin**
```typescript
jest.mock('@/lib/firebaseAdmin', () => ({
  adminAuth: {
    verifySessionCookie: jest.fn(),
    verifyIdToken: jest.fn(),
  },
}));
```

### Environment Variables

```typescript
const originalEnv = process.env.MY_VAR;

beforeEach(() => {
  process.env.MY_VAR = 'test-value';
});

afterEach(() => {
  process.env.MY_VAR = originalEnv;
});
```

## Best Practices

1. **Test Behavior, Not Implementation**
   - ✅ Test that permissions work correctly
   - ❌ Don't test internal variable names

2. **Use Descriptive Test Names**
   - ✅ `should allow admin access to league admins`
   - ❌ `test admin`

3. **Keep Tests Isolated**
   - Each test should be independent
   - Use `beforeEach` and `afterEach` for setup/cleanup

4. **Mock External Dependencies**
   - Always mock KV, Firebase, and other services
   - Don't make real API calls in tests

5. **Cover Edge Cases**
   - Test null/undefined inputs
   - Test boundary conditions
   - Test error paths

## Continuous Integration

Tests run automatically on:
- Every pull request
- Every push to `main`
- Before deployment

See `.github/workflows` for CI configuration (if applicable).

## Future Improvements

- [ ] Add Playwright for E2E tests
- [ ] Increase API route coverage
- [ ] Add visual regression tests
- [ ] Set up test coverage reporting in CI/CD
- [ ] Add performance benchmarks
- [ ] Add accessibility tests

## Troubleshooting

### Tests are failing locally

1. Make sure all dependencies are installed: `npm install`
2. Clear Jest cache: `npm test -- --clearCache`
3. Check environment variables are set correctly

### Tests pass locally but fail in CI

1. Check for hardcoded absolute paths
2. Verify all environment variables are set in CI
3. Ensure Node.js version matches

### Coverage is low

1. Identify untested files: `npm run test:coverage`
2. Prioritize critical business logic
3. Add tests incrementally

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Next.js Testing](https://nextjs.org/docs/app/building-your-application/testing)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

