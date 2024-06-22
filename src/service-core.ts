import { downloadAudio, downloadVideo, getChannelVideos } from "./youtube";
import { getConfig, saveWatchingConfig } from "./config";
import { YTNodes } from "youtubei.js";
import { access, lstat, mkdir, rename, rm, stat, writeFile } from "fs/promises";
import path from "path";
import { cleanFilename, unixTimestamp } from "./util";
import { processFfmpeg } from "./ffmpeg";
import { createNfoMovie } from "./nfo";

export const handleDownload = async (
  video: YTNodes.Video,
  preserve: boolean = false
) => {
  console.log(`[handleDownload] ${video.id} Title: "${video.title}"`);

  if (video.duration.seconds / 60 > 30) {
    console.log(
      `[handleDownload] ${video.id} Unable to download, exceeds maximum duration`
    );

    return;
  }

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
      studio: resultAudio.video.basic_info.channel?.name,
      thumbs: [video.best_thumbnail?.url ?? ""],
    })
  );

  console.log(
    `[handleDownload] ${video.id} Copied source and NFO files to processing directory`
  );

  await processFfmpeg(
    video.id,
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

  const watching = await getConfig();

  watching.downloads.push({
    videoId: video.id,
    channelId:
      resultAudio.video.basic_info.channel?.id ?? `error getting channel name`,
    title: video.title.text ?? video.id,
    preserve: preserve,
    folder: destinationFolder,
    // date: unixTimestamp(),
  });

  await saveWatchingConfig();

  console.log(
    `[handleDownload] ${video.id} Updated watching record to include downloaded movie.`
  );
};

export const handleRemoval = async (id: string) => {
  console.warn(`[handleRemoval] Removing ${id}...`);

  const watching = await getConfig();

  const index = watching.downloads.findIndex(
    (download) => download.videoId === id
  );

  if (index === -1) {
    console.warn("[handleRemoval] returned -1 for download.");
    return;
  }

  const removedDownloads = watching.downloads.splice(index, 1);

  for (const download of removedDownloads) {
    await rm(download.folder, { recursive: true });
  }

  await saveWatchingConfig();

  console.warn(`[handleRemoval] Removed ${id}, ${removedDownloads[0]?.title}`);
};

export const handleCoreRoutine = async () => {
  console.log(`[handleCoreRoutine] Initiated`);

  const watching = await getConfig();

  for (const channel of watching.channels) {
    console.log(
      `[handleCoreRoutine] Processing channel ${channel.name} (${channel.id}), with a non-preserved download limit of ${channel.downloadCount}`
    );

    const channelVideos = await getChannelVideos(channel.id);

    const targetDownloadVideos = channelVideos.slice(0, channel.downloadCount);

    const channelDownloads = watching.downloads.filter(
      (value) => value.channelId === channel.id
    );

    for (const download of channelDownloads) {
      if (download.preserve) {
        console.log(
          `[handleCoreRoutine] Video already downloaded with preservation flag. Will not touch, modify or delete. ${download.videoId}`
        );

        continue;
      }

      if (
        !targetDownloadVideos.find((video) => video.id === download.videoId)
      ) {
        console.log(
          `[handleCoreRoutine] Downloaded video flagged for removal ${download.videoId}`
        );

        await handleRemoval(download.videoId);
      }
    }

    for (const video of targetDownloadVideos) {
      const download = watching.downloads.find(
        (download) => download.videoId === video.id
      );

      if (download) {
        console.log(`[handleCoreRoutine] Already downloaded ${video.id}`);
        continue;
      }

      try {
        await handleDownload(video, false);
      } catch (err) {
        console.log(
          `[handleCoreRoutine] Failed to download video ${video.title.text} (${video.id})`
        );

        if (err instanceof Error) {
          console.error(err);
        }

        throw err;
      }
    }
  }

  console.log(`[handleCoreRoutine] Finished`);
};
