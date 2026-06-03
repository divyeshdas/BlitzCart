<script lang="ts">
	import { goto } from '$app/navigation';
	import { api, ApiError } from '$lib/api';
	import { auth } from '$stores/auth';

	let email = $state('');
	let password = $state('');
	let confirm = $state('');
	let error = $state('');
	let loading = $state(false);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = '';

		if (password !== confirm) {
			error = 'Passwords do not match';
			return;
		}

		loading = true;
		try {
			const res = await api<{
				accessToken: string;
				refreshToken: string;
				user: { id: string; email: string; role: 'user' | 'admin' };
			}>('/auth/register', { method: 'POST', body: { email, password } });

			auth.login(res.user, res.accessToken, res.refreshToken);
			await goto('/sales');
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Something went wrong';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Create account — BlitzCart</title>
</svelte:head>

<main class="flex min-h-screen items-center justify-center px-4">
	<div class="w-full max-w-sm">
		<div class="mb-8 text-center">
			<h1 class="text-3xl font-bold tracking-tight">BlitzCart</h1>
			<p class="mt-1 text-sm" style="color: var(--text-muted)">Create your account</p>
		</div>

		<div class="rounded-2xl border p-8 shadow-sm" style="background: var(--bg-card); border-color: var(--border)">
			{#if error}
				<div class="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
					{error}
				</div>
			{/if}

			<form onsubmit={handleSubmit} class="space-y-4">
				<div>
					<label class="mb-1.5 block text-sm font-medium" for="email">Email</label>
					<input
						id="email"
						type="email"
						bind:value={email}
						required
						autocomplete="email"
						class="w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
						style="background: var(--bg); border-color: var(--border); color: var(--text-primary)"
					/>
				</div>

				<div>
					<label class="mb-1.5 block text-sm font-medium" for="password">Password</label>
					<input
						id="password"
						type="password"
						bind:value={password}
						required
						minlength="8"
						autocomplete="new-password"
						class="w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
						style="background: var(--bg); border-color: var(--border); color: var(--text-primary)"
					/>
				</div>

				<div>
					<label class="mb-1.5 block text-sm font-medium" for="confirm">Confirm password</label>
					<input
						id="confirm"
						type="password"
						bind:value={confirm}
						required
						autocomplete="new-password"
						class="w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
						style="background: var(--bg); border-color: var(--border); color: var(--text-primary)"
					/>
				</div>

				<button
					type="submit"
					disabled={loading}
					class="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
				>
					{loading ? 'Creating account…' : 'Create account'}
				</button>
			</form>

			<p class="mt-5 text-center text-sm" style="color: var(--text-muted)">
				Already have an account?
				<a href="/login" class="font-medium text-blue-600 hover:underline">Sign in</a>
			</p>
		</div>
	</div>
</main>
