import { downloadAudio, downloadVideo, getChannelVideos } from "./youtube";
import {
  addDownload,
  getChannels,
  getDownload,
  getDownloads,
  updateDownloads,
} from "./config";
import { mkdir, rename, rm, writeFile } from "fs/promises";
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

  const download = await getDownload({ uuid });

  if (!download) {
    console.log(`[handleDownload] ${uuid} cannot find uuid`);

    return;
  }

  console.log(
    `[handleDownload] ${uuid}, meta ${download.videoId} Title: "${download.title}"`
  );

  await updateDownloads(
    { uuid },
    {
      log: "Downloading Video and Audio",
      status: "downloading",
    }
  );

  try {
    const [resultVideo, resultAudio] = await Promise.all([
      await downloadVideo(download.videoId),
      await downloadAudio(download.videoId),
    ]);

    if (download.metadata.duration && download.metadata.duration / 60 > 30) {
      console.log(
        `[handleDownload] ${download.videoId} Unable to download, exceeds maximum duration`
      );

      await updateDownloads(
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

    await updateDownloads(
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

    await rename(resultVideo.filename, processingVideoOriginalFile);
    await rename(resultAudio.filename, processingAudioOriginalFile);
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

    await processFfmpeg(
      download.videoId,
      path.join(process.cwd(), processingVideoOriginalFile),
      path.join(process.cwd(), processingAudioOriginalFile),
      path.join(process.cwd(), processingVideoOutputFile)
    );

    await updateDownloads(
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
    await rename(processingVideoOutputFile, destinationVideoFile);
    await rename(processingVideoNfo, destinationVideoNfo);

    console.log(
      `[handleDownload] ${download.videoId} Copied to destination/completed folder`
    );

    await rm(processingFolder, { recursive: true });

    console.log(
      `[handleDownload] ${download.videoId} Removed processing folder.`
    );

    await updateDownloads(
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
    await updateDownloads(
      { uuid },
      {
        log: "Download Failed",
        status: "failed",
      }
    );

    throw err;
  }
};

export const handleRemoval = async (
  uuid: string
): Promise<ServiceCoreGenericResult> => {
  console.warn(`[handleRemoval] Removing ${uuid}...`);

  const result: ServiceCoreGenericResult = { errors: [] };

  const downloads = await getDownloads({
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

    await updateDownloads(
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

const handleScrapeRoutine = async () => {
  console.log(`[handleScrapeRoutine] Initiated`);

  const channels = await getChannels();
  for (const channel of channels) {
    console.log(
      `[handleScrapeRoutine] Processing channel ${channel.name} (${channel.id}), with a non-preserved download limit of ${channel.downloadCount}`
    );

    const channelVideos = await getChannelVideos(channel.id);

    const targetDownloadVideos = channelVideos.slice(0, channel.downloadCount);

    const channelDownloads = await getDownloads({
      channelId: channel.id,
    });

    for (const download of channelDownloads) {
      if (!download.automationEnabled) {
        console.log(
          `[handleScrapeRoutine] Video already downloaded with automation disabled. Will not touch, modify or delete. ${download.videoId}`
        );

        continue;
      }

      if (
        !targetDownloadVideos.find((video) => video.id === download.videoId)
      ) {
        console.log(
          `[handleScrapeRoutine] Downloaded video flagged for removal ${download.videoId}`
        );

        await handleRemoval(download.uuid);
      }
    }

    for (const video of targetDownloadVideos) {
      const download = await getDownload({
        videoId: video.id,
      });

      if (download) {
        console.log(`[handleScrapeRoutine] Already downloaded ${video.id}`);
        continue;
      }

      await addDownload({
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
      });
    }
  }
};

const handleQueueDownloadRoutine = async () => {
  console.log(`[handleQueueDownloadRoutine] Started`);

  const downloadsQueued = await getDownloads({
    status: "queued",
  });

  console.log(
    `[handleQueueDownloadRoutine] ${downloadsQueued.length} items in download queue`
  );

  for (const download of downloadsQueued) {
    if (download.status === "queued") {
      try {
        await handleDownload(download.uuid);
      } catch (err) {
        console.log(
          `[handleQueueDownloadRoutine] Failed to download video ${download.title} (${download.videoId})`
        );

        if (err instanceof Error) {
          console.error(err);
        }

        throw err;
      }
    }
  }
};

export const handleCoreRoutine = async () => {
  await handleScrapeRoutine();
  await handleQueueDownloadRoutine();
  console.log(`[handleCoreRoutine] Finished`);
};
