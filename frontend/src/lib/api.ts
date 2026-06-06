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

async function tryRefreshToken(): Promise<string | null> {
	if (!browser) return null;
	const refreshToken = localStorage.getItem('refresh_token');
	if (!refreshToken) return null;

	try {
		const res = await fetch(`${BASE}/auth/refresh`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ refreshToken }),
		});
		if (!res.ok) return null;
		const data = await res.json() as { accessToken: string };
		localStorage.setItem('access_token', data.accessToken);
		return data.accessToken;
	} catch {
		return null;
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

	// Token expired — try to refresh and retry once
	if (res.status === 401 && !opts.token) {
		const newToken = await tryRefreshToken();
		if (newToken) {
			return api<T>(path, { ...opts, token: newToken });
		}
		// Refresh failed — clear session and redirect to login
		if (browser) {
			localStorage.removeItem('access_token');
			localStorage.removeItem('refresh_token');
			localStorage.removeItem('auth_user');
			window.location.href = '/login';
		}
	}

	if (!res.ok) {
		const err = (await res.json().catch(() => ({ error: res.statusText, code: 'UNKNOWN' }))) as {
			error: string;
			code: string;
		};
		throw new ApiError(res.status, err.code, err.error);
	}

	return res.json() as Promise<T>;
}
