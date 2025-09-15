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
    createForm as apiCreateForm,
} from './makeTallyRequest';
import {
    cloneBlocks,
    findBlockByUuid,
    findBlockByLabel,
    newBlockTemplate,
    newTitleBlock,
    insertBlock,
    replaceBlock,
    removeBlocks,
    ensureUniqueUuids,
    generateUuid,
    cloneGroupBlocks,
    resolveGroupUuidByBlockUuid,
    cloneBlockWithNewIds,
} from './blockUtils';
import { diffBlocks } from './diff';

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
            // Common: Form for write ops (Rollback has a dedicated Form field below)
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
                        operation: ['addField','updateField','deleteField'],
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
                type: 'options',
                displayOptions: { show: { resource: ['form'], operation: ['addField'] } },
                options: [
                    { name: 'Short Text', value: 'input' },
                    { name: 'Long Text', value: 'textarea' },
                    { name: 'Email', value: 'email' },
                    { name: 'URL', value: 'url' },
                    { name: 'Phone', value: 'phone' },
                    { name: 'Number', value: 'number' },
                    { name: 'Dropdown', value: 'select' },
                    { name: 'Multiple Choice', value: 'radio' },
                    { name: 'Checkboxes', value: 'checkboxes' },
                    { name: 'Multi-select', value: 'multi_select' },
                    { name: 'Date', value: 'date' },
                    { name: 'Time', value: 'time' },
                    { name: 'Rating', value: 'rating' },
                    { name: 'File Upload', value: 'file_upload' },
                    { name: 'Custom…', value: 'custom' },
                ],
                default: 'input',
                description: 'Choose a Tally field type or select Custom to enter a raw type',
            },
            // Options JSON for option-based fields
            {
                displayName: 'Options (JSON)',
                name: 'optionsJson',
                type: 'json',
                default: '[]',
                description: "Provide a JSON array of option labels, e.g. ['Option 1','Option 2','Etc...']",
                placeholder: "['Option 1','Option 2']",
                displayOptions: { show: { resource: ['form'], operation: ['addField'], fieldType: ['radio','checkboxes','select','multi_select'] } },
            },
            {
                displayName: 'Custom Field Type',
                name: 'customFieldType',
                type: 'string',
                displayOptions: { show: { resource: ['form'], operation: ['addField'], fieldType: ['custom'] } },
                default: '',
                description: 'Raw Tally block type when using Custom',
            },
            {
                displayName: 'Title',
                name: 'title',
                type: 'string',
                displayOptions: {
                    show: {
                        resource: ['form'],
                        operation: ['addField'],
                    },
                },
                default: '',
                description: 'Optional title/question text that appears above the field (creates a separate TITLE block)',
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
                displayName: 'Placeholder',
                name: 'placeholder',
                type: 'string',
                displayOptions: {
                    show: {
                        resource: ['form'],
                        operation: ['addField'],
                        fieldType: ['input','textarea','email','url','phone','number','date','time'],
                    },
                },
                default: '',
                description: 'Placeholder shown inside the field (where supported by Tally)',
            },
            {
                displayName: 'Payload (JSON)',
                name: 'payload',
                type: 'json',
                displayOptions: {
                    show: {
                        resource: ['form'],
                        operation: ['addField'],
                        fieldType: ['input','textarea','email','url','phone','number','date','time','rating','file_upload','custom'],
                    },
                },
                default: '{}',
                description: 'Type-specific payload to set on the block',
            },
            {
                displayName: 'Required',
                name: 'required',
                type: 'boolean',
                displayOptions: {
                    show: {
                        resource: ['form'],
                        operation: ['addField'],
                    },
                },
                default: false,
                description: 'Mark the field as required',
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
            // Update/Delete: target selector
            {
                displayName: 'Select By',
                name: 'targetSelectBy',
                type: 'options',
                options: [
                    { name: 'UUID', value: 'uuid' },
                    { name: 'Label', value: 'label' },
                ],
                default: 'uuid',
                displayOptions: { show: { resource: ['form'], operation: ['updateField','deleteField'] } },
            },
            {
                displayName: 'Field UUID',
                name: 'targetFieldUuid',
                type: 'string',
                displayOptions: { show: { resource: ['form'], operation: ['updateField','deleteField'], targetSelectBy: ['uuid'] } },
                default: '',
            },
            {
                displayName: 'Field Label',
                name: 'targetFieldLabel',
                type: 'string',
                displayOptions: { show: { resource: ['form'], operation: ['updateField','deleteField'], targetSelectBy: ['label'] } },
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
                displayName: 'Show Advanced (UUID input)',
                name: 'showLegacyUuidInput',
                type: 'boolean',
                displayOptions: { show: { resource: ['form'], operation: ['copyQuestions'] } },
                default: false,
                description: 'Show the legacy "Question UUIDs to Copy" field. Prefer selecting Source Questions instead.',
            },
            {
                displayName: 'Question UUIDs to Copy',
                name: 'questionIds',
                type: 'string',
                typeOptions: { multipleValues: true, multipleValueButtonText: 'Add UUID' },
                displayOptions: { show: { resource: ['form'], operation: ['copyQuestions'], showLegacyUuidInput: [true] } },
                default: [],
                required: false,
                description: 'Optional legacy input. If provided, each block UUID will be resolved to its groupUuid and the entire question group will be copied.',
            },
            {
                displayName: 'Source Questions',
                name: 'sourceQuestionGroups',
                type: 'multiOptions',
                typeOptions: { loadOptionsMethod: 'getSourceQuestions' },
                displayOptions: { show: { resource: ['form'], operation: ['copyQuestions'] } },
                default: [],
                description: 'Select questions from the source form. Each option maps to a groupUuid so all associated blocks (like options) are copied.',
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
                displayName: 'Copy All From Source',
                name: 'copyAll',
                type: 'boolean',
                default: false,
                description: 'Copy all question groups from the Source Form',
                displayOptions: { show: { resource: ['form'], operation: ['copyQuestions'] } },
            },
            {
                displayName: 'Replace Destination Contents',
                name: 'replaceContents',
                type: 'boolean',
                default: false,
                description: 'DANGER: When Copy All is enabled, this will first delete ALL blocks in the Destination form, then insert the Source form content. Use Dry-Run to preview and keep Backup enabled to allow rollback.',
                displayOptions: { show: { resource: ['form'], operation: ['copyQuestions'], copyAll: [true] } },
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
                description: 'Full form JSON previously output as backup. Leave empty to use incoming item: $json.backup || $json.form || $json',
                displayOptions: { show: { resource: ['form'], operation: ['rollbackForm'] } },
            },
            // Safety flags for write ops
            {
                displayName: 'Dry-Run / Preview',
                name: 'dryRun',
                type: 'boolean',
                default: false,
                description: 'If enabled, do not PATCH. Output proposed blocks and a diff only.',
                displayOptions: { show: { resource: ['form'], operation: ['addField','updateField','deleteField','copyQuestions','rollbackForm'] } },
            },
            {
                displayName: 'Backup Previous Form',
                name: 'backup',
                type: 'boolean',
                default: true,
                description: 'Include the pre-patch form JSON in output to enable rollback later.',
                displayOptions: { show: { resource: ['form'], operation: ['addField','updateField','deleteField','copyQuestions'] } },
            },
            {
                displayName: 'Optimistic Concurrency',
                name: 'optimistic',
                type: 'boolean',
                default: true,
                description: 'Compare updatedAt before patch; abort if changed to prevent overwrites.',
                displayOptions: { show: { resource: ['form'], operation: ['addField','updateField','deleteField','copyQuestions'] } },
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
                    return (forms as any[]).map((form: any) => ({ name: form.name, value: form.id }));
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Unknown error';
                    throw new NodeOperationError(this.getNode(), `Failed to load forms: ${message}`);
                }
            },
            async getFormsWithCreateNew(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
                const base = await (this as any).getForms();
                return [{ name: '— Create New —', value: '__CREATE_NEW__', description: 'Create a new form from JSON' }, ...base];
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
            async getSourceQuestions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
                // Populate dropdown by grouping form blocks by groupUuid; fallback to questions endpoint only to enrich labels
                try {
                    const sourceFormId = this.getCurrentNodeParameter('sourceFormId') as string;
                    if (!sourceFormId) return [];
                    const form = await apiGetForm.call(this, sourceFormId);

                    const blocks: any[] = Array.isArray((form as any)?.blocks) ? (form as any).blocks : [];
                    if (!blocks.length) return [];

                    // Group blocks by groupUuid (or uuid if missing)
                    const groups = new Map<string, any[]>();
                    for (const b of blocks) {
                        const key = b.groupUuid || b.uuid;
                        if (!groups.has(key)) groups.set(key, []);
                        groups.get(key)!.push(b);
                    }

                    const schemaToText = (schema: any): string => {
                        const parts: string[] = [];
                        const walk = (n: any) => {
                            if (Array.isArray(n)) n.forEach(walk);
                            else if (typeof n === 'string') parts.push(n);
                        };
                        walk(schema);
                        return parts.join(' ').trim();
                    };

                    // Best-effort friendly name for each group
                    const options: INodePropertyOptions[] = [];
                    for (const [groupUuid, groupBlocks] of groups.entries()) {
                        // Prefer a block with a user-visible label (inputs)
                        const labelBlock = groupBlocks.find((gb) => typeof gb.label === 'string' && gb.label.trim().length > 0 && /^INPUT_|^TEXTAREA|^RATING|^FILE_UPLOAD/.test(gb.type || ''))
                            || groupBlocks.find((gb) => typeof gb.label === 'string' && gb.label.trim().length > 0);
                        const type = groupBlocks[0]?.groupType || groupBlocks[0]?.type || 'QUESTION';
                        const count = groupBlocks.length;
                        // Try title from immediately preceding TITLE (groupType=QUESTION)
                        let name: string | undefined;
                        // Find first occurrence index of any block in this group
                        const firstIdx = blocks.findIndex((b) => (b.groupUuid || b.uuid) === groupUuid);
                        if (firstIdx > 0) {
                            const prev = blocks[firstIdx - 1];
                            if (prev?.type === 'TITLE' && prev?.groupType === 'QUESTION') {
                                const text = schemaToText(prev?.payload?.safeHTMLSchema);
                                if (text) name = text;
                            }
                        }
                        if (!name && labelBlock?.label) name = String(labelBlock.label);
                        if (!name) name = `${type} (${count} block${count === 1 ? '' : 's'})`;
                        options.push({ name, value: groupUuid, description: `Type: ${type}` });
                    }

                    // Sort by name for nicer UX
                    options.sort((a, b) => String(a.name).localeCompare(String(b.name)));
                    return options;
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Unknown error';
                    throw new NodeOperationError(this.getNode(), `Failed to load source questions: ${message}`);
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
                        const selectedType = this.getNodeParameter('fieldType', i) as string;
                        const toTallyType = (t: string): string => {
                            switch (t) {
                                case 'input': return 'INPUT_TEXT';
                                case 'textarea': return 'TEXTAREA';
                                case 'email': return 'INPUT_EMAIL';
                                case 'url': return 'INPUT_LINK';
                                case 'phone': return 'INPUT_PHONE_NUMBER';
                                case 'number': return 'INPUT_NUMBER';
                                case 'select': return 'SELECT';
                                case 'radio': return 'RADIO';
                                case 'checkboxes': return 'CHECKBOXES';
                                case 'multi_select': return 'MULTI_SELECT';
                                case 'date': return 'INPUT_DATE';
                                case 'time': return 'INPUT_TIME';
                                case 'rating': return 'RATING';
                                case 'file_upload': return 'FILE_UPLOAD';
                                default: return (t || '').toUpperCase();
                            }
                        };
                        const type = selectedType === 'custom'
                            ? toTallyType(((this.getNodeParameter('customFieldType', i) as string) || 'TEXT'))
                            : toTallyType(selectedType);
                        const title = this.getNodeParameter('title', i, '') as string;
                        const label = this.getNodeParameter('label', i) as string;
                        let payload = this.getNodeParameter('payload', i, {}) as Record<string, any>;
                        // Placeholder support + fallback to Label when Placeholder is empty
                        const supportsPlaceholderTypes = ['INPUT_TEXT','TEXTAREA','INPUT_EMAIL','INPUT_LINK','INPUT_PHONE_NUMBER','INPUT_NUMBER','INPUT_DATE','INPUT_TIME'];
                        const supportsPlaceholder = supportsPlaceholderTypes.includes(type);
                        const placeholderInput = supportsPlaceholder ? (this.getNodeParameter('placeholder', i, '') as string) : '';
                        const placeholderFinal = supportsPlaceholder ? (placeholderInput?.trim() || label || '') : '';
                        const isRequired = this.getNodeParameter('required', i, false) as boolean;
                        const positionMode = this.getNodeParameter('positionMode', i, 'end') as string;
                        const dryRun = this.getNodeParameter('dryRun', i, false) as boolean;
                        const backup = this.getNodeParameter('backup', i, true) as boolean;
                        const optimistic = this.getNodeParameter('optimistic', i, true) as boolean;
                        const isOptionField = ['SELECT','RADIO','CHECKBOXES','MULTI_SELECT'].includes(type);
                        // Parse Options (JSON) for option-based fields
                        let optionsFromUi: string[] = [];
                        if (isOptionField) {
                            const optionsParam = this.getNodeParameter('optionsJson', i, '[]') as any;
                            try {
                                const parsed = typeof optionsParam === 'string' ? JSON.parse(optionsParam) : optionsParam;
                                if (Array.isArray(parsed)) {
                                    optionsFromUi = parsed.map((v) => String(v)).map((s) => s.trim()).filter((s) => s.length > 0);
                                }
                            } catch {
                                // ignore, will validate below
                            }
                        }
                        // Handle case where payload might be malformed from JSON field
                        if (typeof payload === 'string') {
                            try {
                                payload = JSON.parse(payload);
                            } catch {
                                payload = {};
                            }
                        }
                        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
                            payload = {};
                        }

                        const before = await apiGetForm.call(this, formId);
                        const blocks = cloneBlocks(before.blocks || []);
                        // Build new blocks
                        const blocksToInsert: any[] = [];
                        // Add title block if provided
                        if (title && title.trim()) {
                            blocksToInsert.push(newTitleBlock(title.trim()));
                        }
                        if (isOptionField) {
                            // Validate options list
                            if (!optionsFromUi.length) {
                                throw new NodeOperationError(this.getNode(), 'Options (JSON) is required for this field type and must be a non-empty array of strings.');
                            }
                            const groupUuid = generateUuid();
                            const groupTypeMap: Record<string, string> = {
                                SELECT: 'DROPDOWN',
                                RADIO: 'MULTIPLE_CHOICE',
                                CHECKBOXES: 'CHECKBOXES',
                                MULTI_SELECT: 'MULTI_SELECT',
                            };
                            const optionTypeMap: Record<string, string> = {
                                SELECT: 'DROPDOWN_OPTION',
                                RADIO: 'MULTIPLE_CHOICE_OPTION',
                                CHECKBOXES: 'CHECKBOX',
                                MULTI_SELECT: 'MULTI_SELECT_OPTION',
                            };
                            const groupType = groupTypeMap[type];
                            const optionType = optionTypeMap[type];
                            optionsFromUi.forEach((optLabel, idx) => {
                                const block = {
                                    uuid: generateUuid(),
                                    type: optionType,
                                    label: optLabel,
                                    groupUuid,
                                    groupType,
                                    payload: {
                                        index: idx,
                                        isRequired: !!isRequired,
                                        isFirst: idx === 0,
                                        isLast: idx === optionsFromUi.length - 1,
                                        text: optLabel,
                                    },
                                } as any;
                                blocksToInsert.push(block);
                            });
                        } else {
                            // Non-option fields: build a single block with sensible defaults
                            const defaultPayloadFor = (t: string): Record<string, any> => {
                                const req = { isRequired: !!isRequired } as Record<string, any>;
                switch (t) {
                                    case 'INPUT_TEXT':
                                    case 'INPUT_EMAIL':
                                    case 'INPUT_LINK':
                                    case 'INPUT_NUMBER':
                                    case 'INPUT_DATE':
                                    case 'INPUT_TIME':
                                        return { ...req, placeholder: placeholderFinal };
                                    case 'TEXTAREA':
                                        return { ...req, placeholder: placeholderFinal };
                                    case 'INPUT_PHONE_NUMBER':
                                        return { ...req, internationalFormat: false, placeholder: placeholderFinal };
                                    case 'RATING':
                                    case 'FILE_UPLOAD':
                                        return req;
                                    default:
                                        return req;
                                }
                            };
                            const mergedPayload = { ...defaultPayloadFor(type), ...(payload || {}) };
                            const fieldBlock = newBlockTemplate(type, label, mergedPayload as any);
                            blocksToInsert.push(fieldBlock);
                        }

                        let nextBlocks = blocks;
                        
                        // Insert blocks at the specified position
                        if (positionMode === 'end') {
                            for (const blockToInsert of blocksToInsert) {
                                nextBlocks = insertBlock(nextBlocks, blockToInsert);
                            }
                        } else if (positionMode === 'index') {
                            let idx = this.getNodeParameter('positionIndex', i, 0) as number;
                            for (const blockToInsert of blocksToInsert) {
                                nextBlocks = insertBlock(nextBlocks, blockToInsert, { mode: 'index', index: idx });
                                idx += 1; // keep order stable when inserting multiple blocks
                            }
                        } else if (positionMode === 'before' || positionMode === 'after') {
                            const refUuid = this.getNodeParameter('positionRefUuid', i, '') as string;
                            for (const blockToInsert of blocksToInsert) {
                                nextBlocks = insertBlock(nextBlocks, blockToInsert, { mode: positionMode as any, refUuid });
                            }
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

                        // Commit
                        const resp = await apiUpdateForm.call(this, formId, {
                            blocks: nextBlocks,
                            name: before.name,
                            settings: before.settings,
                        });
                        returnData.push({ json: { updated: true, form: resp, backup: backup ? before : undefined }, pairedItem: { item: i } });
                    } else if (operation === 'updateField') {
                        const formId = this.getNodeParameter('formId', i) as string;
                        const targetSelectBy = this.getNodeParameter('targetSelectBy', i) as string;
                        const dryRun = this.getNodeParameter('dryRun', i, false) as boolean;
                        const backup = this.getNodeParameter('backup', i, true) as boolean;
                        const optimistic = this.getNodeParameter('optimistic', i, true) as boolean;
                        const mergeStrategy = this.getNodeParameter('mergeStrategy', i, 'merge') as string;
                        const payloadPatchParam = this.getNodeParameter('payloadPatch', i, {}) as any;

                        // Normalize payloadPatch in case it comes as a JSON string
                        let payloadPatch: Record<string, any> = {};
                        if (typeof payloadPatchParam === 'string') {
                            try { payloadPatch = JSON.parse(payloadPatchParam); } catch { payloadPatch = {}; }
                        } else if (payloadPatchParam && typeof payloadPatchParam === 'object' && !Array.isArray(payloadPatchParam)) {
                            payloadPatch = payloadPatchParam as Record<string, any>;
                        }

                        const before = await apiGetForm.call(this, formId);
                        const blocks = cloneBlocks(before.blocks || []);
                        const questions = await apiListQuestions.call(this, formId);

                        // Resolve target UUID
                        let targetUuid = '';
                        if (targetSelectBy === 'uuid') {
                            targetUuid = (this.getNodeParameter('targetFieldUuid', i, '') as string) || '';
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
                    } else if (operation === 'copyQuestions') {
                        const sourceFormId = this.getNodeParameter('sourceFormId', i) as string;
                        const destFormId = this.getNodeParameter('destFormId', i) as string;
                        const qIds = (this.getNodeParameter('questionIds', i, []) as string[]) || [];
                        const selectedGroupUuids = (this.getNodeParameter('sourceQuestionGroups', i, []) as string[]) || [];
                        const copyAll = this.getNodeParameter('copyAll', i, false) as boolean;
                        const replaceContents = this.getNodeParameter('replaceContents', i, false) as boolean;
                        const insertPositionMode = this.getNodeParameter('insertPositionMode', i, 'end') as string;
                        const insertIndex = this.getNodeParameter('insertIndex', i, 0) as number;
                        const insertRefUuid = this.getNodeParameter('insertRefUuid', i, '') as string;
                        const dryRun = this.getNodeParameter('dryRun', i, false) as boolean;
                        const backup = this.getNodeParameter('backup', i, true) as boolean;
                        const optimistic = this.getNodeParameter('optimistic', i, true) as boolean;

                        const source = await apiGetForm.call(this, sourceFormId);
                        const destBefore = await apiGetForm.call(this, destFormId);
                        // Determine groups to copy
                        let groupUuids: string[] = [];
                        if (copyAll) {
                            // All groups found in source blocks
                            const set = new Set<string>();
                            for (const b of (source.blocks || []) as any[]) set.add(b.groupUuid || b.uuid);
                            groupUuids = Array.from(set);
                        } else {
                            if (selectedGroupUuids?.length) {
                                groupUuids = [...new Set(selectedGroupUuids)];
                            } else if (qIds?.length) {
                                groupUuids = qIds
                                    .map((id) => resolveGroupUuidByBlockUuid((source.blocks || []) as any, id))
                                    .filter((g): g is string => !!g);
                                groupUuids = [...new Set(groupUuids)];
                            }
                            if (!groupUuids.length) {
                                throw new NodeOperationError(this.getNode(), 'No questions selected. Choose Source Questions, provide UUIDs, or enable Copy All.');
                            }
                        }

                        // For each group, clone all group blocks with a new groupUuid and include preceding TITLE (QUESTION) when available
                        const allSourceBlocks: any[] = (source.blocks || []) as any[];
                        const selectedGroupSet = new Set(groupUuids);
                        const sourceBlocks = groupUuids.flatMap((g) => {
                            const cloned = cloneGroupBlocks(allSourceBlocks as any, g);
                            // Try to include the preceding TITLE/QUESTION block if it immediately precedes any block of the group
                            const firstIdx = allSourceBlocks.findIndex((b) => (b.groupUuid || b.uuid) === g);
                            if (firstIdx > 0) {
                                const prev = allSourceBlocks[firstIdx - 1];
                                if (prev?.type === 'TITLE' && prev?.groupType === 'QUESTION') {
                                    // Only include the preceding TITLE if its own group is NOT already selected.
                                    // This avoids duplicating TITLEs in Copy All, or when user explicitly selects the title group.
                                    const titleGroupUuid = prev.groupUuid || prev.uuid;
                                    if (!selectedGroupSet.has(titleGroupUuid)) {
                                        // Clone the title too with fresh ids and its own groupUuid (keep separation from field group)
                                        cloned.unshift(cloneBlockWithNewIds(prev, true));
                                    }
                                }
                            }
                            return cloned;
                        });
                        let nextBlocks = cloneBlocks(destBefore.blocks || []);

                        // Replace Destination contents if requested and copying all
                        if (copyAll && replaceContents) {
                            nextBlocks = [];
                        }

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
                        const backupFormJsonParam = this.getNodeParameter('backupFormJson', i, {}) as any;

                        // Normalize param (string->object) and fall back to incoming item
                        let parsedParam: any = backupFormJsonParam;
                        if (typeof parsedParam === 'string') {
                            try { parsedParam = JSON.parse(parsedParam); } catch { parsedParam = {}; }
                        }
                        const incoming = (items[i]?.json || {}) as any;
                        const candidate = parsedParam && Object.keys(parsedParam).length ? parsedParam
                            : (incoming?.backup && typeof incoming.backup === 'object') ? incoming.backup
                            : (incoming?.form && typeof incoming.form === 'object') ? incoming.form
                            : incoming;

                        if (!candidate || !Array.isArray(candidate.blocks)) {
                            throw new NodeOperationError(this.getNode(), 'No valid form JSON found. Provide Backup Form JSON or pass it from previous node ($json.backup, $json.form, or $json).');
                        }

                        const nextBlocks = candidate.blocks as any[];

                        // Create New path
                        if (formId === '__CREATE_NEW__') {
                            if (dryRun) {
                                returnData.push({ json: { preview: true, createNew: true, proposedBlocks: nextBlocks, name: candidate.name, settings: candidate.settings }, pairedItem: { item: i } });
                                continue;
                            }
                            const body: any = {
                                name: candidate.name || 'Untitled Form',
                                settings: candidate.settings || {},
                                blocks: nextBlocks,
                            };
                            const resp = await apiCreateForm.call(this, body);
                            returnData.push({ json: { created: true, form: resp }, pairedItem: { item: i } });
                        } else {
                            const before = await apiGetForm.call(this, formId);
                            if (dryRun) {
                                returnData.push({ json: { preview: true, formId, proposedBlocks: nextBlocks, diff: diffBlocks(before.blocks || [], nextBlocks) }, pairedItem: { item: i } });
                                continue;
                            }
                            const resp = await apiUpdateForm.call(this, formId, { blocks: nextBlocks, name: candidate.name ?? before.name, settings: candidate.settings ?? before.settings });
                            returnData.push({ json: { updated: true, form: resp }, pairedItem: { item: i } });
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
