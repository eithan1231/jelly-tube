import { randomUUID } from "crypto";
import { open } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { Stream } from "stream";
import { Innertube, YTNodes } from "youtubei.js";

import {} from "youtubei.js/";

let clientInstance: Innertube | null = null;

export const getClient = async () => {
  if (clientInstance) {
    return clientInstance;
  }

  clientInstance = await Innertube.create();

  return clientInstance;
};

export const downloadVideo = async (id: string) => {
  const client = await getClient();

  const filename = path.join(tmpdir(), randomUUID());

  const videoInfo = await client.getInfo(id);

  const allowedQualities = ["144p", "240p", "360p", "480p", "720p", "1080p"];
  let qualityIndex = 0;

  // find bes quality index. When best is found, break loop.
  if (videoInfo.streaming_data?.adaptive_formats) {
    for (const format of videoInfo.streaming_data?.adaptive_formats) {
      const formatIndex = allowedQualities.indexOf(format.quality_label ?? "");

      if (formatIndex > qualityIndex) {
        qualityIndex = formatIndex;
      }

      if (qualityIndex >= allowedQualities.length - 1) {
        break;
      }
    }
  }

  const foundVideoQuality = allowedQualities[qualityIndex];

  const downloadStream = await videoInfo.download({
    type: "video",
    quality: foundVideoQuality,
  });

  const handle = await open(filename, "w");

  await downloadStream.pipeTo(
    Stream.Writable.toWeb(handle.createWriteStream())
  );

  return {
    video: videoInfo,
    filename: filename,
  };
};

export const downloadAudio = async (id: string) => {
  const client = await getClient();

  const filename = path.join(tmpdir(), randomUUID());

  const videoInfo = await client.getInfo(id);

  const downloadStreamAudio = await videoInfo.download({
    type: "audio",
    quality: "best",
  });

  const handle = await open(filename, "w");

  await downloadStreamAudio.pipeTo(
    Stream.Writable.toWeb(handle.createWriteStream())
  );

  return {
    video: videoInfo,
    filename: filename,
  };
};

export const getVideo = async (id: string) => {
  const client = await getClient();

  const result = await client.getBasicInfo(id);

  return result;
};

export const getVideoBasicInfo = async (id: string) => {
  const client = await getClient();

  const result = await client.getBasicInfo(id);

  return result.basic_info;
};

export const getChannelInfo = async (id: string) => {
  const client = await getClient();

  const result = await client.getChannel(id);

  return result;
};

export const getSearch = async (query: string) => {
  const client = await getClient();

  const searchChannelResults = await client.search(query);

  const results: Array<YTNodes.Video | YTNodes.Channel> = [];

  for (const video of searchChannelResults.videos) {
    if (video.is(YTNodes.Video)) {
      results.push(video);
    }
  }

  for (const channel of searchChannelResults.channels) {
    if (channel.is(YTNodes.Channel)) {
      results.push(channel);
    }
  }

  return results;
};

export const getChannelVideos = async (id: string) => {
  const client = await getClient();

  const pageChannel = await client.getChannel(id);

  const pageChannelVideos = await pageChannel.getVideos();

  const contentVideos = pageChannelVideos.current_tab?.content?.as(
    YTNodes.RichGrid
  ).contents;

  if (!contentVideos) {
    throw new Error("Failed to get content videos");
  }

  const videos = contentVideos
    .filter((node) => node.is(YTNodes.RichItem))
    .map((node) => node.as(YTNodes.RichItem).content)
    .filter((node) => node.is(YTNodes.Video))
    .map((node) => node.as(YTNodes.Video));

  return videos;
};
