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

	// Redirect immediately if auth is lost (covers mid-session sign out)
	$effect(() => {
		if (!$auth) goto('/login');
	});

	onMount(async () => {
		if (!$auth) return;

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

	const totalOrders = $derived(orderList.length);
	const confirmedCount = $derived(orderList.filter((o) => o.status === 'confirmed').length);
	const totalSpent = $derived(
		orderList
			.filter((o) => o.status === 'confirmed')
			.reduce((sum, o) => sum + parseFloat(o.salePrice), 0)
			.toFixed(2)
	);
</script>

<svelte:head>
	<title>My Orders — BlitzCart</title>
</svelte:head>

<main class="mx-auto max-w-4xl px-4 py-10">
	<div class="mb-8">
		<h1 class="text-2xl font-bold">My Orders</h1>
		{#if $auth}
			<p class="mt-0.5 text-sm" style="color: var(--text-muted)">{$auth.email}</p>
		{/if}
	</div>

	{#if error}
		<div class="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">{error}</div>
	{:else if !loaded}
		<div class="space-y-3">
			{#each [1, 2, 3] as _}
				<div class="skeleton h-16 rounded-xl"></div>
			{/each}
		</div>
	{:else if orderList.length === 0}
		<div class="rounded-2xl border p-16 text-center" style="border-color: var(--border)">
			<p class="text-3xl">🛍️</p>
			<p class="mt-4 text-lg font-semibold">No orders yet</p>
			<p class="mt-1 text-sm" style="color: var(--text-muted)">Your purchases will appear here</p>
			<a href="/sales" class="mt-4 inline-block rounded-xl px-5 py-2 text-sm font-bold text-white" style="background: linear-gradient(135deg,#3b82f6,#8b5cf6)">
				Browse active sales →
			</a>
		</div>
	{:else}
		<!-- Stats row -->
		<div class="mb-8 grid gap-4 sm:grid-cols-3">
			{#each [
				{ label: 'Total orders', value: totalOrders, icon: '📦', color: '#3b82f6' },
				{ label: 'Confirmed', value: confirmedCount, icon: '✅', color: '#10b981' },
				{ label: 'Total spent', value: `$${totalSpent}`, icon: '💳', color: '#8b5cf6' },
			] as stat}
				<div
					class="rounded-2xl border p-5 animate-fade-up"
					style="background: var(--bg-card); border-color: var(--border)"
				>
					<div class="flex items-center gap-2">
						<span class="text-xl">{stat.icon}</span>
						<p class="text-xs font-medium uppercase tracking-wider" style="color: var(--text-muted)">{stat.label}</p>
					</div>
					<p class="mt-2 text-3xl font-black" style="color: {stat.color}">{stat.value}</p>
				</div>
			{/each}
		</div>

		<!-- Orders table -->
		<div class="overflow-hidden rounded-2xl border" style="border-color: var(--border)">
			<table class="w-full text-sm">
				<thead style="background: var(--bg-card)">
					<tr class="border-b" style="border-color: var(--border)">
						<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style="color: var(--text-muted)">Order</th>
						<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style="color: var(--text-muted)">Sale</th>
						<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style="color: var(--text-muted)">Product</th>
						<th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider" style="color: var(--text-muted)">Price</th>
						<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style="color: var(--text-muted)">Status</th>
						<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style="color: var(--text-muted)">Time</th>
					</tr>
				</thead>
				<tbody>
					{#each orderList as order, i}
						<tr
							class="border-b last:border-0 transition hover:opacity-90"
							style="border-color: var(--border); background: {i % 2 === 0 ? 'var(--bg-card)' : 'color-mix(in srgb, var(--bg-card) 60%, var(--bg))'}"
						>
							<td class="px-4 py-3 font-mono text-xs" style="color: var(--text-muted)">
								#{order.id.slice(0, 8)}
							</td>
							<td class="px-4 py-3">
								<a href="/sales/{order.saleId}" class="font-semibold hover:text-blue-600 transition">
									{order.saleName}
								</a>
							</td>
							<td class="px-4 py-3" style="color: var(--text-primary)">{order.productName}</td>
							<td class="px-4 py-3 text-right font-bold">${order.salePrice}</td>
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
