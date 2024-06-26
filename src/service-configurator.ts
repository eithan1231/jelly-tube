import express from "express";
import {
  ConfigChannelItemSchemaType,
  ConfigDownloadItemSchemaType,
  addChannel,
  getChannel,
  getChannels,
  getDownloads,
  removeChannels,
  updateChannels,
  updateDownloads,
} from "./config";
import { handleRemoval } from "./service-core";

const buildDownloadsFilter = (
  query: any
): Partial<ConfigDownloadItemSchemaType> => {
  const filter: Partial<ConfigDownloadItemSchemaType> = {};

  if (typeof query["uuid"] === "string") {
    filter.uuid = query["uuid"];
  }

  if (typeof query["channelId"] === "string") {
    filter.channelId = query["channelId"];
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

export const handleConfiguratorRoutine = async () => {
  const port = 3000;
  const server = express();

  server.use(express.static("src/www"));
  server.use(express.json());

  server.get("/downloads", async (req, res) => {
    console.log(`[express] GET (/downloads)`);

    const downloads = await getDownloads(buildDownloadsFilter(req.query));

    res.json({
      items: downloads,
    });
  });

  server.delete("/downloads", async (req, res) => {
    console.log(`[express] DELETE (/downloads)`);

    const downloads = await getDownloads(buildDownloadsFilter(req.query));

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

    const protectedKeys = ["status", "videoId", "channelId", "uuid"];

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

    await updateDownloads(buildDownloadsFilter(req.query), req.body);

    res.json({
      success: true,
      message: `Successfully patched downloads`,
    });
  });

  server.get("/channels", async (req, res) => {
    console.log(`[express] GET (/channels)`);

    const channels = await getChannels(buildChannelsFilter(req.query));

    res.json({
      items: channels,
    });
  });

  server.post("/channels", async (req, res) => {
    console.log(`[express] POST (/channels)`);

    const existingChannels = await getChannels({
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

    await addChannel(req.body);

    res.json({
      success: true,
      message: "ok",
    });
  });

  server.delete("/channels", async (req, res) => {
    console.log(`[express] DELETE (/channels)`);

    const existingChannels = await getChannels(buildChannelsFilter(req.query));

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

    await removeChannels(buildChannelsFilter(req.query));

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

    await updateChannels(buildChannelsFilter(req.query), req.body);

    res.json({
      success: true,
      message: `Successfully removed channels`,
    });
  });

  server.listen(port, () => {
    console.log("[express] listening ", port);
  });
};
