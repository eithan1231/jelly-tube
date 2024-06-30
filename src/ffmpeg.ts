import ffmpeg from "fluent-ffmpeg";
import { unixTimestamp } from "./util";
import { getFfmpegTimeout, updateConfigDownloads } from "./config";

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
  outputFile: string,
  onLogMessage?: (message: string) => void | undefined
) => {
  return new Promise(async (resolve, reject) => {
    const ffmpegTimeoutDuration = await getFfmpegTimeout();
    console.log(`[processFfmpeg] Timeout duration ${ffmpegTimeoutDuration}`);

    let standardErrorOutput: string[] = [];
    let timeout: NodeJS.Timeout;

    const command = ffmpeg()
      .addInput(originalVideo)
      .inputOption("-hwaccel auto")
      .addInput(originalAudio)
      .inputOption("-hwaccel auto")
      .once("end", () => {
        clearTimeout(timeout);

        resolve(null);
      })
      .once("error", (err, stdout, stderr) => {
        clearTimeout(timeout);

        reject(err);
      })
      .on("stderr", (line) => {
        standardErrorOutput.push(line);
      })
      .on("progress", async (progress: FfmpegEventProgress) => {
        if (onLogMessage) {
          onLogMessage(`Processing at ${progress.percent.toFixed(2)}%`);
        }
      })
      .save(outputFile);

    timeout = setTimeout(() => {
      console.log(
        `[processFfmpeg] Reached timeout, sending kill signal to process`
      );

      console.log(standardErrorOutput.join("\n"));

      command.kill("SIGKILL");
    }, ffmpegTimeoutDuration * 1000);
  });
};
