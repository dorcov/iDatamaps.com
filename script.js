document.addEventListener("DOMContentLoaded", () => {
  // Initializează harta
  const map = L.map("mapid", {
    center: [47, 28],
    zoom: 7,
    attributionControl: false
  });

  // Stratul de bază transparent (opțional)
  const TransparentLayer = L.GridLayer.extend({
    createTile: function(coords) {
      const tile = document.createElement('div');
      tile.style.width = this.getTileSize().x + 'px';
      tile.style.height = this.getTileSize().y + 'px';
      tile.style.background = 'transparent';
      return tile;
    }
  });

  const transparentTileLayer = new TransparentLayer({
    tileSize: 256,
    noWrap: true,
    bounds: [[-90, -180], [90, 180]],
    attribution: '',
    opacity: 0
  }).addTo(map);

  let currentLayer = null;

  const zoomSettings = {
    "md.json": 15,
    "ro_judete_poligon.json": 7,
    "europe.geojson": 9
  };

  const gradientSelector = document.getElementById("gradientSelector");
  const regionTable = document.getElementById("regionTable").querySelector("tbody");

  const getColor = (value, maxValue, gradient) => {
    if (value === 0 || isNaN(value)) return "#ccc";
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
  };

  const updateMapGradient = () => {
    if (!currentLayer) return;

    const maxValue = Math.max(
      ...Array.from(regionTable.querySelectorAll("input")).map(input =>
        parseFloat(input.value) || 0
      )
    );

    const gradient = gradientSelector.value;

    currentLayer.eachLayer(layer => {
      const props = layer.feature.properties;
      const regionName = props.NAME || props.RAION || props.name || "Unknown";
      const input = document.querySelector(`[data-region="${encodeURIComponent(regionName)}"]`);
      const value = input ? parseFloat(input.value) || 0 : 0;

      layer.setStyle({
        fillColor: getColor(value, maxValue, gradient),
        fillOpacity: 0.8,
        color: "#fff",
        weight: 1
      });
    });
  };

  const generateTable = (geoData) => {
    regionTable.innerHTML = "";
    geoData.features.forEach(feature => {
      const props = feature.properties;
      const regionName = props.NAME || props.RAION || props.name || "Unknown";
      const row = document.createElement("tr");
      row.innerHTML = `<td>${regionName}</td><td><input type="number" value="0" data-region="${encodeURIComponent(regionName)}" /></td>`;
      regionTable.appendChild(row);
    });

    regionTable.querySelectorAll("input").forEach(input => {
      input.addEventListener("input", updateMapGradient);
    });
  };

  const loadMap = (geojsonFile) => {
    fetch(`data/${geojsonFile}`)
      .then(response => response.json())
      .then(geoData => {
        if (currentLayer) map.removeLayer(currentLayer);

        currentLayer = L.geoJSON(geoData, {
          renderer: L.svg(),
          style: {
            color: "#fff",
            weight: 1,
            fillColor: "#ccc",
            fillOpacity: 0.8
          },
          onEachFeature: (feature, layer) => {
            const props = layer.feature.properties;
            const regionName = props.NAME || props.RAION || props.name || "Unknown";
            layer.bindPopup(regionName);
          }
        }).addTo(map);

        map.fitBounds(currentLayer.getBounds(), {
          maxZoom: zoomSettings[geojsonFile] || 15
        });

        generateTable(geoData);
        updateMapGradient();
      })
      .catch(err => console.error("Error loading GeoJSON:", err));
  };

  // Încarcă inițial "md.json"
  loadMap("md.json");

  document.getElementById("mapSelector").addEventListener("change", (e) => {
    loadMap(e.target.value);
  });

  gradientSelector.addEventListener("change", updateMapGradient);

  // --- Aici vine logica de export cu html2canvas ---
  document.getElementById("exportMap").addEventListener("click", () => {
    const mapElement = document.getElementById("mapid");

    // Face screenshot la div-ul cu harta
    html2canvas(mapElement, { useCORS: true })
      .then((canvas) => {
        const dataUrl = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = "map_snapshot.png";
        link.click();
      })
      .catch((err) => {
        console.error("Eroare la generarea screenshot-ului:", err);
      });
  });
});
