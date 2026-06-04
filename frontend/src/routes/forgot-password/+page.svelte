<script lang="ts">
	let email = $state('');
	let submitted = $state(false);
	let loading = $state(false);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		loading = true;
		// Simulate a short delay so it feels real
		await new Promise((r) => setTimeout(r, 800));
		submitted = true;
		loading = false;
	}
</script>

<svelte:head>
	<title>Forgot Password — BlitzCart</title>
</svelte:head>

<div class="flex min-h-[calc(100vh-7rem)] items-center justify-center px-4">
	<div class="w-full max-w-sm">
		<div class="mb-8 text-center">
			<p class="text-3xl">🔐</p>
			<h1 class="mt-3 text-2xl font-bold">Forgot your password?</h1>
			<p class="mt-1 text-sm" style="color: var(--text-muted)">
				Enter your email and we'll send reset instructions.
			</p>
		</div>

		<div class="rounded-2xl border p-8 shadow-sm" style="background: var(--bg-card); border-color: var(--border)">
			{#if submitted}
				<div class="text-center">
					<p class="text-4xl">📬</p>
					<p class="mt-3 font-semibold">Check your inbox</p>
					<p class="mt-2 text-sm" style="color: var(--text-muted)">
						If <strong>{email}</strong> is registered, you'll receive a password reset link shortly.
					</p>
					<a
						href="/login"
						class="mt-5 inline-block text-sm font-semibold text-blue-600 hover:underline"
					>
						← Back to sign in
					</a>
				</div>
			{:else}
				<form onsubmit={handleSubmit} class="space-y-4">
					<div>
						<label class="mb-1.5 block text-sm font-medium" for="email">Email address</label>
						<input
							id="email"
							type="email"
							bind:value={email}
							required
							placeholder="you@example.com"
							autocomplete="email"
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
						{loading ? 'Sending…' : 'Send reset link'}
					</button>
				</form>

				<p class="mt-5 text-center text-sm" style="color: var(--text-muted)">
					Remembered it?
					<a href="/login" class="font-semibold text-blue-600 hover:underline">Sign in</a>
				</p>
			{/if}
		</div>
	</div>
</div>
