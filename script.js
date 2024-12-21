document.addEventListener("DOMContentLoaded", () => {
  const map = L.map("mapid", {
    center: [47, 28],
    zoom: 7,
    zoomControl: true,
    scrollWheelZoom: true,
    doubleClickZoom: false,
    dragging: true,
    touchZoom: false,
    boxZoom: false,
    keyboard: false
  });

  let currentLayer = null; // Layer curent (pentru a șterge harta anterioară)
  const regionTable = document.getElementById("regionTable").querySelector("tbody");

  // Funcție pentru generarea gradientului
  const getColor = (value, maxValue) => {
    const ratio = value / maxValue;
    return `rgba(42, 115, 255, ${Math.min(0.3 + ratio * 0.7, 1)})`; // Gradual între transparent și opac
  };

  // Funcție pentru actualizarea gradientului hărții
  const updateMapGradient = () => {
    if (!currentLayer) return;

    const maxValue = Math.max(...Array.from(regionTable.querySelectorAll("input")).map(input => parseFloat(input.value) || 0));

    currentLayer.eachLayer(layer => {
      const props = layer.feature.properties;
      const regionName = props.NAME || props.RAION || props.name;
      const input = document.querySelector(`[data-region="${regionName}"]`);
      const value = input ? parseFloat(input.value) || 0 : 0;

      // Actualizează stilul stratului
      layer.setStyle({
        fillColor: getColor(value, maxValue),
        fillOpacity: 0.8,
        color: "#fff",
        weight: 1
      });
    });
  };

  // Funcție pentru generarea tabelului
  const generateTable = (geoData) => {
    regionTable.innerHTML = ""; // Resetează tabelul

    geoData.features.forEach(feature => {
      const props = feature.properties;
      const regionName = props.NAME || props.RAION || props.name || "Unknown";

      // Creează rând pentru fiecare regiune
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${regionName}</td>
        <td><input type="number" value="0" data-region="${regionName}" /></td>
      `;
      regionTable.appendChild(row);
    });

    // Evenimente pentru actualizarea gradientului
    regionTable.querySelectorAll("input").forEach(input => {
      input.addEventListener("input", updateMapGradient);
    });
  };

  // Funcție pentru încărcarea unei hărți
  const loadMap = (geojsonFile) => {
    fetch(`data/${geojsonFile}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("HTTP error " + response.status);
        }
        return response.json();
      })
      .then((geoData) => {
        if (currentLayer) {
          map.removeLayer(currentLayer);
        }

        // Creează stratul Leaflet
        currentLayer = L.geoJSON(geoData, {
          style: {
            color: "#fff",
            weight: 1,
            fillColor: "#2a73ff",
            fillOpacity: 0.8
          },
          onEachFeature: (feature, layer) => {
            const props = layer.feature.properties;
            const regionName =
              props.NAME || props.RAION || props.name || "Zonă necunoscută";

            // Popup la click
            layer.bindPopup(regionName);
          }
        }).addTo(map);

        map.fitBounds(currentLayer.getBounds());

        // Generează tabelul
        generateTable(geoData);
      })
      .catch((err) => console.error("Eroare la încărcarea fișierului GeoJSON:", err));
  };

  // Inițializează cu harta Moldovei
  loadMap("md.json");

  // Ascultă schimbările din dropdown
  const mapSelector = document.getElementById("mapSelector");
  mapSelector.addEventListener("change", (e) => {
    loadMap(e.target.value);
  });
});
