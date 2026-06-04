<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { auth } from '$stores/auth';
	import { page } from '$app/state';

	function signOut() {
		auth.logout();
		goto('/sales');
	}

	let dark = $state(false);
	let menuOpen = $state(false);

	onMount(() => {
		dark = document.documentElement.classList.contains('dark');
	});

	function toggleDark() {
		dark = !dark;
		if (dark) {
			document.documentElement.classList.add('dark');
			localStorage.setItem('theme', 'dark');
		} else {
			document.documentElement.classList.remove('dark');
			localStorage.setItem('theme', 'light');
		}
	}

	const currentPath = $derived(page.url.pathname);
</script>

<nav
	class="sticky top-0 z-50 border-b"
	style="background: color-mix(in srgb, var(--bg-card) 80%, transparent); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-color: var(--border)"
>
	<div class="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
		<!-- Logo -->
		<a href="/sales" class="shrink-0 text-lg font-black tracking-tight gradient-text">
			⚡ BlitzCart
		</a>

		<!-- Desktop nav links -->
		<div class="hidden flex-1 items-center gap-1 md:flex">
			{#each [
				{ href: '/sales', label: '🛒 Sales' },
				{ href: '/sales?filter=limited', label: '🔥 Limited Offers' },
				{ href: '/how-it-works', label: '💡 How It Works' },
			] as link}
				<a
					href={link.href}
					class="rounded-lg px-3 py-1.5 text-sm font-medium transition
						{currentPath === link.href.split('?')[0] && !currentPath.startsWith('/admin') ? 'opacity-100' : 'opacity-60 hover:opacity-80'}"
					style="color: var(--text-primary)"
				>
					{link.label}
				</a>
			{/each}
			{#if $auth}
				<a
					href="/orders"
					class="rounded-lg px-3 py-1.5 text-sm font-medium transition
						{currentPath === '/orders' ? 'opacity-100' : 'opacity-60 hover:opacity-80'}"
					style="color: var(--text-primary)"
				>
					📦 My Orders
				</a>
			{/if}
			{#if $auth?.role === 'admin'}
				<a
					href="/admin/sales"
					class="rounded-lg px-3 py-1.5 text-sm font-medium transition
						{currentPath.startsWith('/admin') ? 'opacity-100' : 'opacity-60 hover:opacity-80'}"
					style="color: var(--text-primary)"
				>
					⚙️ Admin
				</a>
			{/if}
		</div>

		<!-- Right side -->
		<div class="ml-auto flex items-center gap-2">
			<!-- Dark mode toggle -->
			<button
				onclick={toggleDark}
				class="flex h-8 w-8 items-center justify-center rounded-lg transition hover:opacity-75"
				style="background: var(--bg); color: var(--text-primary)"
				aria-label="Toggle dark mode"
			>
				{#if dark}
					<!-- Sun -->
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="12" cy="12" r="5"/>
						<line x1="12" y1="1" x2="12" y2="3"/>
						<line x1="12" y1="21" x2="12" y2="23"/>
						<line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
						<line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
						<line x1="1" y1="12" x2="3" y2="12"/>
						<line x1="21" y1="12" x2="23" y2="12"/>
						<line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
						<line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
					</svg>
				{:else}
					<!-- Moon -->
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
					</svg>
				{/if}
			</button>

			{#if $auth}
				<span class="hidden text-xs md:block" style="color: var(--text-muted)">{$auth.email}</span>
				<button
					onclick={signOut}
					class="hidden rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:opacity-75 md:block"
					style="border-color: var(--border); color: var(--text-primary)"
				>
					Sign out
				</button>
			{:else}
				<a
					href="/login"
					class="hidden rounded-lg px-4 py-1.5 text-sm font-semibold text-white transition hover:opacity-90 md:block"
					style="background: linear-gradient(135deg, #3b82f6, #8b5cf6)"
				>
					Sign in
				</a>
			{/if}

			<!-- Hamburger -->
			<button
				onclick={() => (menuOpen = !menuOpen)}
				class="flex h-8 w-8 flex-col items-center justify-center gap-1.5 rounded-lg transition hover:opacity-75 md:hidden"
				style="color: var(--text-primary)"
				aria-label="Toggle menu"
			>
				<span class="block h-0.5 w-5 rounded-full transition-all duration-200" style="background: currentColor; transform: {menuOpen ? 'translateY(4px) rotate(45deg)' : 'none'}"></span>
				<span class="block h-0.5 w-5 rounded-full transition-all duration-200" style="background: currentColor; opacity: {menuOpen ? '0' : '1'}"></span>
				<span class="block h-0.5 w-5 rounded-full transition-all duration-200" style="background: currentColor; transform: {menuOpen ? 'translateY(-4px) rotate(-45deg)' : 'none'}"></span>
			</button>
		</div>
	</div>

	<!-- Mobile drawer -->
	{#if menuOpen}
		<div class="border-t px-4 pb-4 pt-2 md:hidden" style="border-color: var(--border); background: var(--bg-card)">
			<div class="flex flex-col gap-1">
				{#each [
					{ href: '/sales', label: '🛒 Sales' },
					{ href: '/sales?filter=limited', label: '🔥 Limited Offers' },
					{ href: '/how-it-works', label: '💡 How It Works' },
				] as link}
					<a
						href={link.href}
						onclick={() => (menuOpen = false)}
						class="rounded-lg px-3 py-2 text-sm font-medium transition hover:opacity-75"
						style="color: var(--text-primary)"
					>
						{link.label}
					</a>
				{/each}
				{#if $auth}
					<a
						href="/orders"
						onclick={() => (menuOpen = false)}
						class="rounded-lg px-3 py-2 text-sm font-medium transition hover:opacity-75"
						style="color: var(--text-primary)"
					>
						📦 My Orders
					</a>
				{/if}
				{#if $auth?.role === 'admin'}
					<a
						href="/admin/sales"
						onclick={() => (menuOpen = false)}
						class="rounded-lg px-3 py-2 text-sm font-medium transition hover:opacity-75"
						style="color: var(--text-primary)"
					>
						⚙️ Admin
					</a>
				{/if}

				<div class="mt-2 border-t pt-2" style="border-color: var(--border)">
					{#if $auth}
						<p class="px-3 py-1 text-xs" style="color: var(--text-muted)">{$auth.email}</p>
						<button
							onclick={() => { signOut(); menuOpen = false; }}
							class="w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition hover:opacity-75"
							style="color: var(--text-primary)"
						>
							Sign out
						</button>
					{:else}
						<a
							href="/login"
							onclick={() => (menuOpen = false)}
							class="block rounded-lg px-4 py-2 text-center text-sm font-semibold text-white"
							style="background: linear-gradient(135deg, #3b82f6, #8b5cf6)"
						>
							Sign in
						</a>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</nav>
