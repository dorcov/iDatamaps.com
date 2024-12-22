document.addEventListener("DOMContentLoaded", () => {
  // === 1. Inițializare hartă în div-ul #mapid ===
  const map = L.map("mapid", {
    center: [47, 28], // punct central (de exemplu, coordonatele Moldovei)
    zoom: 7,
    attributionControl: false
  });

  // (Opțional) - Poți adăuga un tileLayer de fundal
  // Atenție la CORS dacă vrei să exporți imaginea cu html2canvas
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    crossOrigin: true
  }).addTo(map);

  let currentLayer = null; // stratul curent (geoJSON)

  // Zoom recomandat pentru fiecare fișier
  const zoomSettings = {
    "md.json": 15,
    "ro_judete_poligon.json": 7,
    "europe.geojson": 4
  };

  // Referințe la elemente DOM
  const mapSelector = document.getElementById("mapSelector");
  const gradientSelector = document.getElementById("gradientSelector");
  const regionTableBody = document
    .getElementById("regionTable")
    .querySelector("tbody");
  const exportButton = document.getElementById("exportMap");

  // === 2. Funcție de calculare a culorii (în funcție de gradient) ===
  const getColor = (value, maxValue, gradient) => {
    if (value === 0 || isNaN(value)) return "#ccc"; // Gri pt valori lipsă
    const ratio = value / maxValue;

    switch (gradient) {
      case "blue":
        return `rgba(42, 115, 255, ${Math.min(0.3 + ratio * 0.7, 1)})`;
      case "green":
        return `rgba(50, 200, 50, ${Math.min(0.3 + ratio * 0.7, 1)})`;
      case "red":
        return `rgba(255, 50, 50, ${Math.min(0.3 + ratio * 0.7, 1)})`;
      case "blueDiverging":
        // dacă ratio > 0.5, albastru, altfel roșu
        return ratio > 0.5
          ? `rgba(42, 115, 255, ${Math.min(0.3 + (ratio - 0.5) * 1.4, 1)})`
          : `rgba(255, 50, 50, ${Math.min(0.3 + ratio * 1.4, 1)})`;
      default:
        return "#ccc";
    }
  };

  // === 3. Actualizează culorile hărții pe baza valorilor din tabel ===
  const updateMapGradient = () => {
    if (!currentLayer) return;

    // Aflăm valoarea maximă din input-urile tabelului
    const allInputs = regionTableBody.querySelectorAll("input[type='number']");
    const maxValue = Math.max(
      ...Array.from(allInputs).map((input) => parseFloat(input.value) || 0)
    );

    const gradient = gradientSelector.value;

    // Iterăm fiecare regiune (layer) și actualizăm fillColor
    currentLayer.eachLayer((layer) => {
      const props = layer.feature.properties;
      // unele fișiere au .NAME, altele .RAION, .name, etc.
      const regionName = props.NAME || props.RAION || props.name || "Unknown";

      // Căutăm input-ul corespondent
      const input = document.querySelector(
        `[data-region="${encodeURIComponent(regionName)}"]`
      );
      const value = input ? parseFloat(input.value) || 0 : 0;

      layer.setStyle({
        fillColor: getColor(value, maxValue, gradient),
        fillOpacity: 0.8,
        color: "#fff",
        weight: 1
      });
    });
  };

  // === 4. Construim Tabel (când încărcăm un nou GeoJSON) ===
  const generateTable = (geoData) => {
    // Curățăm conținutul vechi
    regionTableBody.innerHTML = "";

    geoData.features.forEach((feature) => {
      const props = feature.properties;
      const regionName = props.NAME || props.RAION || props.name || "Unknown";

      // Adăugăm un rând <tr> cu 2 coloane: regionName, input numeric
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${regionName}</td>
        <td>
          <input
            type="number"
            value="0"
            data-region="${encodeURIComponent(regionName)}"
          />
        </td>
      `;
      regionTableBody.appendChild(row);
    });

    // Event listener pe fiecare input => actualizează harta în timp real
    regionTableBody.querySelectorAll("input").forEach((input) => {
      input.addEventListener("input", updateMapGradient);
    });
  };

  // === 5. Încărcăm un fișier GeoJSON și îl afișăm pe hartă ===
  const loadMap = (geojsonFile) => {
    fetch(`data/${geojsonFile}`)
      .then((response) => response.json())
      .then((geoData) => {
        // Scoatem stratul vechi, dacă există
        if (currentLayer) {
          map.removeLayer(currentLayer);
        }

        // Creăm un nou strat geoJSON
        currentLayer = L.geoJSON(geoData, {
          style: {
            color: "#fff",
            weight: 1,
            fillColor: "#ccc",
            fillOpacity: 0.8
          },
          onEachFeature: (feature, layer) => {
            const props = layer.feature.properties;
            const regionName = props.NAME || props.RAION || props.name || "Unknown";
            // popup simplu cu numele regiunii
            layer.bindPopup(regionName);
          }
        }).addTo(map);

        // Ajustăm harta să încapă în bounding box-ul stratului încărcat
        map.fitBounds(currentLayer.getBounds(), {
          maxZoom: zoomSettings[geojsonFile] || 6
        });

        // Construim / reîncărcăm tabelul
        generateTable(geoData);
        // După ce există date în tabel, colorăm inițial harta
        updateMapGradient();
      })
      .catch((err) => console.error("Eroare la încărcarea GeoJSON:", err));
  };

  // === 6. Încarcă inițial "md.json" (Moldova) ===
  loadMap("md.json");

  // === 7. Când se schimbă harta din <select>, încărcăm fișierul corespunzător ===
  mapSelector.addEventListener("change", (e) => {
    loadMap(e.target.value);
  });

  // === 8. Când se schimbă gradientul, actualizăm culorile hărții ===
  gradientSelector.addEventListener("change", updateMapGradient);

  // === 9. Buton de export - exemplu cu html2canvas ===
  exportButton.addEventListener("click", () => {
    // Asigură-te că ai inclus scriptul html2canvas în index.html (vezi mai sus)
    if (typeof html2canvas === "undefined") {
      alert("html2canvas nu este încărcat. Asigură-te că ai inclus scriptul CDN!");
      return;
    }

    const mapElement = document.getElementById("mapid");
    html2canvas(mapElement, { useCORS: true })
      .then((canvas) => {
        const dataUrl = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = "map_snapshot.png";
        link.click();
      })
      .catch((err) => {
        console.error("Eroare la generarea screenshot-ului:", err);
      });
  });
});
