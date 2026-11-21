import type { Catalog, CatalogResort } from '#lib/resort/catalog.ts';

const catalogModules = import.meta.glob<Catalog>('/static/data/resorts.json', {
	eager: true,
	import: 'default'
});
const catalog = catalogModules['/static/data/resorts.json'];
const resortsById = new Map(catalog.resorts.map((resort) => [resort.id, resort]));

export function findResort(id: string): CatalogResort | undefined {
	return resortsById.get(id);
}

export function builtResorts(): CatalogResort[] {
	return catalog.resorts.filter((resort) => resort.built);
}
