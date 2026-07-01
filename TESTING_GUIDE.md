# Testing Strategy & Setup — HDP Portal v2.0

## Overview

BUG-M005 implements comprehensive testing infrastructure covering unit tests, integration tests, E2E testing, cross-browser validation, mobile responsiveness testing, and performance analysis.

---

## 1. Unit & Integration Tests (Jest)

### Setup
- **Framework**: Jest with TypeScript support (ts-jest)
- **Environment**: jsdom for DOM testing
- **Testing Library**: @testing-library/react for component testing
- **Coverage Target**: 50%+ across all critical paths

### Test Coverage

#### Authentication Tests (`__tests__/unit/auth/`)
```bash
npm run test:unit -- auth.test
```

**Coverage:**
- ✅ Login flow with valid/invalid credentials
- ✅ Account lockout after 5 failed attempts
- ✅ JWT token validation and expiry
- ✅ Session refresh with latest role from database
- ✅ Password hashing with bcrypt
- ✅ Strong password enforcement (8+ chars, uppercase, numbers, symbols)

#### Authorization Tests (`__tests__/unit/auth/`)
```bash
npm run test:unit -- authorization.test
```

**Coverage:**
- ✅ Role-based access control (RBAC)
- ✅ Officer, Nodal Officer, Secretary, Admin routes
- ✅ OSD Admin boundary (restricted to /admin/osd/*)
- ✅ Unauthorized access prevention
- ✅ API endpoint permission checks

#### Audit Logging Tests (`__tests__/unit/lib/`)
```bash
npm run test:unit -- audit.test
```

**Coverage:**
- ✅ LOGIN_SUCCESS/FAILURE events
- ✅ LOGOUT events with IP and user-agent
- ✅ Account lockout logging
- ✅ Password change tracking
- ✅ Project modification audits
- ✅ Unauthorized access attempts
- ✅ Immutable audit trail integrity

#### API Route Tests (`__tests__/unit/api/`)
```bash
npm run test:unit -- routes.test
```

**Coverage:**
- ✅ POST /api/auth/callback/credentials
- ✅ GET /api/me (user profile)
- ✅ POST /api/auth/signout
- ✅ GET /api/officer/projects (pagination, filtering)
- ✅ GET /api/secretary/dashboard (parallel queries)
- ✅ Error handling (500, 401, 403 responses)

#### Component Tests (`__tests__/components/`)
```bash
npm run test:components
```

**Coverage:**
- ✅ OfficerUserMenu (user menu, logout)
- ✅ LoginForm (validation, error display)
- ✅ ProjectTable (empty states, pagination)
- ✅ Responsive design across breakpoints
- ✅ Touch target sizes on mobile (44x44px)

---

## 2. End-to-End Tests (Playwright)

### Setup
- **Framework**: Playwright with TypeScript
- **Browsers**: Chromium, Firefox, WebKit (desktop + mobile)
- **Report**: HTML, JSON, and JUnit XML formats

### Critical User Flows (`e2e/critical-flows.spec.ts`)

#### Cross-Browser Testing
```bash
npm run test:e2e
```

**Tested Flows:**
1. **Login Flow**
   - ✅ Successful login with valid credentials
   - ✅ JWT token generation
   - ✅ Redirect to dashboard
   - ✅ Invalid credentials error handling
   - ✅ Account lockout after 5 failures

2. **Officer Dashboard Navigation**
   - ✅ User menu visibility
   - ✅ Project list display
   - ✅ Successful logout
   - ✅ JWT blocklisting on logout

3. **Mobile Responsiveness Testing**
   - ✅ Layout stacks vertically on mobile (iPhone 12)
   - ✅ Touch targets are 44x44px minimum
   - ✅ Text is readable without zooming
   - ✅ Navigation works on mobile

4. **Authorization Boundaries**
   - ✅ OSD Admin cannot access /admin/projects
   - ✅ Unauthenticated users redirected to login
   - ✅ Role validation on API endpoints

5. **Cache Control**
   - ✅ Protected pages not cached by browser
   - ✅ Back button doesn't show cached content after logout
   - ✅ Cache-Control headers present

### Running E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run with UI (interactive mode)
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed

# Run specific browser
npx playwright test --project=chromium

# Run mobile tests only
npx playwright test --project="Mobile Chrome" --project="Mobile Safari"
```

### Browser Matrix
| Browser | Desktop | Mobile |
|---------|---------|--------|
| Chrome | ✅ | ✅ (Pixel 5) |
| Firefox | ✅ | N/A |
| Safari | ✅ | ✅ (iPhone 12) |

---

## 3. Mobile Responsiveness Testing

### Implemented Breakpoints
- **Base**: < 576px (mobile)
- **sm**: 576px (tablet)
- **md**: 768px (small desktop)
- **lg**: 1024px (large desktop)

### Tested Components
- ✅ Typography scaling (text-xl sm:text-2xl md:text-3xl lg:text-4xl)
- ✅ Layout stacking (flex-col md:flex-row)
- ✅ Touch targets (44x44px minimum)
- ✅ Navigation (mobile menu, sidebar)
- ✅ Form inputs (accessible on mobile)

### Validation Steps
```bash
npm run test:e2e -- --project="Mobile Chrome"
npm run test:e2e -- --project="Mobile Safari"
```

---

## 4. Performance Testing (Lighthouse)

### Setup
- **Tool**: Google Lighthouse
- **Metrics**: FCP, LCP, CLS, TTI, Speed Index
- **Audits**: Performance, Accessibility, Best Practices, SEO

### Running Performance Tests

```bash
# Test default URL (officer/projects)
npm run test:perf

# Test specific URL
npm run test:perf http://localhost:3000/admin/users

# Test multiple pages
npm run test:perf http://localhost:3000/
npm run test:perf http://localhost:3000/officer/projects
npm run test:perf http://localhost:3000/secretary/dashboard
```

### Performance Thresholds

| Metric | Target | Status |
|--------|--------|--------|
| First Contentful Paint (FCP) | < 1.8s | ✅ |
| Largest Contentful Paint (LCP) | < 2.5s | ✅ |
| Cumulative Layout Shift (CLS) | < 0.1 | ✅ |
| Time to Interactive (TTI) | < 3.5s | ✅ |
| Speed Index | < 2.5s | ✅ |

### Performance Audit Categories
- ✅ **Performance** (90+/100 target)
- ✅ **Accessibility** (95+/100 target)
- ✅ **Best Practices** (90+/100 target)
- ✅ **SEO** (95+/100 target)

### Reports
Results saved to `test-results/lighthouse-*.json` with:
- Scores for each category
- Core Web Vitals metrics
- Actionable recommendations
- Passed/failed audits

---

## 5. Running All Tests

### Complete Test Suite
```bash
npm run test:all
```

Runs in sequence:
1. TypeScript compilation check
2. ESLint validation
3. Unit + component tests with coverage
4. E2E tests (cross-browser, mobile)

### Individual Test Suites

```bash
# Unit tests only
npm run test:unit

# Unit tests in watch mode
npm run test:watch

# Component tests
npm run test:components

# E2E tests
npm run test:e2e

# Performance tests
npm run test:perf

# Type checking
npm run typecheck

# Linting
npm run lint
```

---

## 6. Test Reports

### Reports Generated

**Unit Tests** (`coverage/`)
- HTML coverage report
- LCOV format
- Terminal summary

**E2E Tests** (`test-results/`)
- HTML report with screenshots
- JSON results
- JUnit XML (CI/CD integration)
- Video recordings of failures
- Screenshots of failed steps

**Performance** (`test-results/lighthouse-*.json`)
- Scores by category
- Core Web Vitals metrics
- Audit details
- Actionable recommendations

### Viewing Reports

```bash
# Coverage report
open coverage/lcov-report/index.html

# Playwright HTML report
npx playwright show-report

# Lighthouse results
cat test-results/lighthouse-*.json | jq '.scores'
```

---

## 7. CI/CD Integration

### GitHub Actions Example
```yaml
name: Test Suite
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '22'
      - run: npm ci
      - run: npm run test:all
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: test-results
          path: test-results/
```

---

## 8. Test Maintenance

### Adding New Tests

1. **Unit Test Example**
```typescript
describe('Feature X', () => {
  it('should do something', () => {
    expect(true).toBe(true);
  });
});
```

2. **E2E Test Example**
```typescript
test('should complete user flow', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'test');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/dashboard');
});
```

### Best Practices
- ✅ Keep tests focused and single-purpose
- ✅ Use meaningful test descriptions
- ✅ Mock external dependencies
- ✅ Clean up after each test
- ✅ Avoid flaky tests (use explicit waits)
- ✅ Test user behavior, not implementation

---

## 9. Coverage Requirements

### Current Targets
- **Overall**: 50%+
- **Branches**: 50%+
- **Functions**: 50%+
- **Lines**: 50%+

### Critical Path Coverage
Priority coverage for:
- Authentication flows (99%)
- Authorization checks (95%)
- Audit logging (95%)
- Error handling (90%)
- API endpoints (85%)

---

## Summary

| Test Type | Framework | Coverage | Status |
|-----------|-----------|----------|--------|
| Unit Tests | Jest | Auth, Audit, APIs | ✅ |
| Component Tests | Testing Library | UI, Responsiveness | ✅ |
| E2E Tests | Playwright | Critical flows | ✅ |
| Cross-Browser | Playwright | 3 browsers + mobile | ✅ |
| Mobile Responsiveness | Playwright | iPhone + Android | ✅ |
| Performance | Lighthouse | 4 metrics + 4 audits | ✅ |

**Phase Complete**: BUG-M005 ✅
**Next**: VAPT (Security testing) + UAT (User acceptance testing)
