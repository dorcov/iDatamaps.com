document.addEventListener("DOMContentLoaded", () => {
  // 1. Inițializează harta fără niciun strat de fundal
  const map = L.map("mapid", {
    // Centrăm aproximativ pe Moldova
    center: [47, 28],
    zoom: 7
    // Nu mai adăugăm niciun tileLayer
  });

  // 2. Încarcă fișierul GeoJSON (raioane.json)
  fetch("data/moldova.json")
    .then(response => response.json())
    .then(geoData => {
      // 3. Creează un layer pentru poligoanele raioanelor
      const raioaneLayer = L.geoJSON(geoData, {
        style: {
          color: "#333",         // culoarea conturului
          weight: 2,            // grosimea conturului
          fillColor: "#00A4FF", // culoarea de umplere a fiecărui raion
          fillOpacity: 0.3
        },
        onEachFeature: (feature, layer) => {
          // De exemplu, numele raionului dacă există un câmp `NAME` sau `RAION`
          const prop = feature.properties;
          const raionName = prop.NAME || prop.RAION || "Raion necunoscut";

          // Popup la click
          layer.bindPopup(raionName);

          // Highlight la mouseover
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

      // 4. Adaugă layerul pe hartă
      raioaneLayer.addTo(map);

      // 5. Centrare automată pe limitele poligoanelor
      map.fitBounds(raioaneLayer.getBounds());
    })
    .catch(err => console.error("Eroare la încărcarea raioanelor:", err));
});
