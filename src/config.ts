import z from "zod";
import { readFile, writeFile } from "fs/promises";

const CONFIG_FILENAME = "./config/watching.json" as const;

const ConfigChannelItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  downloadCount: z.number(),
  maximumDuration: z.number(),
});

export type ConfigChannelItemSchemaType = z.infer<
  typeof ConfigChannelItemSchema
>;

const ConfigDownloadItemSchema = z.object({
  status: z.enum(["downloading", "downloaded", "removed"]),
  log: z.string(),

  automationEnabled: z.boolean(),

  videoId: z.string(),
  channelId: z.string(),
  title: z.string(),

  folder: z.string(),

  date: z.number(),
});

export type ConfigDownloadItemSchemaType = z.infer<
  typeof ConfigDownloadItemSchema
>;

export const ConfigSchema = z.object({
  /**
   * In seconds
   */
  routineInterval: z.number().default(60 * 60),

  channels: z.array(ConfigChannelItemSchema),

  downloads: z.array(ConfigDownloadItemSchema),
});

export type ConfigSchemaType = z.infer<typeof ConfigSchema>;

let configInstance: ConfigSchemaType | null = null;

export const getConfig = async (): Promise<z.infer<typeof ConfigSchema>> => {
  if (configInstance) {
    return configInstance;
  }

  const content = await readFile(CONFIG_FILENAME, "utf-8");

  configInstance = await ConfigSchema.parseAsync(JSON.parse(content));

  return configInstance;
};

export const saveWatchingConfig = async (): Promise<void> => {
  const config = await getConfig();

  // Validating config before we write it
  await ConfigSchema.parseAsync(config);

  await writeFile(CONFIG_FILENAME, JSON.stringify(config, null, 2), "utf-8");
};

export const addDownload = async (item: ConfigDownloadItemSchemaType) => {
  const config = await getConfig();

  config.downloads.push(item);

  await saveWatchingConfig();
};

export const removeDownload = async (
  filter: Partial<ConfigDownloadItemSchemaType>
) => {
  const config = await getConfig();

  for (const downloadIndex in config.downloads) {
    let match = true;

    const download = config.downloads[downloadIndex];

    const filterKeys = Object.keys(filter) as Array<
      keyof ConfigDownloadItemSchemaType
    >;

    for (const filterKey of filterKeys) {
      if (filter[filterKey] !== download[filterKey]) {
        match = false;

        break;
      }
    }

    if (match) {
      // Indexes will change, fixme. Will only work with SIGNULAR at the moment.
      config.downloads.splice(downloadIndex, 1);
    }
  }
};

export const updateDownload = async () => {
  //
};

export const getDownload = async () => {
  //
};

export const getDownloads = async (
  filter: Partial<ConfigDownloadItemSchemaType>
) => {
  //
};

export const addChannel = async () => {
  //
};

export const removeChannel = async () => {
  //
};

export const updateChannel = async () => {
  //
};

export const getChannel = async () => {
  //
};

export const getChannels = async (
  filter: Partial<ConfigChannelItemSchemaType>
) => {
  //
};
