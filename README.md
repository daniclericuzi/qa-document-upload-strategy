# QA Exercise: Document Upload & Data Extraction

This repository contains a test automation solution for the Document Upload & Data Extraction feature.

## How to run

**Requirements:** Node.js 18+ and npm 9+

```bash
git clone https://github.com/daniclericuzi/qa-document-upload-strategy.git
cd qa-document-upload-strategy
npm install
```
### Running Tests
```bash
npm run test:api          # Jest API tests
npm run test:e2e          # Playwright E2E tests
npm run test:all          # All tests
```

### Running a specific test file

```bash
npx jest tests/api-extraction.test.js           # API contract tests
npx jest tests/file-validation.test.js          # file upload validation
npx playwright test tests/e2e-api-workflow.test.js  # E2E workflow
```

## Assumptions

| # | Assumption | Motivation |
|---|---|---|
| 1 | Processing is asynchronous: frontend polls for status after upload | The exercise mentions "processing may take several seconds" |
| 2 | Status endpoint returns: pending, processing, completed, failed | Standard pattern for async workflows |
| 3 | API returns structured JSON with extracted fields | Needed to define data validation approach |
| 4 | Extraction may partially succeed, some fields extracted, others missing or malformed | Explicitly mentioned in the exercise |
| 5 | Only PDF files are in scope | The exercise only mentions PDF |
| 6 | PDFs may be structured, semi-structured, or scanned (image-based) | "Technical documents" implies format variability |
| 7 | The review and edit step is optional, users may save without changes | Affects test coverage of the edit flow |
| 8 | Downstream workflows are out of scope | No access to downstream systems |
| 9 | Extraction output is non-deterministic for complex documents and tests validate structure and consistency, not exact values | ML-based systems don't guarantee same outputs across runs |

## Technical decisions

The extraction logic lives in the API, not the UI. Testing at the API layer with mocks leads to faster feedback, lower maintenance cost, and higher confidence in core contracts than E2E.

I prioritize API tests at the base of the pyramid and use mocks to create deterministic, fast, and independent tests. E2E tests are added on top for critical user-facing flows, not as the primary coverage layer.

**Jest + supertest for API tests** : Jest is reliable and used for unit and integration tests. Supertest handles HTTP assertions without extra setup. Playwright was considered but it is built for browser automation mainly and would be too heavy for isolated API tests.

**Playwright for E2E**: Used to validate the full upload → process → review → save flow. Even without UI, Playwright handles async workflows well and fits this feature.

**Service client (ApiClient)**: Centralizes all API calls in one place. If the API changes, you update the client, not every test.

**Mock**: The mock helps to keep tests deterministic and environment-independent. All contracts are based on the assumptions above.

**Performance SLA**: The system is async, so wait time is expected. The 30s p95 threshold is based on user tolerance for document processing tasks benchmarks. In a real project, this would be aligned.

**Test data**: Current suite uses in-memory Buffers, no real PDFs needed. The `test-data/` directory is for real fixtures when a live application is available.

**AI-assisted development** was used to accelerate the initial structure and documentation of this project. All generated code was reviewed, adjusted, and validated manually.

## Project structure

```
qa-document-upload-strategy/
├── TEST_STRATEGY.md              # Detailed test strategy
├── README.md                     # This file
├── package.json                  # Dependencies and scripts
├── tests/
│   ├── setup.js                 # Jest configuration
│   ├── helpers/
│   │   └── ApiClient.js         # Service client for API abstraction
│   ├── fixtures/                # Test data and API responses
│   ├── api-extraction.test.js   # Core API extraction tests
│   ├── file-validation.test.js  # File upload validation tests
│   └── e2e-api-workflow.test.js # E2E API workflow tests
├── test-data/                   # Sample PDF for testing if needed

```
