document.addEventListener("DOMContentLoaded", () => {
  const map = L.map("mapid", {
    center: [47, 28], // Coordonate inițiale, dar acestea vor fi ajustate dinamic
    zoom: 7,
    zoomControl: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    dragging: false,
    touchZoom: false,
    boxZoom: false,
    keyboard: false
  });

  let currentLayer = null; // Layer curent (pentru a șterge harta anterioară)

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
          map.removeLayer(currentLayer); // Șterge stratul anterior
        }

        // Creează stratul Leaflet
        currentLayer = L.geoJSON(geoData, {
          style: {
            color: "#fff",
            weight: 1,
            fillColor: "#ccc", // Culoare implicită gri
            fillOpacity: 0.8
          },
          onEachFeature: (feature, layer) => {
            const props = layer.feature.properties;
            const regionName = props.NAME || props.RAION || props.name || "Zonă necunoscută";

            // Adaugă popup la click
            layer.bindPopup(regionName);
          }
        }).addTo(map);

        // Ajustează vizibilitatea în funcție de limitele geografice
        const bounds = currentLayer.getBounds();
        map.fitBounds(bounds, {
          padding: [20, 20], // Adaugă puțin spațiu în jurul hărții
          maxZoom: 10, // Limitează zoom-ul maxim
          animate: true
        });
      })
      .catch((err) => console.error("Eroare la încărcarea fișierului GeoJSON:", err));
  };

  // Inițializează cu harta Moldovei
  loadMap("md.json");

  // Ascultă schimbările din dropdown
  document.getElementById("mapSelector").addEventListener("change", (e) => {
    loadMap(e.target.value);
  });
});
