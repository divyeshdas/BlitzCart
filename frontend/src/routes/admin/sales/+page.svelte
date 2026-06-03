<script lang="ts">
	import { onMount } from 'svelte';
	import { api, ApiError } from '$lib/api';
	import StatusBadge from '$components/StatusBadge.svelte';

	const pricePattern = '^\\d+(\\.\\d{1,2})?$';

	type SaleProduct = {
		id: string;
		name: string;
		originalPrice: string;
		salePrice: string;
		quantity: number;
		inventoryRemaining: number | null;
	};

	type Sale = {
		id: string;
		name: string;
		status: 'draft' | 'active' | 'ended';
		startsAt: string;
		endsAt: string;
		products: SaleProduct[];
	};

	let sales = $state<Sale[]>([]);
	let loadError = $state('');

	// Form state
	let formName = $state('');
	let formStartsAt = $state('');
	let formEndsAt = $state('');
	let formProducts = $state([{ name: '', originalPrice: '', salePrice: '', quantity: 1 }]);
	let formError = $state('');
	let formLoading = $state(false);
	let showForm = $state(false);

	async function loadSales() {
		try {
			const res = await api<{ sales: Sale[] }>('/admin/sales');
			sales = res.sales;
		} catch (err) {
			loadError = err instanceof ApiError ? err.message : 'Failed to load sales';
		}
	}

	onMount(loadSales);

	function addProduct() {
		formProducts = [...formProducts, { name: '', originalPrice: '', salePrice: '', quantity: 1 }];
	}

	function removeProduct(i: number) {
		formProducts = formProducts.filter((_, idx) => idx !== i);
	}

	async function handleCreate(e: SubmitEvent) {
		e.preventDefault();
		formError = '';
		formLoading = true;

		try {
			await api('/admin/sales', {
				method: 'POST',
				body: {
					name: formName,
					startsAt: new Date(formStartsAt).toISOString(),
					endsAt: new Date(formEndsAt).toISOString(),
					products: formProducts.map((p) => ({
						...p,
						quantity: Number(p.quantity),
					})),
				},
			});

			formName = '';
			formStartsAt = '';
			formEndsAt = '';
			formProducts = [{ name: '', originalPrice: '', salePrice: '', quantity: 1 }];
			showForm = false;
			await loadSales();
		} catch (err) {
			formError = err instanceof ApiError ? err.message : 'Failed to create sale';
		} finally {
			formLoading = false;
		}
	}

	function fmt(date: string) {
		return new Date(date).toLocaleString();
	}

	function totalStock(products: SaleProduct[]) {
		return products.reduce((sum, p) => sum + p.quantity, 0);
	}

	function liveStock(products: SaleProduct[]) {
		return products.reduce((sum, p) => sum + (p.inventoryRemaining ?? p.quantity), 0);
	}
</script>

<svelte:head>
	<title>Admin — Sales — BlitzCart</title>
</svelte:head>

<main class="mx-auto max-w-6xl px-4 py-10">
	<div class="mb-8 flex items-center justify-between">
		<h1 class="text-2xl font-bold">Sales</h1>
		<button
			onclick={() => (showForm = !showForm)}
			class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
		>
			{showForm ? 'Cancel' : '+ New sale'}
		</button>
	</div>

	{#if showForm}
		<div class="mb-8 rounded-2xl border p-6" style="background: var(--bg-card); border-color: var(--border)">
			<h2 class="mb-5 text-lg font-semibold">Create flash sale</h2>

			{#if formError}
				<div class="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
					{formError}
				</div>
			{/if}

			<form onsubmit={handleCreate} class="space-y-5">
				<div class="grid gap-4 sm:grid-cols-3">
					<div class="sm:col-span-1">
						<label class="mb-1.5 block text-sm font-medium" for="sale-name">Sale name</label>
						<input
							id="sale-name"
							type="text"
							bind:value={formName}
							required
							placeholder="Black Friday Flash"
							class="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
							style="background: var(--bg); border-color: var(--border); color: var(--text-primary)"
						/>
					</div>
					<div>
						<label class="mb-1.5 block text-sm font-medium" for="starts-at">Starts at</label>
						<input
							id="starts-at"
							type="datetime-local"
							bind:value={formStartsAt}
							required
							class="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
							style="background: var(--bg); border-color: var(--border); color: var(--text-primary)"
						/>
					</div>
					<div>
						<label class="mb-1.5 block text-sm font-medium" for="ends-at">Ends at</label>
						<input
							id="ends-at"
							type="datetime-local"
							bind:value={formEndsAt}
							required
							class="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
							style="background: var(--bg); border-color: var(--border); color: var(--text-primary)"
						/>
					</div>
				</div>

				<div>
					<div class="mb-2 flex items-center justify-between">
						<span class="text-sm font-medium">Products</span>
						<button
							type="button"
							onclick={addProduct}
							class="text-xs font-medium text-blue-600 hover:underline"
						>
							+ Add product
						</button>
					</div>

					<div class="space-y-3">
						{#each formProducts as product, i}
							<div class="grid gap-3 rounded-lg border p-3 sm:grid-cols-5" style="border-color: var(--border)">
								<div class="sm:col-span-2">
									<input
										type="text"
										bind:value={product.name}
										required
										placeholder="Product name"
										class="w-full rounded border px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-500"
										style="background: var(--bg); border-color: var(--border); color: var(--text-primary)"
									/>
								</div>
								<div>
									<input
										type="text"
										bind:value={product.originalPrice}
										required
										placeholder="Original $"
										pattern={pricePattern}
										class="w-full rounded border px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-500"
										style="background: var(--bg); border-color: var(--border); color: var(--text-primary)"
									/>
								</div>
								<div>
									<input
										type="text"
										bind:value={product.salePrice}
										required
										placeholder="Sale $"
										pattern={pricePattern}
										class="w-full rounded border px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-500"
										style="background: var(--bg); border-color: var(--border); color: var(--text-primary)"
									/>
								</div>
								<div class="flex items-center gap-2">
									<input
										type="number"
										bind:value={product.quantity}
										required
										min="1"
										placeholder="Qty"
										class="w-full rounded border px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-500"
										style="background: var(--bg); border-color: var(--border); color: var(--text-primary)"
									/>
									{#if formProducts.length > 1}
										<button
											type="button"
											onclick={() => removeProduct(i)}
											class="shrink-0 text-red-400 hover:text-red-600"
											aria-label="Remove product"
										>
											✕
										</button>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>

				<button
					type="submit"
					disabled={formLoading}
					class="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
				>
					{formLoading ? 'Creating…' : 'Create sale'}
				</button>
			</form>
		</div>
	{/if}

	{#if loadError}
		<div class="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
	{:else if sales.length === 0}
		<div class="rounded-2xl border p-12 text-center" style="border-color: var(--border)">
			<p class="text-sm" style="color: var(--text-muted)">No sales yet. Create one above.</p>
		</div>
	{:else}
		<div class="overflow-hidden rounded-2xl border" style="border-color: var(--border)">
			<table class="w-full text-sm">
				<thead style="background: var(--bg-card)">
					<tr class="border-b" style="border-color: var(--border)">
						<th class="px-4 py-3 text-left font-medium" style="color: var(--text-muted)">Name</th>
						<th class="px-4 py-3 text-left font-medium" style="color: var(--text-muted)">Status</th>
						<th class="px-4 py-3 text-left font-medium" style="color: var(--text-muted)">Starts</th>
						<th class="px-4 py-3 text-left font-medium" style="color: var(--text-muted)">Ends</th>
						<th class="px-4 py-3 text-right font-medium" style="color: var(--text-muted)">Stock</th>
					</tr>
				</thead>
				<tbody>
					{#each sales as sale}
						<tr class="border-b last:border-0" style="border-color: var(--border); background: var(--bg-card)">
							<td class="px-4 py-3 font-medium">
								<a href="/admin/sales/{sale.id}" class="hover:text-blue-600">{sale.name}</a>
							</td>
							<td class="px-4 py-3"><StatusBadge status={sale.status} /></td>
							<td class="px-4 py-3" style="color: var(--text-muted)">{fmt(sale.startsAt)}</td>
							<td class="px-4 py-3" style="color: var(--text-muted)">{fmt(sale.endsAt)}</td>
							<td class="px-4 py-3 text-right">
								{#if sale.status === 'active'}
									<span class="font-semibold text-green-600">{liveStock(sale.products)}</span>
									<span style="color: var(--text-muted)"> / {totalStock(sale.products)}</span>
								{:else}
									<span style="color: var(--text-muted)">{totalStock(sale.products)}</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</main>
