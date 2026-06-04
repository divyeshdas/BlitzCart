<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { auth } from '$stores/auth';
	import Navbar from '$components/Navbar.svelte';
	import Ticker from '$components/Ticker.svelte';

	let { children } = $props();

	onMount(() => {
		auth.init();
		const saved = localStorage.getItem('theme');
		if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
			document.documentElement.classList.add('dark');
		}
	});
</script>

<Ticker />
<Navbar />
{@render children()}
