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

import { tallyApiRequest, listQuestions as apiListQuestions } from './makeTallyRequest';

export class TallySo implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Tally.so',
        name: 'tallySo',
        icon: 'file:tally.svg',
        group: ['trigger', 'action'],
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
                    {
                        name: 'List Questions',
                        value: 'listQuestions',
                        description: 'List question metadata for a form',
                        action: 'List questions for a form',
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
            // Form ID for listQuestions
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
                        operation: ['listQuestions'],
                    },
                },
                default: '',
                required: true,
                description: 'The form to list questions for',
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
                    const forms = (data as any).items || data || [];
                    return (forms as any[]).map((form: any) => ({
                        name: form.name,
                        value: form.id,
                    }));
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Unknown error';
                    throw new NodeOperationError(this.getNode(), `Failed to load forms: ${message}`);
                }
            },
            async getQuestions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
                try {
                    const formId = this.getCurrentNodeParameter('formId') as string;
                    if (!formId) return [];
                    const questions = await apiListQuestions.call(this, formId);
                    return (questions as any[]).map((q: any) => ({
                        name: q.label || q.title || q.blockUuid || q.id,
                        value: q.blockUuid || q.id || q.uuid,
                        description: q.type ? `Type: ${q.type}` : undefined,
                    }));
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Unknown error';
                    throw new NodeOperationError(this.getNode(), `Failed to load questions: ${message}`);
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
                        const forms = (data as any).items || data || [];
                        for (const form of forms as any[]) {
                            returnData.push({
                                json: form,
                                pairedItem: { item: i },
                            });
                        }
                    } else if (operation === 'get') {
                        const formId = this.getNodeParameter('formId', i) as string;
                        const data = await tallyApiRequest.call(this, `/forms/${formId}`);
                        returnData.push({
                            json: data as any,
                            pairedItem: { item: i },
                        });
                    } else if (operation === 'listQuestions') {
                        const formId = this.getNodeParameter('formId', i) as string;
                        const questions = await apiListQuestions.call(this, formId);
                        for (const q of questions as any[]) {
                            returnData.push({
                                json: q,
                                pairedItem: { item: i },
                            });
                        }
                    }
                } else if (resource === 'submission') {
                    const formId = this.getNodeParameter('formId', i) as string;

                    if (operation === 'getAll') {
                        const data = await tallyApiRequest.call(this, `/forms/${formId}/submissions`);

                        // Handle different possible response formats
                        let submissions: any[] = [];
                        if (data && Array.isArray(data)) {
                            submissions = data as any[];
                        } else if ((data as any)?.items && Array.isArray((data as any).items)) {
                            submissions = (data as any).items as any[];
                        } else if ((data as any)?.data && Array.isArray((data as any).data)) {
                            submissions = (data as any).data as any[];
                        } else if ((data as any)?.submissions && Array.isArray((data as any).submissions)) {
                            submissions = (data as any).submissions as any[];
                        } else if (data) {
                            // If data exists but isn't an array, return the raw response for debugging
                            returnData.push({
                                json: {
                                    rawResponse: data,
                                    note: 'Non-array response from submissions API',
                                    endpoint: `/forms/${formId}/submissions`,
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
