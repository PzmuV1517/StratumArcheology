import React, { useEffect, useRef, useState } from 'react';
import './HarrisMatrix.css';

interface HarrisMatrixProps { projectId: string }

export const HarrisMatrix: React.FC<HarrisMatrixProps> = ({ projectId }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<'hierarchy' | 'conflicts' | 'relationships'>('hierarchy');

  // Expose imperative handlers to JSX via ref
  const apiRef = useRef<any>({});

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    (async () => {
      const d3: any = await import('d3');
      if (!svgRef.current) return;

      // Data Model
      let contexts: Map<string, any> = new Map();
      let relationships: Array<any> = [];
      let groups: Map<string, any> = new Map();
      let subGroups: Map<string, any> = new Map();
      let phases: Map<string, any> = new Map();
      let nodePositions: Record<string, { x: number; y: number }> = {};
      let temporalConflicts: Array<any> = [];

      // Persistence
      const storageKey = `harrisMatrixData:${projectId}`;
      function saveToStorage() {
        const data = {
          contexts: Array.from(contexts.entries()),
          relationships,
          groups: Array.from(groups.entries()).map(([id, obj]: any) => [id, { ...obj, contexts: Array.from(obj.contexts || []), subGroups: Array.from(obj.subGroups || []) }]),
          subGroups: Array.from(subGroups.entries()).map(([id, obj]: any) => [id, { ...obj, contexts: Array.from(obj.contexts || []) }]),
          phases: Array.from(phases.entries()),
        };
        try { localStorage.setItem(storageKey, JSON.stringify(data)); } catch {}
      }
      function loadFromStorage() {
        try {
          const raw = localStorage.getItem(storageKey);
          if (!raw) return;
          const data = JSON.parse(raw);
          contexts = new Map((data.contexts || []).map(([id, obj]: [string, any]) => [id, { ...obj }]));
          relationships = data.relationships || [];
          groups = new Map((data.groups || []).map(([id, obj]: [string, any]) => [id, { ...obj, contexts: new Set(obj.contexts || []), subGroups: new Set(obj.subGroups || []) }]));
          subGroups = new Map((data.subGroups || []).map(([id, obj]: [string, any]) => [id, { ...obj, contexts: new Set(obj.contexts || []) }]));
          phases = new Map((data.phases || []));
        } catch {}
      }
      loadFromStorage();

      // D3 Setup
      const svg = d3.select(svgRef.current);
      let g = svg.select('g.main-group');
      if (g.empty()) g = svg.append('g').attr('class', 'main-group');
      const GRID_CELL_SIZE = 60;
      const GRID_COLOR = '#e9ecef';
      const zoom = d3.zoom().scaleExtent([0.1, 5]).on('zoom', (event: any) => g.attr('transform', event.transform));
      svg.call(zoom as any);

      function drawGrid() {
        g.select('.grid-group').remove();
        const gridSize = 4000;
        const gridGroup = g.insert('g', ':first-child').attr('class', 'grid-group');
        gridGroup.selectAll('line.vertical').data(d3.range(-gridSize, gridSize, GRID_CELL_SIZE)).enter().append('line')
          .attr('class', 'vertical').attr('x1', (d: number) => d).attr('y1', -gridSize).attr('x2', (d: number) => d).attr('y2', gridSize)
          .style('stroke', GRID_COLOR).style('stroke-width', 1);
        gridGroup.selectAll('line.horizontal').data(d3.range(-gridSize, gridSize, GRID_CELL_SIZE)).enter().append('line')
          .attr('class', 'horizontal').attr('x1', -gridSize).attr('y1', (d: number) => d).attr('x2', gridSize).attr('y2', (d: number) => d)
          .style('stroke', GRID_COLOR).style('stroke-width', 1);
      }
      drawGrid();

      // Layout helpers (subset from HTML)
      function findRedundantRelationships() {
        const redundantIndices = new Set<number>();
        const edges = (relationships || []).filter((rel: any) => ['above', 'seals', 'cuts', 'fill_of', 'below', 'sealed_by', 'cut_by', 'filled_by'].includes(rel.type))
          .map((rel: any, idx: number) => {
            let from = rel.from, to = rel.to;
            if (['above', 'seals', 'cuts', 'fill_of'].includes(rel.type)) { from = rel.to; to = rel.from; }
            return { from, to, originalIndex: idx };
          });
        const adj: Map<string, string[]> = new Map();
        edges.forEach((e) => { if (!adj.has(e.from)) adj.set(e.from, []); adj.get(e.from)!.push(e.to); });
        const hasPath = (start: string, end: string, ignored?: any) => {
          const stack = [start]; const visited = new Set([start]);
          while (stack.length) {
            const u = stack.pop()!;
            for (const v of (adj.get(u) || [])) {
              if (ignored && u === ignored.from && v === ignored.to) continue;
              if (v === end) return true;
              if (!visited.has(v)) { visited.add(v); stack.push(v); }
            }
          }
          return false;
        };
        edges.forEach((edge) => { if (hasPath(edge.from, edge.to, edge)) redundantIndices.add(edge.originalIndex); });
        return redundantIndices;
      }

      function drawGroupBoundaries(positions: Record<string, any>) {
        const drawRectBoundary = (contextIds: string[], className: string) => {
          const validPositions = contextIds.map((id) => positions[id]).filter(Boolean);
          if (validPositions.length < 1) return;
          const padX = 60; const padY = 40;
          const minX = d3.min(validPositions, (p: any) => p.x) - padX;
          const maxX = d3.max(validPositions, (p: any) => p.x) + padX;
          const minY = d3.min(validPositions, (p: any) => p.y) - padY;
          const maxY = d3.max(validPositions, (p: any) => p.y) + padY;
          g.insert('rect', ':first-child').attr('class', className).attr('x', minX).attr('y', minY)
            .attr('width', maxX - minX).attr('height', maxY - minY).attr('rx', 15);
        };
        phases.forEach((phase: any) => {
          const ids = Array.from(contexts.values()).filter((c: any) => c.phaseId === phase.id).map((c: any) => c.id);
          drawRectBoundary(ids, 'phase-boundary');
        });
        groups.forEach((group: any) => drawRectBoundary(Array.from(group.contexts || []), 'group-boundary'));
        subGroups.forEach((sg: any) => drawRectBoundary(Array.from(sg.contexts || []), 'subgroup-boundary'));
      }

      function drawMatrix(positions: Record<string, any>, allEdges: any[], contemporaryLinks: any[]) {
        g.selectAll('.context-node-group, .relationship-path, .group-boundary, .subgroup-boundary, .phase-boundary, defs').remove();
        const defs = g.append('defs');
        defs.append('marker').attr('id', 'arrowhead').attr('viewBox', '-2 -5 10 10').attr('refX', 5).attr('refY', 0).attr('markerWidth', 5).attr('markerHeight', 5).attr('orient', 'auto')
          .append('path').attr('d', 'M0,-5L10,0L0,5').style('fill', '#495057');
        defs.append('marker').attr('id', 'arrowhead-cuts').attr('viewBox', '-2 -5 10 10').attr('refX', 5).attr('refY', 0).attr('markerWidth', 5).attr('markerHeight', 5).attr('orient', 'auto')
          .append('path').attr('d', 'M0,-5L10,0L0,5').style('fill', 'var(--danger-accent)');
        defs.append('marker').attr('id', 'arrowhead-redundant').attr('viewBox', '-2 -5 10 10').attr('refX', 5).attr('refY', 0).attr('markerWidth', 4).attr('markerHeight', 4).attr('orient', 'auto')
          .append('path').attr('d', 'M0,-5L10,0L0,5').style('fill', '#adb5bd');

        drawGroupBoundaries(positions);
        const redundantRelationIndices = findRedundantRelationships();

        const getEdgeClasses = (edge: any) => {
          const isRedundant = redundantRelationIndices.has(edge.originalIndex);
          if (isRedundant) return 'relationship-path redundant';
          const originalRel = relationships[edge.originalIndex];
          if (!originalRel) return 'relationship-path stratigraphic';
          const hasConflict = temporalConflicts.some((c: any) => (c.context1 === originalRel.from && c.context2 === originalRel.to) || (c.context1 === originalRel.to && c.context2 === originalRel.from));
          if (hasConflict) return 'relationship-path temporal-conflict';
          const isCut = ['cuts', 'cut_by'].includes(originalRel.type);
          return `relationship-path ${isCut ? 'cuts' : 'stratigraphic'}`;
        };

        const BOX_HALF_HEIGHT = 22.5, BOX_HALF_WIDTH = 45;
        // Draw stratigraphic relationships
        allEdges.forEach((edge: any) => {
          const p1 = positions[edge.from];
          const p2 = positions[edge.to];
          if (!p1 || !p2) return;
          const startY = p1.y + (contexts.has(edge.from) ? BOX_HALF_HEIGHT : 0);
          const endY = p2.y - (contexts.has(edge.to) ? BOX_HALF_HEIGHT : 0);
          const midY = startY + (endY - startY) / 2;
          const pathData = `M ${p1.x},${startY} V ${midY} H ${p2.x} V ${endY}`;
          g.append('path').attr('class', getEdgeClasses(edge)).attr('d', pathData);
        });

        // Contemporary links (double bars)
        contemporaryLinks.forEach((link: any) => {
          const p1 = positions[link.from];
          const p2 = positions[link.to];
          if (!p1 || !p2) return;
          const yOffset = 2.5;
          const x1 = p1.x < p2.x ? p1.x + BOX_HALF_WIDTH : p1.x - BOX_HALF_WIDTH;
          const x2 = p1.x < p2.x ? p2.x - BOX_HALF_WIDTH : p2.x + BOX_HALF_WIDTH;
          g.append('line').attr('class', 'relationship-path contemporary').attr('x1', x1).attr('y1', p1.y - yOffset).attr('x2', x2).attr('y2', p2.y - yOffset);
          g.append('line').attr('class', 'relationship-path contemporary').attr('x1', x1).attr('y1', p1.y + yOffset).attr('x2', x2).attr('y2', p2.y + yOffset);
        });

        // Nodes
        const nodeData = Array.from(contexts.keys()).filter((id) => positions[id]);
        const nodeGroups = g.selectAll('.context-node-group')
          .data(nodeData, (d: any) => d)
          .join('g')
          .attr('class', 'context-node-group')
          .attr('transform', (d: any) => `translate(${positions[d].x}, ${positions[d].y})`)
          .call(d3.drag().on('start', dragstarted).on('drag', dragged).on('end', dragended));
        nodeGroups.append('rect')
          .attr('class', (d: any) => 'context-node ' + (temporalConflicts.some((c: any) => c.context1 === d || c.context2 === d) ? 'temporal-conflict' : (contexts.get(d)?.phaseId ? 'phased' : (contexts.get(d)?.groupId ? 'grouped' : ''))))
          .attr('x', -BOX_HALF_WIDTH)
          .attr('y', -BOX_HALF_HEIGHT)
          .attr('width', BOX_HALF_WIDTH * 2)
          .attr('height', BOX_HALF_HEIGHT * 2)
          .attr('rx', 8);
        nodeGroups.append('text').attr('class', 'context-label').attr('dy', '0.35em').text((d: any) => d);
      }

      // Layout core (matching original HTML implementation)
      // Only create equivalence mappings for groups with >1 member (to mirror original behavior)
      function findEquivalenceGroups() {
        const adj: Map<string, string[]> = new Map(Array.from(contexts.keys()).map((id) => [id, []]));
        (relationships || []).forEach((rel: any) => {
          if (['contemporary_with', 'equivalent', 'same_as'].includes(rel.type)) {
            if (!adj.get(rel.from)!.includes(rel.to)) adj.get(rel.from)!.push(rel.to);
            if (!adj.get(rel.to)!.includes(rel.from)) adj.get(rel.to)!.push(rel.from);
          }
        });
        const visited = new Set<string>();
        const contextToGroupRep = new Map<string, string>();
        const groupRepToMembers = new Map<string, Set<string>>();
        for (const contextId of contexts.keys()) {
          if (!visited.has(contextId)) {
            const queue: string[] = [contextId];
            visited.add(contextId);
            const groupMembers = new Set<string>();
            while (queue.length) {
              const u = queue.shift()!;
              groupMembers.add(u);
              (adj.get(u) || []).forEach((v) => {
                if (!visited.has(v)) { visited.add(v); queue.push(v); }
              });
            }
            if (groupMembers.size > 1) {
              const representative = contextId; // choose first encountered as rep
              groupRepToMembers.set(representative, groupMembers);
              groupMembers.forEach((memberId) => contextToGroupRep.set(memberId, representative));
            }
          }
        }
        return { contextToGroupRep, groupRepToMembers };
      }

      function calculateInitialLevels() {
        const contextIds = Array.from(contexts.keys());
        if (contextIds.length === 0) return { levels: new Map(), stratigraphicEdges: [], contemporaryLinks: [], hasCycle: false } as any;
        const { contextToGroupRep } = findEquivalenceGroups();
        const logicalNodes = new Set(contextIds.map((id) => contextToGroupRep.get(id) || id));
        const adj: Map<string, string[]> = new Map(Array.from(logicalNodes).map((id) => [id, []]));
        const inDegree: Map<string, number> = new Map(Array.from(logicalNodes).map((id) => [id, 0]));
        const stratigraphicEdges: any[] = [];
        const contemporaryLinks: any[] = [];
        (relationships || []).forEach((rel: any, index: number) => {
          let from: string | undefined, to: string | undefined;
          if (['above', 'seals', 'cuts', 'fill_of'].includes(rel.type)) { from = rel.to; to = rel.from; }
          else if (['below', 'sealed_by', 'cut_by', 'filled_by'].includes(rel.type)) { from = rel.from; to = rel.to; }
          else if (['contemporary_with', 'equivalent', 'same_as'].includes(rel.type)) { contemporaryLinks.push({ from: rel.from, to: rel.to }); }
          if (from && to && contexts.has(from) && contexts.has(to)) {
            const repFrom = contextToGroupRep.get(from) || from;
            const repTo = contextToGroupRep.get(to) || to;
            if (repFrom !== repTo) {
              if (!adj.get(repFrom)!.includes(repTo)) adj.get(repFrom)!.push(repTo);
              inDegree.set(repTo, (inDegree.get(repTo) || 0) + 1);
            }
            // Always record stratigraphic edge (even if reps equal) like original HTML
            stratigraphicEdges.push({ from, to, isCut: ['cuts', 'cut_by'].includes(rel.type), originalIndex: index });
          }
        });
        const levels: Map<string, number> = new Map();
        const queue = Array.from(logicalNodes).filter((id) => (inDegree.get(id) || 0) === 0);
        const processed: string[] = [];
        for (let i = 0; i < queue.length; i++) {
          const u_rep = queue[i];
          processed.push(u_rep);
          levels.set(u_rep, levels.get(u_rep) || 0);
          (adj.get(u_rep) || []).forEach((v_rep) => {
            levels.set(v_rep, Math.max(levels.get(v_rep) || 0, (levels.get(u_rep) || 0) + 1));
            inDegree.set(v_rep, (inDegree.get(v_rep) || 0) - 1);
            if ((inDegree.get(v_rep) || 0) === 0) queue.push(v_rep);
          });
        }
        const hasCycle = processed.length < logicalNodes.size;
        const finalLevels = new Map<string, number>();
        if (!hasCycle) {
          contextIds.forEach((id) => {
            const rep = contextToGroupRep.get(id) || id;
            finalLevels.set(id, levels.get(rep) || 0);
          });
        }
        return { levels: finalLevels, stratigraphicEdges, contemporaryLinks, hasCycle };
      }

      function createDummyNodesAndEdges(edges: any[], levels: Map<string, number>) {
        const dummyNodes = new Map<string, any>();
        const allEdges: any[] = [];
        edges.forEach((edge) => {
          const fromLevel = levels.get(edge.from)!;
          const toLevel = levels.get(edge.to)!;
            if (toLevel - fromLevel > 1) {
              let lastNodeId = edge.from;
              for (let i = fromLevel + 1; i < toLevel; i++) {
                const dummyId = `dummy_${edge.from}_${edge.to}_${i}`;
                dummyNodes.set(dummyId, { id: dummyId, originalSource: edge.from, originalTarget: edge.to });
                levels.set(dummyId, i); // ensure dummy node participates in layering
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

      function reduceCrossings(levels: Map<string, number>, allNodes: Map<string, any>, allEdges: any[]) {
        const layerMap: Map<number, string[]> = d3.group(Array.from(allNodes.keys()), (id: string) => levels.get(id) as number) as any;
        const sortedLayers = Array.from(layerMap.keys()).sort((a, b) => a - b);
        let orderedLevels: Map<number, string[]> = new Map(sortedLayers.map((l) => [l, layerMap.get(l)!]));
        const adj: Map<string, string[]> = new Map(Array.from(allNodes.keys()).map((id) => [id, []]));
        const revAdj: Map<string, string[]> = new Map(Array.from(allNodes.keys()).map((id) => [id, []]));
        allEdges.forEach((e) => { adj.get(e.from)!.push(e.to); revAdj.get(e.to)!.push(e.from); });
        for (let iter = 0; iter < 10; iter++) {
          // Downward pass (use predecessors for ordering)
          for (let i = 1; i < sortedLayers.length; i++) {
            const layer = orderedLevels.get(sortedLayers[i])!;
            const prevLayer = orderedLevels.get(sortedLayers[i - 1])!;
            const posInPrev = new Map(prevLayer.map((id, idx) => [id, idx] as [string, number]));
            layer.sort((a, b) => (d3.mean(revAdj.get(a) || [], (n: string) => posInPrev.get(n)) ?? -1) - (d3.mean(revAdj.get(b) || [], (n: string) => posInPrev.get(n)) ?? -1));
          }
          // Upward pass (use successors for ordering)
            for (let i = sortedLayers.length - 2; i >= 0; i--) {
              const layer = orderedLevels.get(sortedLayers[i])!;
              const nextLayer = orderedLevels.get(sortedLayers[i + 1])!;
              const posInNext = new Map(nextLayer.map((id, idx) => [id, idx] as [string, number]));
              layer.sort((a, b) => (d3.mean(adj.get(a) || [], (n: string) => posInNext.get(n)) ?? -1) - (d3.mean(adj.get(b) || [], (n: string) => posInNext.get(n)) ?? -1));
            }
        }
        return orderedLevels;
      }

      function assignCoordinates(orderedLevels: Map<number, string[]>, levels: Map<string, number>, dummyNodes: Map<string, any>) {
        const positions: Record<string, { x: number; y: number }> = {};
        const ySpacing = 120, xSpacing = 150;
        const width = (svg.node() as any).getBoundingClientRect().width;
        const maxLevel = Math.max(0, ...Array.from(orderedLevels.keys()));
        const fixedNodeIds = new Set<string>();
        // Preserve fixed node positions
        contexts.forEach((context: any) => { if (context.fixed) { positions[context.id] = { x: context.x, y: context.y }; fixedNodeIds.add(context.id); }});
        // Interpolate dummy nodes between two fixed endpoints (HTML behavior)
        orderedLevels.forEach((nodes: string[], level: number) => {
          nodes.forEach((id) => {
            const dummyInfo = dummyNodes.get(id);
            if (dummyInfo && fixedNodeIds.has(dummyInfo.originalSource) && fixedNodeIds.has(dummyInfo.originalTarget)) {
              const sourcePos = positions[dummyInfo.originalSource];
              const targetPos = positions[dummyInfo.originalTarget];
              const sourceLevel = levels.get(dummyInfo.originalSource)!;
              const targetLevel = levels.get(dummyInfo.originalTarget)!;
              if (targetLevel > sourceLevel) {
                const progress = (level - sourceLevel) / (targetLevel - sourceLevel);
                positions[id] = {
                  x: sourcePos.x + (targetPos.x - sourcePos.x) * progress,
                  y: sourcePos.y + (targetPos.y - sourcePos.y) * progress,
                };
              }
            }
          });
        });
        // Place remaining (floating) nodes centered per layer
        const floatingLevels = new Map<number, string[]>();
        orderedLevels.forEach((nodes: string[], level: number) => {
          const floatingNodes = nodes.filter((id) => !positions[id]);
          if (floatingNodes.length > 0) floatingLevels.set(level, floatingNodes);
        });
        floatingLevels.forEach((nodes, level) => {
          const levelWidth = (nodes.length - 1) * xSpacing;
          const startX = (width - levelWidth) / 2;
          const yPos = 50 + (maxLevel - level) * ySpacing;
          nodes.forEach((id, i) => { positions[id] = { x: startX + i * xSpacing, y: yPos }; });
        });
        return positions;
      }

      function applyLayoutAndDraw() {
        if (contexts.size === 0) {
          g.selectAll('.context-node-group, .relationship-path, .group-boundary, .subgroup-boundary, .phase-boundary').remove();
          return;
        }
        const { levels, stratigraphicEdges, contemporaryLinks, hasCycle } = calculateInitialLevels();
        if (hasCycle) {
          const cyclicNodeIds = Array.from(contexts.keys()).filter((id) => !levels.has(id));
          alert(`ERROR: A cycle was detected in the stratigraphic relationships.\n\nPlease review: ${cyclicNodeIds.join(', ')}`);
          return;
        }
        const { dummyNodes, allEdges } = createDummyNodesAndEdges(stratigraphicEdges, levels);
        const allNodes = new Map<string, any>([...contexts, ...dummyNodes]);
        const orderedLevels = reduceCrossings(levels, allNodes, allEdges);
        nodePositions = assignCoordinates(orderedLevels, levels, dummyNodes);
        drawMatrix(nodePositions, allEdges, contemporaryLinks);
      }

      // UI helpers
      function updateHierarchyDisplay() {
        const listDiv = document.getElementById('hierarchyList');
        if (!listDiv) return;
        let html = '';
        if (phases.size > 0) {
          html += '<div style="font-weight: bold; margin: 10px 0;">Phases</div>';
          phases.forEach((phase: any) => {
            const phaseContextIds = Array.from(contexts.values()).filter((c: any) => c.phaseId === phase.id).map((c: any) => c.id);
            const hasConflicts = false;
            html += `<div class="hierarchy-item phase ${hasConflicts ? 'temporal-conflict' : ''}" onclick="window.__hm_highlightPhase && window.__hm_highlightPhase('${phase.id}')"><div class="item-header">Phase: ${phase.name}${hasConflicts ? '<span class="conflict-indicator"></span>' : '<span class="valid-indicator"></span>'}</div><div class="item-details">${phase.description || ''}</div><div class="item-contexts">${phaseContextIds.length} contexts</div></div>`;
          });
        }
        if (groups.size > 0) {
          html += '<div style="font-weight: bold; margin: 10px 0;">Groups</div>';
          groups.forEach((group: any) => {
            html += `<div class="hierarchy-item group" onclick="window.__hm_highlightGroup && window.__hm_highlightGroup('${group.id}')"><div class="item-header">Group: ${group.name}</div><div class="item-details">${group.description || ''}</div><div class="item-contexts">${(group.contexts && group.contexts.size) || 0} contexts</div></div>`;
          });
        }
        const unassigned = Array.from(contexts.values()).filter((c: any) => !c.groupId && !c.phaseId);
        if (unassigned.length > 0) {
          html += '<div style="font-weight: bold; margin: 10px 0;">Unassigned Contexts</div>';
          unassigned.forEach((context: any) => {
            const hasConflicts = temporalConflicts.some((c: any) => c.context1 === context.id || c.context2 === context.id);
            html += `<div class="hierarchy-item ${hasConflicts ? 'temporal-conflict' : ''}" onclick="window.__hm_highlightContext && window.__hm_highlightContext('${context.id}')"><div class="item-header">${context.id} (${context.type || 'layer'})${hasConflicts ? '<span class="conflict-indicator"></span>' : ''}</div><div class="item-details">${context.description || ''}</div></div>`;
          });
        }
        listDiv.innerHTML = html || '<em>No data yet. Click in the canvas to add contexts.</em>';
      }

      function updateConflictsDisplay() {
        const listDiv = document.getElementById('conflictsList');
        if (!listDiv) return;
        if (temporalConflicts.length === 0) { listDiv.innerHTML = '<em>No conflicts detected.</em>'; return; }
        let html = '';
        temporalConflicts.forEach((conflict: any, index: number) => {
          const ctx1 = contexts.get(conflict.context1);
          const ctx2 = contexts.get(conflict.context2);
          html += `<div class="hierarchy-item temporal-conflict"><div class="item-header">Conflict ${index + 1}</div><div class="item-details" style="font-weight: 500;">${conflict.description}</div><div class="item-contexts">${ctx1?.id} vs ${ctx2?.id}</div></div>`;
        });
        listDiv.innerHTML = html;
      }

      function updateRelationshipsDisplay() {
        const listDiv = document.getElementById('relationshipsList');
        if (!listDiv) return;
        if ((relationships || []).length === 0) { listDiv.innerHTML = '<em>No relationships defined.</em>'; return; }
        const redundantIndices = findRedundantRelationships();
        let tableHTML = `<table style="width:100%; border-collapse: collapse; font-size: 12px;"><thead><tr><th>From</th><th>Relationship</th><th>To</th><th>Status</th><th></th></tr></thead><tbody>`;
        relationships.forEach((rel: any, index: number) => {
          const conflict = temporalConflicts.find((c: any) => (c.context1 === rel.from && c.context2 === rel.to) || (c.context1 === rel.to && c.context2 === rel.from));
          const isRedundant = redundantIndices.has(index);
          const status = conflict ? '⚠️ Conflict' : (isRedundant ? 'ℹ️ Redundant' : '✅ Valid');
          const style = conflict ? 'background: #ffebee;' : (isRedundant ? 'background: #f8f9fa; color: #6c757d;' : '');
          tableHTML += `<tr style="${style}"><td style="border: 1px solid #ddd; padding: 4px;">${rel.from}</td><td style="border: 1px solid #ddd; padding: 4px;">${rel.type.replace(/_/g, ' ')}</td><td style="border: 1px solid #ddd; padding: 4px;">${rel.to}</td><td style="border: 1px solid #ddd; padding: 4px; text-align: center;">${status}</td><td style=\"border: 1px solid #ddd; padding: 4px; text-align: center;\"><button onclick=\"window.__hm_removeRelationship && window.__hm_removeRelationship(${index})\" style=\"background: var(--danger-accent); color: white; border: none; border-radius: 3px; cursor: pointer; padding: 2px 5px; font-size: 10px;\">X</button></td></tr>`;
        });
        tableHTML += `</tbody></table>`;
        listDiv.innerHTML = tableHTML;
      }

      function updateDropdownOptions() {
        const selectIds = ['editGroupAssignment', 'editSubGroupAssignment', 'editPhaseAssignment'];
        selectIds.forEach((id) => {
          const select = document.getElementById(id) as HTMLSelectElement | null;
          if (!select) return;
          const currentVal = select.value;
          if (id === 'editGroupAssignment') {
            select.innerHTML = '<option value="">— None —</option>';
            groups.forEach((group: any) => { select.innerHTML += `<option value="${group.id}">${group.name}</option>`; });
          } else if (id === 'editSubGroupAssignment') {
            select.innerHTML = '<option value="">— None —</option>';
            subGroups.forEach((sg: any) => { select.innerHTML += `<option value="${sg.id}">${sg.name}</option>`; });
          } else {
            select.innerHTML = '<option value="">— None —</option>';
            phases.forEach((ph: any) => { select.innerHTML += `<option value="${ph.id}">${ph.name}</option>`; });
          }
          select.value = currentVal;
        });
      }

      // Flag to force a full auto-layout (clearing manual fixed positions) after structural changes
      let forceAutoLayoutNext = false;

      function updateUI() {
        updateHierarchyDisplay();
        updateConflictsDisplay();
        updateRelationshipsDisplay();
        updateDropdownOptions();
        // If structural changes occurred (new context / relationship add/remove / delete / rename), clear fixed positions
        if (forceAutoLayoutNext) {
          contexts.forEach((c: any) => { c.fixed = false; });
          forceAutoLayoutNext = false;
        }
        applyLayoutAndDraw();
        saveToStorage();
      }

      // Event Handlers & Modals
      let wasDragged = false;
      function handleCanvasClick(event: any) {
        if ((event?.target as Element)?.closest('.context-node-group')) return;
        const [x, y] = d3.pointer(event, g.node());
        const snappedX = Math.round(x / GRID_CELL_SIZE) * GRID_CELL_SIZE;
        const snappedY = Math.round(y / GRID_CELL_SIZE) * GRID_CELL_SIZE;
        showContextModal(snappedX, snappedY);
      }
      function dragstarted(this: any, event: any) { event.sourceEvent.stopPropagation(); d3.select(this).raise().classed('dragging', true); wasDragged = false; }
      function dragged(this: any, event: any) { wasDragged = true; d3.select(this).attr('transform', `translate(${event.x}, ${event.y})`); }
      function dragended(this: any, event: any, d: any) {
        d3.select(this).classed('dragging', false);
        if (wasDragged) {
          const sourceId = d; let targetId: string | null = null;
          for (const [id] of contexts.entries()) {
            if (id === sourceId) continue;
            const p = nodePositions[id]; if (!p) continue;
            const dx = Math.abs(event.x - p.x), dy = Math.abs(event.y - p.y);
            if (dx <= GRID_CELL_SIZE / 2 && dy <= GRID_CELL_SIZE / 2) { targetId = id; break; }
          }
          if (targetId) { showRelationshipModal(sourceId, targetId); }
          else {
            const ctx = contexts.get(sourceId);
            if (ctx) { ctx.x = Math.round(event.x / GRID_CELL_SIZE) * GRID_CELL_SIZE; ctx.y = Math.round(event.y / GRID_CELL_SIZE) * GRID_CELL_SIZE; ctx.fixed = true; }
            updateUI();
          }
        } else {
          showEditNodeModal(d);
        }
      }

      function hideModals() { document.querySelectorAll('.modal-backdrop').forEach((m) => ((m as HTMLElement).style.display = 'none')); }

      function suggestNextContextId() {
        if (contexts.size === 0) return '1001';
        const numbers = Array.from(contexts.keys()).map((id) => parseInt((id.match(/\d+$/)?.[0] || ''))).filter((n) => !isNaN(n));
        return numbers.length > 0 ? String(Math.max(...numbers) + 1) : String(1000 + contexts.size + 1);
      }

      function parseDateFromInputs(year: number, era: string) { if (isNaN(year) || year <= 0) return null; return era === 'BCE' ? -year : year; }
      function formatDateForDisplay(internalYear: number | null) { if (internalYear === null || internalYear === 0) return { year: '', era: 'CE' }; return internalYear < 0 ? { year: Math.abs(internalYear), era: 'BCE' } : { year: internalYear, era: 'CE' }; }

      function showContextModal(x: number, y: number) {
        const modal = document.getElementById('contextModal') as HTMLElement | null; if (!modal) return;
        modal.style.display = 'flex';
        const input = document.getElementById('newContextId') as HTMLInputElement;
        const earliestYear = document.getElementById('earliestDateYear') as HTMLInputElement;
        const latestYear = document.getElementById('latestDateYear') as HTMLInputElement;
        const desc = document.getElementById('contextDescription') as HTMLTextAreaElement;
        const dateType = document.getElementById('dateType') as HTMLSelectElement;
        input.value = suggestNextContextId(); earliestYear.value = ''; latestYear.value = ''; desc.value = ''; dateType.value = '';
        input.focus();
        (document.getElementById('confirmContextBtn') as HTMLButtonElement).onclick = () => {
          const id = (document.getElementById('newContextId') as HTMLInputElement).value.trim().toUpperCase();
          if (!id || contexts.has(id)) { alert(`Context "${id}" is invalid or already exists.`); return; }
          const context: any = { id, x, y, fixed: true, type: (document.getElementById('contextType') as HTMLSelectElement).value, description: desc.value.trim() };
          const eYear = parseInt((document.getElementById('earliestDateYear') as HTMLInputElement).value);
          const eEra = (document.getElementById('earliestDateEra') as HTMLSelectElement).value;
          const lYear = parseInt((document.getElementById('latestDateYear') as HTMLInputElement).value);
          const lEra = (document.getElementById('latestDateEra') as HTMLSelectElement).value;
          context.earliestDate = parseDateFromInputs(eYear, eEra);
          context.latestDate = parseDateFromInputs(lYear, lEra);
          context.dateType = dateType.value;
          contexts.set(id, context);
          // New context triggers full rearrangement
          forceAutoLayoutNext = true;
          hideModals(); updateUI();
        };
      }

      function showEditNodeModal(contextId: string) {
        const modal = document.getElementById('editNodeModal') as HTMLElement | null; if (!modal) return;
        modal.style.display = 'flex';
        const context = contexts.get(contextId);
        (document.getElementById('editNodeModalTitle') as HTMLElement).innerText = `Edit Context: ${contextId}`;
        (document.getElementById('editNodeIdInput') as HTMLInputElement).value = contextId;
        (document.getElementById('editContextType') as HTMLSelectElement).value = context.type || 'layer';
        (document.getElementById('editContextDescription') as HTMLTextAreaElement).value = context.description || '';
        const earliestDisplay = formatDateForDisplay(context.earliestDate);
        (document.getElementById('editEarliestDateYear') as HTMLInputElement).value = String(earliestDisplay.year);
        (document.getElementById('editEarliestDateEra') as HTMLSelectElement).value = earliestDisplay.era;
        const latestDisplay = formatDateForDisplay(context.latestDate);
        (document.getElementById('editLatestDateYear') as HTMLInputElement).value = String(latestDisplay.year);
        (document.getElementById('editLatestDateEra') as HTMLSelectElement).value = latestDisplay.era;
        (document.getElementById('editDateType') as HTMLSelectElement).value = context.dateType || '';
        (document.getElementById('editGroupAssignment') as HTMLSelectElement).value = context.groupId || '';
        (document.getElementById('editSubGroupAssignment') as HTMLSelectElement).value = context.subGroupId || '';
        (document.getElementById('editPhaseAssignment') as HTMLSelectElement).value = context.phaseId || '';
        (document.getElementById('saveNodeBtn') as HTMLButtonElement).onclick = () => saveNodeChanges(contextId);
        (document.getElementById('deleteNodeBtn') as HTMLButtonElement).onclick = () => deleteContext(contextId);
      }

      function saveNodeChanges(oldId: string) {
        const newId = (document.getElementById('editNodeIdInput') as HTMLInputElement).value.trim().toUpperCase();
        if (!newId || (newId !== oldId && contexts.has(newId))) { alert('Context ID is invalid or already exists.'); return; }
        const context = contexts.get(oldId);
        if (context.groupId) groups.get(context.groupId)?.contexts.delete(oldId);
        if (context.subGroupId) subGroups.get(context.subGroupId)?.contexts.delete(oldId);
        context.type = (document.getElementById('editContextType') as HTMLSelectElement).value;
        context.description = (document.getElementById('editContextDescription') as HTMLTextAreaElement).value.trim();
        const eYear = parseInt((document.getElementById('editEarliestDateYear') as HTMLInputElement).value);
        const eEra = (document.getElementById('editEarliestDateEra') as HTMLSelectElement).value;
        const lYear = parseInt((document.getElementById('editLatestDateYear') as HTMLInputElement).value);
        const lEra = (document.getElementById('editLatestDateEra') as HTMLSelectElement).value;
        context.earliestDate = parseDateFromInputs(eYear, eEra);
        context.latestDate = parseDateFromInputs(lYear, lEra);
        context.dateType = (document.getElementById('editDateType') as HTMLSelectElement).value;
        const newGroupId = (document.getElementById('editGroupAssignment') as HTMLSelectElement).value || null;
        const newSubGroupId = (document.getElementById('editSubGroupAssignment') as HTMLSelectElement).value || null;
        const newPhaseId = (document.getElementById('editPhaseAssignment') as HTMLSelectElement).value || null;
        context.groupId = newGroupId; context.subGroupId = newSubGroupId; context.phaseId = newPhaseId;
        if (newId !== oldId) {
          context.id = newId; contexts.set(newId, context); contexts.delete(oldId);
          relationships.forEach((rel) => { if (rel.from === oldId) rel.from = newId; if (rel.to === oldId) rel.to = newId; });
        }
        if (newGroupId) { const group = groups.get(newGroupId); group?.contexts.add(newId); if (newSubGroupId) { group?.subGroups.add(newSubGroupId); } }
        if (newSubGroupId) { subGroups.get(newSubGroupId)?.contexts.add(newId); }
        // Editing a node can affect layout structure; trigger full rearrangement
        forceAutoLayoutNext = true;
        hideModals(); updateUI();
      }

      function showRelationshipModal(sourceId: string, targetId: string) {
        const modal = document.getElementById('relationshipModal') as HTMLElement | null; if (!modal) return;
        modal.style.display = 'flex';
        (document.getElementById('relationshipModalTitle') as HTMLElement).innerText = `Define Relationship: ${sourceId} → ${targetId}`;
        const select = document.getElementById('relationshipType') as HTMLSelectElement;
        select.innerHTML = `<optgroup label="Direct Pairing">
          <option value="fill_of">${sourceId} is FILL OF ${targetId}</option>
          <option value="filled_by">${sourceId} is FILLED BY ${targetId}</option>
        </optgroup>
        <optgroup label="Stratigraphic">
          <option value="above">${sourceId} is ABOVE ${targetId}</option>
          <option value="below">${sourceId} is BELOW ${targetId}</option>
          <option value="seals">${sourceId} SEALS ${targetId}</option>
          <option value="sealed_by">${sourceId} is SEALED BY ${targetId}</option>
        </optgroup>
        <optgroup label="Cutting">
          <option value="cuts">${sourceId} CUTS ${targetId}</option>
          <option value="cut_by">${sourceId} is CUT BY ${targetId}</option>
        </optgroup>
        <optgroup label="Contemporary">
          <option value="contemporary_with">Contemporary With</option>
          <option value="equivalent">Equivalent To</option>
          <option value="same_as">Same As</option>
        </optgroup>`;
        (document.getElementById('confirmRelationshipBtn') as HTMLButtonElement).onclick = () => {
          relationships.push({ from: sourceId, to: targetId, type: select.value });
          // Relationship addition impacts stratigraphy ordering
          forceAutoLayoutNext = true;
          hideModals(); updateUI();
        };
      }

      function deleteContext(contextId: string) {
        if (!window.confirm(`Delete context "${contextId}" and all its relationships?`)) return;
        const context = contexts.get(contextId);
        if (context?.groupId) groups.get(context.groupId)?.contexts.delete(contextId);
        if (context?.subGroupId) subGroups.get(context.subGroupId)?.contexts.delete(contextId);
        contexts.delete(contextId);
        relationships = relationships.filter((rel) => rel.from !== contextId && rel.to !== contextId);
        temporalConflicts = temporalConflicts.filter((c: any) => c.context1 !== contextId && c.context2 !== contextId);
        // Deletion changes graph topology
        forceAutoLayoutNext = true;
        hideModals(); updateUI();
      }

      function removeRelationship(index: number) { relationships.splice(index, 1); forceAutoLayoutNext = true; updateUI(); }

      function resetZoom() { (svg as any).transition().duration(750).call(zoom.transform, d3.zoomIdentity); }

      function analyzeTemporalConflicts() {
        temporalConflicts = [];
        (relationships || []).forEach((rel: any) => {
          const ctx1 = contexts.get(rel.from);
          const ctx2 = contexts.get(rel.to);
          if (!ctx1?.earliestDate || !ctx1?.latestDate || !ctx2?.earliestDate || !ctx2?.latestDate) return;
          let earlierCtx: any, laterCtx: any;
          if (['above', 'seals', 'cuts', 'filled_by'].includes(rel.type)) { earlierCtx = ctx2; laterCtx = ctx1; }
          else if (['below', 'sealed_by', 'cut_by', 'fill_of'].includes(rel.type)) { earlierCtx = ctx1; laterCtx = ctx2; }
          else return;
          const earlier = { earliest: earlierCtx.earliestDate, latest: earlierCtx.latestDate };
          const later = { earliest: laterCtx.earliestDate, latest: laterCtx.latestDate };
          if (earlier.earliest > later.latest) {
            temporalConflicts.push({ context1: earlierCtx.id, context2: laterCtx.id, description: `Date range conflict between ${earlierCtx.id} and ${laterCtx.id}` });
          }
        });
        updateUI();
        alert(`Analysis complete. Found ${temporalConflicts.length} temporal conflicts.`);
      }

      function confirmClear() {
        if (!window.confirm('Delete all data? This cannot be undone.')) return;
        contexts = new Map(); relationships = []; groups = new Map(); subGroups = new Map(); phases = new Map(); nodePositions = {}; temporalConflicts = [];
        saveToStorage(); updateUI();
      }

      function triggerImport() { fileInputRef.current?.click(); }

      function handleFileSelect(event: any) {
        const file = event.target.files?.[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = (e: any) => {
          try {
            const csvContent: string = e.target.result;
            const rows = csvContent.split(/\r?\n/).filter(Boolean).map((r) => r.split(','));
            const headers = rows.shift() || [];
            showImportModal(rows, headers);
          } catch (err) {
            alert('Failed to parse CSV');
          }
        };
        reader.readAsText(file);
        event.target.value = '';
      }

      function showImportModal(parsedData: string[][], headers: string[]) {
        const modal = document.getElementById('importModal') as HTMLElement | null; if (!modal) return;
        const selectIds = ['mapContextId', 'mapDescription', 'mapRelType', 'mapRelTo'];
        const noMap = `<option value="">--- Do Not Map ---</option>`;
        const headerOptions = headers.map((h) => `<option value="${h}">${h}</option>`).join('');
        selectIds.forEach((id) => { const sel = document.getElementById(id) as HTMLSelectElement; if (sel) sel.innerHTML = noMap + headerOptions; });
        // keep for confirmImport
        (window as any).__hm_lastHeaders = headers;
        const smartMap: any = {
          mapContextId: ['id', 'context', 'context_id', 'unit'],
          mapDescription: ['desc', 'description', 'notes'],
          mapRelType: ['rel_type', 'relationship', 'rel type', 'type'],
          mapRelTo: ['rel_to', 'related_to', 'related context', 'is_below', 'is_above']
        };
        for (const [selectId, possibles] of Object.entries(smartMap)) {
          const found = headers.find((h) => (possibles as string[]).includes(h.toLowerCase().replace(/ /g, '_')));
          if (found) (document.getElementById(selectId) as HTMLSelectElement).value = found;
        }
        (document.getElementById('confirmImportBtn') as HTMLButtonElement).onclick = () => confirmImport(parsedData);
        modal.style.display = 'flex';
      }

      function confirmImport(parsedData: string[][]) {
        const mapping = {
          contextId: (document.getElementById('mapContextId') as HTMLSelectElement).value,
          description: (document.getElementById('mapDescription') as HTMLSelectElement).value,
          relType: (document.getElementById('mapRelType') as HTMLSelectElement).value,
          relTo: (document.getElementById('mapRelTo') as HTMLSelectElement).value,
          clear: (document.getElementById('importClearData') as HTMLInputElement).checked,
        };
        if (!mapping.contextId) { alert('Context ID must be mapped.'); return; }
        if (mapping.clear) { contexts = new Map(); relationships = []; groups = new Map(); subGroups = new Map(); phases = new Map(); }
        let importedContexts = 0; let importedRels = 0;
        // Import by headers names
        // Build index map
        const headersSel = {
          id: (document.getElementById('mapContextId') as HTMLSelectElement).value,
          desc: (document.getElementById('mapDescription') as HTMLSelectElement).value,
          relType: (document.getElementById('mapRelType') as HTMLSelectElement).value,
          relTo: (document.getElementById('mapRelTo') as HTMLSelectElement).value,
        } as any;
        const hdrs = (window as any).__hm_lastHeaders as string[] | undefined;
        const headerIndex: any = {};
        (hdrs || []).forEach((h: string, i: number) => headerIndex[h] = i);
        parsedData.forEach((row) => {
          const idVal = headersSel.id ? row[headerIndex[headersSel.id]] : '';
          if (idVal && !contexts.has(idVal)) { contexts.set(idVal, { id: idVal, x: 0, y: 0, fixed: false, type: 'layer', description: headersSel.desc ? (row[headerIndex[headersSel.desc]] || '') : '' }); importedContexts++; }
          if (headersSel.relType && headersSel.relTo && idVal) {
            const rType = row[headerIndex[headersSel.relType]];
            const rTo = row[headerIndex[headersSel.relTo]];
            if (rType && rTo) { relationships.push({ from: idVal, to: rTo, type: String(rType).toLowerCase().replace(/\s+/g, '_') }); importedRels++; }
          }
        });
        hideModals(); updateUI();
        alert(`Import complete. Added ${importedContexts} contexts and ${importedRels} relationships.`);
      }

      function exportViewAsSVG() {
        // Compute bbox-like export (simplified)
        const gridGroup = g.select('.grid-group');
        gridGroup.style('display', 'none');
        const svgContent = (g.node() as any).innerHTML;
        gridGroup.style('display', null);
        let cssStyles = '';
        try {
          for (const sheet of Array.from(document.styleSheets)) {
            try {
              const rules = (sheet as CSSStyleSheet).cssRules || [];
              for (const r of Array.from(rules)) { cssStyles += (r as CSSStyleRule).cssText || ''; }
            } catch {}
          }
        } catch {}
        const standalone = `<svg xmlns="http://www.w3.org/2000/svg"><style>${cssStyles}</style>${svgContent}</svg>`;
        const blob = new Blob([standalone], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a'); link.href = url; link.download = 'harris_matrix.svg'; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
      }

      function exportCSV() {
        if (contexts.size === 0) { alert('No data to export.'); return; }
        const headers = ['Context_ID','Context_Type','Description','Earliest_Date_Year','Earliest_Date_Era','Latest_Date_Year','Latest_Date_Era','Date_Type','Phase_ID','Group_ID','SubGroup_ID'];
        let csv = headers.join(',') + '\r\n';
        contexts.forEach((c: any) => {
          const ed = formatDateForDisplay(c.earliestDate); const ld = formatDateForDisplay(c.latestDate);
          csv += [c.id, c.type || '', (c.description || '').replace(/,/g, ' '), ed.year, ed.era, ld.year, ld.era, c.dateType || '', c.phaseId || '', c.groupId || '', c.subGroupId || ''].join(',') + '\r\n';
        });
        const link = document.createElement('a'); link.href = 'data:text/csv;charset=utf-8,' + encodeURI(csv); link.download = 'harris_matrix.csv'; document.body.appendChild(link); link.click(); document.body.removeChild(link);
      }

      // Hook up SVG interactions
      svg.on('click', handleCanvasClick);

      // Expose helpers for buttons/tables
      (window as any).__hm_removeRelationship = removeRelationship;
      (window as any).__hm_highlightPhase = (id: string) => highlightBy((c: any) => c.phaseId === id, '#4caf50');
      (window as any).__hm_highlightGroup = (id: string) => highlightBy((c: any) => c.groupId === id, '#ff9800');
      (window as any).__hm_highlightContext = (id: string) => highlightBy((c: any) => c.id === id, 'gold');

      function highlightBy(filterFn: (c: any) => boolean, color: string) {
        g.selectAll('.context-node-group').each(function (this: any) {
          const node = d3.select(this);
          const rect = node.select('rect');
          const c = contexts.get((node.datum && node.datum()) || (nodeDataFromTransform(this)));
          const isSelected = c && filterFn(c);
          rect.transition().duration(300)
            .attr('stroke-width', isSelected ? '4px' : '2px')
            .attr('stroke', isSelected ? color : '#0056b3');
        });
      }
      function nodeDataFromTransform(el: any) {
        // Attempt to read label text as id
        try { return (d3.select(el).select('text').text()) || null; } catch { return null; }
      }

      // Initial draw
      updateUI();

      cleanup = () => {
        svg.on('.zoom', null);
        svg.on('click', null);
      };

      // Wire API ref for React buttons
      apiRef.current = {
        createGroup: () => {
          const modal = document.getElementById('groupModal') as HTMLElement | null; if (!modal) return;
          (document.getElementById('groupModalTitle') as HTMLElement).innerText = 'Create Group';
          (document.getElementById('groupTypeWrapper') as HTMLElement).style.display = 'block';
          (document.getElementById('groupName') as HTMLInputElement).value = '';
          (document.getElementById('groupDescription') as HTMLTextAreaElement).value = '';
          (document.getElementById('confirmGroupBtn') as HTMLButtonElement).onclick = () => {
            const name = (document.getElementById('groupName') as HTMLInputElement).value.trim(); if (!name) { alert('Group name is required.'); return; }
            const id = `group_${Date.now()}`; const group = { id, name, type: (document.getElementById('groupType') as HTMLSelectElement).value, description: (document.getElementById('groupDescription') as HTMLTextAreaElement).value.trim(), contexts: new Set(), subGroups: new Set() };
            groups.set(id, group); hideModals(); updateUI();
          };
          modal.style.display = 'flex';
        },
        createSubGroup: () => {
          if (groups.size === 0) { alert('Please create a parent group first.'); return; }
          const modal = document.getElementById('groupModal') as HTMLElement | null; if (!modal) return;
          (document.getElementById('groupModalTitle') as HTMLElement).innerText = 'Create Sub-Group';
          (document.getElementById('groupTypeWrapper') as HTMLElement).style.display = 'none';
          (document.getElementById('groupName') as HTMLInputElement).value = '';
          (document.getElementById('groupDescription') as HTMLTextAreaElement).value = '';
          (document.getElementById('confirmGroupBtn') as HTMLButtonElement).onclick = () => {
            const name = (document.getElementById('groupName') as HTMLInputElement).value.trim(); if (!name) { alert('Sub-group name is required.'); return; }
            const id = `subgroup_${Date.now()}`; const sg = { id, name, type: 'subgroup', description: (document.getElementById('groupDescription') as HTMLTextAreaElement).value.trim(), contexts: new Set() };
            subGroups.set(id, sg); hideModals(); updateUI();
          };
          modal.style.display = 'flex';
        },
        createPhase: () => {
          const modal = document.getElementById('groupModal') as HTMLElement | null; if (!modal) return;
          (document.getElementById('groupModalTitle') as HTMLElement).innerText = 'Create Phase';
          (document.getElementById('groupTypeWrapper') as HTMLElement).style.display = 'none';
          (document.getElementById('groupName') as HTMLInputElement).value = '';
          (document.getElementById('groupDescription') as HTMLTextAreaElement).value = '';
          (document.getElementById('confirmGroupBtn') as HTMLButtonElement).onclick = () => {
            const name = (document.getElementById('groupName') as HTMLInputElement).value.trim(); if (!name) { alert('Phase name is required.'); return; }
            const id = `phase_${Date.now()}`; const ph = { id, name, type: 'phase', description: (document.getElementById('groupDescription') as HTMLTextAreaElement).value.trim() };
            phases.set(id, ph); hideModals(); updateUI();
          };
          modal.style.display = 'flex';
        },
        analyzeTemporalConflicts,
        resetZoom,
        exportCSV,
        exportSVG: exportViewAsSVG,
        clearAll: confirmClear,
        importCSV: triggerImport,
        __handleFileSelect: handleFileSelect,
      };
    })();

    return () => { cleanup && cleanup(); };
  }, [projectId]);

  return (
    <div ref={rootRef} className="harris-matrix" style={{ width: '100%', height: '100%' }}>
      <div className="container">
        <div className="workspace" style={{ width: '100%' }}>
          <div className="visualization-panel">
            <svg id="matrixSvg" ref={svgRef} />
          </div>
          <div className="data-panel">
            <div className="tabs">
              <div className={`tab ${activeTab === 'hierarchy' ? 'active' : ''}`} onClick={() => setActiveTab('hierarchy')}>Hierarchy</div>
              <div className={`tab ${activeTab === 'conflicts' ? 'active' : ''}`} onClick={() => setActiveTab('conflicts')}>Conflicts</div>
              <div className={`tab ${activeTab === 'relationships' ? 'active' : ''}`} onClick={() => setActiveTab('relationships')}>Relationships</div>
            </div>
            <div id="hierarchy-tab" className={`tab-content ${activeTab === 'hierarchy' ? 'active' : ''}`}>
              <h3>Stratigraphic Hierarchy</h3>
              <div id="hierarchyList" className="hierarchy-list"></div>
            </div>
            <div id="conflicts-tab" className={`tab-content ${activeTab === 'conflicts' ? 'active' : ''}`}>
              <h3>Temporal Conflicts</h3>
              <div id="conflictsList" className="hierarchy-list"></div>
            </div>
            <div id="relationships-tab" className={`tab-content ${activeTab === 'relationships' ? 'active' : ''}`}>
              <h3>Relationships</h3>
              <div id="relationshipsList" className="hierarchy-list"></div>
            </div>

            <div className="actions-panel">
              <button className="btn-primary" onClick={() => apiRef.current.resetZoom()}>Reset View</button>
              <h3>Management Tools</h3>
              <button className="btn-warning" onClick={() => apiRef.current.createGroup()}>Create Group</button>
              <button className="btn-warning" onClick={() => apiRef.current.createSubGroup()}>Create Sub-Group</button>
              <button className="btn-success" onClick={() => apiRef.current.createPhase()}>Create Phase</button>
              <button className="btn-primary" onClick={() => apiRef.current.analyzeTemporalConflicts()}>Analyze Conflicts</button>
              <h3>Import/Export</h3>
              <button className="btn-primary" onClick={() => apiRef.current.exportCSV()}>Export CSV</button>
              <button className="btn-primary" onClick={() => apiRef.current.exportSVG()}>Export View as SVG</button>
              <button className="btn-primary" onClick={() => apiRef.current.importCSV()}>Import from CSV</button>
              <h3>Start Over</h3>
              <button className="btn-danger" onClick={() => apiRef.current.clearAll()}>Clear All</button>
              <input ref={fileInputRef} type="file" id="csvFileInput" accept=".csv" style={{ display: 'none' }} onChange={(e) => (apiRef.current && apiRef.current.__handleFileSelect ? apiRef.current.__handleFileSelect(e) : undefined)} />
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {/* Import Modal */}
      <div id="importModal" className="modal-backdrop">
        <div className="modal-content">
          <h4>Map CSV Columns to Import</h4>
          <p style={{ fontSize: '0.9em', marginBottom: 15 }}>
            Select which column from your CSV file corresponds to each data field. Context ID is required.
          </p>
          <div className="form-group"><label>Context ID (Required)</label><select id="mapContextId"></select></div>
          <div className="form-group"><label>Description</label><select id="mapDescription"></select></div>
          <hr style={{ margin: '16px 0' }} />
          <h5 style={{ marginBottom: 10 }}>For Relationships</h5>
          <div className="form-group"><label>Relationship Type</label><select id="mapRelType"></select></div>
          <div className="form-group"><label>Related Context ID</label><select id="mapRelTo"></select></div>
          <hr style={{ margin: '16px 0' }} />
          <div className="form-group"><label><input type="checkbox" id="importClearData" defaultChecked /> Clear all existing data before import</label></div>
          <div className="modal-buttons">
            <button id="confirmImportBtn" className="confirm">Import Data</button>
            <button className="cancel" onClick={() => (document.getElementById('importModal') as any).style.display = 'none'}>Cancel</button>
          </div>
        </div>
      </div>

      {/* Context Modal */}
      <div id="contextModal" className="modal-backdrop">
        <div className="modal-content">
          <h4>Create New Context</h4>
          <div className="form-group"><label>Context Identifier</label><input type="text" id="newContextId" placeholder="e.g., 1001" /></div>
          <div className="form-group"><label>Context Type</label>
            <select id="contextType">
              <option value="layer">Layer</option>
              <option value="cut">Cut</option>
              <option value="fill">Fill</option>
              <option value="structure">Structure</option>
              <option value="interface">Interface</option>
            </select>
          </div>
          <div className="form-group"><label>Description</label><textarea id="contextDescription" rows={2} placeholder="Brief description" /></div>
          <div className="form-group"><label>Dating Evidence (optional)</label>
            <label style={{ fontSize: '0.9em', fontWeight: 'normal', marginTop: 5 }}>Earliest Date</label>
            <div className="date-inputs">
              <input type="number" id="earliestDateYear" placeholder="Year" />
              <select id="earliestDateEra"><option>BCE</option><option selected>CE</option></select>
            </div>
            <label style={{ fontSize: '0.9em', fontWeight: 'normal', marginTop: 5 }}>Latest Date</label>
            <div className="date-inputs">
              <input type="number" id="latestDateYear" placeholder="Year" />
              <select id="latestDateEra"><option>BCE</option><option selected>CE</option></select>
            </div>
            <select id="dateType" style={{ marginTop: 10 }}>
              <option value="">— Date Type —</option>
              <option>Absolute</option>
              <option>Relative</option>
              <option>Terminus Ante Quem</option>
              <option>Terminus Post Quem</option>
            </select>
          </div>
          <div className="modal-buttons">
            <button id="confirmContextBtn" className="confirm">Create</button>
            <button className="cancel" onClick={() => (document.getElementById('contextModal') as any).style.display = 'none'}>Cancel</button>
          </div>
        </div>
      </div>

      {/* Relationship Modal */}
      <div id="relationshipModal" className="modal-backdrop">
        <div className="modal-content">
          <h4 id="relationshipModalTitle">Define Relationship</h4>
          <select id="relationshipType"></select>
          <div className="modal-buttons">
            <button id="confirmRelationshipBtn" className="confirm">Add</button>
            <button className="cancel" onClick={() => (document.getElementById('relationshipModal') as any).style.display = 'none'}>Cancel</button>
          </div>
        </div>
      </div>

      {/* Edit Node Modal */}
      <div id="editNodeModal" className="modal-backdrop">
        <div className="modal-content">
          <h4 id="editNodeModalTitle">Edit Context</h4>
          <div className="form-group"><label>Context Identifier</label><input type="text" id="editNodeIdInput" /></div>
          <div className="form-group"><label>Context Type</label>
            <select id="editContextType">
              <option value="layer">Layer</option>
              <option value="cut">Cut</option>
              <option value="fill">Fill</option>
              <option value="structure">Structure</option>
              <option value="interface">Interface</option>
            </select>
          </div>
          <div className="form-group"><label>Description</label><textarea id="editContextDescription" rows={2}></textarea></div>
          <div className="form-group"><label>Dating Evidence</label>
            <label style={{ fontSize: '0.9em', fontWeight: 'normal', marginTop: 5 }}>Earliest Date</label>
            <div className="date-inputs">
              <input type="number" id="editEarliestDateYear" placeholder="Year" />
              <select id="editEarliestDateEra"><option>BCE</option><option selected>CE</option></select>
            </div>
            <label style={{ fontSize: '0.9em', fontWeight: 'normal', marginTop: 5 }}>Latest Date</label>
            <div className="date-inputs">
              <input type="number" id="editLatestDateYear" placeholder="Year" />
              <select id="editLatestDateEra"><option>BCE</option><option selected>CE</option></select>
            </div>
            <select id="editDateType" style={{ marginTop: 10 }}>
              <option value="">— Date Type —</option>
              <option>Absolute</option>
              <option>Relative</option>
              <option>Terminus Ante Quem</option>
              <option>Terminus Post Quem</option>
            </select>
          </div>
          <div className="form-group"><label>Group Assignment</label>
            <select id="editGroupAssignment"><option value="">— None —</option></select>
          </div>
          <div className="form-group"><label>Sub-Group Assignment</label>
            <select id="editSubGroupAssignment"><option value="">— None —</option></select>
          </div>
          <div className="form-group"><label>Phase Assignment</label>
            <select id="editPhaseAssignment"><option value="">— None —</option></select>
          </div>
          <div className="modal-buttons">
            <button id="saveNodeBtn" className="confirm">Save Changes</button>
            <button className="cancel" onClick={() => (document.getElementById('editNodeModal') as any).style.display = 'none'}>Cancel</button>
          </div>
          <button id="deleteNodeBtn" className="danger" style={{ width: '100%', marginTop: 10 }}>Delete Context</button>
        </div>
      </div>

      {/* Group / Subgroup / Phase Modal */}
      <div id="groupModal" className="modal-backdrop">
        <div className="modal-content">
          <h4 id="groupModalTitle">Create Group</h4>
          <div className="form-group"><label>Name</label><input type="text" id="groupName" placeholder="e.g., Building A" /></div>
          <div className="form-group"><label>Description</label><textarea id="groupDescription" rows={2} placeholder="Description" /></div>
          <div className="form-group" id="groupTypeWrapper">
            <label>Group Type</label>
            <select id="groupType">
              <option value="functional">Functional</option>
              <option value="spatial">Spatial</option>
              <option value="material">Material</option>
            </select>
          </div>
          <div className="modal-buttons">
            <button id="confirmGroupBtn" className="confirm">Create</button>
            <button className="cancel" onClick={() => (document.getElementById('groupModal') as any).style.display = 'none'}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HarrisMatrix;
