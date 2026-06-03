<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { api, ApiError } from '$lib/api';
	import { auth } from '$stores/auth';
	import Countdown from '$components/Countdown.svelte';
	import StatusBadge from '$components/StatusBadge.svelte';

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
		startsAt: string;
		endsAt: string;
	};

	let sale = $state<Sale | null>(null);
	let products = $state<SaleProduct[]>([]);
	let error = $state('');
	let loaded = $state(false);

	const saleId = $derived(page.params.id);

	onMount(async () => {
		try {
			const res = await api<{ sale: Sale; products: SaleProduct[] }>(`/sales/${saleId}`);
			sale = res.sale;
			products = res.products;
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Failed to load sale';
		} finally {
			loaded = true;
		}
	});

	function stockPct(p: SaleProduct) {
		const remaining = p.inventoryRemaining ?? p.quantity;
		if (p.quantity === 0) return 0;
		return Math.round((remaining / p.quantity) * 100);
	}

	function barColor(pct: number) {
		if (pct > 50) return 'bg-green-500';
		if (pct > 10) return 'bg-amber-400';
		return 'bg-red-500';
	}

	function discount(original: string, sale: string) {
		const o = parseFloat(original);
		const s = parseFloat(sale);
		if (o === 0) return 0;
		return Math.round(((o - s) / o) * 100);
	}
</script>

<svelte:head>
	<title>{sale?.name ?? 'Sale'} — BlitzCart</title>
</svelte:head>

<main class="mx-auto max-w-5xl px-4 py-10">
	<div class="mb-2">
		<a href="/sales" class="text-sm hover:underline" style="color: var(--text-muted)">← All sales</a>
	</div>

	{#if error}
		<div class="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
	{:else if !loaded}
		<div class="animate-pulse space-y-6">
			<div class="h-10 w-64 rounded-lg" style="background: var(--bg-card)"></div>
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each [1, 2, 3] as _}
					<div class="h-48 rounded-2xl" style="background: var(--bg-card)"></div>
				{/each}
			</div>
		</div>
	{:else if sale}
		<div class="mb-8 flex flex-wrap items-start gap-4">
			<div class="flex-1">
				<div class="flex items-center gap-3">
					<h1 class="text-2xl font-bold">{sale.name}</h1>
					<StatusBadge status={sale.status} />
				</div>
				{#if sale.status === 'active'}
					<p class="mt-1 text-sm" style="color: var(--text-muted)">
						Ends in <span class="font-semibold text-amber-600"><Countdown endsAt={sale.endsAt} /></span>
					</p>
				{/if}
			</div>
			{#if !$auth}
				<a href="/login" class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
					Sign in to buy
				</a>
			{/if}
		</div>

		{#if products.length === 0}
			<div class="rounded-2xl border p-12 text-center" style="border-color: var(--border)">
				<p class="text-sm" style="color: var(--text-muted)">No products in this sale</p>
			</div>
		{:else}
			<div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
				{#each products as product}
					{@const remaining = product.inventoryRemaining ?? product.quantity}
					{@const pct = stockPct(product)}
					{@const disc = discount(product.originalPrice, product.salePrice)}
					<div class="flex flex-col rounded-2xl border p-5" style="background: var(--bg-card); border-color: var(--border)">
						<div class="mb-1 flex items-start justify-between gap-2">
							<h3 class="font-semibold leading-snug">{product.name}</h3>
							{#if disc > 0}
								<span class="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700 dark:bg-green-900/30 dark:text-green-400">
									-{disc}%
								</span>
							{/if}
						</div>

						<div class="mb-4 flex items-baseline gap-2">
							<span class="text-2xl font-bold">${product.salePrice}</span>
							{#if disc > 0}
								<span class="text-sm line-through" style="color: var(--text-muted)">${product.originalPrice}</span>
							{/if}
						</div>

						<div class="mt-auto space-y-1.5">
							<div class="flex justify-between text-xs" style="color: var(--text-muted)">
								<span>
									{#if remaining === 0}
										Sold out
									{:else}
										{remaining} left
									{/if}
								</span>
								<span>{pct}%</span>
							</div>
							<div class="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
								<div
									class="h-full rounded-full transition-all duration-300 {barColor(pct)}"
									style="width: {pct}%"
								></div>
							</div>
						</div>

						<button
							disabled={remaining === 0 || sale.status !== 'active' || !$auth}
							class="mt-4 w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition
								disabled:cursor-not-allowed disabled:opacity-40
								enabled:bg-blue-600 enabled:text-white enabled:hover:bg-blue-700"
							title={!$auth ? 'Sign in to buy' : undefined}
						>
							{#if remaining === 0}
								Sold out
							{:else if sale.status !== 'active'}
								Unavailable
							{:else if !$auth}
								Sign in to buy
							{:else}
								Buy now
							{/if}
						</button>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</main>
