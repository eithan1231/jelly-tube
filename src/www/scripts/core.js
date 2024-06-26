window.fetchDownloads = async (channelId = undefined) => {
  let url = "./downloads?";

  if (channelId) {
    url += `channelId=${channelId}&`;
  }

  const response = await fetch(url);

  return response.json();
};

window.deleteDownloads = async (uuid) => {
  let url = "./downloads?";

  if (uuid) {
    url += `uuid=${uuid}&`;
  }

  const response = await fetch(url, {
    method: "DELETE",
  });

  return response.json();
};

window.patchDownloads = async (uuid, patch) => {
  let url = "./downloads?";

  if (uuid) {
    url += `uuid=${uuid}&`;
  }

  const response = await fetch(url, {
    method: "PATCH",
    body: JSON.stringify(patch),
    headers: {
      "Content-Type": "application/json",
    },
  });

  return response.json();
};

window.fetchChannels = async (channelId = undefined) => {
  const response = await fetch("./channels");

  return response.json();
};

window.createChannels = async (channel) => {
  const response = await fetch("./channels", {
    method: "POST",
    body: JSON.stringify(channel),
    headers: {
      "Content-Type": "application/json",
    },
  });

  return response.json();
};

window.deleteChannels = async (id) => {
  let url = "./channels?";

  if (id) {
    url += `id=${id}&`;
  }

  const response = await fetch(url, {
    method: "DELETE",
  });

  return response.json();
};

window.loadDownloads = async () => {
  const tableElement = document.getElementById("downloads");
  const theadElement = document.createElement("thead");
  const tbodyElement = document.createElement("tbody");

  const downloads = await fetchDownloads();

  tableElement.replaceChildren();
  tableElement.appendChild(theadElement);
  tableElement.appendChild(tbodyElement);

  theadElement.replaceChildren(
    createTableRow("th", ["Title", "Status", "Id", "Channel Id", "Actions"])
  );

  for (const download of downloads.items) {
    const deleteButton = document.createElement("button");
    deleteButton.className = "btn btn-danger";
    deleteButton.textContent = "Delete";
    deleteButton.onclick = async () => {
      const result = await window.deleteDownloads(download.uuid);

      console.log(result);

      if (!result.success) {
        alert(result.errors.map((error) => error.message).join("\n"));
      }

      await window.loadDownloads();
    };

    const buttonAutomationEnabled = document.createElement("button");
    buttonAutomationEnabled.className = "btn btn-primary";
    buttonAutomationEnabled.textContent = download.automationEnabled
      ? "Disable Automation"
      : "Enable Automation";
    buttonAutomationEnabled.onclick = async () => {
      const result = await window.patchDownloads(download.uuid, {
        automationEnabled: !download.automationEnabled,
      });

      console.log(result);

      if (!result.success) {
        alert(result.errors.map((error) => error.message).join("\n"));
      }

      await window.loadDownloads();
    };

    const titleElement = document.createElement("td");
    titleElement.className = "fw-medium";
    titleElement.innerText = download.title;

    const statusTdElement = document.createElement("td");

    const statusElement = document.createElement("span");
    statusElement.className = "fw-semibold border-bottom border-3 ";
    statusElement.innerText = download.status;

    switch (download.status) {
      case "downloaded":
      case "removed":
        statusElement.className += "border-success";
        break;

      case "downloading":
        statusElement.className += "border-primary";
        break;

      case "failed":
        statusElement.className += "border-danger";
        break;

      case "queued":
        statusElement.className += "border-secondary";
        break;
    }

    const logElement = document.createElement("small");
    logElement.className = "text-muted";
    logElement.innerText = download.log;

    statusTdElement.appendChild(statusElement);
    statusTdElement.appendChild(document.createElement("br"));
    statusTdElement.appendChild(logElement);

    const videoIdElement = document.createElement("td");
    videoIdElement.className = "fw-light";
    videoIdElement.innerText = download.videoId;

    const channelIdElement = document.createElement("td");
    channelIdElement.className = "fw-light";
    channelIdElement.innerText = download.channelId;

    const row = createTableRow("td", [
      titleElement,
      statusTdElement,
      videoIdElement,
      channelIdElement,
      [deleteButton, buttonAutomationEnabled],
    ]);

    tbodyElement.appendChild(row);
  }
};

window.loadChannels = async () => {
  const tableElement = document.getElementById("channels");
  const theadElement = document.createElement("thead");
  const tbodyElement = document.createElement("tbody");

  const channels = await fetchChannels();

  tableElement.replaceChildren();
  tableElement.appendChild(theadElement);
  tableElement.appendChild(tbodyElement);

  theadElement.replaceChildren(
    createTableRow("th", [
      "Name",
      "Channel Id",
      "Download Buffer Count",
      "Maximum Duration",
      "Actions",
    ])
  );

  for (const channel of channels.items) {
    const deleteButton = document.createElement("button");
    deleteButton.className = "btn btn-danger";
    deleteButton.textContent = "Delete";
    console.log(channel.id);

    deleteButton.onclick = async () => {
      console.log(channel);
      const result = await window.deleteChannels(channel.id);

      console.log(result);

      if (!result.success) {
        alert(result.errors.map((error) => error.message).join("\n"));
      }

      await window.loadChannels();
    };

    const row = createTableRow("td", [
      channel.name,
      channel.id,
      channel.downloadCount,
      channel.maximumDuration,
      deleteButton,
    ]);

    tbodyElement.appendChild(row);
  }
};
