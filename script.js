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

  // Declararea tooltip-ului
  const tooltip = d3.select(".tooltip");

  // Add these variables at the top with other declarations
  let selectedTextBox = null;
  const mapContainer = document.querySelector('.map-column');

  // Adăugăm un nou grup pentru legenda numerică, ascuns by default
  const numericLegendGroup = svg.append("g")
    .attr("id", "numericLegendGroup")
    .attr("class", "legend-group")
    .attr("visibility", "hidden"); // implicit ascuns

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
        generateBothLegends(); // Actualizează legenda
        updateMapColors();
      });
    });

    generateBothLegends(); // Generează legenda după actualizarea listei de categorii
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
      const regionName = encodeURIComponent(d.properties.NAME || d.properties.name || d.properties.region_nam ||d.properties.nume_regiu || "Unknown");
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

    generateBothLegends();
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
    const regionName = d.properties.NAME || d.properties.name || d.properties.region_nam ||d.properties.nume_regiu || "Unknown";
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
    const regionName = encodeURIComponent(d.properties.NAME || d.properties.name ||d.properties.region_nam || d.properties.nume_regiu ||"Unknown");
    const input = document.querySelector(`[data-region="${regionName}"]`);
    return input ? parseFloat(input.value) || 0 : 0;
  }

  // Funcție pentru a obține categoria unei regiuni
  function getRegionCategory(d) {
    const regionName = encodeURIComponent(d.properties.NAME || d.properties.name ||d.properties.region_nam ||d.properties.nume_regiu || "Unknown");
    const select = document.querySelector(`select[data-region="${regionName}"]`);
    if (select && select.value !== "" && categories[select.value]) {
      return categories[select.value].name;
    }
    return "";
  }

  // Funcție pentru a încărca harta
  function loadMap(geojsonFile) {
    console.log(`Încerc să încarc GeoJSON: data/${geojsonFile}`);
    d3.json(`data/${geojsonFile}`).then((data) => {
      console.log(`Harta ${geojsonFile} a fost încărcată cu succes.`);

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
      console.error(`Eroare la încărcarea GeoJSON (${geojsonFile}):`, err);
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
      const regionName = feature.properties.NAME || feature.properties.name || feature.properties.region_nam ||feature.properties.nume_regiu || "Unknown";
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
      input.addEventListener("input", () => {
        debouncedUpdateMapColors();
        generateBothLegends();
      });
    });

    generateBothLegends(); // Generează legenda după actualizarea tabelului
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
    d3.select("#legendGroup").raise(); // Aduce legendGroup în față

    // If there are no categories, force legend visibility:
    if (!categories.length) {
      d3.select("#legendGroup").attr("visibility", "visible");
      localStorage.setItem("legendVisibility", "visible");
    }
  }

  // Funcție nouă pentru afișarea legendei numerice
  function generateNumericLegend() {
    numericLegendGroup.selectAll("*").remove();

    // Calculează valorile minime și maxime din tabel
    const inputs = regionTableBody.querySelectorAll("input");
    const values = Array.from(inputs).map((i) => parseFloat(i.value) || 0);
    if (!values.length) return;

    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);

    // Creăm fundal
    numericLegendGroup.append("rect")
      .attr("id", "numericLegendBackground")
      .attr("x", 0).attr("y", 0)
      .attr("width", 180).attr("height", 60)
      .attr("rx", 4).attr("ry", 4)
      .attr("fill", "rgba(255, 255, 255, 0.5)");

    // Definim un gradient liniar
    const gradientID = "numericGradient2";
    const defs = numericLegendGroup.append("defs")
      .append("linearGradient")
      .attr("id", gradientID)
      .attr("x1", "0%").attr("x2", "100%")
      .attr("y1", "0%").attr("y2", "0%");
    defs.selectAll("stop")
      .data([
        { offset: "0%", color: currentGradient.start },
        { offset: "100%", color: currentGradient.end }
      ])
      .enter()
      .append("stop")
      .attr("offset", d => d.offset)
      .attr("stop-color", d => d.color);

    // Bara de gradient numeric
    numericLegendGroup.append("rect")
      .attr("x", 10).attr("y", 20)
      .attr("width", 120).attr("height", 10)
      .style("fill", `url(#${gradientID})`);

    // Valorile Min și Max
    numericLegendGroup.append("text")
      .attr("x", 10).attr("y", 40)
      .text("Min: " + minValue);
    numericLegendGroup.append("text")
      .attr("x", 130).attr("y", 40)
      .style("text-anchor", "end")
      .text("Max: " + maxValue);
    
    numericLegendGroup.raise(); // Aduce numericLegendGroup în față

    // Adăugăm un mâner (handle) pentru redimensionare
    numericLegendGroup.append("rect")
      .attr("id", "numericResizeHandle")
      .attr("x", 130) // Valoare inițială aprox. la capătul barei
      .attr("y", 17)
      .attr("width", 10)
      .attr("height", 16)
      .style("cursor", "ew-resize")
      .attr("fill", "#333");

    // Funcție pentru redimensionarea barei de gradient numeric
    const resizeDrag = d3.drag()
      .on("start", (event) => {
        d3.select("#numericResizeHandle").raise();
      })
      .on("drag", (event) => {
        const newWidth = Math.max(20, Math.min(event.x - 10, 300));
        // Ajustăm dimensiunea rect ului
        numericLegendGroup.select("rect[width='120']").attr("width", newWidth);
        // Ajustăm poziția mânerului
        d3.select("#numericResizeHandle").attr("x", newWidth + 10);
      });

    d3.select("#numericResizeHandle").call(resizeDrag);

    // Adaugă buton de ștergere (acum doar ascunde legenda)
    numericLegendGroup.append("text")
      .attr("id", "deleteNumericLegend")
      .attr("x", 160)
      .attr("y", 15)
      .style("cursor", "pointer")
      .text("🗑️");

    d3.select("#deleteNumericLegend").on("click", () => {
      numericLegendGroup.attr("visibility", "hidden");
      localStorage.setItem("numericLegendVisible", "hidden");
    });
  }

  // Afișăm ambele legende după ce actualizăm tabelul/gradientul
  function generateBothLegends() {
    generateLegend();
    generateNumericLegend();
  }

  // Funcționalitate Drag-and-Drop pentru Legendă, Titlu și Sursa Datelor
  function makeElementsDraggable() {
    const legendGroup = d3.select("#legendGroup");

    // Definirea comportamentului de zoom
    const zoom = d3.zoom()
      .scaleExtent([0.5, 8]) // Intervalul de zoom: de la 0.5 (normal) la 8 (mărire maximă)
      .on("zoom", zoomed);

    // Aplicarea comportamentului de zoom la SVG
    svg.call(zoom);

    // Funcția care se execută la zoom/pan
    function zoomed(event) {
      gMap.attr("transform", event.transform);
    }

    // Încarcă poziția salvată a legendei
    const savedLegendPosition = JSON.parse(localStorage.getItem("legendPosition"));
    if (savedLegendPosition) {
      legendGroup.attr("transform", `translate(${savedLegendPosition.x}, ${savedLegendPosition.y})`);
    } else {
      // Setează poziția inițială dacă nu există o poziție salvată
      legendGroup.attr("transform", `translate(20, 20)`);
    }

    // Load stored visibility for the original legend
    const savedLegendVisibility = localStorage.getItem("legendVisibility");
    if (savedLegendVisibility) {
      legendGroup.attr("visibility", savedLegendVisibility);
    } else {
      legendGroup.attr("visibility", "visible");
    }

    // Drag pentru Legendă
    legendGroup.call(
      d3.drag()
        .on("start", () => {
          legendGroup.raise();
          legendGroup.attr("opacity", 0.8);
        })
        .on("drag", (event) => {
          const newX = Math.max(0, Math.min(event.x, mapContainer.clientWidth - legendGroup.node().getBBox().width));
          const newY = Math.max(0, Math.min(event.y, mapContainer.clientHeight - legendGroup.node().getBBox().height));
          legendGroup.attr("transform", `translate(${newX}, ${newY})`);
        })
        .on("end", (event) => {
          legendGroup.attr("opacity", 1);
          // Salvează poziția legendei
          localStorage.setItem("legendPosition", JSON.stringify({ x: event.x, y: event.y }));
        })
    );

    // Drag pentru numericLegendGroup
    const numericGroup = d3.select("#numericLegendGroup");
    const savedNumericPos = JSON.parse(localStorage.getItem("numericLegendPos"));
    if (savedNumericPos) {
      numericGroup.attr("transform", `translate(${savedNumericPos.x}, ${savedNumericPos.y})`);
    }
    const savedNumericVisibility = localStorage.getItem("numericLegendVisible");
    if (savedNumericVisibility) {
      numericGroup.attr("visibility", savedNumericVisibility);
    }

    numericGroup.call(
      d3.drag()
        .on("start", () => {
          numericGroup.raise();
          numericGroup.attr("opacity", 0.8);
        })
        .on("drag", (event) => {
          numericGroup.attr("transform", `translate(${event.x}, ${event.y})`);
        })
        .on("end", (event) => {
          numericGroup.attr("opacity", 1);
          localStorage.setItem("numericLegendPos", JSON.stringify({ x: event.x, y: event.y }));
        })
    );
  }

  // Apelăm funcția pentru a face legenda, titlul și sursa de date draggable
  makeElementsDraggable();

  // Funcție pentru a controla vizibilitatea legendei
  const toggleLegendButton = d3.select("#toggleLegend");
  const legendGroupSelection = d3.select("#legendGroup");

  if (toggleLegendButton) {
    toggleLegendButton.on("click", () => {
      const isVisible = legendGroupSelection.attr("visibility") !== "hidden";
      const newState = isVisible ? "hidden" : "visible";
      legendGroupSelection.attr("visibility", newState);
      // Salvează în localStorage
      localStorage.setItem("legendVisibility", newState);
    });
  } else {
    console.error("Elementul cu ID 'toggleLegend' nu a fost găsit.");
  }

  // Adăugăm un buton pentru a afișa/ascunde legenda numerică
  const toggleNumericLegendBtn = document.getElementById("toggleNumericLegend");
  if (toggleNumericLegendBtn) {
    toggleNumericLegendBtn.addEventListener("click", () => {
      const isVisible = numericLegendGroup.attr("visibility") !== "hidden";
      const newState = isVisible ? "hidden" : "visible";
      numericLegendGroup.attr("visibility", newState);
      localStorage.setItem("numericLegendVisible", newState);
    });
  }

  // Exportăm harta ca PNG
  if (exportButton) {
    exportButton.addEventListener("click", () => {
      // Ascundem butoanele de edit și ștergere ale legendei înainte de export
      const legendEdit = document.getElementById("editLegendTitle");
      const legendDelete = document.getElementById("deleteLegend");

      // Ascundem elementele care nu ar trebui să apară în export
      legendEdit.style.display = "none";
      legendDelete.style.display = "none";

      // Exportăm harta
      html2canvas(document.querySelector(".map-column"), { useCORS: true })
        .then((canvas) => {
          const link = document.createElement("a");
          link.download = "harta.png";
          link.href = canvas.toDataURL("image/png");
          link.click();

          // Afișăm din nou butoanele după export
          legendEdit.style.display = "block";
          legendDelete.style.display = "block";
        })
        .catch((err) => {
          console.error("Export error:", err);
          // Afișăm din nou butoanele în caz de eroare
          legendEdit.style.display = "block";
          legendDelete.style.display = "block";
        });
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

  // Încarcă harta selectată inițial
  loadMap("md.json");

  // Simplu set de funcții pentru drag & drop (similar cu legendGroup)
  function dragStarted(event, d) {
    d3.select(this).raise().classed("active", true);
  }

  function dragged(event, d) {
    d3.select(this)
      .attr("x", event.x)
      .attr("y", event.y);
  }

  function dragEnded(event, d) {
    d3.select(this).classed("active", false);
  }

  const addFreeTextButton = document.getElementById("addFreeText");
  const freeTextInput = document.getElementById("freeTextInput");
  const freeTextFontSelect = document.getElementById("freeTextFont");
  const freeTextSizeInput = document.getElementById("freeTextSize");
  const freeTextColorInput = document.getElementById("freeTextColor");
  const freeTextBorderCheckbox = document.getElementById("freeTextBorder");
  const freeTextBoldCheckbox = document.getElementById("freeTextBold");
  const freeTextItalicCheckbox = document.getElementById("freeTextItalic");
  const removeFreeTextButton = document.getElementById("removeFreeText");
  // const mapContainer = document.querySelector('.map-column');
  // let selectedTextBox = null;

  function createFreeTextContainer(text, font, size, color, border, bold, italic) {
    const div = document.createElement('div');
    div.className = 'free-text-container';
    div.contentEditable = true;
    div.style.fontFamily = font;
    div.style.fontSize = size + 'px';
    div.style.color = color;
    div.style.border = border ? '1px solid #000' : 'none';
    div.style.fontWeight = bold ? 'bold' : 'normal';
    div.style.fontStyle = italic ? 'italic' : 'normal';
    div.innerText = text;
    mapContainer.appendChild(div);

    div.addEventListener('click', () => {
      if (selectedTextBox) {
        selectedTextBox.classList.remove('selected');
      }
      selectedTextBox = div;
      selectedTextBox.classList.add('selected');
      updateFreeTextControls(selectedTextBox);
    });

    div.addEventListener('input', () => {
      freeTextInput.value = div.innerText;
    });

    d3.select(div).call(d3.drag()
      .on('drag', (event) => {
        const newX = Math.max(0, Math.min(event.x, mapContainer.clientWidth - div.clientWidth));
        const newY = Math.max(0, Math.min(event.y, mapContainer.clientHeight - div.clientHeight));
        d3.select(div).style('left', `${newX}px`).style('top', `${newY}px`);
      })
    );
  }

  function updateFreeTextControls(textBox) {
    freeTextInput.value = textBox.innerText;
    freeTextFontSelect.value = textBox.style.fontFamily;
    freeTextSizeInput.value = parseInt(textBox.style.fontSize);
    freeTextColorInput.value = textBox.style.color;
    freeTextBorderCheckbox.checked = textBox.style.border !== 'none';
    freeTextBoldCheckbox.checked = textBox.style.fontWeight === 'bold';
    freeTextItalicCheckbox.checked = textBox.style.fontStyle === 'italic';
  }

  if (addFreeTextButton) {
    addFreeTextButton.addEventListener('click', () => {
      const text = freeTextInput.value.trim();
      const font = freeTextFontSelect.value;
      const size = freeTextSizeInput.value;
      const color = freeTextColorInput.value;
      const border = freeTextBorderCheckbox.checked;
      const bold = freeTextBoldCheckbox.checked;
      const italic = freeTextItalicCheckbox.checked;
      if (text === "") {
        alert("Textul nu poate fi gol.");
        return;
      }
      createFreeTextContainer(text, font, size, color, border, bold, italic);
    });
  } else {
    console.error("Elementul cu ID 'addFreeText' nu a fost găsit.");
  }

  if (removeFreeTextButton) {
    removeFreeTextButton.addEventListener('click', () => {
      if (selectedTextBox) {
        mapContainer.removeChild(selectedTextBox);
        selectedTextBox = null;
      } else {
        alert("Selectează un text pentru a-l elimina.");
      }
    });
  } else {
    console.error("Elementul cu ID 'removeFreeText' nu a fost găsit.");
  }

  freeTextInput.addEventListener('input', () => {
    if (selectedTextBox) {
      selectedTextBox.innerText = freeTextInput.value;
    }
  });

  freeTextFontSelect.addEventListener('change', () => {
    if (selectedTextBox) {
      selectedTextBox.style.fontFamily = freeTextFontSelect.value;
    }
  });

  freeTextSizeInput.addEventListener('input', () => {
    if (selectedTextBox) {
      selectedTextBox.style.fontSize = freeTextSizeInput.value + 'px';
    }
  });

  freeTextColorInput.addEventListener('input', () => {
    if (selectedTextBox) {
      selectedTextBox.style.color = freeTextColorInput.value;
    }
  });

  freeTextBorderCheckbox.addEventListener('change', () => {
    if (selectedTextBox) {
      selectedTextBox.style.border = freeTextBorderCheckbox.checked ? '1px solid #000' : 'none';
    }
  });

  freeTextBoldCheckbox.addEventListener('change', () => {
    if (selectedTextBox) {
      selectedTextBox.style.fontWeight = freeTextBoldCheckbox.checked ? 'bold' : 'normal';
    }
  });

  freeTextItalicCheckbox.addEventListener('change', () => {
    if (selectedTextBox) {
      selectedTextBox.style.fontStyle = freeTextItalicCheckbox.checked ? 'italic' : 'normal';
    }
  });

  function makeElementDraggable(element, container) {
    d3.select(element).call(d3.drag()
      .on('drag', (event) => {
        const newX = Math.max(0, Math.min(event.x, container.clientWidth - element.getBBox().width));
        const newY = Math.max(0, Math.min(event.y, container.clientHeight - element.getBBox().height));
        d3.select(element).attr('transform', `translate(${newX}, ${newY})`);
      })
    );
  }

  // Restore zoom functionality
  const zoom = d3.zoom()
    .scaleExtent([0.5, 8])
    .on("zoom", (event) => {
      gMap.attr("transform", event.transform);
    });

  svg.call(zoom);
});
