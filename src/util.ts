export const cleanFilename = (file: string) => {
  const allowedChars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890-_+. ";

  return file
    .split("")
    .filter((fileChar) => allowedChars.includes(fileChar))
    .join("")
    .substring(0, 128);
};

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
