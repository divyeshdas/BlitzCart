<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { api, ApiError } from '$lib/api';
	import { createSaleSocket } from '$lib/ws-client';
	import { inventoryStore } from '$stores/inventory';
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
	let buying = $state<Record<string, boolean>>({});
	let buyResult = $state<Record<string, { success: boolean; message: string }>>({});
	let wsStatus = $state<'connecting' | 'connected' | 'disconnected'>('connecting');
	let connectedCount = $state(0);

	const saleId = $derived(page.params['id'] ?? '');

	let socket: ReturnType<typeof createSaleSocket> | null = null;

	async function loadSale() {
		try {
			const res = await api<{ sale: Sale; products: SaleProduct[] }>(`/sales/${saleId}`);
			sale = res.sale;
			products = res.products;

			// Seed the inventory store from REST data
			const seedMap: Record<string, number> = {};
			for (const p of res.products) {
				seedMap[p.id] = p.inventoryRemaining ?? p.quantity;
			}
			inventoryStore.seed(seedMap);
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Failed to load sale';
		} finally {
			loaded = true;
		}
	}

	onMount(async () => {
		await loadSale();

		socket = createSaleSocket(saleId, (msg) => {
			if (msg.type === 'inventory-update') {
				inventoryStore.update(msg.productId, msg.remaining);
			}
		});

		// Sync reactive wsStatus and connectedCount from store subscriptions
		socket.status.subscribe((s) => (wsStatus = s));
		socket.connectedCount.subscribe((n) => (connectedCount = n));

		// On reconnect: re-fetch REST to get latest state, then WS takes over
		let prevStatus: typeof wsStatus = wsStatus;
		socket.status.subscribe((s) => {
			if (prevStatus === 'disconnected' && s === 'connected') {
				void loadSale();
			}
			prevStatus = s;
		});
	});

	onDestroy(() => {
		socket?.destroy();
		inventoryStore.reset();
	});

	async function handleBuy(productId: string) {
		buying[productId] = true;
		buyResult[productId] = { success: false, message: '' };

		try {
			const res = await api<{ orderId: string; remaining: number }>(`/sales/${saleId}/buy`, {
				method: 'POST',
				body: { productId },
			});

			// Optimistic update — WS will confirm shortly
			inventoryStore.update(productId, res.remaining);
			buyResult[productId] = { success: true, message: `Order placed! #${res.orderId.slice(0, 8)}` };
		} catch (err) {
			const msg =
				err instanceof ApiError
					? err.status === 410
						? 'Sold out'
						: err.status === 429
							? 'Too many requests — slow down'
							: err.message
					: 'Something went wrong';
			buyResult[productId] = { success: false, message: msg };
		} finally {
			buying[productId] = false;
		}
	}

	function stockPct(productId: string, total: number): number {
		const remaining = $inventoryStore[productId] ?? total;
		if (total === 0) return 0;
		return Math.round((remaining / total) * 100);
	}

	function barColor(pct: number): string {
		if (pct > 50) return 'bg-green-500';
		if (pct > 10) return 'bg-amber-400';
		return 'bg-red-500';
	}

	function discount(original: string, salePrice: string): number {
		const o = parseFloat(original);
		const s = parseFloat(salePrice);
		if (o === 0) return 0;
		return Math.round(((o - s) / o) * 100);
	}
</script>

<svelte:head>
	<title>{sale?.name ?? 'Sale'} — BlitzCart</title>
</svelte:head>

<main class="mx-auto max-w-5xl px-4 py-10">
	<div class="mb-2 flex items-center justify-between">
		<a href="/sales" class="text-sm hover:underline" style="color: var(--text-muted)">← All sales</a>

		<!-- WS connection status + connected count badge -->
		<div class="flex items-center gap-2 text-xs" style="color: var(--text-muted)">
			{#if sale?.status === 'active'}
				<span class="flex items-center gap-1.5">
					<span
						class="inline-block h-2 w-2 rounded-full {wsStatus === 'connected'
							? 'bg-green-500'
							: wsStatus === 'connecting'
								? 'bg-amber-400 animate-pulse'
								: 'bg-red-400'}"
					></span>
					{#if wsStatus === 'connected'}
						{connectedCount} watching
					{:else if wsStatus === 'connecting'}
						Connecting…
					{:else}
						Reconnecting…
					{/if}
				</span>
			{/if}
		</div>
	</div>

	{#if error}
		<div class="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
	{:else if !loaded}
		<div class="animate-pulse space-y-6">
			<div class="h-10 w-64 rounded-lg" style="background: var(--bg-card)"></div>
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each [1, 2, 3] as _}
					<div class="h-52 rounded-2xl" style="background: var(--bg-card)"></div>
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
					{@const remaining = $inventoryStore[product.id] ?? product.quantity}
					{@const pct = stockPct(product.id, product.quantity)}
					{@const disc = discount(product.originalPrice, product.salePrice)}
					<div class="flex flex-col rounded-2xl border p-5 transition-shadow hover:shadow-sm"
						style="background: var(--bg-card); border-color: var(--border)">

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

						<!-- Sold-out banner overlays the bar when stock hits zero -->
						{#if remaining === 0}
							<div class="mb-3 rounded-lg bg-red-50 py-2 text-center text-xs font-bold uppercase tracking-widest text-red-600 dark:bg-red-900/20 dark:text-red-400">
								Sold out
							</div>
						{/if}

						<div class="mt-auto space-y-1.5">
							<div class="flex justify-between text-xs" style="color: var(--text-muted)">
								<span>{remaining} of {product.quantity} left</span>
								<span>{pct}%</span>
							</div>
							<div class="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
								<div
									class="h-full rounded-full transition-all duration-300 {barColor(pct)}"
									style="width: {pct}%"
								></div>
							</div>
						</div>

						{#if buyResult[product.id]?.message}
							<p class="mt-3 text-center text-xs font-medium {buyResult[product.id].success ? 'text-green-600' : 'text-red-500'}">
								{buyResult[product.id].message}
							</p>
						{/if}

						<button
							disabled={remaining === 0 || sale.status !== 'active' || !$auth || buying[product.id]}
							onclick={() => handleBuy(product.id)}
							class="mt-3 w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition
								disabled:cursor-not-allowed disabled:opacity-40
								enabled:bg-blue-600 enabled:text-white enabled:hover:bg-blue-700"
							title={!$auth ? 'Sign in to buy' : undefined}
						>
							{#if buying[product.id]}
								Placing order…
							{:else if remaining === 0}
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
