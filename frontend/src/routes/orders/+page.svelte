<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { api, ApiError } from '$lib/api';
	import { auth } from '$stores/auth';
	import StatusBadge from '$components/StatusBadge.svelte';

	type OrderRow = {
		id: string;
		status: 'pending' | 'confirmed' | 'failed';
		createdAt: string;
		productName: string;
		salePrice: string;
		saleName: string;
		saleId: string;
	};

	let orderList = $state<OrderRow[]>([]);
	let error = $state('');
	let loaded = $state(false);

	onMount(async () => {
		if (!$auth) { goto('/login'); return; }

		try {
			const res = await api<{ orders: OrderRow[] }>('/orders/me');
			orderList = res.orders;
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Failed to load orders';
		} finally {
			loaded = true;
		}
	});

	function fmt(date: string) {
		return new Date(date).toLocaleString(undefined, {
			month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
		});
	}
</script>

<svelte:head>
	<title>My Orders — BlitzCart</title>
</svelte:head>

<main class="mx-auto max-w-4xl px-4 py-10">
	<div class="mb-8 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold">My Orders</h1>
			<p class="mt-0.5 text-sm" style="color: var(--text-muted)">{$auth?.email}</p>
		</div>
		<a href="/sales" class="text-sm font-medium text-blue-600 hover:underline">← Browse sales</a>
	</div>

	{#if error}
		<div class="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
	{:else if !loaded}
		<div class="space-y-3">
			{#each [1, 2, 3] as _}
				<div class="h-16 animate-pulse rounded-xl" style="background: var(--bg-card)"></div>
			{/each}
		</div>
	{:else if orderList.length === 0}
		<div class="rounded-2xl border p-16 text-center" style="border-color: var(--border)">
			<p class="text-lg font-semibold">No orders yet</p>
			<p class="mt-1 text-sm" style="color: var(--text-muted)">Your purchases will appear here</p>
			<a href="/sales" class="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline">
				Browse active sales →
			</a>
		</div>
	{:else}
		<div class="overflow-hidden rounded-2xl border" style="border-color: var(--border)">
			<table class="w-full text-sm">
				<thead style="background: var(--bg-card)">
					<tr class="border-b" style="border-color: var(--border)">
						<th class="px-4 py-3 text-left font-medium" style="color: var(--text-muted)">Order</th>
						<th class="px-4 py-3 text-left font-medium" style="color: var(--text-muted)">Sale</th>
						<th class="px-4 py-3 text-left font-medium" style="color: var(--text-muted)">Product</th>
						<th class="px-4 py-3 text-right font-medium" style="color: var(--text-muted)">Price</th>
						<th class="px-4 py-3 text-left font-medium" style="color: var(--text-muted)">Status</th>
						<th class="px-4 py-3 text-left font-medium" style="color: var(--text-muted)">Time</th>
					</tr>
				</thead>
				<tbody>
					{#each orderList as order}
						<tr class="border-b last:border-0" style="border-color: var(--border); background: var(--bg-card)">
							<td class="px-4 py-3 font-mono text-xs" style="color: var(--text-muted)">
								#{order.id.slice(0, 8)}
							</td>
							<td class="px-4 py-3">
								<a href="/sales/{order.saleId}" class="hover:text-blue-600 font-medium">
									{order.saleName}
								</a>
							</td>
							<td class="px-4 py-3">{order.productName}</td>
							<td class="px-4 py-3 text-right font-semibold">${order.salePrice}</td>
							<td class="px-4 py-3">
								<StatusBadge status={order.status} />
							</td>
							<td class="px-4 py-3 text-xs" style="color: var(--text-muted)">{fmt(order.createdAt)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</main>
