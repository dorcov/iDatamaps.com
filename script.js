document.addEventListener("DOMContentLoaded", () => {
  // 1. Inițializează harta FĂRĂ strat de fundal (doar fundal gri/culoarea din CSS)
  const map = L.map("mapid", {
    center: [47, 28], // Coordonate aproximativ pe centrul Moldovei
    zoom: 7
    // Nu adăugăm tileLayer, deci va fi doar un fundal simplu
  });

  // 2. Încarcă fișierul GeoJSON (moldova.json)
  fetch("data/moldova.json")
    .then(response => response.json())
    .then(geoData => {
      // 3. Creează un layer cu poligoanele
      const moldovaLayer = L.geoJSON(geoData, {
        style: {
          color: "#333",       // Culoarea conturului
          weight: 2,          // Grosimea conturului
          fillColor: "#00A4FF", 
          fillOpacity: 0.3
        },
        onEachFeature: (feature, layer) => {
          // Aici adaptăm câmpurile din `properties` (NAME, RAION, name etc.)
          const props = feature.properties;
          const regionName = props.NAME || props.RAION || props.name || "Zonă necunoscută";

          // Popup la click
          layer.bindPopup(regionName);

          // Highlight la mouseover
          layer.on("mouseover", () => {
            layer.setStyle({
              fillColor: "#FFCC00",
              fillOpacity: 0.5
            });
          });

          // Revine la stil inițial la mouseout
          layer.on("mouseout", () => {
            layer.setStyle({
              fillColor: "#00A4FF",
              fillOpacity: 0.3
            });
          });
        }
      }).addTo(map);

      // 4. Centrează automat harta pe limitele poligoanelor
      map.fitBounds(moldovaLayer.getBounds());
    })
    .catch(err => console.error("Eroare la încărcarea fișierului moldova.json:", err));
});
