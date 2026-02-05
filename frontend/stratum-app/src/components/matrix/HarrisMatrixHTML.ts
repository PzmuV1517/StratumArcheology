/**
 * Harris Matrix HTML Generator for Mobile WebView
 *
 * Generates a self-contained HTML document with the Harris Matrix visualization
 * that can be rendered in a WebView on iOS/Android.
 *
 * Key adaptations for mobile:
 * - Touch-friendly interactions
 * - Viewport scaling for mobile screens
 * - Communication with React Native via postMessage
 * - Data persistence through AsyncStorage (via RN bridge)
 */

interface HarrisMatrixHTMLOptions {
  projectId: string;
  canEdit: boolean;
  initialData: string | null;
}

export function getHarrisMatrixHTML(options: HarrisMatrixHTMLOptions): string {
  const { projectId, canEdit, initialData } = options;

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=2.0, user-scalable=yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <title>Harris Matrix</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js"></script>
    <style>
        :root {
            --primary-bg: #111111;
            --container-bg: #1A1A1A;
            --panel-bg: #222222;
            --header-color: #F5F5F5;
            --text-color: #EAEAEA;
            --border-color: #2A2A2A;
            --primary-accent: #FF2A2A;
            --primary-accent-hover: #CC2222;
            --danger-accent: #dc3545;
            --success-accent: #28a745;
            --warning-accent: #ffc107;
            --cancel-accent: #6c757d;
        }
        
        * {
            box-sizing: border-box;
            -webkit-tap-highlight-color: transparent;
        }
        
        html, body {
            margin: 0;
            padding: 0;
            height: 100%;
            width: 100%;
            overflow: hidden;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: var(--primary-bg);
            color: var(--text-color);
        }
        
        .container {
            display: flex;
            flex-direction: column;
            height: 100%;
            width: 100%;
        }
        
        .header {
            padding: 10px 15px;
            background: var(--container-bg);
            border-bottom: 1px solid var(--border-color);
            text-align: center;
        }
        
        .header h1 {
            margin: 0;
            font-size: 18px;
            color: var(--header-color);
        }
        
        .header p {
            margin: 5px 0 0 0;
            font-size: 12px;
            color: #6c757d;
        }
        
        .workspace {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        
        .visualization-panel {
            flex: 1;
            position: relative;
            overflow: hidden;
            background: var(--container-bg);
            touch-action: none;
        }
        
        #matrixSvg {
            display: block;
            width: 100%;
            height: 100%;
        }
        
        .bottom-toolbar {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            padding: 10px;
            background: var(--container-bg);
            border-top: 1px solid var(--border-color);
        }
        
        .toolbar-btn {
            flex: 1;
            min-width: 100px;
            padding: 10px;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            color: white;
            touch-action: manipulation;
        }
        
        .btn-primary { background: var(--primary-accent); }
        .btn-success { background: var(--success-accent); }
        .btn-danger { background: var(--danger-accent); }
        .btn-warning { background: var(--warning-accent); color: #333; }
        
        /* Context node styles */
        .context-node-group { cursor: pointer; }
        .context-node-group.dragging { opacity: 0.7; }
        .context-node {
            fill: var(--primary-accent);
            stroke: var(--primary-accent-hover);
            stroke-width: 2px;
            transition: fill 0.2s;
        }
        .context-node.grouped { fill: var(--warning-accent); stroke: #e0a800; }
        .context-node.phased { fill: var(--success-accent); stroke: #1e7e34; }
        .context-node.temporal-conflict { 
            fill: var(--danger-accent); 
            stroke: #c82333;
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
        }
        
        .context-label {
            font-size: 14px;
            font-weight: 600;
            text-anchor: middle;
            pointer-events: none;
            fill: white;
        }
        
        .relationship-path { fill: none; stroke-linejoin: round; stroke-linecap: round; }
        .relationship-path.stratigraphic { stroke: #495057; stroke-width: 2px; marker-end: url(#arrowhead); }
        .relationship-path.cuts { stroke: var(--danger-accent); stroke-width: 2.5px; stroke-dasharray: 6,4; marker-end: url(#arrowhead-cuts); }
        .relationship-path.contemporary { stroke: #495057; stroke-width: 1.5px; }
        .relationship-path.temporal-conflict { stroke: var(--danger-accent); stroke-width: 3px; animation: pulse 2s infinite; marker-end: url(#arrowhead-cuts); }
        .relationship-path.redundant { stroke: #adb5bd; stroke-width: 1.5px; stroke-dasharray: 2, 3; marker-end: url(#arrowhead-redundant); }
        
        .group-boundary {
            fill: rgba(255, 152, 0, 0.15);
            stroke: #ff9800;
            stroke-width: 2px;
            stroke-dasharray: 5,5;
            pointer-events: none;
        }
        
        .phase-boundary {
            fill: rgba(76, 175, 80, 0.15);
            stroke: #4caf50;
            stroke-width: 3px;
            stroke-dasharray: 10,5;
            pointer-events: none;
        }
        
        /* Modal styles */
        .modal-backdrop {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        }
        
        .modal-content {
            background: var(--panel-bg, #151a23);
            padding: 20px;
            border-radius: 12px;
            width: 90%;
            max-width: 400px;
            max-height: 80vh;
            overflow-y: auto;
            color: var(--text-color, #d3d8e4);
            border: 1px solid var(--border-color, #283041);
        }
        
        .modal-content h4 {
            margin: 0 0 15px 0;
            font-size: 18px;
            color: var(--header-color, #e6eaf2);
        }
        
        .modal-content input,
        .modal-content select,
        .modal-content textarea {
            width: 100%;
            padding: 12px;
            margin-bottom: 12px;
            border: 1px solid var(--border-color);
            border-radius: 8px;
            font-size: 16px;
            background: var(--container-bg, #141820);
            color: var(--text-color, #d3d8e4);
        }
        
        .modal-content label {
            display: block;
            margin-bottom: 5px;
            font-weight: 600;
            font-size: 14px;
            color: var(--text-color, #d3d8e4);
        }
        
        .modal-buttons {
            display: flex;
            gap: 10px;
            margin-top: 15px;
        }
        
        .modal-buttons button {
            flex: 1;
            padding: 12px;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 500;
            cursor: pointer;
            color: white;
        }
        
        .modal-buttons .confirm { background: var(--primary-accent); }
        .modal-buttons .cancel { background: var(--cancel-accent); }
        .modal-buttons .danger { background: var(--danger-accent); }
        
        .info-panel {
            position: absolute;
            bottom: 70px;
            left: 10px;
            right: 10px;
            background: var(--panel-bg, #151a23);
            border-radius: 12px;
            padding: 15px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            max-height: 200px;
            overflow-y: auto;
            display: none;
            color: var(--text-color, #d3d8e4);
            border: 1px solid var(--border-color, #283041);
        }
        
        .info-panel.visible { display: block; }
        
        .info-panel h3 {
            margin: 0 0 10px 0;
            font-size: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            color: var(--header-color, #e6eaf2);
        }
        
        .close-btn {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            padding: 0;
            line-height: 1;
            color: var(--text-color, #d3d8e4);
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            text-align: center;
        }
        
        .stat-item {
            padding: 10px;
            background: var(--container-bg, #141820);
            border-radius: 8px;
        }
        
        .stat-value {
            font-size: 24px;
            font-weight: bold;
            color: var(--primary-accent);
        }
        
        .stat-label {
            font-size: 12px;
            color: var(--muted-text, #9aa4b2);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Harris Matrix</h1>
            <p>Tap to create • Drag to connect • Pinch to zoom</p>
        </div>
        
        <div class="workspace">
            <div class="visualization-panel">
                <svg id="matrixSvg"></svg>
            </div>
            
            <div id="infoPanel" class="info-panel">
                <h3>
                    <span>Statistics</span>
                    <button class="close-btn" onclick="toggleInfoPanel()">×</button>
                </h3>
                <div class="stats-grid">
                    <div class="stat-item">
                        <div class="stat-value" id="contextCount">0</div>
                        <div class="stat-label">Contexts</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value" id="relCount">0</div>
                        <div class="stat-label">Relations</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value" id="conflictCount">0</div>
                        <div class="stat-label">Conflicts</div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="bottom-toolbar">
            <button class="toolbar-btn btn-primary" onclick="resetZoom()">Reset View</button>
            <button class="toolbar-btn btn-success" onclick="toggleInfoPanel()">Info</button>
            ${canEdit ? '<button class="toolbar-btn btn-warning" onclick="analyzeTemporalConflicts()">Analyze</button>' : ""}
            ${canEdit ? '<button class="toolbar-btn btn-danger" onclick="confirmClear()">Clear</button>' : ""}
        </div>
    </div>
    
    <!-- Context Creation Modal -->
    <div id="contextModal" class="modal-backdrop">
        <div class="modal-content">
            <h4>New Context</h4>
            <label>Context ID</label>
            <input type="text" id="newContextId" placeholder="e.g., 1001">
            <label>Type</label>
            <select id="contextType">
                <option value="layer">Layer</option>
                <option value="deposit">Deposit</option>
                <option value="cut">Cut</option>
                <option value="fill">Fill</option>
                <option value="structure">Structure</option>
            </select>
            <label>Description</label>
            <textarea id="contextDescription" rows="2" placeholder="Brief description"></textarea>
            <div class="modal-buttons">
                <button class="confirm" id="confirmContextBtn">Create</button>
                <button class="cancel" onclick="hideModals()">Cancel</button>
            </div>
        </div>
    </div>
    
    <!-- Relationship Modal -->
    <div id="relationshipModal" class="modal-backdrop">
        <div class="modal-content">
            <h4 id="relationshipModalTitle">Define Relationship</h4>
            <select id="relationshipType"></select>
            <div class="modal-buttons">
                <button class="confirm" id="confirmRelationshipBtn">Add</button>
                <button class="cancel" onclick="hideModals()">Cancel</button>
            </div>
        </div>
    </div>
    
    <!-- Edit Node Modal -->
    <div id="editNodeModal" class="modal-backdrop">
        <div class="modal-content">
            <h4 id="editNodeModalTitle">Edit Context</h4>
            <label>Context ID</label>
            <input type="text" id="editNodeIdInput">
            <label>Type</label>
            <select id="editContextType">
                <option value="layer">Layer</option>
                <option value="deposit">Deposit</option>
                <option value="cut">Cut</option>
                <option value="fill">Fill</option>
                <option value="structure">Structure</option>
            </select>
            <label>Description</label>
            <textarea id="editContextDescription" rows="2"></textarea>
            <div class="modal-buttons">
                <button class="confirm" id="saveNodeBtn">Save</button>
                <button class="cancel" onclick="hideModals()">Cancel</button>
            </div>
            ${canEdit ? '<button class="toolbar-btn btn-danger" id="deleteNodeBtn" style="margin-top: 10px; width: 100%;">Delete Context</button>' : ""}
        </div>
    </div>

    <script>
        // Configuration
        const CAN_EDIT = ${canEdit};
        const PROJECT_ID = "${projectId}";
        
        // Data Model
        let contexts = new Map();
        let relationships = [];
        let groups = new Map();
        let subGroups = new Map();
        let phases = new Map();
        let nodePositions = {};
        let temporalConflicts = [];
        
        // D3 Setup
        const svg = d3.select("#matrixSvg");
        const g = svg.append("g").attr("class", "main-group");
        const GRID_CELL_SIZE = 80;
        const GRID_COLOR = "#e9ecef";
        
        // Touch-friendly zoom
        const zoom = d3.zoom()
            .scaleExtent([0.2, 4])
            .on("zoom", (event) => g.attr("transform", event.transform));
        svg.call(zoom);
        
        // Data classes
        class ArchaeologicalContext {
            constructor(id, x = 0, y = 0) {
                this.id = id;
                this.x = x;
                this.y = y;
                this.fixed = false;
                this.type = 'layer';
                this.description = '';
                this.earliestDate = null;
                this.latestDate = null;
                this.dateType = '';
                this.groupId = null;
                this.subGroupId = null;
                this.phaseId = null;
            }
            hasDateRange() { return this.earliestDate !== null && this.latestDate !== null; }
        }
        
        // Initialize
        window.onload = () => {
            loadInitialData();
            drawGrid();
            updateUI();
            
            if (CAN_EDIT) {
                svg.on('click', handleCanvasClick);
            }
            
            // Notify React Native that WebView is ready
            sendToRN({ type: 'READY' });
        };
        
        // Communication with React Native
        function sendToRN(message) {
            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify(message));
            }
        }
        
        // Load data from React Native (called via injectedJavaScript)
        window.loadHarrisMatrixData = function(data) {
            try {
                if (typeof data === 'string') {
                    data = JSON.parse(data);
                }
                contexts = new Map(data.contexts.map(([id, obj]) => [id, Object.assign(new ArchaeologicalContext(id), obj)]));
                relationships = data.relationships || [];
                groups = new Map((data.groups || []).map(([id, obj]) => [id, { ...obj, contexts: new Set(obj.contexts), subGroups: new Set(obj.subGroups) }]));
                subGroups = new Map((data.subGroups || []).map(([id, obj]) => [id, { ...obj, contexts: new Set(obj.contexts) }]));
                phases = new Map(data.phases || []);
                updateUI();
            } catch (e) {
                sendToRN({ type: 'ERROR', payload: e.message });
            }
        };
        
        function loadInitialData() {
            const initialData = ${initialData ? `'${initialData.replace(/'/g, "\\'").replace(/\n/g, "")}'` : "null"};
            if (initialData) {
                try {
                    window.loadHarrisMatrixData(initialData);
                } catch (e) {
                    console.error('Failed to load initial data:', e);
                }
            }
        }
        
        function saveData() {
            const data = {
                contexts: Array.from(contexts.entries()),
                relationships,
                groups: Array.from(groups.entries()).map(([id, g]) => [id, { ...g, contexts: Array.from(g.contexts || []), subGroups: Array.from(g.subGroups || []) }]),
                subGroups: Array.from(subGroups.entries()).map(([id, sg]) => [id, { ...sg, contexts: Array.from(sg.contexts || []) }]),
                phases: Array.from(phases.entries()),
            };
            sendToRN({ type: 'SAVE_DATA', payload: data });
        }
        
        // UI Updates
        function updateUI() {
            document.getElementById('contextCount').textContent = contexts.size;
            document.getElementById('relCount').textContent = relationships.length;
            document.getElementById('conflictCount').textContent = temporalConflicts.length;
            applySugiyamaLayout();
            saveData();
        }
        
        function toggleInfoPanel() {
            const panel = document.getElementById('infoPanel');
            panel.classList.toggle('visible');
        }
        
        // Layout Algorithm (simplified Sugiyama)
        function applySugiyamaLayout() {
            if (contexts.size === 0) {
                g.selectAll(".context-node-group, .relationship-path, .group-boundary, .phase-boundary").remove();
                return;
            }
            
            const { levels, stratigraphicEdges, contemporaryLinks, hasCycle } = calculateInitialLevels();
            
            if (hasCycle) {
                sendToRN({ type: 'ALERT', payload: { title: 'Cycle Detected', message: 'A cycle was detected in the stratigraphic relationships. Please review and fix.' } });
                return;
            }
            
            const { dummyNodes, allEdges } = createDummyNodesAndEdges(stratigraphicEdges, levels);
            const allNodes = new Map([...contexts, ...dummyNodes]);
            const orderedLevels = reduceCrossings(levels, allNodes, allEdges);
            nodePositions = assignCoordinates(orderedLevels, levels, dummyNodes);
            drawMatrix(nodePositions, allEdges, contemporaryLinks);
        }
        
        function calculateInitialLevels() {
            const contextIds = Array.from(contexts.keys());
            if (contextIds.length === 0) return { levels: new Map(), stratigraphicEdges: [], contemporaryLinks: [], hasCycle: false };
            
            const adj = new Map(contextIds.map(id => [id, []]));
            const inDegree = new Map(contextIds.map(id => [id, 0]));
            const stratigraphicEdges = [];
            const contemporaryLinks = [];
            
            relationships.forEach((rel, index) => {
                let from, to;
                if (['above', 'seals', 'cuts', 'fill_of'].includes(rel.type)) { [from, to] = [rel.to, rel.from]; }
                else if (['below', 'sealed_by', 'cut_by', 'filled_by'].includes(rel.type)) { [from, to] = [rel.from, rel.to]; }
                else if (['contemporary_with', 'equivalent', 'same_as'].includes(rel.type)) { contemporaryLinks.push({ from: rel.from, to: rel.to }); }
                
                if (from && to && contexts.has(from) && contexts.has(to)) {
                    adj.get(from)?.push(to);
                    inDegree.set(to, (inDegree.get(to) || 0) + 1);
                    stratigraphicEdges.push({ from, to, isCut: ['cuts', 'cut_by'].includes(rel.type), originalIndex: index });
                }
            });
            
            const levels = new Map();
            const queue = contextIds.filter(id => inDegree.get(id) === 0);
            let processed = 0;
            
            for (let i = 0; i < queue.length; i++) {
                const u = queue[i];
                processed++;
                levels.set(u, levels.get(u) || 0);
                (adj.get(u) || []).forEach(v => {
                    levels.set(v, Math.max(levels.get(v) || 0, levels.get(u) + 1));
                    inDegree.set(v, inDegree.get(v) - 1);
                    if (inDegree.get(v) === 0) queue.push(v);
                });
            }
            
            const hasCycle = processed < contextIds.length;
            return { levels, stratigraphicEdges, contemporaryLinks, hasCycle };
        }
        
        function createDummyNodesAndEdges(edges, levels) {
            const dummyNodes = new Map();
            const allEdges = [];
            
            edges.forEach(edge => {
                const fromLevel = levels.get(edge.from);
                const toLevel = levels.get(edge.to);
                
                if (toLevel - fromLevel > 1) {
                    let lastNodeId = edge.from;
                    for (let i = fromLevel + 1; i < toLevel; i++) {
                        const dummyId = \`dummy_\${edge.from}_\${edge.to}_\${i}\`;
                        dummyNodes.set(dummyId, { id: dummyId });
                        levels.set(dummyId, i);
                        allEdges.push({ from: lastNodeId, to: dummyId, isCut: edge.isCut, originalIndex: edge.originalIndex });
                        lastNodeId = dummyId;
                    }
                    allEdges.push({ from: lastNodeId, to: edge.to, isCut: edge.isCut, originalIndex: edge.originalIndex });
                } else {
                    allEdges.push(edge);
                }
            });
            
            return { dummyNodes, allEdges };
        }
        
        function reduceCrossings(levels, allNodes, allEdges) {
            const layerMap = d3.group(Array.from(allNodes.keys()), id => levels.get(id));
            const sortedLayers = Array.from(layerMap.keys()).sort((a, b) => a - b);
            let orderedLevels = new Map(sortedLayers.map(l => [l, layerMap.get(l)]));
            
            const adj = new Map(Array.from(allNodes.keys()).map(id => [id, []]));
            const revAdj = new Map(Array.from(allNodes.keys()).map(id => [id, []]));
            allEdges.forEach(e => { adj.get(e.from)?.push(e.to); revAdj.get(e.to)?.push(e.from); });
            
            for (let iter = 0; iter < 5; iter++) {
                for (let i = 1; i < sortedLayers.length; i++) {
                    const layer = orderedLevels.get(sortedLayers[i]);
                    const prevLayer = orderedLevels.get(sortedLayers[i - 1]);
                    const posInPrevLayer = new Map(prevLayer.map((id, idx) => [id, idx]));
                    layer.sort((a, b) => (d3.mean(revAdj.get(a), n => posInPrevLayer.get(n)) ?? -1) - (d3.mean(revAdj.get(b), n => posInPrevLayer.get(n)) ?? -1));
                }
            }
            
            return orderedLevels;
        }
        
        function assignCoordinates(orderedLevels, levels, dummyNodes) {
            const positions = {};
            const ySpacing = 120;
            const xSpacing = 130;
            const bbox = svg.node().getBoundingClientRect();
            const width = bbox.width || 400;
            const maxLevel = d3.max(orderedLevels.keys()) || 0;
            
            orderedLevels.forEach((nodes, level) => {
                const levelWidth = (nodes.length - 1) * xSpacing;
                const startX = (width - levelWidth) / 2;
                const yPos = 80 + (maxLevel - level) * ySpacing;
                
                nodes.forEach((id, i) => {
                    const context = contexts.get(id);
                    if (context?.fixed) {
                        positions[id] = { x: context.x, y: context.y };
                    } else {
                        positions[id] = { x: startX + i * xSpacing, y: yPos };
                    }
                });
            });
            
            return positions;
        }
        
        // Drawing Functions
        function drawGrid() {
            g.select(".grid-group").remove();
            const gridSize = 3000;
            const gridGroup = g.insert("g", ":first-child").attr("class", "grid-group");
            
            gridGroup.selectAll("line.vertical")
                .data(d3.range(-gridSize, gridSize, GRID_CELL_SIZE))
                .enter().append("line")
                .attr("x1", d => d).attr("y1", -gridSize)
                .attr("x2", d => d).attr("y2", gridSize)
                .style("stroke", GRID_COLOR).style("stroke-width", 1);
                
            gridGroup.selectAll("line.horizontal")
                .data(d3.range(-gridSize, gridSize, GRID_CELL_SIZE))
                .enter().append("line")
                .attr("x1", -gridSize).attr("y1", d => d)
                .attr("x2", gridSize).attr("y2", d => d)
                .style("stroke", GRID_COLOR).style("stroke-width", 1);
        }
        
        function drawMatrix(positions, allEdges, contemporaryLinks) {
            g.selectAll(".context-node-group, .relationship-path, .group-boundary, .phase-boundary, defs").remove();
            
            const defs = g.append("defs");
            defs.append("marker").attr("id", "arrowhead").attr("viewBox", "-2 -5 10 10").attr("refX", 5).attr("refY", 0).attr("markerWidth", 5).attr("markerHeight", 5).attr("orient", "auto")
                .append("path").attr("d", "M0,-5L10,0L0,5").style("fill", "#495057");
            defs.append("marker").attr("id", "arrowhead-cuts").attr("viewBox", "-2 -5 10 10").attr("refX", 5).attr("refY", 0).attr("markerWidth", 5).attr("markerHeight", 5).attr("orient", "auto")
                .append("path").attr("d", "M0,-5L10,0L0,5").style("fill", "var(--danger-accent)");
            defs.append("marker").attr("id", "arrowhead-redundant").attr("viewBox", "-2 -5 10 10").attr("refX", 5).attr("refY", 0).attr("markerWidth", 4).attr("markerHeight", 4).attr("orient", "auto")
                .append("path").attr("d", "M0,-5L10,0L0,5").style("fill", "#adb5bd");
            
            const BOX_HALF_HEIGHT = 25;
            const BOX_HALF_WIDTH = 50;
            
            // Draw edges
            allEdges.forEach(edge => {
                const p1 = positions[edge.from];
                const p2 = positions[edge.to];
                if (!p1 || !p2) return;
                
                const startY = p1.y + (contexts.has(edge.from) ? BOX_HALF_HEIGHT : 0);
                const endY = p2.y - (contexts.has(edge.to) ? BOX_HALF_HEIGHT : 0);
                const midY = startY + (endY - startY) / 2;
                
                const pathClass = edge.isCut ? 'relationship-path cuts' : 'relationship-path stratigraphic';
                g.append("path")
                    .attr("class", pathClass)
                    .attr("d", \`M \${p1.x},\${startY} V \${midY} H \${p2.x} V \${endY}\`);
            });
            
            // Draw contemporary links
            contemporaryLinks.forEach(link => {
                const p1 = positions[link.from];
                const p2 = positions[link.to];
                if (!p1 || !p2) return;
                
                const x1 = p1.x < p2.x ? p1.x + BOX_HALF_WIDTH : p1.x - BOX_HALF_WIDTH;
                const x2 = p1.x < p2.x ? p2.x - BOX_HALF_WIDTH : p2.x + BOX_HALF_WIDTH;
                
                g.append("line").attr("class", "relationship-path contemporary")
                    .attr("x1", x1).attr("y1", p1.y - 2)
                    .attr("x2", x2).attr("y2", p2.y - 2);
                g.append("line").attr("class", "relationship-path contemporary")
                    .attr("x1", x1).attr("y1", p1.y + 2)
                    .attr("x2", x2).attr("y2", p2.y + 2);
            });
            
            // Draw nodes
            const nodeData = Array.from(contexts.keys()).filter(id => positions[id]);
            const nodeGroups = g.selectAll(".context-node-group")
                .data(nodeData, d => d)
                .join("g")
                .attr("class", "context-node-group")
                .attr("transform", d => \`translate(\${positions[d].x}, \${positions[d].y})\`);
            
            if (CAN_EDIT) {
                nodeGroups.call(d3.drag()
                    .on("start", dragstarted)
                    .on("drag", dragged)
                    .on("end", dragended));
            } else {
                nodeGroups.on("click", (event, d) => showEditNodeModal(d, true));
            }
            
            nodeGroups.append("rect")
                .attr("class", d => {
                    const ctx = contexts.get(d);
                    const hasConflict = temporalConflicts.some(c => c.context1 === d || c.context2 === d);
                    if (hasConflict) return "context-node temporal-conflict";
                    if (ctx?.phaseId) return "context-node phased";
                    if (ctx?.groupId) return "context-node grouped";
                    return "context-node";
                })
                .attr("x", -BOX_HALF_WIDTH)
                .attr("y", -BOX_HALF_HEIGHT)
                .attr("width", BOX_HALF_WIDTH * 2)
                .attr("height", BOX_HALF_HEIGHT * 2)
                .attr("rx", 10);
            
            nodeGroups.append("text")
                .attr("class", "context-label")
                .attr("dy", "0.35em")
                .text(d => d);
        }
        
        // Event Handlers
        let wasDragged = false;
        
        function handleCanvasClick(event) {
            if (!CAN_EDIT || event.defaultPrevented) return;
            const [x, y] = d3.pointer(event, g.node());
            const snappedX = Math.round(x / GRID_CELL_SIZE) * GRID_CELL_SIZE;
            const snappedY = Math.round(y / GRID_CELL_SIZE) * GRID_CELL_SIZE;
            showContextModal(snappedX, snappedY);
        }
        
        function dragstarted(event) {
            event.sourceEvent.stopPropagation();
            d3.select(this).raise().classed("dragging", true);
            wasDragged = false;
        }
        
        function dragged(event) {
            wasDragged = true;
            d3.select(this).attr("transform", \`translate(\${event.x}, \${event.y})\`);
        }
        
        function dragended(event, d) {
            d3.select(this).classed("dragging", false);
            
            if (wasDragged) {
                let targetId = null;
                for (const [id] of contexts.entries()) {
                    if (d === id) continue;
                    const pos = nodePositions[id];
                    if (pos && event.x > pos.x - 50 && event.x < pos.x + 50 && event.y > pos.y - 25 && event.y < pos.y + 25) {
                        targetId = id;
                        break;
                    }
                }
                
                if (targetId) {
                    showRelationshipModal(d, targetId);
                } else {
                    const context = contexts.get(d);
                    if (context) {
                        context.x = Math.round(event.x / GRID_CELL_SIZE) * GRID_CELL_SIZE;
                        context.y = Math.round(event.y / GRID_CELL_SIZE) * GRID_CELL_SIZE;
                        context.fixed = true;
                    }
                }
                updateUI();
            } else {
                showEditNodeModal(d, false);
            }
        }
        
        // Modal Functions
        function showContextModal(x, y) {
            if (!CAN_EDIT) return;
            const modal = document.getElementById("contextModal");
            modal.style.display = "flex";
            
            const input = document.getElementById("newContextId");
            input.value = suggestNextContextId();
            document.getElementById("contextDescription").value = '';
            
            document.getElementById("confirmContextBtn").onclick = () => {
                const id = document.getElementById("newContextId").value.trim().toUpperCase();
                if (!id || contexts.has(id)) {
                    sendToRN({ type: 'ALERT', payload: { message: \`Context "\${id}" is invalid or already exists.\` } });
                    return;
                }
                
                const context = new ArchaeologicalContext(id, x, y);
                context.fixed = true;
                context.type = document.getElementById("contextType").value;
                context.description = document.getElementById("contextDescription").value.trim();
                contexts.set(id, context);
                
                hideModals();
                updateUI();
            };
        }
        
        function showRelationshipModal(sourceId, targetId) {
            if (!CAN_EDIT) return;
            const modal = document.getElementById("relationshipModal");
            modal.style.display = "flex";
            
            document.getElementById("relationshipModalTitle").innerText = \`\${sourceId} → \${targetId}\`;
            const select = document.getElementById("relationshipType");
            select.innerHTML = \`
                <option value="above">\${sourceId} is ABOVE \${targetId}</option>
                <option value="below">\${sourceId} is BELOW \${targetId}</option>
                <option value="cuts">\${sourceId} CUTS \${targetId}</option>
                <option value="cut_by">\${sourceId} is CUT BY \${targetId}</option>
                <option value="fill_of">\${sourceId} is FILL OF \${targetId}</option>
                <option value="filled_by">\${sourceId} is FILLED BY \${targetId}</option>
                <option value="contemporary_with">Contemporary With</option>
            \`;
            
            document.getElementById("confirmRelationshipBtn").onclick = () => {
                const context1 = contexts.get(sourceId);
                const context2 = contexts.get(targetId);
                if (context1) context1.fixed = false;
                if (context2) context2.fixed = false;
                
                relationships.push({ from: sourceId, to: targetId, type: select.value });
                hideModals();
                updateUI();
            };
        }
        
        function showEditNodeModal(contextId, readOnly) {
            const modal = document.getElementById("editNodeModal");
            modal.style.display = "flex";
            
            const context = contexts.get(contextId);
            document.getElementById("editNodeModalTitle").innerText = readOnly ? \`View: \${contextId}\` : \`Edit: \${contextId}\`;
            document.getElementById("editNodeIdInput").value = contextId;
            document.getElementById("editNodeIdInput").disabled = readOnly;
            document.getElementById("editContextType").value = context.type;
            document.getElementById("editContextType").disabled = readOnly;
            document.getElementById("editContextDescription").value = context.description;
            document.getElementById("editContextDescription").disabled = readOnly;
            
            const saveBtn = document.getElementById("saveNodeBtn");
            const deleteBtn = document.getElementById("deleteNodeBtn");
            
            if (readOnly) {
                saveBtn.style.display = 'none';
                if (deleteBtn) deleteBtn.style.display = 'none';
            } else {
                saveBtn.style.display = 'block';
                if (deleteBtn) deleteBtn.style.display = 'block';
                
                saveBtn.onclick = () => saveNodeChanges(contextId);
                if (deleteBtn) deleteBtn.onclick = () => deleteContext(contextId);
            }
        }
        
        function saveNodeChanges(oldId) {
            const newId = document.getElementById('editNodeIdInput').value.trim().toUpperCase();
            if (!newId || (newId !== oldId && contexts.has(newId))) {
                sendToRN({ type: 'ALERT', payload: { message: 'Context ID is invalid or already exists.' } });
                return;
            }
            
            const context = contexts.get(oldId);
            context.type = document.getElementById('editContextType').value;
            context.description = document.getElementById('editContextDescription').value.trim();
            
            if (newId !== oldId) {
                context.id = newId;
                contexts.set(newId, context);
                contexts.delete(oldId);
                relationships.forEach(rel => {
                    if (rel.from === oldId) rel.from = newId;
                    if (rel.to === oldId) rel.to = newId;
                });
            }
            
            hideModals();
            updateUI();
        }
        
        function deleteContext(contextId) {
            if (!CAN_EDIT) return;
            
            contexts.delete(contextId);
            relationships = relationships.filter(rel => rel.from !== contextId && rel.to !== contextId);
            temporalConflicts = temporalConflicts.filter(c => c.context1 !== contextId && c.context2 !== contextId);
            
            hideModals();
            updateUI();
        }
        
        function hideModals() {
            document.querySelectorAll('.modal-backdrop').forEach(m => m.style.display = 'none');
        }
        
        // Utility Functions
        function suggestNextContextId() {
            if (contexts.size === 0) return "1001";
            const numbers = Array.from(contexts.keys())
                .map(id => parseInt(id.match(/\\d+$/)?.[0]))
                .filter(n => !isNaN(n));
            return numbers.length > 0 ? (Math.max(...numbers) + 1).toString() : (1000 + contexts.size + 1).toString();
        }
        
        function resetZoom() {
            svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
        }
        
        function confirmClear() {
            if (!CAN_EDIT) return;
            // Send confirmation request to native - it will call executeClear() if confirmed
            sendToRN({ type: 'CONFIRM_CLEAR' });
        }
        
        // Called from native after user confirms clear
        window.executeClear = function() {
            if (!CAN_EDIT) return;
            contexts = new Map();
            relationships = [];
            groups = new Map();
            subGroups = new Map();
            phases = new Map();
            temporalConflicts = [];
            updateUI();
            // Save the cleared state to trigger version history
            sendToRN({ type: 'SAVE_DATA', payload: exportData() });
        };
        
        function analyzeTemporalConflicts() {
            temporalConflicts = [];
            relationships.forEach(rel => {
                const ctx1 = contexts.get(rel.from);
                const ctx2 = contexts.get(rel.to);
                if (!ctx1?.hasDateRange() || !ctx2?.hasDateRange()) return;
                
                let earlierCtx, laterCtx;
                if (['above', 'seals', 'cuts', 'filled_by'].includes(rel.type)) {
                    [earlierCtx, laterCtx] = [ctx2, ctx1];
                } else if (['below', 'sealed_by', 'cut_by', 'fill_of'].includes(rel.type)) {
                    [earlierCtx, laterCtx] = [ctx1, ctx2];
                } else {
                    return;
                }
                
                if (earlierCtx.earliestDate > laterCtx.latestDate) {
                    temporalConflicts.push({
                        context1: earlierCtx.id,
                        context2: laterCtx.id,
                        description: \`\${earlierCtx.id} dated after \${laterCtx.id}\`
                    });
                }
            });
            
            updateUI();
            sendToRN({ type: 'ALERT', payload: { title: 'Analysis Complete', message: \`Found \${temporalConflicts.length} temporal conflicts.\` } });
        }
    </script>
</body>
</html>`;
}
