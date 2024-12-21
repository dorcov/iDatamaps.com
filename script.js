document.addEventListener("DOMContentLoaded", () => {
  const map = L.map("mapid", { center: [47, 28], zoom: 7 });

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
      const input = document.querySelector(`[data-region="${regionName}"]`);
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
      row.innerHTML = `<td>${regionName}</td><td><input type="number" value="0" data-region="${regionName}" /></td>`;
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
    leafletImage(map, (err, canvas) => {
      if (err) {
        console.error("Eroare la generarea imaginii:", err);
        return;
      }
      const link = document.createElement("a");
      link.download = "map.png";
      link.href = canvas.toDataURL();
      link.click();
    });
  });
});
