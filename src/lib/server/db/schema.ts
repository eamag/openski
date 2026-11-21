import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { CameraSource } from '#lib/queues/types.ts';
import type { ResolvedWebcam } from '#lib/webcams/types.ts';
import { user } from './auth.schema';

const primaryKeyUuid = () =>
	text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID());
const createdAtTimestamp = () =>
	integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.$defaultFn(() => new Date());

export type QueueRegionBox = [x0: number, y0: number, x1: number, y1: number];
const QUEUE_REGION_STATUS_VALUES = ['suggested', 'confirmed', 'rejected'] as const;

export const webcam = sqliteTable(
	'webcam',
	{
		id: primaryKeyUuid(),
		resort: text('resort').notNull(),
		pageUrl: text('page_url').notNull().unique(),
		provider: text('provider').notNull(),
		cameraId: text('camera_id').notNull(),
		name: text('name').notNull(),
		lat: real('lat').notNull(),
		lon: real('lon').notNull(),
		elevation: integer('elevation'),
		direction: integer('direction'),
		fov: integer('fov'),
		resolved: text('resolved', { mode: 'json' }).$type<ResolvedWebcam>().notNull(),
		source: text('source', { mode: 'json' }).$type<CameraSource>().notNull(),
		osmNode: integer('osm_node'),
		createdBy: text('created_by')
			.notNull()
			.references(() => user.id),
		createdAt: createdAtTimestamp(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.$defaultFn(() => new Date())
			.$onUpdate(() => new Date())
	},
	(t) => [index('webcam_resort_idx').on(t.resort)]
);

export const queueRegion = sqliteTable(
	'queue_region',
	{
		id: primaryKeyUuid(),
		webcamId: text('webcam_id')
			.notNull()
			.references(() => webcam.id, { onDelete: 'cascade' }),
		liftOsm: text('lift_osm'),
		liftName: text('lift_name'),
		label: text('label').notNull(),
		box: text('box', { mode: 'json' }).$type<QueueRegionBox>().notNull(),
		upscale: integer('upscale').notNull().default(1),
		status: text('status', { enum: QUEUE_REGION_STATUS_VALUES }).notNull().default('confirmed'),
		createdBy: text('created_by').references(() => user.id),
		createdAt: createdAtTimestamp()
	},
	(t) => [index('queue_region_webcam_idx').on(t.webcamId)]
);

export const snapshot = sqliteTable(
	'snapshot',
	{
		id: text('id').primaryKey(),
		resort: text('resort').notNull(),
		markdown: text('markdown').notNull(),
		createdAt: createdAtTimestamp()
	},
	(t) => [index('snapshot_created_idx').on(t.createdAt)]
);

export * from './auth.schema';
