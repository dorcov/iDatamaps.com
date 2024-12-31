document.addEventListener("DOMContentLoaded", () => {
  // Referințe la elementele DOM
  const mapSelector = document.getElementById("mapSelector");
  const gradientStart = document.getElementById("gradientStart");
  const gradientEnd = document.getElementById("gradientEnd");
  const applyGradientButton = document.getElementById("applyGradient");
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

  // Declararea tooltip-ului
  const tooltip = d3.select(".tooltip");

  // Add these variables at the top with other declarations
  let selectedTextBox = null;
  const mapContainer = document.querySelector('.map-column');

  // Initialize the legendGroup right after SVG creation
  const { legendGroup, numericLegendGroup } = initializeLegends();
  setupLegendControls();

  // Define projection as a global variable
  let projection;

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
    currentGradient.start = gradientStart.value;
    currentGradient.end = gradientEnd.value;
    updateMapColors();
  }

  if (applyGradientButton) {
    applyGradientButton.addEventListener("click", applyCustomGradient);
  } else {
    console.error("Elementul cu ID 'applyGradient' nu a fost găsit.");
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

    gMap.selectAll("path")
      .transition()
      .duration(500)
      .attr("fill", d => getFillColor(d));

    generateBothLegends();
    updateValueLabels();
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
           .html(`<strong>${regionName}</strong><br/>Valoare: ${value}<br/>Categorie: ${category || "N/A"}`)
           .transition()
           .duration(200)
           .style("opacity", 1);
  }

  function moveTooltip(event) {
    tooltip.style("top", (event.pageY - 10) + "px")
           .style("left", (event.pageX + 10) + "px");
  }

  function hideTooltip() {
    tooltip.transition()
           .duration(200)
           .style("opacity", 0)
           .on("end", () => {
             tooltip.style("visibility", "hidden");
           });
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

      // Set the projection once
      projection = d3.geoMercator()
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
        .attr("data-region-name", d => d.properties.name)
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
      row.addEventListener("click", () => {
        highlightRegion(feature.properties.name);
      });
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
    updateValueLabels();
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

    // Aplicați stilurile din CSS variabile
    d3.select("#legendTitle")
      .attr("class", "legend-title");

    d3.selectAll(".legend-text")
      .attr("class", "legend-text");

    // Dacă nu există categorii, forțați vizibilitatea legendei
    if (!categories.length) {
      d3.select("#legendGroup").attr("visibility", "visible");
      localStorage.setItem("legendVisibility", "visible");
    }
    d3.select("#legendGroup").attr("visibility", "visible");
    localStorage.setItem("legendVisibility", "visible");
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
      .style("fill", `url(#${gradientID})`)
      .attr("rx", 5)
      .attr("ry", 5);

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
      .attr("fill", "#555")
      .attr("rx", 2)
      .attr("ry", 2);

    // Funcție pentru redimensionarea barei de gradient numeric
    const resizeDrag = d3.drag()
      .on("start", (event) => {
        d3.select("#numericResizeHandle").raise();
      })
      .on("drag", (event) => {
        const newWidth = Math.max(100, Math.min(event.x - 10, 300)); // Adjusted minimum width for better usability
        numericLegendGroup.select("rect[width='120']").attr("width", newWidth);
        // Adjust the position of texts based on new width
        numericLegendGroup.selectAll(".numeric-legend-text")
          .attr("x", newWidth / 2);
        // Adjust the position of the resize handle
        d3.select("#numericResizeHandle").attr("x", newWidth + 10);
      })
      .on("end", (event) => {
        // Optional: Save the new width to localStorage or state if needed
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

    // Apply styles to numeric legend
    numericLegendGroup.style("font-family", "var(--legend-font, 'Roboto, sans-serif')")
                      .style("font-size", "var(--legend-font-size, 14px)")
                      .style("font-style", "var(--legend-font-style, normal)")
                      .style("color", "var(--legend-color, #000000)")
                      .style("background-color", `rgba(255, 255, 255, var(--legend-bg-transparency, 0.8))`);
  }

  // Afișăm ambele legende după ce actualizăm tabelul/gradientul
  function generateBothLegends() {
    // Generate main legend
    generateLegend();

    // Generate numeric legend if there are values
    const hasValues = regionTableBody && 
                     Array.from(regionTableBody.querySelectorAll("input"))
                     .some(input => parseFloat(input.value) > 0);

    if (hasValues) {
      generateNumericLegend();
    } else {
      d3.select("#numericLegendGroup").attr("visibility", "hidden");
      localStorage.setItem("numericLegendVisible", "hidden");
    }

    // Restore main legend visibility
    const savedMainVisibility = localStorage.getItem("legendVisibility") || "visible";
    d3.select("#legendGroup")
      .attr("visibility", savedMainVisibility)
      .raise();

    // Restore numeric legend visibility
    const savedNumericVisibility = localStorage.getItem("numericLegendVisible") || "visible";
    d3.select("#numericLegendGroup")
      .attr("visibility", savedNumericVisibility)
      .raise();
  }

  // Funcționalitate Drag-and-Drop pentru Legendă, Titlu și Sursa Datelor
  function makeElementsDraggable() {
    const legends = [
      { element: "#legendGroup", defaultX: 20, defaultY: 20 },
      { element: "#numericLegendGroup", defaultX: svgWidth - 200, defaultY: 20 }
    ];

    legends.forEach(({ element, defaultX, defaultY }) => {
      const group = d3.select(element);
      const savedPos = JSON.parse(localStorage.getItem(`${element}Position`));
      
      if (savedPos) {
        group.attr("transform", `translate(${savedPos.x}, ${savedPos.y})`);
      } else {
        group.attr("transform", `translate(${defaultX}, ${defaultY})`);
      }

      group.call(
        d3.drag()
          .on("start", () => {
            group.raise().attr("opacity", 0.8);
          })
          .on("drag", (event) => {
            group.attr("transform", `translate(${event.x}, ${event.y})`);
          })
          .on("end", (event) => {
            group.attr("opacity", 1);
            localStorage.setItem(`${element}Position`, JSON.stringify({ x: event.x, y: event.y }));
          })
      );
    });
  }

  // Apelăm funcția pentru a face legenda, titlul și sursa de date draggable
  makeElementsDraggable();

  // Funcție pentru a controla vizibilitatea legendei
  const toggleLegendButton = document.getElementById("toggleLegend");
  const legendGroupSelection = d3.select("#legendGroup");

  if (toggleLegendButton) {
    toggleLegendButton.addEventListener("click", () => {
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
      const numericLegend = d3.select("#numericLegendGroup");
      const isVisible = numericLegend.attr("visibility") === "visible";
      const newState = isVisible ? "hidden" : "visible";
      numericLegend.attr("visibility", newState)
        .raise();
      localStorage.setItem("numericLegendVisible", newState);
    });
  }

  // Exportăm harta ca PNG
  if (exportButton) {
    exportButton.addEventListener("click", () => {
      const mainLegendVisibility = localStorage.getItem("legendVisibility") || "visible";
      const numericLegendVisibility = localStorage.getItem("numericLegendVisible") || "visible";
      
      // Temporarily hide legends for export
      const legendGroup = document.getElementById("legendGroup");
      const numericLegendGroup = document.getElementById("numericLegendGroup");
      const originalMainDisplay = legendGroup.style.display;
      const originalNumericDisplay = numericLegendGroup.style.display;
      if (mainLegendVisibility === "hidden") legendGroup.style.display = "none";
      if (numericLegendVisibility === "hidden") numericLegendGroup.style.display = "none";

      html2canvas(document.querySelector(".map-column"), {
        backgroundColor: null
      }).then(canvas => {
        const link = document.createElement("a");
        link.download = "map_export.png";
        link.href = canvas.toDataURL("image/png");
        link.click();
        // Restore legends
        legendGroup.style.display = originalMainDisplay;
        numericLegendGroup.style.display = originalNumericDisplay;
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
  loadMap("md.geojson");

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
  // const mapContainer = document.querySelector('.map-column'); // Removed duplicate declaration
  // let selectedTextBox = null;

  let freeTexts = [];
  // let selectedTextBox = null;

  // Function to add new free text
  function addFreeText() {
    const text = freeTextInput.value.trim();
    if (text === "") return;

    const textId = `freeText_${Date.now()}`;
    freeTexts.push({ id: textId, content: text });

    createFreeTextContainer(text, textId);

    freeTextInput.value = "";
  }

  // Modify createFreeTextContainer to accept textId
  function createFreeTextContainer(text, textId) {
    const div = document.createElement('div');
    div.className = 'free-text-container';
    div.id = textId;
    div.contentEditable = true;
    div.style.fontFamily = freeTextFontSelect.value;
    div.style.fontSize = `${freeTextSizeInput.value}px`;
    div.style.color = freeTextColorInput.value;
    div.style.border = freeTextBorderCheckbox.checked ? '1px solid #000' : 'none';
    div.style.fontWeight = freeTextBoldCheckbox.checked ? 'bold' : 'normal';
    div.style.fontStyle = freeTextItalicCheckbox.checked ? 'italic' : 'normal';
    div.innerText = text;
    mapContainer.appendChild(div);

    // Add event listeners for editing
    div.addEventListener('click', () => selectFreeText(div));

    div.addEventListener('blur', () => {
      const updatedText = div.innerText.trim();
      const index = freeTexts.findIndex(ft => ft.id === textId);
      if (index !== -1) {
        freeTexts[index].content = updatedText;
      }
    });

    // Make the text draggable
    d3.select(div).call(d3.drag()
      .on('drag', (event) => {
        div.style.left = `${event.x}px`;
        div.style.top = `${event.y}px`;
      })
    );
  }

  // Update event listener for addFreeTextButton
  if (addFreeTextButton) {
    addFreeTextButton.addEventListener("click", addFreeText);
  } else {
    console.error("Elementul cu ID 'addFreeText' nu a fost găsit.");
  }

  // Modify removeFreeTextButton to handle multiple texts
  function removeFreeText() {
    if (selectedTextBox) {
      mapContainer.removeChild(selectedTextBox);
      freeTexts = freeTexts.filter(ft => ft.id !== selectedTextBox.id);
      selectedTextBox = null;
      updateFreeTextControls(null);
    }
  }

  if (removeFreeTextButton) {
    removeFreeTextButton.addEventListener("click", removeFreeText);
  } else {
    console.error("Elementul cu ID 'removeFreeText' nu a fost găsit.");
  }

  // Function to select a free text box
  function selectFreeText(textBox) {
    selectedTextBox = textBox;
    updateFreeTextControls(textBox);
  }

  // Function to update controls based on selected text
  function updateFreeTextControls(textBox) {
    if (textBox) {
      freeTextInput.value = textBox.innerText;
      freeTextFontSelect.value = textBox.style.fontFamily;
      freeTextSizeInput.value = parseInt(textBox.style.fontSize);
      freeTextColorInput.value = textBox.style.color;
      freeTextBorderCheckbox.checked = textBox.style.border !== 'none';
      freeTextBoldCheckbox.checked = textBox.style.fontWeight === 'bold';
      freeTextItalicCheckbox.checked = textBox.style.fontStyle === 'italic';
    } else {
      freeTextInput.value = "";
      // Reset other controls if necessary
    }
  }

  // Event listeners for free text controls
  freeTextInput.addEventListener('input', () => {
    if (selectedTextBox) {
      selectedTextBox.innerText = freeTextInput.value;
      freeTexts.find(ft => ft.id === selectedTextBox.id).content = freeTextInput.value;
    }
  });

  freeTextFontSelect.addEventListener('change', () => {
    if (selectedTextBox) {
      selectedTextBox.style.fontFamily = freeTextFontSelect.value;
    }
  });

  freeTextSizeInput.addEventListener('input', () => {
    if (selectedTextBox) {
      selectedTextBox.style.fontSize = `${freeTextSizeInput.value}px`;
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

  // After SVG initialization, add:
  function initializeLegends() {
    // Clear any existing legends
    svg.selectAll(".legend-group").remove();

    // Create main legend (left side)
    const legendGroup = svg.append("g")
      .attr("id", "legendGroup")
      .attr("class", "legend-group")
      .attr("visibility", "visible")
      .attr("transform", "translate(20, 20)");

    // Add background and title to main legend
    legendGroup.append("rect")
      .attr("id", "legendBackground")
      .attr("width", 180)
      .attr("height", 200)
      .attr("rx", 4)
      .attr("ry", 4)
      .attr("fill", "rgba(255, 255, 255, var(--legend-bg-transparency, 0.8))"); // Utilizare variabilă CSS

    legendGroup.append("text")
      .attr("id", "legendTitle")
      .attr("x", 10)
      .attr("y", 20)
      .attr("class", "legend-title")
      .text("Legendă");

    legendGroup.append("g")
      .attr("id", "legendItems");

    // Create numeric legend (right side)
    const numericLegendGroup = svg.append("g")
      .attr("id", "numericLegendGroup")
      .attr("class", "legend-group")
      .attr("visibility", "visible")
      .attr("transform", `translate(${svgWidth - 200}, 20)`);

    // Add background to numeric legend
    numericLegendGroup.append("rect")
      .attr("width", 180)
      .attr("height", 60)
      .attr("rx", 4)
      .attr("ry", 4)
      .attr("fill", "rgba(255, 255, 255, var(--legend-bg-transparency, 0.8))"); // Utilizare variabilă CSS

    // Force both legends to be visible initially
    localStorage.setItem("legendVisibility", "visible");
    localStorage.setItem("numericLegendVisible", "visible");

    return { legendGroup, numericLegendGroup };
  }

  // Replace the existing setupLegendControls function with this corrected version:
  function setupLegendControls() {
    const toggleMainBtn = document.getElementById("toggleLegend");
    const toggleNumericBtn = document.getElementById("toggleNumericLegend");

    // Restore legend visibility from localStorage
    const savedMainVisibility = localStorage.getItem("legendVisibility") || "visible";
    const savedNumericVisibility = localStorage.getItem("numericLegendVisible") || "visible";

    const legendGroup = d3.select("#legendGroup")
      .attr("visibility", savedMainVisibility);
    
    const numericLegendGroup = d3.select("#numericLegendGroup")
      .attr("visibility", savedNumericVisibility);

    if (toggleMainBtn) {
      toggleMainBtn.addEventListener("click", function() {
        const isVisible = legendGroup.attr("visibility") === "visible";
        const newState = isVisible ? "hidden" : "visible";
        legendGroup.attr("visibility", newState).raise();
        localStorage.setItem("legendVisibility", newState);
      });
    }

    if (toggleNumericBtn) {
      toggleNumericBtn.addEventListener("click", function() {
        const isVisible = numericLegendGroup.attr("visibility") === "visible";
        const newState = isVisible ? "hidden" : "visible";
        numericLegendGroup.attr("visibility", newState).raise();
        localStorage.setItem("numericLegendVisible", newState);
      });
    }
  }

  // Update the event listener initialization
  function initializeEventListeners() {
    const toggleMainBtn = document.getElementById("toggleLegend");
    const toggleNumericBtn = document.getElementById("toggleNumericLegend");

    if (toggleMainBtn && toggleNumericBtn) {
      // Remove any existing listeners
      toggleMainBtn.replaceWith(toggleMainBtn.cloneNode(true));
      toggleNumericBtn.replaceWith(toggleNumericBtn.cloneNode(true));
      
      // Setup new listeners
      setupLegendControls();
    }
  }

  // Call this after DOM content is loaded and after legends are initialized
  initializeEventListeners();

  // Referințe la noile elemente DOM
  const toggleValuesCheckbox = document.getElementById("toggleValues");
  const valuesFontSizeInput = document.getElementById("valuesFontSize");
  const valuesColorInput = document.getElementById("valuesColor");
  const valuesFontSelect = document.getElementById("valuesFont");

  // Array pentru a stoca label-urile
  let valueLabels = [];

  // Replace the getRegionCentroid function with getRegionPointOnSurface
  function getRegionPointOnSurface(feature) {
    const point = turf.pointOnFeature(feature);
    return point.geometry.coordinates;
  }

  // Funcție pentru a crea label-uri pe hartă
  function createValueLabels() {
    // 1) Remove or comment out any old HTML label creation
    // ...existing code...

    // 2) Clear existing SVG labels
    gMap.selectAll(".value-label").remove();

    // 3) Append new text elements for each region
    gMap.selectAll(".value-label")
      .data(geoDataFeatures)
      .enter()
      .append("text")
      .attr("class", "value-label")
      .attr("text-anchor", "middle")
      .style("pointer-events", "none") // ensure text doesn’t interfere with mouse events
      .style("font-family", valuesFontSelect ? valuesFontSelect.value : "'Roboto', sans-serif"); // Set initial font family
  }

  // Funcție pentru a obține centrul unei regiuni
  function getRegionCentroid(feature) {
    const centroid = d3.geoCentroid(feature);
    const [x, y] = projection(centroid);
    return [x, y];
  }

  // Eveniment pentru toggle-ul valorilor
  if (toggleValuesCheckbox) {
    toggleValuesCheckbox.addEventListener("change", () => {
      if (toggleValuesCheckbox.checked) {
        createValueLabels();
        localStorage.setItem("valuesVisible", "true");
      } else {
        valueLabels.forEach(label => label.remove());
        valueLabels = [];
        localStorage.setItem("valuesVisible", "false");
      }
      updateValueLabels();
    });
  } else {
    console.error("Elementul cu ID 'toggleValues' nu a fost găsit.");
  }

  // Eveniment pentru schimbarea mărimii fontului
  if (valuesFontSizeInput) {
    valuesFontSizeInput.addEventListener("input", () => {
      valueLabels.forEach(label => {
        label.style.fontSize = `${valuesFontSizeInput.value}px`;
      });
      localStorage.setItem("valuesFontSize", valuesFontSizeInput.value);
      updateValueLabels();
    });
  } else {
    console.error("Elementul cu ID 'valuesFontSize' nu a fost găsit.");
  }

  // Eveniment pentru schimbarea culorii fontului,
  if (valuesColorInput) {
    valuesColorInput.addEventListener("input", () => {
      valueLabels.forEach(label => {
        label.style.color = valuesColorInput.value;
      });
      localStorage.setItem("valuesColor", valuesColorInput.value);
      updateValueLabels();
    });
  } else {
    console.error("Elementul cu ID 'valuesColor' nu a fost găsit.");
  }

  if (valuesFontSelect) {
    valuesFontSelect.addEventListener('change', () => {
      updateValueLabels();
    });
  }

  // Funcție pentru a actualiza label-urile atunci când harta se încarcă sau se actualizează
  function updateValueLabels() {
    if (toggleValuesCheckbox.checked) {
      createValueLabels();
    }

    gMap.selectAll(".value-label")
      .attr("x", d => {
        const coords = getRegionPointOnSurface(d);
        const [cx, cy] = projection(coords);
        return cx;
      })
      .attr("y", d => {
        const coords = getRegionPointOnSurface(d);
        const [cx, cy] = projection(coords);
        return cy;
      })
      .text(d => {
        // Use getRegionValue(d)
        const val = getRegionValue(d) || 0;
        return toggleValuesCheckbox.checked ? val : "";
      })
      .style("font-size", valuesFontSizeInput.value + "px")
      .style("fill", valuesColorInput.value)
      .style("display", d => getRegionValue(d) > 0 ? 'block' : 'none'); // Hide label if value is zero

    const selectedFont = valuesFontSelect ? valuesFontSelect.value : "'Roboto', sans-serif";
    valueLabels.forEach(label => {
      label.style.fontFamily = selectedFont;
    });
  }

  // Restore values visibility and styles from localStorage
  function restoreValuesSettings() {
    const valuesVisible = localStorage.getItem("valuesVisible") === "true";
    toggleValuesCheckbox.checked = valuesVisible;
    if (valuesVisible) {
      createValueLabels();
    }

    const savedFontSize = localStorage.getItem("valuesFontSize");
    if (savedFontSize) {
      valuesFontSizeInput.value = savedFontSize;
      valueLabels.forEach(label => {
        label.style.fontSize = `${savedFontSize}px`;
      });
    }

    const savedColor = localStorage.getItem("valuesColor");
    if (savedColor) {
      valuesColorInput.value = savedColor;
      valueLabels.forEach(label => {
        label.style.color = savedColor;
      });
    }
  }

  // Apelăm restaurarea setărilor la încărcarea paginii
  restoreValuesSettings();

  // Referințe la noile elemente de stilizare legende
  const legendFont = document.getElementById("legendFont");
  const legendFontSize = document.getElementById("legendFontSize");
  const legendFontStyle = document.getElementById("legendFontStyle");
  const legendColor = document.getElementById("legendColor");
  const legendBgTransparency = document.getElementById("legendBgTransparency");

  // Funcție pentru aplicarea stilurilor la legendă
  function applyLegendStyles() {
    const font = legendFont.value;
    const fontSize = legendFontSize.value + "px";
    const fontStyle = legendFontStyle.value.includes("bold") ? "bold " : "";
    const finalFontStyle = fontStyle + (legendFontStyle.value.includes("italic") ? "italic" : "normal");
    const color = legendColor.value;
    const bgTransparency = legendBgTransparency.value;

    // Separă font-style și font-weight
    const fontWeight = fontStyle.includes("bold") ? "bold" : "normal";
    const computedFontStyle = legendFontStyle.value.includes("italic") ? "italic" : "normal";

    // Aplică stilurile folosind variabile CSS
    document.documentElement.style.setProperty('--legend-font', font);
    document.documentElement.style.setProperty('--legend-font-size', fontSize);
    document.documentElement.style.setProperty('--legend-font-style', computedFontStyle);
    document.documentElement.style.setProperty('--legend-font-weight', fontWeight);
    document.documentElement.style.setProperty('--legend-color', color);
    document.documentElement.style.setProperty('--legend-bg-transparency', bgTransparency);

    // Regenerează legendele pentru a aplica noile stiluri
    generateBothLegends();
  }

  // Adaugă evenimente pentru noile controale
  if (legendFont) {
    legendFont.addEventListener("change", applyLegendStyles);
  } else {
    console.error("Elementul cu ID 'legendFont' nu a fost găsit.");
  }

  if (legendFontSize) {
    legendFontSize.addEventListener("input", applyLegendStyles);
  } else {
    console.error("Elementul cu ID 'legendFontSize' nu a fost găsit.");
  }

  if (legendFontStyle) {
    legendFontStyle.addEventListener("change", applyLegendStyles);
  } else {
    console.error("Elementul cu ID 'legendFontStyle' nu a fost găsit.");
  }

  if (legendColor) {
    legendColor.addEventListener("input", applyLegendStyles);
  } else {
    console.error("Elementul cu ID 'legendColor' nu a fost găsit.");
  }

  if (legendBgTransparency) {
    legendBgTransparency.addEventListener("input", applyLegendStyles);
  } else {
    console.error("Elementul cu ID 'legendBgTransparency' nu a fost găsit.");
  }

  const canvasColorInput = document.getElementById("canvasColor");
  const canvasTransparencyInput = document.getElementById("canvasTransparency");
  const canvasWidthInput = document.getElementById("canvasWidth");
  const canvasHeightInput = document.getElementById("canvasHeight");

  function updateCanvas() {
    const bgColor = canvasColorInput.value;
    const alpha = parseFloat(canvasTransparencyInput.value);

    if (alpha === 0) {
      mapContainer.style.backgroundColor = "transparent";
    } else {
      const rgb = hexToRgb(bgColor);
      mapContainer.style.backgroundColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
    }
    mapContainer.style.width = canvasWidthInput.value + "px";
    mapContainer.style.height = canvasHeightInput.value + "px";
  }

  [canvasColorInput, canvasTransparencyInput, canvasWidthInput, canvasHeightInput]
    .forEach(input => input.addEventListener("input", updateCanvas));

  function hexToRgb(hex) {
    // For example:
    const strippedHex = hex.replace(/^#/, "");
    const bigint = parseInt(strippedHex, 16);
    return {
      r: (bigint >> 16) & 255,
      g: (bigint >> 8) & 255,
      b: bigint & 255,
    };
  }

  // Add map lock/unlock functionality
  let mapLocked = false;
  const toggleMapLockButton = document.getElementById('toggleMapLock');

  function lockAllInteractions() {
    // Disable zoom and pan
    svg.on(".zoom", null);
    
    // Disable dragging for legends
    d3.selectAll('.legend-group')
      .style('pointer-events', 'none')
      .style('cursor', 'default');
    
    // Disable text editing and dragging
    document.querySelectorAll('.free-text-container').forEach(el => {
      el.contentEditable = false;
      el.style.cursor = 'default';
      el.style.pointerEvents = 'none';
    });
    
    // Disable shape dragging
    document.querySelectorAll('.shape').forEach(el => {
      el.style.pointerEvents = 'none';
      el.style.cursor = 'default';
    });
    
    // Disable text selection
    mapContainer.style.userSelect = 'none';
    
    toggleMapLockButton.textContent = 'Deblochează Harta';
    toggleMapLockButton.classList.add('active');
  }
  
  function unlockAllInteractions() {
    // Re-enable zoom and pan
    applyZoomBehavior();
    
    // Re-enable legend dragging
    d3.selectAll('.legend-group')
      .style('pointer-events', 'all')
      .style('cursor', 'move');
    
    // Re-enable text editing and dragging
    document.querySelectorAll('.free-text-container').forEach(el => {
      el.contentEditable = true;
      el.style.cursor = 'move';
      el.style.pointerEvents = 'auto';
    });
    
    // Re-enable shape dragging
    document.querySelectorAll('.shape').forEach(el => {
      el.style.pointerEvents = 'auto';
      el.style.cursor = 'move';
    });
    
    // Re-enable text selection
    mapContainer.style.userSelect = 'auto';
    
    toggleMapLockButton.textContent = 'Blochează Harta';
    toggleMapLockButton.classList.remove('active');
  }
  
  if (toggleMapLockButton) {
    toggleMapLockButton.addEventListener('click', () => {
      mapLocked = !mapLocked;
      if (mapLocked) {
        lockAllInteractions();
      } else {
        unlockAllInteractions();
      }
    });
  }

  // Exemplu minimal pentru reactivarea pan/zoom:
  function applyZoomBehavior() {
    const zoom = d3.zoom().on('zoom', (event) => {
      gMap.attr('transform', event.transform);
    });
    svg.call(zoom);
  }

  // Define zoom behavior globaly
  const zoomBehavior = d3.zoom()
    .scaleExtent([0.5, 8])
    .on("zoom", (event) => {
      gMap.attr("transform", event.transform);
    });

  function applyZoomBehavior() {
    svg.call(zoomBehavior);
  }

  function lockAllInteractions() {
    // Disable zoom and pan
    svg.on(".zoom", null);
    
    // Disable dragging for legends
    d3.selectAll('.legend-group')
      .style('pointer-events', 'none')
      .style('cursor', 'default');
    
    // Disable text editing and dragging
    document.querySelectorAll('.free-text-container').forEach(el => {
      el.contentEditable = false;
      el.style.cursor = 'default';
      el.style.pointerEvents = 'none';
    });
    
    // Disable shape dragging
    document.querySelectorAll('.shape').forEach(el => {
      el.style.pointerEvents = 'none';
      el.style.cursor = 'default';
    });
    
    // Disable text selection
    mapContainer.style.userSelect = 'none';
    
    toggleMapLockButton.textContent = 'Deblochează Harta';
    toggleMapLockButton.classList.add('active');
  }

  function unlockAllInteractions() {
    // Re-enable zoom and pan
    applyZoomBehavior();
    
    // Re-enable legend dragging
    d3.selectAll('.legend-group')
      .style('pointer-events', 'all')
      .style('cursor', 'move');
    
    // Re-enable text editing and dragging
    document.querySelectorAll('.free-text-container').forEach(el => {
      el.contentEditable = true;
      el.style.cursor = 'move';
      el.style.pointerEvents = 'auto';
    });
    
    // Re-enable shape dragging
    document.querySelectorAll('.shape').forEach(el => {
      el.style.pointerEvents = 'auto';
      el.style.cursor = 'move';
    });
    
    // Re-enable text selection
    mapContainer.style.userSelect = 'auto';
    
    toggleMapLockButton.textContent = 'Blochează Harta';
    toggleMapLockButton.classList.remove('active');
  }

  // Initialize zoom behavior
  applyZoomBehavior();

  // Add shape-related variables
  const addRectangleBtn = document.getElementById('addRectangle');
  const addCircleBtn = document.getElementById('addCircle');
  const deleteShapeBtn = document.getElementById('deleteShape');
  let selectedShape = null;

  // Add event listeners for shape buttons
  if (addRectangleBtn) {
    addRectangleBtn.addEventListener('click', handleAddRectangle);
  } else {
    console.error("Elementul cu ID 'addRectangle' nu a fost găsit.");
  }

  if (addCircleBtn) {
    addCircleBtn.addEventListener('click', handleAddCircle);
  } else {
    console.error("Elementul cu ID 'addCircle' nu a fost găsit.");
  }

  if (deleteShapeBtn) {
    deleteShapeBtn.addEventListener('click', handleRemoveShape);
  } else {
    console.error("Elementul cu ID 'deleteShape' nu a fost găsit.");
  }

  // Function to handle adding a rectangle
  function handleAddRectangle() {
    const rect = shapesGroup.append('rect')
      .attr('x', svgWidth / 2 - 50)
      .attr('y', svgHeight / 2 - 25)
      .attr('width', 100)
      .attr('height', 50)
      .attr('fill', currentGradient.start)
      .attr('opacity', currentGradient.end)
      .attr('class', 'rectangle') // Assign 'rectangle' class
      .call(shapeDrag); // Apply drag behavior
  
    rect.on('click', function() {
      selectShape(d3.select(this));
    });
  }
  
  // Function to handle adding a circle
  function handleAddCircle() {
    const circle = shapesGroup.append('circle')
      .attr('cx', svgWidth / 2)
      .attr('cy', svgHeight / 2)
      .attr('r', 50)
      .attr('fill', currentGradient.start)
      .attr('opacity', currentGradient.end)
      .attr('class', 'circle') // Assign 'circle' class
      .call(shapeDrag); // Apply drag behavior
  
    circle.on('click', function() {
      selectShape(d3.select(this));
    });
  }
  
  // Function to select a shape
  function selectShape(shape) {
    selectedShape = shape;
    updateShapeControls();
  }
  
  // Function to handle dragging a shape
  function dragged(event, d) {
    const shape = d3.select(event.sourceEvent.target);
    if (shape.node().tagName === "rect") {
      shape.attr("x", +shape.attr("x") + event.dx)
           .attr("y", +shape.attr("y") + event.dy);
    } else {
      shape.attr("cx", +shape.attr("cx") + event.dx)
           .attr("cy", +shape.attr("cy") + event.dy);
    }
  }
  
  // Function to remove the selected shape
  function handleRemoveShape() {
    selectedShape.remove();
    selectedShape = null;
    updateShapeControls();
  }
  
  // References to shape control elements
  const shapeControls = document.getElementById('shapeControls');
  const shapeColorInput = document.getElementById('shapeColor');
  const shapeTransparencyInput = document.getElementById('shapeTransparency');
  const shapeWidthInput = document.getElementById('shapeWidth');
  const shapeHeightInput = document.getElementById('shapeHeight');
  const shapeRadiusInput = document.getElementById('shapeRadius');
  const deleteShapeButton = document.getElementById('deleteShape');
  
  // Function to show or hide shape controls based on selection
  function updateShapeControls() {
    if (selectedShape) {
      shapeControls.style.display = 'block';
      // Initialize control values based on the selected shape
      const currentColor = selectedShape.attr('fill') || '#000000';
      const currentOpacity = selectedShape.attr('opacity') || 1;
      shapeColorInput.value = rgbToHex(currentColor);
      shapeTransparencyInput.value = currentOpacity;
      
      if (selectedShape.classed('rectangle')) {
        shapeWidthInput.value = selectedShape.attr('width');
        shapeHeightInput.value = selectedShape.attr('height');
        shapeWidthInput.disabled = false;
        shapeHeightInput.disabled = false;
        shapeRadiusInput.style.display = 'none';
      } else if (selectedShape.classed('circle')) {
        shapeRadiusInput.value = selectedShape.attr('r');
        shapeWidthInput.disabled = true;
        shapeHeightInput.disabled = true;
        shapeRadiusInput.style.display = 'block';
      }
    } else {
      shapeControls.style.display = 'none';
    }
  }
  
  // Event listeners for shape controls
  if (shapeColorInput) {
    shapeColorInput.addEventListener('input', () => {
      if (selectedShape) {
        selectedShape.attr('fill', shapeColorInput.value);
      }
    });
  } else {
    console.error("Elementul cu ID 'shapeColor' nu a fost găsit.");
  }
  
  if (shapeTransparencyInput) {
    shapeTransparencyInput.addEventListener('input', () => {
      if (selectedShape) {
        selectedShape.attr('opacity', shapeTransparencyInput.value);
      }
    });
  } else {
    console.error("Elementul cu ID 'shapeTransparency' nu a fost găsit.");
  }
  
  if (shapeWidthInput) {
    shapeWidthInput.addEventListener('input', () => {
      if (selectedShape && selectedShape.classed('rectangle')) {
        selectedShape.attr('width', shapeWidthInput.value);
        selectedShape.attr('x', selectedShape.attr('x')); // Optional: Adjust position if needed
      }
    });
  } else {
    console.error("Elementul cu ID 'shapeWidth' nu a fost găsit.");
  }
  
  if (shapeHeightInput) {
    shapeHeightInput.addEventListener('input', () => {
      if (selectedShape && selectedShape.classed('rectangle')) {
        selectedShape.attr('height', shapeHeightInput.value);
        selectedShape.attr('y', selectedShape.attr('y')); // Optional: Adjust position if needed
      }
    });
  } else {
    console.error("Elementul cu ID 'shapeHeight' nu a fost găsit.");
  }
  
  if (deleteShapeButton) {
    deleteShapeButton.addEventListener('click', () => {
      if (selectedShape) {
        selectedShape.remove();
        selectedShape = null;
        updateShapeControls();
      } else {
        alert(translations[languageSelector.value].selectShape);
      }
    });
  } else {
    console.error("Elementul cu ID 'deleteShape' nu a fost găsit.");
  }
  
  // Helper function to convert RGB to Hex
  function rgbToHex(rgb) {
    // Handle rgb or hex inputs
    if (rgb.startsWith('#')) {
      return rgb;
    }
    const result = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(rgb);
    return result ? "#" +
      ("0" + parseInt(result[1], 10).toString(16)).slice(-2) +
      ("0" + parseInt(result[2], 10).toString(16)).slice(-2) +
      ("0" + parseInt(result[3], 10).toString(16)).slice(-2) : '#000000';
  }
  
  // Create a separate group for shapes to keep them independent of the map
  const shapesGroup = svg.append("g")
    .attr("id", "shapesGroup");

  // Function to handle adding a circle (modified to append to shapesGroup)
  function handleAddCircle() {
    const circle = shapesGroup.append('circle')
      .attr('cx', svgWidth / 2)
      .attr('cy', svgHeight / 2)
      .attr('r', 50)
      .attr('fill', currentGradient.start)
      .attr('opacity', currentGradient.end)
      .attr('class', 'circle') // Assign 'circle' class
      .call(shapeDrag); // Apply drag behavior

    circle.on('click', function() {
      selectShape(d3.select(this));
    });
  }

  // Update the updateShapeControls function to handle radius
  function updateShapeControls() {
    if (selectedShape) {
      shapeControls.style.display = 'block';
      if (selectedShape.classed('rectangle')) {
        shapeWidthInput.style.display = 'block';
        shapeHeightInput.style.display = 'block';
        shapeRadiusInput.style.display = 'none';
        shapeWidthInput.value = selectedShape.attr('width');
        shapeHeightInput.value = selectedShape.attr('height');
        shapeWidthInput.disabled = false;
        shapeHeightInput.disabled = false;
      } else if (selectedShape.classed('circle')) {
        shapeRadiusInput.style.display = 'block';
        shapeWidthInput.style.display = 'none';
        shapeHeightInput.style.display = 'none';
        shapeRadiusInput.value = selectedShape.attr('r');
        shapeWidthInput.disabled = true;
        shapeHeightInput.disabled = true;
      }
      const currentColor = selectedShape.attr('fill') || '#000000';
      const currentOpacity = selectedShape.attr('opacity') || 1;
      shapeColorInput.value = rgbToHex(currentColor);
      shapeTransparencyInput.value = currentOpacity;
    } else {
      shapeControls.style.display = 'none';
    }
  }

  // Add event listener for radius adjustment
  if (shapeRadiusInput) {
    shapeRadiusInput.addEventListener('input', () => {
      if (selectedShape && selectedShape.classed('circle')) {
        selectedShape.attr('r', shapeRadiusInput.value);
      }
    });
  } else {
    console.error("Elementul cu ID 'shapeRadius' nu a fost găsit.");
  }

  // Ensure shapesGroup is not affected by map transformations
  function applyZoomBehavior() {
    svg.call(zoomBehavior);
    
    zoomBehavior.on("zoom", (event) => {
      gMap.attr("transform", event.transform);
      // shapesGroup remains without transform
    });
  }

  // Define shape drag behavior
  const shapeDrag = d3.drag()
    .on('start', (event) => {
      d3.select(event.sourceEvent.target).raise().classed('active', true);
    })
    .on('drag', (event) => {
      const shape = d3.select(event.sourceEvent.target);
      shape.attr('cx', +shape.attr('cx') + event.dx)
           .attr('cy', +shape.attr('cy') + event.dy)
           .attr('x', +shape.attr('x') + event.dx)
           .attr('y', +shape.attr('y') + event.dy);
    })
    .on('end', (event) => {
      d3.select(event.sourceEvent.target).classed('active', false);
    });

  // Modify handleAddRectangle to apply drag
  function handleAddRectangle() {
    const rect = shapesGroup.append('rect')
      .attr('x', svgWidth / 2 - 50)
      .attr('y', svgHeight / 2 - 25)
      .attr('width', 100)
      .attr('height', 50)
      .attr('fill', currentGradient.start)
      .attr('opacity', currentGradient.end)
      .attr('class', 'rectangle') // Assign 'rectangle' class
      .call(shapeDrag); // Apply drag behavior
  
    rect.on('click', function() {
      selectShape(d3.select(this));
    });
  }

  // Modify handleAddCircle to apply drag
  function handleAddCircle() {
    const circle = shapesGroup.append('circle')
      .attr('cx', svgWidth / 2)
      .attr('cy', svgHeight / 2)
      .attr('r', 50)
      .attr('fill', currentGradient.start)
      .attr('opacity', currentGradient.end)
      .attr('class', 'circle') // Assign 'circle' class
      .call(shapeDrag); // Apply drag behavior
  
    circle.on('click', function() {
      selectShape(d3.select(this));
    });
  }

  // In updateShapeControls, ensure dimension fields are shown properly
  function updateShapeControls() {
    if (selectedShape) {
      shapeControls.style.display = 'block';
      if (selectedShape.classed('rectangle')) {
        shapeWidthInput.style.display = 'block';
        shapeHeightInput.style.display = 'block';
        shapeRadiusInput.style.display = 'none';
        shapeWidthInput.value = selectedShape.attr('width');
        shapeHeightInput.value = selectedShape.attr('height');
        shapeWidthInput.disabled = false;
        shapeHeightInput.disabled = false;
      } else if (selectedShape.classed('circle')) {
        shapeRadiusInput.style.display = 'block';
        shapeWidthInput.style.display = 'none';
        shapeHeightInput.style.display = 'none';
        shapeRadiusInput.value = selectedShape.attr('r');
        shapeWidthInput.disabled = true;
        shapeHeightInput.disabled = true;
      }
      const currentColor = selectedShape.attr('fill') || '#000000';
      const currentOpacity = selectedShape.attr('opacity') || 1;
      shapeColorInput.value = rgbToHex(currentColor);
      shapeTransparencyInput.value = currentOpacity;
    } else {
      shapeControls.style.display = 'none';
    }
  }

  // Keep shapesGroup untransformed in applyZoomBehavior
  function applyZoomBehavior() {
    svg.call(zoomBehavior);
    zoomBehavior.on('zoom', (event) => {
      gMap.attr('transform', event.transform);
      // shapesGroup remains without transform
    });
  }
  
  // Referințe la noile elemente DOM pentru ajustarea dimensiunii legendelor
  const legendWidthInput = document.getElementById("legendWidth");
  const legendHeightInput = document.getElementById("legendHeight");

  if (legendWidthInput) {
    legendWidthInput.addEventListener("input", (e) => {
      document.documentElement.style.setProperty('--legend-width', `${e.target.value}px`);
    });
  } else {
    console.error("Elementul cu ID 'legendWidth' nu a fost găsit.");
  }

  if (legendHeightInput) {
    legendHeightInput.addEventListener("input", (e) => {
      document.documentElement.style.setProperty('--legend-height', `${e.target.value}px`);
    });
  } else {
    console.error("Elementul cu ID 'legendHeight' nu a fost găsit.");
  }
  
  const addTitleButton = document.getElementById("addTitle");
  const removeTitleButton = document.getElementById("removeTitle");
  const titleInput = document.getElementById("titleInput");
  const titleFontSelect = document.getElementById("titleFont");
  const titleSizeInput = document.getElementById("titleSize");
  const titleColorInput = document.getElementById("titleColor");
  const titleBoldCheckbox = document.getElementById("titleBold");
  const titleItalicCheckbox = document.getElementById("titleItalic");
  // const mapContainer = document.querySelector('.map-column');

  let titleElement = null;

  // Function to add new title
  function addTitle() {
    const text = titleInput.value.trim();
    if (text === "") return;

    if (titleElement) {
      mapContainer.removeChild(titleElement);
    }

    titleElement = document.createElement('div');
    titleElement.className = 'map-title';
    titleElement.contentEditable = true;
    titleElement.style.fontFamily = titleFontSelect.value;
    titleElement.style.fontSize = `${titleSizeInput.value}px`;
    titleElement.style.color = titleColorInput.value;
    titleElement.style.fontWeight = titleBoldCheckbox.checked ? 'bold' : 'normal';
    titleElement.style.fontStyle = titleItalicCheckbox.checked ? 'italic' : 'normal';
    titleElement.innerText = text;
    mapContainer.appendChild(titleElement);

    // Make the title draggable
    d3.select(titleElement).call(d3.drag()
      .on('drag', (event) => {
        titleElement.style.left = `${event.x}px`;
        titleElement.style.top = `${event.y}px`;
      })
    );

    // Add event listener for editing
    titleElement.addEventListener('blur', () => {
      titleInput.value = titleElement.innerText.trim();
    });
  }

  // Function to remove the title
  function removeTitle() {
    if (titleElement) {
      mapContainer.removeChild(titleElement);
      titleElement = null;
      titleInput.value = "";
    }
  }

  // Event listener for adding title
  if (addTitleButton) {
    addTitleButton.addEventListener("click", addTitle);
  } else {
    console.error("Elementul cu ID 'addTitle' nu a fost găsit.");
  }

  // Event listener for removing title
  if (removeTitleButton) {
    removeTitleButton.addEventListener("click", removeTitle);
  } else {
    console.error("Elementul cu ID 'removeTitle' nu a fost găsit.");
  }

  // Event listeners for title controls
  titleInput.addEventListener('input', () => {
    if (titleElement) {
      titleElement.innerText = titleInput.value;
    }
  });

  titleFontSelect.addEventListener('change', () => {
    if (titleElement) {
      titleElement.style.fontFamily = titleFontSelect.value;
    }
  });

  titleSizeInput.addEventListener('input', () => {
    if (titleElement) {
      titleElement.style.fontSize = `${titleSizeInput.value}px`;
    }
  });

  titleColorInput.addEventListener('input', () => {
    if (titleElement) {
      titleElement.style.color = titleColorInput.value;
    }
  });

  titleBoldCheckbox.addEventListener('change', () => {
    if (titleElement) {
      titleElement.style.fontWeight = titleBoldCheckbox.checked ? 'bold' : 'normal';
    }
  });

  titleItalicCheckbox.addEventListener('change', () => {
    if (titleElement) {
      titleElement.style.fontStyle = titleItalicCheckbox.checked ? 'italic' : 'normal';
    }
  });
  
  // Add reference to the new legendBorder checkbox
  const legendBorderCheckbox = document.getElementById("legendBorder");

  // Function to toggle legend border
  function toggleLegendBorder() {
    const legend = d3.select("#legendGroup");
    if (legendBorderCheckbox.checked) {
      legend.classed("no-border", false);
    } else {
      legend.classed("no-border", true);
    }
  }

  // Event listener for legendBorder checkbox
  if (legendBorderCheckbox) {
    legendBorderCheckbox.addEventListener("change", toggleLegendBorder);
  } else {
    console.error("Elementul cu ID 'legendBorder' nu a fost găsit.");
  }
  
  // Step 2: Define translation strings
  const translations = {
    ro: {
        controlPanelTitle: "Setările hărții",
        selectMap: "Selectează Harta",
        // Add all other translation keys and their Romanian translations
        exportAsPNG: "Exportă ca PNG",
        selectGradient: "Selectează Gradient",
        // Continue for all control panel texts
        backgroundSettings: "Setările fundalului",
        color: "Culoare",
        transparency: "Transparență",
        canvasWidth: "Lățime Canvas (px)",
        canvasHeight: "Înălțime Canvas (px)",
        gradient: "Gradient",
        categoricalData: "Date categorice",
        chooseCategories: "Alege una sau mai multe categorii",
        addCategory: "Adaugă Categorie",
        addText: "Adaugă Text",
        font: "Font",
        size: "Mărime (px)",
        border: "Chenar",
        bold: "Bold",
        italic: "Italic",
        addTextButton: "Adaugă Text",
        removeTextButton: "Elimină Text",
        addTitle: "Adaugă Titlu",
        addTitleButton: "Adaugă Titlu",
        removeTitleButton: "Elimină Titlu",
        geometricShapes: "Forme geometrice",
        addGeometricShape: "Adaugă o formă geometrică",
        addRectangle: "Adaugă Dreptunghi",
        addCircle: "Adaugă Cerc",
        deleteShape: "Șterge Forma",
        dataTable: "Tabel de Date",
        regionCountry: "Regiune/Țară",
        value: "Valoare",
        category: "Categorie",
        resetData: "Resetează datele",
        controlValuesOnMap: "Control Valori pe Harta",
        toggleValues: "Afișează/Ascunde Valorile",
        fontSize: "Mărime Font",
        fontColor: "Culoare Font",
        styleLegends: "Stilizează legendele",
        fontStyle: "Stil Font",
        bgTransparency: "Transparență Fundal",
        legendWidth: "Lățime Legendă (px)",
        legendHeight: "Înălțime Legendă (px)",
        toggleLegend: "Ascunde/Adaugă Legenda",
        toggleNumericLegend: "Afișează/Ascunde Legenda Numerică",
        futureFeatures: "Viitoare Funcționalități",
        futureFeatureDescription: "Aici va fi adăugată funcționalitatea viitoare.",
        language: "Limba",
        categoryNamePlaceholder: "Nume Categorie",
        textPlaceholder: "Introdu Textul",
        titlePlaceholder: "Introdu Titlul",
        presetGradient: "Gradient Presetat",
        selectPresetGradient: "Selectează un Gradient Presetat",
        minValueColor: "Culoare valori minime",
        maxValueColor: "Culoare valori maxime",
        applyCustomGradient: "Aplică Gradient Personalizat",
        // Adăugăm traducerile pentru funcționalitatea CSV
        csvImport: "Import din CSV",
        importCSV: "Importă CSV",
        csvTemplate: "Format CSV: Region,Value",
        downloadTemplate: "Descarcă Template",
        selectCsvFile: "Vă rugăm selectați un fișier CSV",
        
        // Adăugăm traduceri pentru adjustarea formelor
        adjustShape: "Ajustează Forma",
        width: "Lățime",
        height: "Înălțime",
        radius: "Rază",
        selectShape: "Selectați o formă pentru a o șterge",
    },
    en: {
        legendTitle: "Legend",
        controlPanelTitle: "Map Settings",
        selectMap: "Select Map",
        // Add all other translation keys and their English translations
        exportAsPNG: "Export as PNG",
        selectGradient: "Select Gradient",
        // Continue for all control panel texts
        backgroundSettings: "Background Settings",
        color: "Color",
        transparency: "Transparency",
        canvasWidth: "Canvas Width (px)",
        canvasHeight: "Canvas Height (px)",
        gradient: "Gradient",
        categoricalData: "Categorical Data",
        chooseCategories: "Choose one or more categories",
        addCategory: "Add Category",
        addText: "Add Text",
        font: "Font",
        size: "Size (px)",
        border: "Border",
        bold: "Bold",
        italic: "Italic",
        addTextButton: "Add Text",
        removeTextButton: "Remove Text",
        addTitle: "Add Title",
        addTitleButton: "Add Title",
        removeTitleButton: "Remove Title",
        geometricShapes: "Geometric Shapes",
        addGeometricShape: "Add a Geometric Shape",
        addRectangle: "Add Rectangle",
        addCircle: "Add Circle",
        deleteShape: "Delete Shape",
        dataTable: "Data Table",
        regionCountry: "Region/Country",
        value: "Value",
        category: "Category",
        resetData: "Reset Data",
        controlValuesOnMap: "Control Values on Map",
        toggleValues: "Show/Hide Values",
        fontSize: "Font Size",
        fontColor: "Font Color",
        styleLegends: "Style Legends",
        fontStyle: "Font Style",
        bgTransparency: "Background Transparency",
        legendWidth: "Legend Width (px)",
        legendHeight: "Legend Height (px)",
        toggleLegend: "Show/Hide Legend",
        toggleNumericLegend: "Show/Hide Numeric Legend",
        futureFeatures: "Future Features",
        futureFeatureDescription: "Future functionality will be added here.",
        language: "Language",
        categoryNamePlaceholder: "Category Name",
        textPlaceholder: "Enter your text",
        titlePlaceholder: "Enter your title",
        presetGradient: "Preset Gradient",
        selectPresetGradient: "Select a Preset Gradient",
        minValueColor: "Min Value Color",
        maxValueColor: "Max Value Color",
        applyCustomGradient: "Apply Custom Gradient",
        // Add CSV functionality translations
        csvImport: "Import from CSV",
        importCSV: "Import CSV",
        csvTemplate: "CSV Format: Region,Value",
        downloadTemplate: "Download Template",
        selectCsvFile: "Please select a CSV file",
        
        // Add shape adjustment translations
        adjustShape: "Adjust Shape",
        width: "Width",
        height: "Height",
        radius: "Radius",
        selectShape: "Select a shape to delete",
    }
};

  // Step 3: Implement language switching
  const languageSelector = document.getElementById("languageSelector");

  function setLanguage(lang) {
    document.querySelectorAll('[data-key]').forEach(element => {
      const key = element.getAttribute('data-key');
      if (translations[lang] && translations[lang][key]) {
        element.innerText = translations[lang][key];
      }
    });

    // New code to handle placeholders
    document.querySelectorAll('[data-placeholder]').forEach(element => {
      const key = element.getAttribute('data-placeholder');
      if (translations[lang][key]) {
        element.placeholder = translations[lang][key];
      }
    });
  }

  // Initialize with default language
  setLanguage(languageSelector.value);

  // Add event listener for language change
  if (languageSelector) {
      languageSelector.addEventListener("change", (e) => {
          const selectedLang = e.target.value;
          setLanguage(selectedLang);
          // Optionally, save the selected language to localStorage
          localStorage.setItem("selectedLanguage", selectedLang);
      });
  } else {
      console.error("Elementul cu ID 'languageSelector' nu a fost găsit.");
  }

  // Optionally, restore the selected language from localStorage on load
  const savedLanguage = localStorage.getItem("selectedLanguage");
  if (savedLanguage && translations[savedLanguage]) {
      languageSelector.value = savedLanguage;
      setLanguage(savedLanguage);
  }
  
  function highlightRegion(regionName) {
    d3.selectAll(".highlighted").classed("highlighted", false);
    const selected = d3.select(`[data-region-name="${regionName}"]`);
    selected.classed("highlighted", true);
    setTimeout(() => {
      selected.classed("highlighted", false);
    }, 2000);
  }
  
  // Adăugăm referințele pentru elementele CSV
  const csvFileInput = document.getElementById("csvFileInput");
  const importCSVButton = document.getElementById("importCSV");
  const downloadTemplateButton = document.getElementById("downloadTemplate");

  // Funcție pentru procesarea CSV-ului
  function processCSV(csv) {
    const lines = csv.split("\n");
    const data = {};
    
    // Ignorăm prima linie (header) și procesăm restul
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line) {
        const [region, value] = line.split(",").map(item => item.trim());
        data[region] = parseFloat(value) || 0;
      }
    }
    
    return data;
  }

  // Funcție pentru actualizarea valorilor în tabel și pe hartă
  function updateValuesFromCSV(csvData) {
    const inputs = regionTableBody.querySelectorAll("input[type='number']");
    inputs.forEach(input => {
      const regionName = decodeURIComponent(input.getAttribute("data-region"));
      if (csvData[regionName] !== undefined) {
        input.value = csvData[regionName];
      }
    });

    // Actualizăm harta cu noile valori
    updateMapColors();
    generateBothLegends();
  }

  // Event listener pentru butonul de import CSV
  if (importCSVButton) {
    importCSVButton.addEventListener("click", () => {
      const file = csvFileInput.files[0];
      if (!file) {
        alert(translations[languageSelector.value].selectCsvFile);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const csvData = processCSV(e.target.result);
        updateValuesFromCSV(csvData);
      };
      reader.readAsText(file);
    });
  }

  // Funcție pentru descărcarea template-ului CSV
  function downloadCSVTemplate() {
    const headers = "Region,Value\n";
    let csvContent = headers;
    
    // Adăugăm toate regiunile din tabel
    const rows = regionTableBody.querySelectorAll("tr");
    rows.forEach(row => {
      const regionName = row.cells[0].textContent;
      csvContent += `${regionName},0\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'map_data_template.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // Event listener pentru descărcarea template-ului
  if (downloadTemplateButton) {
    downloadTemplateButton.addEventListener("click", downloadCSVTemplate);
  }
  
});
