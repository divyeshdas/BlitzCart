<script lang="ts">
	import { goto } from '$app/navigation';
	import { api, ApiError } from '$lib/api';
	import { auth } from '$stores/auth';

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		loading = true;

		try {
			const res = await api<{
				accessToken: string;
				refreshToken: string;
				user: { id: string; email: string; role: 'user' | 'admin' };
			}>('/auth/login', { method: 'POST', body: { email, password } });

			auth.login(res.user, res.accessToken, res.refreshToken);
			await goto(res.user.role === 'admin' ? '/admin/sales' : '/sales');
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Something went wrong';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Sign in — BlitzCart</title>
</svelte:head>

<div class="flex min-h-[calc(100vh-3.5rem)]">
	<!-- Brand panel — hidden on mobile -->
	<div
		class="hidden flex-col items-center justify-center p-12 text-white md:flex md:w-1/2"
		style="background: linear-gradient(135deg, #1d4ed8, #7c3aed)"
	>
		<div class="max-w-xs text-center">
			<p class="mb-6 text-5xl font-black">⚡</p>
			<h1 class="text-4xl font-black tracking-tight">BlitzCart</h1>
			<p class="mt-4 text-xl font-semibold leading-snug opacity-90">
				100 items.<br />10,000 buyers.<br />One winner.
			</p>
			<p class="mt-6 text-sm opacity-60">Real-time inventory. Zero regrets.</p>
		</div>
	</div>

	<!-- Form panel -->
	<div class="flex flex-1 flex-col items-center justify-center px-6 py-12">
		<!-- Mobile logo -->
		<div class="mb-8 text-center md:hidden">
			<p class="text-2xl font-black gradient-text">⚡ BlitzCart</p>
		</div>

		<div class="w-full max-w-sm">
			<div class="mb-8">
				<h2 class="text-2xl font-bold">Welcome back</h2>
				<p class="mt-1 text-sm" style="color: var(--text-muted)">Sign in to join the drop</p>
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
							class="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
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
							autocomplete="current-password"
							class="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
							style="background: var(--bg); border-color: var(--border); color: var(--text-primary)"
						/>
					</div>

					<button
						type="submit"
						disabled={loading}
						class="w-full rounded-xl py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
						style="background: linear-gradient(135deg, #3b82f6, #8b5cf6)"
					>
						{loading ? 'Signing in…' : 'Sign in'}
					</button>
				</form>

				<p class="mt-5 text-center text-sm" style="color: var(--text-muted)">
					Don't have an account?
					<a href="/register" class="font-semibold text-blue-600 hover:underline">Create one</a>
				</p>
			</div>
		</div>
	</div>
</div>
