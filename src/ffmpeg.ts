import ffmpeg from "fluent-ffmpeg";
import { unixTimestamp } from "./util";
import { getFfmpegTimeout } from "./config";

type FfmpegEventProgress = {
  frames: number;
  currentFps: number;
  currentKbps: number;
  targetSize: number;
  timemark: string;
  percent: number;
};

export const processFfmpeg = (
  id: string,
  originalVideo: string,
  originalAudio: string,
  outputFile: string
) => {
  return new Promise(async (resolve, reject) => {
    const ffmpegTimeoutDuration = await getFfmpegTimeout();

    console.log(`[processFfmpeg] Timeout duration ${ffmpegTimeoutDuration}`);

    let timeout = setTimeout(() => {
      command.kill("SIGKILL");
    }, ffmpegTimeoutDuration * 1000);

    let lastProgressTime = 0;
    const progressTimeDelay = 5;

    const command = ffmpeg()
      .addInput(originalVideo)
      .inputOption("-hwaccel auto")
      .addInput(originalAudio)
      .inputOption("-hwaccel auto")
      .once("end", () => {
        clearTimeout(timeout);

        resolve(null);
      })
      .once("error", (err) => {
        clearTimeout(timeout);

        reject(err);
      })
      .on("stderr", (line) => console.error(line))
      .on("progress", (progress: FfmpegEventProgress) => {
        if (lastProgressTime + progressTimeDelay >= unixTimestamp()) {
          return;
        }

        console.log(
          `[processFfmpeg] ${id} - event 'progress', percent ${progress.percent}%, frames: ${progress.frames}, timemark: ${progress.timemark}`
        );

        lastProgressTime = unixTimestamp();
      })
      .save(outputFile);
  });
};
