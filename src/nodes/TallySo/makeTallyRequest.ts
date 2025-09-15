import type {
    IExecuteFunctions,
    ILoadOptionsFunctions,
    IHookFunctions,
    IDataObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

const TALLY_API_URL = 'https://api.tally.so';

/**
 * Make a REST request to Tally.so API
 */
export async function tallyApiRequest(
    this: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions,
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET',
    body?: IDataObject,
): Promise<any> {
    try {
        // Get credentials manually and add Authorization header
        const credentials = await this.getCredentials('tallySoApi');
        const response = await this.helpers.httpRequest({
            method,
            baseURL: TALLY_API_URL,
            url: endpoint,
            headers: {
                'Authorization': `Bearer ${credentials.apiToken as string}`,
                'Content-Type': 'application/json',
            },
            body,
            json: true,
        });

        return response;
    } catch (error) {
        if (error instanceof NodeApiError) {
            throw error;
        }
        throw new NodeApiError(this.getNode(), {
            message: error instanceof Error ? error.message : 'Unknown error occurred',
        });
    }
}

// Convenience wrappers for Tally endpoints used by field operations
export async function getForm(
    this: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions,
    formId: string,
): Promise<any> {
    return tallyApiRequest.call(this, `/forms/${formId}`, 'GET');
}

export async function listQuestions(
    this: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions,
    formId: string,
): Promise<any[]> {
    const data = await tallyApiRequest.call(this, `/forms/${formId}/questions`, 'GET');
    // Normalize to array if API wraps in { items }
    if (Array.isArray(data)) return data as any[];
    if ((data as any)?.items && Array.isArray((data as any).items)) return (data as any).items as any[];
    return (data as any)?.questions || [];
}

export async function updateForm(
    this: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions,
    formId: string,
    body: IDataObject,
): Promise<any> {
    try {
        return await tallyApiRequest.call(this, `/forms/${formId}`, 'PATCH', body);
    } catch (error) {
        // Enhanced error for debugging 400s
        const message = error instanceof Error ? error.message : String(error);
        throw new NodeApiError(this.getNode(), {
            message: `PATCH /forms/${formId} failed: ${message}`,
            description: `Request body: ${JSON.stringify(body, null, 2)}`,
        });
    }
}

// Create a new form
export async function createForm(
    this: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions,
    body: IDataObject,
): Promise<any> {
    try {
        return await tallyApiRequest.call(this, `/forms`, 'POST', body);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new NodeApiError(this.getNode(), {
            message: `POST /forms failed: ${message}`,
            description: `Request body: ${JSON.stringify(body, null, 2)}`,
        });
    }
}
