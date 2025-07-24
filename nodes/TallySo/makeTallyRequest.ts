import type {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	IHookFunctions,
	IDataObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

const TALLY_API_URL = 'https://api.tally.so/graphql';

/**
 * Make a GraphQL request to Tally.so API
 */
export async function tallyApiRequest(
	this: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions,
	query: string,
	variables: IDataObject = {},
): Promise<any> {
	const credentials = await this.getCredentials('tallySoApi');
	
	const options = {
		method: 'POST' as const,
		body: { query, variables },
		headers: {
			'Authorization': `Bearer ${credentials.apiToken}`,
			'Content-Type': 'application/json',
		},
		json: true,
	};

	try {
		const response = await this.helpers.httpRequest({
			...options,
			url: TALLY_API_URL,
		});

		if (response.errors?.length) {
			throw new NodeApiError(this.getNode(), {
				message: response.errors[0].message,
				description: response.errors[0].extensions?.code || 'GraphQL Error',
			});
		}

		return response.data;
	} catch (error) {
		if (error instanceof NodeApiError) {
			throw error;
		}
		throw new NodeApiError(this.getNode(), {
			message: error instanceof Error ? error.message : 'Unknown error occurred',
		});
	}
}
