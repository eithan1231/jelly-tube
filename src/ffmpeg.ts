import ffmpeg from "fluent-ffmpeg";

export const processFfmpeg = (
  originalVideo: string,
  originalAudio: string,
  outputFile: string
) => {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .addInput(originalVideo)
      .addInput(originalAudio)
      .once("end", resolve)
      .once("error", reject)
      .save(outputFile);
  });
};
