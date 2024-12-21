document.addEventListener("DOMContentLoaded", () => {
    // Inițializează harta, centrată pe Moldova
    const map = L.map("mapid").setView([47.0, 28.0], 7);
  
    // Adaugă un strat de bază (tile layer) de la OpenStreetMap
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: 'Date cartografice © OpenStreetMap contribuții'
    }).addTo(map);
  
    // Exemplu: Adaugă un marker în Chișinău (coordonatele sunt aproximative)
    const chisinauMarker = L.marker([47.024, 28.833]).addTo(map);
    chisinauMarker.bindPopup("Chișinău").openPopup();
  });
  