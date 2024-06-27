window.createTableRow = (type, values) => {
  const rowElem = document.createElement("tr");

  for (const value of values) {
    const colElem = document.createElement(type);

    if (typeof value === "string" || typeof value === "number") {
      colElem.innerText = value;
    } else {
      if (Array.isArray(value)) {
        value.map((x) => colElem.appendChild(x));
      } else {
        if (value.tagName === "TD") {
          rowElem.appendChild(value);
          continue;
        } else {
          colElem.appendChild(value);
        }
      }
    }

    rowElem.appendChild(colElem);
  }

  return rowElem;
};
