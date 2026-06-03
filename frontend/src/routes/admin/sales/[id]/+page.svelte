<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { api, ApiError } from '$lib/api';
	import StatusBadge from '$components/StatusBadge.svelte';
	import Countdown from '$components/Countdown.svelte';

	type OrderRow = {
		id: string;
		status: 'pending' | 'confirmed' | 'failed';
		createdAt: string;
		productName: string;
		salePrice: string;
		userId: string;
	};

	type SaleProduct = {
		id: string;
		name: string;
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

	type Stats = { total: number; confirmed: number; failed: number; pending: number };

	const saleId = $derived(page.params['id'] ?? '');

	let sale = $state<Sale | null>(null);
	let saleProducts = $state<SaleProduct[]>([]);
	let orderList = $state<OrderRow[]>([]);
	let stats = $state<Stats>({ total: 0, confirmed: 0, failed: 0, pending: 0 });
	let error = $state('');
	let loaded = $state(false);

	onMount(async () => {
		try {
			const [saleRes, ordersRes] = await Promise.all([
				api<{ sale: Sale; products: SaleProduct[] }>(`/admin/sales/${saleId}`),
				api<{ orders: OrderRow[]; stats: Stats }>(`/admin/sales/${saleId}/orders`),
			]);
			sale = saleRes.sale;
			saleProducts = saleRes.products;
			orderList = ordersRes.orders;
			stats = ordersRes.stats;
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Failed to load sale';
		} finally {
			loaded = true;
		}
	});

	function fmt(date: string) {
		return new Date(date).toLocaleString(undefined, {
			month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
		});
	}

	function conversionRate() {
		if (stats.total === 0) return '—';
		return ((stats.confirmed / stats.total) * 100).toFixed(1) + '%';
	}

	function totalInventory() {
		return saleProducts.reduce((sum, p) => sum + p.quantity, 0);
	}

	function soldUnits() {
		return stats.confirmed;
	}
</script>

<svelte:head>
	<title>{sale?.name ?? 'Sale'} — Admin — BlitzCart</title>
</svelte:head>

<main class="mx-auto max-w-6xl px-4 py-10">
	<div class="mb-2">
		<a href="/admin/sales" class="text-sm hover:underline" style="color: var(--text-muted)">← All sales</a>
	</div>

	{#if error}
		<div class="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
	{:else if !loaded}
		<div class="animate-pulse space-y-6">
			<div class="h-10 w-64 rounded-lg" style="background: var(--bg-card)"></div>
			<div class="grid gap-4 sm:grid-cols-4">
				{#each [1,2,3,4] as _}
					<div class="h-24 rounded-xl" style="background: var(--bg-card)"></div>
				{/each}
			</div>
		</div>
	{:else if sale}
		<!-- Header -->
		<div class="mb-6 flex flex-wrap items-start gap-4">
			<div class="flex-1">
				<div class="flex items-center gap-3">
					<h1 class="text-2xl font-bold">{sale.name}</h1>
					<StatusBadge status={sale.status} />
				</div>
				{#if sale.status === 'active'}
					<p class="mt-1 text-sm" style="color: var(--text-muted)">
						Ends in <span class="font-semibold text-amber-600"><Countdown endsAt={sale.endsAt} /></span>
					</p>
				{:else}
					<p class="mt-1 text-sm" style="color: var(--text-muted)">
						{fmt(sale.startsAt)} → {fmt(sale.endsAt)}
					</p>
				{/if}
			</div>
		</div>

		<!-- Stat cards -->
		<div class="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			{#each [
				{ label: 'Total orders', value: stats.total, color: 'text-blue-600' },
				{ label: 'Confirmed', value: stats.confirmed, color: 'text-green-600' },
				{ label: 'Failed', value: stats.failed, color: 'text-red-500' },
				{ label: 'Conversion', value: conversionRate(), color: 'text-purple-600' },
			] as card}
				<div class="rounded-2xl border p-5" style="background: var(--bg-card); border-color: var(--border)">
					<p class="text-xs font-medium uppercase tracking-wider" style="color: var(--text-muted)">{card.label}</p>
					<p class="mt-2 text-3xl font-bold {card.color}">{card.value}</p>
				</div>
			{/each}
		</div>

		<!-- Products inventory snapshot -->
		{#if saleProducts.length > 0}
			<div class="mb-8">
				<h2 class="mb-3 text-base font-semibold">Inventory</h2>
				<div class="overflow-hidden rounded-xl border" style="border-color: var(--border)">
					<table class="w-full text-sm">
						<thead style="background: var(--bg-card)">
							<tr class="border-b" style="border-color: var(--border)">
								<th class="px-4 py-2.5 text-left font-medium" style="color: var(--text-muted)">Product</th>
								<th class="px-4 py-2.5 text-right font-medium" style="color: var(--text-muted)">Original qty</th>
								<th class="px-4 py-2.5 text-right font-medium" style="color: var(--text-muted)">Remaining</th>
								<th class="px-4 py-2.5 text-right font-medium" style="color: var(--text-muted)">Sold</th>
							</tr>
						</thead>
						<tbody>
							{#each saleProducts as p}
								{@const remaining = p.inventoryRemaining ?? p.quantity}
								{@const sold = p.quantity - remaining}
								<tr class="border-b last:border-0" style="border-color: var(--border); background: var(--bg-card)">
									<td class="px-4 py-2.5 font-medium">{p.name}</td>
									<td class="px-4 py-2.5 text-right">{p.quantity}</td>
									<td class="px-4 py-2.5 text-right font-semibold {remaining === 0 ? 'text-red-500' : 'text-green-600'}">{remaining}</td>
									<td class="px-4 py-2.5 text-right" style="color: var(--text-muted)">{sold}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}

		<!-- Orders table -->
		<div>
			<h2 class="mb-3 text-base font-semibold">Orders ({orderList.length})</h2>

			{#if orderList.length === 0}
				<div class="rounded-xl border p-10 text-center text-sm" style="border-color: var(--border); color: var(--text-muted)">
					No orders yet
				</div>
			{:else}
				<div class="overflow-hidden rounded-xl border" style="border-color: var(--border)">
					<table class="w-full text-sm">
						<thead style="background: var(--bg-card)">
							<tr class="border-b" style="border-color: var(--border)">
								<th class="px-4 py-2.5 text-left font-medium" style="color: var(--text-muted)">Order ID</th>
								<th class="px-4 py-2.5 text-left font-medium" style="color: var(--text-muted)">User</th>
								<th class="px-4 py-2.5 text-left font-medium" style="color: var(--text-muted)">Product</th>
								<th class="px-4 py-2.5 text-right font-medium" style="color: var(--text-muted)">Price</th>
								<th class="px-4 py-2.5 text-left font-medium" style="color: var(--text-muted)">Status</th>
								<th class="px-4 py-2.5 text-left font-medium" style="color: var(--text-muted)">Time</th>
							</tr>
						</thead>
						<tbody>
							{#each orderList as order}
								<tr class="border-b last:border-0" style="border-color: var(--border); background: var(--bg-card)">
									<td class="px-4 py-2.5 font-mono text-xs" style="color: var(--text-muted)">#{order.id.slice(0,8)}</td>
									<td class="px-4 py-2.5 font-mono text-xs" style="color: var(--text-muted)">{order.userId.slice(0,8)}</td>
									<td class="px-4 py-2.5">{order.productName}</td>
									<td class="px-4 py-2.5 text-right font-semibold">${order.salePrice}</td>
									<td class="px-4 py-2.5"><StatusBadge status={order.status} /></td>
									<td class="px-4 py-2.5 text-xs" style="color: var(--text-muted)">{fmt(order.createdAt)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	{/if}
</main>
