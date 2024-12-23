document.addEventListener("DOMContentLoaded", () => {
  const mapSelector = document.getElementById("mapSelector");
  const gradientStart = document.getElementById("gradientStart");
  const gradientEnd = document.getElementById("gradientEnd");
  const applyGradientButton = document.getElementById("applyGradient");
  const presetGradientSelect = document.getElementById("presetGradient");
  const regionTableBody = document.getElementById("regionTable").querySelector("tbody");
  const exportButton = document.getElementById("exportMap");
  const resetButton = document.getElementById("resetAll");
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

  // Gestionarea categoriilor
  let categories = [];

  const newCategoryName = document.getElementById("newCategoryName");
  const newCategoryColor = document.getElementById("newCategoryColor");
  const addCategoryButton = document.getElementById("addCategory");
  const categoryList = document.getElementById("categoryList");

  // Lista de gradienturi presetate
  const presetGradients = {
    blueGreen: { start: "#2A73FF", end: "#00FF7F" },     // Albastru la Verde
    redYellow: { start: "#FF0000", end: "#FFFF00" },    // Roșu la Galben
    purplePink: { start: "#800080", end: "#FFC0CB" },    // Mov la Roz
    orangeBlue: { start: "#FFA500", end: "#0000FF" },    // Portocaliu la Albastru
    grey: { start: "#808080", end: "#D3D3D3" }          // Gri
  };

  // Declararea tooltip-ului o singură dată
  const tooltip = d3.select(".tooltip");

  // Funcție pentru a actualiza titlul
  function updateTitle(text) {
    mapTitle.textContent = text || "Titlu Implicitar";
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
    const bbox = mapTitle.getBBox();
    offsetX = e.clientX - bbox.x;
    offsetY = e.clientY - bbox.y;
  });

  document.addEventListener("mousemove", (e) => {
    if (isDragging) {
      const mapColumn = document.querySelector(".map-column");
      const rect = mapColumn.getBoundingClientRect();
      let x = e.clientX - rect.left - offsetX;
      let y = e.clientY - rect.top - offsetY;

      // Limitează poziția titlului în interiorul hărții
      x = Math.max(0, Math.min(x, rect.width - mapTitle.getBBox().width));
      y = Math.max(20, Math.min(y, rect.height - 20)); // Minim y la 20 pentru a nu se suprapune cu marginile

      mapTitle.setAttribute("x", x);
      mapTitle.setAttribute("y", y);
    }
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
  });

  // Funcție pentru a aplica gradientul personalizat
  function applyCustomGradient() {
    // Resetează selecția presetată
    presetGradientSelect.value = "";
    gradientStart.disabled = false;
    gradientEnd.disabled = false;
    currentGradient.start = gradientStart.value;
    currentGradient.end = gradientEnd.value;
    updateMapColors();
  }

  applyGradientButton.addEventListener("click", applyCustomGradient);

  // Funcție pentru a aplica gradientul presetat
  function applyPresetGradient() {
    const selectedPreset = presetGradientSelect.value;
    if (selectedPreset && presetGradients[selectedPreset]) {
      currentGradient.start = presetGradients[selectedPreset].start;
      currentGradient.end = presetGradients[selectedPreset].end;
      // Actualizează valorile color pickers pentru a reflecta gradientul presetat
      gradientStart.value = currentGradient.start;
      gradientEnd.value = currentGradient.end;
      // Dezactivează color pickers dacă un gradient presetat este selectat
      gradientStart.disabled = true;
      gradientEnd.disabled = true;
      updateMapColors();
    } else {
      // Dacă nu se selectează niciun gradient presetat, activează color pickers
      gradientStart.disabled = false;
      gradientEnd.disabled = false;
      // Reset gradient la valorile personalizate
      currentGradient.start = gradientStart.value;
      currentGradient.end = gradientEnd.value;
      updateMapColors();
    }
  }

  presetGradientSelect.addEventListener("change", applyPresetGradient);

  // Funcții pentru gestionarea categoriilor
  function renderCategoryList() {
    categoryList.innerHTML = "";
    categories.forEach((category, index) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <div class="category-color" style="background-color: ${category.color};"></div>
        <span class="category-item">${category.name}</span>
        <button class="delete-category" data-index="${index}">Șterge</button>
      `;
      categoryList.appendChild(li);
    });

    // Adaugă evenimente pentru butoanele de ștergere
    document.querySelectorAll(".delete-category").forEach(button => {
      button.addEventListener("click", (e) => {
        const index = e.target.getAttribute("data-index");
        categories.splice(index, 1);
        renderCategoryList();
        generateTable(geoDataFeatures); // Regenerează tabelul pentru a actualiza opțiunile de categorie
        updateMapColors();
      });
    });
  }

  addCategoryButton.addEventListener("click", () => {
    const name = newCategoryName.value.trim();
    const color = newCategoryColor.value;
    if (name === "") {
      alert("Numele categoriei nu poate fi gol.");
      return;
    }
    categories.push({ name, color });
    newCategoryName.value = "";
    newCategoryColor.value = "#FF5733"; // Resetare la o culoare default
    renderCategoryList();
    generateTable(geoDataFeatures); // Regenerează tabelul pentru a actualiza opțiunile de categorie
    updateMapColors();
  });

  // Funcție pentru resetarea tuturor valorilor și categoriilor
  function resetAll() {
    // Resetăm valorile din tabel
    regionTableBody.querySelectorAll("input").forEach(input => {
      input.value = 0;
    });

    // Resetăm selectele de categorii din tabel
    regionTableBody.querySelectorAll("select").forEach(select => {
      select.value = "";
    });

    // Resetăm gradientul la valorile implicite
    gradientStart.value = "#2A73FF";
    gradientEnd.value = "#2A73FF";
    currentGradient = {
      start: "#2A73FF",
      end: "#2A73FF"
    };

    // Resetăm selecția presetată
    presetGradientSelect.value = "";
    gradientStart.disabled = false;
    gradientEnd.disabled = false;

    // Ștergem toate categoriile
    categories = [];
    renderCategoryList();

    // Actualizăm titlul la valoarea implicită
    updateTitle("");
    titleInput.value = "";

    // Recolorăm harta
    updateMapColors();
  }

  // Adăugăm evenimentul de click pentru butonul de resetare
  resetButton.addEventListener("click", () => {
    if (confirm("Ești sigur că vrei să resetezi toate valorile și categoriile?")) {
      resetAll();
    }
  });

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
          showTooltip(event, d);
        })
        .on("mousemove", function (event) {
          moveTooltip(event);
        })
        .on("mouseout", function (event, d) {
          d3.select(this).attr("fill", getFillColor(d));
          hideTooltip();
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
        <td class="select-category">
          <select data-region="${encodeURIComponent(regionName)}">
            <option value="">Selectează Categorie</option>
            ${categories.map((cat, idx) => `<option value="${idx}">${cat.name}</option>`).join('')}
          </select>
        </td>
      `;
      regionTableBody.appendChild(row);
    });

    // Adaugă evenimente pentru noile select-uri de categorii
    regionTableBody.querySelectorAll("select").forEach((select) => {
      select.addEventListener("change", updateMapColors);
    });

    // Eveniment la modificarea valorilor din tabel
    regionTableBody.querySelectorAll("input").forEach((input) => {
      input.addEventListener("input", debouncedUpdateMapColors);
    });
  }

  // Actualizează opțiunile de categorie în tabel
  function updateCategoryOptions() {
    regionTableBody.querySelectorAll("select").forEach((select) => {
      const currentValue = select.value;
      select.innerHTML = `<option value="">Selectează Categorie</option>` + 
        categories.map((cat, idx) => `<option value="${idx}">${cat.name}</option>`).join('');
      select.value = currentValue < categories.length ? currentValue : "";
    });
  }

  // Debounced update to improve performance
  const debouncedUpdateMapColors = debounce(updateMapColors, 300);

  // Funcție pentru a colora regiunile
  function updateMapColors() {
    const inputs = regionTableBody.querySelectorAll("input");
    const selects = regionTableBody.querySelectorAll("select");
    const values = Array.from(inputs).map((input) => parseFloat(input.value) || 0);
    const maxValue = Math.max(...values, 1); // Evităm zero

    gMap.selectAll("path").each(function (d) {
      const regionName = encodeURIComponent(d.properties.NAME || d.properties.name || "Unknown");
      const input = document.querySelector(`[data-region="${regionName}"]`);
      const select = document.querySelector(`select[data-region="${regionName}"]`);
      const value = input ? parseFloat(input.value) || 0 : 0;
      const categoryIndex = select ? select.value : "";

      if (categoryIndex !== "" && categories[categoryIndex]) {
        // Dacă este selectată o categorie, folosește culoarea categoriei
        const categoryColor = categories[categoryIndex].color;
        d3.select(this).attr("fill", categoryColor);
      } else if (value > 0) {
        // Folosește gradientul personalizat sau presetat
        const fillColor = getColor(value, maxValue, currentGradient);
        d3.select(this).attr("fill", fillColor);
      } else {
        d3.select(this).attr("fill", "#ccc"); // Gri pentru valoare 0 sau lipsă
      }
    });
  }

  // Calculăm culoarea pe baza gradientului personalizat sau presetat
  function getColor(value, maxValue, gradient) {
    const ratio = value / maxValue;

    // Interpolare între culorile start și end
    const startColor = d3.color(gradient.start);
    const endColor = d3.color(gradient.end);
    const interpolatedColor = d3.interpolateRgb(startColor, endColor)(ratio);

    return interpolatedColor.toString();
  }

  // Funcționalitate Tooltip
  function showTooltip(event, d) {
    const regionName = d.properties.NAME || d.properties.name || "Unknown";
    const value = getRegionValue(d);
    const category = getRegionCategory(d);
    tooltip.style("visibility", "visible")
           .html(`<strong>${regionName}</strong><br/>Valoare: ${value}<br/>Categorie: ${category || "N/A"}`);
  }

  function moveTooltip(event) {
    tooltip.style("top", (event.pageY - 10) + "px")
           .style("left", (event.pageX + 10) + "px");
  }

  function hideTooltip() {
    tooltip.style("visibility", "hidden");
  }

  // Funcție pentru a obține valoarea unei regiuni
  function getRegionValue(d) {
    const regionName = encodeURIComponent(d.properties.NAME || d.properties.name || "Unknown");
    const input = document.querySelector(`[data-region="${regionName}"]`);
    return input ? parseFloat(input.value) || 0 : 0;
  }

  // Funcție pentru a obține categoria unei regiuni
  function getRegionCategory(d) {
    const regionName = encodeURIComponent(d.properties.NAME || d.properties.name || "Unknown");
    const select = document.querySelector(`select[data-region="${regionName}"]`);
    if (select && select.value !== "" && categories[select.value]) {
      return categories[select.value].name;
    }
    return "";
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

  // Încarcă harta inițială
  loadMap("md.json");
});
