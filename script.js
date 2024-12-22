document.addEventListener("DOMContentLoaded", () => {
  // Elementele din HTML
  const mapSelector = document.getElementById("mapSelector");
  const gradientSelector = document.getElementById("gradientSelector");
  const regionTableBody = document
    .getElementById("regionTable")
    .querySelector("tbody");
  const exportBtn = document.getElementById("exportMap");

  // Overlay
  const overlay = document.getElementById("mapOverlay");
  const hoverLabel = document.getElementById("hoverLabel");

  // Selectăm SVG și <g>
  const svg = d3.select("#mapSVG");
  const gMap = svg.select(".map-group");

  let geoDataFeatures = [];
  let projection, path;

  // === Load Map (GeoJSON) ===
  function loadMap(geojsonFile) {
    d3.json(`data/${geojsonFile}`)
      .then((data) => {
        // Stocăm features
        geoDataFeatures = data.features;

        // Ștergem path-uri anterioare
        gMap.selectAll("path").remove();

        // Proiecție + path
        projection = d3.geoMercator();
        path = d3.geoPath().projection(projection);

        // Dimensiuni SVG
        const svgWidth = +svg.style("width").replace("px", "");
        const svgHeight = +svg.style("height").replace("px", "");

        // Bounds
        const bounds = path.bounds(data);
        const x0 = bounds[0][0],  y0 = bounds[0][1];
        const x1 = bounds[1][0],  y1 = bounds[1][1];
        const widthGeo = x1 - x0;
        const heightGeo = y1 - y0;

        // Fallback scale
        let scale = 1000;
        let translateX = svgWidth / 2;
        let translateY = svgHeight / 2;

        if (
          isFinite(widthGeo) &&
          isFinite(heightGeo) &&
          widthGeo > 0 &&
          heightGeo > 0
        ) {
          scale = 0.95 / Math.max(widthGeo / svgWidth, heightGeo / svgHeight);
          const midX = (x0 + x1) / 2;
          const midY = (y0 + y1) / 2;
          translateX = svgWidth / 2 - scale * midX;
          translateY = svgHeight / 2 - scale * midY;
        }

        projection
          .scale(scale)
          .translate([translateX, translateY]);

        // Adăugăm poligoanele
        gMap
          .selectAll("path")
          .data(geoDataFeatures)
          .enter()
          .append("path")
          .attr("d", path)
          .attr("fill", "#ccc")
          .attr("stroke", "#fff")
          .attr("stroke-width", 1)
          // Evenimente de hover -> actualizăm overlay
          .on("mousemove", function (event, d) {
            const props = d.properties;
            const regionName =
              props.NAME || props.RAION || props.name || "Unknown";

            // Afișăm label
            hoverLabel.style.display = "block";
            hoverLabel.textContent = regionName;

            // Poziționăm labelul lângă cursor
            // event.x / event.y în D3v7 e relative la fereastră
            const mouseX = event.pageX;
            const mouseY = event.pageY;

            // Păstrăm un offset
            hoverLabel.style.left = mouseX + 10 + "px";
            hoverLabel.style.top = mouseY + 10 + "px";
          })
          .on("mouseleave", function () {
            hoverLabel.style.display = "none";
          });

        // Construim Tabel
        generateTable(geoDataFeatures);
        // Colorăm inițial
        updateMapColors();
      })
      .catch((err) => {
        console.error("Eroare la încărcare:", err);
      });
  }

  // === Generăm Tabel (cu input numeric pentru fiecare regiune) ===
  function generateTable(features) {
    regionTableBody.innerHTML = "";

    features.forEach((f) => {
      const props = f.properties;
      const regionName = props.NAME || props.RAION || props.name || "Unknown";

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${regionName}</td>
        <td>
          <input type="number" value="0" data-region="${encodeURIComponent(
            regionName
          )}" />
        </td>
      `;
      regionTableBody.appendChild(row);
    });

    // Când se modifică un input -> recolorăm
    regionTableBody.querySelectorAll("input").forEach((inp) => {
      inp.addEventListener("input", updateMapColors);
    });
  }

  // === Funcție de colorare (în funcție de gradient + value) ===
  function getColor(value, maxValue, gradient) {
    if (!value || isNaN(value) || value <= 0) {
      return "#ccc";
    }
    const ratio = value / maxValue;

    switch (gradient) {
      case "blue":
        return `rgba(42, 115, 255, ${Math.min(0.3 + ratio * 0.7, 1)})`;
      case "green":
        return `rgba(50, 200, 50, ${Math.min(0.3 + ratio * 0.7, 1)})`;
      case "red":
        return `rgba(255, 50, 50, ${Math.min(0.3 + ratio * 0.7, 1)})`;
      case "blueDiverging":
        if (ratio > 0.5) {
          return `rgba(42, 115, 255, ${Math.min(0.3 + (ratio - 0.5) * 1.4, 1)})`;
        } else {
          return `rgba(255, 50, 50, ${Math.min(0.3 + ratio * 1.4, 1)})`;
        }
      default:
        return "#ccc";
    }
  }

  // === Actualizăm culori pe hartă, pe baza valorilor introduse ===
  function updateMapColors() {
    if (!geoDataFeatures.length) return;

    // maxValue
    const inputs = regionTableBody.querySelectorAll("input[type='number']");
    const values = Array.from(inputs).map((i) => parseFloat(i.value) || 0);
    const maxValue = Math.max(...values, 1);

    const gradient = gradientSelector.value;

    gMap.selectAll("path").each(function (d) {
      const props = d.properties;
      const regionName = encodeURIComponent(
        props.NAME || props.RAION || props.name || "Unknown"
      );
      const inp = document.querySelector(`[data-region="${regionName}"]`);
      const val = inp ? parseFloat(inp.value) || 0 : 0;

      const fillColor = getColor(val, maxValue, gradient);
      d3.select(this).attr("fill", fillColor);
    });
  }

  // === Export PNG (html2canvas pe .map-column) ===
  exportBtn.addEventListener("click", () => {
    const mapElement = document.querySelector(".map-column");

    html2canvas(mapElement, { useCORS: true })
      .then((canvas) => {
        const dataUrl = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = "map_snapshot.png";
        link.click();
      })
      .catch((err) => {
        console.error("Eroare la generarea PNG:", err);
      });
  });

  // === Când se schimbă harta (select) ===
  mapSelector.addEventListener("change", (e) => {
    loadMap(e.target.value);
  });

  // === Când se schimbă gradientul, recolorăm harta ===
  gradientSelector.addEventListener("change", updateMapColors);

  // === Inițial, încărcăm "md.json" (Moldova) ===
  loadMap("md.json");
});
