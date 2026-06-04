<svelte:head>
	<title>How It Works — BlitzCart</title>
</svelte:head>

<!-- Hero -->
<div class="py-16 text-white text-center" style="background: linear-gradient(135deg, #1d4ed8, #7c3aed)">
	<p class="mb-2 text-sm font-semibold uppercase tracking-widest opacity-70">The mechanics</p>
	<h1 class="text-4xl font-black tracking-tight md:text-5xl">How BlitzCart Works</h1>
	<p class="mt-3 text-lg opacity-80 max-w-xl mx-auto px-4">
		100 items. 10,000 buyers. One atomic Redis operation standing between fair and chaos.
	</p>
</div>

<main class="mx-auto max-w-4xl px-4 py-14">

	<!-- The problem -->
	<section class="mb-16">
		<h2 class="mb-2 text-xs font-bold uppercase tracking-widest" style="color: var(--text-muted)">The Problem</h2>
		<h3 class="mb-5 text-2xl font-bold">Why flash sales oversell</h3>
		<div class="grid gap-4 md:grid-cols-2">
			<div class="rounded-2xl border p-6" style="background: var(--bg-card); border-color: var(--border)">
				<div class="mb-3 text-2xl">😱</div>
				<h4 class="mb-2 font-bold text-red-500">The naive approach (broken)</h4>
				<div class="rounded-lg p-3 font-mono text-xs" style="background: var(--bg)">
					<p class="text-red-400">-- Two users hit buy at the same ms</p>
					<p class="mt-1">SELECT stock WHERE id = $1  <span class="text-green-400">-- both read: 1</span></p>
					<p>IF stock &gt; 0 THEN            <span class="text-green-400">-- both pass</span></p>
					<p>  UPDATE SET stock = stock - 1 <span class="text-red-400">-- stock = -1 💀</span></p>
				</div>
				<p class="mt-3 text-sm" style="color: var(--text-muted)">
					Both requests read stock = 1, both pass the check, both write — you've sold something you don't have.
				</p>
			</div>
			<div class="rounded-2xl border p-6" style="background: var(--bg-card); border-color: var(--border)">
				<div class="mb-3 text-2xl">✅</div>
				<h4 class="mb-2 font-bold text-green-600">BlitzCart (atomic Lua)</h4>
				<div class="rounded-lg p-3 font-mono text-xs" style="background: var(--bg)">
					<p class="text-blue-400">-- Single Redis Lua script, atomic</p>
					<p class="mt-1">local stock = redis.call(<span class="text-yellow-400">'GET'</span>, key)</p>
					<p>if stock &lt; 1 then return <span class="text-red-400">-1</span> end  <span class="text-green-400">-- sold out</span></p>
					<p>return redis.call(<span class="text-yellow-400">'DECRBY'</span>, key, 1)</p>
					<p class="text-green-400">-- nothing can interleave. ever.</p>
				</div>
				<p class="mt-3 text-sm" style="color: var(--text-muted)">
					Redis executes the entire script atomically. No two requests can interleave. Oversell rate: exactly 0.
				</p>
			</div>
		</div>
	</section>

	<!-- Step by step -->
	<section class="mb-16">
		<h2 class="mb-2 text-xs font-bold uppercase tracking-widest" style="color: var(--text-muted)">The Flow</h2>
		<h3 class="mb-8 text-2xl font-bold">What happens when you click Buy</h3>
		<div class="space-y-4">
			{#each [
				{ step: '01', icon: '🔐', title: 'Auth check', time: '~0.1ms', desc: 'Your JWT is verified. No token, no buy.', color: '#3b82f6' },
				{ step: '02', icon: '🪣', title: 'Rate limit', time: '~0.5ms', desc: 'Token bucket in Redis: max 5 buy attempts per 10 seconds. Prevents bots from hammering.', color: '#8b5cf6' },
				{ step: '03', icon: '⚡', title: 'Atomic decrement', time: '~0.5ms', desc: 'The Lua script runs on Redis — GET + DECRBY as one atomic unit. If stock is 0, you get a 410 Sold Out. If stock ≥ 1, it becomes yours.', color: '#ec4899' },
				{ step: '04', icon: '📝', title: 'Order created', time: '~5ms', desc: 'A pending order row is inserted in Postgres and pushed to the BullMQ job queue — but you already have your 202 Accepted.', color: '#f97316' },
				{ step: '05', icon: '📡', title: 'Live broadcast', time: '<100ms', desc: 'Redis Pub/Sub fires. Every browser watching this sale sees the stock counter drop in real time via WebSocket.', color: '#10b981' },
				{ step: '06', icon: '✅', title: 'Confirmed', time: '<2s', desc: '10 concurrent BullMQ workers process the queue and mark orders confirmed in Postgres. Your order is permanent.', color: '#3b82f6' },
			] as item, i}
				<div
					class="flex gap-4 rounded-2xl border p-5 animate-fade-up"
					style="background: var(--bg-card); border-color: var(--border); animation-delay: {i * 60}ms"
				>
					<div
						class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
						style="background: {item.color}20; color: {item.color}"
					>
						{item.icon}
					</div>
					<div class="flex-1">
						<div class="flex items-center gap-3">
							<span class="text-xs font-black uppercase tracking-widest" style="color: {item.color}">{item.step}</span>
							<span class="font-bold">{item.title}</span>
							<span class="ml-auto rounded-full px-2 py-0.5 text-xs font-semibold" style="background: {item.color}15; color: {item.color}">{item.time}</span>
						</div>
						<p class="mt-1 text-sm" style="color: var(--text-muted)">{item.desc}</p>
					</div>
				</div>
			{/each}
		</div>
	</section>

	<!-- Stats -->
	<section class="mb-16">
		<h2 class="mb-2 text-xs font-bold uppercase tracking-widest" style="color: var(--text-muted)">Performance</h2>
		<h3 class="mb-6 text-2xl font-bold">Built for scale</h3>
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			{#each [
				{ value: '10,000', label: 'Concurrent users', sub: 'simultaneous buy requests' },
				{ value: '0', label: 'Oversells', sub: 'enforced by Lua atomicity' },
				{ value: '<50ms', label: 'p95 latency', sub: 'Redis hot path' },
				{ value: '<100ms', label: 'WS broadcast', sub: 'buy → all clients' },
			] as stat, i}
				<div
					class="rounded-2xl border p-5 text-center animate-fade-up"
					style="background: var(--bg-card); border-color: var(--border); animation-delay: {i * 60}ms"
				>
					<p class="text-3xl font-black gradient-text">{stat.value}</p>
					<p class="mt-1 font-semibold">{stat.label}</p>
					<p class="mt-0.5 text-xs" style="color: var(--text-muted)">{stat.sub}</p>
				</div>
			{/each}
		</div>
	</section>

	<!-- CTA -->
	<div class="rounded-2xl p-10 text-center text-white" style="background: linear-gradient(135deg, #1d4ed8, #7c3aed)">
		<p class="text-2xl font-black">Ready to drop?</p>
		<p class="mt-2 opacity-80">Sales go live instantly. Stock drops in real time.</p>
		<a
			href="/sales"
			class="mt-5 inline-block rounded-xl bg-white px-8 py-3 text-sm font-bold transition hover:opacity-90"
			style="color: #1d4ed8"
		>
			Browse Active Sales →
		</a>
	</div>

</main>
