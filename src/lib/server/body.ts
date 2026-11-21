import { error } from '@sveltejs/kit';

export const MAX_JSON_BODY_BYTES = 200_000;

export async function readJsonBody(
	request: Request,
	maxBytes = MAX_JSON_BODY_BYTES
): Promise<unknown> {
	const declaredLength = Number(request.headers.get('content-length'));
	if (Number.isFinite(declaredLength) && declaredLength > maxBytes)
		error(413, 'The request is too large.');
	const text = await request.text();
	if (text.length > maxBytes) error(413, 'The request is too large.');
	try {
		return JSON.parse(text);
	} catch {
		error(400, 'The body must be JSON.');
	}
}
