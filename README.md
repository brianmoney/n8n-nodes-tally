# n8n-nodes-tally

This is an n8n community node that lets you interact with [Tally.so](https://tally.so) forms and submissions in your n8n workflows.

[Tally.so](https://tally.so) is a form builder that allows you to create beautiful forms and collect responses. This node enables you to:

- 📋 **Retrieve forms** - Get all your forms or fetch details for a specific form
- 📊 **Access submissions** - Pull form responses for processing and automation

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

1. Go to **Settings > Community Nodes** in your n8n instance
2. Select **Install**
3. Enter `n8n-nodes-tally` as the npm package name
4. Click **Install**

Alternatively, you can install it via npm in your n8n installation:

```bash
npm install n8n-nodes-tally
```

## Prerequisites

You need a Tally.so account and API token to use this node.

### Getting Your API Token

1. Log into your [Tally.so account](https://tally.so)
2. Go to **Settings > Integrations**
3. Find the **API** section and generate a new API token
4. Copy the token for use in n8n

> **Note:** Free tier Tally.so accounts have API access with reasonable rate limits.

## Configuration

1. In n8n, create a new **Tally.so API Token** credential
2. Paste your API token from Tally.so
3. Test the connection to verify it works

## Supported Operations

### Form Resource

#### Get All Forms
- **Purpose**: Retrieve a list of all your forms
- **Output**: Array of form objects with basic information (id, name, dates)
- **Use case**: Discover available forms for further processing

#### Get Form
- **Purpose**: Get detailed information about a specific form
- **Input**: Form ID (selected from dropdown)
- **Output**: Complete form data including fields, configuration, and metadata
- **Use case**: Inspect form structure before processing submissions

### Submission Resource

#### Get All Submissions
- **Purpose**: Retrieve all form responses for a specific form
- **Input**: Form ID (selected from dropdown)
- **Output**: Array of submission objects
- **Features**:
  - Automatic pagination handling
  - Defensive response parsing for various API response formats
  - Error handling for forms with no submissions

**Response Handling**: The node automatically handles different response formats from the Tally API:
```json
{
  "submissionId": "sub_123",
  "createdAt": "2025-01-01T00:00:00Z",
  "formId": "form_456",
  "data": { /* submission fields */ }
}
```

## Example Workflows

### 1. Form Submissions to Google Sheets

```
Tally.so (Get All Submissions) → Google Sheets (Append Row)
```

1. **Tally.so Node**: 
   - Resource: Submission
   - Operation: Get All
   - Form: Select your form

2. **Google Sheets Node**:
   - Operation: Append
   - Map submission data to sheet columns

### 2. Daily Form Analysis

```
Schedule Trigger → Tally.so (Get All Submissions) → Process Data → Send Report
```

Perfect for daily/weekly form analytics and reporting.

### 3. Form Data to Database

```
Tally.so (Get All Forms) → Tally.so (Get All Submissions) → Database (Insert)
```

1. Get all forms to discover available forms
2. For each form, retrieve submissions
3. Store in your database for analysis

## API Information

This node uses the Tally.so REST API endpoints:
- `GET /forms` - List all forms
- `GET /forms/{id}` - Get specific form details  
- `GET /forms/{id}/submissions` - Get form submissions

The node automatically handles:
- Authentication via Bearer token
- Different response formats from the API
- Error handling and user-friendly error messages
- Continue-on-fail functionality for workflow resilience

## Rate Limits

Tally.so implements rate limiting on their API. If you encounter rate limit errors:

- Reduce the frequency of your requests
- Implement retry logic with exponential backoff
- Contact Tally.so support if you need higher limits

## Error Handling

The node provides detailed error messages for common issues:

- **Invalid API token**: Check your credential configuration
- **Form not found**: Verify the form ID exists and you have access
- **Submission not found**: Check the submission ID is correct
- **Rate limit exceeded**: Implement delays between requests

## Troubleshooting

### Empty Submission Data

1. Verify the form has actual submissions
2. Check that you have the correct form ID
3. Ensure your API token has access to the form

### Connection Issues

1. Test your API credential in n8n
2. Verify your API token is valid in Tally.so
3. Check your network connectivity

### Form Not Loading

1. Ensure your API token has the correct permissions
2. Check that the form exists and hasn't been deleted
3. Verify you're using the correct form ID

## Limitations

Current limitations:

- No webhook management (webhooks not available via Tally.so public API)
- No form creation/editing capabilities
- No analytics data retrieval  
- No bulk operations
- No file upload handling for form attachments

## Version History

- **v1.0.0**: Initial release with forms and submissions
- REST API integration
- Robust error handling and response parsing
## Development
- Defensive handling of various API response formats
This repo uses the official n8n Node CLI with pnpm and Node.js >= 20.19.

- Dev server with hot reload:
## Contributing
```
pnpm dev
```

This starts an n8n instance on http://localhost:5678 and watches for changes to this node.
This is a community node. Issues, suggestions, and contributions are welcome!
- Build distributable:

```
pnpm build
```
## License
- Lint and autofix:

```
pnpm lint
pnpm lint:fix
```
[MIT](LICENSE)

## Support

- **n8n Community**: [n8n Community Forum](https://community.n8n.io)
- **Tally.so API Docs**: [Tally Developer Documentation](https://developers.tally.so)
- **Issues**: [GitHub Issues](https://github.com/brianmoney/n8n-nodes-tally/issues)

---

**Built with ❤️ for the n8n community**
