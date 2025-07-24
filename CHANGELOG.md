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
