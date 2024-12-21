document.addEventListener("DOMContentLoaded", () => {
  // 1. Inițializează harta Leaflet, cu zoom/drag dezactivate
  const map = L.map("mapid", {
    center: [47, 28],   // coordonate aproximative pentru Moldova
    zoom: 7,            // nivel inițial de zoom
    zoomControl: true,
    scrollWheelZoom: true,
    doubleClickZoom: false,
    dragging: false,
    touchZoom: false,
    boxZoom: false,
    keyboard: false
  });

  // 2. Încarcă fișierul GeoJSON (moldovanew.json)
  fetch("data/md.json")
    .then(response => response.json())
    .then(geoData => {
      // 3. Creează un layer Leaflet cu poligoanele
      const moldovaLayer = L.geoJSON(geoData, {
        style: {
          color: "#fff",           // culoarea conturului
          weight: 1,               // grosimea conturului
          fillColor: "#2a73ff",    // culoarea de umplere
          fillOpacity: 0.8
        }
      }).addTo(map);

      // 4. Centrează automat harta pe limitele poligoanelor
      map.fitBounds(moldovaLayer.getBounds());
    })
    .catch(err => console.error("Eroare la încărcarea fișierului moldovanew.json:", err));
});
