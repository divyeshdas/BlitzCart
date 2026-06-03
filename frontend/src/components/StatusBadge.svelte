<script lang="ts">
	let { status }: { status: 'draft' | 'active' | 'ended' } = $props();

	const styles = {
		draft: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400',
		active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
		ended: 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400',
	};
</script>

<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold {styles[status]}">
	{status}
</span>
