document.addEventListener("DOMContentLoaded", () => {
  // 1. Inițializează harta
  const map = L.map("mapid").setView([47.0, 28.0], 7);


  // 3. Încărcăm fișierul GeoJSON
  fetch("data/raioane.geojson")
    .then(response => response.json())
    .then(geoData => {
      // 4. Creăm un layer cu raioanele
      const raioaneLayer = L.geoJSON(geoData, {
        style: {
          color: "#333",      // culoarea conturului
          weight: 2,         // grosimea liniei
          fillColor: "#00A4FF",  // culoarea de umplere
          fillOpacity: 0.3
        },
        onEachFeature: (feature, layer) => {
          // De ex., popup cu numele raionului (dacă există un câmp 'Nume' sau 'NAME')
          const prop = feature.properties;
          layer.bindPopup(prop.NAME || "Raion necunoscut");

          // Hover: evidențiere
          layer.on("mouseover", () => {
            layer.setStyle({
              fillColor: "#FFCC00",
              fillOpacity: 0.5
            });
          });
          layer.on("mouseout", () => {
            layer.setStyle({
              fillColor: "#00A4FF",
              fillOpacity: 0.3
            });
          });
        }
      });

      // 5. Adăugăm stratul pe hartă
      raioaneLayer.addTo(map);

      // 6. Ajustăm automat harta pe limitele poligonelor (raioanelor)
      map.fitBounds(raioaneLayer.getBounds());
    })
    .catch(err => console.error("Eroare la încărcarea GeoJSON:", err));
});
