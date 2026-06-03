<script lang="ts">
	import { auth } from '$stores/auth';
</script>

<svelte:head>
	<title>Flash Sales — BlitzCart</title>
</svelte:head>

<main class="mx-auto max-w-5xl px-4 py-10">
	<div class="mb-8 flex items-center justify-between">
		<h1 class="text-2xl font-bold">Flash Sales</h1>
		{#if $auth}
			<div class="flex items-center gap-3">
				<span class="text-sm" style="color: var(--text-muted)">{$auth.email}</span>
				<button
					onclick={() => auth.logout()}
					class="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-white/5"
					style="border-color: var(--border)"
				>
					Sign out
				</button>
			</div>
		{:else}
			<a href="/login" class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
				Sign in
			</a>
		{/if}
	</div>

	<div class="rounded-2xl border p-12 text-center" style="border-color: var(--border)">
		<p class="text-lg font-medium">No active sales right now</p>
		<p class="mt-1 text-sm" style="color: var(--text-muted)">Check back soon for flash deals</p>
	</div>
</main>
