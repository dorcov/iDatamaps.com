// script.js

document.addEventListener('DOMContentLoaded', () => {
  const addCategoryBtn = document.getElementById('addCategory');
  const categoriesContainer = document.getElementById('categoriesContainer');
  const maxCategories = 10;
  let categoryCount = 0;
  const categories = {}; // Obiect pentru a stoca categorii și culorile lor

  const legendList = document.getElementById('legendList');
  const mapSelector = document.getElementById('mapSelector');
  const infographicTitle = document.getElementById('infographicTitle');
  const mapTitle = document.getElementById('mapTitle');
  const applyGradientBtn = document.getElementById('applyGradient');
  const gradientStart = document.getElementById('gradientStart');
  const gradientEnd = document.getElementById('gradientEnd');
  const exportMapBtn = document.getElementById('exportMap');
  const tooltip = document.querySelector('.tooltip');

  let currentMapData = null;
  let initialData = [];

  // Eveniment pentru adăugarea unei noi categorii
  addCategoryBtn.addEventListener('click', () => {
    if (categoryCount >= maxCategories) {
      alert(`Poți adăuga maximum ${maxCategories} categorii.`);
      return;
    }

    categoryCount++;
    const categoryItem = document.createElement('div');
    categoryItem.classList.add('category-item');

    const categoryName = document.createElement('input');
    categoryName.type = 'text';
    categoryName.placeholder = `Categorie ${categoryCount}`;
    categoryName.required = true;

    const categoryColor = document.createElement('input');
    categoryColor.type = 'color';
    categoryColor.value = getRandomColor();

    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Șterge';
    removeBtn.classList.add('btn', 'btn-export');
    removeBtn.style.flex = '0 0 auto';
    removeBtn.addEventListener('click', () => {
      categoriesContainer.removeChild(categoryItem);
      if (categoryName.value.trim() !== '') {
        delete categories[categoryName.value.trim()];
      }
      categoryCount--;
      updateLegend();
      updateTableOptions();
      updateMapColors();
    });

    // Eveniment pentru modificarea denumirii categoriei
    categoryName.addEventListener('input', () => {
      const oldName = categoryName.getAttribute('data-old-name');
      if (oldName && oldName !== categoryName.value.trim()) {
        delete categories[oldName];
      }
      const name = categoryName.value.trim();
      if (name) {
        categories[name] = categoryColor.value;
        categoryName.setAttribute('data-old-name', name);
      }
      updateLegend();
      updateTableOptions();
      updateMapColors();
    });

    // Eveniment pentru modificarea culorii categoriei
    categoryColor.addEventListener('input', () => {
      const name = categoryName.value.trim();
      if (name) {
        categories[name] = categoryColor.value;
        updateLegend();
        updateMapColors();
      }
    });

    categoryItem.appendChild(categoryName);
    categoryItem.appendChild(categoryColor);
    categoryItem.appendChild(removeBtn);
    categoriesContainer.appendChild(categoryItem);
  });

  // Funcție pentru a genera culori aleatorii
  function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  }

  // Funcție pentru a popula tabelul cu date
  function populateTable(data) {
    const tbody = document.querySelector('#regionTable tbody');
    tbody.innerHTML = ''; // Curățăm tabelul

    data.forEach(region => {
      const tr = document.createElement('tr');

      const tdName = document.createElement('td');
      tdName.textContent = region.name;
      tr.appendChild(tdName);

      const tdValue = document.createElement('td');
      const inputValue = document.createElement('input');
      inputValue.type = 'number';
      inputValue.value = region.value;
      inputValue.classList.add('input-text');
      inputValue.addEventListener('input', () => {
        region.value = parseFloat(inputValue.value) || 0;
        updateMapColors();
      });
      tdValue.appendChild(inputValue);
      tr.appendChild(tdValue);

      const tdCategory = document.createElement('td');
      const selectCategory = document.createElement('select');
      selectCategory.classList.add('custom-select');

      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = '-- Selectează --';
      selectCategory.appendChild(defaultOption);

      Object.keys(categories).forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        selectCategory.appendChild(option);
      });

      selectCategory.value = region.category || '';
      selectCategory.addEventListener('change', () => {
        region.category = selectCategory.value;
        updateMapColors();
      });

      tdCategory.appendChild(selectCategory);
      tr.appendChild(tdCategory);

      tbody.appendChild(tr);
    });
  }

  // Funcție pentru actualizarea opțiunilor din tabel în funcție de categoriile definite
  function updateTableOptions() {
    const tbody = document.querySelector('#regionTable tbody');
    tbody.querySelectorAll('select').forEach(select => {
      // Păstrăm valoarea selectată
      const currentValue = select.value;
      // Curățăm opțiunile
      select.innerHTML = '';
      
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = '-- Selectează --';
      select.appendChild(defaultOption);

      Object.keys(categories).forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        select.appendChild(option);
      });

      select.value = currentValue;
    });
  }

  // Funcție pentru actualizarea culorilor pe hartă
  function updateMapColors() {
    if (!currentMapData) return;

    d3.selectAll('.region')
      .attr('fill', function(d) {
        const regionData = initialData.find(r => r.name === d.properties.name);
        if (regionData.category && categories[regionData.category]) {
          return categories[regionData.category];
        } else {
          // Culoare implicită pentru valorile numerice
          const maxVal = d3.max(initialData, d => d.value);
          const colorScale = d3.scaleSequential(d3.interpolateBlues)
            .domain([0, maxVal || 100]); // Asigură un domeniu valid
          return colorScale(regionData.value);
        }
      });
  }

  // Funcție pentru actualizarea legendei
  function updateLegend() {
    legendList.innerHTML = ''; // Curățăm lista

    Object.keys(categories).forEach(cat => {
      const li = document.createElement('li');

      const colorBox = document.createElement('span');
      colorBox.classList.add('color-box');
      colorBox.style.backgroundColor = categories[cat];

      const label = document.createElement('span');
      label.textContent = cat;

      li.appendChild(colorBox);
      li.appendChild(label);
      legendList.appendChild(li);
    });
  }

  // Funcție pentru actualizarea gradientului pe hartă
  function applyGradient(startColor, endColor) {
    // Eliminăm orice gradient existent
    d3.select('#gradient').remove();

    // Aplicăm gradientul pe hartă
    const svg = d3.select('#mapSVG');
    const defs = svg.append('defs');

    const linearGradient = defs.append('linearGradient')
      .attr('id', 'gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    linearGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', startColor);

    linearGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', endColor);

    d3.selectAll('.region')
      .attr('fill', 'url(#gradient)');
  }

  // Funcție pentru exportarea hărții ca PNG
  exportMapBtn.addEventListener('click', () => {
    html2canvas(document.querySelector('.map-column')).then(canvas => {
      const link = document.createElement('a');
      link.download = 'harta.png';
      link.href = canvas.toDataURL();
      link.click();
    });
  });

  // Eveniment pentru aplicarea gradientului
  applyGradientBtn.addEventListener('click', () => {
    const startColor = gradientStart.value;
    const endColor = gradientEnd.value;

    applyGradient(startColor, endColor);
  });

  // Funcție pentru popularea tabelului și actualizarea datelor inițiale
  function loadMap(mapFile) {
    d3.json(`data/${mapFile}`).then(geoData => {
      currentMapData = geoData;
      initialData = geoData.features.map(feature => ({
        name: feature.properties.name,
        value: 0,
        category: ''
      }));

      populateTable(initialData);
      updateTableOptions();
      updateMapColors();

      // Renderizați harta
      renderMap(geoData);
    }).catch(error => {
      console.error('Eroare la încărcarea fișierului GeoJSON:', error);
      alert('Nu s-a putut încărca harta selectată. Verifică consola pentru mai multe detalii.');
    });
  }

  // Funcție pentru renderizarea hărții
  function renderMap(geoData) {
    const svg = d3.select('#mapSVG');
    svg.select('.map-group').selectAll('path').remove(); // Curățăm harta existentă

    const width = parseInt(svg.style('width'));
    const height = parseInt(svg.style('height'));

    const projection = d3.geoMercator().fitSize([width, height], geoData);
    const path = d3.geoPath().projection(projection);

    svg.select('.map-group')
      .selectAll('path')
      .data(geoData.features)
      .enter()
      .append('path')
      .attr('d', path)
      .attr('class', 'region') // Clasă pentru fiecare regiune
      .attr('fill', '#ccc') // Culoare implicită
      .attr('stroke', '#333')
      .on('mouseover', function(event, d) {
        // Cod pentru tooltip sau interactivitate
        const regionName = d.properties.name;
        const regionData = initialData.find(r => r.name === regionName);
        tooltip.style.left = (event.pageX + 10) + 'px';
        tooltip.style.top = (event.pageY + 10) + 'px';
        tooltip.innerHTML = `<strong>${regionName}</strong><br>Valoare: ${regionData.value}<br>Categorie: ${regionData.category || 'N/A'}`;
        tooltip.style.display = 'block';
      })
      .on('mousemove', function(event) {
        tooltip.style.left = (event.pageX + 10) + 'px';
        tooltip.style.top = (event.pageY + 10) + 'px';
      })
      .on('mouseout', function() {
        tooltip.style.display = 'none';
      });

    updateMapColors();
  }

  // Funcție pentru actualizarea selecției de hartă
  mapSelector.addEventListener('change', () => {
    const selectedMap = mapSelector.value;
    loadMap(selectedMap);
  });

  // Funcție pentru drag-and-drop al titlului hărții
  mapTitle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    let shiftX = e.clientX - mapTitle.getBoundingClientRect().left;
    let shiftY = e.clientY - mapTitle.getBoundingClientRect().top;

    function moveAt(pageX, pageY) {
      mapTitle.style.left = `${pageX - shiftX}px`;
      mapTitle.style.top = `${pageY - shiftY}px`;
    }

    function onMouseMove(event) {
      moveAt(event.pageX, event.pageY);
    }

    document.addEventListener('mousemove', onMouseMove);

    mapTitle.onmouseup = function() {
      document.removeEventListener('mousemove', onMouseMove);
      mapTitle.onmouseup = null;
    };
  });

  mapTitle.ondragstart = function() {
    return false;
  };

  // Încarcă harta inițială
  loadMap(mapSelector.value);

  // Eveniment pentru actualizarea titlului hărții
  infographicTitle.addEventListener('input', () => {
    mapTitle.textContent = infographicTitle.value || 'Titlu Implicitar';
  });
});
