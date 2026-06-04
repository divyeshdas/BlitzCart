<script lang="ts">
	import { onMount } from 'svelte';
	import { api } from '$lib/api';

	type TickerItem = { text: string; accent?: boolean };

	let items = $state<TickerItem[]>([
		{ text: '⚡ FLASH SALES LIVE NOW', accent: true },
		{ text: 'Real-time inventory — zero oversells' },
		{ text: '🔥 Limited stock drops every day' },
		{ text: '⏱ Countdown timers on every deal' },
		{ text: '🛒 One click. Atomic buy. No duplicates.' },
	]);

	onMount(async () => {
		try {
			const res = await api<{ sales: { name: string; products: { name: string; salePrice: string; quantity: number; inventoryRemaining: number | null }[] }[] }>('/sales');
			const live: TickerItem[] = [];
			for (const sale of res.sales) {
				live.push({ text: `⚡ LIVE: ${sale.name}`, accent: true });
				for (const p of sale.products) {
					const rem = p.inventoryRemaining ?? p.quantity;
					if (rem > 0) {
						live.push({ text: `${p.name} — $${p.salePrice} · ${rem} left` });
					} else {
						live.push({ text: `${p.name} — SOLD OUT 🔴` });
					}
				}
			}
			if (live.length > 0) items = [...live, ...live]; // duplicate for seamless loop
		} catch {
			// keep defaults
		}
	});
</script>

<div
	class="overflow-hidden border-b py-2 text-xs font-semibold uppercase tracking-wider text-white"
	style="background: linear-gradient(90deg, #1d4ed8, #7c3aed, #ec4899, #7c3aed, #1d4ed8); background-size: 300% 100%"
	aria-hidden="true"
>
	<div class="ticker-track flex w-max gap-0">
		{#each [...items, ...items] as item}
			<span
				class="inline-flex items-center px-6 {item.accent ? 'text-yellow-300' : 'text-white/90'}"
			>
				{item.text}
				<span class="mx-4 opacity-40">·</span>
			</span>
		{/each}
	</div>
</div>

<style>
	.ticker-track {
		animation: ticker 35s linear infinite;
	}
	.ticker-track:hover {
		animation-play-state: paused;
	}
	@keyframes ticker {
		from { transform: translateX(0); }
		to   { transform: translateX(-50%); }
	}
</style>
