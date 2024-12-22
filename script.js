document.addEventListener("DOMContentLoaded", () => {
  const mapSelector = document.getElementById("mapSelector");
  const gradientSelector = document.getElementById("gradientSelector");
  const regionTableBody = document
    .getElementById("regionTable")
    .querySelector("tbody");
  const exportButton = document.getElementById("exportMap");
  const mapTitleInput = document.getElementById("mapTitle");
  const svg = d3.select("#mapSVG");
  const gMap = svg.select(".map-group");

  const svgWidth = 800;
  const svgHeight = 600;

  svg.attr("viewBox", `0 0 ${svgWidth} ${svgHeight}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  let geoDataFeatures = [];

  function loadMap(geojsonFile) {
    d3.json(`data/${geojsonFile}`).then((data) => {
      if (!data || !data.features) return;

      geoDataFeatures = data.features;

      const projection = d3.geoMercator().fitSize([svgWidth, svgHeight], data);
      const path = d3.geoPath().projection(projection);

      gMap.selectAll("path").remove();

      gMap.selectAll("path")
        .data(geoDataFeatures)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("fill", "#ccc")
        .attr("stroke", "#fff")
        .on("mouseover", function (event, d) {
          const regionName = d.properties.NAME || "Unknown";
          tooltip.textContent = regionName;
          tooltip.style.display = "block";
          tooltip.style.left = `${event.pageX + 10}px`;
          tooltip.style.top = `${event.pageY + 10}px`;
        })
        .on("mouseout", () => {
          tooltip.style.display = "none";
        });

      generateTable(data.features);
      updateMapColors();
    });
  }

  function generateTable(features) {
    regionTableBody.innerHTML = "";
    features.forEach((feature) => {
      const regionName = feature.properties.NAME || "Unknown";
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${regionName}</td>
        <td>
          <input type="number" value="0" data-region="${regionName}" />
        </td>
      `;
      regionTableBody.appendChild(row);
    });

    regionTableBody.querySelectorAll("input").forEach((input) => {
      input.addEventListener("input", updateMapColors);
    });
  }

  function updateMapColors() {
    const inputs = Array.from(
      regionTableBody.querySelectorAll("input")
    ).map((input) => parseFloat(input.value) || 0);

    const maxValue = Math.max(...inputs, 1);

    gMap.selectAll("path").each(function (d) {
      const regionName = d.properties.NAME || "Unknown";
      const input = document.querySelector(`[data-region="${regionName}"]`);
      const value = input ? parseFloat(input.value) || 0 : 0;

      const fillColor = d3.interpolateBlues(value / maxValue || 0);
      d3.select(this).attr("fill", fillColor);
    });
  }

  mapSelector.addEventListener("change", (e) => {
    loadMap(e.target.value);
  });

  mapTitleInput.addEventListener("input", () => {
    svg.select("#mapTitleDisplay")
      .attr("x", svgWidth / 2)
      .attr("y", 30)
      .text(mapTitleInput.value);
  });

  exportButton.addEventListener("click", () => {
    html2canvas(document.querySelector(".map-column"), { useCORS: true }).then(
      (canvas) => {
        const link = document.createElement("a");
        link.download = `${mapTitleInput.value || "map"}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      }
    );
  });

  loadMap("md.json");
});
