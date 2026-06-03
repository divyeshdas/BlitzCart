<script lang="ts">
	type Status = 'draft' | 'active' | 'ended' | 'pending' | 'confirmed' | 'failed';
	let { status }: { status: Status } = $props();

	const styles: Record<Status, string> = {
		draft:     'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400',
		active:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
		ended:     'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400',
		pending:   'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
		confirmed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
		failed:    'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400',
	};
</script>

<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold {styles[status]}">
	{status}
</span>
