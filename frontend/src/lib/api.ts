import { browser } from '$app/environment';
import { PUBLIC_API_URL } from '$env/static/public';

const BASE = PUBLIC_API_URL ?? 'http://localhost:3000';

type RequestOptions = {
	method?: string;
	body?: unknown;
	token?: string;
};

export class ApiError extends Error {
	constructor(
		public status: number,
		public code: string,
		message: string,
	) {
		super(message);
	}
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };

	const token = opts.token ?? (browser ? localStorage.getItem('access_token') : null);
	if (token) headers['Authorization'] = `Bearer ${token}`;

	const res = await fetch(`${BASE}${path}`, {
		method: opts.method ?? 'GET',
		headers,
		body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
	});

	if (!res.ok) {
		const err = (await res.json().catch(() => ({ error: res.statusText, code: 'UNKNOWN' }))) as {
			error: string;
			code: string;
		};
		throw new ApiError(res.status, err.code, err.error);
	}

	return res.json() as Promise<T>;
}
