<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
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
	let activeTab = $state<'all' | 'limited' | 'ending'>('all');

	onMount(async () => {
		// Honour ?filter=limited from navbar link
		if (page.url.searchParams.get('filter') === 'limited') activeTab = 'limited';
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

	function msLeft(endsAt: string) {
		return new Date(endsAt).getTime() - Date.now();
	}

	const activeSales = $derived(sales.filter((s) => s.status === 'active'));

	const filteredSales = $derived(() => {
		if (activeTab === 'limited') return activeSales.filter((s) => stockPct(s.products) < 30);
		if (activeTab === 'ending') return activeSales.filter((s) => msLeft(s.endsAt) < 30 * 60 * 1000);
		return activeSales;
	});

	const tabs = [
		{ id: 'all',     label: '🛒 All Sales' },
		{ id: 'limited', label: '🔥 Limited Offers' },
		{ id: 'ending',  label: '⏱ Ending Soon' },
	] as const;

	// Cycle through gradient pairs for card headers
	const gradients = [
		'linear-gradient(135deg, #3b82f6, #8b5cf6)',
		'linear-gradient(135deg, #f97316, #ec4899)',
		'linear-gradient(135deg, #10b981, #3b82f6)',
		'linear-gradient(135deg, #8b5cf6, #ec4899)',
		'linear-gradient(135deg, #f59e0b, #ef4444)',
	];
</script>

<svelte:head>
	<title>Flash Sales — BlitzCart</title>
</svelte:head>

<!-- Hero — only when there are active sales -->
{#if loaded && activeSales.length > 0}
	<div
		class="relative overflow-hidden py-12 text-white"
		style="background: linear-gradient(135deg, #1d4ed8, #7c3aed)"
	>
		<!-- subtle noise texture overlay -->
		<div class="absolute inset-0 opacity-10" style="background-image: url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')"></div>
		<div class="relative mx-auto max-w-5xl px-4 text-center">
			<p class="mb-2 text-sm font-semibold uppercase tracking-widest opacity-80">Live now</p>
			<h1 class="text-4xl font-black tracking-tight md:text-5xl">⚡ Flash Sales</h1>
			<p class="mt-3 text-lg opacity-80">Limited stock. Real-time inventory.</p>
			<div class="mt-4 flex items-center justify-center gap-2">
				<span class="inline-block h-2 w-2 rounded-full bg-green-400" style="box-shadow: 0 0 8px #4ade80"></span>
				<span class="text-sm opacity-80">{activeSales.length} active sale{activeSales.length !== 1 ? 's' : ''}</span>
			</div>
		</div>
	</div>
{/if}

<main class="mx-auto max-w-5xl px-4 py-10">
	<!-- Filter tabs -->
	{#if loaded && activeSales.length > 0}
		<div class="mb-8 flex gap-2 overflow-x-auto pb-1">
			{#each tabs as tab}
				<button
					onclick={() => (activeTab = tab.id)}
					class="shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold transition-all duration-150
						{activeTab === tab.id
							? 'border-transparent text-white'
							: 'hover:opacity-80'}"
					style="{activeTab === tab.id
						? 'background: linear-gradient(135deg,#3b82f6,#8b5cf6); border-color: transparent'
						: 'background: var(--bg-card); border-color: var(--border); color: var(--text-primary)'}"
				>
					{tab.label}
				</button>
			{/each}
		</div>
	{/if}

	{#if error}
		<div class="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">{error}</div>
	{:else if !loaded}
		<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{#each [1, 2, 3] as _}
				<div class="overflow-hidden rounded-2xl" style="background: var(--bg-card); border: 1px solid var(--border)">
					<div class="skeleton h-32"></div>
					<div class="space-y-3 p-5">
						<div class="skeleton h-4 w-2/3 rounded-full"></div>
						<div class="skeleton h-3 w-1/3 rounded-full"></div>
						<div class="skeleton h-2 w-full rounded-full"></div>
					</div>
				</div>
			{/each}
		</div>
	{:else if activeSales.length === 0}
		<div class="rounded-2xl border p-16 text-center" style="border-color: var(--border)">
			<p class="text-4xl">⚡</p>
			<p class="mt-4 text-lg font-semibold">No active sales right now</p>
			<p class="mt-1 text-sm" style="color: var(--text-muted)">Check back soon for flash deals</p>
		</div>
	{:else if filteredSales().length === 0}
		<div class="rounded-2xl border p-12 text-center" style="border-color: var(--border)">
			<p class="text-3xl">🔍</p>
			<p class="mt-3 font-semibold">No sales match this filter</p>
			<button onclick={() => (activeTab = 'all')} class="mt-3 text-sm font-medium text-blue-600 hover:underline">
				View all sales →
			</button>
		</div>
	{:else}
		<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{#each filteredSales() as sale, i}
				{@const pct = stockPct(sale.products)}
				{@const live = liveStock(sale.products)}
				{@const grad = gradients[i % gradients.length]}
				<a
					href="/sales/{sale.id}"
					class="group block overflow-hidden rounded-2xl transition-all duration-200 hover:-translate-y-1 hover:shadow-xl animate-fade-up"
					style="background: var(--bg-card); border: 1px solid var(--border); animation-delay: {i * 80}ms"
				>
					<!-- Gradient header area -->
					<div class="relative flex h-32 items-end p-4" style="background: {grad}">
						<h2 class="text-lg font-bold leading-tight text-white drop-shadow">{sale.name}</h2>
						<!-- Countdown pill -->
						<span
							class="absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-bold text-white"
							style="background: rgba(0,0,0,0.35); backdrop-filter: blur(4px)"
						>
							<Countdown endsAt={sale.endsAt} />
						</span>
						{#if sale.status === 'active'}
							<span
								class="absolute left-3 top-3 rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wider"
								style="background: rgba(255,255,255,0.2); color: white"
							>
								Live
							</span>
						{/if}
					</div>

					<!-- Card body -->
					<div class="p-4">
						<p class="mb-3 text-xs" style="color: var(--text-muted)">
							{sale.products.length} product{sale.products.length !== 1 ? 's' : ''}
						</p>

						<div class="space-y-1.5">
							<div class="flex justify-between text-xs" style="color: var(--text-muted)">
								<span>{live === 0 ? 'Sold out' : `${live} remaining`}</span>
								<span>{pct}%</span>
							</div>
							<div class="h-1.5 w-full overflow-hidden rounded-full" style="background: var(--bg)">
								<div
									class="h-full rounded-full transition-all duration-300"
									style="width: {pct}%; background: {pct > 50 ? 'linear-gradient(90deg,#10b981,#3b82f6)' : pct > 10 ? 'linear-gradient(90deg,#f59e0b,#f97316)' : 'linear-gradient(90deg,#ef4444,#ec4899)'}"
								></div>
							</div>
						</div>

						{#if live === 0}
							<p class="mt-3 text-center text-xs font-bold uppercase tracking-widest text-red-500">Sold out</p>
						{:else}
							<div class="mt-4 flex items-center justify-between">
								<span class="text-xs font-medium" style="color: var(--text-muted)">View sale</span>
								<span
									class="flex h-7 w-7 items-center justify-center rounded-full text-white transition group-hover:scale-110"
									style="background: {grad}"
								>
									→
								</span>
							</div>
						{/if}
					</div>
				</a>
			{/each}
		</div>
	{/if}
</main>
