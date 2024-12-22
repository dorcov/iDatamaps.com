document.addEventListener("DOMContentLoaded", () => {
  // Selectăm elementele HTML
  const mapSelector = document.getElementById("mapSelector");
  const gradientSelector = document.getElementById("gradientSelector");
  const regionTableBody = document
    .getElementById("regionTable")
    .querySelector("tbody");
  const exportBtn = document.getElementById("exportMap");

  // Overlay (pentru tooltips)
  const overlay = document.getElementById("mapOverlay");
  const hoverLabel = document.getElementById("hoverLabel");

  // Selectăm SVG-ul și grupul pentru harta
  const svg = d3.select("#mapSVG");
  const gMap = svg.select(".map-group");

  let geoDataFeatures = [];
  let projection, path;

  // === Încărcăm fișierul GeoJSON și facem rendering ===
  function loadMap(geojsonFile) {
    d3.json(`data/${geojsonFile}`)
      .then((data) => {
        // Stocăm features din GeoJSON
        geoDataFeatures = data.features;

        // Curățăm harta anterioară
        gMap.selectAll("path").remove();

        // Proiecția și path-ul D3
        projection = d3.geoMercator();
        path = d3.geoPath().projection(projection);

        // Dimensiuni SVG
        const svgWidth = +svg.style("width").replace("px", "");
        const svgHeight = +svg.style("height").replace("px", "");

        console.log("SVG Width/Height:", svgWidth, svgHeight);

        // Calculăm bounding box pentru geoData
        const bounds = path.bounds(data);
        const x0 = bounds[0][0],  y0 = bounds[0][1];
        const x1 = bounds[1][0],  y1 = bounds[1][1];
        const widthGeo = x1 - x0;
        const heightGeo = y1 - y0;
        
        console.log("Bounds:", bounds);

        // Fallback pentru scale, dacă bounding box-ul nu este valid
        let scale = 1000; // fallback fix pentru scaling
        let translateX = svgWidth / 2;
        let translateY = svgHeight / 2;

        if (
          isFinite(widthGeo) &&
          isFinite(heightGeo) &&
          widthGeo > 0 &&
          heightGeo > 0
        ) {
          // Calculăm scale pe baza dimensiunii hărții
          scale = 0.95 / Math.max(widthGeo / svgWidth, heightGeo / svgHeight);
          const midX = (x0 + x1) / 2;
          const midY = (y0 + y1) / 2;
          translateX = svgWidth / 2 - scale * midX;
          translateY = svgHeight / 2 - scale * midY;
        }

        // Aplicăm proiecția
        projection
          .scale(scale)
          .translate([translateX, translateY]);

        // Randează path-urile pentru fiecare județ
        gMap
          .selectAll("path")
          .data(geoDataFeatures)
          .enter()
          .append("path")
          .attr("d", path)
          .attr("fill", "#ccc")
          .attr("stroke", "#fff")
          .attr("stroke-width", 1)
          // Evenimente pentru hover - tooltip
          .on("mousemove", function (event, d) {
            const props = d.properties;
            const regionName = props.NAME || props.RAION || props.name || "Unknown";

            // Afișăm label-ul hover
            hoverLabel.style.display = "block";
            hoverLabel.textContent = regionName;

            // Poziționăm label-ul lângă cursor
            hoverLabel.style.left = event.pageX + 10 + "px";
            hoverLabel.style.top = event.pageY + 10 + "px";
          })
          .on("mouseleave", function () {
            hoverLabel.style.display = "none";
          });

        // Generăm tabelul cu regiuni
        generateTable(geoDataFeatures);

        // Colorează harta în funcție de valorile din tabel
        updateMapColors();
      })
      .catch((err) => {
        console.error("Eroare la încărcarea fișierului:", err);
      });
  }

  // === Creăm Tabelul cu valori pentru fiecare regiune ===
  function generateTable(features) {
    regionTableBody.innerHTML = "";

    features.forEach((f) => {
      const props = f.properties;
      const regionName = props.NAME || props.RAION || props.name || "Unknown";

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${regionName}</td>
        <td>
          <input type="number" value="0" data-region="${encodeURIComponent(regionName)}" />
        </td>
      `;
      regionTableBody.appendChild(row);
    });

    // Când se modifică input-ul, se recolorează harta
    regionTableBody.querySelectorAll("input").forEach((inp) => {
      inp.addEventListener("input", updateMapColors);
    });
  }

  // === Funcție de colorare a regiunilor în funcție de valori ===
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

  // === Actualizăm culorile regiunilor pe hartă ===
  function updateMapColors() {
    if (!geoDataFeatures.length) return;

    const inputs = regionTableBody.querySelectorAll("input[type='number']");
    const values = Array.from(inputs).map((i) => parseFloat(i.value) || 0);
    const maxValue = Math.max(...values, 1); // evităm zero

    const gradient = gradientSelector.value;

    gMap.selectAll("path").each(function (d) {
      const props = d.properties;
      const regionName = encodeURIComponent(props.NAME || props.RAION || props.name || "Unknown");
      const inp = document.querySelector(`[data-region="${regionName}"]`);
      const val = inp ? parseFloat(inp.value) || 0 : 0;

      const fillColor = getColor(val, maxValue, gradient);
      d3.select(this).attr("fill", fillColor);
    });
  }

  // === Funcție de Export la PNG (html2canvas) ===
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

  // === Când se schimbă harta (din select) ===
  mapSelector.addEventListener("change", (e) => {
    loadMap(e.target.value);
  });

  // === Când se schimbă gradientul (recolorare harta) ===
  gradientSelector.addEventListener("change", updateMapColors);

  // === Încărcare implicită cu "md.json" (Moldova) ===
  loadMap("md.json");
});
