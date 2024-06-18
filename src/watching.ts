import z from "zod";
import { readFile, writeFile } from "fs/promises";

const WATCHING_FILENAME = "./config/watching.json" as const;

export const WatchingSchema = z.object({
  /**
   * In seconds
   */
  routineInterval: z.number().default(60 * 60),

  channels: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      downloadCount: z.number(),
    })
  ),

  downloads: z.array(
    z.object({
      /**
       * Will prevent automatic deletion
       */
      preserve: z.boolean(),
      videoId: z.string(),
      title: z.string(),
      channelId: z.string(),
      folder: z.string(),
    })
  ),
});

export type WatchingSchemaType = z.infer<typeof WatchingSchema>;

let configInstance: WatchingSchemaType | null = null;

export const getWatchingConfig = async (): Promise<
  z.infer<typeof WatchingSchema>
> => {
  if (configInstance) {
    return configInstance;
  }

  const content = await readFile(WATCHING_FILENAME, "utf-8");
  return WatchingSchema.parseAsync(JSON.parse(content));
};

export const saveWatchingConfig = async (): Promise<void> => {
  const config = await getWatchingConfig();

  // Validating config before we write it
  await WatchingSchema.parseAsync(config);

  await writeFile(WATCHING_FILENAME, JSON.stringify(config), "utf8");
};
