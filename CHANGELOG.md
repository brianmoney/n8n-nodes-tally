# Changelog

All notable changes to this project will be documented in this file.

This project follows Keep a Changelog and Semantic Versioning.

## [1.2.0] - 2025-09-16

### Added
- Field operations: List Questions, Add Field, Update Field, Delete Field, Copy Questions, Rollback Form
- Create Form operation with POST + immediate PATCH to persist blocks; Final Status (Draft/Published/Blank)
- Safety features: Dry‑Run preview, Backup JSON output, Optimistic Concurrency checks

### Changed
- Write ops now always fetch → modify → PATCH full `blocks` to avoid destructive updates
- UI/UX improvements for safer edits and clearer warnings

### Fixed
- Resolved issues with form creation visibility and content persistence
- Improved workspace selection and cross‑account cloning behavior

## [1.0.0] - 2025-07-19

### Added
- Initial release of Tally.so n8n community node
- Form Resource: Get All Forms, Get Single Form
- Submission Resource: Get All Submissions, Get Single Submission, answer flattening, raw mode
- Webhook Resource: Create/Delete Webhook (initial)
- Error handling, credential validation, TypeScript implementation

### Technical
- Built with n8n-workflow API v1
- TypeScript
- ESLint and Prettier
- Gulp for assets
- MIT License
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-07-19

### Added
- Initial release of Tally.so n8n community node
- **Form Resource**:
  - Get All Forms operation
  - Get Single Form operation with field details
- **Submission Resource**:
  - Get All Submissions operation with pagination support
  - Get Single Submission operation
  - Automatic answer flattening for easier data processing
  - Raw data mode option
- **Webhook Resource**:
  - Create Webhook operation for real-time notifications
  - Delete Webhook operation
- Comprehensive error handling and user-friendly error messages
- API credential validation and testing
- Complete TypeScript implementation
- SVG icon for visual identification
- Load options for form selection dropdowns
- Detailed documentation and usage examples

### Features
- Full GraphQL API integration with Tally.so
- Bearer token authentication
- Submission answer flattening with field name sanitization
- Pagination support for large datasets
- Configurable limits and options
- Error recovery and continue-on-fail support

### Technical
- Built with n8n-workflow API v1
- TypeScript for type safety
- ESLint and Prettier configuration
- Gulp build system for assets
- MIT License
