const sanitiseHtmlCharacters = (value: string): string => {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
};

const createTag = (
  tag: string,
  data: string,
  attributes?: Record<string, string>
) => {
  let result = "";
  if (attributes) {
    result += `<${tag}`;

    for (const attribute in attributes) {
      result += ` ${attribute}="${sanitiseHtmlCharacters(
        attributes[attribute]
      )}"`;
    }

    result += `>`;
  } else {
    result += `<${tag}>`;
  }

  result += data;

  result += `</${tag}>`;

  return result;
};

const createTagSafe = (
  tag: string,
  data: string,
  attributes?: Record<string, string>
) => {
  return createTag(tag, sanitiseHtmlCharacters(data), attributes);
};

export type NfoMovie = {
  uniqueId: {
    type: string;
    value: string;
  };
  title: string;

  thumbs?: string[];
  plot?: string;
  studio?: string;
};

export const createNfoMovie = (meta: NfoMovie) => {
  const data: string[] = [];

  data.push(
    createTagSafe("uniqueid", meta.uniqueId.value, {
      type: meta.uniqueId.type,
      default: "",
    })
  );

  data.push(createTagSafe("title", meta.title));

  if (meta.plot) {
    data.push(createTagSafe("plot", meta.plot));
  }

  if (meta.studio) {
    data.push(createTagSafe("studio", meta.studio));
  }

  if (meta.thumbs) {
    for (const thumb of meta.thumbs) {
      data.push(createTagSafe("thumb", thumb));
    }
  }

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>\n` +
    createTag("movie", data.join("\n"))
  );
};
