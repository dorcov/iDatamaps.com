// script.js

document.addEventListener("DOMContentLoaded", () => {
  // Referințe la elemente din HTML
  const mapSelector = document.getElementById("mapSelector");
  const gradientSelector = document.getElementById("gradientSelector");
  const regionTable = document.getElementById("regionTable").querySelector("tbody");
  const exportBtn = document.getElementById("exportMap");

  // SVG-ul care va conține harta
  const svg = d3.select("#mapSVG");
  // Grup (g) în care desenăm harta
  const gMap = svg.append("g").attr("class", "map-group");

  // Variabile globale
  let geoDataFeatures = []; // stocăm features pentru a le putea re-colora
  let projection, path;     // setăm la încărcarea hărții

  // Zoom recomandat / scale aproximativ pentru fiecare fișier (dacă vrei)
  // Vom folosi totuși boundingBox auto, dar îl putem ajusta
  const customScale = {
    "md.json": 1,
    "ro_judete_poligon.json": 1,
    "europe.geojson": 1
  };

  // === 1. Funcție încărcare GeoJSON și randare cu D3 ===
  function loadMap(geojsonFile) {
    d3.json(`data/${geojsonFile}`).then((data) => {
      // Salvează features pentru referințe ulterioare
      geoDataFeatures = data.features;

      // Ștergem orice path existent (dacă schimbăm harta)
      gMap.selectAll("path").remove();

      // Creăm un projection general (Mercator, de ex.)
      projection = d3.geoMercator();
      path = d3.geoPath().projection(projection);

      // Calculăm bounding box al GeoJSON-ului
      // d3.geoPath().bounds(data) returnează [[x0, y0], [x1, y1]]
      const bounds = path.bounds(data);

      // Dimensiunile containerului SVG
      const svgWidth = +svg.style("width").replace("px","");
      const svgHeight = +svg.style("height").replace("px","");

      // Lățimea / înălțimea shape-ului
      const widthGeo = bounds[1][0] - bounds[0][0];
      const heightGeo = bounds[1][1] - bounds[0][1];

      // Stabilim un scale astfel încât harta să încapă în SVG
      // un mic padding de 20 pixeli
      const scale = 0.95 / Math.max(widthGeo / svgWidth, heightGeo / svgHeight);

      // Centrul bounding box-ului
      const midX = (bounds[0][0] + bounds[1][0]) / 2;
      const midY = (bounds[0][1] + bounds[1][1]) / 2;

      // Setăm proiecția cu scale + translate
      projection
        .scale(scale * customScale[geojsonFile]) // eventual personalizăm
        .translate([
          svgWidth / 2 - scale * midX,
          svgHeight / 2 - scale * midY
        ]);

      // Acum desenăm shape-urile
      gMap
        .selectAll("path")
        .data(geoDataFeatures)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("fill", "#ccc")
        .attr("stroke", "#fff")
        .attr("stroke-width", 1)
        .on("mouseover", function() {
          d3.select(this).attr("stroke", "#000");
        })
        .on("mouseout", function() {
          d3.select(this).attr("stroke", "#fff");
        });

      // Generăm tabelul cu regiuni
      generateTable(geoDataFeatures);
      // Apoi colorăm harta inițial
      updateMapColors();
    })
    .catch((err) => {
      console.error("Eroare la încărcarea fișierului:", err);
    });
  }

  // === 2. Generăm tabelul cu regiuni, fiecare având un input numeric ===
  function generateTable(features) {
    regionTable.innerHTML = "";

    features.forEach((f) => {
      const props = f.properties;
      // Unele fișiere pot avea "NAME", "RAION", "name" etc.
      const regionName = props.NAME || props.RAION || props.name || "Unknown";

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${regionName}</td>
        <td>
          <input type="number" value="0" data-region="${encodeURIComponent(regionName)}" />
        </td>
      `;
      regionTable.appendChild(row);
    });

    // Când se modifică un input => recalculăm culorile
    regionTable.querySelectorAll("input").forEach((inp) => {
      inp.addEventListener("input", updateMapColors);
    });
  }

  // === 3. Funcție pentru returnarea unei culori în funcție de "value" & gradient ===
  function getColor(value, maxValue, gradient) {
    if (!value || isNaN(value) || value <= 0) {
      return "#ccc"; // gri pt lipsă / zero
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

  // === 4. Actualizăm culorile hărții pe baza valorilor din tabel ===
  function updateMapColors() {
    // Obținem toate valorile
    const inputs = regionTable.querySelectorAll("input[type='number']");
    const values = Array.from(inputs).map(inp => parseFloat(inp.value) || 0);
    const maxValue = Math.max(...values, 0);  // max de evitat -Infinity

    const gradient = gradientSelector.value;

    // Pentru fiecare path din gMap, determinăm regionName => input => fill
    gMap.selectAll("path").each(function(d) {
      const props = d.properties;
      const regionName = encodeURIComponent(
        props.NAME || props.RAION || props.name || "Unknown"
      );

      // Căutăm input-ul
      const inp = document.querySelector(`[data-region="${regionName}"]`);
      const val = inp ? parseFloat(inp.value) || 0 : 0;

      // Setăm fill color
      d3.select(this).attr("fill", getColor(val, maxValue, gradient));
    });
  }

  // === 5. Când se schimbă harta din <select>, încărcăm fișierul ===
  mapSelector.addEventListener("change", (e) => {
    loadMap(e.target.value);
  });

  // === 6. Când se schimbă gradientul, recolorăm harta ===
  gradientSelector.addEventListener("change", updateMapColors);

  // === 7. Buton de export (folosind html2canvas) ===
  exportBtn.addEventListener("click", () => {
    // Vizăm containerul stânga, care conține SVG-ul
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

  // === 8. Încărcare implicită la pornire (de ex. Moldova) ===
  loadMap("md.json");
});
