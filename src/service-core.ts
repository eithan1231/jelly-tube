import {
  downloadAudio,
  downloadVideo,
  getChannelInfo,
  getChannelVideos,
  getVideoBasicInfo,
} from "./youtube";
import {
  ConfigDownloadItemSchemaType,
  addConfigDownload,
  getConfigChannel,
  getConfigChannels,
  getConfigDownload,
  getConfigDownloads,
  updateConfigChannels,
  updateConfigDownloads,
} from "./config";
import { copyFile, mkdir, rm, writeFile } from "fs/promises";
import path from "path";
import { cleanFilename, unixTimestamp } from "./util";
import { processFfmpeg } from "./ffmpeg";
import { createNfoMovie } from "./nfo";
import { randomUUID } from "crypto";

export type ServiceCoreGenericResult = {
  errors: Array<{
    message: string;
  }>;
};

export const handleDownload = async (uuid: string) => {
  console.log(`[handleDownload] ${uuid}`);

  const download = await getConfigDownload({ uuid });

  if (!download) {
    console.log(`[handleDownload] ${uuid} cannot find uuid`);

    return;
  }

  console.log(
    `[handleDownload] ${uuid}, meta ${download.videoId} Title: "${download.title}"`
  );

  await updateConfigDownloads(
    { uuid },
    {
      log: "Downloading Video and Audio",
      status: "downloading",
    }
  );

  try {
    const [channel, resultVideo, resultAudio] = await Promise.all([
      await getConfigChannel({ id: download.channelId }),
      await downloadVideo(download.videoId),
      await downloadAudio(download.videoId),
    ]);

    if (
      channel &&
      download.metadata.duration &&
      download.metadata.duration / 60 > channel.maximumDuration
    ) {
      console.log(
        `[handleDownload] ${download.videoId} Unable to download, exceeds maximum duration`
      );

      await updateConfigDownloads(
        { uuid },
        {
          status: "failed",
          log: "Exceeds maximum video duration",
        }
      );

      return;
    }

    console.log(
      `[handleDownload] ${download.videoId} Downloaded audio and video`
    );

    await updateConfigDownloads(
      { uuid },
      {
        channelId: resultAudio.video.basic_info.channel_id ?? "N/A",
        log: "Processing Video and Audio",
      }
    );

    const filename = cleanFilename(download.title);
    const filenameNfo = `movie.nfo`;

    const processingFolder = path.join("./downloads/processing", filename);
    const destinationFolder = path.join("./downloads/completed", filename);

    await mkdir(processingFolder, { recursive: true });

    const processingVideoOutputFile = path.join(
      processingFolder,
      `${filename}.mp4`
    );
    const processingVideoOriginalFile = path.join(
      processingFolder,
      `${filename}.original.mp4`
    );
    const processingAudioOriginalFile = path.join(
      processingFolder,
      `${filename}.original.webm`
    );
    const processingVideoNfo = path.join(processingFolder, filenameNfo);

    await Promise.all([
      copyFile(resultVideo.filename, processingVideoOriginalFile),
      copyFile(resultAudio.filename, processingAudioOriginalFile),
    ]);
    await Promise.all([rm(resultVideo.filename), rm(resultAudio.filename)]);

    await writeFile(
      processingVideoNfo,
      createNfoMovie({
        uniqueId: {
          type: "youtube",
          value: download.videoId,
        },
        title: download.title,
        plot: download.metadata.description,
        studio: resultAudio.video.basic_info.channel?.name,
        thumbs: [download.metadata.thumbnail ?? ""],
      })
    );

    console.log(
      `[handleDownload] ${download.videoId} Copied source and NFO files to processing directory`
    );

    try {
      await processFfmpeg(
        download.videoId,
        path.join(process.cwd(), processingVideoOriginalFile),
        path.join(process.cwd(), processingAudioOriginalFile),
        path.join(process.cwd(), processingVideoOutputFile)
      );
    } catch (err) {
      await rm(processingFolder, { recursive: true });
      await rm(destinationFolder, { recursive: true });

      throw err;
    }

    await updateConfigDownloads(
      { uuid },
      { log: "Copying to destination directory" }
    );

    console.log(`[handleDownload] ${download.videoId} ffmpeg processed`);

    const destinationVideoFile = path.join(
      destinationFolder,
      `${filename}.mp4`
    );
    const destinationVideoNfo = path.join(destinationFolder, filenameNfo);

    await mkdir(destinationFolder, { recursive: true });

    await Promise.all([
      copyFile(processingVideoOutputFile, destinationVideoFile),
      copyFile(processingVideoNfo, destinationVideoNfo),
    ]);

    await Promise.all([rm(processingVideoOutputFile), rm(processingVideoNfo)]);

    console.log(
      `[handleDownload] ${download.videoId} Copied to destination/completed folder`
    );

    await rm(processingFolder, { recursive: true });

    console.log(
      `[handleDownload] ${download.videoId} Removed processing folder.`
    );

    await updateConfigDownloads(
      { uuid },
      {
        log: "Complete",
        status: "downloaded",
        folder: destinationFolder,
      }
    );

    console.log(
      `[handleDownload] ${download.videoId} Updated watching record to include downloaded movie.`
    );
  } catch (err) {
    let message = "Download Failed";

    if (err instanceof Error) {
      if (err.name === "InnertubeError") {
        message = `Innertube Error, ${err.message.substring(0, 64)}`;
      }
    }

    await updateConfigDownloads(
      { uuid },
      {
        log: message,
        status: "failed",
      }
    );

    console.error(err);
  }
};

export const handleRemoval = async (
  uuid: string
): Promise<ServiceCoreGenericResult> => {
  console.warn(`[handleRemoval] Removing ${uuid}...`);

  const result: ServiceCoreGenericResult = { errors: [] };

  const downloads = await getConfigDownloads({
    uuid,
  });

  for (const download of downloads) {
    if (download.status === "downloading") {
      result.errors.push({
        message: "Cannot remove video that is mid-download",
      });

      console.warn(
        `[handleRemoval] Cannot remove downloading video ${download.videoId} ${download.title}`
      );

      continue;
    }

    if (download.status === "downloaded") {
      await rm(download.folder, { recursive: true });
    }

    await updateConfigDownloads(
      { uuid: download.uuid },
      {
        status: "removed",
        log: "Removed",
        folder: "",
      }
    );

    console.warn(
      `[handleRemoval] Removed ${download.videoId} ${download.title}`
    );
  }

  return result;
};

export const routineChannelsCrawl = async () => {
  console.log(`[routineChannelsCrawl] Initiated`);

  const channels = await getConfigChannels();
  for (const channel of channels) {
    console.log(
      `[routineChannelsCrawl] Processing channel ${channel.name} (${channel.id}), with a non-preserved download limit of ${channel.downloadCount}`
    );

    if (channel.downloadCount <= 0 || channel.maximumDuration <= 0) {
      console.log(
        `[routineChannelsCrawl] Skipping channel ${channel.name} (${channel.id}), downloadCount or maximumDuration is 0 or lower`
      );

      continue;
    }

    const channelVideos = await getChannelVideos(channel.id);

    const targetDownloadVideos = channelVideos.slice(0, channel.downloadCount);

    const channelDownloads = await getConfigDownloads({
      channelId: channel.id,
    });

    for (const download of channelDownloads) {
      if (!download.automationEnabled) {
        console.log(
          `[routineChannelsCrawl] Video already downloaded with automation disabled. Will not touch, modify or delete. ${download.videoId}`
        );

        continue;
      }

      if (
        !targetDownloadVideos.find((video) => video.id === download.videoId)
      ) {
        console.log(
          `[routineChannelsCrawl] Downloaded video flagged for removal ${download.videoId}`
        );

        await handleRemoval(download.uuid);
      }
    }

    for (const video of targetDownloadVideos) {
      const download = await getConfigDownload({
        videoId: video.id,
      });

      if (download) {
        console.log(`[routineChannelsCrawl] Already downloaded ${video.id}`);
        continue;
      }

      const downloadItem: ConfigDownloadItemSchemaType = {
        automationEnabled: true,
        videoId: video.id,
        channelId: channel.id,
        title: video.title.text ?? video.id,
        date: unixTimestamp(),
        folder: "N/A",
        log: "Queued for download",
        status: "queued",
        uuid: randomUUID(),
        metadata: {
          description: video.description,
          thumbnail: video.best_thumbnail?.url,
          duration: video.duration.seconds,
        },
      };

      if (video.is_live) {
        downloadItem.status = "failed";
        downloadItem.log = "Video is Live";
      }

      if (video.upcoming) {
        downloadItem.status = "failed";
        downloadItem.log = `Video is upcoming ${video.upcoming.toISOString()}`;
      }

      await addConfigDownload(downloadItem);
    }
  }

  console.log(`[routineChannelsCrawl] Finished`);
};

export const routineDownloadQueue = async () => {
  console.log(`[routineDownloadQueue] Started`);

  const downloadsQueued = await getConfigDownloads({
    status: "queued",
  });

  console.log(
    `[routineDownloadQueue] ${downloadsQueued.length} items in download queue`
  );

  for (const download of downloadsQueued) {
    if (download.status === "queued") {
      try {
        await handleDownload(download.uuid);
      } catch (err) {
        console.log(
          `[routineDownloadQueue] Failed to download video ${download.title} (${download.videoId})`
        );

        if (err instanceof Error) {
          console.error(err);
        }

        throw err;
      }
    }
  }

  console.log(`[routineDownloadQueue] Finished`);
};

export const routineDownloadThumbnailRefresh = async () => {
  console.log(`[routineDownloadThumbnailRefresh] Started`);

  const downloads = await getConfigDownloads();

  for (const download of downloads) {
    if (!download.metadata.thumbnail) {
      continue;
    }

    const response = await fetch(download.metadata.thumbnail);
    if (response.status !== 404) {
      continue;
    }

    console.log(
      `[routineDownloadThumbnailRefresh] Thumbnail ${download.videoId} is invalid`
    );

    const videoInfo = await getVideoBasicInfo(download.videoId);

    if (!videoInfo.thumbnail || videoInfo.thumbnail.length <= 0) {
      continue;
    }

    const thumbnail = videoInfo.thumbnail[0].url;

    console.log(
      `[routineDownloadThumbnailRefresh] Thumbnail ${
        download.videoId
      } Updating... ${download.metadata.thumbnail.substring(
        0,
        64
      )}... to ${thumbnail.substring(0, 64)}...`
    );

    await updateConfigDownloads(
      { uuid: download.uuid },
      {
        metadata: {
          ...download.metadata,
          thumbnail,
        },
      }
    );

    console.log(
      `[routineDownloadThumbnailRefresh] Thumbnail ${download.videoId} updated successfully`
    );
  }

  console.log(`[routineDownloadThumbnailRefresh] Finished`);
};

export const routineChannelThumbnailRefresh = async () => {
  console.log(`[routineChannelThumbnailRefresh] Started`);

  const channels = await getConfigChannels();

  for (const channel of channels) {
    if (!channel.metadata.thumbnail) {
      continue;
    }

    const response = await fetch(channel.metadata.thumbnail);
    if (response.status !== 404) {
      continue;
    }

    console.log(
      `[routineChannelThumbnailRefresh] Thumbnail ${channel.id} is invalid`
    );

    const channelInfo = await getChannelInfo(channel.id);

    if (
      !channelInfo.metadata.thumbnail ||
      !channelInfo.metadata.thumbnail[0].url
    ) {
      console.log(
        `[routineChannelThumbnailRefresh] Thumbnail ${channel.id} failed to find best thumb`
      );

      continue;
    }

    const thumbnail = channelInfo.metadata.thumbnail[0].url;

    console.log(
      `[routineChannelThumbnailRefresh] Thumbnail ${
        channel.id
      } Updating... ${channel.metadata.thumbnail.substring(
        0,
        64
      )}... to ${thumbnail.substring(0, 64)}...`
    );

    await updateConfigChannels(
      { id: channel.id },
      {
        metadata: {
          ...channel.metadata,
          thumbnail,
        },
      }
    );

    console.log(
      `[routineChannelThumbnailRefresh] Thumbnail ${channel.id} updated successfully`
    );
  }

  console.log(`[routineChannelThumbnailRefresh] Finished`);
};
