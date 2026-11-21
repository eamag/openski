<script lang="ts">
	import { formatPercent, t } from '#lib/i18n/index.ts';
	import { COMPASS } from '#lib/resort/stats.ts';

	let { rose }: { rose: number[] } = $props();

	const ROSE_RADIUS = 52;
	const COMPASS_SECTOR_COUNT = 8;
	const DEGREES_PER_SECTOR = 360 / COMPASS_SECTOR_COUNT;
	const HALF_SECTOR_DEGREES = DEGREES_PER_SECTOR / 2;
	const SVG_CENTER_PX = 60;
	const INNER_DASHED_RING_RADIUS = ROSE_RADIUS / 2;

	const totalPisteLength = $derived(rose.reduce((accumulator, length) => accumulator + length, 0));
	const maxDirectionPisteLength = $derived(Math.max(1, ...rose));
	const dominantDirectionIndex = $derived(rose.indexOf(Math.max(...rose)));

	function compassWedgePath(sectorIndex: number, radius: number): string {
		const degToRad = (deg: number) => ((deg - 90) * Math.PI) / 180;
		const startAngle = sectorIndex * DEGREES_PER_SECTOR - HALF_SECTOR_DEGREES;
		const endAngle = sectorIndex * DEGREES_PER_SECTOR + HALF_SECTOR_DEGREES;
		const pointOnCircle = (deg: number) =>
			`${(SVG_CENTER_PX + radius * Math.cos(degToRad(deg))).toFixed(1)} ${(SVG_CENTER_PX + radius * Math.sin(degToRad(deg))).toFixed(1)}`;
		return `M${SVG_CENTER_PX} ${SVG_CENTER_PX} L${pointOnCircle(startAngle)} A${radius} ${radius} 0 0 1 ${pointOnCircle(endAngle)} Z`;
	}
</script>

{#if totalPisteLength > 0}
	<div class="flex items-center gap-4">
		<svg
			viewBox="0 0 120 120"
			class="size-32 shrink-0"
			role="img"
			aria-label={t.place.aspect.summary(
				t.place.compass[COMPASS[dominantDirectionIndex]],
				formatPercent(rose[dominantDirectionIndex] / totalPisteLength)
			)}
		>
			<circle cx={SVG_CENTER_PX} cy={SVG_CENTER_PX} r={ROSE_RADIUS} fill="var(--surface-2)" />
			<circle
				cx={SVG_CENTER_PX}
				cy={SVG_CENTER_PX}
				r={INNER_DASHED_RING_RADIUS}
				fill="none"
				stroke="var(--line)"
				stroke-dasharray="2 3"
			/>
			{#each rose as pisteLength, sectorIndex (sectorIndex)}
				<path
					d={compassWedgePath(
						sectorIndex,
						Math.max(2, Math.sqrt(pisteLength / maxDirectionPisteLength) * ROSE_RADIUS)
					)}
					fill="var(--accent)"
					opacity={sectorIndex === dominantDirectionIndex ? 0.95 : 0.55}
					stroke="var(--surface)"
					stroke-width="1"
				/>
			{/each}
			{#each [t.place.cardinal.north, t.place.cardinal.east, t.place.cardinal.south, t.place.cardinal.west] as cardinalDirection, index (cardinalDirection)}
				<text
					x={SVG_CENTER_PX + 58 * Math.sin((index * Math.PI) / 2)}
					y={SVG_CENTER_PX - 58 * Math.cos((index * Math.PI) / 2)}
					class="fill-ink-soft text-[9px] font-semibold"
					text-anchor="middle"
					dominant-baseline="central"
				>
					{cardinalDirection}
				</text>
			{/each}
		</svg>
		<p class="min-w-0 text-sm leading-snug">
			{t.place.aspect.mostFaces}
			<b class="font-semibold">{t.place.compass[COMPASS[dominantDirectionIndex]]}</b>
			<span class="tabular text-ink-soft">
				{t.place.aspect.ofItsLength(formatPercent(rose[dominantDirectionIndex] / totalPisteLength))}
			</span>.
			<span class="mt-1 block text-xs text-ink-soft">
				{t.place.aspect.hint}
			</span>
		</p>
	</div>
{/if}
