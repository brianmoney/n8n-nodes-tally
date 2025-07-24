# n8n-nodes-tallyso

This is an n8n community node that lets you interact with [Tally.so](https://tally.so) forms, submissions, and webhooks in your n8n workflows.

[Tally.so](https://tally.so) is a form builder that allows you to create beautiful forms and collect responses. This node enables you to:

- 📋 **Retrieve forms** - Get all your forms or fetch details for a specific form
- 📊 **Access submissions** - Pull form responses for processing and automation  
- 🔗 **Manage webhooks** - Create and delete webhooks to trigger n8n workflows in real-time

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

1. Go to **Settings > Community Nodes** in your n8n instance
2. Select **Install**
3. Enter `n8n-nodes-tallyso` as the npm package name
4. Click **Install**

Alternatively, you can install it via npm in your n8n installation:

```bash
npm install n8n-nodes-tallyso
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
- **Purpose**: Retrieve form responses for a specific form
- **Inputs**: 
  - Form ID (required)
  - Limit (default: 100, max: 1000)
  - Return Raw Data (boolean)
- **Output**: Array of submission objects
- **Features**:
  - Automatic answer flattening for easier processing
  - Raw mode preserves original GraphQL structure
  - Pagination support (returns up to specified limit)

#### Get Submission
- **Purpose**: Retrieve a single submission by ID
- **Inputs**: Form ID, Submission ID
- **Output**: Single submission object with same flattening options

**Answer Flattening**: By default, submissions are flattened to make them easier to work with:
```json
{
  "submissionId": "sub_123",
  "createdAt": "2025-01-01T00:00:00Z",
  "answers": {
    "name": "John Doe",
    "email": "john@example.com",
    "message": "Hello world"
  },
  "_raw": { /* original submission data */ }
}
```

### Webhook Resource

#### Create Webhook
- **Purpose**: Register a webhook to receive real-time submission notifications
- **Inputs**:
  - Form ID (required)
  - Destination URL (required - your n8n webhook URL)
- **Output**: Created webhook details
- **Prerequisites**: 
  - Create an n8n Webhook node first
  - Copy the **production** webhook URL (not test URL)
  - Ensure the webhook accepts POST requests

#### Delete Webhook
- **Purpose**: Remove an existing webhook registration
- **Inputs**: Webhook ID
- **Output**: Success confirmation

## Example Workflows

### 1. Form Submissions to Google Sheets

```
Tally.so (Get All Submissions) → Google Sheets (Append Row)
```

1. **Tally.so Node**: 
   - Resource: Submission
   - Operation: Get All
   - Form: Select your form
   - Return Raw Data: false (for flattened answers)

2. **Google Sheets Node**:
   - Operation: Append
   - Map submission answers to sheet columns

### 2. Real-time Webhook to Slack

```
Webhook (Trigger) → Tally.so (optional processing) → Slack (Send Message)
```

1. **Webhook Node**: Create webhook and copy URL
2. **Tally.so Node**: 
   - Resource: Webhook  
   - Operation: Create
   - Destination URL: Paste your webhook URL
3. **Slack Node**: Send formatted notification

### 3. Form Analysis Pipeline

```
Schedule Trigger → Tally.so (Get All Submissions) → Process Data → Send Report
```

Perfect for daily/weekly form analytics and reporting.

## Pagination

For large forms with many submissions, use the limit parameter and implement pagination:

1. Start with `Get All Submissions` with a reasonable limit (100-500)
2. Process the results
3. If you need more data, check the `hasNextPage` field in raw mode
4. Use the `endCursor` for subsequent requests

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

### Webhook Not Receiving Data

1. Verify you're using the **production** webhook URL from n8n
2. Ensure your n8n webhook node accepts POST requests
3. Check that the webhook was created successfully in Tally.so
4. Test the webhook URL manually with a tool like Postman

### Empty Submission Data

1. Verify the form has actual submissions
2. Check that you have the correct form ID
3. Ensure your API token has access to the form

### Connection Issues

1. Test your API credential in n8n
2. Verify your API token is valid in Tally.so
3. Check your network connectivity

## Limitations

Current MVP limitations:

- No form creation/editing capabilities
- No analytics data retrieval  
- Submission pagination requires multiple requests
- No bulk operations
- No file upload handling for form attachments

## Version History

- **v1.0.0**: Initial release with forms, submissions, and webhooks
- Full GraphQL API integration
- Automatic answer flattening
- Webhook management
- Comprehensive error handling

## Contributing

This is a community node. Issues, suggestions, and contributions are welcome!

## License

[MIT](LICENSE)

## Support

- **n8n Community**: [n8n Community Forum](https://community.n8n.io)
- **Tally.so Docs**: [API Documentation](https://tally.so/help/integrations)
- **Issues**: [GitHub Issues](https://github.com/brian/n8n-nodes-tally/issues)

---

**Built with ❤️ for the n8n community**
