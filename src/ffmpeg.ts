import ffmpeg from "fluent-ffmpeg";
import { unixTimestamp } from "./util";

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
  return new Promise((resolve, reject) => {
    let lastProgressTime = 0;
    const progressTimeDelay = 5;

    ffmpeg()
      .addInput(originalVideo)
      .inputOption("-hwaccel auto")
      .addInput(originalAudio)
      .inputOption("-hwaccel auto")
      .once("end", resolve)
      .once("error", reject)
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
