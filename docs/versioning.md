# API Versioning

The API implements semantic versioning via middleware. You can specify version by:
- URL prefix: /v1/... or /api/v1/... (major only)
- Header: API-Version: 1.1.0
- Accept: application/vnd.busapi.v1
- Query: ?version=1.1.0

If no version is provided, the default version is selected based on server config (latest stable).

Response headers include:
- API-Version: effective version
- API-Latest-Version: latest available
- API-Documentation: link to docs for major version
- API-Deprecation-Info and Sunset when applicable

Breaking changes (example for 2.0.0):
- Changed booking creation response structure
- Removed legacy authentication endpoints
- Route search parameters use camelCase

Feature gates (minimum version):
- payment-integration: >= 1.1.0
- route-analytics: >= 1.1.0
- real-time-notifications: >= 2.0.0

To enforce a feature, endpoints use requireFeature('feature-key').