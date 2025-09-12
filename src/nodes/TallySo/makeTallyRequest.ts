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
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
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
