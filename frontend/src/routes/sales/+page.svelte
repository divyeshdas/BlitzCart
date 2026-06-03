<script lang="ts">
	import { onMount } from 'svelte';
	import { auth } from '$stores/auth';
	import { api, ApiError } from '$lib/api';
	import Countdown from '$components/Countdown.svelte';

	type SaleProduct = {
		id: string;
		name: string;
		salePrice: string;
		originalPrice: string;
		quantity: number;
		inventoryRemaining: number | null;
	};

	type Sale = {
		id: string;
		name: string;
		status: 'draft' | 'active' | 'ended';
		endsAt: string;
		products: SaleProduct[];
	};

	let sales = $state<Sale[]>([]);
	let error = $state('');
	let loaded = $state(false);

	onMount(async () => {
		try {
			const res = await api<{ sales: Sale[] }>('/sales');
			sales = res.sales;
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Failed to load sales';
		} finally {
			loaded = true;
		}
	});

	function totalStock(products: SaleProduct[]) {
		return products.reduce((sum, p) => sum + p.quantity, 0);
	}

	function liveStock(products: SaleProduct[]) {
		return products.reduce((sum, p) => sum + (p.inventoryRemaining ?? p.quantity), 0);
	}

	function stockPct(products: SaleProduct[]) {
		const total = totalStock(products);
		if (total === 0) return 0;
		return Math.round((liveStock(products) / total) * 100);
	}

	function barColor(pct: number) {
		if (pct > 50) return 'bg-green-500';
		if (pct > 10) return 'bg-amber-400';
		return 'bg-red-500';
	}
</script>

<svelte:head>
	<title>Flash Sales — BlitzCart</title>
</svelte:head>

<main class="mx-auto max-w-5xl px-4 py-10">
	<div class="mb-8 flex items-center justify-between">
		<h1 class="text-2xl font-bold">Flash Sales</h1>
		{#if $auth}
			<div class="flex items-center gap-3">
				{#if $auth.role === 'admin'}
					<a href="/admin/sales" class="text-sm font-medium text-blue-600 hover:underline">Admin</a>
				{/if}
				<span class="text-sm" style="color: var(--text-muted)">{$auth.email}</span>
				<button
					onclick={() => auth.logout()}
					class="rounded-lg border px-3 py-1.5 text-sm hover:opacity-75"
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

	{#if error}
		<div class="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
	{:else if !loaded}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each [1, 2, 3] as _}
				<div class="h-48 animate-pulse rounded-2xl" style="background: var(--bg-card)"></div>
			{/each}
		</div>
	{:else if sales.length === 0}
		<div class="rounded-2xl border p-16 text-center" style="border-color: var(--border)">
			<p class="text-lg font-semibold">No active sales right now</p>
			<p class="mt-1 text-sm" style="color: var(--text-muted)">Check back soon for flash deals</p>
		</div>
	{:else}
		<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{#each sales as sale}
				{@const pct = stockPct(sale.products)}
				{@const live = liveStock(sale.products)}
				<a
					href="/sales/{sale.id}"
					class="group block rounded-2xl border p-5 transition hover:shadow-md"
					style="background: var(--bg-card); border-color: var(--border)"
				>
					<div class="mb-3 flex items-start justify-between gap-2">
						<h2 class="font-semibold leading-tight group-hover:text-blue-600">{sale.name}</h2>
						<span class="shrink-0 text-xs font-medium text-amber-600">
							<Countdown endsAt={sale.endsAt} />
						</span>
					</div>

					<div class="mb-4 text-sm" style="color: var(--text-muted)">
						{sale.products.length} product{sale.products.length !== 1 ? 's' : ''}
					</div>

					<div class="space-y-1.5">
						<div class="flex justify-between text-xs" style="color: var(--text-muted)">
							<span>{live === 0 ? 'Sold out' : `${live} remaining`}</span>
							<span>{pct}%</span>
						</div>
						<div class="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
							<div
								class="h-full rounded-full transition-all duration-300 {barColor(pct)}"
								style="width: {pct}%"
							></div>
						</div>
					</div>

					{#if live === 0}
						<div class="mt-3 text-center text-xs font-bold uppercase tracking-widest text-red-500">
							Sold out
						</div>
					{/if}
				</a>
			{/each}
		</div>
	{/if}
</main>
