document.addEventListener("DOMContentLoaded", () => {
  const mapSelector = document.getElementById("mapSelector");
  const gradientSelector = document.getElementById("gradientSelector");
  const regionTableBody = document
    .getElementById("regionTable")
    .querySelector("tbody");
  const exportButton = document.getElementById("exportMap");
  const mapTitleInput = document.getElementById("mapTitle");
  const legend = document.getElementById("legend");
  const tooltip = document.getElementById("tooltip");
  const svg = d3.select("#mapSVG");
  const gMap = svg.select(".map-group");

  const svgWidth = 800;
  const svgHeight = 600;

  svg.attr("viewBox", `0 0 ${svgWidth} ${svgHeight}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const title = svg.append("text")
    .attr("id", "mapTitleDisplay")
    .attr("x", svgWidth / 2)
    .attr("y", 30)
    .text("");

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
          const regionName = d.properties.NAME || d.properties.name || "Unknown";
          const value = getRegionValue(regionName);
          tooltip.textContent = `${regionName}: ${value}`;
          tooltip.style.display = "block";
          tooltip.style.left = `${event.pageX + 10}px`;
          tooltip.style.top = `${event.pageY + 10}px`;
        })
        .on("mouseout", () => {
          tooltip.style.display = "none";
        });

      generateTable(data.features);
      updateMapColors();
      updateLegend();
    });
  }

  function generateTable(features) {
    regionTableBody.innerHTML = "";
    features.forEach((feature) => {
      const regionName = feature.properties.NAME || feature.properties.name || "Unknown";
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
      input.addEventListener("input", () => {
        updateMapColors();
        updateLegend();
      });
    });
  }

  function updateMapColors() {
    const inputs = Array.from(
      regionTableBody.querySelectorAll("input")
    ).map((input) => parseFloat(input.value) || 0);

    const maxValue = Math.max(...inputs, 1);
    const gradient = gradientSelector.value;

    gMap.selectAll("path").each(function (d) {
      const regionName = d.properties.NAME || d.properties.name || "Unknown";
      const input = document.querySelector(`[data-region="${regionName}"]`);
      const value = input ? parseFloat(input.value) || 0 : 0;

      const fillColor = getColor(value, maxValue, gradient);
      d3.select(this).attr("fill", fillColor);
    });
  }

  function getColor(value, maxValue, gradient) {
    const ratio = value / maxValue;

    switch (gradient) {
      case "blue":
        return `rgba(42, 115, 255, ${Math.min(0.3 + ratio * 0.7, 1)})`;
      case "green":
        return `rgba(50, 200, 50, ${Math.min(0.3 + ratio * 0.7, 1)})`;
      case "red":
        return `rgba(255, 50, 50, ${Math.min(0.3 + ratio * 0.7, 1)})`;
      case "blueDiverging":
        return ratio > 0.5
          ? `rgba(42, 115, 255, ${Math.min(0.3 + (ratio - 0.5) * 1.4, 1)})`
          : `rgba(255, 50, 50, ${Math.min(0.3 + ratio * 1.4, 1)})`;
      default:
        return "#ccc";
    }
  }

  function updateLegend() {
    const inputs = Array.from(
      regionTableBody.querySelectorAll("input")
    ).map((input) => parseFloat(input.value) || 0);

    const max = Math.max(...inputs, 1);
    legend.innerHTML = `
      <div>0</div>
      <div>→</div>
      <div>${max}</div>
    `;
  }

  mapTitleInput.addEventListener("input", () => {
    title.text(mapTitleInput.value);
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

  mapSelector.addEventListener("change", (e) => {
    loadMap(e.target.value);
  });

  loadMap("md.json");
});
