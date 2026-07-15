let mapData;
let religionDetails;
let nodeById;
let mapLayer;
let branchYByParent;
let childCountByParent;
let childrenByParent;
let leafNodes;
let timelineStops;
let routeOverrides;
let selectedNodeId = null;
const CACHE_SCALE = 2;
const TEXT_SIZE = {
  title: 34,
  subtitle: 27,
  region: 12,
  axis: 8,
  religion: 9,
};
const NODE_SIZE = {
  outer: 15.5,
  inner: 8.5,
};
const STROKE_SIZE = {
  link: 5,
  nodeOuter: 1.1,
  regionBorder: 2,
  axisBorder: 1,
};
const LABELS_ABOVE_NODE = new Set([
  "iroquois",
  "santeria",
  "pueblo",
  "mississippi",
  "haitianVoodoo",
  "sikhism",
  "islamSunni",
  "islamShiite",
  "bogomilism",
  "rosicrucian",
  "africanPoly",
  "tsao",
  "greek",
  "ethiopian",
  "indoIranian",
  "newGuinea",
  "eastOrthodox",
]);
let view = { x: 0, y: 0, scale: 0.86 };
let targetView = { x: 0, y: 0, scale: 0.86 };
let dragging = false;
let lastPointer = null;
let pointerDown = null;
let dragDistance = 0;
let hoveredNodeId = null;
let hoverScales = new Map();
let glowingNodes = [];
let nextNodeGlowAt = 0;
let sparklingStars = [];
let nextStarAt = 0;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const NODE_GLOW_DURATION = 1800;
const HALO_COLORS = [
  [28, 190, 123],
  [60, 170, 255],
  [176, 92, 255],
  [255, 72, 142],
  [255, 166, 54],
  [245, 220, 72],
  [52, 224, 220],
];

function preload() {
  if (window.RELIGION_TREE_DATA) {
    mapData = window.RELIGION_TREE_DATA;
  } else {
    mapData = loadJSON("religion-tree.json");
  }
  if (window.RELIGIONS_DATA) {
    religionDetails = window.RELIGIONS_DATA;
  } else {
    religionDetails = loadJSON("new-religion-data.json?v=20260714-rich-sidebar");
  }
}

function setup() {
  pixelDensity(min(window.devicePixelRatio || 1, 2));
  const { width: canvasWidth, height: canvasHeight } = mapAppSize();
  const canvas = createCanvas(canvasWidth, canvasHeight);
  canvas.parent("map-app");
  textFont("Roboto");
  indexNodes();
  bindDetailPanel();
  refreshReligionDetailsFromJson();
  renderMapLayer();
  fitInitialView();
  nextNodeGlowAt = millis() + random(220, 550);
  nextStarAt = millis() + random(700, 1600);
  startRandomHaloColors();
  if (reducedMotion) noLoop();
}

function startRandomHaloColors() {
  if (reducedMotion) return;
  const halo = document.querySelector(".ulc-logo-halo");
  if (!halo) return;

  const changeColor = () => {
    const [red, green, blue] = random(HALO_COLORS);
    halo.style.backgroundColor = `rgba(${red}, ${green}, ${blue}, 0.5)`;
    setTimeout(changeColor, random(850, 1550));
  };

  changeColor();
}

function mapAppSize() {
  const mapApp = document.getElementById("map-app");
  return {
    width: Math.max(1, mapApp?.clientWidth || windowWidth),
    height: Math.max(1, mapApp?.clientHeight || windowHeight),
  };
}

function resizeCanvasToMap() {
  const nextSize = mapAppSize();
  if (nextSize.width === width && nextSize.height === height) return;
  resizeCanvas(nextSize.width, nextSize.height);
  targetView = { ...view };
  redraw();
}

function draw() {
  animateView();
  background(0);
  drawingContext.imageSmoothingEnabled = true;
  drawingContext.imageSmoothingQuality = "high";
  drawLogoLeafLines();
  image(
    mapLayer,
    view.x,
    view.y,
    mapData.world.width * view.scale,
    mapData.world.height * view.scale
  );
  drawSparklingStars();
  drawRandomNodeGlow();
  drawHoverNode();
  drawTextOverlay();
  drawSelectionFocusOverlay();
}

function drawSparklingStars() {
  if (reducedMotion) return;

  const now = millis();
  const pointerIsOnMap = mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height;
  if (now >= nextStarAt && pointerIsOnMap) {
    const angle = random(TWO_PI);
    const distance = abs(randomGaussian(48, 34));
    sparklingStars.push({
      x: constrain(mouseX + cos(angle) * distance, 18, width - 18),
      y: constrain(mouseY + sin(angle) * distance, 18, height - 18),
      velocityX: random(-9, 9),
      velocityY: random(12, 34),
      size: random(2.5, 6.5),
      startedAt: now,
      duration: random(1800, 3200),
    });
    nextStarAt = now + random(220, 650);
  } else if (now >= nextStarAt) {
    nextStarAt = now + 250;
  }

  sparklingStars = sparklingStars.filter((star) => now - star.startedAt < star.duration);
  for (const star of sparklingStars) {
    if (now < star.startedAt) continue;
    const progress = (now - star.startedAt) / star.duration;
    const intensity = sq(sin(progress * PI));
    const radius = star.size * intensity;
    const elapsedSeconds = (now - star.startedAt) / 1000;
    const starX = star.x + star.velocityX * elapsedSeconds;
    const starY = star.y + star.velocityY * elapsedSeconds + 8 * sq(elapsedSeconds);

    push();
    translate(starX, starY);
    drawingContext.save();
    drawingContext.globalCompositeOperation = "screen";
    drawingContext.shadowColor = "rgba(255, 255, 255, 0.95)";
    drawingContext.shadowBlur = 4 + intensity * 11;
    stroke(255, intensity * 255);
    strokeWeight(lerp(0.45, 1.15, intensity));
    line(-radius, 0, radius, 0);
    line(0, -radius, 0, radius);
    stroke(255, intensity * 185);
    strokeWeight(0.55);
    line(-radius * 0.45, -radius * 0.45, radius * 0.45, radius * 0.45);
    line(-radius * 0.45, radius * 0.45, radius * 0.45, -radius * 0.45);
    noStroke();
    fill(255, intensity * 255);
    circle(0, 0, max(0.8, intensity * 2.2));
    drawingContext.restore();
    pop();
  }
}

function animateView() {
  if (dragging) return;
  const ease = 0.22;
  view.x = lerp(view.x, targetView.x, ease);
  view.y = lerp(view.y, targetView.y, ease);
  view.scale = lerp(view.scale, targetView.scale, ease);

  const settled =
    abs(view.x - targetView.x) < 0.05 &&
    abs(view.y - targetView.y) < 0.05 &&
    abs(view.scale - targetView.scale) < 0.0002;

  if (settled) {
    view.x = targetView.x;
    view.y = targetView.y;
    view.scale = targetView.scale;
    if (reducedMotion && !hasActiveHoverAnimation()) noLoop();
  }
}

function drawRandomNodeGlow() {
  if (reducedMotion || !mapData?.religions?.length) return;

  const now = millis();
  if (now >= nextNodeGlowAt) {
    glowingNodes.push({
      node: random(mapData.religions),
      startedAt: now,
    });
    nextNodeGlowAt = now + random(280, 720);
  }

  glowingNodes = glowingNodes.filter((glow) => now - glow.startedAt < NODE_GLOW_DURATION);
  for (const glow of glowingNodes) {
    const progress = (now - glow.startedAt) / NODE_GLOW_DURATION;
    const intensity = sq(sin(progress * PI));
    const node = glow.node;
    const nodeColor = colorFor(node);
    push();
    translate(view.x, view.y);
    scale(view.scale);
    drawingContext.save();
    drawingContext.globalCompositeOperation = "screen";
    drawingContext.shadowColor = nodeColor;
    drawingContext.shadowBlur = lerp(8, 42, intensity);
    noStroke();
    fill(withAlpha(nodeColor, intensity * 255));
    circle(node.renderPosition.x, node.renderPosition.y, NODE_SIZE.outer + intensity * 11);
    drawingContext.restore();
    pop();
  }
}

function indexNodes() {
  timelineStops = mapData.timelineTicks
    .map((tick) => ({ year: parseYear(tick.label), y: tick.y }))
    .filter((tick) => tick.year !== null)
    .sort((a, b) => a.year - b.year);

  for (const node of mapData.religions) {
    node.renderPosition = {
      x: node.position.x + (node.offset?.x || 0),
      y: yForDate(node.date, node.position.y) + (node.offset?.y || 0),
    };
  }

  nodeById = new Map(mapData.religions.map((node) => [node.id, node]));
  branchYByParent = new Map();
  childCountByParent = new Map();
  childrenByParent = new Map();

  for (const node of mapData.religions) {
    for (const parentId of node.parents || []) {
      if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
      childrenByParent.get(parentId).push(node);
    }
  }

  for (const [parentId, children] of childrenByParent) {
    childCountByParent.set(parentId, children.length);
    const parent = nodeById.get(parentId);
    if (!parent || children.length < 2) continue;
    const lowestChildTop = Math.min(...children.map((child) => child.renderPosition.y));
    const dy = lowestChildTop - parent.renderPosition.y;
    if (dy <= 24) continue;
    branchYByParent.set(parentId, snap(parent.renderPosition.y + dy * 0.7));
  }

  leafNodes = mapData.religions.filter((node) => {
    const year = parseYear(node.date);
    return !childCountByParent.has(node.id) && year !== null && year >= 1500;
  });

  routeOverrides = new Map([
    ["animism->middleSham", animismForkRoute],
    ["animism->protoIndo", animismForkRoute],
    ["animism->berber", animismForkRoute],
    ["animism->yoruba", animismForkRoute],
    ["animism->bantu", animismForkRoute],
    ["animism->nilotic", animismForkRoute],
    ["nilotic->zoroastrianism", niloticBranchRoute],
    ["nilotic->mithraism", niloticBranchRoute],
    ["nilotic->manichaeism", niloticBranchRoute],
    ["middleSham->egyptian", middleEastToEgyptianRoute],
    ["middleSham->mesopotamian", middleEastToEgyptianRoute],
    ["celtic->druidism", verticalThenHorizontalAtChildRoute],
    ["protoIndo->germanic", protoIndoBranchRoute],
    ["protoIndo->slavic", protoIndoBranchRoute],
    ["protoIndo->baltic", protoIndoBranchRoute],
    ["protoIndo->celtic", protoIndoBranchRoute],
    ["protoIndo->greek", protoIndoBranchRoute],
    ["protoIndo->indoIranian", indoIranianBridgeRoute],
    ["indoIranian->vedic", indoIranianToVedicRoute],
    ["archaicIndians->melanesian", oceaniaDropRoute],
    ["archaicIndians->polynesian", oceaniaDropRoute],
    ["archaicIndians->micronesian", oceaniaDropRoute],
    ["eastSouth->fosna", topHorizontalRoute],
    ["fosna->paleoIndian", topHorizontalRoute],
    ["paleoIndian->archaicIndians", verticalThenHorizontalAtChildRoute],
    ["archaicIndians->anasazi", verticalThenHorizontalAtChildRoute],
    ["archaicIndians->hopi", verticalThenHorizontalAtChildRoute],
    ["archaicIndians->olmec", verticalThenHorizontalAtChildRoute],
    ["fosna->siberia", arcticToSeidisRoute],
    ["fosna->finnish", arcticForkRoute],
    ["fosna->sidea", arcticForkRoute],
    ["muism->taoism", eastAsianBranchRoute],
    ["muism->shinto", eastAsianBranchRoute],
    ["muism->confucianism", eastAsianBranchRoute],
    ["muism->tengrism", eastAsianBranchRoute],
    ["theosophy->wicca", raisedModernForkRoute],
    ["theosophy->tsao", raisedModernForkRoute],
    ["theosophy->rosicrucian", raisedModernForkRoute],
    ["tsao->thelema", raisedModernForkRoute],
    ["tsao->anthroposophy", raisedModernForkRoute],
    ["olmec->teotihuacan", horizontalThenVertical],
    ["teotihuacan->santoDaime", teotihuacanToSantoDaimeRoute],
    ["greek->grecoRoman", directRoute],
    ["greek->hermeticism", horizontalThenVertical],
    ["grecoRoman->gnosticism", verticalThenHorizontalAtChildRoute],
    ["gnosticism->bogomilism", directRoute],
    ["bogomilism->catharism", verticalThenHorizontalAtChildRoute],
    ["manichaeism->africanPoly", directRoute],
    ["buddhism->theravada", buddhismChildRoute],
    ["buddhism->mahayana", buddhismChildRoute],
    ["buddhism->vajrayana", buddhismChildRoute],
    ["buddhism->bon", buddhismChildRoute],
  ]);
}

function colorFor(nodeOrKey) {
  const key = typeof nodeOrKey === "string" ? nodeOrKey : nodeOrKey.region;
  return mapData.palette[key] || key || mapData.palette.white;
}

function snap(value) {
  return Math.round(value * 2) / 2;
}

function parseYear(label) {
  if (!label) return null;
  const match = String(label).match(/([\d,]+)/);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(value)) return null;
  return /BC/i.test(label) ? -value : value;
}

function yForDate(date, fallbackY) {
  const year = parseYear(date);
  if (year === null || timelineStops.length < 2) return fallbackY;
  if (year <= timelineStops[0].year) return timelineStops[0].y;
  if (year >= timelineStops[timelineStops.length - 1].year) {
    return timelineStops[timelineStops.length - 1].y;
  }

  for (let i = 0; i < timelineStops.length - 1; i++) {
    const start = timelineStops[i];
    const end = timelineStops[i + 1];
    if (year >= start.year && year <= end.year) {
      const amount = (year - start.year) / (end.year - start.year);
      return start.y + (end.y - start.y) * amount;
    }
  }

  return fallbackY;
}

function renderMapLayer() {
  mapLayer = createGraphics(
    mapData.world.width * CACHE_SCALE,
    mapData.world.height * CACHE_SCALE
  );
  mapLayer.pixelDensity(1);
  mapLayer.canvas.style.display = "none";
  mapLayer.noSmooth();
  mapLayer.clear();
  mapLayer.scale(CACHE_SCALE);
  mapLayer.textFont("Roboto");
  drawTitleText(mapLayer);
  drawRegionKeyShapes(mapLayer);
  drawRegionKeyText(mapLayer);
  drawAxisShapes(mapLayer);
  drawAxisText(mapLayer);
  drawSharedBranchGuides(mapLayer);
  drawLinks(mapLayer);
  drawNodes(mapLayer);
}

function drawTextOverlay() {
  push();
  translate(view.x, view.y);
  scale(view.scale);
  drawNodeLabels();
  pop();
}

function drawLogoLeafLines() {
  if (!leafNodes?.length) return;
  const logoCenter = getLogoCenter();
  push();
  resetMatrix();
  drawingContext.save();
  drawingContext.globalCompositeOperation = "screen";
  strokeWeight(2.4);
  for (const node of leafNodes) {
    const dateAnchor = dateAnchorForNode(node);
    const end = worldToScreenPoint(dateAnchor.x, dateAnchor.y);
    stroke(withAlpha(colorFor(node), 190));
    line(logoCenter.x, logoCenter.y, end.x, end.y);
  }
  drawingContext.restore();
  pop();
}

function getLogoCenter() {
  const logo = document.getElementById("ulc-logo");
  if (!logo) return { x: width / 2, y: height - 57 };
  const rect = logo.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function worldToScreenPoint(x, y) {
  return {
    x: view.x + x * view.scale,
    y: view.y + y * view.scale,
  };
}

function dateAnchorForNode(node) {
  const circleRadius = NODE_SIZE.outer / 2;
  const pos = node.renderPosition;
  const nameOffset = node.nameOffset || node.labelOffset || {};
  const dateOffset = node.dateOffset || node.labelOffset || {};
  const nameOffsetX = nameOffset.x || 0;
  const nameOffsetY = nameOffset.y || 0;
  const dateOffsetX = dateOffset.x || 0;
  const dateOffsetY = dateOffset.y || 0;
  const labelY = labelYForNode(node, nameOffsetY);
  return {
    x: pos.x + (LABELS_ABOVE_NODE.has(node.id) ? nameOffsetX : dateOffsetX),
    y: labelY + labelHeightForNode(node) + 2 + dateOffsetY,
  };
}

function labelYForNode(node, offsetY = 0) {
  const circleRadius = NODE_SIZE.outer / 2;
  if (LABELS_ABOVE_NODE.has(node.id)) {
    const dateSpace = node.date ? 11 : 0;
    return node.renderPosition.y - circleRadius - 3 - labelHeightForNode(node) - dateSpace + offsetY;
  }
  return node.renderPosition.y + circleRadius + 3 + offsetY;
}

function labelHeightForNode(node) {
  const labelLines = node.name.split("\n").filter(Boolean);
  const subtextLines = node.subtext ? String(node.subtext).split("\n").filter(Boolean) : labelLines.slice(1);
  const lines = [labelLines[0], ...subtextLines].filter(Boolean);
  return lines.length * 11;
}

function withAlpha(colorValue, alpha) {
  const rgb = colorToRgb(colorValue);
  if (!rgb) return colorValue;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha / 255})`;
}

function drawSelectionFocusOverlay() {
  if (!selectedNodeId) return;
  const relatedIds = descendantNodeSet(selectedNodeId);
  if (!relatedIds.size) return;

  push();
  resetMatrix();
  noStroke();
  fill(0, 178);
  rect(0, 0, width, height);
  pop();

  push();
  translate(view.x, view.y);
  scale(view.scale);
  drawFocusedSharedBranchGuides(relatedIds);
  drawRelatedLinks(relatedIds);
  drawRelatedNodes(relatedIds);
  drawNodeLabels(relatedIds);
  drawSelectedNodeRing();
  pop();
}

function descendantNodeSet(rootId) {
  const related = new Set();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop();
    if (related.has(id)) continue;
    related.add(id);
    for (const child of childrenByParent.get(id) || []) {
      stack.push(child.id);
    }
    for (const childId of religionDetails?.[id]?.children || []) {
      stack.push(childId);
    }
  }
  return related;
}

function drawRelatedLinks(relatedIds) {
  const target = currentCanvasTarget();
  for (const node of mapData.religions) {
    if (!relatedIds.has(node.id)) continue;
    for (const parentId of node.parents || []) {
      if (!relatedIds.has(parentId)) continue;
      const parent = nodeById.get(parentId);
      if (parent) {
        const route = getRoute(parent, node);
        drawRoute(target, route, colorFor(parent), colorFor(node), isForkLink(parent, route));
      }
    }
  }
}

function drawFocusedSharedBranchGuides(relatedIds) {
  drawAnimismForkGuide(currentCanvasTarget(), relatedIds);
  drawIndoNiloticBranchGuide(currentCanvasTarget(), relatedIds);
}

function drawRelatedNodes(relatedIds) {
  for (const node of mapData.religions) {
    if (!relatedIds.has(node.id)) continue;
    const x = snap(node.renderPosition.x);
    const y = snap(node.renderPosition.y);
    stroke(255);
    strokeWeight(STROKE_SIZE.nodeOuter + 0.6);
    fill(colorFor(node));
    circle(x, y, NODE_SIZE.outer);
  }
}

function currentCanvasTarget() {
  return {
    drawingContext,
    strokeWeight: (value) => strokeWeight(value),
    noFill: () => noFill(),
    stroke: (value) => stroke(value),
    line: (x1, y1, x2, y2) => line(x1, y1, x2, y2),
    strokeCap: (value) => strokeCap(value),
    noStroke: () => noStroke(),
    fill: (value) => fill(value),
    rect: (x, y, w, h) => rect(x, y, w, h),
    beginShape: () => beginShape(),
    vertex: (x, y) => vertex(x, y),
    endShape: () => endShape(),
  };
}

function drawSelectedNodeRing() {
  if (!selectedNodeId) return;
  const node = nodeById.get(selectedNodeId);
  if (!node) return;

  noFill();
  stroke(255);
  strokeWeight(1.5);
  circle(node.renderPosition.x, node.renderPosition.y, NODE_SIZE.outer + 8);
  stroke(colorFor(node));
  strokeWeight(0.8);
  circle(node.renderPosition.x, node.renderPosition.y, NODE_SIZE.outer + 12);
}

function drawHoverNode() {
  let isAnimating = false;

  for (const node of mapData.religions) {
    const current = hoverScales.get(node.id) || 0;
    const target = node.id === hoveredNodeId ? 1 : 0;
    const next = lerp(current, target, 0.28);
    const settled = abs(next - target) < 0.015;
    const scaleAmount = settled ? target : next;

    if (scaleAmount > 0) {
      drawHoverNodeOverlay(node, scaleAmount);
    }

    if (scaleAmount === 0) {
      hoverScales.delete(node.id);
    } else {
      hoverScales.set(node.id, scaleAmount);
    }

    if (!settled) isAnimating = true;
  }

  if (isAnimating) loop();
}

function drawHoverNodeOverlay(node, amount) {
  const radius = lerp(NODE_SIZE.outer, NODE_SIZE.outer * 1.42, amount);
  const ringRadius = radius + lerp(3, 6, amount);
  push();
  translate(view.x, view.y);
  scale(view.scale);
  noFill();
  stroke(colorFor(node));
  strokeWeight(lerp(0.6, 1.4, amount));
  circle(node.renderPosition.x, node.renderPosition.y, ringRadius);
  stroke(255);
  strokeWeight(STROKE_SIZE.nodeOuter + lerp(0.2, 0.9, amount));
  fill(colorFor(node));
  circle(node.renderPosition.x, node.renderPosition.y, radius);
  pop();
}

function hasActiveHoverAnimation() {
  for (const [id, amount] of hoverScales) {
    const target = id === hoveredNodeId ? 1 : 0;
    if (abs(amount - target) >= 0.015) return true;
  }
  return false;
}

function bindDetailPanel() {
  const closeButton = document.getElementById("religion-detail-close");
  const content = document.getElementById("religion-detail-content");
  if (!closeButton || !content) return;
  closeButton.addEventListener("click", closeReligionDetail);
  content.addEventListener("click", (event) => {
    const button = event.target.closest(".religion-detail__read-more");
    if (!button) return;
    const description = button.previousElementSibling;
    const expanded = description.classList.toggle("is-expanded");
    button.textContent = expanded ? "READ LESS" : "READ MORE";
    button.setAttribute("aria-expanded", String(expanded));
  });
}

function refreshReligionDetailsFromJson() {
  fetch(`new-religion-data.json?v=${Date.now()}`)
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => {
      if (!data) return;
      religionDetails = data;
      if (selectedNodeId) {
        const node = nodeById.get(selectedNodeId);
        if (node) renderReligionDetail(node);
      }
    })
    .catch(() => {});
}

function selectReligionNode(node) {
  selectedNodeId = node.id;
  renderReligionDetail(node);
  scheduleMapResize();
  redraw();
}

function renderReligionDetail(node) {
  const panel = document.getElementById("religion-detail");
  const content = document.getElementById("religion-detail-content");
  if (!panel || !content) return;

  const details = religionDetails?.[node.id] || {};
  const name = details.name || node.name;
  const date = details.date || node.date || "";
  const area = details.area || node.region || "";
  const description = details.description || "No description has been added yet.";
  const parents = formatLinkedReligionList(details.parents || node.parents || []);
  const children = formatLinkedReligionList(details.children || []);
  const gods = details.gods || [];
  const sources = details.sources || [];
  const detailColor = colorFor(node);
  setDetailPanelColor(panel, detailColor);

  content.innerHTML = `
    <h2>${escapeHtml(formatDisplayName(name))}</h2>
    ${renderMetaPills(date, area)}
    ${renderFactTags(details)}
    <div class="religion-detail__description">
      <p>${highlightReligionName(description, name)}</p>
      <button class="religion-detail__read-more" type="button" aria-expanded="false">READ MORE</button>
    </div>
    <div class="religion-detail__relations">
      ${renderRelationPill("Parents", parents)}
      ${renderRelationPill("Children", children)}
    </div>
    ${renderGodsSection(gods, details.godsNote, name)}
    ${renderSourcesSection(sources)}
  `;
  panel.classList.add("is-open");
  panel.setAttribute("aria-hidden", "false");
  document.body.classList.add("detail-sidebar-open");
  requestAnimationFrame(() => {
    const descriptionElement = content.querySelector(".religion-detail__description p");
    const readMoreButton = content.querySelector(".religion-detail__read-more");
    if (descriptionElement && readMoreButton && descriptionElement.scrollHeight <= descriptionElement.clientHeight + 1) {
      readMoreButton.hidden = true;
    }
  });
}

function setDetailPanelColor(panel, colorValue) {
  const rgb = colorToRgb(colorValue);
  if (!rgb) return;
  panel.style.setProperty("--detail-color", colorValue);
  panel.style.setProperty("--detail-color-soft", `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.58)`);
  panel.style.setProperty("--detail-color-glow", `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.22)`);
  panel.style.setProperty("--detail-color-bg", `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.15)`);
  panel.style.setProperty("--detail-color-light", `rgb(${rgb.map((channel) => Math.round(channel + (255 - channel) * 0.48)).join(", ")})`);
}

function closeReligionDetail() {
  selectedNodeId = null;
  const panel = document.getElementById("religion-detail");
  if (!panel) return;
  panel.classList.remove("is-open");
  panel.setAttribute("aria-hidden", "true");
  document.body.classList.remove("detail-sidebar-open");
  scheduleMapResize();
  redraw();
}

function scheduleMapResize() {
  requestAnimationFrame(resizeCanvasToMap);
  window.setTimeout(resizeCanvasToMap, 200);
}

function renderFactTags(details) {
  const facts = [
    details.status && ["Status", formatTrait(details.status)],
    details.family && ["Family", formatTrait(details.family)],
    ...(details.theology || []).map((item) => ["Theology", formatTrait(item)]),
    ...(details.originType || []).map((item) => ["Origin", formatTrait(item)]),
    ...(details.practices || []).map((item) => ["Practice", formatTrait(item)]),
    details.contestedClassification ? ["Classification", "Contested"] : null,
  ].filter(Boolean);

  if (!facts.length) return "";
  return `
    <div class="religion-detail__tags">
      ${facts.map(([label, value]) => `<span><small>${escapeHtml(label)}</small>${escapeHtml(value)}</span>`).join("")}
    </div>
  `;
}

function renderMetaPills(date, area) {
  const facts = [date, area && formatAreaName(area)].filter(Boolean);
  if (!facts.length) return "";
  return `<div class="religion-detail__meta-pills">${facts
    .map((value) => `<span>${escapeHtml(value)}</span>`)
    .join("")}</div>`;
}

function renderRelationPill(label, valueHtml) {
  return `<div class="religion-detail__relation"><small>${escapeHtml(label)}</small><span>${valueHtml}</span></div>`;
}

function renderGodsSection(gods, godsNote, religionName) {
  if (!gods.length && !godsNote) return "";
  return `
    <section class="religion-detail__section">
      <h3>Figures and Powers</h3>
      ${godsNote ? `<p class="religion-detail__note">${highlightReligionName(godsNote, religionName)}</p>` : ""}
      ${gods.length ? `<div class="religion-detail__cards">${gods.map((god) => renderGodCard(god, religionName)).join("")}</div>` : ""}
    </section>
  `;
}

function renderGodCard(god, religionName) {
  const aka = god.aka?.length ? `<div class="religion-detail__aka">${escapeHtml(god.aka.join(", "))}</div>` : "";
  const domain = god.domain ? `<div class="religion-detail__domain">${escapeHtml(god.domain)}</div>` : "";
  return `
    <article class="religion-detail__card">
      <h4>${escapeHtml(god.name || "Unnamed figure")}</h4>
      ${aka}
      ${domain}
      ${god.description ? `<p>${highlightReligionName(god.description, religionName)}</p>` : ""}
    </article>
  `;
}

function renderSourcesSection(sources) {
  if (!sources.length) return "";
  return `
    <section class="religion-detail__section">
      <h3>Sources</h3>
      <ol class="religion-detail__sources">
        ${sources.map(renderSourceItem).join("")}
      </ol>
    </section>
  `;
}

function renderSourceItem(source) {
  const title = source.title || source.container || "Source";
  const container = source.container ? ` <span>${escapeHtml(source.container)}</span>` : "";
  const author = source.author ? `<span>${escapeHtml(source.author)}</span>` : "";
  const link = source.link
    ? `<a href="${escapeAttribute(source.link)}" target="_blank" rel="noreferrer">${escapeHtml(title)}</a>`
    : escapeHtml(title);
  return `<li>${link}${container}${author}</li>`;
}

function formatTrait(value) {
  return String(value || "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatLinkedReligionList(ids) {
  if (!ids.length) return '<span class="religion-detail__empty">None</span>';
  return ids
    .map((id) => {
      const details = religionDetails?.[id];
      const node = nodeById.get(id);
      return escapeHtml(formatDisplayName(details?.name || node?.name || id));
    })
    .join(", ");
}

function formatDisplayName(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function formatAreaName(areaKey) {
  const region = mapData.regions.find((item) => item.color === areaKey);
  return formatDisplayName(region?.label || areaKey);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function highlightReligionName(value, religionName) {
  const terms = [...new Set(String(religionName || "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .split(/\s+/)
    .filter((term) => term.length > 2)
    .map((term) => term.toLowerCase()))];
  if (!terms.length) return escapeHtml(value);
  const pattern = new RegExp(`(${terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return String(value).split(pattern).map((part) =>
    terms.includes(part.toLowerCase())
      ? `<mark class="religion-detail__name-highlight">${escapeHtml(part)}</mark>`
      : escapeHtml(part)
  ).join("");
}

function drawTitleText(target) {
  const { width: worldWidth } = mapData.world;
  target.noStroke();
  target.textAlign(CENTER, CENTER);
  target.textFont("Papyrus Local");
  target.textStyle(BOLD);
  target.textSize(TEXT_SIZE.title);
  target.fill(255);
  target.text(mapData.title, worldWidth / 2, 34);
  target.textFont("Roboto");
  target.textSize(TEXT_SIZE.subtitle);
  target.fill(mapData.palette.goldText);
  target.text(mapData.subtitle, worldWidth / 2, 76);
  target.textStyle(NORMAL);
}

function drawRegionKeyShapes(target) {
  for (const region of mapData.regions) {
    const { label, color, x, y, width: w } = region;
    target.fill(colorFor(color));
    target.stroke(255);
    target.strokeWeight(STROKE_SIZE.regionBorder);
    const h = 30;
    target.beginShape();
    target.vertex(x - w / 2 + 12, y - h / 2);
    target.vertex(x + w / 2 - 12, y - h / 2);
    target.vertex(x + w / 2, y);
    target.vertex(x + w / 2 - 12, y + h / 2);
    target.vertex(x - w / 2 + 12, y + h / 2);
    target.vertex(x - w / 2, y);
    target.endShape(CLOSE);
  }
}

function drawRegionKeyText(target) {
  target.textAlign(CENTER, CENTER);
  target.textSize(TEXT_SIZE.region);
  target.textStyle(BOLD);
  target.noStroke();
  target.fill(255);
  for (const region of mapData.regions) {
    target.text(region.label, region.x, region.y + 1);
  }
  target.textStyle(NORMAL);
}

function drawAxisShapes(target) {
  for (const tick of mapData.timelineTicks) {
    const x = mapData.axis.x;
    const y = tick.y;
    target.fill(mapData.palette.axis);
    target.stroke(20);
    target.strokeWeight(STROKE_SIZE.axisBorder);
    target.beginShape();
    target.vertex(x - 22, y - 11);
    target.vertex(x + 20, y - 11);
    target.vertex(x + 27, y);
    target.vertex(x + 20, y + 11);
    target.vertex(x - 22, y + 11);
    target.vertex(x - 29, y);
    target.endShape(CLOSE);
  }
}

function drawAxisText(target) {
  target.textAlign(CENTER, CENTER);
  target.textSize(TEXT_SIZE.axis);
  target.textStyle(BOLD);
  target.noStroke();
  target.fill(0);
  for (const tick of mapData.timelineTicks) {
    target.text(tick.label, mapData.axis.x, tick.y);
  }
  target.textStyle(NORMAL);
}

function drawLinks(target) {
  target.strokeCap(SQUARE);
  const deferredLinks = [];
  for (const node of mapData.religions) {
    for (const parentId of node.parents || []) {
      const parent = nodeById.get(parentId);
      if (!parent) continue;
      if (shouldDrawLinkOnTop(parent, node)) {
        deferredLinks.push({ parent, node });
      } else {
        drawLink(target, parent, node);
      }
    }
  }

  for (const { parent, node } of deferredLinks) {
    drawLink(target, parent, node);
  }
}

function shouldDrawLinkOnTop(parent, node) {
  return (
    (parent.id === "paleoIndian" && node.id === "archaicIndians") ||
    (parent.id === "archaicIndians" && node.region === "northAmerica")
  );
}

function drawLink(target, parent, node) {
  const route = getRoute(parent, node);
  drawRoute(target, route, colorFor(parent), colorFor(node), isForkLink(parent, route));
}

function isForkLink(parent, route) {
  return (childCountByParent.get(parent.id) || 0) > 1 && route.length > 2;
}

function drawRoute(target, route, parentColor, childColor, keepTrunkColor = false) {
  target.strokeWeight(STROKE_SIZE.link);
  target.noFill();

  if (route.length < 2) return;

  const segmentLengths = [];
  let totalLength = 0;
  for (let i = 1; i < route.length; i++) {
    const length = dist(route[i - 1].x, route[i - 1].y, route[i].x, route[i].y);
    segmentLengths.push(length);
    totalLength += length;
  }

  if (totalLength === 0 || sameColor(parentColor, childColor)) {
    target.stroke(childColor);
    target.beginShape();
    for (const point of route) {
      target.vertex(point.x, point.y);
    }
    target.endShape();
    fillSolidRouteCorners(target, route, childColor);
    return;
  }

  const start = colorToRgb(parentColor);
  const end = colorToRgb(childColor);
  if (!start || !end) {
    target.stroke(childColor);
    target.beginShape();
    for (const point of route) {
      target.vertex(point.x, point.y);
    }
    target.endShape();
    return;
  }

  let startIndex = 1;
  let gradientStartLength = 0;
  let gradientTotalLength = totalLength;

  if (keepTrunkColor) {
    target.stroke(parentColor);
    for (let i = 1; i < route.length - 1; i++) {
      const trunkStart = route[i - 1];
      const trunkEnd = route[i];
      target.line(trunkStart.x, trunkStart.y, trunkEnd.x, trunkEnd.y);
      gradientStartLength += segmentLengths[i - 1] || 0;
    }
    startIndex = route.length - 1;
    gradientTotalLength = totalLength - gradientStartLength;
  }

  let traveled = 0;
  for (let i = startIndex; i < route.length; i++) {
    const a = route[i - 1];
    const b = route[i];
    const length = segmentLengths[i - 1];
    if (length === 0) continue;

    const from = mixRgb(start, end, gradientTotalLength === 0 ? 1 : traveled / gradientTotalLength);
    const to = mixRgb(start, end, gradientTotalLength === 0 ? 1 : (traveled + length) / gradientTotalLength);
    const gradient = target.drawingContext.createLinearGradient(a.x, a.y, b.x, b.y);
    gradient.addColorStop(0, rgbString(from));
    gradient.addColorStop(1, rgbString(to));
    drawCanvasLine(target, a, b, gradient);
    traveled += length;
  }

  fillRouteCorners(
    target,
    route,
    segmentLengths,
    totalLength,
    start,
    end,
    keepTrunkColor,
    gradientStartLength,
    gradientTotalLength
  );
}

function drawCanvasLine(target, a, b, strokeStyle) {
  const context = target.drawingContext;
  context.save();
  context.strokeStyle = strokeStyle;
  context.lineWidth = STROKE_SIZE.link;
  context.lineCap = "butt";
  context.lineJoin = "miter";
  context.beginPath();
  context.moveTo(a.x, a.y);
  context.lineTo(b.x, b.y);
  context.stroke();
  context.restore();
}

function sameColor(a, b) {
  return String(a).toLowerCase() === String(b).toLowerCase();
}

function colorToRgb(value) {
  const hex = String(value).trim();
  const short = /^#([0-9a-f]{3})$/i.exec(hex);
  if (short) {
    return short[1].split("").map((digit) => parseInt(digit + digit, 16));
  }

  const full = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!full) return null;
  return [
    parseInt(full[1].slice(0, 2), 16),
    parseInt(full[1].slice(2, 4), 16),
    parseInt(full[1].slice(4, 6), 16),
  ];
}

function mixRgb(start, end, amount) {
  return start.map((channel, index) => round(lerp(channel, end[index], amount)));
}

function rgbString(rgb) {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

function fillRouteCorners(
  target,
  route,
  segmentLengths,
  totalLength,
  start,
  end,
  keepTrunkColor = false,
  gradientStartLength = 0,
  gradientTotalLength = totalLength
) {
  let traveled = 0;
  target.noStroke();
  for (let i = 1; i < route.length - 1; i++) {
    traveled += segmentLengths[i - 1];
    const amount = keepTrunkColor && traveled <= gradientStartLength
      ? 0
      : (traveled - gradientStartLength) / gradientTotalLength;
    const cornerColor = mixRgb(start, end, constrain(amount, 0, 1));
    fillRouteCorner(target, route[i - 1], route[i], route[i + 1], rgbString(cornerColor));
  }
  target.strokeCap(SQUARE);
}

function fillSolidRouteCorners(target, route, colorValue) {
  target.noStroke();
  for (let i = 1; i < route.length - 1; i++) {
    fillRouteCorner(target, route[i - 1], route[i], route[i + 1], colorValue);
  }
  target.strokeCap(SQUARE);
}

function fillRouteCorner(target, previous, corner, next, colorValue) {
  const half = STROKE_SIZE.link / 2;
  target.fill(colorValue);
  target.rect(corner.x - half, corner.y - half, STROKE_SIZE.link, STROKE_SIZE.link);
}

function getRoute(parent, node) {
  const override = routeOverrides.get(`${parent.id}->${node.id}`);
  if (override) return override(parent, node);

  const x = snap(node.renderPosition.x);
  const y = snap(node.renderPosition.y);
  const px = snap(parent.renderPosition.x);
  const py = snap(parent.renderPosition.y);
  const midY = branchYByParent.get(parent.id) || snap(py + (y - py) * 0.55);
  return [
    { x: px, y: py },
    { x: px, y: midY },
    { x, y: midY },
    { x, y },
  ];
}

function horizontalThenVertical(parent, node) {
  const x = snap(node.renderPosition.x);
  const y = snap(node.renderPosition.y);
  const px = snap(parent.renderPosition.x);
  const py = snap(parent.renderPosition.y);
  return [
    { x: px, y: py },
    { x, y: py },
    { x, y },
  ];
}

function directRoute(parent, node) {
  return [
    { x: snap(parent.renderPosition.x), y: snap(parent.renderPosition.y) },
    { x: snap(node.renderPosition.x), y: snap(node.renderPosition.y) },
  ];
}

function raisedModernForkRoute(parent, node) {
  const x = snap(node.renderPosition.x);
  const y = snap(node.renderPosition.y);
  const px = snap(parent.renderPosition.x);
  const py = snap(parent.renderPosition.y);
  const branchY = modernEsotericForkY();
  return [
    { x: px, y: py },
    { x: px, y: branchY },
    { x, y: branchY },
    { x, y },
  ];
}

function modernEsotericForkY() {
  return snap(yForDate("1500 AD", nodeById.get("theosophy")?.renderPosition.y || 830));
}

function middleEastToEgyptianRoute(parent, node) {
  const x = snap(node.renderPosition.x);
  const y = snap(node.renderPosition.y);
  const px = snap(parent.renderPosition.x);
  const py = snap(parent.renderPosition.y);
  const branchY = snap(yForDate("5000 BC", py));
  return [
    { x: px, y: py },
    { x: px, y: branchY },
    { x, y: branchY },
    { x, y },
  ];
}

function animismForkRoute(parent, node) {
  const x = snap(node.renderPosition.x);
  const y = snap(node.renderPosition.y);
  const branchY = animismForkY(parent.renderPosition.y);
  return [
    { x, y: branchY },
    { x, y },
  ];
}

function animismForkY(fallbackY) {
  return snap(yForDate("20,000 BC", fallbackY));
}

function drawSharedBranchGuides(target) {
  drawAnimismForkGuide(target);
  drawIndoNiloticBranchGuide(target);
}

function drawAnimismForkGuide(target, relatedIds = null) {
  if (!nodeById) return;
  const animism = nodeById.get("animism");
  const protoIndo = nodeById.get("protoIndo");
  const paleoIndian = nodeById.get("paleoIndian");
  if (!animism || !protoIndo || !paleoIndian) return;
  if (relatedIds && !relatedIds.has("animism")) return;

  const y = animismForkY(animism.renderPosition.y);
  const trunkX = snap(animism.renderPosition.x);
  const startX = snap(protoIndo.renderPosition.x);
  const endX = snap(paleoIndian.renderPosition.x);
  target.stroke(colorFor(animism));
  target.strokeWeight(STROKE_SIZE.link);
  target.noFill();
  target.line(trunkX, snap(animism.renderPosition.y), trunkX, y);
  target.line(startX, y, endX, y);
  target.stroke(colorFor(paleoIndian));
  target.line(endX, y, endX, snap(paleoIndian.renderPosition.y));
}

function niloticBranchRoute(parent, node) {
  const x = snap(node.renderPosition.x);
  const y = snap(node.renderPosition.y);
  const branchY = sharedIndoNiloticBranchY(parent.renderPosition.y);
  return [
    { x, y: branchY },
    { x, y },
  ];
}

function indoIranianBridgeRoute(parent, node) {
  const x = snap(node.renderPosition.x);
  const y = snap(node.renderPosition.y);
  const branchY = sharedIndoNiloticBranchY(parent.renderPosition.y);
  return [
    { x, y: branchY },
    { x, y },
  ];
}

function protoIndoBranchRoute(parent, node) {
  const x = snap(node.renderPosition.x);
  const y = snap(node.renderPosition.y);
  const branchY = sharedIndoNiloticBranchY(parent.renderPosition.y);
  return [
    { x, y: branchY },
    { x, y },
  ];
}

function sharedIndoNiloticBranchY(fallbackY) {
  return snap(yForDate("2500 BC", fallbackY));
}

function drawIndoNiloticBranchGuide(target, relatedIds = null) {
  const protoIndo = nodeById.get("protoIndo");
  const nilotic = nodeById.get("nilotic");
  if (!protoIndo || !nilotic) return;

  const branchY = sharedIndoNiloticBranchY(protoIndo.renderPosition.y);
  const branchIds = [
    "germanic",
    "slavic",
    "baltic",
    "celtic",
    "greek",
    "indoIranian",
    "zoroastrianism",
    "mithraism",
    "manichaeism",
  ];
  const branchNodes = branchIds.map((id) => nodeById.get(id)).filter(Boolean);
  if (!branchNodes.length) return;
  const visibleBranchNodes = relatedIds
    ? branchNodes.filter((node) => relatedIds.has(node.id))
    : branchNodes;
  if (!visibleBranchNodes.length) return;

  const startX = snap(Math.min(...visibleBranchNodes.map((node) => node.renderPosition.x)));
  const endX = snap(Math.max(...visibleBranchNodes.map((node) => node.renderPosition.x)));
  const protoX = snap(protoIndo.renderPosition.x);
  const niloticX = snap(nilotic.renderPosition.x);
  const protoTop = snap(protoIndo.renderPosition.y);
  const niloticTop = snap(nilotic.renderPosition.y);

  target.strokeWeight(STROKE_SIZE.link);
  target.noFill();
  if (!relatedIds || relatedIds.has("protoIndo")) {
    target.stroke(colorFor(protoIndo));
    target.line(protoX, protoTop, protoX, branchY);
  }
  if (!relatedIds || relatedIds.has("nilotic")) {
    target.stroke(colorFor(nilotic));
    target.line(niloticX, niloticTop, niloticX, branchY);
  }

  drawColoredHorizontalSpan(target, startX, min(endX, niloticX), branchY, colorFor(protoIndo));
  drawColoredHorizontalSpan(target, max(startX, niloticX), min(endX, niloticX + 44), branchY, colorFor(nilotic));
  drawColoredHorizontalSpan(target, max(startX, niloticX + 44), endX, branchY, colorFor("middleEast"));
}

function drawColoredHorizontalSpan(target, startX, endX, y, colorValue) {
  if (endX <= startX) return;
  target.stroke(colorValue);
  target.line(startX, y, endX, y);
}

function indoIranianToVedicRoute(parent, node) {
  const x = snap(node.renderPosition.x);
  const y = snap(node.renderPosition.y);
  const px = snap(parent.renderPosition.x);
  const py = snap(parent.renderPosition.y);
  return [
    { x: px, y: py },
    { x, y: py },
    { x, y },
  ];
}

function oceaniaDropRoute(parent, node) {
  const x = snap(node.renderPosition.x);
  const y = snap(node.renderPosition.y);
  const px = snap(parent.renderPosition.x);
  const py = snap(parent.renderPosition.y);
  const trunkY = snap(yForDate("10,000 BC", py) - 6);
  return [
    { x: px, y: py },
    { x: px, y: trunkY },
    { x, y: trunkY },
    { x, y },
  ];
}

function topHorizontalRoute(parent, node) {
  const x = snap(node.renderPosition.x);
  const y = snap(node.renderPosition.y);
  const px = snap(parent.renderPosition.x);
  const py = snap(parent.renderPosition.y);
  return [
    { x: px, y: py },
    { x, y: py },
    { x, y },
  ];
}

function verticalThenHorizontalAtChildRoute(parent, node) {
  const x = snap(node.renderPosition.x);
  const y = snap(node.renderPosition.y);
  const px = snap(parent.renderPosition.x);
  const py = snap(parent.renderPosition.y);
  return [
    { x: px, y: py },
    { x: px, y },
    { x, y },
  ];
}

function arcticToSeidisRoute(parent, node) {
  const x = snap(node.renderPosition.x);
  const y = snap(node.renderPosition.y);
  const px = snap(parent.renderPosition.x);
  const py = snap(parent.renderPosition.y);
  return [
    { x: px, y: py },
    { x: px, y },
    { x, y },
  ];
}

function arcticForkRoute(parent, node) {
  const x = snap(node.renderPosition.x);
  const y = snap(node.renderPosition.y);
  const px = snap(parent.renderPosition.x);
  const py = snap(parent.renderPosition.y);
  return [
    { x: px, y: py },
    { x: px, y },
    { x, y },
  ];
}

function eastAsianFolkRoute(parent, node) {
  const x = snap(node.renderPosition.x);
  const y = snap(node.renderPosition.y);
  const px = snap(parent.renderPosition.x);
  const py = snap(parent.renderPosition.y);
  const branchY = snap(yForDate("3000 BC", y));
  return [
    { x: px, y: py },
    { x: px, y: branchY },
    { x, y: branchY },
    { x, y },
  ];
}

function eastAsianBranchRoute(parent, node) {
  const x = snap(node.renderPosition.x);
  const y = snap(node.renderPosition.y);
  const px = snap(parent.renderPosition.x);
  const py = snap(parent.renderPosition.y);
  const branchY = snap(yForDate("1000 BC", y));
  return [
    { x: px, y: py },
    { x: px, y: branchY },
    { x, y: branchY },
    { x, y },
  ];
}

function teotihuacanToSantoDaimeRoute(parent, node) {
  const x = snap(node.renderPosition.x);
  const y = snap(node.renderPosition.y);
  const px = snap(parent.renderPosition.x);
  const py = snap(parent.renderPosition.y);
  const branchY = snap(yForDate("1500 AD", py));
  return [
    { x: px, y: py },
    { x: px, y: branchY },
    { x, y: branchY },
    { x, y },
  ];
}

function buddhismChildRoute(parent, node) {
  const x = snap(node.renderPosition.x);
  const y = snap(node.renderPosition.y);
  const px = snap(parent.renderPosition.x);
  const py = snap(parent.renderPosition.y);
  const branchY = snap(py + 28);
  return [
    { x: px, y: py },
    { x: px, y: branchY },
    { x, y: branchY },
    { x, y },
  ];
}

function drawNodes(target) {
  for (const node of mapData.religions) {
    const x = snap(node.renderPosition.x);
    const y = snap(node.renderPosition.y);
    target.stroke(255);
    target.strokeWeight(STROKE_SIZE.nodeOuter);
    target.fill(colorFor(node));
    target.circle(x, y, NODE_SIZE.outer);
  }
}

function drawNodeLabels(onlyIds = null) {
  for (const node of mapData.religions) {
    if (onlyIds && !onlyIds.has(node.id)) continue;
    const circleRadius = NODE_SIZE.outer / 2;
    const pos = node.renderPosition;
    const nameOffset = node.nameOffset || node.labelOffset || {};
    const nameOffsetX = nameOffset.x || 0;
    const nameOffsetY = nameOffset.y || 0;
    const labelY = labelYForNode(node, nameOffsetY);
    const labelHeight = drawNameLabel(node.name, node.subtext, pos.x + nameOffsetX, labelY, colorFor(node));
    if (node.date) {
      const dateAnchor = dateAnchorForNode(node);
      drawDateLabel(node.date, dateAnchor.x, dateAnchor.y);
    }
  }
}

function drawNameLabel(label, subtext, x, y, color) {
  const labelLines = label.split("\n").filter(Boolean);
  const subtextLines = subtext ? String(subtext).split("\n").filter(Boolean) : labelLines.slice(1);
  const lines = [labelLines[0], ...subtextLines].filter(Boolean);
  textAlign(CENTER, TOP);
  textSize(TEXT_SIZE.religion);
  textStyle(BOLD);
  for (let i = 0; i < lines.length; i++) {
    drawOutlinedText(lines[i], x, y + i * 11, i === 0 ? color : 255, 3);
  }
  textStyle(NORMAL);
  return lines.length * 11;
}

function drawDateLabel(date, x, y) {
  textAlign(CENTER, TOP);
  textSize(TEXT_SIZE.religion);
  textStyle(BOLD);
  drawOutlinedText(date, x, y, 255, 3);
  textStyle(NORMAL);
}

function drawOutlinedText(content, x, y, fillColor, outlineWeight) {
  stroke(0);
  strokeWeight(outlineWeight);
  strokeJoin(ROUND);
  fill(fillColor);
  text(content, x, y);
  noStroke();
}

function fitInitialView() {
  view.scale = min(width / mapData.world.width, height / mapData.world.height) * 0.92;
  view.x = (width - mapData.world.width * view.scale) / 2;
  view.y = 0;
  targetView = { ...view };
}

function mousePressed() {
  dragging = true;
  lastPointer = createVector(mouseX, mouseY);
  pointerDown = createVector(mouseX, mouseY);
  dragDistance = 0;
  setHoveredNode(null);
}

function mouseDragged() {
  if (!dragging) return;
  const now = createVector(mouseX, mouseY);
  if (pointerDown) {
    dragDistance = max(dragDistance, dist(pointerDown.x, pointerDown.y, now.x, now.y));
  }
  view.x += now.x - lastPointer.x;
  view.y += now.y - lastPointer.y;
  targetView.x = view.x;
  targetView.y = view.y;
  lastPointer = now;
  redraw();
}

function mouseReleased() {
  const wasClick = pointerDown && dragDistance < 5;
  const node = wasClick ? nodeAtScreen(mouseX, mouseY) : null;
  dragging = false;
  pointerDown = null;
  dragDistance = 0;

  if (node) {
    selectReligionNode(node);
  } else if (wasClick && selectedNodeId) {
    closeReligionDetail();
  }
  updateHoveredNode(mouseX, mouseY);
}

function mouseMoved() {
  updateHoveredNode(mouseX, mouseY);
}

function mouseOut() {
  setHoveredNode(null);
}

function touchStarted() {
  dragging = true;
  lastPointer = createVector(mouseX, mouseY);
  pointerDown = createVector(mouseX, mouseY);
  dragDistance = 0;
  setHoveredNode(null);
  return false;
}

function touchMoved() {
  mouseDragged();
  return false;
}

function touchEnded() {
  const wasTap = pointerDown && dragDistance < 8;
  const node = wasTap ? nodeAtScreen(mouseX, mouseY) : null;
  dragging = false;
  pointerDown = null;
  dragDistance = 0;

  if (node) {
    selectReligionNode(node);
  } else if (wasTap && selectedNodeId) {
    closeReligionDetail();
  }
  updateHoveredNode(mouseX, mouseY);
  return false;
}

function updateHoveredNode(screenX, screenY) {
  if (dragging) return;
  const node = nodeAtScreen(screenX, screenY);
  setHoveredNode(node?.id || null);
}

function setHoveredNode(nodeId) {
  if (hoveredNodeId === nodeId) return;
  hoveredNodeId = nodeId;
  if (nodeId) hoverScales.set(nodeId, hoverScales.get(nodeId) || 0);
  loop();
}

function nodeAtScreen(screenX, screenY) {
  const worldX = (screenX - view.x) / view.scale;
  const worldY = (screenY - view.y) / view.scale;
  const tolerance = max(NODE_SIZE.outer / 2 + 7, 16 / view.scale);
  let closest = null;
  let closestDistance = Infinity;
  for (const node of mapData.religions) {
    const distance = dist(worldX, worldY, node.renderPosition.x, node.renderPosition.y);
    if (distance <= tolerance && distance < closestDistance) {
      closest = node;
      closestDistance = distance;
    }
  }
  return closest;
}

function mouseWheel(event) {
  const oldScale = targetView.scale;
  const factor = Math.exp(-event.delta * 0.0015);
  targetView.scale = constrain(targetView.scale * factor, 0.35, 2.5);
  const worldX = (mouseX - targetView.x) / oldScale;
  const worldY = (mouseY - targetView.y) / oldScale;
  targetView.x = mouseX - worldX * targetView.scale;
  targetView.y = mouseY - worldY * targetView.scale;
  loop();
  return false;
}

function windowResized() {
  resizeCanvasToMap();
  targetView = { ...view };
  redraw();
}
