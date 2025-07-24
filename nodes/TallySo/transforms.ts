/**
 * Flatten a Tally submission into a more usable format
 */
export function flattenSubmission(submission: any, form?: any): any {
	const flattened: Record<string, any> = {
		submissionId: submission.id,
		createdAt: submission.createdAt,
		answers: {},
		_raw: submission,
	};

	// Create field mapping from form data if available
	const fieldMap =
		form?.fields?.reduce((acc: any, field: any) => {
			acc[field.id] = field.label || field.id;
			return acc;
		}, {}) || {};

	// Process answers
	for (const answer of submission.answers || []) {
		const key =
			fieldMap[answer.fieldId] ||
			answer.question ||
			answer.fieldId ||
			`field_${Object.keys(flattened.answers).length}`;
		
		// Sanitize key name for easier access
		const sanitizedKey = key.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
		flattened.answers[sanitizedKey] = answer.value;
	}

	return flattened;
}

/**
 * Sanitize field name for object keys
 */
export function sanitizeFieldName(name: string): string {
	return name
		.replace(/[^a-zA-Z0-9_\s]/g, '')
		.replace(/\s+/g, '_')
		.toLowerCase();
}
