document.addEventListener("DOMContentLoaded", () => {
  const mapSelector = document.getElementById("mapSelector");
  const gradientSelector = document.getElementById("gradientSelector");
  const regionTableBody = document
    .getElementById("regionTable")
    .querySelector("tbody");
  const exportButton = document.getElementById("exportMap");
  const svg = d3.select("#mapSVG");
  const gMap = svg.select(".map-group");

  const svgWidth = 800;
  const svgHeight = 600;

  svg.attr("viewBox", `0 0 ${svgWidth} ${svgHeight}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  let geoDataFeatures = [];

  // Încărcăm harta selectată
  function loadMap(geojsonFile) {
    d3.json(`data/${geojsonFile}`).then((data) => {
      console.log(`Loaded GeoJSON (${geojsonFile}):`, data);

      if (!data || !data.features) {
        console.error("GeoJSON invalid sau lipsă features.");
        return;
      }

      geoDataFeatures = data.features;

      const projection = d3.geoMercator()
        .fitSize([svgWidth, svgHeight], data);

      const path = d3.geoPath().projection(projection);

      gMap.selectAll("path").remove();

      gMap.selectAll("path")
        .data(geoDataFeatures)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("fill", "#ccc")
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.5)
        .on("mouseover", function (event, d) {
          d3.select(this).attr("fill", "orange");
        })
        .on("mouseout", function (event, d) {
          d3.select(this).attr("fill", "#ccc");
          updateMapColors();
        });

      generateTable(data.features);
      updateMapColors();
    }).catch((err) => {
      console.error("Eroare la încărcarea GeoJSON:", err);
    });
  }

  // Generăm tabelul cu regiuni
  function generateTable(features) {
    regionTableBody.innerHTML = "";
    features.forEach((feature) => {
      const regionName = feature.properties.NAME || feature.properties.name || "Unknown";
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${regionName}</td>
        <td>
          <input type="number" value="0" data-region="${encodeURIComponent(regionName)}" />
        </td>
      `;
      regionTableBody.appendChild(row);
    });

    // Eveniment la modificarea valorilor din tabel
    regionTableBody.querySelectorAll("input").forEach((input) => {
      input.addEventListener("input", updateMapColors);
    });
  }

  // Funcție pentru a colora regiunile
  function updateMapColors() {
    const inputs = regionTableBody.querySelectorAll("input");
    const values = Array.from(inputs).map((input) => parseFloat(input.value) || 0);
    const maxValue = Math.max(...values, 1); // Evităm zero

    const gradient = gradientSelector.value;

    gMap.selectAll("path").each(function (d) {
      const regionName = encodeURIComponent(d.properties.NAME || d.properties.name || "Unknown");
      const input = document.querySelector(`[data-region="${regionName}"]`);
      const value = input ? parseFloat(input.value) || 0 : 0;

      const fillColor = getColor(value, maxValue, gradient);
      d3.select(this).attr("fill", fillColor);
    });
  }

  // Calculăm culoarea pe baza gradientului
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

  // Exportăm harta ca PNG
  exportButton.addEventListener("click", () => {
    html2canvas(document.querySelector(".map-column"), { useCORS: true })
      .then((canvas) => {
        const link = document.createElement("a");
        link.download = "harta.png";
        link.href = canvas.toDataURL("image/png");
        link.click();
      })
      .catch((err) => console.error("Export error:", err));
  });

  mapSelector.addEventListener("change", (e) => {
    loadMap(e.target.value);
  });

  loadMap("md.json");
});
