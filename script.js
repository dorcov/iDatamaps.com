document.addEventListener("DOMContentLoaded", () => {
  const mapSelector = document.getElementById("mapSelector");
  const tableBody = document.getElementById("tableBody");
  const svg = d3.select("#mapSVG");
  const mapGroup = svg.select("#mapGroup");

  const width = 800;
  const height = 600;

  svg.attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  let geoData = [];

  // Funcție pentru încărcarea hărții
  function loadMap(file) {
    d3.json(`data/${file}`).then((data) => {
      geoData = data.features;

      const projection = d3.geoMercator().fitSize([width, height], data);
      const path = d3.geoPath().projection(projection);

      mapGroup.selectAll("path").remove();

      mapGroup.selectAll("path")
        .data(geoData)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("fill", "#ccc")
        .attr("stroke", "#333")
        .on("mouseover", function (event, d) {
          d3.select(this).attr("fill", "#aaa");
        })
        .on("mouseout", function () {
          d3.select(this).attr("fill", "#ccc");
        });

      generateTable(geoData);
    });
  }

  // Funcție pentru generarea tabelului
  function generateTable(features) {
    tableBody.innerHTML = "";

    features.forEach((feature) => {
      const name = feature.properties.NAME || "Unknown";
      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${name}</td>
        <td><input type="number" value="0" data-region="${name}" /></td>
      `;

      tableBody.appendChild(row);
    });

    // Conectăm input-urile la funcția de colorare
    tableBody.querySelectorAll("input").forEach((input) => {
      input.addEventListener("input", updateMapColors);
    });
  }

  // Funcție pentru actualizarea culorilor hărții
  function updateMapColors() {
    const values = Array.from(tableBody.querySelectorAll("input")).map(
      (input) => parseFloat(input.value) || 0
    );

    const maxValue = Math.max(...values);

    mapGroup.selectAll("path").each(function (d) {
      const regionName = d.properties.NAME || "Unknown";
      const input = document.querySelector(`[data-region="${regionName}"]`);
      const value = input ? parseFloat(input.value) || 0 : 0;

      const color = d3.interpolateBlues(value / maxValue || 0);
      d3.select(this).attr("fill", color);
    });
  }

  // Eveniment pentru schimbarea hărții
  mapSelector.addEventListener("change", (event) => {
    loadMap(event.target.value);
  });

  // Încarcă harta implicită
  loadMap("md.json");
});
