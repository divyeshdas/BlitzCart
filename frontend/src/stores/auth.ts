import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type AuthUser = {
	id: string;
	email: string;
	role: 'user' | 'admin';
};

function createAuthStore() {
	const { subscribe, set } = writable<AuthUser | null>(null);

	return {
		subscribe,
		init() {
			if (!browser) return;
			const raw = localStorage.getItem('auth_user');
			if (raw) {
				try {
					set(JSON.parse(raw) as AuthUser);
				} catch {
					localStorage.removeItem('auth_user');
				}
			}
		},
		login(user: AuthUser, accessToken: string, refreshToken: string) {
			if (browser) {
				localStorage.setItem('access_token', accessToken);
				localStorage.setItem('refresh_token', refreshToken);
				localStorage.setItem('auth_user', JSON.stringify(user));
			}
			set(user);
		},
		logout() {
			if (browser) {
				localStorage.removeItem('access_token');
				localStorage.removeItem('refresh_token');
				localStorage.removeItem('auth_user');
			}
			set(null);
		},
	};
}

export const auth = createAuthStore();
