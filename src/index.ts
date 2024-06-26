import { handleCoreRoutine } from "./service-core";
import { sleep, unixTimestamp } from "./util";
import { getConfig } from "./config";
import { handleConfiguratorRoutine } from "./service-configurator";

const runnerConfiguratorRoutine = async () => {
  await handleConfiguratorRoutine();
};

const runnerCoreRoutine = async () => {
  const watching = await getConfig();

  let unixLastRun = 0;

  while (true) {
    if (unixLastRun + watching.routineInterval < unixTimestamp()) {
      await handleCoreRoutine();

      unixLastRun = unixTimestamp();
    }

    await sleep(1000);
  }
};

const main = async () => {
  runnerConfiguratorRoutine();
  runnerCoreRoutine();
};

main();
