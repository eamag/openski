const CANONICAL_APEX_HOSTNAME = 'openski.org';
const MOVED_PERMANENTLY_HTTP_STATUS = 301;

export default {
	fetch(request) {
		const destinationUrl = new URL(request.url);
		destinationUrl.hostname = CANONICAL_APEX_HOSTNAME;
		return Response.redirect(destinationUrl.toString(), MOVED_PERMANENTLY_HTTP_STATUS);
	}
};
