document.addEventListener("DOMContentLoaded", () => {
  const map = L.map("mapid", { center: [47, 28], zoom: 7 });

  // Setează stratul de bază (opțional, poți să-l lași dacă dorești)
  const baseLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
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
        map.fitBounds(currentLayer.getBounds(), { maxZoom: zoomSettings[geojsonFile] });
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

    // Accesează elementul SVG al hărții
    const svg = document.querySelector("#mapid svg");

    if (!svg) {
      console.error("No SVG found on the map");
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

    // Creează un canvas
    const canvas = document.createElement("canvas");
    const width = map.getSize().x;
    const height = map.getSize().y;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");

    // Creează o imagine
    const img = new Image();

    // Setează sursa imaginii la datele SVG codificate în base64
    img.onload = function() {
      // Desenează SVG-ul pe canvas
      context.drawImage(img, 0, 0);
      // Exportă ca PNG
      const link = document.createElement("a");
      link.download = "map.png";
      link.href = canvas.toDataURL();
      link.click();
    };
    
    // Gestionează erorile
    img.onerror = function(e) {
      console.error("Error loading SVG into image", e);
    }

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));
  });
});
