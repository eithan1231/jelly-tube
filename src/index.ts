import {
  routineChannelsCrawl,
  routineDownloadQueue,
  routineDownloadThumbnailRefresh,
} from "./service-core";
import { sleep, unixTimestamp } from "./util";
import { setupConfigurator } from "./service-configurator";

const main = async () => {
  await setupConfigurator();

  const intervalDownloadThumbnailRefresh = 60 * 60 * 4;
  const intervalChannelsCrawl = 60 * 60;
  const intervalDownloadQueue = 30;

  let lastDownloadThumbnailRefresh = 0;
  let lastChannelsCrawl = 0;
  let lastDownloadQueue = 0;

  while (true) {
    // Refresh Downloads
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
