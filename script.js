document.addEventListener("DOMContentLoaded", () => {
  const mapSelector = document.getElementById("mapSelector");
  const gradientSelector = document.getElementById("gradientSelector");
  const regionTableBody = document
    .getElementById("regionTable")
    .querySelector("tbody");
  const exportBtn = document.getElementById("exportMap");

  // Selectăm SVG și <g>
  const svg = d3.select("#mapSVG");
  const gMap = svg.select(".map-group");

  // Variabile globale
  let geoDataFeatures = [];
  let projection, path;

  // === Funcție: Încarcă fișier GeoJSON și randează-l ===
  function loadMap(geojsonFile) {
    d3.json(`data/${geojsonFile}`)
      .then((data) => {
        console.log("Loaded data for", geojsonFile, data);

        // Stocăm features
        geoDataFeatures = data.features;

        // Curățăm <path> existente (dacă schimbăm harta)
        gMap.selectAll("path").remove();

        // Creăm proiecție mercator și path
        projection = d3.geoMercator();
        path = d3.geoPath().projection(projection);

        // Dimensiuni SVG efective
        const svgWidth = +svg.style("width").replace("px", "");
        const svgHeight = +svg.style("height").replace("px", "");
        console.log("SVG Size:", svgWidth, svgHeight);

        // Calcul bounding box
        const bounds = path.bounds(data);
        const x0 = bounds[0][0],
              y0 = bounds[0][1],
              x1 = bounds[1][0],
              y1 = bounds[1][1];
        const widthGeo = x1 - x0;
        const heightGeo = y1 - y0;
        console.log("Bounds:", bounds, "widthGeo:", widthGeo, "heightGeo:", heightGeo);

        // Evităm scale Infinity dacă datele sunt corupte
        // Fallback la un scale fix, ex. 1000
        let scaleFallback = 1000;

        let scale = scaleFallback; // implicit
        let translateX = svgWidth / 2;
        let translateY = svgHeight / 2;

        // Verificăm daca bounding box e valid (fără Infinity / NaN)
        if (
          isFinite(widthGeo) &&
          isFinite(heightGeo) &&
          widthGeo > 0 &&
          heightGeo > 0
        ) {
          // Calcul scale auto
          scale =
            0.95 /
            Math.max(widthGeo / svgWidth, heightGeo / svgHeight);

          // Centrul bounding box
          const midX = (x0 + x1) / 2;
          const midY = (y0 + y1) / 2;

          translateX = svgWidth / 2 - scale * midX;
          translateY = svgHeight / 2 - scale * midY;
        } else {
          console.warn("Bounds invalid, use fallback scale:", scaleFallback);
        }

        // Aplicăm proiecția
        projection
          .scale(scale)
          .translate([translateX, translateY]);

        // Creăm path-urile
        gMap
          .selectAll("path")
          .data(geoDataFeatures)
          .enter()
          .append("path")
          .attr("d", path)
          .attr("fill", "#ccc")   // (se va actualiza la updateMapColors)
          .attr("stroke", "#fff")
          .attr("stroke-width", 1);

        // Generăm Tabel
        generateTable(geoDataFeatures);
        // Colorăm inițial
        updateMapColors();
      })
      .catch((err) => {
        console.error("Eroare la încărcarea fișierului:", err);
      });
  }

  // === Tabel cu regiuni + input numeric ===
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

    // Ascultăm modificări la input
    regionTableBody.querySelectorAll("input").forEach((inp) => {
      inp.addEventListener("input", updateMapColors);
    });
  }

  // === Funcție de colorare în funcție de gradient + value vs maxValue ===
  function getColor(value, maxValue, gradient) {
    if (!value || isNaN(value) || value <= 0) {
      return "#ccc"; // gri
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

  // === Actualizăm culorile poligoanelor pe baza inputurilor ===
  function updateMapColors() {
    if (!geoDataFeatures.length) return;

    // Aflăm valoarea max din tabel
    const inputs = regionTableBody.querySelectorAll("input[type='number']");
    const values = Array.from(inputs).map((i) => parseFloat(i.value) || 0);
    const maxValue = Math.max(...values, 1); // să nu fie 0

    const gradient = gradientSelector.value;

    // Parcurgem <path>-urile
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

  // === Buton de export (html2canvas pe .left-panel) ===
  exportBtn.addEventListener("click", () => {
    const mapElement = document.querySelector(".left-panel");

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

  // === Când se schimbă harta din <select> ===
  mapSelector.addEventListener("change", (e) => {
    loadMap(e.target.value);
  });

  // === Când se schimbă gradientul, recolorăm poligoanele ===
  gradientSelector.addEventListener("change", updateMapColors);

  // === Încărcare inițială cu "md.json" (Moldova) ===
  loadMap("md.json");
});
