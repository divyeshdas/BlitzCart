<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	onMount(() => {
		const signedIn = localStorage.getItem('auth_user');
		goto(signedIn ? '/sales' : '/login');
	});
</script>
