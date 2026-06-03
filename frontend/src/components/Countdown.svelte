<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	let { endsAt }: { endsAt: string } = $props();

	let remaining = $state(0);
	let interval: ReturnType<typeof setInterval>;

	function tick() {
		remaining = Math.max(0, Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000));
	}

	onMount(() => {
		tick();
		interval = setInterval(tick, 1000);
	});

	onDestroy(() => clearInterval(interval));

	const hours = $derived(Math.floor(remaining / 3600));
	const minutes = $derived(Math.floor((remaining % 3600) / 60));
	const seconds = $derived(remaining % 60);

	function pad(n: number) {
		return String(n).padStart(2, '0');
	}
</script>

{#if remaining > 0}
	<span class="font-mono tabular-nums">
		{pad(hours)}:{pad(minutes)}:{pad(seconds)}
	</span>
{:else}
	<span class="text-red-500 font-medium">Ended</span>
{/if}
