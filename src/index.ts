import {
  routineChannelThumbnailRefresh,
  routineChannelsCrawl,
  routineDownloadQueue,
  routineDownloadThumbnailRefresh,
} from "./service-core";
import { sleep, unixTimestamp } from "./util";
import { setupConfigurator } from "./service-configurator";

const main = async () => {
  await setupConfigurator();

  const runtimeLoop = !process.argv.includes("--disable-loop");
  console.log(`[main] Runtime Loop enabled: ${runtimeLoop ? "true" : "false"}`);

  const intervalChannelThumbnailRefresh = 60 * 60 * 4;
  const intervalDownloadThumbnailRefresh = 60 * 60 * 4;
  const intervalChannelsCrawl = 60 * 60;
  const intervalDownloadQueue = 30;

  let lastChannelThumbnailRefresh = 0;
  let lastDownloadThumbnailRefresh = 0;
  let lastChannelsCrawl = 0;
  let lastDownloadQueue = 0;

  while (runtimeLoop) {
    // Refresh Channel Thumbnails
    if (
      lastChannelThumbnailRefresh + intervalChannelThumbnailRefresh <
      unixTimestamp()
    ) {
      await routineChannelThumbnailRefresh();

      lastChannelThumbnailRefresh = unixTimestamp();
    }

    // Refresh Download Thumbnails
    if (
      lastDownloadThumbnailRefresh + intervalDownloadThumbnailRefresh <
      unixTimestamp()
    ) {
      await routineDownloadThumbnailRefresh();

      lastDownloadThumbnailRefresh = unixTimestamp();
    }

    // Crawl Channels
    if (lastChannelsCrawl + intervalChannelsCrawl < unixTimestamp()) {
      await routineChannelsCrawl();

      lastChannelsCrawl = unixTimestamp();
    }

    // Handle download queue
    if (lastDownloadQueue + intervalDownloadQueue < unixTimestamp()) {
      await routineDownloadQueue();

      lastDownloadQueue = unixTimestamp();
    }

    await sleep(5000);
  }
};

main();
