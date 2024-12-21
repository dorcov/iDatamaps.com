document.addEventListener("DOMContentLoaded", () => {
  // Inițializează harta fără zoom sau drag
  const map = L.map("mapid", {
    center: [47, 28], // Coordonate inițiale pentru Moldova
    zoom: 7,
    zoomControl: true,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    dragging: true,
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
        // Șterge stratul anterior dacă există
        if (currentLayer) {
          map.removeLayer(currentLayer);
        }

        // Creează un nou strat Leaflet
        currentLayer = L.geoJSON(geoData, {
          style: {
            color: "#fff",           // Culoarea conturului
            weight: 1,               // Grosimea conturului
            fillColor: "#2a73ff",    // Culoarea de umplere
            fillOpacity: 0.8
          },
          onEachFeature: (feature, layer) => {
            const props = feature.properties;
            const regionName =
              props.NAME || props.RAION || props.name || "Zonă necunoscută";

            // Popup la click
            layer.bindPopup(regionName);

            // Highlight la mouseover
            layer.on("mouseover", () => {
              layer.setStyle({
                fillColor: "#FFCC00",
                fillOpacity: 0.5
              });
            });

            // Revine la stilul inițial la mouseout
            layer.on("mouseout", () => {
              layer.setStyle({
                fillColor: "#2a73ff",
                fillOpacity: 0.8
              });
            });
          }
        }).addTo(map);

        // Centrează harta pe limitele stratului
        map.fitBounds(currentLayer.getBounds());
      })
      .catch((err) => console.error("Eroare la încărcarea fișierului GeoJSON:", err));
  };

  // Inițializează cu harta Moldovei
  loadMap("md.json");

  // Ascultă schimbările din dropdown pentru selectarea hărții
  const mapSelector = document.getElementById("mapSelector");
  mapSelector.addEventListener("change", (e) => {
    loadMap(e.target.value); // Încarcă fișierul selectat
  });
});
