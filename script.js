// script.js

document.addEventListener('DOMContentLoaded', () => {
  const addCategoryBtn = document.getElementById('addCategory');
  const categoriesContainer = document.getElementById('categoriesContainer');
  const maxCategories = 10;
  let categoryCount = 0;
  const categories = {}; // Obiect pentru a stoca categorii și culorile lor

  const legendList = document.getElementById('legendList');

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

    categoryName.addEventListener('input', () => {
      const oldName = Object.keys(categories).find(key => categories[key] === categoryColor.value && key !== categoryName.value.trim());
      if (oldName && oldName !== categoryName.value.trim()) {
        delete categories[oldName];
      }
      const name = categoryName.value.trim();
      if (name) {
        categories[name] = categoryColor.value;
      }
      updateLegend();
      updateTableOptions();
      updateMapColors();
    });

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

  // Exemplu de date inițiale
  const initialData = [
    { name: 'Regiune 1', value: 10, category: '' },
    { name: 'Regiune 2', value: 20, category: '' },
    { name: 'Regiune 3', value: 30, category: '' },
    // Adaugă mai multe regiuni după necesități
  ];

  populateTable(initialData);

  // Funcție pentru actualizarea culorilor pe hartă
  function updateMapColors() {
    d3.selectAll('.region')
      .attr('fill', function(d) {
        const regionData = initialData.find(r => r.name === d.properties.name);
        if (regionData.category && categories[regionData.category]) {
          return categories[regionData.category];
        } else {
          // Culoare implicită pentru valorile numerice
          const colorScale = d3.scaleSequential(d3.interpolateBlues)
            .domain([0, d3.max(initialData, d => d.value)]);
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

  // Funcție pentru exportarea hărții ca PNG
  document.getElementById('exportMap').addEventListener('click', () => {
    html2canvas(document.querySelector('.map-column')).then(canvas => {
      const link = document.createElement('a');
      link.download = 'harta.png';
      link.href = canvas.toDataURL();
      link.click();
    });
  });

  // Event pentru aplicarea gradientului
  document.getElementById('applyGradient').addEventListener('click', () => {
    const startColor = document.getElementById('gradientStart').value;
    const endColor = document.getElementById('gradientEnd').value;

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
  });

  // Încărcăm datele GeoJSON și le adăugăm pe hartă
  d3.json('data/europe.geojson').then(geoData => {
    const svg = d3.select('#mapSVG');
    const projection = d3.geoMercator().fitSize([800, 600], geoData);
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
        const tooltip = document.querySelector('.tooltip');
        tooltip.style.left = (event.pageX + 10) + 'px';
        tooltip.style.top = (event.pageY + 10) + 'px';
        tooltip.innerHTML = `<strong>${regionName}</strong><br>Valoare: ${regionData.value}<br>Categorie: ${regionData.category || 'N/A'}`;
        tooltip.style.display = 'block';
      })
      .on('mouseout', function() {
        // Cod pentru tooltip sau interactivitate
        const tooltip = document.querySelector('.tooltip');
        tooltip.style.display = 'none';
      });

    // Actualizăm culorile după ce harta este încărcată
    updateMapColors();
  });

  // Dragging functionality for the title
  const mapTitle = document.getElementById('mapTitle');
  mapTitle.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', '');
    const rect = mapTitle.getBoundingClientRect();
    e.dataTransfer.setDragImage(mapTitle, 0, 0);
    mapTitle.style.position = 'absolute';
  });

  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    const x = e.clientX;
    const y = e.clientY;
    mapTitle.style.left = `${x}px`;
    mapTitle.style.top = `${y}px`;
  });
});
