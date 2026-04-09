# Test Strategy: Document Upload & Data Extraction Feature

## Summary

This test strategy describes a risk-based approach to testing the Document Upload & Data Extraction feature.

**Feature Overview**: Users upload PDF documents, the system extracts structured data, users review and are able to edit the data, and the data is saved for downstream workflows.

## Scope

### In Scope

- PDF upload functionality (file validation, size limits, format checking)
- API processing: request and response contracts, status transitions, error codes
- Data extraction: structure validation, required fields, acceptable value ranges
- Data review and editing flow
- Data persistence and workflow integration
- Error scenarios and user feedback
- Non-deterministic output behaviour (consistency and structural validation)

### Out of Scope

- Internals of the extraction model (considered as a black box; testing focuses on the API contract, not the algorithm)
- Load testing beyond basic performance validation (processing timeout behaviour is in scope)
- Downstream workflow validation (validation happens at the persistence limit)

## Types of Testing

Coverage decisions follow the testing pyramid with more tests at the base (fast, stable), fewer at the top (slow, high maintenance cost). The version applied here is adapted to this exercise (no access to source code, live API, or UI)

| Layer | Type | Approach |
|---|---|---|
| Base | Mock API (contract tests) | Tests validate the contracts defined in assumptions |
| Middle | Integration (mock) — status transitions, polling, partial failures | Simulated async behavior via mock responses |
| Top | E2E (happy path and critical failure path )| Full end user flow |
| Outside | Exploratory / manual | Edge cases and non-deterministic output patterns |

### Test Types & Priorities

| Test Type | Priority | Coverage Focus | Automation Level |
|-----------|----------|----------------|------------------|
| **API Integration** | High | Data extraction accuracy, error handling | Fully Automated |
| **End-to-End** | Medium | Complete user journey, data persistence | Semi-Automated |
| **Performance** | Medium | Processing time, file size limits | Automated Checks |
| **Security** | Medium | File validation, injection prevention | Manual + Automated |

## Key Test Scenarios

### Happy Path Scenario

   1. User uploads a valid, structured PDF  
   2. Application confirms upload and starts processing  
   3. Status transitions correctly: `pending > processing > completed`  
   4. Extracted data is shown with expected fields populated  
   5. User saves without editing (Expected Result: data is persisted correctly) 
   6. User edits one or more fields and saves (Expected Result: corrected data is persisted) 

### Edge Cases & Error Scenarios

| Scenario | Expected behaviour |
|---|---|
| Corrupted PDF | Fails with an error message |
| Empty PDF | Handled successfully and user informed |
| Unsupported format (.docx, .png) | Rejected at upload with a descriptive message |
| File exceeds size limit | Rejected before processing begins |
| Image based PDF | Processed with partial or degraded extraction; user informed |
| PDF with special characters or unusual encoding | Extracted without data loss |
| API timeout | User gets a timeout message |
| Partial extraction | Partial result returned and missing fields clearly indicated |
| Processing service unavailable | Upload rejected and user is informed |
| Same PDF processed twice | Both results have identical structure and required fields |
| PDF with ambiguous layout | Output is structurally valid even if values differ |
| Missing optional fields | System handles absence successfully |
| User edits all extracted fields | All edits persisted correctly |
| User submits with required fields empty | Validation error shown and submission blocked |
| User abandons mid-edit | No orphaned data left behind |
| User retries after a failure | Previous failed state does not impact  with new attempt |

## Test Data Strategy

| Data type | Purpose |
|---|---|
| Simple structured PDF | Small, valid PDFs with known extraction results (known input, known expected output) |
| Complex PDF | Handles documents with multiple columns |
| Image based PDF | Tests partial extraction and fallback behaviour |
| Corrupted PDF | Validates rejection and error messaging |
| Oversized PDF | Validates size limit enforcement |
| PDF with special characters | Validates data integrity during extraction |
| Empty PDF | Validates handling empty files |
| Unsupported files | Validates format rejection at upload limit |

## Manual vs Automated Testing Approach

### Automate first

1. **API tests**: The core business logic, validate: response structure, status codes, required fields  
2. **Happy path E2E** : upload > process > extract > save  
3. **File upload validation**: invalid formats, size limits  
4. **Error handling**: timeouts, processing failures, missing fields  

### Keep manual

- Exploratory to discover unscripted scenarios
- Complex PDF variations where expected output needs human expertise  
- Non-deterministic output across multiple runs  
- UI and UX flow 
- Scenarios that are hard to reproduce reliably (avoid flaky tests)

## Release Readiness Criteria

- [ ] 80%+ of critical paths (P1 and P2 from the risk matrix) are covered by automated tests
- [ ] No data loss observed across the full upload → extract → save flow
- [ ] Edited data is correctly persisted in 100% of automated test runs
- [ ] All P1 and P2 automated tests pass consistently
- [ ] All failure modes produce explicit, user-facing error messages (no silent failures)
- [ ] Processing timeout is handled with user notification
- [ ] 95% processing time is under 30 seconds
- [ ] File validation rejects unsupported formats, corrupted files, and files exceeding the size limit

## Risk Assessment

| # | Risk | Probability | Impact | Priority |
|---|---|---|---|---|
| R1 | Extraction returns incorrect or incomplete data | High | High | P1 |
| R2 | Processing fails with no feedback to the user | High | High | P1 |
| R3 | Upload accepts invalid, corrupted, or malicious files | Medium-High | High | P1 |
| R4 | Edited data is not correctly saved | Medium | High | P2 |
| R5 | Performance degrades with large or complex documents | Medium | Medium-High | P2 |
| R6 | Integration contract with downstream workflows breaks | Low-Medium | High | P3 |

### Risk justification

**R1 — Extraction accuracy**
Extraction errors are often silent: the system doesn't crash, it just returns wrong data and it leads to downstream workflows, which is expensive to find and fix.

**R2 — Silent failure**
Async systems can have poor failure handling and without clear feedback, users don't know whether to wait, retry, or report leading to duplicate submissions and dirty data.

**R3 — File validation**
Developers tend to focus on the happy path, leaving upload validation incomplete. Two risks: security (PDFs can carry malicious content) and
malformed or oversized files can crash the processing worker.

**R4 — Data persistence after edit**
After reviewing and correcting the extracted data, the user expects their changes to be saved. If edits are lost due to a sync issue between editing and processing, the user loses trust and the correction effort was wasted.

**R5 — Performance with large documents**
Technical documents usually are long and dense. The risk is not only load, it's a large PDF timing out silently.

**R6 — Downstream contract**
The feature is new, so the data contract with downstream systems may still change. Lower probability, but if it breaks it can affect many users without immediate visibility.

### Risk Mitigation

| # | Risk | Mitigation |
|---|---|---|
| R1 | Extraction accuracy | Validate response structure and required fields across tests; use test datasets with known values and avoid exact matching for non-deterministic outputs |
| R2 | Silent failure | Verify all status transitions, including failure states. Ensure that every failure is clearly communicated to the user and that no processing state remains without a response |
| R3 | File validation | Reject invalid formats, corrupted files, and oversized uploads |
| R4 | Data persistence | Implement automated tests covering save-after-edit scenarios. Confirm that persisted data matches user input across partial edits, full edits, and unchanged submissions |
| R5 | Performance | Define a clear SLA (e.g. p95 under 30 seconds) and validate timeout handling with user feedback |
| R6 | Downstream contract | Validate the data structure before it is sent downstream |

## Next Steps

These items were left out to keep the solution focused, but would be the natural next steps in a real project.

- **Shared mock server**: mock logic is duplicated across test files. Moving it to `tests/helpers/mockServer.js` would reduce maintenance cost
- **Status transitions**: a dedicated test for the full `pending > processing > completed > failed` was identified as P1 in the risk matrix but only one was implemented in this suite, it's important expanded coverage of status transitions
- **TypeScript migration**: the current structure is already compatible as is in JS. Migrating would add type safety to API responses and fixtures, and align with real project tooling standards
- **Real PDF fixtures**: replacing Buffers with real documents
- **CI/CD + Regression strategy**: next step would be a GitHub Actions workflow running critical tests (P1/P2) on every pull request and the full suite on release branches, blocking merges on failure

### Proposed Pyramid for real world

With access to source code, API, and UI, the pyramid would be:

| Layer | Type | 
|---|---|
| Base | Unit tests (isolated functions, parsers, validators) |
| Middle | Service or API tests (contracts, status codes, error handling) and Integration tests (communication) |
| Top | E2E tests (critical end user flows) |
| Outside | Exploratory / manual (edge cases, non-deterministic outputs) |

### Observability & Metrics

Monitoring and observability should be in place to track extraction failures, processing time, and error rates to support continuous improvements and quick answers to issues. Key elements include logs to trace failures, different error codes per failure type, and track when the status changes (like from "pending" to "completed").

**What to monitor in production**
- Processing time per document
- Extraction failure rate
- Partial extraction rate (fields missing vs total fields expected)
- Upload rejection rate by reason (size, format, corruption)