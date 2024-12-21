document.addEventListener("DOMContentLoaded", () => {
  const map = L.map("mapid", { center: [47, 28], zoom: 7, attributionControl: false });

  // Setează stratul de bază transparent pentru a nu fi inclus în export
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
          renderer: L.svg(), // Utilizează renderer-ul SVG
          style: { color: "#fff", weight: 1, fillColor: "#ccc", fillOpacity: 0.8 },
          onEachFeature: (feature, layer) => {
            const props = layer.feature.properties;
            const regionName = props.NAME || props.RAION || props.name || "Unknown";
            layer.bindPopup(regionName);
          }
        }).addTo(map);
        map.fitBounds(currentLayer.getBounds(), { maxZoom: zoomSettings[geojsonFile] || 15 });
        generateTable(geoData);
        updateMapGradient(); // Actualizează culorile după încărcarea datelor
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

  // Funcția de export
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

    // Ascunde stratul de test pentru a nu fi inclus în export
    testCircle.setStyle({ fillOpacity: 0, opacity: 0 });

    // Așteaptă până când harta este complet redată
    map.once('idle', () => {
      console.log("Map is idle, proceeding with export");

      // Accesează elementul SVG al hărții
      const svg = document.querySelector("#mapid svg");

      if (!svg) {
        console.error("No SVG found on the map");
        // Revino la vizualizarea originală
        map.setView(originalCenter, originalZoom);
        // Reafișează stratul de test
        testCircle.setStyle({ fillOpacity: 0.5, opacity: 1 });
        return;
      }

      // Serializează SVG-ul
      const serializer = new XMLSerializer();
      let svgString = serializer.serializeToString(svg);

      // Adaugă namespace-uri dacă lipsesc
      if(!svgString.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)){
          svgString = svgString.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      if(!svgString.match(/^<svg[^>]+"http\:\/\/www\.w3\.org\/1999\/xlink"/)){
          svgString = svgString.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
      }

      // Creează un canvas suplimentar pentru export
      const exportCanvas = document.createElement("canvas");
      const scaleFactor = 3; // Factor de scalare pentru rezoluție înaltă
      exportCanvas.width = map.getSize().x * scaleFactor;
      exportCanvas.height = map.getSize().y * scaleFactor;
      const exportContext = exportCanvas.getContext("2d");

      // Creează o imagine din SVG
      const img = new Image();
      img.onload = function() {
        // Desenează imaginea SVG scalată pe canvas
        exportContext.scale(scaleFactor, scaleFactor);
        exportContext.drawImage(img, 0, 0);

        // Exportă canvas-ul ca PNG
        const link = document.createElement("a");
        link.download = "map.png";
        link.href = exportCanvas.toDataURL("image/png");
        link.click();

        // Revino la vizualizarea originală a hărții
        map.setView(originalCenter, originalZoom);

        // Reafișează stratul de test
        testCircle.setStyle({ fillOpacity: 0.5, opacity: 1 });
      };

      // Gestionează erorile la încărcarea imaginii
      img.onerror = function(e) {
        console.error("Error loading SVG into image", e);
        // Revino la vizualizarea originală în caz de eroare
        map.setView(originalCenter, originalZoom);
        // Reafișează stratul de test
        testCircle.setStyle({ fillOpacity: 0.5, opacity: 1 });
      };

      // Setează sursa imaginii la datele SVG codificate în base64
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));
    });
  });
});
