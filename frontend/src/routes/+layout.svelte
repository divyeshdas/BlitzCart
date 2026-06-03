<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { auth } from '$stores/auth';

	let { children } = $props();

	onMount(() => auth.init());
</script>

{@render children()}
