window.fetchSearch = async (search) => {
  let url = "./search?";

  if (search) {
    url += `q=${search}&`;
  }

  const response = await fetch(url);

  return response.json();
};

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

window.createDownloads = async (payload) => {
  const response = await fetch("./downloads", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
    },
  });

  return response.json();
};

window.fetchChannels = async (channelId) => {
  let url = "./channels?";

  if (channelId) {
    url += `id=${channelId}&`;
  }

  const response = await fetch(url);

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

window.patchChannels = async (channelId, channel) => {
  const response = await fetch(`./channels?id=${channelId}`, {
    method: "PATCH",
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
  const channels = await fetchChannels();

  tableElement.replaceChildren();
  tableElement.appendChild(theadElement);
  tableElement.appendChild(tbodyElement);

  theadElement.replaceChildren(
    createTableRow("th", ["Status", "Thumb", "Video", "Channel", "Actions"])
  );

  for (const download of downloads.items) {
    // Status TD Element
    const statusTdElement = document.createElement("td");
    if (download.status) {
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
    }

    // ThumbTD Element
    const thumbTdElement = document.createElement("td");
    if (download.metadata.thumbnail) {
      const videoImageElement = document.createElement("img");
      videoImageElement.style = "height: 5em";
      videoImageElement.className = "border rounded rounded-3";
      videoImageElement.src = download.metadata.thumbnail;

      thumbTdElement.appendChild(videoImageElement);
    }

    // Video TD Element
    const tdVideoElement = document.createElement("td");
    if (download.title && download.videoId) {
      const videoTitleElement = document.createElement("span");
      videoTitleElement.className = "fw-medium";
      videoTitleElement.innerText = download.title;

      const videoIdElement = document.createElement("small");
      videoIdElement.className = "text-muted";
      videoIdElement.innerText = download.videoId;

      tdVideoElement.appendChild(videoTitleElement);
      tdVideoElement.appendChild(document.createElement("br"));
      tdVideoElement.appendChild(videoIdElement);
    }

    // Channel TD Element
    const channelTdElement = document.createElement("td");
    if (download.channelId) {
      const channelNameElement = document.createElement("span");
      channelNameElement.className = "fw-medium";
      channelNameElement.innerText =
        channels.items.find((channel) => channel.id === download.channelId)
          ?.name ?? "";

      const channelIdElement = document.createElement("small");
      channelIdElement.className = "text-muted";
      channelIdElement.innerText = download.channelId;

      channelTdElement.appendChild(channelNameElement);
      channelTdElement.appendChild(document.createElement("br"));
      channelTdElement.appendChild(channelIdElement);
    }

    // Actions
    const actionsTdElement = document.createElement("td");
    if (download.uuid) {
      const buttonGroup = document.createElement("div");
      buttonGroup.className = "btn-group btn-group-sm";

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

      const requeueButton = document.createElement("button");
      requeueButton.className = "btn btn-primary";
      requeueButton.textContent = "Requeue";
      requeueButton.onclick = async () => {
        const result = await window.patchDownloads(download.uuid, {
          status: "queued",
          log: "Requeued for download",
        });

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

      if (["queued", "downloaded", "failed"].includes(download.status)) {
        buttonGroup.appendChild(deleteButton);
      }

      if (["removed", "failed"].includes(download.status)) {
        buttonGroup.appendChild(requeueButton);
      }

      buttonGroup.appendChild(buttonAutomationEnabled);

      actionsTdElement.appendChild(buttonGroup);
    }

    const row = createTableRow("td", [
      statusTdElement,
      thumbTdElement,
      tdVideoElement,
      channelTdElement,
      actionsTdElement,
    ]);

    row.style = "max-height: 1em";

    tbodyElement.appendChild(row);
  }
};

window.loadChannels = async () => {
  const tableElement = document.getElementById("channels");
  const theadElement = document.createElement("thead");
  const tbodyElement = document.createElement("tbody");

  const channels = await fetchChannels();
  const downloads = await fetchDownloads();

  tableElement.replaceChildren();
  tableElement.appendChild(theadElement);
  tableElement.appendChild(tbodyElement);

  theadElement.replaceChildren(
    createTableRow("th", ["", "Channel", "Actions"])
  );

  const channelItemsSorted = channels.items.sort((a, b) => {
    if (a.downloadCount > 0 && b.downloadCount > 0) {
      return 0;
    }

    if (a.downloadCount === 0) {
      return 1;
    }

    if (b.downloadCount === 0) {
      return -1;
    }
  });

  for (const channel of channelItemsSorted) {
    // ThumbTD Element
    const thumbTdElement = document.createElement("td");
    if (channel.metadata.thumbnail) {
      const videoImageElement = document.createElement("img");
      videoImageElement.style = "height: 5em";
      videoImageElement.className = "border rounded rounded-3";
      videoImageElement.src = channel.metadata.thumbnail;

      thumbTdElement.appendChild(videoImageElement);
    }

    // Channel TD Element
    const channelTdElement = document.createElement("td");
    if (channel.name && channel.id) {
      const metric = {
        count: 0,
        automationEnabled: 0,
        downloaded: 0,
        downloading: 0,
        failed: 0,
        queued: 0,
        removed: 0,
      };

      for (const download of downloads.items) {
        if (download.channelId !== channel.id) {
          continue;
        }

        metric.count++;

        if (download.automationEnabled) {
          metric.automationEnabled++;
        }

        if (download.status === "downloaded") {
          metric.downloaded++;
        }

        if (download.status === "failed") {
          metric.failed++;
        }

        if (download.status === "downloading") {
          metric.downloading++;
        }

        if (download.status === "queued") {
          metric.queued++;
        }

        if (download.status === "removed") {
          metric.removed++;
        }
      }

      const channelNameElement = document.createElement("span");
      channelNameElement.className = "fw-medium";
      channelNameElement.innerText = channel.name;

      const channelIdElement = document.createElement("small");
      channelIdElement.className = "text-muted";
      channelIdElement.innerText = channel.id;

      const infoRow = document.createElement("small");
      infoRow.style = "display: block; font-size: 12px; margin-top: 15px";
      infoRow.className = "text-muted tex-sm";
      infoRow.innerText = `Downloads: ${metric.count} • Downloaded: ${metric.downloaded} • Downloading: ${metric.downloading} • Failed: ${metric.failed} • Queued: ${metric.queued} • Removed: ${metric.removed}`;

      channelTdElement.appendChild(channelNameElement);
      channelTdElement.appendChild(document.createElement("br"));
      channelTdElement.appendChild(channelIdElement);
      channelTdElement.appendChild(document.createElement("br"));
      channelTdElement.appendChild(infoRow);
    }

    // Actions
    const actionsTdElement = document.createElement("td");
    if (channel.id) {
      const buttonGroup = document.createElement("div");
      buttonGroup.className = "btn-group btn-group-sm";

      const editButton = document.createElement("a");
      editButton.className = "btn btn-primary";
      editButton.textContent = "Edit";
      editButton.href = `edit-channel.html?channelId=${channel.id}`;

      const deleteButton = document.createElement("button");
      deleteButton.className = "btn btn-danger";
      deleteButton.textContent = "Delete";
      deleteButton.onclick = async () => {
        console.log(channel);
        const result = await window.deleteChannels(channel.id);

        console.log(result);

        if (!result.success) {
          alert(result.errors.map((error) => error.message).join("\n"));
        }

        await window.loadChannels();
      };

      buttonGroup.appendChild(editButton);
      buttonGroup.appendChild(deleteButton);
      actionsTdElement.appendChild(buttonGroup);
    }

    const row = createTableRow("td", [
      thumbTdElement,
      channelTdElement,
      actionsTdElement,
    ]);

    row.id = `item_${channel.id}`;

    tbodyElement.appendChild(row);
  }
};

window.populateSearchTableChannels = (channels) => {
  const tableElement = document.getElementById("search-channels");
  const theadElement = document.createElement("thead");
  const tbodyElement = document.createElement("tbody");

  tableElement.replaceChildren();
  tableElement.appendChild(theadElement);
  tableElement.appendChild(tbodyElement);

  if (channels.length <= 0) {
    return;
  }

  theadElement.replaceChildren(
    createTableRow("th", ["", "Channel", "Meta", "Actions"])
  );

  for (const channel of channels) {
    // Thumb TD Element
    const thumbTdElement = document.createElement("td");
    if (channel.thumbnail) {
      const videoImageElement = document.createElement("img");
      videoImageElement.style = "height: 5em";
      videoImageElement.className = "border rounded rounded-3";
      videoImageElement.src = channel.thumbnail;

      thumbTdElement.appendChild(videoImageElement);
    }

    // Channel TD Element
    const channelTdElement = document.createElement("td");
    if (channel.channelName) {
      const channelNameElement = document.createElement("span");
      channelNameElement.className = "fw-medium";
      channelNameElement.innerText = channel.channelName;

      const channelIdElement = document.createElement("small");
      channelIdElement.className = "text-muted";
      channelIdElement.innerText = channel.channelId;

      channelTdElement.appendChild(channelNameElement);
      channelTdElement.appendChild(document.createElement("br"));
      channelTdElement.appendChild(channelIdElement);
    }

    const buttonMonitoring = document.createElement("a");
    buttonMonitoring.href = `add-channel.html?channelId=${channel.channelId}&channelName=${channel.channelName}`;
    buttonMonitoring.className = "btn btn-primary btn-sm";
    buttonMonitoring.textContent = "Add Channel";

    const row = createTableRow("td", [
      thumbTdElement,
      channelTdElement,
      channel.subscribers,
      buttonMonitoring,
    ]);

    tbodyElement.appendChild(row);
  }
};

window.populateSearchTableVideos = (videos) => {
  const tableElement = document.getElementById("search-videos");
  const theadElement = document.createElement("thead");
  const tbodyElement = document.createElement("tbody");

  tableElement.replaceChildren();
  tableElement.appendChild(theadElement);
  tableElement.appendChild(tbodyElement);

  if (videos.length <= 0) {
    return;
  }

  theadElement.replaceChildren(
    createTableRow("th", ["", "Video", "Meta", "Actions"])
  );

  for (const video of videos) {
    // Thumb TD Element
    const thumbTdElement = document.createElement("td");
    if (video.thumbnail) {
      const videoIdLinkElement = document.createElement("a");
      videoIdLinkElement.className = "text-muted";
      videoIdLinkElement.href = `https://youtube.come/watch?v=${video.videoId}`;

      const videoImageElement = document.createElement("img");
      videoImageElement.style = "height: 5em";
      videoImageElement.className = "border rounded rounded-3";
      videoImageElement.src = video.thumbnail;

      videoIdLinkElement.appendChild(videoImageElement);

      thumbTdElement.appendChild(videoIdLinkElement);
    }

    // Video TD Element
    const videoTdElement = document.createElement("td");
    if (video.channelName) {
      const videoTitleElement = document.createElement("span");
      videoTitleElement.className = "fw-medium";
      videoTitleElement.innerText = video.title;

      const videoChannelElement = document.createElement("small");
      videoChannelElement.className = "text-muted";
      videoChannelElement.innerText = video.channelName;

      videoTdElement.appendChild(videoTitleElement);
      videoTdElement.appendChild(document.createElement("br"));
      videoTdElement.appendChild(videoChannelElement);
    }

    const buttonMonitoring = document.createElement("button");
    buttonMonitoring.className = "btn btn-primary btn-sm";
    buttonMonitoring.textContent = "Download Video";
    buttonMonitoring.onclick = () => {
      window
        .createDownloads({
          videoId: video.videoId,
        })
        .then((result) => {
          if (!result.success) {
            alert(result.errors.map((error) => error.message).join("\n"));
          } else {
            alert(result.message);
          }

          buttonMonitoring.disabled = true;
        });
    };

    const row = createTableRow("td", [
      thumbTdElement,
      videoTdElement,
      video.views,
      buttonMonitoring,
    ]);

    tbodyElement.appendChild(row);
  }
};

window.loadSearch = async (query) => {
  const searchResults = await window.fetchSearch(query);

  populateSearchTableChannels(
    searchResults.items.filter((item) => item.type === "channel")
  );

  populateSearchTableVideos(
    searchResults.items.filter((item) => item.type === "video")
  );
};
