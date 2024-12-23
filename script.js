document.addEventListener("DOMContentLoaded", () => {
  const mapSelector = document.getElementById("mapSelector");
  const gradientStart = document.getElementById("gradientStart");
  const gradientEnd = document.getElementById("gradientEnd");
  const applyGradientButton = document.getElementById("applyGradient");
  const regionTableBody = document.getElementById("regionTable").querySelector("tbody");
  const exportButton = document.getElementById("exportMap");
  const svg = d3.select("#mapSVG");
  const gMap = svg.select(".map-group");
  const titleInput = document.getElementById("infographicTitle");
  const mapTitle = document.getElementById("mapTitle");

  const svgWidth = 800;
  const svgHeight = 600;

  svg.attr("viewBox", `0 0 ${svgWidth} ${svgHeight}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  let geoDataFeatures = [];
  let currentGradient = {
    start: "#2A73FF",
    end: "#2A73FF"
  };

  // Funcție pentru a actualiza titlul
  function updateTitle(text) {
    mapTitle.textContent = text || "Default Title";
  }

  // Eveniment pentru actualizarea titlului din input
  titleInput.addEventListener("input", () => {
    updateTitle(titleInput.value);
  });

  // Implementare drag-and-drop pentru titlu
  let isDragging = false;
  let offsetX, offsetY;

  mapTitle.addEventListener("mousedown", (e) => {
    isDragging = true;
    offsetX = e.clientX - mapTitle.getBoundingClientRect().left;
    offsetY = e.clientY - mapTitle.getBoundingClientRect().top;
  });

  document.addEventListener("mousemove", (e) => {
    if (isDragging) {
      const mapColumn = document.querySelector(".map-column");
      const rect = mapColumn.getBoundingClientRect();
      let x = e.clientX - rect.left - offsetX;
      let y = e.clientY - rect.top - offsetY;

      // Limitează poziția titlului în interiorul hărții
      x = Math.max(0, Math.min(x, rect.width - mapTitle.getBBox().width));
      y = Math.max(0, Math.min(y, rect.height - mapTitle.getBBox().height));

      mapTitle.setAttribute("x", x);
      mapTitle.setAttribute("y", y);
    }
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
  });

  // Funcție pentru a aplica gradientul personalizat
  function applyCustomGradient() {
    currentGradient.start = gradientStart.value;
    currentGradient.end = gradientEnd.value;
    updateMapColors();
  }

  applyGradientButton.addEventListener("click", applyCustomGradient);

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
          <input type="number" min="0" step="1" value="0" data-region="${encodeURIComponent(regionName)}" />
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

    gMap.selectAll("path").each(function (d) {
      const regionName = encodeURIComponent(d.properties.NAME || d.properties.name || "Unknown");
      const input = document.querySelector(`[data-region="${regionName}"]`);
      const value = input ? parseFloat(input.value) || 0 : 0;

      if (value > 0) {
        const fillColor = getColor(value, maxValue, currentGradient);
        d3.select(this).attr("fill", fillColor);
      } else {
        d3.select(this).attr("fill", "#ccc"); // Gri pentru valoare 0 sau lipsă
      }
    });
  }

  // Calculăm culoarea pe baza gradientului personalizat
  function getColor(value, maxValue, gradient) {
    const ratio = value / maxValue;

    // Interpolare între culorile start și end
    const startColor = d3.color(gradient.start);
    const endColor = d3.color(gradient.end);
    const interpolatedColor = d3.interpolateRgb(startColor, endColor)(ratio);

    return interpolatedColor.toString();
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

  // Eveniment pentru schimbarea hărții
  mapSelector.addEventListener("change", (e) => {
    loadMap(e.target.value);
  });

  loadMap("md.json");
});
