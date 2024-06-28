import express from "express";
import {
  ConfigChannelItemSchemaType,
  ConfigDownloadItemSchemaType,
  addConfigChannel,
  addConfigDownload,
  getConfigChannels,
  getConfigDownloads,
  removeConfigChannels,
  updateConfigChannels,
  updateConfigDownloads,
} from "./config";
import { handleRemoval } from "./service-core";
import { randomUUID } from "crypto";
import { unixTimestamp } from "./util";
import { getChannelInfo, getSearch, getVideo } from "./youtube";
import { YTNodes } from "youtubei.js";

const buildDownloadsFilter = (
  query: any
): Partial<ConfigDownloadItemSchemaType> => {
  const filter: Partial<ConfigDownloadItemSchemaType> = {};

  if (typeof query["uuid"] === "string") {
    filter.uuid = query["uuid"];
  }

  if (typeof query["videoId"] === "string") {
    filter.videoId = query["videoId"];
  }

  if (typeof query["channelId"] === "string") {
    filter.channelId = query["channelId"];
  }

  if (typeof query["status"] === "string") {
    filter.status = query["status"] as any;
  }

  if (typeof query["title"] === "string") {
    filter.title = query["title"] as any;
  }

  if (typeof query["automationEnabled"] === "string") {
    filter.automationEnabled = ["true", "yes", "1"].includes(
      query["automationEnabled"].toLowerCase()
    );
  }

  return filter;
};

const buildChannelsFilter = (
  query: any
): Partial<ConfigChannelItemSchemaType> => {
  const filter: Partial<ConfigChannelItemSchemaType> = {};

  if (typeof query["id"] === "string") {
    filter.id = query["id"];
  }

  if (typeof query["name"] === "string") {
    filter.name = query["name"];
  }

  if (typeof query["maximumDuration"] === "number") {
    filter.maximumDuration = query["maximumDuration"];
  }

  if (typeof query["downloadCount"] === "number") {
    filter.downloadCount = query["downloadCount"];
  }

  return filter;
};

export const setupConfigurator = async () => {
  const port = 3000;
  const server = express();

  server.use(express.static("src/www"));
  server.use(express.json());

  server.get("/downloads", async (req, res) => {
    console.log(`[express] GET (/downloads)`);

    const downloads = await getConfigDownloads(buildDownloadsFilter(req.query));

    res.json({
      items: downloads,
    });
  });

  server.post("/downloads", async (req, res) => {
    console.log(`[express] POST (/downloads)`);

    const videoId = req.body["videoId"];

    if (typeof videoId !== "string") {
      res.json({
        success: false,
        errors: [{ message: "Bad input, video id not found." }],
      });

      return;
    }

    const downloads = await getConfigDownloads(
      buildDownloadsFilter({ videoId })
    );

    if (downloads.length >= 1) {
      res.json({
        success: false,
        errors: [{ message: "Video ID already exists." }],
      });

      return;
    }

    const payload: ConfigDownloadItemSchemaType = {
      uuid: randomUUID(),

      videoId,
      channelId: "",
      title: "",

      status: "queued",
      log: "Queued for manual download",

      automationEnabled: false,

      date: unixTimestamp(),

      folder: "N/A",

      metadata: {},
    };

    const videoInfo = await getVideo(videoId);

    payload.channelId = videoInfo.basic_info.channel_id ?? "";
    payload.title = videoInfo.basic_info.title ?? "";
    payload.metadata.description = videoInfo.basic_info.short_description;
    payload.metadata.duration = videoInfo.basic_info.duration;

    if (
      videoInfo.basic_info.thumbnail &&
      videoInfo.basic_info.thumbnail.length >= 1
    ) {
      payload.metadata.thumbnail = videoInfo.basic_info.thumbnail[0].url;
    }

    if (!payload.channelId) {
      res.json({
        success: false,
        errors: [{ message: "Failed to fetch channel id." }],
      });

      return;
    }

    const configChannels = await getConfigChannels({
      id: payload.channelId,
    });

    if (
      configChannels.length === 0 &&
      videoInfo.basic_info.channel?.id &&
      videoInfo.basic_info.channel?.name
    ) {
      const youtubeChannel = await getChannelInfo(
        videoInfo.basic_info.channel.id
      );
      let thumbnail = undefined;

      if (
        youtubeChannel.metadata.thumbnail &&
        youtubeChannel.metadata.thumbnail[0].url
      ) {
        thumbnail = youtubeChannel.metadata.thumbnail[0].url;
      }

      await addConfigChannel({
        downloadCount: 0,
        maximumDuration: 30,
        id: videoInfo.basic_info.channel.id,
        name: videoInfo.basic_info.channel.name,
        metadata: {
          thumbnail,
        },
      });
    }

    try {
      await addConfigDownload(payload);

      res.json({
        success: true,
        items: downloads,
      });
    } catch (err) {
      console.log(err);

      res.json({
        success: false,
        errors: [
          { message: (err as any)?.message ?? "Failed to create download" },
        ],
      });

      return;
    }
  });

  server.delete("/downloads", async (req, res) => {
    console.log(`[express] DELETE (/downloads)`);

    const downloads = await getConfigDownloads(buildDownloadsFilter(req.query));

    let errors = [];

    for (const download of downloads) {
      const removalResult = await handleRemoval(download.uuid);

      errors.push(...removalResult.errors);
    }

    if (errors.length > 0) {
      res.json({
        success: false,
        errors,
      });

      return;
    }

    res.json({
      success: true,
      message: `Successfully removed ${downloads.length} downloads`,
    });
  });

  server.patch("/downloads", async (req, res) => {
    console.log(`[express] PATCH (/downloads)`);

    const protectedKeys = ["videoId", "channelId", "uuid"];

    for (const protectedKey of protectedKeys) {
      if (Object.keys(req.body).includes(protectedKey)) {
        res.json({
          success: false,
          errors: [
            {
              message: `Protected key was set on body, please remove attribute ${protectedKey}`,
            },
          ],
        });

        return;
      }
    }

    if (req.body["status"] && req.body["status"] !== "queued") {
      res.json({
        success: false,
        errors: [
          {
            message: `Cannot set status to any value besides "queued"`,
          },
        ],
      });

      return;
    }

    await updateConfigDownloads(buildDownloadsFilter(req.query), req.body);

    res.json({
      success: true,
      message: `Successfully patched downloads`,
    });
  });

  server.get("/channels", async (req, res) => {
    console.log(`[express] GET (/channels)`);

    const channels = await getConfigChannels(buildChannelsFilter(req.query));

    res.json({
      items: channels,
    });
  });

  server.post("/channels", async (req, res) => {
    console.log(`[express] POST (/channels)`);

    const existingChannels = await getConfigChannels({
      id: req.body["id"],
    });

    if (existingChannels.length >= 1) {
      res.json({
        success: false,
        errors: [
          {
            message: `Channel Id already exists`,
          },
        ],
      });

      return;
    }

    const payload: ConfigChannelItemSchemaType = {
      id: req.body["id"],
      name: req.body["name"] ?? "",
      downloadCount: req.body["downloadCount"] ?? 0,
      maximumDuration: req.body["maximumDuration"] ?? 0,
      metadata: {
        ...req.body["metadata"],
      },
    };

    const youtubeChannel = await getChannelInfo(payload.id);

    if (!payload.name) {
      payload.name = youtubeChannel.title ?? "";
    }

    if (
      !payload.metadata.thumbnail &&
      youtubeChannel.metadata.thumbnail &&
      youtubeChannel.metadata.thumbnail.length >= 1
    ) {
      payload.metadata.thumbnail = youtubeChannel.metadata.thumbnail[0].url;
    }

    await addConfigChannel(payload);

    res.json({
      success: true,
      message: "ok",
    });
  });

  server.delete("/channels", async (req, res) => {
    console.log(`[express] DELETE (/channels)`);

    const existingChannels = await getConfigChannels(
      buildChannelsFilter(req.query)
    );

    if (existingChannels.length > 1) {
      res.json({
        success: false,
        errors: [
          {
            message: `Removal of channels is limited to a singular channel`,
          },
        ],
      });

      return;
    }

    await removeConfigChannels(buildChannelsFilter(req.query));

    res.json({
      success: true,
      message: `Successfully removed channels`,
    });
  });

  server.patch("/channels", async (req, res) => {
    console.log(`[express] PATCH (/channels)`);

    if (typeof req.body["id"] !== "undefined") {
      res.json({
        success: false,
        errors: [
          {
            message: `Protected key was set on body`,
          },
        ],
      });

      return;
    }

    await updateConfigChannels(buildChannelsFilter(req.query), req.body);

    res.json({
      success: true,
      message: `Successfully removed channels`,
    });
  });

  server.get("/search", async (req, res) => {
    console.log(`[express] GET (/search)`);

    if (typeof req.query["q"] !== "string") {
      res.json({
        success: false,
        errors: [
          {
            message: `Query string not found on body`,
          },
        ],
      });

      return;
    }

    const searchResults = await getSearch(req.query["q"]);

    const transformedResults = searchResults.map((item) => {
      if (item.is(YTNodes.Video)) {
        return {
          type: "video",
          videoId: item.id,
          title: item.title.text,
          channelName: item.author.name,
          views: item.view_count.text,
          thumbnail: item.best_thumbnail?.url,
        };
      }

      if (item.is(YTNodes.Channel)) {
        return {
          type: "channel",
          channelId: item.id,
          channelName: item.author.name,
          subscribers: item.subscriber_count.text,
          thumbnail: item.author.best_thumbnail?.url,
        };
      }
    });

    res.json({ items: transformedResults });
  });

  server.listen(port, () => {
    console.log("[express] listening ", port);
  });
};
