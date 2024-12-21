document.addEventListener("DOMContentLoaded", () => {
  // Initialize the map
  const map = L.map("mapid", { center: [47, 28], zoom: 7 });
  
  // 1. Crearea unui strat de bază transparent folosind L.GridLayer
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
                  renderer: L.canvas(), // Asigură renderizarea pe canvas
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
  
  // Adăugăm un strat de test pentru a verifica dacă exportul funcționează
  const testCircle = L.circle([47, 28], {
      color: 'red',
      fillColor: '#f03',
      fillOpacity: 0.5,
      radius: 5000
  }).addTo(map);
  
  // Încarcă leaflet-image după ce pagina este încărcată
  // Asigură-te că folosești cea mai recentă versiune a leaflet-image
  const leafletImageScript = document.createElement('script');
  leafletImageScript.src = "https://unpkg.com/leaflet-image/leaflet-image.js";
  leafletImageScript.onload = () => {
      console.log("leaflet-image loaded");
  
      document.getElementById("exportMap").addEventListener("click", () => {
          console.log("Export map clicked");
  
          if (!currentLayer) {
              console.error("No GeoJSON layer present on the map.");
              return;
          }
  
          // Salvează vizualizarea originală a hărții
          const originalCenter = map.getCenter();
          const originalZoom = map.getZoom();
  
          // Ajustează harta pentru a se potrivi tuturor straturilor GeoJSON
          map.fitBounds(currentLayer.getBounds(), { maxZoom: zoomSettings["md.json"] || 15 });
  
          // Ascunde stratul de bază pentru a nu fi inclus în export
          transparentTileLayer.setOpacity(0);
  
          // Ascunde stratul de test pentru a verifica exportul
          testCircle.setStyle({ fillOpacity: 0, opacity: 0 });
  
          // Ascunde alte elemente non-GeoJSON dacă este necesar
  
          // Așteaptă până când harta este complet redată
          map.once('idle', () => {
              console.log("Map is idle, proceeding with export");
  
              // Utilizează leaflet-image pentru a captura harta
              leafletImage(map, (err, canvas) => {
                  if (err) {
                      console.error("Error generating image:", err);
                      // Restore the original view
                      map.setView(originalCenter, originalZoom);
                      // Reafișează straturile ascunse în caz de eroare
                      transparentTileLayer.setOpacity(0); // Rămâne transparent
                      testCircle.setStyle({ fillOpacity: 0.5, opacity: 1 });
                      return;
                  }
  
                  // Scalează canvas-ul pentru rezoluție mai înaltă
                  const scaleFactor = 3; // Poți ajusta acest factor pentru o rezoluție mai mare
                  const highResCanvas = document.createElement("canvas");
                  highResCanvas.width = canvas.width * scaleFactor;
                  highResCanvas.height = canvas.height * scaleFactor;
                  const highResContext = highResCanvas.getContext("2d");
  
                  highResContext.drawImage(canvas, 0, 0, highResCanvas.width, highResCanvas.height);
  
                  // Creează un link pentru descărcare
                  const link = document.createElement("a");
                  link.download = "map.png";
                  link.href = highResCanvas.toDataURL();
                  link.click();
  
                  // Restore the original view
                  map.setView(originalCenter, originalZoom);
  
                  // Reafișează straturile ascunse
                  transparentTileLayer.setOpacity(0); // Rămâne transparent
                  testCircle.setStyle({ fillOpacity: 0.5, opacity: 1 });
              });
          });
      });
  };
  document.body.appendChild(leafletImageScript);
});
