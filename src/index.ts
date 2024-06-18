import z from "zod";
import { downloadAudio, downloadVideo, getChannelVideos } from "./jelly-tube";
import {
  WatchingSchema,
  WatchingSchemaType,
  getWatchingConfig,
  saveWatchingConfig,
} from "./watching";
import { YTNodes } from "youtubei.js";
import { mkdir, rename, rm, writeFile } from "fs/promises";
import path from "path";
import { cleanFilename, sleep } from "./util";
import { processFfmpeg } from "./ffmpeg";
import { createNfoMovie } from "./nfo";

export const handleDownload = async (
  video: YTNodes.Video,
  preserve: boolean = false
) => {
  console.log(`[handleDownload] ${video.id} Title: "${video.title}"`);

  const [resultVideo, resultAudio] = await Promise.all([
    await downloadVideo(video.id),
    await downloadAudio(video.id),
  ]);

  console.log(`[handleDownload] ${video.id} Downloaded audio and video`);

  const filename = cleanFilename(video.title.text ?? video.id);
  const filenameNfo = `movie.nfo`;

  const processingFolder = path.join(
    process.cwd(),
    "./downloads/processing",
    filename
  );
  const destinationFolder = path.join(
    process.cwd(),
    "./downloads/completed",
    filename
  );

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
        value: video.id,
      },
      title: video.title.text ?? video.id,
      plot: video.description,
      studio: video.author.name,
      thumbs: [video.best_thumbnail?.url ?? ""],
    })
  );

  console.log(
    `[handleDownload] ${video.id} Copied source and NFO files to processing directory`
  );

  await processFfmpeg(
    processingVideoOriginalFile,
    processingAudioOriginalFile,
    processingVideoOutputFile
  );

  console.log(`[handleDownload] ${video.id} ffmpeg processed`);

  const destinationVideoFile = path.join(destinationFolder, `${filename}.mp4`);
  const destinationVideoNfo = path.join(destinationFolder, filenameNfo);

  await mkdir(destinationFolder, { recursive: true });
  await rename(processingVideoOutputFile, destinationVideoFile);
  await rename(processingVideoNfo, destinationVideoNfo);

  console.log(
    `[handleDownload] ${video.id} Copied to destination/completed folder`
  );

  await rm(processingFolder, { recursive: true });

  console.log(`[handleDownload] ${video.id} Removed processing folder.`);

  const watching = await getWatchingConfig();

  watching.downloads.push({
    videoId: video.id,
    channelId: video.author.id,
    title: video.title.text ?? video.id,
    preserve: preserve,
    folder: destinationFolder,
  });

  await saveWatchingConfig();

  console.log(
    `[handleDownload] ${video.id} Updated watching record to include downloaded movie.`
  );
};

export const handleRemoval = async (id: string) => {
  const watching = await getWatchingConfig();

  const index = watching.downloads.findIndex(
    (download) => download.videoId === id
  );

  if (index === -1) {
    console.warn("[handleRemoval] returned -1 for download.");
    return;
  }

  const removedDownloads = watching.downloads.splice(index, 1);

  for (const download of removedDownloads) {
    await rm(download.videoId);
  }

  await saveWatchingConfig();
};

export const applicationRoutine = async () => {
  console.log(`[applicationRoutine] Initiated`);

  const watching = await getWatchingConfig();

  for (const channel of watching.channels) {
    console.log(
      `[applicationRoutine] Processing channel ${channel.name} (${channel.id}), with a non-preserved download limit of ${channel.downloadCount}`
    );

    const channelVideos = await getChannelVideos(channel.id);

    const targetDownloadVideos = channelVideos.slice(0, channel.downloadCount);

    const channelDownloads = watching.downloads.filter(
      (value) => value.channelId === channel.id
    );

    for (const download of channelDownloads) {
      if (download.preserve) {
        console.log(
          `[applicationRoutine] Video already downloaded with preservation flag. Will not touch, modify or delete. ${download.videoId}`
        );

        continue;
      }

      if (
        !targetDownloadVideos.find((video) => video.id === download.videoId)
      ) {
        console.log(
          `[applicationRoutine] Downloaded video flagged for removal ${download.videoId}`
        );

        await handleRemoval(download.videoId);
      }
    }

    for (const video of targetDownloadVideos) {
      const download = watching.downloads.find(
        (download) => download.videoId === video.id
      );

      if (download) {
        console.log(`[applicationRoutine] Already downloaded ${video.id}`);
        continue;
      }

      try {
        await handleDownload(video, false);
      } catch (err) {
        console.log(
          `[applicationRoutine] Failed to download video ${video.title.text} (${video.id})`
        );

        if (err instanceof Error) {
          console.error(err);
        }

        throw err;
      }
    }
  }
};

const main = async () => {
  while (true) {
    await applicationRoutine();

    // Sleep for an hour
    await sleep(1000 * 60 * 60);
  }
};

main();
