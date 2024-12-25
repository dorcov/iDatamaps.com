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
  const mapTitle = d3.select("#mapTitle");
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
    mapTitle.text(text || "Titlu Implicitar");
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

    generateLegend(); // Generează legenda după actualizarea listei de categorii
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

  // Funcție pentru a genera elementele legendei
  function generateLegend() {
    const legendItemsGroup = d3.select("#legendItems");
    legendItemsGroup.selectAll("*").remove(); // Curăță legenda existentă

    categories.forEach((category, index) => {
      const legendItem = legendItemsGroup.append("g")
        .attr("class", "legend-item")
        .attr("transform", `translate(10, ${30 + index * 30})`);

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

  // Funcționalitate Drag-and-Drop pentru Legendă și Sursa Datelor
  function makeLegendDraggable() {
    const legendGroup = d3.select("#legendGroup");
    const legendBackground = d3.select("#legendBackground");
    const dataSourceGroup = d3.select("#dataSourceGroup");
    const dataSourceBackground = dataSourceGroup.select("rect");
    const titleGroup = d3.select("#titleGroup");

    // Încarcă poziția salvată a legendei
    const savedLegendPosition = JSON.parse(localStorage.getItem("legendPosition"));
    if (savedLegendPosition) {
      legendGroup.attr("transform", `translate(${savedLegendPosition.x}, ${savedLegendPosition.y})`);
    } else {
      // Setează poziția inițială dacă nu există o poziție salvată
      legendGroup.attr("transform", `translate(20, 20)`);
    }

    // Încarcă poziția salvată a sursei datelor
    const savedDataSourcePosition = JSON.parse(localStorage.getItem("dataSourcePosition"));
    if (savedDataSourcePosition) {
      dataSourceGroup.attr("transform", `translate(${savedDataSourcePosition.x}, ${savedDataSourcePosition.y})`);
    } else {
      // Setează poziția inițială dacă nu există o poziție salvată
      dataSourceGroup.attr("transform", `translate(20, 550)`); // Ajustează după necesități
    }

    // Încarcă poziția salvată a titlului
    const savedTitlePosition = JSON.parse(localStorage.getItem("titlePosition"));
    if (savedTitlePosition) {
      titleGroup.attr("transform", `translate(${savedTitlePosition.x}, ${savedTitlePosition.y})`);
    } else {
      // Setează poziția inițială dacă nu există o poziție salvată
      titleGroup.attr("transform", `translate(20, 40)`); // Ajustează după necesități
    }

    // Drag pentru Legendă
    legendGroup.call(
      d3.drag()
        .on("start", (event) => {
          legendGroup.raise();
          legendGroup.attr("opacity", 0.8);
        })
        .on("drag", (event) => {
          legendGroup.attr("transform", `translate(${event.x}, ${event.y})`);
        })
        .on("end", (event) => {
          legendGroup.attr("opacity", 1);
          // Salvează poziția legendei
          localStorage.setItem("legendPosition", JSON.stringify({ x: event.x, y: event.y }));
        })
    );

    // Drag pentru Sursa Datelor
    dataSourceGroup.call(
      d3.drag()
        .on("start", (event) => {
          dataSourceGroup.raise();
          dataSourceGroup.attr("opacity", 0.8);
        })
        .on("drag", (event) => {
          dataSourceGroup.attr("transform", `translate(${event.x}, ${event.y})`);
        })
        .on("end", (event) => {
          dataSourceGroup.attr("opacity", 1);
          // Salvează poziția sursei datelor
          localStorage.setItem("dataSourcePosition", JSON.stringify({ x: event.x, y: event.y }));
        })
    );

    // Drag pentru Titlu
    titleGroup.call(
      d3.drag()
        .on("start", (event) => {
          titleGroup.raise();
          titleGroup.attr("opacity", 0.8);
        })
        .on("drag", (event) => {
          titleGroup.attr("transform", `translate(${event.x}, ${event.y})`);
        })
        .on("end", (event) => {
          titleGroup.attr("opacity", 1);
          // Salvează poziția titlului
          localStorage.setItem("titlePosition", JSON.stringify({ x: event.x, y: event.y }));
        })
    );

    // Funcționalitate pentru Edit Legend Title
    const editLegendTitle = d3.select("#editLegendTitle");
    editLegendTitle.on("click", () => {
      const currentTitle = d3.select("#legendTitle").text();
      const newTitle = prompt("Introdu noul titlu pentru legendă:", currentTitle);
      if (newTitle !== null && newTitle.trim() !== "") {
        d3.select("#legendTitle").text(newTitle.trim());
      }
    });

    // Funcționalitate pentru Delete Legend
    const deleteLegend = d3.select("#deleteLegend");
    deleteLegend.on("click", () => {
      if (confirm("Ești sigur că vrei să ștergi legenda?")) {
        legendGroup.selectAll("*").remove(); // Elimină toate elementele din legendă
        categories = []; // Șterge toate categoriile
        renderCategoryList(); // Actualizează lista de categorii
        updateMapColors(); // Recolorează harta
        localStorage.removeItem("legendPosition"); // Șterge poziția salvată
      }
    });
  }

  // Apelăm funcția pentru a face legenda, titlul și sursa de date draggable
  makeLegendDraggable();

  // Funcție pentru a genera tabelul cu regiuni
  // ... funcția generateTable este deja definită mai sus ...

  // Funcție pentru a genera elementele legendei
  // ... funcția generateLegend este deja definită mai sus ...

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

  // Funcționalitate pentru titlu
  // Actualizarea titlului în grupul SVG
  if (titleInput) {
    titleInput.addEventListener("input", () => {
      updateTitle(titleInput.value);
    });
  }

  // Funcționalitate pentru Sursa Datelor
  // ... funcția updateDataSource este deja definită mai sus ...

});
