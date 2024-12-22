document.addEventListener("DOMContentLoaded", () => {
  const mapSelector = document.getElementById("mapSelector");
  const exportButton = document.getElementById("exportMap");
  const svg = d3.select("#mapSVG");
  const gMap = svg.select(".map-group");

  // Setăm dimensiunile SVG
  const svgWidth = 800;
  const svgHeight = 600;

  svg.attr("viewBox", `0 0 ${svgWidth} ${svgHeight}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  // Funcție pentru a încărca și randa fișierul GeoJSON
  function loadMap(geojsonFile) {
    d3.json(`data/${geojsonFile}`).then((data) => {
      console.log("GeoJSON Loaded:", data);

      const projection = d3.geoMercator()
        .scale(3000) // Scale fix, ajustează valoarea
        .translate([svgWidth / 2, svgHeight / 2]);

      const path = d3.geoPath().projection(projection);

      // Ștergem vechile poligoane
      gMap.selectAll("path").remove();

      // Adăugăm noile poligoane
      gMap.selectAll("path")
        .data(data.features)
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
        });

      console.log("Harta încărcată:", geojsonFile);
    }).catch((err) => {
      console.error("Eroare la încărcarea GeoJSON:", err);
    });
  }

  // Funcție pentru a exporta harta ca PNG
  function exportMap() {
    html2canvas(document.querySelector(".map-column"), { useCORS: true })
      .then((canvas) => {
        const link = document.createElement("a");
        link.download = "harta.png";
        link.href = canvas.toDataURL("image/png");
        link.click();
      })
      .catch((err) => console.error("Export error:", err));
  }

  // Event listeners
  mapSelector.addEventListener("change", (e) => {
    loadMap(e.target.value);
  });

  exportButton.addEventListener("click", exportMap);

  // Încărcăm harta implicită
  loadMap("md.json");
});
