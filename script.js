// script.js

const canvas = document.getElementById('mapCanvas');
const ctx = canvas.getContext('2d');

// Încarcă imaginea hărții personalizate
const mapImage = new Image();
mapImage.src = 'path/to/your/map-image.png'; // Înlocuiește cu calea către imaginea ta

mapImage.onload = () => {
    // Desenează harta pe canvas
    ctx.drawImage(mapImage, 0, 0, canvas.width, canvas.height);
    // După încărcarea hărții, poți încărca straturile GeoJSON
    loadGeoJSON();
};

mapImage.onerror = () => {
    console.error('Eroare la încărcarea imaginii hărții.');
};

// Proiecție simplă: equirectangular
function project(lon, lat) {
    const x = ((lon + 180) / 360) * canvas.width;
    const y = ((90 - lat) / 180) * canvas.height;
    return [x, y];
}

// Funcție pentru a desena un poligon
function drawPolygon(coordinates, fillColor = 'rgba(0, 255, 0, 0.5)', strokeColor = '#fff') {
    ctx.beginPath();
    coordinates.forEach((coord, index) => {
        const [lon, lat] = coord;
        const [x, y] = project(lon, lat);
        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.stroke();
}

// Încărcarea fișierului GeoJSON
function loadGeoJSON() {
    fetch('path/to/your/data.geojson') // Înlocuiește cu calea către fișierul tău GeoJSON
        .then(response => response.json())
        .then(data => {
            data.features.forEach(feature => {
                const geometry = feature.geometry;
                if (geometry.type === 'Polygon') {
                    geometry.coordinates.forEach(polygon => {
                        drawPolygon(polygon);
                    });
                } else if (geometry.type === 'MultiPolygon') {
                    geometry.coordinates.forEach(multiPolygon => {
                        multiPolygon.forEach(polygon => {
                            drawPolygon(polygon);
                        });
                    });
                }
            });
        })
        .catch(err => console.error('Eroare la încărcarea GeoJSON:', err));
}

// Exportarea hărții ca PNG
document.getElementById('exportButton').addEventListener('click', () => {
    const dataURL = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = 'map.png';
    link.click();
});
