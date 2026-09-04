# Tucano Test GUI Roadmap

This roadmap is ordered by delivery priority. GitHub issues are the source of
truth; this document provides the sequence and the cross-repository grouping
needed by implementers and reviewers.

## P0: Release gates and tester workspace

1. [GUI #3](https://github.com/TucanoTechnology/TucanoTestGUI/issues/3) - Browser accessibility verification with Playwright and axe
2. [GUI #4](https://github.com/TucanoTechnology/TucanoTestGUI/issues/4) - ESLint and jsx-a11y support
3. [API #9](https://github.com/TucanoTechnology/TucanoTestAPI/issues/9) - Security scanning and dependency policy
4. [API #11](https://github.com/TucanoTechnology/TucanoTestAPI/issues/11) - Threat model and compatibility contract
5. [GUI #22](https://github.com/TucanoTechnology/TucanoTestGUI/issues/22) - Tester workspace shell and navigation
6. [GUI #23](https://github.com/TucanoTechnology/TucanoTestGUI/issues/23) - Folder-like test case hierarchy
7. [GUI #24](https://github.com/TucanoTechnology/TucanoTestGUI/issues/24) - Execution board and result tracking

## P1: Core workflow capability

1. [API #14](https://github.com/TucanoTechnology/TucanoTestAPI/issues/14) - Typed HTTP API and OpenAPI contract
2. [API #34](https://github.com/TucanoTechnology/TucanoTestAPI/issues/34) - Test configurations and environment matrix
3. [GUI #25](https://github.com/TucanoTechnology/TucanoTestGUI/issues/25) - Project, release, and tester context
4. [GUI #26](https://github.com/TucanoTechnology/TucanoTestGUI/issues/26) - Shared status taxonomy
5. [GUI #27](https://github.com/TucanoTechnology/TucanoTestGUI/issues/27) - Quick-create and bulk actions
6. [API #45](https://github.com/TucanoTechnology/TucanoTestAPI/issues/45) and [GUI #19](https://github.com/TucanoTechnology/TucanoTestGUI/issues/19) - Step-level uploads
7. [API #46](https://github.com/TucanoTechnology/TucanoTestAPI/issues/46) and [GUI #20](https://github.com/TucanoTechnology/TucanoTestGUI/issues/20) - Tags across resources
8. [API #47](https://github.com/TucanoTechnology/TucanoTestAPI/issues/47) and [GUI #21](https://github.com/TucanoTechnology/TucanoTestGUI/issues/21) - Duplication across resources

## P2: Execution depth and operational insight

1. [API #35](https://github.com/TucanoTechnology/TucanoTestAPI/issues/35) - Automated test result ingestion
2. [API #37](https://github.com/TucanoTechnology/TucanoTestAPI/issues/37) - Execution metrics and rollups
3. [API #38](https://github.com/TucanoTechnology/TucanoTestAPI/issues/38) - Test case versioning and audit history
4. [GUI #28](https://github.com/TucanoTechnology/TucanoTestGUI/issues/28) - Case folder and detail preview workspace
5. [GUI #29](https://github.com/TucanoTechnology/TucanoTestGUI/issues/29) and [GUI #16](https://github.com/TucanoTechnology/TucanoTestGUI/issues/16) - Reporting, trends, and analytics
6. [GUI #14](https://github.com/TucanoTechnology/TucanoTestGUI/issues/14) and [API #34](https://github.com/TucanoTechnology/TucanoTestAPI/issues/34) - Environment configuration UX
7. [GUI #15](https://github.com/TucanoTechnology/TucanoTestGUI/issues/15) and [API #36](https://github.com/TucanoTechnology/TucanoTestAPI/issues/36) - External defect linkage

## P3: Operations and polish

1. [API #6](https://github.com/TucanoTechnology/TucanoTestAPI/issues/6) - Container deployment and operational endpoints
2. [API #15](https://github.com/TucanoTechnology/TucanoTestAPI/issues/15) - Observability and operational hardening
3. [API #16](https://github.com/TucanoTechnology/TucanoTestAPI/issues/16) - Migration, performance, and future GUI readiness
4. [GUI #30](https://github.com/TucanoTechnology/TucanoTestGUI/issues/30) - Design system polish

## Ongoing governance

- [GUI #7](https://github.com/TucanoTechnology/TucanoTestGUI/issues/7) and [API #28](https://github.com/TucanoTechnology/TucanoTestAPI/issues/28) - Enable branch protection after repository visibility allows it.
- Every implementation ticket must be developed on a feature branch, linked to a pull request, reviewed, and merged before closure.
- Cross-repository features use paired API and GUI issues; the API contract should land before GUI integration when the GUI depends on new data or endpoints.