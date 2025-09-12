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

import {
    tallyApiRequest,
    listQuestions as apiListQuestions,
    getForm as apiGetForm,
    updateForm as apiUpdateForm,
} from './makeTallyRequest';
import {
    cloneBlocks,
    findBlockByUuid,
    findBlockByLabel,
    newBlockTemplate,
    insertBlock,
    replaceBlock,
    removeBlocks,
    updateSelectOptions,
    stripOrRegenUuid,
    ensureUniqueUuids,
} from './blockUtils';
import { diffBlocks } from './diff';

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
                    {
                        name: 'Add Field',
                        value: 'addField',
                        description: 'Add a field (question) to a form. WARNING: This rewrites the form blocks via PATCH.',
                        action: 'Add a field',
                    },
                    {
                        name: 'Update Field',
                        value: 'updateField',
                        description: 'Update a field’s payload or label. WARNING: This rewrites the form blocks via PATCH.',
                        action: 'Update a field',
                    },
                    {
                        name: 'Delete Field',
                        value: 'deleteField',
                        description: 'Delete one or more fields. WARNING: This rewrites the form blocks via PATCH.',
                        action: 'Delete field(s)',
                    },
                    {
                        name: 'Sync Select Options',
                        value: 'syncSelectOptions',
                        description: 'Sync select options from incoming items. WARNING: This rewrites the form blocks via PATCH.',
                        action: 'Sync select options',
                    },
                    {
                        name: 'Copy Questions',
                        value: 'copyQuestions',
                        description: 'Copy questions from one form to another (UUIDs regenerated). WARNING: This rewrites the destination form blocks via PATCH.',
                        action: 'Copy questions between forms',
                    },
                    {
                        name: 'Rollback Form',
                        value: 'rollbackForm',
                        description: 'Rollback a form to a previous JSON (from backup output). WARNING: This rewrites the form blocks via PATCH.',
                        action: 'Rollback a form',
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
            // Common: Form for write ops
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
                        operation: ['addField','updateField','deleteField','syncSelectOptions','rollbackForm'],
                    },
                },
                default: '',
                required: true,
                description: 'Target form to update',
            },
            // Add Field inputs
            {
                displayName: 'Field Type',
                name: 'fieldType',
                type: 'string',
                displayOptions: {
                    show: {
                        resource: ['form'],
                        operation: ['addField'],
                    },
                },
                default: 'input',
                description: 'Tally block type (e.g., input, select, textarea)',
            },
            {
                displayName: 'Label',
                name: 'label',
                type: 'string',
                displayOptions: {
                    show: {
                        resource: ['form'],
                        operation: ['addField'],
                    },
                },
                default: '',
                required: true,
            },
            {
                displayName: 'Payload (JSON)',
                name: 'payload',
                type: 'json',
                displayOptions: {
                    show: {
                        resource: ['form'],
                        operation: ['addField'],
                    },
                },
                default: '{}',
                description: 'Type-specific payload to set on the block',
            },
            {
                displayName: 'Position Mode',
                name: 'positionMode',
                type: 'options',
                options: [
                    { name: 'End (Default)', value: 'end' },
                    { name: 'Index', value: 'index' },
                    { name: 'Before Block', value: 'before' },
                    { name: 'After Block', value: 'after' },
                ],
                default: 'end',
                displayOptions: { show: { resource: ['form'], operation: ['addField'] } },
            },
            {
                displayName: 'Index',
                name: 'positionIndex',
                type: 'number',
                typeOptions: { minValue: 0 },
                displayOptions: { show: { resource: ['form'], operation: ['addField'], positionMode: ['index'] } },
                default: 0,
            },
            {
                displayName: 'Reference Block UUID',
                name: 'positionRefUuid',
                type: 'string',
                displayOptions: { show: { resource: ['form'], operation: ['addField'], positionMode: ['before','after'] } },
                default: '',
            },
            // Update/Delete/Sync: target selector
            {
                displayName: 'Select By',
                name: 'targetSelectBy',
                type: 'options',
                options: [
                    { name: 'UUID', value: 'uuid' },
                    { name: 'Label', value: 'label' },
                ],
                default: 'uuid',
                displayOptions: { show: { resource: ['form'], operation: ['updateField','deleteField','syncSelectOptions'] } },
            },
            {
                displayName: 'Field UUID',
                name: 'targetFieldUuid',
                type: 'string',
                displayOptions: { show: { resource: ['form'], operation: ['updateField','deleteField','syncSelectOptions'], targetSelectBy: ['uuid'] } },
                default: '',
            },
            {
                displayName: 'Field Label',
                name: 'targetFieldLabel',
                type: 'string',
                displayOptions: { show: { resource: ['form'], operation: ['updateField','deleteField','syncSelectOptions'], targetSelectBy: ['label'] } },
                default: '',
                description: 'Exact label match (resolved via questions endpoint)'
            },
            // Update Field inputs
            {
                displayName: 'Merge Strategy',
                name: 'mergeStrategy',
                type: 'options',
                options: [
                    { name: 'Merge Payload', value: 'merge' },
                    { name: 'Replace Payload', value: 'replace' },
                ],
                default: 'merge',
                displayOptions: { show: { resource: ['form'], operation: ['updateField'] } },
            },
            {
                displayName: 'Payload Patch (JSON)',
                name: 'payloadPatch',
                type: 'json',
                default: '{}',
                displayOptions: { show: { resource: ['form'], operation: ['updateField'] } },
            },
            // Delete Field multiple selection (UUIDs/Labels)
            {
                displayName: 'Field UUIDs',
                name: 'targetFieldUuids',
                type: 'string',
                typeOptions: { multipleValues: true, multipleValueButtonText: 'Add UUID' },
                default: [],
                displayOptions: { show: { resource: ['form'], operation: ['deleteField'], targetSelectBy: ['uuid'] } },
            },
            {
                displayName: 'Field Labels',
                name: 'targetFieldLabels',
                type: 'string',
                typeOptions: { multipleValues: true, multipleValueButtonText: 'Add Label' },
                default: [],
                displayOptions: { show: { resource: ['form'], operation: ['deleteField'], targetSelectBy: ['label'] } },
            },
            // Sync Select Options inputs
            {
                displayName: 'Preserve Extras',
                name: 'preserveExtras',
                type: 'boolean',
                default: false,
                description: 'If enabled, keep existing options not present in input; otherwise replace all',
                displayOptions: { show: { resource: ['form'], operation: ['syncSelectOptions'] } },
            },
            // Copy Questions inputs
            {
                displayName: 'Source Form',
                name: 'sourceFormId',
                type: 'options',
                typeOptions: { loadOptionsMethod: 'getForms' },
                displayOptions: { show: { resource: ['form'], operation: ['copyQuestions'] } },
                default: '',
                required: true,
            },
            {
                displayName: 'Destination Form',
                name: 'destFormId',
                type: 'options',
                typeOptions: { loadOptionsMethod: 'getForms' },
                displayOptions: { show: { resource: ['form'], operation: ['copyQuestions'] } },
                default: '',
                required: true,
            },
            {
                displayName: 'Question UUIDs to Copy',
                name: 'questionIds',
                type: 'string',
                typeOptions: { multipleValues: true, multipleValueButtonText: 'Add UUID' },
                displayOptions: { show: { resource: ['form'], operation: ['copyQuestions'] } },
                default: [],
                required: true,
            },
            {
                displayName: 'Insert Position Mode',
                name: 'insertPositionMode',
                type: 'options',
                options: [
                    { name: 'End (Default)', value: 'end' },
                    { name: 'Index', value: 'index' },
                    { name: 'Before Block', value: 'before' },
                    { name: 'After Block', value: 'after' },
                ],
                default: 'end',
                displayOptions: { show: { resource: ['form'], operation: ['copyQuestions'] } },
            },
            {
                displayName: 'Insert Index',
                name: 'insertIndex',
                type: 'number',
                typeOptions: { minValue: 0 },
                displayOptions: { show: { resource: ['form'], operation: ['copyQuestions'], insertPositionMode: ['index'] } },
                default: 0,
            },
            {
                displayName: 'Insert Ref UUID',
                name: 'insertRefUuid',
                type: 'string',
                displayOptions: { show: { resource: ['form'], operation: ['copyQuestions'], insertPositionMode: ['before','after'] } },
                default: '',
            },
            // Rollback inputs
            {
                displayName: 'Form',
                name: 'rollbackFormId',
                type: 'options',
                typeOptions: { loadOptionsMethod: 'getForms' },
                displayOptions: { show: { resource: ['form'], operation: ['rollbackForm'] } },
                default: '',
                required: true,
            },
            {
                displayName: 'Backup Form JSON',
                name: 'backupFormJson',
                type: 'json',
                default: '{}',
                description: 'Full form JSON previously output as backup',
                displayOptions: { show: { resource: ['form'], operation: ['rollbackForm'] } },
            },
            // Safety flags for write ops
            {
                displayName: 'Dry-Run / Preview',
                name: 'dryRun',
                type: 'boolean',
                default: false,
                description: 'If enabled, do not PATCH. Output proposed blocks and a diff only.',
                displayOptions: { show: { resource: ['form'], operation: ['addField','updateField','deleteField','syncSelectOptions','copyQuestions','rollbackForm'] } },
            },
            {
                displayName: 'Backup Previous Form',
                name: 'backup',
                type: 'boolean',
                default: true,
                description: 'Include the pre-patch form JSON in output to enable rollback later.',
                displayOptions: { show: { resource: ['form'], operation: ['addField','updateField','deleteField','syncSelectOptions','copyQuestions'] } },
            },
            {
                displayName: 'Optimistic Concurrency',
                name: 'optimistic',
                type: 'boolean',
                default: true,
                description: 'Compare updatedAt before patch; abort if changed to prevent overwrites.',
                displayOptions: { show: { resource: ['form'], operation: ['addField','updateField','deleteField','syncSelectOptions','copyQuestions'] } },
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
                    } else if (operation === 'addField') {
                        const formId = this.getNodeParameter('formId', i) as string;
                        const type = this.getNodeParameter('fieldType', i) as string;
                        const label = this.getNodeParameter('label', i) as string;
                        const payload = this.getNodeParameter('payload', i, {}) as Record<string, any>;
                        const positionMode = this.getNodeParameter('positionMode', i, 'end') as string;
                        const dryRun = this.getNodeParameter('dryRun', i, false) as boolean;
                        const backup = this.getNodeParameter('backup', i, true) as boolean;
                        const optimistic = this.getNodeParameter('optimistic', i, true) as boolean;

                        const before = await apiGetForm.call(this, formId);
                        const blocks = cloneBlocks(before.blocks || []);
                        const block = newBlockTemplate(type, label, payload as any);

                        let nextBlocks = blocks;
                        if (positionMode === 'end') {
                            nextBlocks = insertBlock(blocks, block);
                        } else if (positionMode === 'index') {
                            const idx = this.getNodeParameter('positionIndex', i, 0) as number;
                            nextBlocks = insertBlock(blocks, block, { mode: 'index', index: idx });
                        } else if (positionMode === 'before' || positionMode === 'after') {
                            const refUuid = this.getNodeParameter('positionRefUuid', i, '') as string;
                            nextBlocks = insertBlock(blocks, block, { mode: positionMode as any, refUuid });
                        }

                        if (dryRun) {
                            returnData.push({
                                json: {
                                    preview: true,
                                    formId,
                                    proposedBlocks: nextBlocks,
                                    diff: diffBlocks(before.blocks || [], nextBlocks),
                                },
                                pairedItem: { item: i },
                            });
                            continue;
                        }

                        if (optimistic) {
                            const latest = await apiGetForm.call(this, formId);
                            if (latest.updatedAt !== before.updatedAt) {
                                throw new NodeOperationError(this.getNode(), 'Form changed since read. Re-run to avoid conflicts.');
                            }
                        }

                        const resp = await apiUpdateForm.call(this, formId, {
                            blocks: nextBlocks,
                            name: before.name,
                            settings: before.settings,
                        });
                        returnData.push({
                            json: { updated: true, form: resp, backup: backup ? before : undefined },
                            pairedItem: { item: i },
                        });
                    } else if (operation === 'updateField') {
                        const formId = this.getNodeParameter('formId', i) as string;
                        const targetSelectBy = this.getNodeParameter('targetSelectBy', i) as string;
                        const dryRun = this.getNodeParameter('dryRun', i, false) as boolean;
                        const backup = this.getNodeParameter('backup', i, true) as boolean;
                        const optimistic = this.getNodeParameter('optimistic', i, true) as boolean;
                        const mergeStrategy = this.getNodeParameter('mergeStrategy', i, 'merge') as string;
                        const payloadPatch = this.getNodeParameter('payloadPatch', i, {}) as Record<string, any>;

                        const before = await apiGetForm.call(this, formId);
                        const questions = await apiListQuestions.call(this, formId);
                        const blocks = cloneBlocks(before.blocks || []);

                        let targetUuid = '';
                        if (targetSelectBy === 'uuid') {
                            targetUuid = (this.getNodeParameter('targetFieldUuid', i) as string) || '';
                        } else {
                            const label = (this.getNodeParameter('targetFieldLabel', i) as string) || '';
                            const { blockUuid } = findBlockByLabel(questions as any[], label);
                            if (!blockUuid) throw new NodeOperationError(this.getNode(), `Field with label "${label}" not found`);
                            targetUuid = blockUuid;
                        }

                        const { index, block } = findBlockByUuid(blocks as any, targetUuid);
                        if (index < 0 || !block) throw new NodeOperationError(this.getNode(), `Field with UUID ${targetUuid} not found`);

                        const nextBlock = { ...block } as any;
                        if (mergeStrategy === 'replace') {
                            nextBlock.payload = payloadPatch;
                        } else {
                            nextBlock.payload = { ...(block.payload || {}), ...(payloadPatch || {}) };
                        }

                        const nextBlocks = replaceBlock(blocks as any, targetUuid, nextBlock as any);

                        if (dryRun) {
                            returnData.push({
                                json: { preview: true, formId, proposedBlocks: nextBlocks, diff: diffBlocks(before.blocks || [], nextBlocks) },
                                pairedItem: { item: i },
                            });
                            continue;
                        }

                        if (optimistic) {
                            const latest = await apiGetForm.call(this, formId);
                            if (latest.updatedAt !== before.updatedAt) throw new NodeOperationError(this.getNode(), 'Form changed since read. Re-run to avoid conflicts.');
                        }

                        const resp = await apiUpdateForm.call(this, formId, { blocks: nextBlocks, name: before.name, settings: before.settings });
                        returnData.push({ json: { updated: true, form: resp, backup: backup ? before : undefined }, pairedItem: { item: i } });
                    } else if (operation === 'deleteField') {
                        const formId = this.getNodeParameter('formId', i) as string;
                        const targetSelectBy = this.getNodeParameter('targetSelectBy', i) as string;
                        const dryRun = this.getNodeParameter('dryRun', i, false) as boolean;
                        const backup = this.getNodeParameter('backup', i, true) as boolean;
                        const optimistic = this.getNodeParameter('optimistic', i, true) as boolean;

                        const before = await apiGetForm.call(this, formId);
                        const questions = await apiListQuestions.call(this, formId);
                        const blocks = cloneBlocks(before.blocks || []);

                        let uuids: string[] = [];
                        if (targetSelectBy === 'uuid') {
                            const single = (this.getNodeParameter('targetFieldUuid', i, '') as string) || '';
                            const multi = (this.getNodeParameter('targetFieldUuids', i, []) as string[]) || [];
                            uuids = [...multi];
                            if (single) uuids.push(single);
                        } else {
                            const single = (this.getNodeParameter('targetFieldLabel', i, '') as string) || '';
                            const multi = (this.getNodeParameter('targetFieldLabels', i, []) as string[]) || [];
                            const labels = [...multi];
                            if (single) labels.push(single);
                            for (const label of labels) {
                                const { blockUuid } = findBlockByLabel(questions as any[], label);
                                if (blockUuid) uuids.push(blockUuid);
                            }
                        }
                        if (!uuids.length) throw new NodeOperationError(this.getNode(), 'No matching fields were found to delete');

                        const nextBlocks = removeBlocks(blocks as any, uuids);

                        if (dryRun) {
                            returnData.push({ json: { preview: true, formId, proposedBlocks: nextBlocks, diff: diffBlocks(before.blocks || [], nextBlocks) }, pairedItem: { item: i } });
                            continue;
                        }

                        if (optimistic) {
                            const latest = await apiGetForm.call(this, formId);
                            if (latest.updatedAt !== before.updatedAt) throw new NodeOperationError(this.getNode(), 'Form changed since read. Re-run to avoid conflicts.');
                        }

                        const resp = await apiUpdateForm.call(this, formId, { blocks: nextBlocks, name: before.name, settings: before.settings });
                        returnData.push({ json: { updated: true, form: resp, backup: backup ? before : undefined }, pairedItem: { item: i } });
                    } else if (operation === 'syncSelectOptions') {
                        const formId = this.getNodeParameter('formId', i) as string;
                        const targetSelectBy = this.getNodeParameter('targetSelectBy', i) as string;
                        const preserve = this.getNodeParameter('preserveExtras', i, false) as boolean;
                        const dryRun = this.getNodeParameter('dryRun', i, false) as boolean;
                        const backup = this.getNodeParameter('backup', i, true) as boolean;
                        const optimistic = this.getNodeParameter('optimistic', i, true) as boolean;

                        const before = await apiGetForm.call(this, formId);
                        const questions = await apiListQuestions.call(this, formId);
                        const blocks = cloneBlocks(before.blocks || []);

                        let targetUuid = '';
                        if (targetSelectBy === 'uuid') targetUuid = (this.getNodeParameter('targetFieldUuid', i) as string) || '';
                        else {
                            const label = (this.getNodeParameter('targetFieldLabel', i) as string) || '';
                            const { blockUuid } = findBlockByLabel(questions as any[], label);
                            if (!blockUuid) throw new NodeOperationError(this.getNode(), `Field with label "${label}" not found`);
                            targetUuid = blockUuid;
                        }

                        const { index, block } = findBlockByUuid(blocks as any, targetUuid);
                        if (index < 0 || !block) throw new NodeOperationError(this.getNode(), `Field with UUID ${targetUuid} not found`);

                        const options = (items || []).map(({ json }) => ({
                            label: (json as any).label,
                            value: (json as any).value,
                        }));
                        const nextBlock = updateSelectOptions(block as any, options as any, preserve);
                        const nextBlocks = replaceBlock(blocks as any, targetUuid, nextBlock);

                        if (dryRun) {
                            returnData.push({ json: { preview: true, formId, proposedBlocks: nextBlocks, diff: diffBlocks(before.blocks || [], nextBlocks) }, pairedItem: { item: i } });
                            continue;
                        }

                        if (optimistic) {
                            const latest = await apiGetForm.call(this, formId);
                            if (latest.updatedAt !== before.updatedAt) throw new NodeOperationError(this.getNode(), 'Form changed since read. Re-run to avoid conflicts.');
                        }

                        const resp = await apiUpdateForm.call(this, formId, { blocks: nextBlocks, name: before.name, settings: before.settings });
                        returnData.push({ json: { updated: true, form: resp, backup: backup ? before : undefined }, pairedItem: { item: i } });
                    } else if (operation === 'copyQuestions') {
                        const sourceFormId = this.getNodeParameter('sourceFormId', i) as string;
                        const destFormId = this.getNodeParameter('destFormId', i) as string;
                        const qIds = (this.getNodeParameter('questionIds', i, []) as string[]) || [];
                        const insertPositionMode = this.getNodeParameter('insertPositionMode', i, 'end') as string;
                        const insertIndex = this.getNodeParameter('insertIndex', i, 0) as number;
                        const insertRefUuid = this.getNodeParameter('insertRefUuid', i, '') as string;
                        const dryRun = this.getNodeParameter('dryRun', i, false) as boolean;
                        const backup = this.getNodeParameter('backup', i, true) as boolean;
                        const optimistic = this.getNodeParameter('optimistic', i, true) as boolean;

                        const source = await apiGetForm.call(this, sourceFormId);
                        const destBefore = await apiGetForm.call(this, destFormId);

                        const sourceBlocks = (source.blocks || []).filter((b: any) => qIds.includes(b.uuid)).map((b: any) => stripOrRegenUuid(b, true));
                        let nextBlocks = cloneBlocks(destBefore.blocks || []);

                        if (insertPositionMode === 'end') {
                            for (const b of sourceBlocks) nextBlocks = insertBlock(nextBlocks, b);
                        } else if (insertPositionMode === 'index') {
                            const idx = Math.max(0, Math.min(insertIndex, nextBlocks.length));
                            const head = nextBlocks.slice(0, idx);
                            const tail = nextBlocks.slice(idx);
                            nextBlocks = [...head, ...sourceBlocks, ...tail];
                        } else {
                            const { index: refIdx } = findBlockByUuid(nextBlocks as any, insertRefUuid);
                            const insertAt = insertPositionMode === 'before' ? refIdx : refIdx + 1;
                            const head = nextBlocks.slice(0, Math.max(0, insertAt));
                            const tail = nextBlocks.slice(Math.max(0, insertAt));
                            nextBlocks = [...head, ...sourceBlocks, ...tail];
                        }
                        nextBlocks = ensureUniqueUuids(nextBlocks as any);

                        if (dryRun) {
                            returnData.push({ json: { preview: true, destFormId, proposedBlocks: nextBlocks, diff: diffBlocks(destBefore.blocks || [], nextBlocks) }, pairedItem: { item: i } });
                            continue;
                        }

                        if (optimistic) {
                            const latest = await apiGetForm.call(this, destFormId);
                            if (latest.updatedAt !== destBefore.updatedAt) throw new NodeOperationError(this.getNode(), 'Destination form changed since read. Re-run to avoid conflicts.');
                        }

                        const resp = await apiUpdateForm.call(this, destFormId, { blocks: nextBlocks, name: destBefore.name, settings: destBefore.settings });
                        returnData.push({ json: { updated: true, form: resp, backup: backup ? destBefore : undefined }, pairedItem: { item: i } });
                    } else if (operation === 'rollbackForm') {
                        const formId = this.getNodeParameter('rollbackFormId', i) as string;
                        const dryRun = this.getNodeParameter('dryRun', i, false) as boolean;
                        const backupFormJson = this.getNodeParameter('backupFormJson', i, {}) as any;

                        if (!backupFormJson || !backupFormJson.blocks) {
                            throw new NodeOperationError(this.getNode(), 'backupFormJson must include full form JSON with blocks');
                        }

                        const before = await apiGetForm.call(this, formId);
                        const nextBlocks = backupFormJson.blocks as any[];

                        if (dryRun) {
                            returnData.push({ json: { preview: true, formId, proposedBlocks: nextBlocks, diff: diffBlocks(before.blocks || [], nextBlocks) }, pairedItem: { item: i } });
                            continue;
                        }

                        const resp = await apiUpdateForm.call(this, formId, { blocks: nextBlocks, name: backupFormJson.name ?? before.name, settings: backupFormJson.settings ?? before.settings });
                        returnData.push({ json: { updated: true, form: resp }, pairedItem: { item: i } });
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
