(function () {
  const NS = "http://www.w3.org/2000/svg";
  const skyData = window.MESSIER_SKY_DATA;

  function svgElement(name, attributes = {}) {
    const element = document.createElementNS(NS, name);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    return element;
  }

  function geometryLines(geometry) {
    if (!geometry) return [];
    if (geometry.type === "LineString") return [geometry.coordinates];
    if (geometry.type === "MultiLineString" || geometry.type === "Polygon") return geometry.coordinates;
    if (geometry.type === "MultiPolygon") return geometry.coordinates.flat();
    return [];
  }

  function longitudeDistance(longitude, center) {
    return ((longitude - center + 540) % 360) - 180;
  }

  async function render(container, messier) {
    if (!container) return;
    container.innerHTML = '<div class="image-placeholder placeholder">Loading local sky chart...</div>';
    try {
      const { catalog, figures, boundaries } = skyData;
      const object = catalog.features.find(feature => feature.id === `M${messier}`);
      if (!object) throw new Error("Coordinates unavailable");
      const [centerLongitude, centerLatitude] = object.geometry.coordinates;
      const width = 1000;
      const height = 440;
      const horizontalField = 90;
      const verticalField = 54;
      const project = ([longitude, latitude]) => [
        width / 2 - longitudeDistance(longitude, centerLongitude) / horizontalField * width,
        height / 2 - (latitude - centerLatitude) / verticalField * height
      ];

      const svg = svgElement("svg", { viewBox:`0 0 ${width} ${height}`, role:"img", "aria-label":`Sky chart around Messier ${messier}`, preserveAspectRatio:"xMidYMid slice" });
      const defs = svgElement("defs");
      const gradient = svgElement("radialGradient", { id:`skyGlow${messier}` });
      gradient.append(svgElement("stop", { offset:"0", "stop-color":"#101d35" }), svgElement("stop", { offset:"1", "stop-color":"#03060c" }));
      defs.appendChild(gradient);
      svg.append(defs, svgElement("rect", { width, height, fill:`url(#skyGlow${messier})` }));

      const stars = svgElement("g", { fill:"#dbe9ff" });
      for (let index = 0; index < 150; index++) {
        const x = (index * 83 + messier * 37) % width;
        const y = (index * index * 19 + messier * 53) % height;
        const radius = index % 17 === 0 ? 1.5 : index % 5 === 0 ? 1 : .55;
        stars.appendChild(svgElement("circle", { cx:x, cy:y, r:radius, opacity:index % 7 === 0 ? .95 : .62 }));
      }
      svg.appendChild(stars);

      function drawFeatures(collection, color, opacity, dash = "") {
        const group = svgElement("g", { fill:"none", stroke:color, "stroke-width":"1.7", opacity });
        if (dash) group.setAttribute("stroke-dasharray", dash);
        collection.features.forEach(feature => geometryLines(feature.geometry).forEach(line => {
          let segment = [];
          const flush = () => {
            if (segment.length > 1) group.appendChild(svgElement("polyline", { points:segment.map(point => point.join(",")).join(" ") }));
            segment = [];
          };
          line.forEach(coordinate => {
            const point = project(coordinate);
            if (segment.length && Math.abs(point[0] - segment[segment.length - 1][0]) > width * .55) flush();
            segment.push(point);
          });
          flush();
        }));
        svg.appendChild(group);
      }

      drawFeatures(boundaries, "#f5a23a", .72, "7 5");
      drawFeatures(figures, "#62a9ff", .95);

      const labels = svgElement("g", { fill:"#9bc7ff", "font-family":"Arial, sans-serif", "font-size":"16", "font-weight":"700", "text-anchor":"middle", opacity:".9" });
      figures.features.forEach(feature => {
        const coordinates = geometryLines(feature.geometry).flat();
        const nearby = coordinates.map(coordinate => ({ coordinate, point:project(coordinate) })).filter(item => item.point[0] > 35 && item.point[0] < width - 35 && item.point[1] > 25 && item.point[1] < height - 25);
        if (!nearby.length) return;
        const chosen = nearby[Math.floor(nearby.length / 2)].point;
        const label = svgElement("text", { x:chosen[0], y:chosen[1] - 10 });
        label.textContent = feature.id;
        labels.appendChild(label);
      });
      svg.appendChild(labels);

      const marker = svgElement("g", { stroke:"#ffd35a", "stroke-width":"4", fill:"none" });
      marker.append(svgElement("circle", { cx:width / 2, cy:height / 2, r:"11" }), svgElement("line", { x1:width / 2 - 24, y1:height / 2, x2:width / 2 - 8, y2:height / 2 }), svgElement("line", { x1:width / 2 + 8, y1:height / 2, x2:width / 2 + 24, y2:height / 2 }), svgElement("line", { x1:width / 2, y1:height / 2 - 24, x2:width / 2, y2:height / 2 - 8 }), svgElement("line", { x1:width / 2, y1:height / 2 + 8, x2:width / 2, y2:height / 2 + 24 }));
      const objectLabel = svgElement("text", { x:width / 2 + 18, y:height / 2 - 17, fill:"#ffe58a", "font-family":"Arial, sans-serif", "font-size":"19", "font-weight":"700" });
      objectLabel.textContent = `M${messier}`;
      svg.append(marker, objectLabel);
      container.replaceChildren(svg);
    } catch (error) {
      container.innerHTML = '<div class="image-placeholder placeholder">Local sky chart unavailable.</div>';
    }
  }

  window.MessierSkyMap = { render };
})();
