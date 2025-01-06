document.addEventListener("DOMContentLoaded", () => {
  // Referințe la elementele DOM
  const mapSelector = document.getElementById("mapSelector");
  const gradientStart = document.getElementById("gradientStart");
  const gradientEnd = document.getElementById("gradientEnd");
  const applyGradientButton = document.getElementById("applyGradient");
  const regionTableBody = document.getElementById("regionTable").querySelector("tbody");
  const exportButton = document.getElementById("exportMap");
  const legendTitleInput = document.getElementById("legendTitle"); // Add this here
  const legendDecimalsInput = document.getElementById("legendDecimals");
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

  // Add this with other DOM element references at the top
  // const legendTitleInput = document.getElementById("legendTitle");

  // Add near the top with other DOM references
  const darkModeToggle = document.getElementById("darkModeToggle");

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
  let intermediateColors = [];
  const addIntermediateColorBtn = document.getElementById('addIntermediateColor');
  const intermediateColorsContainer = document.getElementById('intermediateColors');

  if (addIntermediateColorBtn && intermediateColorsContainer) {
    addIntermediateColorBtn.addEventListener('click', () => {
      if (intermediateColors.length < 3) {
        const colorId = 'intermediateColor' + (intermediateColors.length + 1);
        intermediateColors.push(colorId);
        const wrapper = document.createElement('div');
        wrapper.className = 'color-picker';
        wrapper.id = colorId + '_wrapper';
        wrapper.innerHTML = `
          <label for="${colorId}">Culoare Intermediară #${intermediateColors.length}:</label>
          <input type="color" id="${colorId}" value="#ffff00" />
          <button type="button" class="removeColorBtn" data-color-id="${colorId}">X</button>
        `;
        intermediateColorsContainer.appendChild(wrapper);
      } else {
        alert('Ai atins numărul maxim de 3 culori intermediare.');
      }
    });

    // Remove an intermediate color
    intermediateColorsContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('removeColorBtn')) {
        const colorId = e.target.getAttribute('data-color-id');
        intermediateColors = intermediateColors.filter(id => id !== colorId);
        const wrapper = document.getElementById(colorId + '_wrapper');
        if (wrapper) wrapper.remove();
      }
    });
  }

  function applyCustomGradient() {
    currentGradient.start = gradientStart.value;
    currentGradient.end = gradientEnd.value;

    // Optional: incorporate intermediateColors if they exist
    const colorPoints = [];
    // Add start color
    colorPoints.push({ offset: 0, color: currentGradient.start });

    // For each extra color, spread them evenly
    intermediateColors.forEach((id, i) => {
      const inputEl = document.getElementById(id);
      if (inputEl) {
        // calculate offset in a flexible way
        const offset = (i + 1) / (intermediateColors.length + 1);
        colorPoints.push({ offset, color: inputEl.value });
      }
    });

    // Add end color
    colorPoints.push({ offset: 1, color: currentGradient.end });

    // Now apply or process colorPoints as needed
    // Example: console.log(colorPoints);

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
        generateAllLegends(); // Actualizează legenda
        updateMapColors();
      });
    });

    generateAllLegends(); // Generează legenda după actualizarea listei de categorii
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

    const colorScale = getSharedColorScale(values, currentGradient);

    gMap.selectAll("path").each(function (d) {
      const regionName = encodeURIComponent(d.properties.NAME || d.properties.name || d.properties.region_nam ||d.properties.nume_regiu ||d.properties.cntry_name || "Unknown");
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
        const fillColor = colorScale(value);
        d3.select(this).attr("fill", fillColor);
      } else {
        d3.select(this).attr("fill", "#ccc"); // Gri pentru valoare 0 sau lipsă
      }
    });

    gMap.selectAll("path")
      .transition()
      .duration(500)
      .attr("fill", d => getFillColor(d));

    generateAllLegends();
    updateValueLabels();
    updateProportionalCircles();
  }

  // Calculăm culoarea pe baza gradientului personalizat sau presetat
  function getColor(value, maxValue, gradient) {
    // Build color array: start -> intermediates -> end
    const stops = [];
    stops.push({ offset: 0, color: gradient.start });
    intermediateColors.forEach((id, i) => {
      const el = document.getElementById(id);
      if (el) {
        const offset = (i + 1) / (intermediateColors.length + 1);
        stops.push({ offset, color: el.value });
      }
    });
    stops.push({ offset: 1, color: gradient.end });

    // Use stops to determine the color (replace with your interpolation logic)
    const scale = d3.scaleLinear()
      .domain(stops.map(s => s.offset * maxValue))
      .range(stops.map(s => s.color));

    return scale(value);
  }

  // Funcționalitate Tooltip
  function showTooltip(event, d) {
    const regionName = d.properties.NAME || d.properties.name || d.properties.region_nam ||d.properties.nume_regiu || d.properties.cntry_name || "Unknown";
    const value = getRegionValue(d);
    const category = getRegionCategory(d);
    let tooltipContent = `<strong>${regionName}</strong>`;
  
    if (value && value !== 'NA') {
      tooltipContent += `<br>Valoare: ${value}`;
    }
  
    if (category && category !== 'NA') {
      tooltipContent += `<br>Categorie: ${category}`;
    }
  
    tooltip.style("visibility", "visible")
           .html(tooltipContent)
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
    const regionName = encodeURIComponent(d.properties.NAME || d.properties.name ||d.properties.region_nam || d.properties.nume_regiu ||d.properties.cntry_name ||"Unknown");
    const input = document.querySelector(`[data-region="${regionName}"]`);
    return input ? parseFloat(input.value) || 0 : 0;
  }

  // Funcție pentru a obține categoria unei regiuni
  function getRegionCategory(d) {
    const regionName = encodeURIComponent(d.properties.NAME || d.properties.name ||d.properties.region_nam ||d.properties.nume_regiu ||d.properties.cntry_name ||"Unknown");
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

      // Separate polygon and point features
      const polygonFeatures = data.features.filter(f => 
        f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'
      );
      const pointFeatures = data.features.filter(f => 
        f.geometry.type === 'Point'
      );

      // Store point coordinates for each region
      const pointLocations = {};
      pointFeatures.forEach(point => {
        const regionName = point.properties.NAME || point.properties.name || 
                          point.properties.region_nam || point.properties.nume_regiu||point.properties.cntry_name;
        if (regionName) {
          pointLocations[regionName] = point.geometry.coordinates;
        }
      });

      // Store point coordinates globally
      window.pointLocations = {};
      pointFeatures.forEach(point => {
        const regionName = point.properties.NAME || point.properties.name || 
                          point.properties.region_nam || point.properties.nume_regiu||point.properties.cntry_name;
        if (regionName) {
          window.pointLocations[regionName] = point.geometry.coordinates;
        }
      });

      // Use only polygon features for the map rendering
      geoDataFeatures = polygonFeatures;

      projection = d3.geoMercator()
        .fitSize([svgWidth, svgHeight], {
          type: 'FeatureCollection',
          features: polygonFeatures
        });

      const path = d3.geoPath().projection(projection);

      gMap.selectAll("path").remove();

      gMap.selectAll("path")
        .data(polygonFeatures)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("fill", "#ccc")
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.3)
        .attr("data-region-name", d => d.properties.name)
        .attr("class", "region")
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

      // Modify getRegionPointOnSurface to use point coordinates if available
      window.getRegionPointOnSurface = function(feature) {
        const regionName = feature.properties.NAME || feature.properties.name || 
                          feature.properties.region_nam || feature.properties.nume_regiu||feature.properties.cntry_name;
        if (pointLocations[regionName]) {
          // Return the coordinates from the points layer
          return pointLocations[regionName];
        }
        // Fallback to calculating centroid if no point is found
        const point = turf.pointOnFeature(feature);
        return point.geometry.coordinates;
      };

      generateTable(polygonFeatures);
      updateMapColors();
      updateMapOutlines(); // Apply outlines to newly loaded shapes
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
      const regionName = feature.properties.NAME || feature.properties.name || feature.properties.region_nam ||feature.properties.nume_regiu ||feature.properties.cntry_name ||"Unknown";
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
        generateAllLegends();
        calculateStatistics(); // Add statistics calculation
      });
    });

    generateAllLegends(); // Generează legenda după actualizarea tabelului
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
  function generateAllLegends() {
    const legendItemsGroup = d3.select("#legendItems");
    legendItemsGroup.selectAll("*").remove(); // Clear existing legend

    // Update the legend title with current font and size settings
    const legendFont = document.getElementById("legendFont").value;
    const legendFontSize = document.getElementById("legendFontSize").value;
    
    // Update title text and styles
    const legendTitle = d3.select("#legendTitle")
      .text(legendTitleInput.value || "Legendă")
      .style("font-family", legendFont)
      .style("font-size", `${legendFontSize}px`)
      .attr("text-anchor", "start"); // Left-align legend title

    let yOffset = 30;

    // Check if there are any active categories on the map
    const hasActiveCategories = Array.from(regionTableBody.querySelectorAll("select"))
      .some(select => select.value !== "");

    if (hasActiveCategories) {
        // Show only categories if they are being used
        categories.forEach((category, index) => {
            // Only show categories that are actually used on the map
            const isCategoryUsed = Array.from(regionTableBody.querySelectorAll("select"))
                .some(select => select.value === index.toString());
            
            if (isCategoryUsed) {
                const legendItem = legendItemsGroup.append("g")
                    .attr("class", "legend-item")
                    .attr("transform", `translate(10, ${yOffset})`);

                legendItem.append("rect")
                    .attr("width", 20)
                    .attr("height", 20)
                    .attr("fill", category.color);

                legendItem.append("text")
                    .attr("x", 30)
                    .attr("y", 15)
                    .attr("class", "legend-text")
                    .attr("text-anchor", "start") // Left-align text items
                    .text(category.name);

                yOffset += 25;
            }
        });
    } else {
        // Show numeric intervals only if no categories are being used
        const values = Array.from(regionTableBody.querySelectorAll('input[type="number"]'))
            .map(input => parseFloat(input.value) || 0)
            .filter(val => val > 0);

        if (values.length > 0) {
            const minValue = Math.min(...values);
            const maxValue = Math.max(...values);
            
            const numIntervals = parseInt(document.getElementById("legendIntervals").value) || 5;
            const decimals = parseInt(legendDecimalsInput.value, 10);
            const effectiveDecimals = isNaN(decimals) ? 1 : decimals;
            const step = (maxValue - minValue) / numIntervals;

            // Create color stops array including intermediate colors
            const colorStops = [];
            colorStops.push({ offset: 0, color: currentGradient.start });
            
            intermediateColors.forEach((id, i) => {
              const el = document.getElementById(id);
              if (el) {
                const offset = (i + 1) / (intermediateColors.length + 1);
                colorStops.push({ offset: offset, color: el.value });
              }
            });
            
            colorStops.push({ offset: 1, color: currentGradient.end });

            // Create a proper color scale that includes intermediate colors
            const colorScale = d3.scaleLinear()
              .domain(colorStops.map(stop => minValue + (maxValue - minValue) * stop.offset))
              .range(colorStops.map(stop => stop.color));

            // Generate intervals
            const sortDirection = document.getElementById("legendSortDirection").value;
            let intervals = [];
            for (let i = 0; i < numIntervals; i++) {
              const startValue = minValue + (step * i);
              const endValue = minValue + (step * (i + 1));
              // Use the middle point of the interval to determine its color
              const midValue = (startValue + endValue) / 2;
              intervals.push({
                startValue,
                endValue,
                color: colorScale(midValue) // Use midpoint for color interpolation
              });
            }

            // Sort intervals if needed
            if (sortDirection === "descending") {
              intervals.reverse();
            }

            // Generate legend items with properly interpolated colors
            intervals.forEach((interval, i) => {
              const legendItem = legendItemsGroup.append("g")
                .attr("class", "legend-item")
                .attr("transform", `translate(10, ${yOffset + i * 25})`);

              legendItem.append("rect")
                .attr("width", 20)
                .attr("height", 20)
                .attr("fill", interval.color);

              legendItem.append("text")
                .attr("x", 30)
                .attr("y", 15)
                .attr("class", "legend-text")
                .attr("text-anchor", "start") // Left-align text items
                .text(`${interval.startValue.toFixed(effectiveDecimals)} - ${interval.endValue.toFixed(effectiveDecimals)}`);
            });

            // Update numeric legend similarly
            if (d3.select("#numericLegendGroup").attr("visibility") !== "hidden") {
              const numericLegendGroup = d3.select("#numericLegendGroup");
              numericLegendGroup.selectAll("*").remove();

              // Create gradient definition with proper intermediate stops
              const defs = numericLegendGroup.append("defs");
              const gradient = defs.append("linearGradient")
                .attr("id", "numericLegendGradient")
                .attr("x1", "0%")
                .attr("y1", "0%")
                .attr("x2", "100%")
                .attr("y2", "0%");

              // Add all color stops including intermediates
              colorStops.forEach(stop => {
                gradient.append("stop")
                  .attr("offset", `${stop.offset * 100}%`)
                  .attr("stop-color", stop.color);
              });

              // Rest of numeric legend code...
              // ...existing code for numeric legend...
            }
        }
    }

    // Adjust legend background height based on content
    // const totalItems = hasActiveCategories 
    //     ? categories.filter((_, i) => Array.from(regionTableBody.querySelectorAll("select"))
    //         .some(select => select.value === i.toString())).length
    //     : parseInt(document.getElementById("legendIntervals").value);
    
    // const backgroundHeight = 20 + (totalItems * 25);
    
    // d3.select("#legendBackground")
    //     .attr("height", backgroundHeight);

    // Update numeric legend visibility based on whether categories are being used
    d3.select("#numericLegendGroup")
        .attr("visibility", hasActiveCategories ? "hidden" : "visible");

    // Numeric legend specific code
    if (!hasActiveCategories) {
      const values = Array.from(regionTableBody.querySelectorAll('input[type="number"]'))
        .map(input => parseFloat(input.value) || 0)
        .filter(val => val > 0);

      if (values.length > 0) {
        const minValue = Math.min(...values);
        const maxValue = Math.max(...values);
        const decimals = parseInt(legendDecimalsInput.value, 10) || 1;
        
        // Clear existing numeric legend
        const numericLegendGroup = d3.select("#numericLegendGroup");
        numericLegendGroup.selectAll("*").remove();

        // Create gradient definition
        const defs = numericLegendGroup.append("defs");
        const gradient = defs.append("linearGradient")
          .attr("id", "numericLegendGradient")
          .attr("x1", "0%")
          .attr("y1", "0%")
          .attr("x2", "100%")
          .attr("y2", "0%");

        // Add gradient stops
        gradient.append("stop")
          .attr("offset", "0%")
          .attr("stop-color", currentGradient.start);

        // Add intermediate color stops if they exist
        intermediateColors.forEach((id, i) => {
          const el = document.getElementById(id);
          if (el) {
            const offset = ((i + 1) / (intermediateColors.length + 1) * 100) + "%";
            gradient.append("stop")
              .attr("offset", offset)
              .attr("stop-color", el.value);
          }
        });

        gradient.append("stop")
          .attr("offset", "100%")
          .attr("stop-color", currentGradient.end);

        // Add background
        numericLegendGroup.append("rect")
          .attr("width", 180)
          .attr("height", 60)
          .attr("rx", 4)
          .attr("ry", 4)
          .attr("fill", "rgba(255, 255, 255, 0.8)");

        // Add gradient bar
        numericLegendGroup.append("rect")
          .attr("x", 10)
          .attr("y", 10)
          .attr("width", 160)
          .attr("height", 20)
          .attr("fill", "url(#numericLegendGradient)")
          .attr("rx", 2)
          .attr("ry", 2);

        // Add min value text
        numericLegendGroup.append("text")
          .attr("x", 10)
          .attr("y", 45)
          .attr("class", "legend-text")
          .style("text-anchor", "start")
          .text(minValue.toFixed(decimals));

        // Add max value text
        numericLegendGroup.append("text")
          .attr("x", 170)
          .attr("y", 45)
          .attr("class", "legend-text")
          .style("text-anchor", "end")
          .text(maxValue.toFixed(decimals));
      }
    }
    // Apply background transparency to numeric legend group if visible
    if (!hasActiveCategories) {
      d3.select("#numericLegendGroup rect")
        .attr("fill", `rgba(255, 255, 255, ${legendBgTransparency.value})`);
    }
}

  // Add event listener for interval count changes
  document.getElementById("legendIntervals").addEventListener("input", () => {
    generateAllLegends();
  });

  // Adăugăm event listener pentru numărul de zecimale
  if (legendDecimalsInput) {
    legendDecimalsInput.addEventListener("input", () => {
      generateAllLegends();
    });
  } else {
    console.error("Elementul cu ID 'legendDecimals' nu a fost găsit.");
  }

  // Afișăm ambele legende după ce actualizăm tabelul/gradientul
  function generateBothLegends() {
    // Generate main legend
    generateAllLegends();

    // Generate numeric legend if there are values
    const hasValues = regionTableBody && 
                     Array.from(regionTableBody.querySelectorAll("input"))
                     .some(input => parseFloat(input.value) > 0);

    if (hasValues) {
      generateAllLegends();
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
  loadMap("combinedMD.geojson");

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
      .attr("width", 100)
      .attr("height", 200)
      .attr("rx", 4)
      .attr("ry", 4)
      .attr("fill", "rgba(255, 255, 255, var(--legend-bg-transparency, 0.8))"); // Utilizare variabilă CSS

    // Update this part to handle cases where legendTitleInput might not exist
    const legendTitle = legendGroup.append("text")
      .attr("id", "legendTitle")
      .attr("x", 10)
      .attr("y", 20)
      .attr("class", "legend-title")
      .text("Legendă")
      .style("font-family", "'Montserrat', sans-serif")  // Default font
      .style("font-size", "14px")                        // Default size
      .style("font-weight", "500") 
      .text(legendTitleInput && legendTitleInput.value ? legendTitleInput.value : "Legendă");

    // Add event listener for title changes
    if (legendTitleInput) {
      legendTitleInput.addEventListener('input', () => {
        legendTitle.text(legendTitleInput.value || "Legendă");
      });
    }

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
    gMap.selectAll(".value-label").remove();

    gMap.selectAll(".value-label")
      .data(geoDataFeatures)
      .enter()
      .append("text")
      .attr("class", "value-label")
      .attr("text-anchor", "middle")
      .style("pointer-events", "none")
      .style("font-family", valuesFontSelect ? valuesFontSelect.value : "'Roboto', sans-serif")
      .attr("x", d => {
        const regionName = d.properties.NAME || d.properties.name || 
                          d.properties.region_nam || d.properties.nume_regiu||d.properties.cntry_name||d.properties.cntry_name;
        // First try to use saved position
        if (labelPositions[regionName]) {
          return labelPositions[regionName].x;
        }
        // Then try to use point coordinates from points layer
        if (window.pointLocations && window.pointLocations[regionName]) {
          const [x, y] = projection(window.pointLocations[regionName]);
          return x;
        }
        // Fallback to centroid if no point exists
        const coords = getRegionPointOnSurface(d);
        const [x, y] = projection(coords);
        return x;
      })
      .attr("y", d => {
        const regionName = d.properties.NAME || d.properties.name || 
                          d.properties.region_nam || d.properties.nume_regiu||d.properties.cntry_name;
        // First try to use saved position
        if (labelPositions[regionName]) {
          return labelPositions[regionName].y;
        }
        // Then try to use point coordinates from points layer
        if (window.pointLocations && window.pointLocations[regionName]) {
          const [x, y] = projection(window.pointLocations[regionName]);
          return y;
        }
        // Fallback to centroid if no point exists
        const coords = getRegionPointOnSurface(d);
        const [x, y] = projection(coords);
        return y;
      })
      .call(d3.drag()
        .on("drag", function(event, d) {
          d3.select(this)
            .attr("x", event.x)
            .attr("y", event.y);
        })
        .on("end", function(event, d) {
          const regionName = d.properties.NAME;
          labelPositions[regionName] = { x: event.x, y: event.y };
          localStorage.setItem("labelPositions", JSON.stringify(labelPositions));
        })
      );
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
        const regionName = d.properties.NAME || d.properties.name || 
                          d.properties.region_nam || d.properties.nume_regiu||d.properties.cntry_name;
        if (labelPositions[regionName]) {
          return labelPositions[regionName].x;
        }
        if (window.pointLocations && window.pointLocations[regionName]) {
          const [x, y] = projection(window.pointLocations[regionName]);
          return x;
        }
        const coords = getRegionPointOnSurface(d);
        const [x, y] = projection(coords);
        return x;
      })
      .attr("y", d => {
        const regionName = d.properties.NAME || d.properties.name || 
                          d.properties.region_nam || d.properties.nume_regiu||d.properties.cntry_name;
        if (labelPositions[regionName]) {
          return labelPositions[regionName].y;
        }
        if (window.pointLocations && window.pointLocations[regionName]) {
          const [x, y] = projection(window.pointLocations[regionName]);
          return y;
        }
        const coords = getRegionPointOnSurface(d);
        const [x, y] = projection(coords);
        return y;
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
    generateAllLegends();
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
    mapContainer.style.height = canvasHeightInput.value + "px";
  }

  [canvasColorInput, canvasTransparencyInput, canvasHeightInput]
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

  // Referințe la noile elemente DOM pentru ajustarea dimensiunii legendelor
  const legendWidthInput = document.getElementById("legendWidth");
  const legendHeightInput = document.getElementById("legendHeight");

  if (legendWidthInput) {
    legendWidthInput.addEventListener("input", () => {
      updateLegendDimensions();
    });
  } else {
    console.error("Elementul cu ID 'legendWidth' nu a fost găsit.");
  }

  if (legendHeightInput) {
    legendHeightInput.addEventListener("input", () => {
      updateLegendDimensions();
    });
  } else {
    console.error("Elementul cu ID 'legendHeight' nu a fost găsit.");
  }

  // Function to update legend dimensions
  function updateLegendDimensions() {
    const width = parseInt(legendWidthInput.value, 10) || 200;
    const height = parseInt(legendHeightInput.value, 10) || 100;

    // Actualizăm doar legenda principală
    d3.select("#legendBackground")
      .attr("width", width)
      .attr("height", height);

    // Actualizăm și containerul pentru elementele legendei
    d3.select("#legendItems")
      .attr("width", width)
      .attr("height", height - 30); // Scădem spațiul pentru titlu

    // Regenerăm doar legenda principală, păstrând legenda cu simboluri neschimbată
    if (!d3.select("#legendGroup").attr("visibility") === "hidden") {
      generateAllLegends();
    }
  }

  // Modificăm funcția generateAllLegends pentru a păstra dimensiunile legendei cu simboluri
  function generateAllLegends() {
    const legendItemsGroup = d3.select("#legendItems");
    legendItemsGroup.selectAll("*").remove(); // Clear existing legend

    // Update the legend title with current font and size settings
    const legendFont = document.getElementById("legendFont").value;
    const legendFontSize = document.getElementById("legendFontSize").value;
    
    // Update title text and styles
    const legendTitle = d3.select("#legendTitle")
      .text(legendTitleInput.value || "Legendă")
      .style("font-family", legendFont)
      .style("font-size", `${legendFontSize}px`)
      .attr("text-anchor", "start"); // Left-align legend title

    let yOffset = 30;

    // Check if there are any active categories on the map
    const hasActiveCategories = Array.from(regionTableBody.querySelectorAll("select"))
      .some(select => select.value !== "");

    if (hasActiveCategories) {
        // Show only categories if they are being used
        categories.forEach((category, index) => {
            // Only show categories that are actually used on the map
            const isCategoryUsed = Array.from(regionTableBody.querySelectorAll("select"))
                .some(select => select.value === index.toString());
            
            if (isCategoryUsed) {
                const legendItem = legendItemsGroup.append("g")
                    .attr("class", "legend-item")
                    .attr("transform", `translate(10, ${yOffset})`);

                legendItem.append("rect")
                    .attr("width", 20)
                    .attr("height", 20)
                    .attr("fill", category.color);

                legendItem.append("text")
                    .attr("x", 30)
                    .attr("y", 15)
                    .attr("class", "legend-text")
                    .attr("text-anchor", "start") // Left-align text items
                    .text(category.name);

                yOffset += 25;
            }
        });
    } else {
        // Show numeric intervals only if no categories are being used
        const values = Array.from(regionTableBody.querySelectorAll('input[type="number"]'))
            .map(input => parseFloat(input.value) || 0)
            .filter(val => val > 0);

        if (values.length > 0) {
            const minValue = Math.min(...values);
            const maxValue = Math.max(...values);
            
            const numIntervals = parseInt(document.getElementById("legendIntervals").value) || 5;
            const decimals = parseInt(legendDecimalsInput.value, 10);
            const effectiveDecimals = isNaN(decimals) ? 1 : decimals;
            const step = (maxValue - minValue) / numIntervals;

            // Create color stops array including intermediate colors
            const colorStops = [];
            colorStops.push({ offset: 0, color: currentGradient.start });
            
            intermediateColors.forEach((id, i) => {
              const el = document.getElementById(id);
              if (el) {
                const offset = (i + 1) / (intermediateColors.length + 1);
                colorStops.push({ offset: offset, color: el.value });
              }
            });
            
            colorStops.push({ offset: 1, color: currentGradient.end });

            // Create a proper color scale that includes intermediate colors
            const colorScale = d3.scaleLinear()
              .domain(colorStops.map(stop => minValue + (maxValue - minValue) * stop.offset))
              .range(colorStops.map(stop => stop.color));

            // Generate intervals
            const sortDirection = document.getElementById("legendSortDirection").value;
            let intervals = [];
            for (let i = 0; i < numIntervals; i++) {
              const startValue = minValue + (step * i);
              const endValue = minValue + (step * (i + 1));
              // Use the middle point of the interval to determine its color
              const midValue = (startValue + endValue) / 2;
              intervals.push({
                startValue,
                endValue,
                color: colorScale(midValue) // Use midpoint for color interpolation
              });
            }

            // Sort intervals if needed
            if (sortDirection === "descending") {
              intervals.reverse();
            }

            // Generate legend items with properly interpolated colors
            intervals.forEach((interval, i) => {
              const legendItem = legendItemsGroup.append("g")
                .attr("class", "legend-item")
                .attr("transform", `translate(10, ${yOffset + i * 25})`);

              legendItem.append("rect")
                .attr("width", 20)
                .attr("height", 20)
                .attr("fill", interval.color);

              legendItem.append("text")
                .attr("x", 30)
                .attr("y", 15)
                .attr("class", "legend-text")
                .attr("text-anchor", "start") // Left-align text items
                .text(`${interval.startValue.toFixed(effectiveDecimals)} - ${interval.endValue.toFixed(effectiveDecimals)}`);
            });

            // Update numeric legend similarly
            if (d3.select("#numericLegendGroup").attr("visibility") !== "hidden") {
              const numericLegendGroup = d3.select("#numericLegendGroup");
              numericLegendGroup.selectAll("*").remove();

              // Create gradient definition with proper intermediate stops
              const defs = numericLegendGroup.append("defs");
              const gradient = defs.append("linearGradient")
                .attr("id", "numericLegendGradient")
                .attr("x1", "0%")
                .attr("y1", "0%")
                .attr("x2", "100%")
                .attr("y2", "0%");

              // Add all color stops including intermediates
              colorStops.forEach(stop => {
                gradient.append("stop")
                  .attr("offset", `${stop.offset * 100}%`)
                  .attr("stop-color", stop.color);
              });

              // Rest of numeric legend code...
              // ...existing code for numeric legend...
            }
        }
    }


    // Update numeric legend visibility based on whether categories are being used
    d3.select("#numericLegendGroup")
        .attr("visibility", hasActiveCategories ? "hidden" : "visible");

    // Numeric legend specific code
    if (!hasActiveCategories) {
      const values = Array.from(regionTableBody.querySelectorAll('input[type="number"]'))
        .map(input => parseFloat(input.value) || 0)
        .filter(val => val > 0);

      if (values.length > 0) {
        const minValue = Math.min(...values);
        const maxValue = Math.max(...values);
        const decimals = parseInt(legendDecimalsInput.value, 10) || 1;
        
        // Clear existing numeric legend
        const numericLegendGroup = d3.select("#numericLegendGroup");
        numericLegendGroup.selectAll("*").remove();

        // Create gradient definition
        const defs = numericLegendGroup.append("defs");
        const gradient = defs.append("linearGradient")
          .attr("id", "numericLegendGradient")
          .attr("x1", "0%")
          .attr("y1", "0%")
          .attr("x2", "100%")
          .attr("y2", "0%");

        // Add gradient stops
        gradient.append("stop")
          .attr("offset", "0%")
          .attr("stop-color", currentGradient.start);

        // Add intermediate color stops if they exist
        intermediateColors.forEach((id, i) => {
          const el = document.getElementById(id);
          if (el) {
            const offset = ((i + 1) / (intermediateColors.length + 1) * 100) + "%";
            gradient.append("stop")
              .attr("offset", offset)
              .attr("stop-color", el.value);
          }
        });

        gradient.append("stop")
          .attr("offset", "100%")
          .attr("stop-color", currentGradient.end);

        // Add background
        numericLegendGroup.append("rect")
          .attr("width", 180)
          .attr("height", 60)
          .attr("rx", 4)
          .attr("ry", 4)
          .attr("fill", "rgba(255, 255, 255, 0.8)");

        // Add gradient bar
        numericLegendGroup.append("rect")
          .attr("x", 10)
          .attr("y", 10)
          .attr("width", 160)
          .attr("height", 20)
          .attr("fill", "url(#numericLegendGradient)")
          .attr("rx", 2)
          .attr("ry", 2);

        // Add min value text
        numericLegendGroup.append("text")
          .attr("x", 10)
          .attr("y", 45)
          .attr("class", "legend-text")
          .style("text-anchor", "start")
          .text(minValue.toFixed(decimals));

        // Add max value text
        numericLegendGroup.append("text")
          .attr("x", 170)
          .attr("y", 45)
          .attr("class", "legend-text")
          .style("text-anchor", "end")
          .text(maxValue.toFixed(decimals));
      }
    }
    // Apply background transparency to numeric legend group if visible
    if (!hasActiveCategories) {
      d3.select("#numericLegendGroup rect")
        .attr("fill", `rgba(255, 255, 255, ${legendBgTransparency.value})`);
    }
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
        // Trigger the input event to ensure all updates occur
        const event = new Event('input', { bubbles: true });
        input.dispatchEvent(event);
      }
    });

    // Update everything
    updateMapColors();
    generateAllLegends();
    calculateStatistics();
    updateAnalysisTable(); // Add this line to update analysis table
  }

  // Event listener pentru butonul de import CSV
  if (importCSVButton) {
    importCSVButton.addEventListener("click", () => {
      const file = csvFileInput.files[0];
      if (!file) {
        alert("Vă rugăm selectați un fișier CSV");
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
    // Adăugăm BOM pentru UTF-8
    const BOM = '\uFEFF';
    const headers = "Region,Value\n";
    let csvContent = BOM + headers;
    
    // Adăugăm toate regiunile din tabel
    const rows = regionTableBody.querySelectorAll("tr");
    rows.forEach(row => {
      const regionName = row.cells[0].textContent;
      // Folosim textContent în loc de innerText pentru a păstra diacriticele
      csvContent += `${regionName},0\n`;
    });

    // Folosim blob cu encoding UTF-8
    const blob = new Blob([csvContent], { 
      type: 'text/csv;charset=utf-8'
    });
    
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'map_data_template.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  // Event listener pentru descărcarea template-ului
  if (downloadTemplateButton) {
    downloadTemplateButton.addEventListener("click", downloadCSVTemplate);
  }
  
  // Adăugăm referințele pentru noile elemente
  const searchInput = document.getElementById("searchRegions");
  const sortByNameBtn = document.getElementById("sortByName");
  const sortByValueBtn = document.getElementById("sortByValue");

  let sortNameAsc = true;
  let sortValueAsc = true;

  // Funcție pentru căutare în tabel
  function searchTable() {
      const searchText = searchInput.value.toLowerCase();
      const rows = regionTableBody.querySelectorAll("tr");
      let hasResults = false;

      rows.forEach(row => {
          const regionName = row.cells[0].textContent.toLowerCase();
          const match = regionName.includes(searchText);
          row.style.display = match ? "" : "none";
          row.classList.toggle("highlight-search", match && searchText.length > 0);
          if (match) hasResults = true;
      });

      // Afișăm mesaj dacă nu sunt rezultate
      const existingMsg = regionTableBody.querySelector(".no-results");
      if (!hasResults && searchText.length > 0) {
          if (!existingMsg) {
              const noResultsRow = document.createElement("tr");
              noResultsRow.className = "no-results";
              noResultsRow.innerHTML = `<td colspan="3">Nu s-au găsit rezultate</td>`;
              regionTableBody.appendChild(noResultsRow);
          }
      } else if (existingMsg) {
          existingMsg.remove();
      }
  }

  // Funcții pentru sortare
  function sortTableByName() {
      const rows = Array.from(regionTableBody.querySelectorAll("tr"));
      sortNameAsc = !sortNameAsc;
      
      rows.sort((a, b) => {
          const nameA = a.cells[0].textContent.toLowerCase();
          const nameB = b.cells[0].textContent.toLowerCase();
          return sortNameAsc ? 
              nameA.localeCompare(nameB) : 
              nameB.localeCompare(nameA);
      });

      rows.forEach(row => regionTableBody.appendChild(row));
      
      // Actualizăm textul butonului folosind traducerea corectă
      const currentLang = languageSelector.value;
      sortByNameBtn.setAttribute('data-key', 'sortByName');
      sortByNameBtn.textContent = `Sortare după nume ↕ ${sortNameAsc ? '↓' : '↑'}`;
  }

  function sortTableByValue() {
      const rows = Array.from(regionTableBody.querySelectorAll("tr"));
      sortValueAsc = !sortValueAsc;
      
      rows.sort((a, b) => {
          const valueA = parseFloat(a.querySelector('input[type="number"]')?.value) || 0;
          const valueB = parseFloat(b.querySelector('input[type="number"]')?.value) || 0;
          return sortValueAsc ? valueA - valueB : valueB - valueA;
      });

      rows.forEach(row => regionTableBody.appendChild(row));
      
      // Actualizăm textul butonului folosind traducerea corectă
      const currentLang = languageSelector.value;
      sortByValueBtn.setAttribute('data-key', 'sortByValue');
      sortByValueBtn.textContent = `Sortare după valoare ↕ ${sortValueAsc ? '↓' : '↑'}`;
  }

  // Event listeners pentru căutare și sortare
  if (searchInput) {
      searchInput.addEventListener("input", searchTable);
  } else {
      console.error("Elementul cu ID 'searchRegions' nu a fost găsit.");
  }

  if (sortByNameBtn) {
      sortByNameBtn.addEventListener("click", sortTableByName);
  } else {
      console.error("Elementul cu ID 'sortByName' nu a fost găsit.");
  }

  if (sortByValueBtn) {
      sortByValueBtn.addEventListener("click", sortTableByValue);
  } else {
      console.error("Elementul cu ID 'sortByValue' nu a fost găsit.");
  }
  
  // Event listener for legend width input
  if (legendWidthInput) {
    legendWidthInput.addEventListener("input", (event) => {
        const newWidth = parseInt(event.target.value, 10);
        d3.select("#legendBackground")
            .attr("width", isNaN(newWidth) ? 180 : newWidth);
    });
} else {
    console.error("Elementul cu ID 'legendWidth' nu a fost găsit.");
}

// Event listener for legend height input
if (legendHeightInput) {
    legendHeightInput.addEventListener("input", (event) => {
        const newHeight = parseInt(event.target.value, 10);
        d3.select("#legendBackground")
            .attr("height", isNaN(newHeight) ? 200 : newHeight);
    });
} else {
    console.error("Elementul cu ID 'legendHeight' nu a fost găsit.");
}

// Add functions to calculate and update statistics
function calculateStatistics() {
  const values = Array.from(regionTableBody.querySelectorAll('input[type="number"]'))
    .map(input => parseFloat(input.value) || 0)
    .filter(val => !isNaN(val));

  if (values.length === 0) {
    document.getElementById('totalValue').textContent = '0';
    document.getElementById('avgValue').textContent = '0';
    document.getElementById('medianValue').textContent = '0';
    document.getElementById('stdDevValue').textContent = '0';
    document.getElementById('totalRegions').textContent = '0';
    return;
  }

  const total = values.reduce((a, b) => a + b, 0);
  const mean = total / values.length;
  
  // Calculate median
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];

  // Calculate standard deviation
  const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  // Update display in analysis section
  document.getElementById('totalValue').textContent = total.toFixed(2);
  document.getElementById('avgValue').textContent = mean.toFixed(2);
  document.getElementById('medianValue').textContent = median.toFixed(2);
  document.getElementById('stdDevValue').textContent = stdDev.toFixed(2);
  document.getElementById('totalRegions').textContent = values.length;
}

// Add to event listeners for table inputs
regionTableBody.querySelectorAll("input").forEach((input) => {
  input.addEventListener("input", () => {
    debouncedUpdateMapColors();
    generateAllLegends();
    calculateStatistics(); // Add statistics calculation
  });
});


// Initial calculation
calculateStatistics();
  
  if (canvasHeightInput) {
    canvasHeightInput.addEventListener("input", () => {
      updateCanvasHeight();
    });
  } else {
    console.error("Elementul cu ID 'canvasHeight' nu a fost găsit.");
  }

  // Function to update canvas height
  function updateCanvasHeight() {
    const height = parseInt(canvasHeightInput.value, 10) || 600;
    svg.attr("height", height).attr("viewBox", `0 0 ${svgWidth} ${height}`);
  }
  
  const freeTextBgTransparencyInput = document.getElementById("freeTextBgTransparency");
  const freeTextBgColorInput = document.getElementById("freeTextBgColor"); // New element

  if (freeTextBgTransparencyInput) {
    freeTextBgTransparencyInput.addEventListener("input", () => {
      updateFreeTextBackground();
    });
  } else {
    console.error("Elementul cu ID 'freeTextBgTransparency' nu a fost găsit.");
  }

  if (freeTextBgColorInput) { // New listener
    freeTextBgColorInput.addEventListener("input", () => {
      updateFreeTextBackground();
    });
  } else {
    console.error("Elementul cu ID 'freeTextBgColor' nu a fost găsit.");
  }

  // Function to update free text background color and transparency
  function updateFreeTextBackground() {
    const transparency = parseFloat(freeTextBgTransparencyInput.value) || 0;
    const bgColor = freeTextBgColorInput ? freeTextBgColorInput.value : "#ffffff";
    // Convert hex to RGB
    const rgb = hexToRgb(bgColor);
    if (rgb) {
      document.querySelectorAll('.free-text-container').forEach(container => {
        container.style.backgroundColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${transparency})`;
      });
    } else {
      console.error("Conversia culorii hex la RGB a eșuat.");
    }
  }

  // Ensure hexToRgb function exists
  function hexToRgb(hex) {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, function(m, r, g, b) {
      return r + r + g + g + b + b;
    });

    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }
  
  // Ensure grid lines are included in the export
  if (exportButton) {
    exportButton.addEventListener("click", () => {
      html2canvas(document.querySelector("#mapSVG")).then(canvas => {
        const link = document.createElement("a");
        link.download = "map.png";
        link.href = canvas.toDataURL();
        link.click();
      });
    });
  } else {
    console.error("Elementul cu ID 'exportMap' nu a fost găsit.");
  }
  
  // 1) Global object to store label positions
  let labelPositions = JSON.parse(localStorage.getItem("labelPositions") || "{}");

  // Funcție pentru a crea label-uri pe hartă
  function createValueLabels() {
    gMap.selectAll(".value-label").remove();

    gMap.selectAll(".value-label")
      .data(geoDataFeatures)
      .enter()
      .append("text")
      .attr("class", "value-label")
      .attr("text-anchor", "middle")
      .style("pointer-events", "none")
      .style("font-family", valuesFontSelect ? valuesFontSelect.value : "'Roboto', sans-serif")
      .attr("x", d => {
        const regionName = d.properties.NAME || d.properties.name || 
                          d.properties.region_nam || d.properties.nume_regiu||d.properties.cntry_name;
        // First try to use saved position
        if (labelPositions[regionName]) {
          return labelPositions[regionName].x;
        }
        // Then try to use point coordinates from points layer
        if (window.pointLocations && window.pointLocations[regionName]) {
          const [x, y] = projection(window.pointLocations[regionName]);
          return x;
        }
        // Fallback to centroid if no point exists
        const coords = getRegionPointOnSurface(d);
        const [x, y] = projection(coords);
        return x;
      })
      .attr("y", d => {
        const regionName = d.properties.NAME || d.properties.name || 
                          d.properties.region_nam || d.properties.nume_regiu||d.properties.cntry_name;
        // First try to use saved position
        if (labelPositions[regionName]) {
          return labelPositions[regionName].y;
        }
        // Then try to use point coordinates from points layer
        if (window.pointLocations && window.pointLocations[regionName]) {
          const [x, y] = projection(window.pointLocations[regionName]);
          return y;
        }
        // Fallback to centroid if no point exists
        const coords = getRegionPointOnSurface(d);
        const [x, y] = projection(coords);
        return y;
      })
      .call(d3.drag()
        .on("drag", function(event, d) {
          d3.select(this)
            .attr("x", event.x)
            .attr("y", event.y);
        })
        .on("end", function(event, d) {
          const regionName = d.properties.NAME;
          labelPositions[regionName] = { x: event.x, y: event.y };
          localStorage.setItem("labelPositions", JSON.stringify(labelPositions));
        })
      );
  }
  
  function getSharedColorScale(domainValues, gradient) {
    const minValue = d3.min(domainValues);
    const maxValue = d3.max(domainValues);
  
    // Construim array-ul de culori pentru scală
    const colors = [gradient.start];
    
    // Adăugăm culorile intermediare în ordine
    intermediateColors.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        colors.push(el.value);
      }
    });
    
    colors.push(gradient.end);
  
    // Construim domain-ul proporțional cu numărul de culori
    const domain = colors.map((_, i) => 
      minValue + (i * (maxValue - minValue) / (colors.length - 1))
    );
  
    return d3.scaleLinear()
      .domain(domain)
      .range(colors);
  }
  
  const outlineColorInput = document.getElementById("outlineColor");
  const outlineWidthInput = document.getElementById("outlineWidth");
  const toggleOutlineCheckbox = document.getElementById("toggleOutline");

  // Function to update map shape outlines
  function updateMapOutlines() {
    const showOutline = toggleOutlineCheckbox.checked;
    const color = outlineColorInput.value;
    const width = outlineWidthInput.value;

    gMap.selectAll("path")
      .attr("stroke", showOutline ? color : "none")
      .attr("stroke-width", showOutline ? width : 0);
  }

  // Event listeners for outline controls
  if (outlineColorInput) {
    outlineColorInput.addEventListener("input", updateMapOutlines);
  }

  if (outlineWidthInput) {
    outlineWidthInput.addEventListener("input", updateMapOutlines);
  }

  if (toggleOutlineCheckbox) {
    toggleOutlineCheckbox.addEventListener("change", updateMapOutlines);
  }

  // Initial outline setup
  updateMapOutlines();
  
  function updateOutline() {
    const outlineColor = document.getElementById("outlineColor").value;
    const outlineWidth = document.getElementById("outlineWidth").value;
    const outlineToggle = document.getElementById("toggleOutline").checked;
    d3.selectAll(".region")
      .style("stroke", outlineToggle ? outlineColor : "none")
      .style("stroke-width", outlineToggle ? outlineWidth : 0);
  }

  document.getElementById("outlineColor").addEventListener("input", updateOutline);
  document.getElementById("outlineWidth").addEventListener("input", updateOutline);
  document.getElementById("toggleOutline").addEventListener("change", updateOutline);
  
  const legendFontSelect = document.getElementById("legendFont");
  const legendFontSizeInput = document.getElementById("legendFontSize");

  // Function to update legend title styles
  function updateLegendTitleStyles() {
    const legendTitle = document.getElementById("legendTitle");
    const selectedFont = legendFontSelect.value;
    const selectedSize = legendFontSizeInput.value;

    if (legendTitle) {
      legendTitle.style.fontFamily = selectedFont;
      legendTitle.style.fontSize = `${selectedSize}px`;
    }
  }

  // Event listeners for legend font and size changes
  if (legendFontSelect) {
    legendFontSelect.addEventListener("change", updateLegendTitleStyles);
  }

  if (legendFontSizeInput) {
    legendFontSizeInput.addEventListener("input", updateLegendTitleStyles);
  }

  // Initialize legend title styles on load
  updateLegendTitleStyles();
  
  document.getElementById("legendSortDirection").addEventListener("change", generateAllLegends);
  
  function updateWatermarkColor(backgroundColor) {
    const rgb = hexToRgb(backgroundColor);
    if (!rgb) return;
    
    const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    const root = document.documentElement;
    
    root.style.setProperty(
      '--watermark-filter', 
      brightness > 128 
        ? 'brightness(0) opacity(0.05)' 
        : 'brightness(100) opacity(0.05)'
    );
  }

  // Update canvasColorInput event listener
  if (canvasColorInput) {
    canvasColorInput.addEventListener("input", (e) => {
      updateCanvas();
      updateWatermarkColor(e.target.value);
    });
  }

  // Initial watermark setup
  updateWatermarkColor(canvasColorInput.value);
  
  // Referințe la noile elemente DOM
  const resetDataButton = document.getElementById("resetData");

  // Funcție pentru resetarea datelor
  function resetData() {
    // Reset table values without modifying structure
    const rows = regionTableBody.querySelectorAll("tr");
    rows.forEach(row => {
      const valueInput = row.querySelector("td:nth-child(2) input");
      const categorySelect = row.querySelector("td:nth-child(3) select");
      
      if (valueInput) {
        valueInput.value = "0";
      }
      
      if (categorySelect) {
        categorySelect.value = "";
      }
    });

    // Reset categories to empty array
    categories = [];
    renderCategoryList();
    
    // Update map and legends
    updateMapColors();
    generateAllLegends();
    calculateStatistics();
  }

  // Adăugăm event listener pentru resetare
  if (resetDataButton) {
    resetDataButton.addEventListener("click", resetData);
  } else {
    console.error("Elementul cu ID 'resetData' nu a fost găsit.");
  }
  
  // Add after the existing table-related code
function updateAnalysisTable() {
  const analysisTableBody = document.querySelector("#analysisTable tbody");
  const rows = Array.from(regionTableBody.querySelectorAll("tr"));
  const values = rows.map(row => parseFloat(row.querySelector("input").value) || 0);
  const total = values.reduce((sum, value) => sum + value, 0);
  
  // Calculate median
  const sortedValues = [...values].sort((a, b) => a - b);
  let median = 0;
  const mid = Math.floor(sortedValues.length / 2);
  if (sortedValues.length % 2 === 0) {
    median = (sortedValues[mid - 1] + sortedValues[mid]) / 2;
  } else {
    median = sortedValues[mid];
  }

  // Calculate standard deviation
  const mean = total / values.length;
  const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  // Update quick stats
  document.getElementById("totalRegions").textContent = rows.length;
  document.getElementById("totalValue").textContent = total.toFixed(2);
  document.getElementById("avgValue").textContent = (total / rows.length).toFixed(2);
  document.getElementById("medianValue").textContent = median.toFixed(2);
  document.getElementById("stdDevValue").textContent = stdDev.toFixed(2);
  document.getElementById("tableTotalValue").textContent = total.toFixed(2);

  // Clear and rebuild analysis table
  analysisTableBody.innerHTML = "";
  
  // Convert rows to data array for sorting
  const rowData = rows.map(row => {
    const regionName = row.cells[0].textContent;
    const value = parseFloat(row.querySelector("input").value) || 0;
    const categorySelect = row.querySelector("select");
    // Get the actual category name instead of the index
    const categoryName = categorySelect.value !== "" ? 
      categories[categorySelect.value]?.name || "-" : 
      "-";
    const percentage = (value / total * 100).toFixed(1);
    
    return { regionName, value, categoryName, percentage };
  });

  // Sort by value for highlighting
  rowData.sort((a, b) => b.value - a.value);
  
  // Add rows to analysis table
  rowData.forEach((data, index) => {
    const tr = document.createElement("tr");
    const isTop5 = index < 5;
    const isBottom5 = index >= rowData.length - 5;
    
    if (isTop5) tr.classList.add("highlight-top");
    if (isBottom5) tr.classList.add("highlight-bottom");
    
    tr.innerHTML = `
      <td>${data.regionName}</td>
      <td>${data.value}</td>
      <td>${data.percentage}%</td>
      <td>${data.categoryName}</td>
      <td class="trend-${data.value > (total / rows.length) ? 'up' : 'down'}">
        ${data.value > (total / rows.length) ? '↑' : '↓'}
      </td>
    `;
    
    analysisTableBody.appendChild(tr);
  });

  // Calculate category statistics
  const categoryStats = {};
  
  rowData.forEach(data => {
    if (data.categoryName && data.categoryName !== "-") {
      if (!categoryStats[data.categoryName]) {
        categoryStats[data.categoryName] = {
          count: 0,
          totalValue: 0,
          minValue: Infinity,
          maxValue: -Infinity,
          color: categories.find(cat => cat.name === data.categoryName)?.color || '#333'
        };
      }
      
      const stats = categoryStats[data.categoryName];
      stats.count++;
      stats.totalValue += data.value;
      stats.minValue = Math.min(stats.minValue, data.value);
      stats.maxValue = Math.max(stats.maxValue, data.value);
    }
  });

  // Update category statistics display
  const categoryStatsContainer = document.getElementById('categoryStatsContainer');
  categoryStatsContainer.innerHTML = '';

  Object.entries(categoryStats).forEach(([category, stats]) => {
    const avgValue = stats.totalValue / stats.count;
    const percentageOfTotal = ((stats.totalValue / total) * 100).toFixed(1);
    
    const statItem = document.createElement('div');
    statItem.className = 'category-stat-item';
    statItem.style.borderLeftColor = stats.color;
    
    statItem.innerHTML = `
      <span class="category-stat-name">${category}</span>
      <div class="category-stat-details">
        <span title="Număr de regiuni">${stats.count} regiuni</span>
        <span title="Valoare medie">∅ ${avgValue.toFixed(2)}</span>
        <span title="Valori min/max">↓${stats.minValue.toFixed(1)} ↑${stats.maxValue.toFixed(1)}</span>
        <span title="Procent din total">${percentageOfTotal}%</span>
      </div>
    `;
    
    categoryStatsContainer.appendChild(statItem);
  });
}

// Remove event listeners for the buttons
// ...existing code...

// Update analysis table when main table changes
regionTableBody.addEventListener("input", debounce(() => {
  updateAnalysisTable();
}, 300));

// Initial update
updateAnalysisTable();

// ...existing code...

// Add new references for circle controls
const toggleCircles = document.getElementById("toggleCircles");
const circleColor = document.getElementById("circleColor");
const circleOpacity = document.getElementById("circleOpacity");
const circleScale = document.getElementById("circleScale");
const legendCircleCount = document.getElementById("legendCircleCount");

// 1) Create/ensure a group inside gMap:
const circleGroup = gMap.append("g")
  .attr("class", "circle-group");

// Function to draw proportional circles
function updateProportionalCircles() {
  if (!toggleCircles.checked) {
    gMap.selectAll(".proportional-circle").remove();
    d3.select("#circleLegend").remove(); // Remove legend when circles are hidden
    return;
  }

  const values = Array.from(regionTableBody.querySelectorAll("input"))
    .map(input => parseFloat(input.value) || 0)
    .filter(val => val > 0);
  
  const maxValue = Math.max(...values);

  const radiusScale = d3.scaleSqrt()
    .domain([0, maxValue])
    .range([0, 30 * parseFloat(circleScale.value)]);

  const circles = gMap.selectAll(".proportional-circle")
    .data(geoDataFeatures);

  circles.exit().remove();

  // Create new circles with proper opacity
  const circlesEnter = circles.enter()
    .append("circle")
    .attr("class", "proportional-circle");

  // Merge existing and new circles and update all attributes
  circles.merge(circlesEnter)
    .attr("cx", d => {
      const regionName = d.properties.NAME || d.properties.name || 
                        d.properties.region_nam || d.properties.nume_regiu || 
                        d.properties.cntry_name;
      if (window.pointLocations && window.pointLocations[regionName]) {
        return projection(window.pointLocations[regionName])[0];
      }
      const coords = getRegionPointOnSurface(d);
      return projection(coords)[0];
    })
    .attr("cy", d => {
      const regionName = d.properties.NAME || d.properties.name || 
                        d.properties.region_nam || d.properties.nume_regiu || 
                        d.properties.cntry_name;
      if (window.pointLocations && window.pointLocations[regionName]) {
        return projection(window.pointLocations[regionName])[1];
      }
      const coords = getRegionPointOnSurface(d);
      return projection(coords)[1];
    })
    .attr("r", d => radiusScale(getRegionValue(d)))
    .attr("fill", circleColor.value)
    .attr("opacity", circleOpacity.value) // Changed from fill-opacity to opacity
    .raise();

  // Create or update circle legend
  createCircleLegend(maxValue, radiusScale);
}

function createCircleLegend(maxValue, radiusScale) {
  // Remove existing circle legend
  d3.select("#circleLegend").remove();

  // Get number of circles from user input (default to 3 if not specified)
  const numCircles = parseInt(legendCircleCount?.value || 3);

  // Calculate total height needed with increased spacing
  const circleSpacing = 60; // Increased from 50 to 60px
  const titleHeight = 30; // Space for title
  const padding = 20; // Padding at top and bottom
  const legendHeight = (numCircles * circleSpacing) + titleHeight + (padding * 2);

  // Create new legend group
  const circleLegend = svg.append("g")
    .attr("id", "circleLegend")
    .attr("class", "legend-group")
    .attr("transform", "translate(60, " + (svgHeight - legendHeight - 20) + ")")
    .style("display", toggleCircles.checked ? "block" : "none");

  // Add background
  circleLegend.append("rect")
    .attr("width", 150)
    .attr("height", legendHeight)
    .attr("fill", "rgba(255, 255, 255, 0.8)")
    .attr("rx", 4);

  // Add title with more space above circles
  circleLegend.append("text")
    .attr("x", 75)
    .attr("y", padding + 5) // Adjusted position
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .style("font-weight", "bold")
    .text("Simboluri proporționale"); // Changed from "Dimensiune Cercuri"

  // Create reference sizes excluding zero
  const referenceValues = Array.from({length: numCircles}, (_, i) => {
    // Start from maxValue and distribute evenly, excluding zero
    return maxValue * (1 - (i / numCircles));
  }).filter(val => val > 0); // Remove zero values

  const circleGroups = circleLegend.selectAll(".circle-legend-group")
    .data(referenceValues)
    .enter()
    .append("g")
    .attr("class", "circle-legend-group")
    .attr("transform", (d, i) => `translate(75, ${titleHeight + padding + (i * circleSpacing)})`);

  // Add circles
  circleGroups.append("circle")
    .attr("cx", 0)
    .attr("cy", 0)
    .attr("r", d => radiusScale(d))
    .attr("fill", "none")
    .attr("stroke", circleColor.value)
    .attr("opacity", circleOpacity.value);

  // Add value labels with better positioning
  circleGroups.append("text")
    .attr("x", 35)
    .attr("y", 4)
    .attr("text-anchor", "start")
    .style("font-size", "11px")
    .text(d => d.toFixed(1));

  // Make legend draggable
  circleLegend.call(d3.drag()
    .on("drag", (event) => {
      const transform = d3.select("#circleLegend").attr("transform");
      const currentTranslate = transform.match(/translate\(([^)]*)\)/)[1].split(",");
      const newX = parseFloat(currentTranslate[0]) + event.dx;
      const newY = parseFloat(currentTranslate[1]) + event.dy;
      d3.select("#circleLegend").attr("transform", `translate(${newX},${newY})`);
    }));
}

// Add event listener for circle count changes
if (legendCircleCount) {
  legendCircleCount.addEventListener("change", updateProportionalCircles);
}

// Add to circle controls event listeners
toggleCircles.addEventListener("change", () => {
  updateProportionalCircles();
  const circleLegend = d3.select("#circleLegend");
  if (circleLegend.size() > 0) {
    circleLegend.style("display", toggleCircles.checked ? "block" : "none");
  }
});

circleColor.addEventListener("input", () => {
  updateProportionalCircles();
  d3.selectAll(".circle-legend-group circle")
    .attr("stroke", circleColor.value);
  gMap.selectAll(".proportional-circle")
    .attr("fill", circleColor.value); // Update circles on the map
});

circleOpacity.addEventListener("input", () => {
  const opacity = circleOpacity.value;
  gMap.selectAll(".proportional-circle")
    .attr("opacity", opacity);
  d3.selectAll(".circle-legend-group circle")
    .attr("opacity", opacity);
});

// Add to zoom behavior to handle circles
const originalZoom = d3.zoom().on("zoom", (event) => {
  gMap.attr("transform", event.transform);
});

svg.call(originalZoom);

// Add to lockAllInteractions function
const originalLockAllInteractions = lockAllInteractions;
lockAllInteractions = function() {
  originalLockAllInteractions();
  gMap.selectAll(".proportional-circle")
    .style("pointer-events", "none");
};

// Add to unlockAllInteractions function
const originalUnlockAllInteractions = unlockAllInteractions;
unlockAllInteractions = function() {
  originalUnlockAllInteractions();
  gMap.selectAll(".proportional-circle")
    .style("pointer-events", "all");
};

// Update the scale change handler to update both map and legend immediately
circleScale.addEventListener("input", () => {
  // Update circles on map
  const values = Array.from(regionTableBody.querySelectorAll("input"))
    .map(input => parseFloat(input.value) || 0)
    .filter(val => val > 0);
  
  const maxValue = Math.max(...values);
  const scale = parseFloat(circleScale.value);
  
  // Create new radius scale with updated scale factor
  const radiusScale = d3.scaleSqrt()
    .domain([0, maxValue])
    .range([0, 30 * scale]);

  // Update circles on map
  gMap.selectAll(".proportional-circle")
    .transition()
    .duration(300)
    .attr("r", d => radiusScale(getRegionValue(d)));

  // Update legend
  createCircleLegend(maxValue, radiusScale);
});

// ...existing code...

function createCircleLegend(maxValue, radiusScale) {
  // Remove existing circle legend
  d3.select("#circleLegend").remove();

  // Get number of circles from user input
  const numCircles = parseInt(legendCircleCount?.value || 3);

  // Get legend styling options
  const font = legendFont.value;
  const fontSize = parseInt(legendFontSize.value);
  const fontStyle = legendFontStyle.value;
  const fontColor = legendColor.value;
  const bgTransparency = legendBgTransparency.value;
  const titleText = legendTitleInput.value || "Dimensiune Cercuri";
  const decimals = parseInt(legendDecimalsInput.value, 10) || 1;

  // Calculate total height with increased spacing
  const circleSpacing = 60;
  const titleHeight = 30;
  const padding = 20;
  const legendHeight = (numCircles * circleSpacing) + titleHeight + (padding * 2);
  const legendWidth = parseInt(legendWidthInput.value) || 150;

  // Create new legend group
  const circleLegend = svg.append("g")
    .attr("id", "circleLegend")
    .attr("class", "legend-group")
    .attr("transform", "translate(60, " + (svgHeight - legendHeight - 20) + ")")
    .style("display", toggleCircles.checked ? "block" : "none");

  // Add background with styling
  circleLegend.append("rect")
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .attr("fill", `rgba(255, 255, 255, ${bgTransparency})`)
    .attr("rx", 4);

  // Add title with styling
  circleLegend.append("text")
    .attr("x", legendWidth / 2)
    .attr("y", padding + 5)
    .attr("text-anchor", "middle")
    .style("font-family", font)
    .style("font-size", `${fontSize}px`)
    .style("font-style", fontStyle.includes("italic") ? "italic" : "normal")
    .style("font-weight", fontStyle.includes("bold") ? "bold" : "normal")
    .style("fill", fontColor)
    .text("Simboluri proporționale"); // Changed from "Dimensiune Cercuri"

  // Create reference sizes excluding zero
  const referenceValues = Array.from({length: numCircles}, (_, i) => {
    return maxValue * (1 - (i / numCircles));
  }).filter(val => val > 0);

  // Create circle groups with styling
  const circleGroups = circleLegend.selectAll(".circle-legend-group")
    .data(referenceValues)
    .enter()
    .append("g")
    .attr("class", "circle-legend-group")
    .attr("transform", (d, i) => `translate(${legendWidth/2}, ${titleHeight + padding + (i * circleSpacing)})`);

  // Add circles
  circleGroups.append("circle")
    .attr("cx", 0)
    .attr("cy", 0)
    .attr("r", d => radiusScale(d))
    .attr("fill", "none")
    .attr("stroke", circleColor.value)
    .attr("opacity", circleOpacity.value);

  // Add value labels with styling
  circleGroups.append("text")
    .attr("x", 35)
    .attr("y", 4)
    .attr("text-anchor", "start")
    .style("font-family", font)
    .style("font-size", `${fontSize}px`)
    .style("font-style", fontStyle.includes("italic") ? "italic" : "normal")
    .style("font-weight", fontStyle.includes("bold") ? "bold" : "normal")
    .style("fill", fontColor)
    .text(d => d.toFixed(decimals));

  // Make legend draggable
  circleLegend.call(d3.drag()
    .on("drag", (event) => {
      const transform = d3.select("#circleLegend").attr("transform");
      const currentTranslate = transform.match(/translate\(([^)]*)\)/)[1].split(",");
      const newX = parseFloat(currentTranslate[0]) + event.dx;
      const newY = parseFloat(currentTranslate[1]) + event.dy;
      circleLegend.attr("transform", `translate(${newX},${newY})`);
    }));
}

// Add event listeners for legend styling that also update circle legend
function updateAllLegends() {
  generateAllLegends();
  if (toggleCircles.checked) {
    updateProportionalCircles();
  }
}

// Add these listeners to existing legend style controls
[legendFont, legendFontSize, legendFontStyle, legendColor, legendBgTransparency, 
 legendWidthInput, legendHeightInput, legendTitleInput, legendDecimalsInput].forEach(control => {
  if (control) {
    control.addEventListener("input", updateAllLegends);
    control.addEventListener("change", updateAllLegends);
  }
});

// ...existing code...

  // Add after other initialization code
  function initializeDarkMode() {
    // Set dark mode as default
    document.documentElement.setAttribute("data-theme", "dark");
    darkModeToggle.checked = true;
    localStorage.setItem("theme", "dark");
    
    // Update watermark and other components for dark mode
    updateWatermarkColor("#1a1a1a");
    generateAllLegends();
  }

  // Add dark mode toggle handler
  darkModeToggle.addEventListener("change", (e) => {
    const theme = e.target.checked ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
    
    // Update watermark color based on theme
    updateWatermarkColor(theme === "dark" ? "#1a1a1a" : "#ffffff");
    
    // Regenerate legends with new theme colors
    generateAllLegends();
  });

  // Initialize dark mode
  initializeDarkMode();

  // ...existing code...

});
