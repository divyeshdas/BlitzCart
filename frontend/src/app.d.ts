declare global {
	namespace App {
		interface Locals {
			user?: {
				id: string;
				email: string;
				role: 'user' | 'admin';
			};
		}
		interface PageData {}
		interface PageState {}
		interface Error {
			message: string;
			code?: string;
		}
	}
}

export {};
