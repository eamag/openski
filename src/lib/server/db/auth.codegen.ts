import { createAuth } from '../auth.ts';

const DUMMY_DB_FOR_SCHEMA_CODEGEN = null!;
const LOCAL_DEV_BASE_URL_FOR_CODEGEN = 'http://127.0.0.1:5173';
const EPHEMERAL_SECRET_FOR_CODEGEN = crypto.randomUUID();

export const auth = createAuth(DUMMY_DB_FOR_SCHEMA_CODEGEN, {
	baseURL: LOCAL_DEV_BASE_URL_FOR_CODEGEN,
	secret: EPHEMERAL_SECRET_FOR_CODEGEN
});
