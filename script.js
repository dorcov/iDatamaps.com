document.addEventListener("DOMContentLoaded", () => {
  const mapSelector = document.getElementById("mapSelector");
  const gradientSelector = document.getElementById("gradientSelector");
  const regionTableBody = document.getElementById("regionTable").querySelector("tbody");
  const exportButton = document.getElementById("exportMap");
  const exportPDFButton = document.getElementById("exportPDF");
  const svg = d3.select("#mapSVG");
  const gMap = svg.select(".map-group");
  const titleInput = document.getElementById("infographicTitle");
  const subtitleInput = document.getElementById("infographicSubtitle");
  const customColorStart = document.getElementById("customColorStart");
  const customColorEnd = document.getElementById("customColorEnd");
  const applyCustomGradientButton = document.getElementById("applyCustomGradient");
  const dataFilter = document.getElementById("dataFilter");
  const saveButton = document.getElementById("saveInfographic");
  const loadInput = document.getElementById("loadInfographic");

  const svgWidth = 800;
  const svgHeight = 600;

  svg.attr("viewBox", `0 0 ${svgWidth} ${svgHeight}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  let geoDataFeatures = [];
  let currentGeoJSONFile = "md.json"; // Inițial setat

  // Creează elemente SVG pentru titlu și subtitlu
  svg.append("text")
    .attr("id", "mapTitle")
    .attr("x", svgWidth / 2)
    .attr("y", 30)
    .attr("text-anchor", "middle")
    .attr("font-size", "24px")
    .attr("font-weight", "bold")
    .text("Default Title");

  svg.append("text")
    .attr("id", "mapSubtitle")
    .attr("x", svgWidth / 2)
    .attr("y", 60)
    .attr("text-anchor", "middle")
    .attr("font-size", "16px")
    .attr("fill", "#666")
    .text("Default Subtitle");

  // Creează un div pentru tooltip
  const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("visibility", "hidden");

  // Încărcăm harta selectată
  function loadMap(geojsonFile) {
    currentGeoJSONFile = geojsonFile;
    d3.json(`data/${geojsonFile}`).then((data) => {
      console.log(`Loaded GeoJSON (${geojsonFile}):`, data);

      if (!data || !data.features) {
        console.error("GeoJSON invalid sau lipsă features.");
        return;
      }

      geoDataFeatures = data.features;

      // Alege proiecția în funcție de selecție
      let projection;
      switch (projectionSelector.value) {
        case "orthographic":
          projection = d3.geoOrthographic()
            .scale(300)
            .translate([svgWidth / 2, svgHeight / 2])
            .clipAngle(90);
          break;
        case "albers":
          projection = d3.geoAlbers()
            .center([0, 55.4])
            .rotate([4.4, 0])
            .parallels([50, 60])
            .scale(800)
            .translate([svgWidth / 2, svgHeight / 2]);
          break;
        case "mercator":
        default:
          projection = d3.geoMercator()
            .fitSize([svgWidth, svgHeight], data);
          break;
      }

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
          tooltip.style("visibility", "visible")
            .html(`<strong>${d.properties.NAME || d.properties.name}</strong><br/>Value: ${getRegionValue(d)}`);
        })
        .on("mousemove", function (event) {
          tooltip
            .style("top", (event.pageY - 10) + "px")
            .style("left", (event.pageX + 10) + "px");
        })
        .on("mouseout", function (event, d) {
          d3.select(this).attr("fill", getFillColor(d));
          tooltip.style("visibility", "hidden");
        });

      generateTable(data.features);
      updateMapColors();
      applyFilter(); // Aplică filtrul curent după încărcarea hărții
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
      input.addEventListener("input", debouncedUpdateMapColors);
    });
  }

  // Debounced update to improve performance
  const debouncedUpdateMapColors = debounce(updateMapColors, 300);

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

      if (value > 0) {
        const fillColor = getColor(value, maxValue, gradient);
        d3.select(this).attr("fill", fillColor);
      } else {
        d3.select(this).attr("fill", "#ccc"); // Gri pentru valoare 0 sau lipsă
      }
    });

    // Adaugă sau actualizează etichetele
    gMap.selectAll("text.region-label").remove(); // Curăță etichetele existente

    gMap.selectAll("path")
      .filter(d => parseFloat(document.querySelector(`[data-region="${encodeURIComponent(d.properties.NAME || d.properties.name || "Unknown")}"]`).value) > 0)
      .each(function (d) {
        const centroid = path.centroid(d);
        const value = getRegionValue(d);

        gMap.append("text")
          .attr("class", "region-label")
          .attr("x", centroid[0])
          .attr("y", centroid[1])
          .attr("text-anchor", "middle")
          .attr("font-size", "10px")
          .attr("fill", "#000")
          .text(value);
      });

    // Actualizează legenda
    updateLegend(maxValue, gradient);
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

  // Funcție pentru a obține valoarea unei regiuni
  function getRegionValue(d) {
    const regionName = encodeURIComponent(d.properties.NAME || d.properties.name || "Unknown");
    const input = document.querySelector(`[data-region="${regionName}"]`);
    return input ? parseFloat(input.value) || 0 : 0;
  }

  // Funcție pentru a obține culoarea unei regiuni
  function getFillColor(d) {
    const value = getRegionValue(d);
    const maxValue = Math.max(...Array.from(regionTableBody.querySelectorAll("input")).map(i => parseFloat(i.value) || 0), 1);
    const gradient = gradientSelector.value;
    return value > 0 ? getColor(value, maxValue, gradient) : "#ccc";
  }

  // Funcție pentru a actualiza legenda
  function updateLegend(maxValue, gradient) {
    const legendWidth = 200;
    const legendHeight = 20;

    const legendSVG = d3.select("#legendSVG");
    legendSVG.selectAll("*").remove(); // Curăță legenda existentă

    const gradientDef = legendSVG.append("defs")
      .append("linearGradient")
      .attr("id", "legendGradient")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "100%")
      .attr("y2", "0%");

    // Definește culorile gradientului în funcție de selecție
    switch (gradient) {
      case "blue":
        gradientDef
          .append("stop")
          .attr("offset", "0%")
          .attr("stop-color", "rgba(42, 115, 255, 0.3)");
        gradientDef
          .append("stop")
          .attr("offset", "100%")
          .attr("stop-color", "rgba(42, 115, 255, 1)");
        break;
      case "green":
        gradientDef
          .append("stop")
          .attr("offset", "0%")
          .attr("stop-color", "rgba(50, 200, 50, 0.3)");
        gradientDef
          .append("stop")
          .attr("offset", "100%")
          .attr("stop-color", "rgba(50, 200, 50, 1)");
        break;
      case "red":
        gradientDef
          .append("stop")
          .attr("offset", "0%")
          .attr("stop-color", "rgba(255, 50, 50, 0.3)");
        gradientDef
          .append("stop")
          .attr("offset", "100%")
          .attr("stop-color", "rgba(255, 50, 50, 1)");
        break;
      case "blueDiverging":
        gradientDef
          .append("stop")
          .attr("offset", "0%")
          .attr("stop-color", "rgba(255, 50, 50, 1)");
        gradientDef
          .append("stop")
          .attr("offset", "50%")
          .attr("stop-color", "rgba(42, 115, 255, 0.3)");
        gradientDef
          .append("stop")
          .attr("offset", "100%")
          .attr("stop-color", "rgba(42, 115, 255, 1)");
        break;
      default:
        gradientDef
          .append("stop")
          .attr("offset", "0%")
          .attr("stop-color", "#ccc");
        gradientDef
          .append("stop")
          .attr("offset", "100%")
          .attr("stop-color", "#ccc");
    }

    // Adaugă un dreptunghi care folosește gradientul definit
    legendSVG.append("rect")
      .attr("x", 0)
      .attr("y", 10)
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .style("fill", "url(#legendGradient)");

    // Adaugă text pentru maxim și minim
    legendSVG.append("text")
      .attr("x", 0)
      .attr("y", 45)
      .attr("font-size", "12px")
      .text("0");

    legendSVG.append("text")
      .attr("x", legendWidth)
      .attr("y", 45)
      .attr("font-size", "12px")
      .attr("text-anchor", "end")
      .text(maxValue);
  }

  // Funcție pentru aplicarea filtrului
  function applyFilter() {
    const filterValue = dataFilter.value;
    gMap.selectAll("path")
      .attr("opacity", function(d) {
        const value = getRegionValue(d);
        if (filterValue === "above50" && value > 50) return 1;
        if (filterValue === "below50" && value <= 50) return 1;
        if (filterValue === "all") return 1;
        return 0.3; // Opacitate redusă pentru neconforme
      });
  }

  // Funcție de debouncing pentru îmbunătățirea performanței
  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      const later = () => {
        clearTimeout(timeout);
        func.apply(this, args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Event listener pentru titlu
  titleInput.addEventListener("input", () => {
    const title = titleInput.value || "Default Title";
    svg.select("#mapTitle").text(title);
  });

  // Event listener pentru subtitlu
  subtitleInput.addEventListener("input", () => {
    const subtitle = subtitleInput.value || "Default Subtitle";
    svg.select("#mapSubtitle").text(subtitle);
  });

  // Event listener pentru gradientul personalizat
  applyCustomGradientButton.addEventListener("click", () => {
    const startColor = customColorStart.value;
    const endColor = customColorEnd.value;
    
    // Creează un nou gradient personalizat
    const legendSVG = d3.select("#legendSVG");
    const legendDef = legendSVG.select("defs");
    if (legendDef.empty()) {
      legendDef = legendSVG.append("defs");
    }
    
    legendDef.select("#legendGradient").remove(); // Elimină gradientul existent
    
    const newGradient = legendDef.append("linearGradient")
      .attr("id", "legendGradient")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "100%")
      .attr("y2", "0%");

    newGradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", startColor);
    
    newGradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", endColor);

    // Actualizează harta și legenda
    updateMapColors();
  });

  // Event listener pentru schimbarea gradientului
  gradientSelector.addEventListener("change", () => {
    updateMapColors();
  });

  // Event listener pentru schimbarea proiecției
  const projectionSelector = document.getElementById("projectionSelector");
  projectionSelector.addEventListener("change", () => {
    loadMap(currentGeoJSONFile);
  });

  // Event listener pentru filtrare
  dataFilter.addEventListener("change", () => {
    applyFilter();
  });

  // Event listener pentru salvare
  saveButton.addEventListener("click", () => {
    const dataToSave = {
      title: titleInput.value,
      subtitle: subtitleInput.value,
      gradient: gradientSelector.value,
      regions: Array.from(regionTableBody.querySelectorAll("input")).map(input => ({
        region: decodeURIComponent(input.getAttribute("data-region")),
        value: parseFloat(input.value) || 0
      }))
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataToSave));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "infographic.json");
    document.body.appendChild(downloadAnchorNode); // Necesar pentru Firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  });

  // Event listener pentru încărcare
  loadInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const data = JSON.parse(e.target.result);
        titleInput.value = data.title || "";
        subtitleInput.value = data.subtitle || "";
        gradientSelector.value = data.gradient || "blue";
        
        data.regions.forEach(regionData => {
          const encodedRegion = encodeURIComponent(regionData.region);
          const input = document.querySelector(`[data-region="${encodedRegion}"]`);
          if (input) input.value = regionData.value;
        });

        updateMapColors();
      } catch (err) {
        alert("Invalid JSON file!");
      }
    };
    reader.readAsText(file);
  });

  // Funcție pentru export PDF
  exportPDFButton.addEventListener("click", () => {
    html2canvas(document.querySelector(".container"), { useCORS: true })
      .then((canvas) => {
        const imgData = canvas.toDataURL("image/png");
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'px',
          format: [canvas.width, canvas.height]
        });
        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
        pdf.save("infographic.pdf");
      })
      .catch((err) => console.error("Export PDF error:", err));
  });

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

  // Încarcă harta inițială
  loadMap("md.json");
});
