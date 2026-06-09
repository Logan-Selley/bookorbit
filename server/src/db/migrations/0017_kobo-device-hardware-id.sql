ALTER TABLE "kobo_devices" ADD COLUMN "kobo_hardware_id" varchar(64);--> statement-breakpoint
CREATE UNIQUE INDEX "kobo_devices_kobo_hardware_id_uidx" ON "kobo_devices" USING btree ("kobo_hardware_id") WHERE "kobo_devices"."kobo_hardware_id" is not null;
