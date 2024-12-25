document.addEventListener("DOMContentLoaded", () => {
  // Referințe la elementele DOM
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
  const dataSourceInput = document.getElementById("dataSource"); // Nou
  const mapTitle = document.getElementById("mapTitle");
  const dataSourceTextElement = d3.select("#dataSourceText"); // Nou

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

  // Funcție pentru a actualiza sursa datelor
  function updateDataSource(text) {
    dataSourceTextElement.text(`Sursa datelor: ${text || "N/A"}`);
    
    // După actualizarea textului, măsurăm dimensiunea textului
    setTimeout(() => { // Folosim setTimeout pentru a ne asigura că textul este actualizat în DOM
      const textElement = document.getElementById("dataSourceText");
      const bbox = textElement.getBBox();
      
      // Setăm lățimea dreptunghiului în funcție de lățimea textului + padding
      const padding = 20; // Ajustează padding-ul după necesități
      const newWidth = bbox.width + padding;
      
      // Actualizăm atributul width al rect-ului
      const rect = document.querySelector(".footer.data-source-group rect");
      rect.setAttribute("width", newWidth);
      
      // Poziționăm dreptunghiul astfel încât să înconjoare textul
      const x = parseFloat(dataSourceTextElement.attr("x")) - 10; // 10px padding stânga
      const y = parseFloat(dataSourceTextElement.attr("y")) - 14; // Ajustăm pentru vertical
      rect.setAttribute("x", x);
      rect.setAttribute("y", y);
      rect.setAttribute("height", 30); // Asigură o înălțime constantă
      
      // Opțional: Poți ajusta y în funcție de necesități
    }, 0);
  }

  // Verificare existență elemente înainte de a adăuga event listeners
  if (titleInput) {
    // Eveniment pentru actualizarea titlului din input
    titleInput.addEventListener("input", () => {
      updateTitle(titleInput.value);
    });
  } else {
    console.error("Elementul cu ID 'infographicTitle' nu a fost găsit.");
  }

  if (dataSourceInput) {
    // Eveniment pentru actualizarea sursei datelor din input
    dataSourceInput.addEventListener("input", () => {
      updateDataSource(dataSourceInput.value);
    });
  } else {
    console.error("Elementul cu ID 'dataSource' nu a fost găsit.");
  }

  if (mapTitle) {
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
  } else {
    console.error("Elementul cu ID 'mapTitle' nu a fost găsit.");
  }

  // Implementare drag-and-drop pentru sursa datelor
  if (dataSourceTextElement) {
    let isDraggingDataSource = false;
    let offsetXDataSource, offsetYDataSource;

    dataSourceTextElement.on("mousedown", function(event) {
      isDraggingDataSource = true;
      const bbox = this.getBBox();
      offsetXDataSource = event.clientX - bbox.x;
      offsetYDataSource = event.clientY - bbox.y;
    });

    d3.select("body").on("mousemove", function(event) {
      if (isDraggingDataSource) {
        const mapColumn = document.querySelector(".map-column");
        const rect = mapColumn.getBoundingClientRect();
        let x = event.clientX - rect.left - offsetXDataSource;
        let y = event.clientY - rect.top - offsetYDataSource;

        // Limitează poziția sursei datelor în interiorul hărții
        x = Math.max(0, Math.min(x, rect.width - dataSourceTextElement.node().getBBox().width - 10)); // 10 este padding-ul
        y = Math.max(20, Math.min(y, rect.height - 20)); // Minim y la 20 pentru a nu se suprapune cu marginile

        dataSourceTextElement.attr("x", x + 10); // Adaugă padding-ul stânga
        dataSourceTextElement.attr("y", y + 14); // Ajustează pentru vertical

        // Ajustăm și rect-ul
        const rectElement = document.querySelector(".footer.data-source-group rect");
        rectElement.setAttribute("x", x);
        rectElement.setAttribute("y", y);
      }
    });

    d3.select("body").on("mouseup", function() {
      isDraggingDataSource = false;
    });
  } else {
    console.error("Elementul cu ID 'dataSourceText' nu a fost găsit.");
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

  // Debounced update to improve performance
  const debouncedUpdateMapColors = debounce(updateMapColors, 300);

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

  if (applyGradientButton) {
    applyGradientButton.addEventListener("click", applyCustomGradient);
  } else {
    console.error("Elementul cu ID 'applyGradient' nu a fost găsit.");
  }

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

  if (presetGradientSelect) {
    presetGradientSelect.addEventListener("change", applyPresetGradient);
  } else {
    console.error("Elementul cu ID 'presetGradient' nu a fost găsit.");
  }

  // Funcții pentru gestionarea categoriilor
  function renderCategoryList() {
    if (!categoryList) {
      console.error("Elementul cu ID 'categoryList' nu a fost găsit.");
      return;
    }

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
        generateLegend(); // Actualizează legenda
        updateMapColors();
      });
    });
  }

  if (addCategoryButton) {
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
  } else {
    console.error("Elementul cu ID 'addCategory' nu a fost găsit.");
  }

  // Funcție pentru resetarea tuturor valorilor și categoriilor
  function resetAll() {
    if (!regionTableBody) {
      console.error("Elementul cu ID 'regionTable' nu a fost găsit.");
      return;
    }

    // Resetăm valorile din tabel
    regionTableBody.querySelectorAll("input").forEach(input => {
      input.value = 0;
    });

    // Resetăm selectele de categorii din tabel
    regionTableBody.querySelectorAll("select").forEach(select => {
      select.value = "";
    });

    // Resetăm gradientul la valorile implicite
    if (gradientStart && gradientEnd) {
      gradientStart.value = "#2A73FF";
      gradientEnd.value = "#2A73FF";
      currentGradient = {
        start: "#2A73FF",
        end: "#2A73FF"
      };
    }

    // Resetăm selecția presetată
    if (presetGradientSelect && gradientStart && gradientEnd) {
      presetGradientSelect.value = "";
      gradientStart.disabled = false;
      gradientEnd.disabled = false;
    }

    // Ștergem toate categoriile
    categories = [];
    renderCategoryList();

    // Actualizăm titlul la valoarea implicită
    if (titleInput) {
      updateTitle("");
      titleInput.value = "";
    }

    // Resetăm sursa datelor
    if (dataSourceInput) {
      updateDataSource("");
      dataSourceInput.value = "";
    }

    // Recolorăm harta
    updateMapColors();
  }

  if (resetButton) {
    // Adăugăm evenimentul de click pentru butonul de resetare
    resetButton.addEventListener("click", () => {
      if (confirm("Ești sigur că vrei să resetezi toate valorile și categoriile?")) {
        resetAll();
      }
    });
  } else {
    console.error("Elementul cu ID 'resetAll' nu a fost găsit.");
  }

  // Funcție pentru a colora regiunile
  function updateMapColors() {
    if (!regionTableBody) {
      console.error("Elementul cu ID 'regionTable' nu a fost găsit.");
      return;
    }

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

  // Funcție pentru a încărca harta
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
    if (!regionTableBody) {
      console.error("Elementul cu ID 'regionTable' nu a fost găsit.");
      return;
    }

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

    generateLegend(); // Generează legenda după actualizarea tabelului
  }

  // Actualizează opțiunile de categorie în tabel
  function updateCategoryOptions() {
    if (!regionTableBody) {
      console.error("Elementul cu ID 'regionTable' nu a fost găsit.");
      return;
    }

    regionTableBody.querySelectorAll("select").forEach((select) => {
      const currentValue = select.value;
      select.innerHTML = `<option value="">Selectează Categorie</option>` + 
        categories.map((cat, idx) => `<option value="${idx}">${cat.name}</option>`).join('');
      select.value = currentValue < categories.length ? currentValue : "";
    });
  }

  // Funcție pentru a obține culoarea unei regiuni
  function getFillColor(d) {
    const value = getRegionValue(d);
    const maxValue = Math.max(...Array.from(regionTableBody.querySelectorAll("input")).map(i => parseFloat(i.value) || 0), 1);
    const gradient = currentGradient;
    const category = getRegionCategory(d);
    if (category) {
      const categoryIndex = categories.findIndex(cat => cat.name === category);
      if (categoryIndex !== -1) {
        return categories[categoryIndex].color;
      }
    }
    return value > 0 ? getColor(value, maxValue, gradient) : "#ccc";
  }

  // Exportăm harta ca PNG
  if (exportButton) {
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
  } else {
    console.error("Elementul cu ID 'exportMap' nu a fost găsit.");
  }

  // Eveniment pentru schimbarea hărții
  if (mapSelector) {
    mapSelector.addEventListener("change", (e) => {
      loadMap(e.target.value);
    });
  } else {
    console.error("Elementul cu ID 'mapSelector' nu a fost găsit.");
  }

  // Încarcă harta selectată
  loadMap("md.json");

  // Funcție pentru a colora regiunile
  function updateMapColors() {
    if (!regionTableBody) {
      console.error("Elementul cu ID 'regionTable' nu a fost găsit.");
      return;
    }

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

  // Funcție pentru a genera elementele legendei
  function generateLegend() {
    const legendItemsGroup = d3.select("#legendItems");
    legendItemsGroup.selectAll("*").remove(); // Curăță legenda existentă

    categories.forEach((category, index) => {
      const legendItem = legendItemsGroup.append("g")
        .attr("class", "legend-item")
        .attr("transform", `translate(10, ${40 + index * 30})`);

      legendItem.append("rect")
        .attr("width", 20)
        .attr("height", 20)
        .attr("fill", category.color);

      legendItem.append("text")
        .attr("x", 30)
        .attr("y", 15)
        .attr("class", "legend-text")
        .text(category.name);
    });
  }

  // Funcționalitate Drag-and-Drop pentru Legendă
  function makeLegendDraggable() {
    const legendGroup = d3.select("#legendGroup");
    const legendBackground = d3.select("#legendBackground");

    // Încarcă poziția salvată
    const savedPosition = JSON.parse(localStorage.getItem("legendPosition"));
    if (savedPosition) {
      legendGroup.attr("transform", `translate(${savedPosition.x}, ${savedPosition.y})`);
    }

    let isDragging = false;
    let startX, startY;
    let initialX, initialY;

    legendGroup.on("mousedown", (event) => {
      isDragging = true;
      startX = event.clientX;
      startY = event.clientY;
      const transform = legendGroup.attr("transform") || "translate(0,0)";
      const translate = transform.match(/translate\(([^)]+)\)/)[1].split(",").map(Number);
      initialX = translate[0];
      initialY = translate[1];
    });

    d3.select("body").on("mousemove", (event) => {
      if (isDragging) {
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;
        let newX = initialX + dx;
        let newY = initialY + dy;

        // Limitări pentru a menține legenda în interiorul SVG-ului
        const svg = document.getElementById("mapSVG");
        const svgRect = svg.getBoundingClientRect();
        const legendRect = legendBackground.node().getBoundingClientRect();

        // Calcularea noii poziții relative în SVG
        newX = Math.max(0, Math.min(newX, svgRect.width - legendRect.width));
        newY = Math.max(0, Math.min(newY, svgRect.height - legendRect.height));

        legendGroup.attr("transform", `translate(${newX}, ${newY})`);

        // Salvează poziția în localStorage
        localStorage.setItem("legendPosition", JSON.stringify({ x: newX, y: newY }));
      }
    });

    d3.select("body").on("mouseup", () => {
      isDragging = false;
    });
  }

  // Funcție pentru a genera tabelul cu regiuni
  // ... funcția generateTable este deja definită mai sus ...

  // Funcție pentru a genera elementele legendei
  // ... funcția generateLegend este deja definită mai sus ...

  // Funcție pentru a face legenda draggable
  makeLegendDraggable();

  // Generăm lista de categorii inițială
  renderCategoryList();

  // Funcție pentru a controla vizibilitatea legendei
  const toggleLegendButton = d3.select("#toggleLegend");
  const legendGroupSelection = d3.select("#legendGroup");

  if (toggleLegendButton) {
    toggleLegendButton.on("click", () => {
      const isVisible = legendGroupSelection.attr("visibility") !== "hidden";
      legendGroupSelection.attr("visibility", isVisible ? "hidden" : "visible");
    });
  } else {
    console.error("Elementul cu ID 'toggleLegend' nu a fost găsit.");
  }

  // Functia de colorare a regiunilor trebuie apelata la generarea tabelului si adaugarea de categorii
});
