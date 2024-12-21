document.addEventListener("DOMContentLoaded", () => {
  const map = L.map("mapid", { center: [47, 28], zoom: 7 });

  // 1. Crearea unui strat de bază transparent
  const transparentTile = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HwAF/gJ/lZGWUgAAAABJRU5ErkJggg==';
  
  const transparentTileLayer = L.tileLayer('', {
      tileSize: 256,
      noWrap: true,
      bounds: [[-90, -180], [90, 180]],
      attribution: '',
      opacity: 0,
      getTileUrl: function() {
          return transparentTile;
      }
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
      if (value === 0 || isNaN(value)) return "#ccc"; // Gri pentru valori lipsă
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
          const regionName = props.NAME || props.RAION || props.name;
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
                  style: { color: "#fff", weight: 1, fillColor: "#ccc", fillOpacity: 0.8 },
                  onEachFeature: (feature, layer) => {
                      const props = layer.feature.properties;
                      const regionName = props.NAME || props.RAION || props.name || "Unknown";
                      layer.bindPopup(regionName);
                  }
              }).addTo(map);
              map.fitBounds(currentLayer.getBounds(), { maxZoom: zoomSettings[geojsonFile] || 15 });
              generateTable(geoData);
          })
          .catch(err => console.error("Error loading GeoJSON:", err));
  };

  loadMap("md.json");

  document.getElementById("mapSelector").addEventListener("change", (e) => {
      loadMap(e.target.value);
  });

  gradientSelector.addEventListener("change", updateMapGradient);

  document.getElementById("exportMap").addEventListener("click", () => {
      console.log("Export map clicked");

      if (!currentLayer) {
          console.error("No GeoJSON layer present on the map.");
          return;
      }

      // 2. Salvarea vizualizării originale a hărții
      const originalCenter = map.getCenter();
      const originalZoom = map.getZoom();

      // 3. Ajustarea hărții pentru a include toate straturile GeoJSON
      map.fitBounds(currentLayer.getBounds(), { maxZoom: zoomSettings["md.json"] || 15 });

      // 4. Așteaptă puțin pentru a te asigura că harta este ajustată
      setTimeout(() => {
          // 5. Generarea imaginii folosind leaflet-image
          leafletImage(map, (err, canvas) => {
              if (err) {
                  console.error("Error generating image:", err);
                  // Revino la vizualizarea originală în caz de eroare
                  map.setView(originalCenter, originalZoom);
                  return;
              }

              // 6. Crearea unui nou canvas cu rezoluție mai mare
              const scaleFactor = 3; // Poți ajusta acest factor pentru o rezoluție mai înaltă
              const highResCanvas = document.createElement("canvas");
              highResCanvas.width = canvas.width * scaleFactor;
              highResCanvas.height = canvas.height * scaleFactor;
              const highResContext = highResCanvas.getContext("2d");

              // 7. Desenează canvas-ul original pe canvas-ul de rezoluție înaltă
              highResContext.drawImage(canvas, 0, 0, highResCanvas.width, highResCanvas.height);

              // 8. Exportă canvas-ul de rezoluție înaltă ca PNG
              const link = document.createElement("a");
              link.download = "map.png";
              link.href = highResCanvas.toDataURL();
              link.click();

              // 9. Revino la vizualizarea originală a hărții
              map.setView(originalCenter, originalZoom);
          });
      }, 500); // Ajustează timpul de așteptare dacă este necesar
  });
});
