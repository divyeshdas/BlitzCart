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

	const productGradients = [
		'linear-gradient(135deg, #3b82f6, #8b5cf6)',
		'linear-gradient(135deg, #f97316, #ec4899)',
		'linear-gradient(135deg, #10b981, #3b82f6)',
		'linear-gradient(135deg, #8b5cf6, #ec4899)',
		'linear-gradient(135deg, #f59e0b, #ef4444)',
	];
</script>

<svelte:head>
	<title>{sale?.name ?? 'Sale'} — BlitzCart</title>
</svelte:head>

{#if error}
	<main class="mx-auto max-w-5xl px-4 py-10">
		<a href="/sales" class="mb-4 inline-block text-sm hover:underline" style="color: var(--text-muted)">← All sales</a>
		<div class="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">{error}</div>
	</main>
{:else if !loaded}
	<main class="mx-auto max-w-5xl px-4 py-10">
		<div class="animate-pulse space-y-6">
			<div class="skeleton h-40 rounded-2xl"></div>
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each [1, 2, 3] as _}
					<div class="skeleton h-56 rounded-2xl"></div>
				{/each}
			</div>
		</div>
	</main>
{:else if sale}
	<!-- Full-width hero -->
	<div
		class="relative overflow-hidden py-10 text-white"
		style="background: linear-gradient(135deg, #1d4ed8, #7c3aed)"
	>
		<div class="relative mx-auto max-w-5xl px-4">
			<a href="/sales" class="mb-4 inline-flex items-center gap-1 text-sm opacity-70 hover:opacity-100 transition">
				← All sales
			</a>
			<div class="flex flex-wrap items-start gap-4">
				<div class="flex-1">
					<div class="flex flex-wrap items-center gap-3">
						<h1 class="text-3xl font-black tracking-tight">{sale.name}</h1>
						<StatusBadge status={sale.status} />
					</div>

					{#if sale.status === 'active'}
						<div class="mt-2 flex flex-wrap items-center gap-4">
							<p class="text-sm opacity-80">
								Ends in <span class="font-bold opacity-100"><Countdown endsAt={sale.endsAt} /></span>
							</p>

							<!-- WS status -->
							<span class="flex items-center gap-1.5 text-sm opacity-80">
								<span
									class="inline-block h-2 w-2 rounded-full {wsStatus === 'connected'
										? 'bg-green-400'
										: wsStatus === 'connecting'
											? 'bg-amber-300 animate-pulse'
											: 'bg-red-400'}"
									style="{wsStatus === 'connected' ? 'box-shadow: 0 0 6px #4ade80' : ''}"
								></span>
								{#if wsStatus === 'connected'}
									{connectedCount} watching
								{:else if wsStatus === 'connecting'}
									Connecting…
								{:else}
									Reconnecting…
								{/if}
							</span>
						</div>
					{/if}
				</div>

				{#if !$auth}
					<a
						href="/login"
						class="rounded-xl px-5 py-2.5 text-sm font-bold transition hover:opacity-90"
						style="background: rgba(255,255,255,0.2); backdrop-filter: blur(4px)"
					>
						Sign in to buy
					</a>
				{/if}
			</div>
		</div>
	</div>

	<main class="mx-auto max-w-5xl px-4 py-10">
		{#if products.length === 0}
			<div class="rounded-2xl border p-12 text-center" style="border-color: var(--border)">
				<p class="text-sm" style="color: var(--text-muted)">No products in this sale</p>
			</div>
		{:else}
			<div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
				{#each products as product, i}
					{@const remaining = $inventoryStore[product.id] ?? product.quantity}
					{@const pct = stockPct(product.id, product.quantity)}
					{@const disc = discount(product.originalPrice, product.salePrice)}
					{@const grad = productGradients[i % productGradients.length]}
					{@const isActive = sale.status === 'active'}
					{@const canBuy = remaining > 0 && isActive && !!$auth && !buying[product.id]}
					<div
						class="flex flex-col overflow-hidden rounded-2xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl animate-fade-up"
						style="background: var(--bg-card); border: 1px solid var(--border); animation-delay: {i * 60}ms"
					>
						<!-- Color swatch header -->
						<div class="relative h-20" style="background: {grad}">
							{#if disc > 0}
								<span
									class="absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-black text-white"
									style="background: rgba(0,0,0,0.35)"
								>
									-{disc}%
								</span>
							{/if}
							{#if remaining === 0}
								<div class="absolute inset-0 flex items-center justify-center" style="background: rgba(0,0,0,0.5)">
									<span class="text-sm font-black uppercase tracking-widest text-white">Sold Out</span>
								</div>
							{/if}
						</div>

						<div class="flex flex-1 flex-col p-4">
							<h3 class="mb-1 font-bold leading-snug">{product.name}</h3>

							<div class="mb-4 flex items-baseline gap-2">
								<span class="text-2xl font-black">${product.salePrice}</span>
								{#if disc > 0}
									<span class="text-sm line-through" style="color: var(--text-muted)">${product.originalPrice}</span>
								{/if}
							</div>

							<!-- Stock bar -->
							<div class="mt-auto space-y-1.5">
								<div class="flex justify-between text-xs" style="color: var(--text-muted)">
									<span>
										{#if remaining === 0}
											Sold out
										{:else if pct < 10}
											<span class="font-semibold text-red-500">Only {remaining} left!</span>
										{:else}
											{remaining} of {product.quantity} left
										{/if}
									</span>
									<span>{pct}%</span>
								</div>
								<div class="h-2 w-full overflow-hidden rounded-full" style="background: var(--bg)">
									<div
										class="h-full rounded-full transition-all duration-500"
										style="width: {pct}%; background: {pct > 50 ? 'linear-gradient(90deg,#10b981,#3b82f6)' : pct > 10 ? 'linear-gradient(90deg,#f59e0b,#f97316)' : 'linear-gradient(90deg,#ef4444,#ec4899)'}"
									></div>
								</div>
							</div>

							{#if buyResult[product.id]?.message}
								<p class="mt-3 rounded-lg px-3 py-1.5 text-center text-xs font-semibold
									{buyResult[product.id].success
										? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
										: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'}">
									{buyResult[product.id].message}
								</p>
							{/if}

							<button
								disabled={!canBuy}
								onclick={() => handleBuy(product.id)}
								class="mt-3 w-full rounded-xl px-4 py-2.5 text-sm font-bold text-white transition
									disabled:cursor-not-allowed disabled:opacity-40
									{canBuy ? 'animate-pulse-glow hover:opacity-90' : ''}"
								style="{canBuy ? `background: ${grad}` : 'background: var(--bg)'}"
								title={!$auth ? 'Sign in to buy' : undefined}
							>
								{#if buying[product.id]}
									Placing order…
								{:else if remaining === 0}
									Sold out
								{:else if !isActive}
									Unavailable
								{:else if !$auth}
									Sign in to buy
								{:else}
									Buy now
								{/if}
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</main>
{/if}
