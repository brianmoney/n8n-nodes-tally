import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	NodeOperationError,
	NodeConnectionType,
} from 'n8n-workflow';

import { tallyApiRequest } from './makeTallyRequest';

export class TallySo implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Tally.so',
		name: 'tallySo',
		icon: 'file:tally.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with Tally.so forms and submissions',
		defaults: {
			name: 'Tally.so',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'tallySoApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Form',
						value: 'form',
					},
					{
						name: 'Submission',
						value: 'submission',
					},
				],
				default: 'form',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['form'],
					},
				},
				options: [
					{
						name: 'Get All',
						value: 'getAll',
						description: 'Get all forms',
						action: 'Get all forms',
					},
					{
						name: 'Get',
						value: 'get',
						description: 'Get a single form',
						action: 'Get a form',
					},
				],
				default: 'getAll',
			},
			// Submission Operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['submission'],
					},
				},
				options: [
					{
						name: 'Get All',
						value: 'getAll',
						description: 'Get all submissions for a form',
						action: 'Get all submissions',
					},
				],
				default: 'getAll',
			},
			// Form ID for form get operation
			{
				displayName: 'Form',
				name: 'formId',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getForms',
				},
				displayOptions: {
					show: {
						resource: ['form'],
						operation: ['get'],
					},
				},
				default: '',
				required: true,
				description: 'The form to get',
			},
			// Form ID for submission operations
			{
				displayName: 'Form',
				name: 'formId',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getForms',
				},
				displayOptions: {
					show: {
						resource: ['submission'],
					},
				},
				default: '',
				required: true,
				description: 'The form to get submissions from',
			},
		],
	};

	methods = {
		loadOptions: {
			async getForms(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const data = await tallyApiRequest.call(this, '/forms');
					const forms = data.items || data || [];
					return forms.map((form: any) => ({
						name: form.name,
						value: form.id,
					}));
				} catch (error) {
					const message = error instanceof Error ? error.message : 'Unknown error';
					throw new NodeOperationError(this.getNode(), `Failed to load forms: ${message}`);
				}
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				if (resource === 'form') {
					if (operation === 'getAll') {
						const data = await tallyApiRequest.call(this, '/forms');
						const forms = data.items || data || [];
						for (const form of forms) {
							returnData.push({
								json: form,
								pairedItem: { item: i },
							});
						}
					} else if (operation === 'get') {
						const formId = this.getNodeParameter('formId', i) as string;
						const data = await tallyApiRequest.call(this, `/forms/${formId}`);
						returnData.push({
							json: data,
							pairedItem: { item: i },
						});
					}
				} else if (resource === 'submission') {
					const formId = this.getNodeParameter('formId', i) as string;
					
					if (operation === 'getAll') {
						const data = await tallyApiRequest.call(this, `/forms/${formId}/submissions`);
						
						// Handle different possible response formats
						let submissions: any[] = [];
						if (data && Array.isArray(data)) {
							submissions = data;
						} else if (data && data.items && Array.isArray(data.items)) {
							submissions = data.items;
						} else if (data && data.data && Array.isArray(data.data)) {
							submissions = data.data;
						} else if (data && data.submissions && Array.isArray(data.submissions)) {
							submissions = data.submissions;
						} else if (data) {
							// If data exists but isn't an array, return the raw response for debugging
							returnData.push({
								json: { 
									rawResponse: data, 
									note: 'Non-array response from submissions API',
									endpoint: `/forms/${formId}/submissions`
								},
								pairedItem: { item: i },
							});
							continue;
						}
						
						if (submissions.length === 0) {
							returnData.push({
								json: { message: 'No submissions found for this form', formId },
								pairedItem: { item: i },
							});
						} else {
							for (const submission of submissions) {
								returnData.push({
									json: submission,
									pairedItem: { item: i },
								});
							}
						}
					}
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: error instanceof Error ? error.message : 'Unknown error' },
						pairedItem: { item: i },
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
