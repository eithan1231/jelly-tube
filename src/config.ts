import z from "zod";
import { readFile, writeFile } from "fs/promises";

const CONFIG_FILENAME = "./config/watching.json" as const;

const ConfigChannelItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  downloadCount: z.number(),
  maximumDuration: z.number(),
  metadata: z.object({
    thumbnail: z.string().optional(),
  }),
});

export type ConfigChannelItemSchemaType = z.infer<
  typeof ConfigChannelItemSchema
>;

const ConfigDownloadItemSchema = z.object({
  uuid: z.string(),

  status: z.enum(["queued", "downloading", "failed", "downloaded", "removed"]),
  log: z.string(),

  automationEnabled: z.boolean(),

  videoId: z.string(),
  channelId: z.string(),
  title: z.string(),

  folder: z.string(),

  date: z.number(),

  metadata: z.object({
    thumbnail: z.string().optional(),
    description: z.string().optional(),
    duration: z.number().optional(),
  }),
});

export type ConfigDownloadItemSchemaType = z.infer<
  typeof ConfigDownloadItemSchema
>;

export const ConfigSchema = z.object({
  ffmpegTimeout: z.number().default(60 * 30),

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

export const saveConfig = async (): Promise<void> => {
  const config = await getConfig();

  // Validating config before we write it
  await ConfigSchema.parseAsync(config);

  await writeFile(CONFIG_FILENAME, JSON.stringify(config, null, 2), "utf-8");
};

export const getFfmpegTimeout = async () => {
  const config = await getConfig();

  return config.ffmpegTimeout;
};

export const setFfmpegTimeout = async (duration: number) => {
  const config = await getConfig();

  config.ffmpegTimeout = duration;

  await saveConfig();
};

export const addConfigDownload = async (item: ConfigDownloadItemSchemaType) => {
  const config = await getConfig();

  const download = await ConfigDownloadItemSchema.parseAsync(item);

  config.downloads.push(download);

  await saveConfig();
};

export const removeConfigDownloads = async (
  filter: Partial<ConfigDownloadItemSchemaType>
) => {
  const config = await getConfig();

  config.downloads = config.downloads.filter((download) => {
    const filterKeys = Object.keys(filter) as Array<
      keyof ConfigDownloadItemSchemaType
    >;

    for (const filterKey of filterKeys) {
      if (filter[filterKey] !== download[filterKey]) {
        return true;
      }
    }

    return false;
  });
};

export const updateConfigDownloads = async (
  filter: Partial<ConfigDownloadItemSchemaType>,
  update: Partial<ConfigDownloadItemSchemaType>
) => {
  const downloads = await getConfigDownloads(filter);

  for (const download of downloads) {
    const updateKeys = Object.keys(update) as Array<
      keyof ConfigDownloadItemSchemaType
    >;

    for (const updateKey of updateKeys) {
      (download as any)[updateKey] = update[updateKey];
    }
  }

  await saveConfig();
};

export const getConfigDownloads = async (
  filter: Partial<ConfigDownloadItemSchemaType> = {}
) => {
  const config = await getConfig();

  return config.downloads.filter((download) => {
    let match = true;
    const filterKeys = Object.keys(filter) as Array<
      keyof ConfigDownloadItemSchemaType
    >;

    for (const filterKey of filterKeys) {
      if (filter[filterKey] !== download[filterKey]) {
        match = false;

        break;
      }
    }

    return match;
  });
};

export const getConfigDownload = async (
  filter: Partial<ConfigDownloadItemSchemaType>
) => {
  const downloads = await getConfigDownloads(filter);

  if (downloads.length >= 1) {
    return downloads[0];
  }

  return null;
};

export const addConfigChannel = async (item: ConfigChannelItemSchemaType) => {
  const config = await getConfig();

  const channel = await ConfigChannelItemSchema.parseAsync(item);

  config.channels.push(channel);

  await saveConfig();
};

export const removeConfigChannels = async (
  filter: Partial<ConfigChannelItemSchemaType>
) => {
  const config = await getConfig();

  config.channels = config.channels.filter((channel) => {
    const filterKeys = Object.keys(filter) as Array<
      keyof ConfigChannelItemSchemaType
    >;

    for (const filterKey of filterKeys) {
      if (filter[filterKey] !== channel[filterKey]) {
        return true;
      }
    }

    return false;
  });

  await saveConfig();
};

export const updateConfigChannels = async (
  filter: Partial<ConfigChannelItemSchemaType>,
  update: Partial<ConfigChannelItemSchemaType>
) => {
  const channels = await getConfigChannels(filter);

  for (const channel of channels) {
    const updateKeys = Object.keys(update) as Array<
      keyof ConfigChannelItemSchemaType
    >;

    for (const updateKey of updateKeys) {
      (channel as any)[updateKey] = update[updateKey];
    }
  }

  await saveConfig();
};

export const getConfigChannels = async (
  filter: Partial<ConfigChannelItemSchemaType> = {}
) => {
  const config = await getConfig();

  return config.channels.filter((download) => {
    let match = true;
    const filterKeys = Object.keys(filter) as Array<
      keyof ConfigChannelItemSchemaType
    >;

    for (const filterKey of filterKeys) {
      if (filter[filterKey] !== download[filterKey]) {
        match = false;

        break;
      }
    }

    return match;
  });
};

export const getConfigChannel = async (
  filter: Partial<ConfigChannelItemSchemaType> = {}
) => {
  const channels = await getConfigChannels(filter);

  if (channels.length >= 1) {
    return channels[0];
  }

  return null;
};
