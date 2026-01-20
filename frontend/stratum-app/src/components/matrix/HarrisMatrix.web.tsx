import React, { useEffect, useMemo, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FaWrench, FaArrowLeft } from 'react-icons/fa';
import { MdOutlineViewInAr } from 'react-icons/md';
import { FaArrowRotateRight } from 'react-icons/fa6';
import { HiDotsHorizontal } from 'react-icons/hi';
import './HarrisMatrix.css';
import { formsService } from '../../services/formsService';
import {
  ContextFeatureRecord,
  StratigraphicUnitRecord,
  ArtefactRegistries,
  createEmptyRegistries,
  normalizeLoadedData,
  ArtefactRecord,
} from './registryModels';

const DEFAULT_GROUP_COLOR = '#ff9800';
const DEFAULT_SUBGROUP_COLOR = '#9c27b0';

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`.toUpperCase();
}

function generateGroupColor(): string {
  const hue = Math.floor(Math.random() * 360);
  const saturation = 65 + Math.floor(Math.random() * 20); // 65-85%
  const lightness = 45 + Math.floor(Math.random() * 12); // 45-57%
  return hslToHex(hue, saturation, lightness);
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  if (![3, 6].includes(normalized.length)) return hex;
  const fullHex =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized;
  const bigint = parseInt(fullHex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface GroupOverlayContext {
  id: string;
  label: string;
  type?: string;
  description?: string;
}

interface GroupOverlayData {
  id: string;
  type: 'group' | 'subgroup';
  name: string;
  description?: string;
  color: string;
  contexts: GroupOverlayContext[];
}

interface HarrisMatrixProps {
  projectId: string;
  canEdit?: boolean;
}

export const HarrisMatrix: React.FC<HarrisMatrixProps> = ({ projectId, canEdit = true }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canEditRef = useRef(canEdit);
  // Keep canEditRef in sync with prop
  canEditRef.current = canEdit;
  const [activeTab, setActiveTab] = useState<
    | 'hierarchy'
    | 'conflicts'
    | 'relationships'
    | 'records'
    | 'featureForm'
    | 'suForm'
    | 'artefacts'
    | 'export'
  >('hierarchy');
  const [sidebarView, setSidebarView] = useState<
    'default' | 'featureForm' | 'suForm' | 'artefacts'
  >('default');
  const [toolMenuOpen, setToolMenuOpen] = useState(false);
  const [overlayData, setOverlayData] = useState<GroupOverlayData | null>(null);
  const toolMenuRef = useRef<HTMLDivElement | null>(null);
  const openGroupModalRef = useRef<
    ((entity: 'group' | 'subgroup' | 'phase', mode: 'create' | 'edit', id?: string) => void) | null
  >(null);
  const dotsIconMarkup = useMemo(() => renderToStaticMarkup(<HiDotsHorizontal />), []);

  // Expose imperative handlers to JSX via ref
  const apiRef = useRef<any>({});

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    (async () => {
      const d3: any = await import('d3');
      if (!svgRef.current) return;

      // Data Model (base Harris Matrix + digitized supplementary forms)
      let contexts: Map<string, any> = new Map();
      let relationships: any[] = [];
      let groups: Map<string, any> = new Map();
      let subGroups: Map<string, any> = new Map();
      let phases: Map<string, any> = new Map();
      let nodePositions: Record<string, { x: number; y: number }> = {};
      let temporalConflicts: any[] = [];
      // Digitized form stores
      let contextForms: Map<string, ContextFeatureRecord> = new Map();
      let stratigraphicUnits: Map<string, StratigraphicUnitRecord> = new Map();
      let artefactRegistries: ArtefactRegistries = createEmptyRegistries();

      // Persistence
      const storageKey = `harrisMatrixData:${projectId}`;
      function saveToStorage() {
        const data = {
          contexts: Array.from(contexts.entries()),
          relationships,
          groups: Array.from(groups.entries()).map(([id, obj]: any) => [
            id,
            {
              ...obj,
              contexts: Array.from(obj.contexts || []),
              subGroups: Array.from(obj.subGroups || []),
            },
          ]),
          subGroups: Array.from(subGroups.entries()).map(([id, obj]: any) => [
            id,
            { ...obj, contexts: Array.from(obj.contexts || []) },
          ]),
          phases: Array.from(phases.entries()),
          contextForms: Array.from(contextForms.entries()),
          stratigraphicUnits: Array.from(stratigraphicUnits.entries()),
          artefacts: artefactRegistries,
          version: 2,
        };
        try {
          localStorage.setItem(storageKey, JSON.stringify(data));
        } catch {}
      }
      function loadFromStorage() {
        try {
          const raw = localStorage.getItem(storageKey);
          if (!raw) return;
          const data = JSON.parse(raw);
          contexts = new Map(
            (data.contexts || []).map(([id, obj]: [string, any]) => [id, { ...obj }])
          );
          relationships = data.relationships || [];
          groups = new Map(
            (data.groups || []).map(([id, obj]: [string, any]) => [
              id,
              {
                ...obj,
                contexts: new Set(obj.contexts || []),
                subGroups: new Set(obj.subGroups || []),
              },
            ])
          );
          subGroups = new Map(
            (data.subGroups || []).map(([id, obj]: [string, any]) => [
              id,
              { ...obj, contexts: new Set(obj.contexts || []) },
            ])
          );
          phases = new Map(data.phases || []);
          const extended = normalizeLoadedData(data);
          contextForms = extended.contextForms;
          stratigraphicUnits = extended.stratigraphicUnits;
          artefactRegistries = extended.artefacts;
        } catch {}
      }

      type GroupModalEntity = 'group' | 'subgroup' | 'phase';
      interface GroupModalOptions {
        mode: 'create' | 'edit';
        entity: GroupModalEntity;
        id?: string;
      }

      function openGroupModal(options: GroupModalOptions) {
        if (!canEditRef.current) return; // Guests cannot create/edit groups
        const modal = document.getElementById('groupModal') as HTMLElement | null;
        if (!modal) return;
        const titleEl = document.getElementById('groupModalTitle') as HTMLElement | null;
        const nameInput = document.getElementById('groupName') as HTMLInputElement | null;
        const descriptionInput = document.getElementById(
          'groupDescription'
        ) as HTMLTextAreaElement | null;
        const typeWrapper = document.getElementById('groupTypeWrapper') as HTMLElement | null;
        const typeSelect = document.getElementById('groupType') as HTMLSelectElement | null;
        const colorRow = document.getElementById('groupColorRow') as HTMLElement | null;
        const colorInput = document.getElementById('groupColor') as HTMLInputElement | null;
        const randomizeButton = document.getElementById(
          'groupRandomizeColor'
        ) as HTMLButtonElement | null;
        const confirmBtn = document.getElementById('confirmGroupBtn') as HTMLButtonElement | null;
        if (
          !titleEl ||
          !nameInput ||
          !descriptionInput ||
          !typeWrapper ||
          !typeSelect ||
          !confirmBtn
        )
          return;

        const isGroup = options.entity === 'group';
        const isSubGroup = options.entity === 'subgroup';
        const showColorControls = isGroup || isSubGroup;
        const modalTitle =
          options.mode === 'edit'
            ? isGroup
              ? 'Edit Group'
              : isSubGroup
                ? 'Edit Sub-Group'
                : 'Edit Phase'
            : isGroup
              ? 'Create Group'
              : isSubGroup
                ? 'Create Sub-Group'
                : 'Create Phase';
        titleEl.innerText = modalTitle;

        typeWrapper.style.display = isGroup ? 'block' : 'none';
        if (isGroup && !options.id) {
          typeSelect.value = 'functional';
        }

        if (colorRow) colorRow.style.display = showColorControls ? 'block' : 'none';
        const ensureColorValue = () => {
          if (!showColorControls || !colorInput) return undefined;
          const sourceColor = colorInput.value || generateGroupColor();
          colorInput.value = sourceColor;
          return sourceColor;
        };

        if (options.mode === 'edit' && options.id) {
          if (isGroup) {
            const group = groups.get(options.id);
            if (!group) return;
            nameInput.value = group.name || '';
            descriptionInput.value = group.description || '';
            typeSelect.value = group.type || 'functional';
            if (colorInput) colorInput.value = group.color || DEFAULT_GROUP_COLOR;
          } else if (isSubGroup) {
            const subgroup = subGroups.get(options.id);
            if (!subgroup) return;
            nameInput.value = subgroup.name || '';
            descriptionInput.value = subgroup.description || '';
            if (colorInput) colorInput.value = subgroup.color || DEFAULT_SUBGROUP_COLOR;
          } else {
            const phase = phases.get(options.id);
            if (!phase) return;
            nameInput.value = phase.name || '';
            descriptionInput.value = phase.description || '';
          }
        } else {
          nameInput.value = '';
          descriptionInput.value = '';
          if (showColorControls && colorInput) colorInput.value = generateGroupColor();
        }

        if (randomizeButton) {
          randomizeButton.onclick = () => {
            if (colorInput) colorInput.value = generateGroupColor();
          };
        }

        confirmBtn.innerText = options.mode === 'edit' ? 'Save Changes' : 'Create';
        confirmBtn.onclick = () => {
          const name = nameInput.value.trim();
          if (!name) {
            alert('Name is required.');
            return;
          }
          const description = descriptionInput.value.trim();
          const selectedColor = showColorControls
            ? colorInput?.value || generateGroupColor()
            : undefined;

          if (options.mode === 'create') {
            if (isGroup) {
              const id = `group_${Date.now()}`;
              const group = {
                id,
                name,
                type: typeSelect.value,
                description,
                color: selectedColor || generateGroupColor(),
                contexts: new Set<string>(),
                subGroups: new Set<string>(),
              };
              groups.set(id, group);
            } else if (isSubGroup) {
              const id = `subgroup_${Date.now()}`;
              const subgroup = {
                id,
                name,
                type: 'subgroup',
                description,
                color: selectedColor || generateGroupColor(),
                contexts: new Set<string>(),
              };
              subGroups.set(id, subgroup);
            } else {
              const id = `phase_${Date.now()}`;
              const phase = { id, name, type: 'phase', description };
              phases.set(id, phase);
            }
          } else if (options.id) {
            if (isGroup) {
              const group = groups.get(options.id);
              if (!group) return;
              group.name = name;
              group.description = description;
              group.type = typeSelect.value;
              group.color = selectedColor || group.color || DEFAULT_GROUP_COLOR;
              setOverlayData((prev) =>
                prev && prev.id === group.id && prev.type === 'group'
                  ? { ...prev, name, description, color: group.color }
                  : prev
              );
            } else if (isSubGroup) {
              const subgroup = subGroups.get(options.id);
              if (!subgroup) return;
              subgroup.name = name;
              subgroup.description = description;
              subgroup.color = selectedColor || subgroup.color || DEFAULT_SUBGROUP_COLOR;
              setOverlayData((prev) =>
                prev && prev.id === subgroup.id && prev.type === 'subgroup'
                  ? { ...prev, name, description, color: subgroup.color }
                  : prev
              );
            } else {
              const phase = phases.get(options.id);
              if (!phase) return;
              phase.name = name;
              phase.description = description;
            }
          }

          hideModals();
          updateUI();
        };

        modal.style.display = 'flex';
        ensureColorValue();
      }

      openGroupModalRef.current = (entity, mode, id) => openGroupModal({ entity, mode, id });
      loadFromStorage();

      // D3 Setup
      const svg = d3.select(svgRef.current);
      let g = svg.select('g.main-group');
      if (g.empty()) g = svg.append('g').attr('class', 'main-group');
      const GRID_CELL_SIZE = 60;
      // Darken grid lines to better fit the dark theme
      const GRID_COLOR = '#2f3336';
      const zoom = d3
        .zoom()
        .scaleExtent([0.1, 5])
        .on('zoom', (event: any) => g.attr('transform', event.transform));
      svg.call(zoom as any);

      function drawGrid() {
        g.select('.grid-group').remove();
        const gridSize = 4000;
        const gridGroup = g.insert('g', ':first-child').attr('class', 'grid-group');
        gridGroup
          .selectAll('line.vertical')
          .data(d3.range(-gridSize, gridSize, GRID_CELL_SIZE))
          .enter()
          .append('line')
          .attr('class', 'vertical')
          .attr('x1', (d: number) => d)
          .attr('y1', -gridSize)
          .attr('x2', (d: number) => d)
          .attr('y2', gridSize)
          .style('stroke', GRID_COLOR)
          .style('stroke-width', 1);
        gridGroup
          .selectAll('line.horizontal')
          .data(d3.range(-gridSize, gridSize, GRID_CELL_SIZE))
          .enter()
          .append('line')
          .attr('class', 'horizontal')
          .attr('x1', -gridSize)
          .attr('y1', (d: number) => d)
          .attr('x2', gridSize)
          .attr('y2', (d: number) => d)
          .style('stroke', GRID_COLOR)
          .style('stroke-width', 1);
      }
      drawGrid();

      // Layout helpers (subset from HTML)
      function findRedundantRelationships() {
        const redundantIndices = new Set<number>();
        const edges = (relationships || [])
          .filter((rel: any) =>
            [
              'above',
              'seals',
              'cuts',
              'fill_of',
              'below',
              'sealed_by',
              'cut_by',
              'filled_by',
            ].includes(rel.type)
          )
          .map((rel: any, idx: number) => {
            let from = rel.from,
              to = rel.to;
            if (['above', 'seals', 'cuts', 'fill_of'].includes(rel.type)) {
              from = rel.to;
              to = rel.from;
            }
            return { from, to, originalIndex: idx };
          });
        const adj: Map<string, string[]> = new Map();
        edges.forEach((e) => {
          if (!adj.has(e.from)) adj.set(e.from, []);
          adj.get(e.from)!.push(e.to);
        });
        const hasPath = (start: string, end: string, ignored?: any) => {
          const stack = [start];
          const visited = new Set([start]);
          while (stack.length) {
            const u = stack.pop()!;
            for (const v of adj.get(u) || []) {
              if (ignored && u === ignored.from && v === ignored.to) continue;
              if (v === end) return true;
              if (!visited.has(v)) {
                visited.add(v);
                stack.push(v);
              }
            }
          }
          return false;
        };
        edges.forEach((edge) => {
          if (hasPath(edge.from, edge.to, edge)) redundantIndices.add(edge.originalIndex);
        });
        return redundantIndices;
      }

      function drawGroupBoundaries(positions: Record<string, any>) {
        const drawRectBoundary = (
          contextIds: string[],
          className: string,
          color?: string,
          fallbackColor?: string
        ) => {
          const validPositions = contextIds.map((id) => positions[id]).filter(Boolean);
          if (validPositions.length < 1) return;
          const padX = 60;
          const padY = 40;
          const minX = d3.min(validPositions, (p: any) => p.x) - padX;
          const maxX = d3.max(validPositions, (p: any) => p.x) + padX;
          const minY = d3.min(validPositions, (p: any) => p.y) - padY;
          const maxY = d3.max(validPositions, (p: any) => p.y) + padY;
          const rect = g
            .insert('rect', ':first-child')
            .attr('class', className)
            .attr('x', minX)
            .attr('y', minY)
            .attr('width', maxX - minX)
            .attr('height', maxY - minY)
            .attr('rx', 15);
          const resolvedColor = color || fallbackColor;
          if (resolvedColor) {
            const fillAlpha = className === 'group-boundary' ? 0.16 : 0.12;
            rect.style('stroke', resolvedColor).style('fill', hexToRgba(resolvedColor, fillAlpha));
          }
        };
        phases.forEach((phase: any) => {
          const ids = Array.from(contexts.values())
            .filter((c: any) => c.phaseId === phase.id)
            .map((c: any) => c.id);
          drawRectBoundary(ids, 'phase-boundary');
        });
        groups.forEach((group: any) =>
          drawRectBoundary(
            Array.from(group.contexts || []),
            'group-boundary',
            group.color,
            DEFAULT_GROUP_COLOR
          )
        );
        subGroups.forEach((sg: any) =>
          drawRectBoundary(
            Array.from(sg.contexts || []),
            'subgroup-boundary',
            sg.color,
            DEFAULT_SUBGROUP_COLOR
          )
        );
      }

      function drawMatrix(
        positions: Record<string, any>,
        allEdges: any[],
        contemporaryLinks: any[]
      ) {
        g.selectAll(
          '.context-node-group, .relationship-path, .group-boundary, .subgroup-boundary, .phase-boundary, defs'
        ).remove();
        const defs = g.append('defs');
        defs
          .append('marker')
          .attr('id', 'arrowhead')
          .attr('viewBox', '-2 -5 10 10')
          .attr('refX', 5)
          .attr('refY', 0)
          .attr('markerWidth', 5)
          .attr('markerHeight', 5)
          .attr('orient', 'auto')
          .append('path')
          .attr('d', 'M0,-5L10,0L0,5')
          .style('fill', '#495057');
        defs
          .append('marker')
          .attr('id', 'arrowhead-cuts')
          .attr('viewBox', '-2 -5 10 10')
          .attr('refX', 5)
          .attr('refY', 0)
          .attr('markerWidth', 5)
          .attr('markerHeight', 5)
          .attr('orient', 'auto')
          .append('path')
          .attr('d', 'M0,-5L10,0L0,5')
          .style('fill', 'var(--danger-accent)');
        defs
          .append('marker')
          .attr('id', 'arrowhead-redundant')
          .attr('viewBox', '-2 -5 10 10')
          .attr('refX', 5)
          .attr('refY', 0)
          .attr('markerWidth', 4)
          .attr('markerHeight', 4)
          .attr('orient', 'auto')
          .append('path')
          .attr('d', 'M0,-5L10,0L0,5')
          .style('fill', '#adb5bd');

        drawGroupBoundaries(positions);
        const redundantRelationIndices = findRedundantRelationships();

        const getEdgeClasses = (edge: any) => {
          const isRedundant = redundantRelationIndices.has(edge.originalIndex);
          if (isRedundant) return 'relationship-path redundant';
          const originalRel = relationships[edge.originalIndex];
          if (!originalRel) return 'relationship-path stratigraphic';
          const hasConflict = temporalConflicts.some(
            (c: any) =>
              (c.context1 === originalRel.from && c.context2 === originalRel.to) ||
              (c.context1 === originalRel.to && c.context2 === originalRel.from)
          );
          if (hasConflict) return 'relationship-path temporal-conflict';
          const isCut = ['cuts', 'cut_by'].includes(originalRel.type);
          return `relationship-path ${isCut ? 'cuts' : 'stratigraphic'}`;
        };

        const BOX_HALF_HEIGHT = 22.5,
          BOX_HALF_WIDTH = 45;
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
          g.append('line')
            .attr('class', 'relationship-path contemporary')
            .attr('x1', x1)
            .attr('y1', p1.y - yOffset)
            .attr('x2', x2)
            .attr('y2', p2.y - yOffset);
          g.append('line')
            .attr('class', 'relationship-path contemporary')
            .attr('x1', x1)
            .attr('y1', p1.y + yOffset)
            .attr('x2', x2)
            .attr('y2', p2.y + yOffset);
        });

        // Nodes
        const nodeData = Array.from(contexts.keys()).filter((id) => positions[id]);
        const nodeGroups = g
          .selectAll('.context-node-group')
          .data(nodeData, (d: any) => d)
          .join('g')
          .attr('class', 'context-node-group')
          .attr('transform', (d: any) => `translate(${positions[d].x}, ${positions[d].y})`)
          .call(d3.drag().on('start', dragstarted).on('drag', dragged).on('end', dragended));
        nodeGroups
          .append('rect')
          .attr(
            'class',
            (d: any) =>
              'context-node ' +
              (temporalConflicts.some((c: any) => c.context1 === d || c.context2 === d)
                ? 'temporal-conflict'
                : contexts.get(d)?.phaseId
                  ? 'phased'
                  : contexts.get(d)?.groupId
                    ? 'grouped'
                    : '')
          )
          .attr('x', -BOX_HALF_WIDTH)
          .attr('y', -BOX_HALF_HEIGHT)
          .attr('width', BOX_HALF_WIDTH * 2)
          .attr('height', BOX_HALF_HEIGHT * 2)
          .attr('rx', 8);
        nodeGroups
          .append('text')
          .attr('class', 'context-label')
          .attr('dy', '0.35em')
          .text((d: any) => d);
      }

      // Layout core (matching original HTML implementation)
      // Only create equivalence mappings for groups with >1 member (to mirror original behavior)
      function findEquivalenceGroups() {
        const adj: Map<string, string[]> = new Map(
          Array.from(contexts.keys()).map((id) => [id, []])
        );
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
                if (!visited.has(v)) {
                  visited.add(v);
                  queue.push(v);
                }
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
        if (contextIds.length === 0)
          return {
            levels: new Map(),
            stratigraphicEdges: [],
            contemporaryLinks: [],
            hasCycle: false,
          } as any;
        const { contextToGroupRep } = findEquivalenceGroups();
        const logicalNodes = new Set(contextIds.map((id) => contextToGroupRep.get(id) || id));
        const adj: Map<string, string[]> = new Map(Array.from(logicalNodes).map((id) => [id, []]));
        const inDegree: Map<string, number> = new Map(
          Array.from(logicalNodes).map((id) => [id, 0])
        );
        const stratigraphicEdges: any[] = [];
        const contemporaryLinks: any[] = [];
        (relationships || []).forEach((rel: any, index: number) => {
          let from: string | undefined, to: string | undefined;
          if (['above', 'seals', 'cuts', 'fill_of'].includes(rel.type)) {
            from = rel.to;
            to = rel.from;
          } else if (['below', 'sealed_by', 'cut_by', 'filled_by'].includes(rel.type)) {
            from = rel.from;
            to = rel.to;
          } else if (['contemporary_with', 'equivalent', 'same_as'].includes(rel.type)) {
            contemporaryLinks.push({ from: rel.from, to: rel.to });
          }
          if (from && to && contexts.has(from) && contexts.has(to)) {
            const repFrom = contextToGroupRep.get(from) || from;
            const repTo = contextToGroupRep.get(to) || to;
            if (repFrom !== repTo) {
              if (!adj.get(repFrom)!.includes(repTo)) adj.get(repFrom)!.push(repTo);
              inDegree.set(repTo, (inDegree.get(repTo) || 0) + 1);
            }
            // Always record stratigraphic edge (even if reps equal) like original HTML
            stratigraphicEdges.push({
              from,
              to,
              isCut: ['cuts', 'cut_by'].includes(rel.type),
              originalIndex: index,
            });
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
              dummyNodes.set(dummyId, {
                id: dummyId,
                originalSource: edge.from,
                originalTarget: edge.to,
              });
              levels.set(dummyId, i); // ensure dummy node participates in layering
              allEdges.push({
                from: lastNodeId,
                to: dummyId,
                isCut: edge.isCut,
                originalIndex: edge.originalIndex,
              });
              lastNodeId = dummyId;
            }
            allEdges.push({
              from: lastNodeId,
              to: edge.to,
              isCut: edge.isCut,
              originalIndex: edge.originalIndex,
            });
          } else {
            allEdges.push(edge);
          }
        });
        return { dummyNodes, allEdges };
      }

      function reduceCrossings(
        levels: Map<string, number>,
        allNodes: Map<string, any>,
        allEdges: any[]
      ) {
        const layerMap: Map<number, string[]> = d3.group(
          Array.from(allNodes.keys()),
          (id: string) => levels.get(id) as number
        ) as any;
        const sortedLayers = Array.from(layerMap.keys()).sort((a, b) => a - b);
        let orderedLevels: Map<number, string[]> = new Map(
          sortedLayers.map((l) => [l, layerMap.get(l)!])
        );
        const adj: Map<string, string[]> = new Map(
          Array.from(allNodes.keys()).map((id) => [id, []])
        );
        const revAdj: Map<string, string[]> = new Map(
          Array.from(allNodes.keys()).map((id) => [id, []])
        );
        allEdges.forEach((e) => {
          adj.get(e.from)!.push(e.to);
          revAdj.get(e.to)!.push(e.from);
        });
        for (let iter = 0; iter < 10; iter++) {
          // Downward pass (use predecessors for ordering)
          for (let i = 1; i < sortedLayers.length; i++) {
            const layer = orderedLevels.get(sortedLayers[i])!;
            const prevLayer = orderedLevels.get(sortedLayers[i - 1])!;
            const posInPrev = new Map(prevLayer.map((id, idx) => [id, idx] as [string, number]));
            layer.sort(
              (a, b) =>
                (d3.mean(revAdj.get(a) || [], (n: string) => posInPrev.get(n)) ?? -1) -
                (d3.mean(revAdj.get(b) || [], (n: string) => posInPrev.get(n)) ?? -1)
            );
          }
          // Upward pass (use successors for ordering)
          for (let i = sortedLayers.length - 2; i >= 0; i--) {
            const layer = orderedLevels.get(sortedLayers[i])!;
            const nextLayer = orderedLevels.get(sortedLayers[i + 1])!;
            const posInNext = new Map(nextLayer.map((id, idx) => [id, idx] as [string, number]));
            layer.sort(
              (a, b) =>
                (d3.mean(adj.get(a) || [], (n: string) => posInNext.get(n)) ?? -1) -
                (d3.mean(adj.get(b) || [], (n: string) => posInNext.get(n)) ?? -1)
            );
          }
        }
        return orderedLevels;
      }

      function assignCoordinates(
        orderedLevels: Map<number, string[]>,
        levels: Map<string, number>,
        dummyNodes: Map<string, any>
      ) {
        const positions: Record<string, { x: number; y: number }> = {};
        const ySpacing = 120,
          xSpacing = 150;
        const width = (svg.node() as any).getBoundingClientRect().width;
        const maxLevel = Math.max(0, ...Array.from(orderedLevels.keys()));
        const fixedNodeIds = new Set<string>();
        // Preserve fixed node positions
        contexts.forEach((context: any) => {
          if (context.fixed) {
            positions[context.id] = { x: context.x, y: context.y };
            fixedNodeIds.add(context.id);
          }
        });
        // Interpolate dummy nodes between two fixed endpoints (HTML behavior)
        orderedLevels.forEach((nodes: string[], level: number) => {
          nodes.forEach((id) => {
            const dummyInfo = dummyNodes.get(id);
            if (
              dummyInfo &&
              fixedNodeIds.has(dummyInfo.originalSource) &&
              fixedNodeIds.has(dummyInfo.originalTarget)
            ) {
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
          nodes.forEach((id, i) => {
            positions[id] = { x: startX + i * xSpacing, y: yPos };
          });
        });
        return positions;
      }

      function applyLayoutAndDraw() {
        if (contexts.size === 0) {
          g.selectAll(
            '.context-node-group, .relationship-path, .group-boundary, .subgroup-boundary, .phase-boundary'
          ).remove();
          return;
        }
        // Ensure feature form handlers attached (idempotent call)
        attachFeatureFormHandlers();
        attachSUFormHandlers();
        attachArtefactHandlers();
        const { levels, stratigraphicEdges, contemporaryLinks, hasCycle } =
          calculateInitialLevels();
        if (hasCycle) {
          const cyclicNodeIds = Array.from(contexts.keys()).filter((id) => !levels.has(id));
          alert(
            `ERROR: A cycle was detected in the stratigraphic relationships.\n\nPlease review: ${cyclicNodeIds.join(', ')}`
          );
          return;
        }
        const { dummyNodes, allEdges } = createDummyNodesAndEdges(stratigraphicEdges, levels);
        const allNodes = new Map<string, any>([...contexts, ...dummyNodes]);
        const orderedLevels = reduceCrossings(levels, allNodes, allEdges);
        nodePositions = assignCoordinates(orderedLevels, levels, dummyNodes);
        // Store computed edges for reuse when moving nodes manually
        lastComputedEdges = allEdges;
        lastComputedContemporaryLinks = contemporaryLinks;
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
            const phaseContextIds = Array.from(contexts.values())
              .filter((c: any) => c.phaseId === phase.id)
              .map((c: any) => c.id);
            const hasConflicts = false;
            html += `<div class="hierarchy-item phase ${hasConflicts ? 'temporal-conflict' : ''}" onclick="window.__hm_highlightPhase && window.__hm_highlightPhase('${phase.id}')"><div class="item-header">Phase: ${phase.name}${hasConflicts ? '<span class="conflict-indicator"></span>' : '<span class="valid-indicator"></span>'}</div><div class="item-details">${phase.description || ''}</div><div class="item-contexts">${phaseContextIds.length} contexts</div></div>`;
          });
        }
        if (groups.size > 0) {
          html += '<div style="font-weight: bold; margin: 10px 0;">Groups</div>';
          groups.forEach((group: any) => {
            const color = group.color || DEFAULT_GROUP_COLOR;
            const description = group.description ? escapeHtml(group.description) : '';
            const title = escapeHtml(group.name || 'Untitled Group');
            const contextsCount = (group.contexts && group.contexts.size) || 0;
            html += `
              <div class="hierarchy-item group" data-entity="group" data-id="${group.id}" onclick="window.__hm_showGroupOverlay && window.__hm_showGroupOverlay('group','${group.id}')">
                <div class="item-header">
                  <span class="group-color-chip" style="background:${color}"></span>
                  <span class="item-title">Group: ${title}</span>
                  <button type="button" class="group-more" onclick="window.__hm_editGroupEntity && window.__hm_editGroupEntity(event,'group','${group.id}')" aria-label="Edit group">${dotsIconMarkup}</button>
                </div>
                <div class="item-details">${description}</div>
                <div class="item-contexts">${contextsCount} contexts</div>
              </div>`;
          });
        }
        if (subGroups.size > 0) {
          html += '<div style="font-weight: bold; margin: 10px 0;">Sub-Groups</div>';
          subGroups.forEach((sg: any) => {
            const color = sg.color || DEFAULT_SUBGROUP_COLOR;
            const description = sg.description ? escapeHtml(sg.description) : '';
            const title = escapeHtml(sg.name || 'Untitled Sub-Group');
            const contextsCount = (sg.contexts && sg.contexts.size) || 0;
            html += `
              <div class="hierarchy-item subgroup" data-entity="subgroup" data-id="${sg.id}" onclick="window.__hm_showGroupOverlay && window.__hm_showGroupOverlay('subgroup','${sg.id}')">
                <div class="item-header">
                  <span class="group-color-chip" style="background:${color}"></span>
                  <span class="item-title">Sub-Group: ${title}</span>
                  <button type="button" class="group-more" onclick="window.__hm_editGroupEntity && window.__hm_editGroupEntity(event,'subgroup','${sg.id}')" aria-label="Edit sub-group">${dotsIconMarkup}</button>
                </div>
                <div class="item-details">${description}</div>
                <div class="item-contexts">${contextsCount} contexts</div>
              </div>`;
          });
        }
        const unassigned = Array.from(contexts.values()).filter(
          (c: any) => !c.groupId && !c.phaseId
        );
        if (unassigned.length > 0) {
          html += '<div style="font-weight: bold; margin: 10px 0;">Unassigned Contexts</div>';
          unassigned.forEach((context: any) => {
            const hasConflicts = temporalConflicts.some(
              (c: any) => c.context1 === context.id || c.context2 === context.id
            );
            const contextTitle = `${escapeHtml(context.id)} (${escapeHtml(context.type || 'layer')})`;
            const contextDescription = context.description ? escapeHtml(context.description) : '';
            html += `<div class="hierarchy-item ${hasConflicts ? 'temporal-conflict' : ''}" onclick="window.__hm_highlightContext && window.__hm_highlightContext('${context.id}')"><div class="item-header"><span class="item-title">${contextTitle}</span>${hasConflicts ? '<span class="conflict-indicator"></span>' : ''}</div><div class="item-details">${contextDescription}</div></div>`;
          });
        }
        listDiv.innerHTML = html || '<em>No data yet. Click in the canvas to add contexts.</em>';
      }

      function updateConflictsDisplay() {
        const listDiv = document.getElementById('conflictsList');
        if (!listDiv) return;
        if (temporalConflicts.length === 0) {
          listDiv.innerHTML = '<em>No conflicts detected.</em>';
          return;
        }
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
        if ((relationships || []).length === 0) {
          listDiv.innerHTML = '<em>No relationships defined.</em>';
          return;
        }
        const redundantIndices = findRedundantRelationships();
        let tableHTML = `<table style="width:100%; border-collapse: collapse; font-size: 12px;"><thead><tr><th>From</th><th>Relationship</th><th>To</th><th>Status</th><th></th></tr></thead><tbody>`;
        relationships.forEach((rel: any, index: number) => {
          const conflict = temporalConflicts.find(
            (c: any) =>
              (c.context1 === rel.from && c.context2 === rel.to) ||
              (c.context1 === rel.to && c.context2 === rel.from)
          );
          const isRedundant = redundantIndices.has(index);
          const status = conflict ? '⚠️ Conflict' : isRedundant ? 'ℹ️ Redundant' : '✅ Valid';
          const style = conflict
            ? 'background: #ffebee;'
            : isRedundant
              ? 'background: #f8f9fa; color: #6c757d;'
              : '';
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
            groups.forEach((group: any) => {
              select.innerHTML += `<option value="${group.id}">${group.name}</option>`;
            });
          } else if (id === 'editSubGroupAssignment') {
            select.innerHTML = '<option value="">— None —</option>';
            subGroups.forEach((sg: any) => {
              select.innerHTML += `<option value="${sg.id}">${sg.name}</option>`;
            });
          } else {
            select.innerHTML = '<option value="">— None —</option>';
            phases.forEach((ph: any) => {
              select.innerHTML += `<option value="${ph.id}">${ph.name}</option>`;
            });
          }
          select.value = currentVal;
        });
      }

      function updateRecordsDisplay() {
        const div = document.getElementById('recordsSummary');
        if (!div) return;
        try {
          const totalArtefacts = Object.values(artefactRegistries).reduce(
            (sum: number, arr: any) => sum + (Array.isArray(arr) ? arr.length : 0),
            0
          );
          const cfRows = Array.from(contextForms.values())
            .sort((a: any, b: any) => (a.id || '').localeCompare(b.id || ''))
            .map(
              (rec: any) => `
              <tr>
                <td style=\"border:1px solid #333;padding:4px;\">${rec.id || ''}</td>
                <td style=\"border:1px solid #333;padding:4px;\">${rec.featureNumber || ''}</td>
                <td style=\"border:1px solid #333;padding:4px;\">${rec.sector || ''}</td>
                <td style=\"border:1px solid #333;padding:4px;text-align:center;\">
                  <button style=\"font-size:11px;margin-right:6px;\" onclick=\"window.__hm_openCFRecord && window.__hm_openCFRecord('${(rec.id || '').replace(/\"/g, '&quot;')}')\">Open</button>
                  <button style=\"font-size:11px;background:#922;color:#fff;border:none;padding:2px 6px;\" onclick=\"window.__hm_deleteCFRecord && window.__hm_deleteCFRecord('${(rec.id || '').replace(/\"/g, '&quot;')}')\">Delete</button>
                </td>
              </tr>`
            )
            .join('');
          const suRows = Array.from(stratigraphicUnits.values())
            .sort((a: any, b: any) => (a.id || '').localeCompare(b.id || ''))
            .map(
              (rec: any) => `
              <tr>
                <td style=\"border:1px solid #333;padding:4px;\">${rec.id || ''}</td>
                <td style=\"border:1px solid #333;padding:4px;\">${rec.unitType || ''}</td>
                <td style=\"border:1px solid #333;padding:4px;\">${rec.sector || ''}</td>
                <td style=\"border:1px solid #333;padding:4px;text-align:center;\">
                  <button style=\"font-size:11px;margin-right:6px;\" onclick=\"window.__hm_openSURecord && window.__hm_openSURecord('${(rec.id || '').replace(/\"/g, '&quot;')}')\">Open</button>
                  <button style=\"font-size:11px;background:#922;color:#fff;border:none;padding:2px 6px;\" onclick=\"window.__hm_deleteSURecord && window.__hm_deleteSURecord('${(rec.id || '').replace(/\"/g, '&quot;')}')\">Delete</button>
                </td>
              </tr>`
            )
            .join('');

          // Artefact entries across all categories
          const artefactFlat: {
            id: string;
            category: string;
            number?: string;
            type?: string;
            su?: string;
            feature?: string;
            qty?: number;
          }[] = [];
          (Object.entries(artefactRegistries) as any).forEach(([cat, arr]: [string, any[]]) => {
            (arr || []).forEach((r: any) =>
              artefactFlat.push({
                id: r.id,
                category: cat,
                number: r.number,
                type: r.type,
                su: r.stratigraphicUnit,
                feature: r.complexFeature,
                qty: r.quantity,
              })
            );
          });
          artefactFlat.sort(
            (a, b) =>
              a.category.localeCompare(b.category) || (a.number || '').localeCompare(b.number || '')
          );
          const afRows = artefactFlat
            .map(
              (r) => `
            <tr>
              <td style=\"border:1px solid #333;padding:4px;\">${(r.category || '').replace(/_/g, ' ')}</td>
              <td style=\"border:1px solid #333;padding:4px;\">${r.number || ''}</td>
              <td style=\"border:1px solid #333;padding:4px;\">${r.type || ''}</td>
              <td style=\"border:1px solid #333;padding:4px;\">${r.su || ''}</td>
              <td style=\"border:1px solid #333;padding:4px;\">${r.feature || ''}</td>
              <td style=\"border:1px solid #333;padding:4px; text-align:right;\">${r.qty != null ? r.qty : ''}</td>
              <td style=\"border:1px solid #333;padding:4px; text-align:center;\">\
                <button style=\"font-size:11px;margin-right:6px;\" onclick=\"window.__hm_openArtefact && window.__hm_openArtefact('${r.id}')\">Open</button>\
                <button style=\"font-size:11px;background:#922;color:#fff;border:none;padding:2px 6px;\" onclick=\"window.__hm_deleteArtefact && window.__hm_deleteArtefact('${r.id}')\">Delete</button>\
              </td>
            </tr>`
            )
            .join('');

          div.innerHTML = `
            <ul>
              <li>Context feature forms: <strong>${Array.from(contextForms.keys()).length}</strong></li>
              <li>Stratigraphic unit forms: <strong>${Array.from(stratigraphicUnits.keys()).length}</strong></li>
              <li>Artefact registries: <strong>${totalArtefacts}</strong></li>
            </ul>
            <div style=\"margin-top:10px;\">
              <h4 style=\"margin:6px 0;\">Context Feature Forms</h4>
              ${cfRows ? `<table style=\\\"width:100%;border-collapse:collapse;font-size:12px;\\\"><thead><tr><th>ID</th><th>Feature</th><th>Sector</th><th>Actions</th></tr></thead><tbody>${cfRows}</tbody></table>` : '<div style=\"font-size:12px;color:var(--muted,#adb5bd);\">No context feature forms yet.</div>'}
            </div>
            <div style=\"margin-top:10px;\">
              <h4 style=\"margin:6px 0;\">Stratigraphic Unit Forms</h4>
              ${suRows ? `<table style=\\\"width:100%;border-collapse:collapse;font-size:12px;\\\"><thead><tr><th>ID</th><th>Type</th><th>Sector</th><th>Actions</th></tr></thead><tbody>${suRows}</tbody></table>` : '<div style=\"font-size:12px;color:var(--muted,#adb5bd);\">No stratigraphic unit forms yet.</div>'}
            </div>
            <div style=\"margin-top:10px;\">
              <h4 style=\"margin:6px 0;\">Artefact Registry Entries</h4>
              ${afRows ? `<table style=\\\"width:100%;border-collapse:collapse;font-size:12px;\\\"><thead><tr><th>Category</th><th>No.</th><th>Type</th><th>SU</th><th>Feature</th><th style=\\\"text-align:right;\\\">Qty</th><th>Actions</th></tr></thead><tbody>${afRows}</tbody></table>` : '<div style=\"font-size:12px;color:var(--muted,#adb5bd);\">No artefacts recorded yet.</div>'}
            </div>
          `;
        } catch {}
      }

      // Flag to force a full auto-layout (clearing manual fixed positions) after structural changes
      let forceAutoLayoutNext = false;
      // Store last computed edges to redraw after manual node movements
      let lastComputedEdges: any[] = [];
      let lastComputedContemporaryLinks: any[] = [];

      function updateUI() {
        updateHierarchyDisplay();
        updateConflictsDisplay();
        updateRelationshipsDisplay();
        updateDropdownOptions();
        updateRecordsDisplay();
        // If structural changes occurred (new context / relationship add/remove / delete / rename), clear fixed positions
        if (forceAutoLayoutNext) {
          contexts.forEach((c: any) => {
            c.fixed = false;
          });
          forceAutoLayoutNext = false;
        }
        applyLayoutAndDraw();
        // Expose helpers for opening records into forms
        (window as any).__hm_openCFRecord = (id: string) => {
          const rec = contextForms.get(id);
          if (!rec) return;
          populateContextFeatureFormFromRecord(rec);
          setSidebarView('featureForm');
        };
        (window as any).__hm_openSURecord = (id: string) => {
          const rec = stratigraphicUnits.get(id);
          if (!rec) return;
          populateSUFormFromRecord(rec);
          setSidebarView('suForm');
        };
        (window as any).__hm_deleteCFRecord = (id: string) => {
          if (!contextForms.has(id)) return;
          if (!confirm('Delete context feature form?')) return;
          contextForms.delete(id);
          saveToStorage();
          updateRecordsDisplay();
        };
        (window as any).__hm_deleteSURecord = (id: string) => {
          if (!stratigraphicUnits.has(id)) return;
          if (!confirm('Delete stratigraphic unit form?')) return;
          stratigraphicUnits.delete(id);
          saveToStorage();
          updateRecordsDisplay();
        };
        (window as any).__hm_openArtefact = (id: string) => {
          let found: any = null;
          let category: string | null = null;
          (Object.entries(artefactRegistries) as any).forEach(([cat, arr]: [string, any[]]) => {
            if (found) return;
            const x = (arr || []).find((r: any) => r.id === id);
            if (x) {
              found = x;
              category = cat;
            }
          });
          setSidebarView('artefacts');
          if (found) {
            setInputValue(
              'af_filterText',
              found.number || found.type || found.stratigraphicUnit || ''
            );
            if (category) setInputValue('af_filterCategory', category);
          }
          if (apiRef.current?.refreshArtefactTable) apiRef.current.refreshArtefactTable();
        };
        (window as any).__hm_deleteArtefact = (id: string) => {
          let removed = false;
          (Object.entries(artefactRegistries) as any).forEach(([cat, arr]: [string, any[]]) => {
            if (removed) return;
            const idx = (arr || []).findIndex((r: any) => r.id === id);
            if (idx >= 0) {
              arr.splice(idx, 1);
              removed = true;
            }
          });
          if (removed) {
            saveToStorage();
            updateRecordsDisplay();
            if (apiRef.current?.refreshArtefactTable) apiRef.current.refreshArtefactTable();
          }
        };
        setOverlayData((current) => {
          if (!current) return current;
          const source =
            current.type === 'group' ? groups.get(current.id) : subGroups.get(current.id);
          if (!source) return null;
          const color =
            source.color ||
            (current.type === 'group' ? DEFAULT_GROUP_COLOR : DEFAULT_SUBGROUP_COLOR);
          const contextIds = Array.from(source.contexts || []) as string[];
          const contextsPayload: GroupOverlayContext[] = contextIds
            .map((ctxId) => contexts.get(ctxId))
            .filter(Boolean)
            .map((ctx: any) => ({
              id: ctx.id,
              label: ctx.id,
              type: ctx.type,
              description: ctx.description,
            }));
          return {
            ...current,
            name: source.name,
            description: source.description,
            color,
            contexts: contextsPayload,
          };
        });
        saveToStorage();
      }

      // Event Handlers & Modals
      let wasDragged = false;
      function handleCanvasClick(event: any) {
        if (!canEditRef.current) return; // Guests cannot add nodes
        if ((event?.target as Element)?.closest('.context-node-group')) return;
        const [x, y] = d3.pointer(event, g.node());
        const snappedX = Math.round(x / GRID_CELL_SIZE) * GRID_CELL_SIZE;
        const snappedY = Math.round(y / GRID_CELL_SIZE) * GRID_CELL_SIZE;
        showContextModal(snappedX, snappedY);
      }
      function dragstarted(this: any, event: any) {
        if (!canEditRef.current) return; // Guests cannot drag
        event.sourceEvent.stopPropagation();
        d3.select(this).raise().classed('dragging', true);
        wasDragged = false;
      }
      function dragged(this: any, event: any) {
        if (!canEditRef.current) return; // Guests cannot drag
        wasDragged = true;
        d3.select(this).attr('transform', `translate(${event.x}, ${event.y})`);
      }
      function dragended(this: any, event: any, d: any) {
        if (!canEditRef.current) return; // Guests cannot drag
        d3.select(this).classed('dragging', false);
        if (wasDragged) {
          const sourceId = d;
          let targetId: string | null = null;
          for (const [id] of contexts.entries()) {
            if (id === sourceId) continue;
            const p = nodePositions[id];
            if (!p) continue;
            const dx = Math.abs(event.x - p.x),
              dy = Math.abs(event.y - p.y);
            if (dx <= GRID_CELL_SIZE / 2 && dy <= GRID_CELL_SIZE / 2) {
              targetId = id;
              break;
            }
          }
          if (targetId) {
            showRelationshipModal(sourceId, targetId);
          } else {
            const ctx = contexts.get(sourceId);
            if (ctx) {
              ctx.x = Math.round(event.x / GRID_CELL_SIZE) * GRID_CELL_SIZE;
              ctx.y = Math.round(event.y / GRID_CELL_SIZE) * GRID_CELL_SIZE;
              ctx.fixed = true;
              // Update node position in the positions record
              nodePositions[sourceId] = { x: ctx.x, y: ctx.y };
            }
            // Only save and redraw with existing edges without restructuring
            saveToStorage();
            drawMatrix(nodePositions, lastComputedEdges, lastComputedContemporaryLinks);
          }
        } else {
          showEditNodeModal(d);
        }
      }

      function hideModals() {
        document
          .querySelectorAll('.modal-backdrop')
          .forEach((m) => ((m as HTMLElement).style.display = 'none'));
      }

      // Feature form helpers
      function readInputValue(id: string): string {
        return (document.getElementById(id) as HTMLInputElement | null)?.value || '';
      }
      function readCheckbox(id: string): boolean {
        return (document.getElementById(id) as HTMLInputElement | null)?.checked || false;
      }

      function setInputValue(id: string, value: string) {
        const el = document.getElementById(id) as
          | HTMLInputElement
          | HTMLTextAreaElement
          | HTMLSelectElement
          | null;
        if (el) (el as any).value = value ?? '';
      }
      function setCheckbox(id: string, checked: boolean) {
        const el = document.getElementById(id) as HTMLInputElement | null;
        if (el) el.checked = !!checked;
      }

      function populateContextFeatureFormFromRecord(rec: ContextFeatureRecord) {
        setInputValue('cf_id', rec.id || '');
        setInputValue('cf_featureNumber', rec.featureNumber || '');
        setInputValue('cf_sector', rec.sector || '');
        setInputValue('cf_earlierThan', (rec.earlierThan || []).join(','));
        setInputValue('cf_laterThan', (rec.laterThan || []).join(','));
        const dims = rec.dimensions || ({} as any);
        setInputValue('cf_length', dims.length != null ? String(dims.length) : '');
        setInputValue('cf_width', dims.width != null ? String(dims.width) : '');
        setInputValue('cf_depth', dims.depth != null ? String(dims.depth) : '');
        const coords = rec.coordinates || ({} as any);
        setInputValue('cf_x', coords.x != null ? String(coords.x) : '');
        setInputValue('cf_y', coords.y != null ? String(coords.y) : '');
        setInputValue('cf_z', coords.zMasl != null ? String(coords.zMasl) : '');
        setInputValue('cf_featureType', (rec.featureType as any) || '');
        setInputValue('cf_location', rec.location || '');
        setInputValue('cf_shape', (rec.shape as any) || '');
        setInputValue('cf_orientation', rec.orientation || '');
        setInputValue('cf_description', rec.description || '');
        const finds = (rec.findsPresent || {}) as any;
        [
          'pottery',
          'metal',
          'flint',
          'stone',
          'wood',
          'charcoal',
          'shell',
          'snail',
          'ash',
          'adobe',
          'beads',
          'pendant',
          'ring',
          'seed',
          'animalBones',
          'humanBones',
          'other',
        ].forEach((k) => setCheckbox(`cf_find_${k}`, !!finds[k]));
        const docs = (rec.documentation || {}) as any;
        ['drawing', 'plan', 'photogrammetry', 'photos', 'video'].forEach((k) =>
          setCheckbox(`cf_doc_${k}`, !!docs[k])
        );
        setInputValue('cf_planNumber', docs.planNumber || '');
        const samp = (rec.samples || {}) as any;
        ['environmental', 'aDNA', 'c14', 'isotopic', 'other'].forEach((k) =>
          setCheckbox(`cf_samp_${k}`, !!samp[k])
        );
        setInputValue('cf_sampleBag', (samp.bagNo as any) || '');
        setInputValue('cf_sampleQty', samp.quantity != null ? String(samp.quantity) : '');
        setInputValue('cf_sampleOtherType', (samp.otherType as any) || '');
        setInputValue('cf_author', rec.author || '');
        setInputValue('cf_dateCreated', rec.dateCreated || '');
        setInputValue('cf_checkedBy', rec.checkedBy || '');
        setInputValue('cf_dateChecked', rec.dateChecked || '');
      }

      function populateSUFormFromRecord(rec: StratigraphicUnitRecord) {
        setInputValue('su_id', rec.id || '');
        setInputValue('su_sector', rec.sector || '');
        setInputValue('su_complexFeatureNo', rec.complexFeatureNo || '');
        setInputValue('su_unitType', (rec.unitType as any) || '');
        setInputValue('su_earlierThan', (rec.earlierThan || []).join(','));
        setInputValue('su_laterThan', (rec.laterThan || []).join(','));
        setInputValue('su_location', rec.location || '');
        const dims = rec.dimensions || ({} as any);
        setInputValue('su_length', dims.length != null ? String(dims.length) : '');
        setInputValue('su_thickness', dims.thickness != null ? String(dims.thickness) : '');
        setInputValue('su_depth', dims.depth != null ? String(dims.depth) : '');
        setInputValue('su_areaSurface', dims.areaSurface != null ? String(dims.areaSurface) : '');
        setInputValue('su_orientation', rec.orientation || '');
        const structure = (rec.structure || {}) as any;
        setInputValue('su_colour', (structure.colour as any) || '');
        setInputValue('su_munsell', (structure.munsellCode as any) || '');
        setInputValue('su_compaction', (structure.compaction as any) || '');
        setCheckbox('su_homogeneous', !!structure.homogeneous);
        setCheckbox('su_heterogeneous', !!structure.heterogeneous);
        const comp = (rec.composition || {}) as any;
        [
          'pottery',
          'flint',
          'stone',
          'wood',
          'charcoal',
          'shell',
          'snail',
          'ash',
          'adobe',
          'metal',
          'organic',
          'mineral',
          'gravels',
          'silt',
          'sand',
          'argil',
          'loess',
          'mud',
          'other',
        ].forEach((k) => setCheckbox(`su_comp_${k}`, !!comp[k]));
        setInputValue('su_granulation', (rec.granulation as any) || '');
        setInputValue('su_contamination', (rec.contaminationRisk as any) || '');
        setCheckbox('su_bones', !!rec.bones);
        setCheckbox('su_seed', !!rec.seed);
        const docs = (rec.documentation || {}) as any;
        ['drawing', 'plan', 'photogrammetry', 'samples', 'photos', 'video'].forEach((k) =>
          setCheckbox(`su_doc_${k}`, !!docs[k])
        );
        setInputValue('su_planNumber', (docs.planNumber as any) || '');
        setInputValue('su_description', rec.description || '');
        setInputValue('su_author', rec.author || '');
        setInputValue('su_dateCreated', rec.dateCreated || '');
        setInputValue('su_checkedBy', rec.checkedBy || '');
        setInputValue('su_dateChecked', rec.dateChecked || '');
      }
      function attachFeatureFormHandlers() {
        const saveBtn = document.getElementById('cf_saveBtn') as HTMLButtonElement | null;
        const clearBtn = document.getElementById('cf_clearBtn') as HTMLButtonElement | null;
        if (saveBtn)
          saveBtn.onclick = async () => {
            if (!canEditRef.current) {
              alert('You do not have permission to save records.');
              return;
            }
            const id = readInputValue('cf_id').trim().toUpperCase();
            if (!id) {
              alert('Context ID is required for saving the feature record.');
              return;
            }
            // Gather record
            const earlierThan = readInputValue('cf_earlierThan')
              .split(',')
              .map((s) => s.trim().toUpperCase())
              .filter(Boolean);
            const laterThan = readInputValue('cf_laterThan')
              .split(',')
              .map((s) => s.trim().toUpperCase())
              .filter(Boolean);
            const rec: ContextFeatureRecord = {
              id,
              featureNumber: readInputValue('cf_featureNumber'),
              sector: readInputValue('cf_sector'),
              earlierThan,
              laterThan,
              featureType: (document.getElementById('cf_featureType') as HTMLSelectElement | null)
                ?.value as any,
              location: readInputValue('cf_location'),
              dimensions: {
                length: parseFloat(readInputValue('cf_length')) || undefined,
                width: parseFloat(readInputValue('cf_width')) || undefined,
                depth: parseFloat(readInputValue('cf_depth')) || undefined,
              },
              coordinates: {
                x: parseFloat(readInputValue('cf_x')) || undefined,
                y: parseFloat(readInputValue('cf_y')) || undefined,
                zMasl: parseFloat(readInputValue('cf_z')) || undefined,
              },
              shape: (document.getElementById('cf_shape') as HTMLSelectElement | null)
                ?.value as any,
              orientation: readInputValue('cf_orientation'),
              findsPresent: {
                pottery: readCheckbox('cf_find_pottery'),
                metal: readCheckbox('cf_find_metal'),
                flint: readCheckbox('cf_find_flint'),
                stone: readCheckbox('cf_find_stone'),
                wood: readCheckbox('cf_find_wood'),
                charcoal: readCheckbox('cf_find_charcoal'),
                shell: readCheckbox('cf_find_shell'),
                snail: readCheckbox('cf_find_snail'),
                ash: readCheckbox('cf_find_ash'),
                adobe: readCheckbox('cf_find_adobe'),
                beads: readCheckbox('cf_find_beads'),
                pendant: readCheckbox('cf_find_pendant'),
                ring: readCheckbox('cf_find_ring'),
                seed: readCheckbox('cf_find_seed'),
                animalBones: readCheckbox('cf_find_animalBones'),
                humanBones: readCheckbox('cf_find_humanBones'),
                other: readCheckbox('cf_find_other'),
              },
              description:
                (document.getElementById('cf_description') as HTMLTextAreaElement | null)?.value ||
                '',
              documentation: {
                drawing: readCheckbox('cf_doc_drawing'),
                plan: readCheckbox('cf_doc_plan'),
                photogrammetry: readCheckbox('cf_doc_photogrammetry'),
                photos: readCheckbox('cf_doc_photos'),
                video: readCheckbox('cf_doc_video'),
                planNumber: readInputValue('cf_planNumber'),
              },
              samples: {
                environmental: readCheckbox('cf_samp_environmental'),
                aDNA: readCheckbox('cf_samp_aDNA'),
                c14: readCheckbox('cf_samp_c14'),
                isotopic: readCheckbox('cf_samp_isotopic'),
                other: readCheckbox('cf_samp_other'),
                otherType: readInputValue('cf_sampleOtherType'),
                bagNo: readInputValue('cf_sampleBag'),
                quantity: parseInt(readInputValue('cf_sampleQty')) || undefined,
              },
              author: readInputValue('cf_author'),
              dateCreated: readInputValue('cf_dateCreated'),
              checkedBy: readInputValue('cf_checkedBy'),
              dateChecked: readInputValue('cf_dateChecked'),
            };
            contextForms.set(id, rec);
            saveToStorage();
            updateRecordsDisplay();
            // Persist to backend CSV (best-effort)
            try {
              await formsService.saveContextFeature(projectId, rec as any);
            } catch (e) {
              /* network errors ignored for now */
            }
            alert('Context feature record saved.');
          };
        if (clearBtn)
          clearBtn.onclick = () => {
            [
              'cf_featureNumber',
              'cf_sector',
              'cf_earlierThan',
              'cf_laterThan',
              'cf_location',
              'cf_length',
              'cf_width',
              'cf_depth',
              'cf_x',
              'cf_y',
              'cf_z',
              'cf_orientation',
              'cf_description',
              'cf_planNumber',
              'cf_sampleOtherType',
              'cf_sampleBag',
              'cf_sampleQty',
              'cf_author',
              'cf_dateCreated',
              'cf_checkedBy',
              'cf_dateChecked',
            ].forEach((id) => {
              const el = document.getElementById(id) as
                | HTMLInputElement
                | HTMLTextAreaElement
                | null;
              if (el) (el as any).value = '';
            });
            ['drawing', 'plan', 'photogrammetry', 'photos', 'video'].forEach((k) => {
              const el = document.getElementById(`cf_doc_${k}`) as HTMLInputElement | null;
              if (el) el.checked = false;
            });
            ['environmental', 'aDNA', 'c14', 'isotopic', 'other'].forEach((k) => {
              const el = document.getElementById(`cf_samp_${k}`) as HTMLInputElement | null;
              if (el) el.checked = false;
            });
            [
              'pottery',
              'metal',
              'flint',
              'stone',
              'wood',
              'charcoal',
              'shell',
              'snail',
              'ash',
              'adobe',
              'beads',
              'pendant',
              'ring',
              'seed',
              'animalBones',
              'humanBones',
              'other',
            ].forEach((k) => {
              const el = document.getElementById(`cf_find_${k}`) as HTMLInputElement | null;
              if (el) el.checked = false;
            });
            (document.getElementById('cf_featureType') as HTMLSelectElement | null)
              ?.selectedIndex &&
              ((document.getElementById('cf_featureType') as HTMLSelectElement).selectedIndex = 0);
            (document.getElementById('cf_shape') as HTMLSelectElement | null)?.selectedIndex &&
              ((document.getElementById('cf_shape') as HTMLSelectElement).selectedIndex = 0);
          };
      }

      // SU form handlers
      function attachSUFormHandlers() {
        const saveBtn = document.getElementById('su_saveBtn') as HTMLButtonElement | null;
        const clearBtn = document.getElementById('su_clearBtn') as HTMLButtonElement | null;
        if (saveBtn)
          saveBtn.onclick = async () => {
            if (!canEditRef.current) {
              alert('You do not have permission to save records.');
              return;
            }
            const id = readInputValue('su_id').trim();
            if (!id) {
              alert('SU ID is required.');
              return;
            }
            const earlierThan = readInputValue('su_earlierThan')
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
            const laterThan = readInputValue('su_laterThan')
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
            const rec: StratigraphicUnitRecord = {
              id,
              sector: readInputValue('su_sector'),
              complexFeatureNo: readInputValue('su_complexFeatureNo'),
              earlierThan,
              laterThan,
              unitType: (document.getElementById('su_unitType') as HTMLSelectElement | null)
                ?.value as any,
              location: readInputValue('su_location'),
              dimensions: {
                length: parseFloat(readInputValue('su_length')) || undefined,
                thickness: parseFloat(readInputValue('su_thickness')) || undefined,
                depth: parseFloat(readInputValue('su_depth')) || undefined,
                areaSurface: parseFloat(readInputValue('su_areaSurface')) || undefined,
              },
              orientation: readInputValue('su_orientation'),
              structure: {
                compaction: (document.getElementById('su_compaction') as HTMLSelectElement | null)
                  ?.value as any,
                colour: readInputValue('su_colour'),
                munsellCode: readInputValue('su_munsell'),
                homogeneous: readCheckbox('su_homogeneous'),
                heterogeneous: readCheckbox('su_heterogeneous'),
              },
              composition: (() => {
                const obj: any = {};
                [
                  'pottery',
                  'flint',
                  'stone',
                  'wood',
                  'charcoal',
                  'shell',
                  'snail',
                  'ash',
                  'adobe',
                  'metal',
                  'organic',
                  'mineral',
                  'gravels',
                  'silt',
                  'sand',
                  'argil',
                  'loess',
                  'mud',
                  'other',
                ].forEach((k) => {
                  obj[k] = readCheckbox(`su_comp_${k}`);
                });
                return obj;
              })(),
              granulation: (document.getElementById('su_granulation') as HTMLSelectElement | null)
                ?.value as any,
              contaminationRisk: (
                document.getElementById('su_contamination') as HTMLSelectElement | null
              )?.value as any,
              bones: readCheckbox('su_bones'),
              seed: readCheckbox('su_seed'),
              perturbation: (() => {
                const obj: any = {};
                ['natural', 'anthropic', 'burrow', 'roots', 'other'].forEach((k) => {
                  obj[k] = readCheckbox(`su_pert_${k}`);
                });
                obj.otherType = readInputValue('su_pert_otherType');
                return obj;
              })(),
              description:
                (document.getElementById('su_description') as HTMLTextAreaElement | null)?.value ||
                '',
              documentation: (() => {
                const obj: any = {};
                ['drawing', 'plan', 'photogrammetry', 'samples', 'photos', 'video'].forEach((k) => {
                  obj[k] = readCheckbox(`su_doc_${k}`);
                });
                obj.planNumber = readInputValue('su_planNumber');
                return obj;
              })(),
              author: readInputValue('su_author'),
              dateCreated: readInputValue('su_dateCreated'),
              checkedBy: readInputValue('su_checkedBy'),
              dateChecked: readInputValue('su_dateChecked'),
            };
            stratigraphicUnits.set(id, rec);
            saveToStorage();
            updateRecordsDisplay();
            try {
              await formsService.saveStratigraphicUnit(projectId, rec as any);
            } catch (e) {
              /* ignore */
            }
            alert('SU record saved.');
          };
        if (clearBtn)
          clearBtn.onclick = () => {
            [
              'su_id',
              'su_sector',
              'su_complexFeatureNo',
              'su_earlierThan',
              'su_laterThan',
              'su_location',
              'su_length',
              'su_thickness',
              'su_depth',
              'su_areaSurface',
              'su_orientation',
              'su_colour',
              'su_munsell',
              'su_description',
              'su_planNumber',
              'su_author',
              'su_dateCreated',
              'su_checkedBy',
              'su_dateChecked',
              'su_pert_otherType',
            ].forEach((id) => {
              const el = document.getElementById(id) as any;
              if (el) el.value = '';
            });
            ['su_unitType', 'su_compaction', 'su_granulation', 'su_contamination'].forEach((id) => {
              const el = document.getElementById(id) as HTMLSelectElement | null;
              if (el) el.selectedIndex = 0;
            });
            ['su_homogeneous', 'su_heterogeneous', 'su_bones', 'su_seed'].forEach((id) => {
              const el = document.getElementById(id) as HTMLInputElement | null;
              if (el) el.checked = false;
            });
            [
              'pottery',
              'flint',
              'stone',
              'wood',
              'charcoal',
              'shell',
              'snail',
              'ash',
              'adobe',
              'metal',
              'organic',
              'mineral',
              'gravels',
              'silt',
              'sand',
              'argil',
              'loess',
              'mud',
              'other',
            ].forEach((k) => {
              const el = document.getElementById(`su_comp_${k}`) as HTMLInputElement | null;
              if (el) el.checked = false;
            });
            ['natural', 'anthropic', 'burrow', 'roots', 'other'].forEach((k) => {
              const el = document.getElementById(`su_pert_${k}`) as HTMLInputElement | null;
              if (el) el.checked = false;
            });
            ['drawing', 'plan', 'photogrammetry', 'samples', 'photos', 'video'].forEach((k) => {
              const el = document.getElementById(`su_doc_${k}`) as HTMLInputElement | null;
              if (el) el.checked = false;
            });
          };
      }

      // Artefact registry handlers
      function attachArtefactHandlers() {
        const addBtn = document.getElementById('af_addBtn') as HTMLButtonElement | null;
        if (addBtn)
          addBtn.onclick = async () => {
            const category = (document.getElementById('af_category') as HTMLSelectElement | null)
              ?.value as keyof ArtefactRegistries;
            const record: Omit<ArtefactRecord, 'id' | 'category'> = {
              number: readInputValue('af_number'),
              type: readInputValue('af_type'),
              complexFeature: readInputValue('af_feature'),
              areaSurface: readInputValue('af_area'),
              gridSquare: readInputValue('af_grid'),
              depth: readInputValue('af_depth'),
              stratigraphicUnit: readInputValue('af_su'),
              quantity: parseInt(readInputValue('af_qty')) || undefined,
              otherObservations: readInputValue('af_obs'),
            };
            if (!category) {
              alert('Select a category.');
              return;
            }
            // Basic validation for required fields
            let invalid = false;
            (['af_number', 'af_type'] as const).forEach((id) => {
              const el = document.getElementById(id) as HTMLInputElement | null;
              if (el && !el.value.trim()) {
                el.style.borderColor = 'red';
                invalid = true;
              } else if (el) {
                el.style.borderColor = '';
              }
            });
            if (invalid) {
              alert('Please fill required fields: Number and Type.');
              return;
            }
            addArtefact(category, record);
            renderArtefactTable();
            try {
              await formsService.saveArtefact(projectId, { category, ...record } as any);
            } catch (e) {
              /* ignore */
            }
          };
        renderArtefactTable();
      }
      function renderArtefactTable() {
        const container = document.getElementById('af_table');
        if (!container) return;
        const filterText =
          (
            document.getElementById('af_filterText') as HTMLInputElement | null
          )?.value.toLowerCase() || '';
        const filterCategory =
          (document.getElementById('af_filterCategory') as HTMLSelectElement | null)?.value || '';
        const rows: string[] = [];
        Object.entries(artefactRegistries).forEach(([cat, arr]) => {
          if (arr.length === 0) return;
          if (filterCategory && filterCategory !== cat) return;
          const filtered = arr.filter((r: any) => {
            if (!filterText) return true;
            const hay =
              `${r.number} ${r.type} ${r.stratigraphicUnit} ${r.complexFeature} ${r.otherObservations}`.toLowerCase();
            return hay.includes(filterText);
          });
          if (filtered.length === 0) return;
          rows.push(
            `<tr><th colspan="10" style="text-align:left; background:#1f1f1f">${cat.replace(/_/g, ' ').toUpperCase()} (${arr.length})</th></tr>`
          );
          filtered.forEach((r: any) => {
            rows.push(
              `<tr><td>${r.number || ''}</td><td>${r.type || ''}</td><td>${r.complexFeature || ''}</td><td>${r.areaSurface || ''}</td><td>${r.gridSquare || ''}</td><td>${r.depth || ''}</td><td>${r.stratigraphicUnit || ''}</td><td>${r.quantity || ''}</td><td>${(r.otherObservations || '').slice(0, 40)}</td><td><button data-del="${r.id}" class="af-del-btn" style="background:#922; color:#fff; border:none; padding:2px 6px; cursor:pointer; font-size:11px;">✕</button></td></tr>`
            );
          });
        });
        container.innerHTML = rows.length
          ? `<table class="registry-table"><thead><tr><th>No.</th><th>Type</th><th>Feature</th><th>Area</th><th>Grid</th><th>Depth</th><th>SU</th><th>Qty</th><th>Observations</th><th>Del</th></tr></thead><tbody>${rows.join('')}</tbody></table>`
          : '<em>No artefacts recorded yet.</em>';
        // Bind delete buttons
        container.querySelectorAll('button.af-del-btn').forEach((btn) => {
          btn.addEventListener('click', (e: any) => {
            const id = e.currentTarget.getAttribute('data-del');
            if (!id) return;
            if (!confirm('Delete artefact entry?')) return;
            deleteArtefact(id);
            renderArtefactTable();
          });
        });
      }

      function suggestNextContextId() {
        if (contexts.size === 0) return '1001';
        const numbers = Array.from(contexts.keys())
          .map((id) => parseInt(id.match(/\d+$/)?.[0] || ''))
          .filter((n) => !isNaN(n));
        return numbers.length > 0
          ? String(Math.max(...numbers) + 1)
          : String(1000 + contexts.size + 1);
      }

      function parseDateFromInputs(year: number, era: string) {
        if (isNaN(year) || year <= 0) return null;
        return era === 'BCE' ? -year : year;
      }
      function formatDateForDisplay(internalYear: number | null) {
        if (internalYear === null || internalYear === 0) return { year: '', era: 'CE' };
        return internalYear < 0
          ? { year: Math.abs(internalYear), era: 'BCE' }
          : { year: internalYear, era: 'CE' };
      }

      function showContextModal(x: number, y: number) {
        if (!canEditRef.current) return; // Guests cannot create contexts
        const modal = document.getElementById('contextModal') as HTMLElement | null;
        if (!modal) return;
        modal.style.display = 'flex';
        const input = document.getElementById('newContextId') as HTMLInputElement;
        const earliestYear = document.getElementById('earliestDateYear') as HTMLInputElement;
        const latestYear = document.getElementById('latestDateYear') as HTMLInputElement;
        const desc = document.getElementById('contextDescription') as HTMLTextAreaElement;
        const dateType = document.getElementById('dateType') as HTMLSelectElement;
        input.value = suggestNextContextId();
        earliestYear.value = '';
        latestYear.value = '';
        desc.value = '';
        dateType.value = '';
        input.focus();
        (document.getElementById('confirmContextBtn') as HTMLButtonElement).onclick = () => {
          const id = (document.getElementById('newContextId') as HTMLInputElement).value
            .trim()
            .toUpperCase();
          if (!id || contexts.has(id)) {
            alert(`Context "${id}" is invalid or already exists.`);
            return;
          }
          const context: any = {
            id,
            x,
            y,
            fixed: true,
            type: (document.getElementById('contextType') as HTMLSelectElement).value,
            description: desc.value.trim(),
          };
          const eYear = parseInt(
            (document.getElementById('earliestDateYear') as HTMLInputElement).value
          );
          const eEra = (document.getElementById('earliestDateEra') as HTMLSelectElement).value;
          const lYear = parseInt(
            (document.getElementById('latestDateYear') as HTMLInputElement).value
          );
          const lEra = (document.getElementById('latestDateEra') as HTMLSelectElement).value;
          context.earliestDate = parseDateFromInputs(eYear, eEra);
          context.latestDate = parseDateFromInputs(lYear, lEra);
          context.dateType = dateType.value;
          contexts.set(id, context);
          // Initialize digitized feature record skeleton for extended dataset
          contextForms.set(id, { id, description: context.description });
          // New context triggers full rearrangement
          forceAutoLayoutNext = true;
          hideModals();
          updateUI();
        };
      }

      function showEditNodeModal(contextId: string) {
        if (!canEditRef.current) return; // Guests cannot edit contexts
        const modal = document.getElementById('editNodeModal') as HTMLElement | null;
        if (!modal) return;
        modal.style.display = 'flex';
        const context = contexts.get(contextId);
        (document.getElementById('editNodeModalTitle') as HTMLElement).innerText =
          `Edit Context: ${contextId}`;
        (document.getElementById('editNodeIdInput') as HTMLInputElement).value = contextId;
        (document.getElementById('editContextType') as HTMLSelectElement).value =
          context.type || 'layer';
        (document.getElementById('editContextDescription') as HTMLTextAreaElement).value =
          context.description || '';
        const earliestDisplay = formatDateForDisplay(context.earliestDate);
        (document.getElementById('editEarliestDateYear') as HTMLInputElement).value = String(
          earliestDisplay.year
        );
        (document.getElementById('editEarliestDateEra') as HTMLSelectElement).value =
          earliestDisplay.era;
        const latestDisplay = formatDateForDisplay(context.latestDate);
        (document.getElementById('editLatestDateYear') as HTMLInputElement).value = String(
          latestDisplay.year
        );
        (document.getElementById('editLatestDateEra') as HTMLSelectElement).value =
          latestDisplay.era;
        (document.getElementById('editDateType') as HTMLSelectElement).value =
          context.dateType || '';
        (document.getElementById('editGroupAssignment') as HTMLSelectElement).value =
          context.groupId || '';
        (document.getElementById('editSubGroupAssignment') as HTMLSelectElement).value =
          context.subGroupId || '';
        (document.getElementById('editPhaseAssignment') as HTMLSelectElement).value =
          context.phaseId || '';
        (document.getElementById('saveNodeBtn') as HTMLButtonElement).onclick = () =>
          saveNodeChanges(contextId);
        (document.getElementById('deleteNodeBtn') as HTMLButtonElement).onclick = () =>
          deleteContext(contextId);
        // Pre-fill feature form tab with this context id and coordinates
        const cfId = document.getElementById('cf_id') as HTMLInputElement | null;
        if (cfId) cfId.value = contextId;
        const cfX = document.getElementById('cf_x') as HTMLInputElement | null;
        if (cfX && typeof context.x === 'number') cfX.value = String(context.x);
        const cfY = document.getElementById('cf_y') as HTMLInputElement | null;
        if (cfY && typeof context.y === 'number') cfY.value = String(context.y);
      }

      function saveNodeChanges(oldId: string) {
        if (!canEditRef.current) return; // Guests cannot save changes
        const newId = (document.getElementById('editNodeIdInput') as HTMLInputElement).value
          .trim()
          .toUpperCase();
        if (!newId || (newId !== oldId && contexts.has(newId))) {
          alert('Context ID is invalid or already exists.');
          return;
        }
        const context = contexts.get(oldId);
        if (context.groupId) groups.get(context.groupId)?.contexts.delete(oldId);
        if (context.subGroupId) subGroups.get(context.subGroupId)?.contexts.delete(oldId);
        context.type = (document.getElementById('editContextType') as HTMLSelectElement).value;
        context.description = (
          document.getElementById('editContextDescription') as HTMLTextAreaElement
        ).value.trim();
        const eYear = parseInt(
          (document.getElementById('editEarliestDateYear') as HTMLInputElement).value
        );
        const eEra = (document.getElementById('editEarliestDateEra') as HTMLSelectElement).value;
        const lYear = parseInt(
          (document.getElementById('editLatestDateYear') as HTMLInputElement).value
        );
        const lEra = (document.getElementById('editLatestDateEra') as HTMLSelectElement).value;
        context.earliestDate = parseDateFromInputs(eYear, eEra);
        context.latestDate = parseDateFromInputs(lYear, lEra);
        context.dateType = (document.getElementById('editDateType') as HTMLSelectElement).value;
        const newGroupId =
          (document.getElementById('editGroupAssignment') as HTMLSelectElement).value || null;
        const newSubGroupId =
          (document.getElementById('editSubGroupAssignment') as HTMLSelectElement).value || null;
        const newPhaseId =
          (document.getElementById('editPhaseAssignment') as HTMLSelectElement).value || null;
        context.groupId = newGroupId;
        context.subGroupId = newSubGroupId;
        context.phaseId = newPhaseId;
        if (newId !== oldId) {
          context.id = newId;
          contexts.set(newId, context);
          contexts.delete(oldId);
          relationships.forEach((rel) => {
            if (rel.from === oldId) rel.from = newId;
            if (rel.to === oldId) rel.to = newId;
          });
          if (contextForms.has(oldId)) {
            const rec = contextForms.get(oldId)!;
            contextForms.set(newId, { ...rec, id: newId });
            contextForms.delete(oldId);
          }
        }
        if (newGroupId) {
          const group = groups.get(newGroupId);
          group?.contexts.add(newId);
          if (newSubGroupId) {
            group?.subGroups.add(newSubGroupId);
          }
        }
        if (newSubGroupId) {
          subGroups.get(newSubGroupId)?.contexts.add(newId);
        }
        // Editing a node can affect layout structure; trigger full rearrangement
        forceAutoLayoutNext = true;
        hideModals();
        updateUI();
      }

      function showRelationshipModal(sourceId: string, targetId: string) {
        if (!canEditRef.current) return; // Guests cannot create relationships
        const modal = document.getElementById('relationshipModal') as HTMLElement | null;
        if (!modal) return;
        modal.style.display = 'flex';
        (document.getElementById('relationshipModalTitle') as HTMLElement).innerText =
          `Define Relationship: ${sourceId} → ${targetId}`;
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
          hideModals();
          updateUI();
        };
      }

      function deleteContext(contextId: string) {
        if (!canEditRef.current) return; // Guests cannot delete contexts
        if (!window.confirm(`Delete context "${contextId}" and all its relationships?`)) return;
        const context = contexts.get(contextId);
        if (context?.groupId) groups.get(context.groupId)?.contexts.delete(contextId);
        if (context?.subGroupId) subGroups.get(context.subGroupId)?.contexts.delete(contextId);
        contexts.delete(contextId);
        relationships = relationships.filter(
          (rel) => rel.from !== contextId && rel.to !== contextId
        );
        temporalConflicts = temporalConflicts.filter(
          (c: any) => c.context1 !== contextId && c.context2 !== contextId
        );
        // Deletion changes graph topology
        forceAutoLayoutNext = true;
        hideModals();
        updateUI();
      }

      function removeRelationship(index: number) {
        if (!canEditRef.current) return; // Guests cannot remove relationships
        relationships.splice(index, 1);
        forceAutoLayoutNext = true;
        updateUI();
      }
      // Placeholder API for artefact addition (will be surfaced via UI later)
      function addArtefact(
        category: keyof ArtefactRegistries,
        partial: Omit<ArtefactRecord, 'id' | 'category'>
      ) {
        if (!canEditRef.current) {
          alert('You do not have permission to add artefacts.');
          return;
        }
        const id = `art_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const record: ArtefactRecord = { id, category, ...partial } as ArtefactRecord;
        artefactRegistries[category].push(record);
        saveToStorage();
      }

      function deleteArtefact(id: string) {
        if (!canEditRef.current) {
          alert('You do not have permission to delete artefacts.');
          return;
        }
        const cats = Object.keys(artefactRegistries) as (keyof ArtefactRegistries)[];
        for (const cat of cats) {
          const idx = artefactRegistries[cat].findIndex((r: any) => r.id === id);
          if (idx !== -1) {
            artefactRegistries[cat].splice(idx, 1);
            saveToStorage();
            break;
          }
        }
      }

      function resetZoom() {
        (svg as any).transition().duration(750).call(zoom.transform, d3.zoomIdentity);
      }

      function analyzeTemporalConflicts() {
        temporalConflicts = [];
        (relationships || []).forEach((rel: any) => {
          const ctx1 = contexts.get(rel.from);
          const ctx2 = contexts.get(rel.to);
          if (!ctx1?.earliestDate || !ctx1?.latestDate || !ctx2?.earliestDate || !ctx2?.latestDate)
            return;
          let earlierCtx: any, laterCtx: any;
          if (['above', 'seals', 'cuts', 'filled_by'].includes(rel.type)) {
            earlierCtx = ctx2;
            laterCtx = ctx1;
          } else if (['below', 'sealed_by', 'cut_by', 'fill_of'].includes(rel.type)) {
            earlierCtx = ctx1;
            laterCtx = ctx2;
          } else return;
          const earlier = { earliest: earlierCtx.earliestDate, latest: earlierCtx.latestDate };
          const later = { earliest: laterCtx.earliestDate, latest: laterCtx.latestDate };
          if (earlier.earliest > later.latest) {
            temporalConflicts.push({
              context1: earlierCtx.id,
              context2: laterCtx.id,
              description: `Date range conflict between ${earlierCtx.id} and ${laterCtx.id}`,
            });
          }
        });
        updateUI();
        alert(`Analysis complete. Found ${temporalConflicts.length} temporal conflicts.`);
      }

      function confirmClear() {
        if (!window.confirm('Delete all data? This cannot be undone.')) return;
        contexts = new Map();
        relationships = [];
        groups = new Map();
        subGroups = new Map();
        phases = new Map();
        nodePositions = {};
        temporalConflicts = [];
        saveToStorage();
        updateUI();
      }

      function triggerImport() {
        fileInputRef.current?.click();
      }

      function handleFileSelect(event: any) {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e: any) => {
          try {
            const csvContent: string = e.target.result;
            const rows = csvContent
              .split(/\r?\n/)
              .filter(Boolean)
              .map((r) => r.split(','));
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
        const modal = document.getElementById('importModal') as HTMLElement | null;
        if (!modal) return;
        const selectIds = ['mapContextId', 'mapDescription', 'mapRelType', 'mapRelTo'];
        const noMap = `<option value="">--- Do Not Map ---</option>`;
        const headerOptions = headers.map((h) => `<option value="${h}">${h}</option>`).join('');
        selectIds.forEach((id) => {
          const sel = document.getElementById(id) as HTMLSelectElement;
          if (sel) sel.innerHTML = noMap + headerOptions;
        });
        // keep for confirmImport
        (window as any).__hm_lastHeaders = headers;
        const smartMap: any = {
          mapContextId: ['id', 'context', 'context_id', 'unit'],
          mapDescription: ['desc', 'description', 'notes'],
          mapRelType: ['rel_type', 'relationship', 'rel type', 'type'],
          mapRelTo: ['rel_to', 'related_to', 'related context', 'is_below', 'is_above'],
        };
        for (const [selectId, possibles] of Object.entries(smartMap)) {
          const found = headers.find((h) =>
            (possibles as string[]).includes(h.toLowerCase().replace(/ /g, '_'))
          );
          if (found) (document.getElementById(selectId) as HTMLSelectElement).value = found;
        }
        (document.getElementById('confirmImportBtn') as HTMLButtonElement).onclick = () =>
          confirmImport(parsedData);
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
        if (!mapping.contextId) {
          alert('Context ID must be mapped.');
          return;
        }
        if (mapping.clear) {
          contexts = new Map();
          relationships = [];
          groups = new Map();
          subGroups = new Map();
          phases = new Map();
        }
        let importedContexts = 0;
        let importedRels = 0;
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
        (hdrs || []).forEach((h: string, i: number) => (headerIndex[h] = i));
        parsedData.forEach((row) => {
          const idVal = headersSel.id ? row[headerIndex[headersSel.id]] : '';
          if (idVal && !contexts.has(idVal)) {
            contexts.set(idVal, {
              id: idVal,
              x: 0,
              y: 0,
              fixed: false,
              type: 'layer',
              description: headersSel.desc ? row[headerIndex[headersSel.desc]] || '' : '',
            });
            importedContexts++;
          }
          if (headersSel.relType && headersSel.relTo && idVal) {
            const rType = row[headerIndex[headersSel.relType]];
            const rTo = row[headerIndex[headersSel.relTo]];
            if (rType && rTo) {
              relationships.push({
                from: idVal,
                to: rTo,
                type: String(rType).toLowerCase().replace(/\s+/g, '_'),
              });
              importedRels++;
            }
          }
        });
        hideModals();
        updateUI();
        alert(
          `Import complete. Added ${importedContexts} contexts and ${importedRels} relationships.`
        );
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
              for (const r of Array.from(rules)) {
                cssStyles += (r as CSSStyleRule).cssText || '';
              }
            } catch {}
          }
        } catch {}
        const standalone = `<svg xmlns="http://www.w3.org/2000/svg"><style>${cssStyles}</style>${svgContent}</svg>`;
        const blob = new Blob([standalone], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'harris_matrix.svg';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }

      function quickSelfTest() {
        const results: string[] = [];
        try {
          // Artefact add/delete
          const before = Object.values(artefactRegistries).reduce(
            (a: number, b: any) => a + b.length,
            0
          );
          addArtefact('pottery', {
            number: 'TST-1',
            type: 'test',
            complexFeature: 'CFX',
            areaSurface: '',
            gridSquare: '',
            depth: '',
            stratigraphicUnit: 'SU-X',
            quantity: 1,
            otherObservations: 'tmp',
          });
          const afterAdd = Object.values(artefactRegistries).reduce(
            (a: number, b: any) => a + b.length,
            0
          );
          const lastId =
            artefactRegistries['pottery'][artefactRegistries['pottery'].length - 1]?.id;
          if (afterAdd === before + 1 && lastId) {
            results.push('Artefact add: PASS');
          } else {
            results.push('Artefact add: FAIL');
          }
          if (lastId) deleteArtefact(lastId);
          const afterDel = Object.values(artefactRegistries).reduce(
            (a: number, b: any) => a + b.length,
            0
          );
          results.push(afterDel === before ? 'Artefact delete: PASS' : 'Artefact delete: FAIL');

          // SU save
          const suId = `SU_TEST_${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
          stratigraphicUnits.set(suId, {
            id: suId,
            sector: 'T',
            complexFeatureNo: '',
            earlierThan: [],
            laterThan: [],
            unitType: 'layer' as any,
            location: '',
            dimensions: {},
            orientation: '',
            structure: {
              compaction: '' as any,
              colour: '',
              munsellCode: '',
              homogeneous: false,
              heterogeneous: false,
            },
            composition: {},
            granulation: '' as any,
            contaminationRisk: '' as any,
            bones: false,
            seed: false,
            perturbation: {},
            description: '',
            documentation: {
              drawing: false,
              plan: false,
              photogrammetry: false,
              samples: false,
              photos: false,
              video: false,
              planNumber: '',
            },
            author: '',
            dateCreated: '',
            checkedBy: '',
            dateChecked: '',
          });
          const suExists = stratigraphicUnits.has(suId);
          stratigraphicUnits.delete(suId);
          results.push(suExists ? 'SU save: PASS' : 'SU save: FAIL');

          alert(results.join('\n'));
        } catch (e) {
          alert('Self-test failed to run');
        }
      }

      function exportCSV() {
        if (contexts.size === 0) {
          alert('No data to export.');
          return;
        }
        const headers = [
          'Context_ID',
          'Context_Type',
          'Description',
          'Earliest_Date_Year',
          'Earliest_Date_Era',
          'Latest_Date_Year',
          'Latest_Date_Era',
          'Date_Type',
          'Phase_ID',
          'Group_ID',
          'SubGroup_ID',
        ];
        let csv = headers.join(',') + '\r\n';
        contexts.forEach((c: any) => {
          const ed = formatDateForDisplay(c.earliestDate);
          const ld = formatDateForDisplay(c.latestDate);
          csv +=
            [
              c.id,
              c.type || '',
              (c.description || '').replace(/,/g, ' '),
              ed.year,
              ed.era,
              ld.year,
              ld.era,
              c.dateType || '',
              c.phaseId || '',
              c.groupId || '',
              c.subGroupId || '',
            ].join(',') + '\r\n';
        });
        const link = document.createElement('a');
        link.href = 'data:text/csv;charset=utf-8,' + encodeURI(csv);
        link.download = 'harris_matrix.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      function exportSUCSV() {
        if (stratigraphicUnits.size === 0) {
          alert('No SU records.');
          return;
        }
        const headers = [
          'SU_ID',
          'Sector',
          'Complex_Feature_No',
          'Earlier_Than',
          'Later_Than',
          'Unit_Type',
          'Location',
          'Length',
          'Thickness',
          'Depth',
          'Area_Surface',
          'Orientation',
          'Compaction',
          'Colour',
          'Munsell',
          'Homogeneous',
          'Heterogeneous',
          'Granulation',
          'Contamination_Risk',
          'Bones',
          'Seed',
          'Description',
          'Plan_Number',
          'Author',
          'Date_Created',
          'Checked_By',
          'Date_Checked',
        ];
        let csv = headers.join(',') + '\r\n';
        stratigraphicUnits.forEach((su: any) => {
          csv +=
            [
              su.id,
              su.sector || '',
              su.complexFeatureNo || '',
              (su.earlierThan || []).join('|'),
              (su.laterThan || []).join('|'),
              su.unitType || '',
              su.location || '',
              su.dimensions?.length || '',
              su.dimensions?.thickness || '',
              su.dimensions?.depth || '',
              su.dimensions?.areaSurface || '',
              su.orientation || '',
              su.structure?.compaction || '',
              su.structure?.colour || '',
              su.structure?.munsellCode || '',
              su.structure?.homogeneous || '',
              su.structure?.heterogeneous || '',
              su.granulation || '',
              su.contaminationRisk || '',
              su.bones || '',
              su.seed || '',
              (su.description || '').replace(/,/g, ' '),
              su.documentation?.planNumber || '',
              su.author || '',
              su.dateCreated || '',
              su.checkedBy || '',
              su.dateChecked || '',
            ].join(',') + '\r\n';
        });
        const link = document.createElement('a');
        link.href = 'data:text/csv;charset=utf-8,' + encodeURI(csv);
        link.download = 'su_records.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      function exportArtefactsCSV() {
        let total = 0;
        Object.values(artefactRegistries).forEach((arr: any) => (total += (arr as any[]).length));
        if (!total) {
          alert('No artefacts recorded.');
          return;
        }
        const headers = [
          'ID',
          'Category',
          'Number',
          'Type',
          'Feature',
          'Area_Surface',
          'Grid_Square',
          'Depth',
          'Stratigraphic_Unit',
          'Quantity',
          'Observations',
        ];
        let csv = headers.join(',') + '\r\n';
        Object.entries(artefactRegistries).forEach(([cat, arr]) => {
          (arr as any[]).forEach((r: any) => {
            csv +=
              [
                r.id,
                cat,
                r.number || '',
                (r.type || '').replace(/,/g, ' '),
                r.complexFeature || '',
                r.areaSurface || '',
                r.gridSquare || '',
                r.depth || '',
                r.stratigraphicUnit || '',
                r.quantity || '',
                (r.otherObservations || '').replace(/,/g, ' '),
              ].join(',') + '\r\n';
          });
        });
        const link = document.createElement('a');
        link.href = 'data:text/csv;charset=utf-8,' + encodeURI(csv);
        link.download = 'artefacts.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      function importSUCSV(file: File) {
        const reader = new FileReader();
        reader.onload = (e: any) => {
          try {
            const lines = String(e.target?.result || '')
              .split(/\r?\n/)
              .filter(Boolean);
            if (lines.length < 2) return;
            const headers = lines.shift()!.split(',');
            const idx = (h: string) => headers.indexOf(h);
            lines.forEach((line) => {
              const cells = line.split(',');
              const id = cells[idx('SU_ID')]?.trim();
              if (!id) return;
              const rec: StratigraphicUnitRecord = {
                id,
                sector: cells[idx('Sector')] || '',
                complexFeatureNo: cells[idx('Complex_Feature_No')] || '',
                earlierThan: (cells[idx('Earlier_Than')] || '').split('|').filter(Boolean),
                laterThan: (cells[idx('Later_Than')] || '').split('|').filter(Boolean),
                unitType: (cells[idx('Unit_Type')] || '') as any,
                location: cells[idx('Location')] || '',
                dimensions: {
                  length: parseFloat(cells[idx('Length')]) || undefined,
                  thickness: parseFloat(cells[idx('Thickness')]) || undefined,
                  depth: parseFloat(cells[idx('Depth')]) || undefined,
                  areaSurface: parseFloat(cells[idx('Area_Surface')]) || undefined,
                },
                orientation: cells[idx('Orientation')] || '',
                structure: {
                  compaction: (cells[idx('Compaction')] || '') as any,
                  colour: cells[idx('Colour')] || '',
                  munsellCode: cells[idx('Munsell')] || '',
                  homogeneous: cells[idx('Homogeneous')] === 'true',
                  heterogeneous: cells[idx('Heterogeneous')] === 'true',
                },
                composition: {},
                granulation: (cells[idx('Granulation')] || '') as any,
                contaminationRisk: (cells[idx('Contamination_Risk')] || '') as any,
                bones: cells[idx('Bones')] === 'true',
                seed: cells[idx('Seed')] === 'true',
                perturbation: {},
                description: cells[idx('Description')] || '',
                documentation: {
                  drawing: false,
                  plan: false,
                  photogrammetry: false,
                  samples: false,
                  photos: false,
                  video: false,
                  planNumber: cells[idx('Plan_Number')] || '',
                },
                author: cells[idx('Author')] || '',
                dateCreated: cells[idx('Date_Created')] || '',
                checkedBy: cells[idx('Checked_By')] || '',
                dateChecked: cells[idx('Date_Checked')] || '',
              };
              stratigraphicUnits.set(id, rec);
            });
            saveToStorage();
            updateRecordsDisplay();
            alert('SU CSV import complete.');
          } catch {
            alert('Failed to import SU CSV');
          }
        };
        reader.readAsText(file);
      }

      function importArtefactsCSV(file: File) {
        const reader = new FileReader();
        reader.onload = (e: any) => {
          try {
            const lines = String(e.target?.result || '')
              .split(/\r?\n/)
              .filter(Boolean);
            if (lines.length < 2) return;
            const headers = lines.shift()!.split(',');
            const idx = (h: string) => headers.indexOf(h);
            lines.forEach((line) => {
              const cells = line.split(',');
              const category = cells[idx('Category')] as keyof ArtefactRegistries;
              if (!category || !artefactRegistries[category]) return;
              const partial: Omit<ArtefactRecord, 'id' | 'category'> = {
                number: cells[idx('Number')] || '',
                type: cells[idx('Type')] || '',
                complexFeature: cells[idx('Feature')] || '',
                areaSurface: cells[idx('Area_Surface')] || '',
                gridSquare: cells[idx('Grid_Square')] || '',
                depth: cells[idx('Depth')] || '',
                stratigraphicUnit: cells[idx('Stratigraphic_Unit')] || '',
                quantity: parseInt(cells[idx('Quantity')]) || undefined,
                otherObservations: cells[idx('Observations')] || '',
              };
              addArtefact(category, partial);
            });
            alert('Artefacts CSV import complete.');
            renderArtefactTable();
          } catch {
            alert('Failed to import artefacts CSV');
          }
        };
        reader.readAsText(file);
      }

      // Hook up SVG interactions
      svg.on('click', handleCanvasClick);

      // Expose helpers for buttons/tables
      (window as any).__hm_removeRelationship = removeRelationship;
      (window as any).__hm_highlightPhase = (id: string) =>
        highlightBy((c: any) => c.phaseId === id, '#4caf50');
      (window as any).__hm_highlightGroup = (id: string) => {
        const group = groups.get(id);
        const color = group?.color || DEFAULT_GROUP_COLOR;
        highlightBy((c: any) => c.groupId === id, color);
      };
      (window as any).__hm_highlightSubGroup = (id: string) => {
        const subgroup = subGroups.get(id);
        const color = subgroup?.color || DEFAULT_SUBGROUP_COLOR;
        highlightBy((c: any) => c.subGroupId === id, color);
      };
      (window as any).__hm_highlightContext = (id: string) =>
        highlightBy((c: any) => c.id === id, 'gold');
      (window as any).__hm_clearHighlights = () => highlightBy(() => false, '#0056b3');

      (window as any).__hm_showGroupOverlay = (
        entityType: 'group' | 'subgroup',
        entityId: string
      ) => {
        const source = entityType === 'group' ? groups.get(entityId) : subGroups.get(entityId);
        if (!source) return;
        const color =
          source.color || (entityType === 'group' ? DEFAULT_GROUP_COLOR : DEFAULT_SUBGROUP_COLOR);
        const contextIds = Array.from(source.contexts || []) as string[];
        const contextsPayload: GroupOverlayContext[] = contextIds
          .map((ctxId) => contexts.get(ctxId))
          .filter(Boolean)
          .map((ctx: any) => ({
            id: ctx.id,
            label: ctx.id,
            type: ctx.type,
            description: ctx.description,
          }));
        setOverlayData({
          id: entityId,
          type: entityType,
          name: source.name,
          description: source.description,
          color,
          contexts: contextsPayload,
        });
        highlightBy(
          (c: any) => (entityType === 'group' ? c.groupId === entityId : c.subGroupId === entityId),
          color
        );
      };

      (window as any).__hm_editGroupEntity = (
        event: MouseEvent,
        entityType: 'group' | 'subgroup',
        entityId: string
      ) => {
        event?.stopPropagation();
        openGroupModal({ mode: 'edit', entity: entityType, id: entityId });
      };

      function highlightBy(filterFn: (c: any) => boolean, color: string) {
        g.selectAll('.context-node-group').each(function (this: any) {
          const node = d3.select(this);
          const rect = node.select('rect');
          const c = contexts.get((node.datum && node.datum()) || nodeDataFromTransform(this));
          const isSelected = c && filterFn(c);
          rect
            .transition()
            .duration(300)
            .attr('stroke-width', isSelected ? '4px' : '2px')
            .attr('stroke', isSelected ? color : '#0056b3');
        });
      }
      function nodeDataFromTransform(el: any) {
        // Attempt to read label text as id
        try {
          return d3.select(el).select('text').text() || null;
        } catch {
          return null;
        }
      }

      // Initial draw
      updateUI();

      cleanup = () => {
        svg.on('.zoom', null);
        svg.on('click', null);
      };

      // Wire API ref for React buttons
      apiRef.current = {
        createGroup: () => openGroupModal({ mode: 'create', entity: 'group' }),
        createSubGroup: () => {
          if (groups.size === 0) {
            alert('Please create a parent group first.');
            return;
          }
          openGroupModal({ mode: 'create', entity: 'subgroup' });
        },
        createPhase: () => openGroupModal({ mode: 'create', entity: 'phase' }),
        analyzeTemporalConflicts,
        resetZoom,
        restructure: () => {
          // Clear all fixed positions and force full layout
          contexts.forEach((c: any) => {
            c.fixed = false;
          });
          applyLayoutAndDraw();
          saveToStorage();
        },
        exportCSV,
        exportSVG: exportViewAsSVG,
        clearAll: confirmClear,
        importCSV: triggerImport,
        __handleFileSelect: handleFileSelect,
        addArtefact,
        exportSUCSV,
        exportArtefactsCSV,
        __importSUCSV: importSUCSV,
        __importArtefactsCSV: importArtefactsCSV,
        refreshArtefactTable: () => renderArtefactTable(),
        quickSelfTest,
      };
    })();

    return () => {
      cleanup && cleanup();
      (window as any).__hm_removeRelationship = undefined;
      (window as any).__hm_highlightPhase = undefined;
      (window as any).__hm_highlightGroup = undefined;
      (window as any).__hm_highlightSubGroup = undefined;
      (window as any).__hm_highlightContext = undefined;
      (window as any).__hm_clearHighlights = undefined;
      (window as any).__hm_showGroupOverlay = undefined;
      (window as any).__hm_editGroupEntity = undefined;
      openGroupModalRef.current = null;
    };
  }, [projectId]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!toolMenuRef.current) return;
      if (!toolMenuRef.current.contains(event.target as Node)) {
        setToolMenuOpen(false);
      }
    }
    if (toolMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [toolMenuOpen]);

  const handleOverlayClose = () => {
    const clearHighlights = (window as any)?.__hm_clearHighlights;
    if (typeof clearHighlights === 'function') {
      clearHighlights();
    }
    setOverlayData(null);
  };

  return (
    <div ref={rootRef} className="harris-matrix" style={{ width: '100%', height: '100%' }}>
      <div className="container">
        <div className="workspace" style={{ width: '100%' }}>
          <div className="visualization-panel">
            <div ref={toolMenuRef} className={`tool-menu ${toolMenuOpen ? 'open' : ''}`}>
              {canEdit && (
                <button
                  type="button"
                  className="tool-menu-toggle"
                  onClick={(event) => {
                    event.stopPropagation();
                    setToolMenuOpen((prev) => !prev);
                    (event.currentTarget as HTMLButtonElement).blur();
                  }}
                  aria-label="Management tools"
                >
                  <FaWrench size={16} />
                </button>
              )}
              <button
                type="button"
                className="tool-menu-toggle"
                onClick={(e) => {
                  apiRef.current.resetZoom?.();
                  (e.currentTarget as HTMLButtonElement).blur();
                }}
                aria-label="Reset view"
                title="Reset view"
              >
                <MdOutlineViewInAr size={16} />
              </button>
              <button
                type="button"
                className="tool-menu-toggle"
                onClick={(e) => {
                  apiRef.current.restructure?.();
                  (e.currentTarget as HTMLButtonElement).blur();
                }}
                aria-label="Restructure layout"
                title="Restructure layout"
              >
                <FaArrowRotateRight size={14} />
              </button>
              {canEdit && toolMenuOpen && (
                <div className="tool-menu-dropdown">
                  <button
                    className="btn-warning"
                    onClick={(e) => {
                      apiRef.current.createGroup();
                      setToolMenuOpen(false);
                      (e.currentTarget as HTMLButtonElement).blur();
                    }}
                  >
                    Create Group
                  </button>
                  <button
                    className="btn-warning"
                    onClick={(e) => {
                      apiRef.current.createSubGroup();
                      setToolMenuOpen(false);
                      (e.currentTarget as HTMLButtonElement).blur();
                    }}
                  >
                    Create Sub-Group
                  </button>
                  <button
                    className="btn-success"
                    onClick={(e) => {
                      apiRef.current.createPhase();
                      setToolMenuOpen(false);
                      (e.currentTarget as HTMLButtonElement).blur();
                    }}
                  >
                    Create Phase
                  </button>
                  <button
                    className="btn-primary"
                    onClick={(e) => {
                      apiRef.current.analyzeTemporalConflicts();
                      setToolMenuOpen(false);
                      (e.currentTarget as HTMLButtonElement).blur();
                    }}
                  >
                    Analyze Conflicts
                  </button>
                  <button
                    className="btn-primary"
                    onClick={(e) => {
                      apiRef.current.quickSelfTest();
                      setToolMenuOpen(false);
                      (e.currentTarget as HTMLButtonElement).blur();
                    }}
                  >
                    Quick Self-Test
                  </button>
                </div>
              )}
            </div>
            <svg id="matrixSvg" ref={svgRef} />
          </div>
          <div className="data-panel">
            {sidebarView === 'default' ? (
              <div className="tabs">
                <div
                  className={`tab ${activeTab === 'hierarchy' ? 'active' : ''}`}
                  onClick={() => setActiveTab('hierarchy')}
                >
                  Hierarchy
                </div>
                <div
                  className={`tab ${activeTab === 'relationships' ? 'active' : ''}`}
                  onClick={() => setActiveTab('relationships')}
                >
                  Relationships
                </div>
                <div
                  className={`tab ${activeTab === 'records' ? 'active' : ''}`}
                  onClick={() => setActiveTab('records')}
                >
                  Records
                </div>
                <div
                  className={`tab ${activeTab === 'export' ? 'active' : ''}`}
                  onClick={() => setActiveTab('export')}
                >
                  Export
                </div>
              </div>
            ) : (
              <div className="tabs" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  className="tool-menu-toggle"
                  aria-label="Back"
                  title="Back"
                  onClick={() => {
                    setSidebarView('default');
                    setActiveTab('records');
                  }}
                  style={{ marginRight: 6 }}
                >
                  <FaArrowLeft size={14} />
                </button>
                <div style={{ fontSize: 12, color: 'var(--muted,#adb5bd)' }}>
                  {sidebarView === 'featureForm'
                    ? 'Context Feature Form'
                    : sidebarView === 'suForm'
                      ? 'SU Form'
                      : 'Artefact Registry'}
                </div>
              </div>
            )}
            <div
              id="hierarchy-tab"
              className={`tab-content ${activeTab === 'hierarchy' ? 'active' : ''}`}
            >
              <h3>Stratigraphic Hierarchy</h3>
              <div id="hierarchyList" className="hierarchy-list"></div>
            </div>
            <div
              id="conflicts-tab"
              className={`tab-content ${activeTab === 'conflicts' ? 'active' : ''}`}
            >
              <h3>Temporal Conflicts</h3>
              <div id="conflictsList" className="hierarchy-list"></div>
            </div>
            <div
              id="relationships-tab"
              className={`tab-content ${activeTab === 'relationships' ? 'active' : ''}`}
            >
              <h3>Relationships</h3>
              <div id="relationshipsList" className="hierarchy-list"></div>
            </div>

            <div
              id="records-tab"
              className={`tab-content ${activeTab === 'records' && sidebarView === 'default' ? 'active' : ''}`}
            >
              <h3>Digitized Records</h3>
              <div id="recordsSummary" className="hierarchy-list" style={{ marginBottom: 8 }}></div>
              <div className="button-grid">
                <button className="btn-primary" onClick={() => setSidebarView('featureForm')}>
                  Open Context Feature Form
                </button>
                <button className="btn-primary" onClick={() => setSidebarView('suForm')}>
                  Open SU Form
                </button>
                <button className="btn-primary" onClick={() => setSidebarView('artefacts')}>
                  Open Artefact Registry
                </button>
              </div>
            </div>

            <div
              id="featureForm-tab"
              className={`tab-content ${activeTab === 'featureForm' || sidebarView === 'featureForm' ? 'active' : ''}`}
            >
              <h3>Full Context Feature Record</h3>
              <p style={{ fontSize: '12px', color: 'var(--muted,#adb5bd)', marginBottom: '8px' }}>
                Select a context node to preload some fields, then fill the detailed record.
              </p>
              <form
                id="contextFeatureForm"
                onSubmit={(e) => {
                  e.preventDefault();
                }}
              >
                <div className="form-group">
                  <label>Context ID</label>
                  <input type="text" id="cf_id" placeholder="e.g. 1001" />
                </div>
                <div className="form-row" style={{ display: 'flex', gap: 8 }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Feature / Complex No.</label>
                    <input type="text" id="cf_featureNumber" />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Sector</label>
                    <input type="text" id="cf_sector" />
                  </div>
                </div>
                <div className="form-row" style={{ display: 'flex', gap: 8 }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Earlier Than (IDs comma sep)</label>
                    <input type="text" id="cf_earlierThan" placeholder="1001,1002" />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Later Than (IDs comma sep)</label>
                    <input type="text" id="cf_laterThan" placeholder="1003" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Feature Type</label>
                  <select id="cf_featureType">
                    <option value="">— Select —</option>
                    <option value="pit">Pit</option>
                    <option value="trench">Trench</option>
                    <option value="house">House</option>
                    <option value="grave">Grave</option>
                    <option value="oven_hearth">Oven / Hearth</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Location / Notes</label>
                  <input type="text" id="cf_location" placeholder="Grid ref / description" />
                </div>
                <fieldset className="fieldset-group">
                  <legend>Dimensions</legend>
                  <div className="form-row" style={{ display: 'flex', gap: 8 }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Length (m)</label>
                      <input type="number" step="0.01" id="cf_length" />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Width (m)</label>
                      <input type="number" step="0.01" id="cf_width" />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Depth (m)</label>
                      <input type="number" step="0.01" id="cf_depth" />
                    </div>
                  </div>
                </fieldset>
                <fieldset className="fieldset-group">
                  <legend>Coordinates</legend>
                  <div className="form-row" style={{ display: 'flex', gap: 8 }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>X</label>
                      <input type="number" id="cf_x" />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Y</label>
                      <input type="number" id="cf_y" />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Z (MASL)</label>
                      <input type="number" id="cf_z" />
                    </div>
                  </div>
                </fieldset>
                <div className="form-group">
                  <label>Shape</label>
                  <select id="cf_shape">
                    <option value="">— Select —</option>
                    <option value="circular">Circular</option>
                    <option value="oval">Oval</option>
                    <option value="rectangular">Rectangular</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Orientation</label>
                  <input type="text" id="cf_orientation" placeholder="e.g. NE-SW" />
                </div>
                <fieldset className="fieldset-group">
                  <legend>Finds Present</legend>
                  <div
                    className="checkbox-grid"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))',
                      gap: 4,
                    }}
                  >
                    {[
                      'pottery',
                      'metal',
                      'flint',
                      'stone',
                      'wood',
                      'charcoal',
                      'shell',
                      'snail',
                      'ash',
                      'adobe',
                      'beads',
                      'pendant',
                      'ring',
                      'seed',
                      'animalBones',
                      'humanBones',
                      'other',
                    ].map((k) => (
                      <label key={k} style={{ fontSize: '11px' }}>
                        <input type="checkbox" id={`cf_find_${k}`} /> {k}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="form-group">
                  <label>Description</label>
                  <textarea id="cf_description" rows={3} />
                </div>
                <fieldset className="fieldset-group">
                  <legend>Documentation</legend>
                  <div
                    className="checkbox-grid"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))',
                      gap: 4,
                    }}
                  >
                    {['drawing', 'plan', 'photogrammetry', 'photos', 'video'].map((k) => (
                      <label key={k} style={{ fontSize: '11px' }}>
                        <input type="checkbox" id={`cf_doc_${k}`} /> {k}
                      </label>
                    ))}
                  </div>
                  <div className="form-group">
                    <label>Plan Number</label>
                    <input type="text" id="cf_planNumber" />
                  </div>
                </fieldset>
                <fieldset className="fieldset-group">
                  <legend>Samples (basic)</legend>
                  <div
                    className="checkbox-grid"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))',
                      gap: 4,
                    }}
                  >
                    {['environmental', 'aDNA', 'c14', 'isotopic', 'other'].map((k) => (
                      <label key={k} style={{ fontSize: '11px' }}>
                        <input type="checkbox" id={`cf_samp_${k}`} /> {k}
                      </label>
                    ))}
                  </div>
                  <div className="form-row" style={{ display: 'flex', gap: 8 }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Bag No.</label>
                      <input type="text" id="cf_sampleBag" />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Quantity</label>
                      <input type="number" id="cf_sampleQty" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Other Sample Type</label>
                    <input type="text" id="cf_sampleOtherType" />
                  </div>
                </fieldset>
                <div className="form-row" style={{ display: 'flex', gap: 8 }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Author</label>
                    <input type="text" id="cf_author" />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Date Created</label>
                    <input type="date" id="cf_dateCreated" />
                  </div>
                </div>
                <div className="form-row" style={{ display: 'flex', gap: 8 }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Checked By</label>
                    <input type="text" id="cf_checkedBy" />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Date Checked</label>
                    <input type="date" id="cf_dateChecked" />
                  </div>
                </div>
                <div className="modal-buttons" style={{ marginTop: 12 }}>
                  <button type="button" className="confirm" id="cf_saveBtn">
                    Save Record
                  </button>
                  <button type="button" className="cancel" id="cf_clearBtn">
                    Clear Form
                  </button>
                </div>
              </form>
            </div>

            <div
              id="suForm-tab"
              className={`tab-content ${activeTab === 'suForm' || sidebarView === 'suForm' ? 'active' : ''}`}
            >
              <h3>Stratigraphic Unit (SU) Record</h3>
              <form id="suForm" onSubmit={(e) => e.preventDefault()}>
                <div className="form-row" style={{ display: 'flex', gap: 8 }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>SU ID</label>
                    <input type="text" id="su_id" placeholder="e.g. SU1" />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Sector</label>
                    <input type="text" id="su_sector" />
                  </div>
                </div>
                <div className="form-row" style={{ display: 'flex', gap: 8 }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Complex / Feature No.</label>
                    <input type="text" id="su_complexFeatureNo" />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Unit Type</label>
                    <select id="su_unitType">
                      <option value="">— Select —</option>
                      {[
                        'cut',
                        'deposit_fill',
                        'anthropic',
                        'natural',
                        'demolition',
                        'negative',
                        'construction',
                        'abandonment',
                        'other',
                      ].map((t) => (
                        <option key={t} value={t}>
                          {t.replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-row" style={{ display: 'flex', gap: 8 }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Earlier Than (IDs)</label>
                    <input type="text" id="su_earlierThan" placeholder="comma separated" />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Later Than (IDs)</label>
                    <input type="text" id="su_laterThan" placeholder="comma separated" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Location</label>
                  <input type="text" id="su_location" />
                </div>
                <fieldset className="fieldset-group">
                  <legend>Dimensions</legend>
                  <div className="form-row" style={{ display: 'flex', gap: 8 }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Length</label>
                      <input type="number" id="su_length" />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Thickness</label>
                      <input type="number" id="su_thickness" />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Depth</label>
                      <input type="number" id="su_depth" />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Area/Surface</label>
                      <input type="number" id="su_areaSurface" />
                    </div>
                  </div>
                </fieldset>
                <div className="form-row" style={{ display: 'flex', gap: 8 }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Orientation</label>
                    <input type="text" id="su_orientation" />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Colour</label>
                    <input type="text" id="su_colour" />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Munsell</label>
                    <input type="text" id="su_munsell" />
                  </div>
                </div>
                <fieldset className="fieldset-group">
                  <legend>Structure</legend>
                  <div className="form-row" style={{ display: 'flex', gap: 8 }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Compaction</label>
                      <select id="su_compaction">
                        {['', 'dry', 'wet', 'soft', 'very_soft', 'compact', 'medium'].map((t) => (
                          <option key={t} value={t}>
                            {t || '— Select —'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>
                        <input type="checkbox" id="su_homogeneous" /> Homogeneous
                      </label>
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>
                        <input type="checkbox" id="su_heterogeneous" /> Heterogeneous
                      </label>
                    </div>
                  </div>
                </fieldset>
                <fieldset className="fieldset-group">
                  <legend>Composition</legend>
                  <div
                    className="checkbox-grid"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))',
                      gap: 4,
                    }}
                  >
                    {[
                      'pottery',
                      'flint',
                      'stone',
                      'wood',
                      'charcoal',
                      'shell',
                      'snail',
                      'ash',
                      'adobe',
                      'metal',
                      'organic',
                      'mineral',
                      'gravels',
                      'silt',
                      'sand',
                      'argil',
                      'loess',
                      'mud',
                      'other',
                    ].map((k) => (
                      <label key={k} style={{ fontSize: '11px' }}>
                        <input type="checkbox" id={`su_comp_${k}`} /> {k}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="form-row" style={{ display: 'flex', gap: 8 }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Granulation</label>
                    <select id="su_granulation">
                      {['', 'high', 'medium', 'low'].map((t) => (
                        <option key={t} value={t}>
                          {t || '— Select —'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Contamination Risk</label>
                    <select id="su_contamination">
                      {['', 'high', 'medium', 'low'].map((t) => (
                        <option key={t} value={t}>
                          {t || '— Select —'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>
                      <input type="checkbox" id="su_bones" /> Bones
                    </label>
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>
                      <input type="checkbox" id="su_seed" /> Seed
                    </label>
                  </div>
                </div>
                <fieldset className="fieldset-group">
                  <legend>Perturbation</legend>
                  <div className="form-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {['natural', 'anthropic', 'burrow', 'roots', 'other'].map((k) => (
                      <label key={k} style={{ fontSize: '11px' }}>
                        <input type="checkbox" id={`su_pert_${k}`} /> {k}
                      </label>
                    ))}
                    <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
                      <label>Other Type</label>
                      <input type="text" id="su_pert_otherType" />
                    </div>
                  </div>
                </fieldset>
                <div className="form-group">
                  <label>Description</label>
                  <textarea id="su_description" rows={3} />
                </div>
                <fieldset className="fieldset-group">
                  <legend>Documentation</legend>
                  <div
                    className="checkbox-grid"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))',
                      gap: 4,
                    }}
                  >
                    {['drawing', 'plan', 'photogrammetry', 'samples', 'photos', 'video'].map(
                      (k) => (
                        <label key={k} style={{ fontSize: '11px' }}>
                          <input type="checkbox" id={`su_doc_${k}`} /> {k}
                        </label>
                      )
                    )}
                  </div>
                  <div className="form-group">
                    <label>Plan Number</label>
                    <input type="text" id="su_planNumber" />
                  </div>
                </fieldset>
                <div className="form-row" style={{ display: 'flex', gap: 8 }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Author</label>
                    <input type="text" id="su_author" />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Date Created</label>
                    <input type="date" id="su_dateCreated" />
                  </div>
                </div>
                <div className="form-row" style={{ display: 'flex', gap: 8 }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Checked By</label>
                    <input type="text" id="su_checkedBy" />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Date Checked</label>
                    <input type="date" id="su_dateChecked" />
                  </div>
                </div>
                <div className="modal-buttons" style={{ marginTop: 12 }}>
                  <button type="button" className="confirm" id="su_saveBtn">
                    Save SU
                  </button>
                  <button type="button" className="cancel" id="su_clearBtn">
                    Clear
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => apiRef.current.exportSUCSV()}
                  >
                    Export SU CSV
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() =>
                      (document.getElementById('su_importInput') as HTMLInputElement)?.click()
                    }
                  >
                    Import SU CSV
                  </button>
                </div>
                <input
                  type="file"
                  id="su_importInput"
                  accept=".csv"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = (e.target as HTMLInputElement).files?.[0];
                    if (f) apiRef.current.__importSUCSV(f);
                    (e.target as HTMLInputElement).value = '';
                  }}
                />
              </form>
            </div>

            <div
              id="artefacts-tab"
              className={`tab-content ${activeTab === 'artefacts' || sidebarView === 'artefacts' ? 'active' : ''}`}
            >
              <h3>Artefact Registry</h3>
              <div className="form-row" style={{ display: 'flex', gap: 8 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Filter Text</label>
                  <input
                    type="text"
                    id="af_filterText"
                    onInput={() => apiRef.current.refreshArtefactTable()}
                    placeholder="Search number/type/SU"
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Filter Category</label>
                  <select
                    id="af_filterCategory"
                    onChange={() => apiRef.current.refreshArtefactTable()}
                  >
                    <option value="">All</option>
                    {[
                      'pottery',
                      'lithic',
                      'hard_animal_material',
                      'clay_artefact',
                      'metal_artefact',
                      'pot',
                      'figurine',
                      'sample',
                      'animal_bone',
                      'ceramic_fragment',
                      'small_find',
                    ].map((c) => (
                      <option key={c} value={c}>
                        {c.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-row" style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Category</label>
                  <select id="af_category">
                    {[
                      'pottery',
                      'lithic',
                      'hard_animal_material',
                      'clay_artefact',
                      'metal_artefact',
                      'pot',
                      'figurine',
                      'sample',
                      'animal_bone',
                      'ceramic_fragment',
                      'small_find',
                    ].map((c) => (
                      <option key={c} value={c}>
                        {c.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Number</label>
                  <input type="text" id="af_number" />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Type</label>
                  <input type="text" id="af_type" />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Context/Feature</label>
                  <input type="text" id="af_feature" placeholder="Context or Feature ID" />
                </div>
              </div>
              <div className="form-row" style={{ display: 'flex', gap: 8 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Area/Surface</label>
                  <input type="text" id="af_area" />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Grid Square</label>
                  <input type="text" id="af_grid" />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Depth</label>
                  <input type="text" id="af_depth" />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>SU</label>
                  <input type="text" id="af_su" />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Quantity</label>
                  <input type="number" id="af_qty" />
                </div>
              </div>
              <div className="form-group">
                <label>Other Observations</label>
                <input type="text" id="af_obs" />
              </div>
              <div className="modal-buttons" style={{ marginTop: 8 }}>
                <button type="button" className="confirm" id="af_addBtn">
                  Add Entry
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => apiRef.current.exportArtefactsCSV()}
                >
                  Export Artefacts CSV
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() =>
                    (document.getElementById('af_importInput') as HTMLInputElement)?.click()
                  }
                >
                  Import Artefacts CSV
                </button>
              </div>
              <div id="af_table" className="hierarchy-list" style={{ marginTop: 12 }}></div>
              <input
                type="file"
                id="af_importInput"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = (e.target as HTMLInputElement).files?.[0];
                  if (f) apiRef.current.__importArtefactsCSV(f);
                  (e.target as HTMLInputElement).value = '';
                }}
              />
            </div>

            <div
              id="export-tab"
              className={`tab-content ${activeTab === 'export' ? 'active' : ''}`}
            >
              <h3>Export & Import</h3>
              <div className="button-grid">
                <button className="btn-primary" onClick={() => apiRef.current.exportCSV()}>
                  Export CSV
                </button>
                <button className="btn-primary" onClick={() => apiRef.current.exportSVG()}>
                  Export SVG
                </button>
                <button className="btn-primary" onClick={() => apiRef.current.importCSV()}>
                  Import CSV
                </button>
              </div>
              <h3 style={{ marginTop: 12 }}>Start Over</h3>
              <div className="button-grid">
                <button className="btn-danger" onClick={() => apiRef.current.clearAll()}>
                  Clear All
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                id="csvFileInput"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={(e) =>
                  apiRef.current && apiRef.current.__handleFileSelect
                    ? apiRef.current.__handleFileSelect(e)
                    : undefined
                }
              />
            </div>
          </div>
        </div>
      </div>

      {overlayData && (
        <div className="group-overlay-backdrop" onClick={handleOverlayClose}>
          <div
            className="group-overlay"
            onClick={(e) => e.stopPropagation()}
            style={{ borderTopColor: overlayData.color }}
          >
            <div className="group-overlay-header">
              <div className="group-overlay-heading">
                <span className="group-color-chip" style={{ background: overlayData.color }}></span>
                <div>
                  <div className="group-overlay-title">
                    {overlayData.name ||
                      (overlayData.type === 'group' ? 'Untitled Group' : 'Untitled Sub-Group')}
                  </div>
                  <div className="group-overlay-meta">
                    {overlayData.type === 'group' ? 'Group' : 'Sub-Group'} •{' '}
                    {overlayData.contexts.length} context
                    {overlayData.contexts.length === 1 ? '' : 's'}
                  </div>
                </div>
              </div>
              <div className="group-overlay-actions">
                {canEdit && (
                  <button
                    type="button"
                    className="group-edit-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      openGroupModalRef.current?.(overlayData.type, 'edit', overlayData.id);
                    }}
                    aria-label="Edit group"
                  >
                    <HiDotsHorizontal size={18} />
                  </button>
                )}
                <button
                  type="button"
                  className="group-overlay-close"
                  onClick={handleOverlayClose}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            </div>
            {overlayData.description && (
              <p className="group-overlay-description">{overlayData.description}</p>
            )}
            <div className="group-overlay-contexts">
              {overlayData.contexts.length === 0 ? (
                <div className="context-card empty">No contexts assigned yet.</div>
              ) : (
                overlayData.contexts.map((ctx) => (
                  <div key={ctx.id} className="context-card">
                    <div className="context-card-title">{ctx.label}</div>
                    <div className="context-card-meta">{ctx.type || 'layer'}</div>
                    {ctx.description && (
                      <div className="context-card-description">{ctx.description}</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {/* Import Modal */}
      <div id="importModal" className="modal-backdrop">
        <div className="modal-content">
          <h4>Map CSV Columns to Import</h4>
          <p style={{ fontSize: '0.9em', marginBottom: 15 }}>
            Select which column from your CSV file corresponds to each data field. Context ID is
            required.
          </p>
          <div className="form-group">
            <label>Context ID (Required)</label>
            <select id="mapContextId"></select>
          </div>
          <div className="form-group">
            <label>Description</label>
            <select id="mapDescription"></select>
          </div>
          <hr style={{ margin: '16px 0' }} />
          <h5 style={{ marginBottom: 10 }}>For Relationships</h5>
          <div className="form-group">
            <label>Relationship Type</label>
            <select id="mapRelType"></select>
          </div>
          <div className="form-group">
            <label>Related Context ID</label>
            <select id="mapRelTo"></select>
          </div>
          <hr style={{ margin: '16px 0' }} />
          <div className="form-group">
            <label>
              <input type="checkbox" id="importClearData" defaultChecked /> Clear all existing data
              before import
            </label>
          </div>
          <div className="modal-buttons">
            <button id="confirmImportBtn" className="confirm">
              Import Data
            </button>
            <button
              className="cancel"
              onClick={() =>
                ((document.getElementById('importModal') as any).style.display = 'none')
              }
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Context Modal */}
      <div id="contextModal" className="modal-backdrop">
        <div className="modal-content">
          <h4>Create New Context</h4>
          <div className="form-group">
            <label>Context Identifier</label>
            <input type="text" id="newContextId" placeholder="e.g., 1001" />
          </div>
          <div className="form-group">
            <label>Context Type</label>
            <select id="contextType">
              <option value="layer">Layer</option>
              <option value="cut">Cut</option>
              <option value="fill">Fill</option>
              <option value="structure">Structure</option>
              <option value="interface">Interface</option>
            </select>
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea id="contextDescription" rows={2} placeholder="Brief description" />
          </div>
          <div className="form-group">
            <label>Dating Evidence (optional)</label>
            <label style={{ fontSize: '0.9em', fontWeight: 'normal', marginTop: 5 }}>
              Earliest Date
            </label>
            <div className="date-inputs">
              <input type="number" id="earliestDateYear" placeholder="Year" />
              <select id="earliestDateEra">
                <option>BCE</option>
                <option selected>CE</option>
              </select>
            </div>
            <label style={{ fontSize: '0.9em', fontWeight: 'normal', marginTop: 5 }}>
              Latest Date
            </label>
            <div className="date-inputs">
              <input type="number" id="latestDateYear" placeholder="Year" />
              <select id="latestDateEra">
                <option>BCE</option>
                <option selected>CE</option>
              </select>
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
            <button id="confirmContextBtn" className="confirm">
              Create
            </button>
            <button
              className="cancel"
              onClick={() =>
                ((document.getElementById('contextModal') as any).style.display = 'none')
              }
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Relationship Modal */}
      <div id="relationshipModal" className="modal-backdrop">
        <div className="modal-content">
          <h4 id="relationshipModalTitle">Define Relationship</h4>
          <select id="relationshipType"></select>
          <div className="modal-buttons">
            <button id="confirmRelationshipBtn" className="confirm">
              Add
            </button>
            <button
              className="cancel"
              onClick={() =>
                ((document.getElementById('relationshipModal') as any).style.display = 'none')
              }
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Edit Node Modal */}
      <div id="editNodeModal" className="modal-backdrop">
        <div className="modal-content">
          <h4 id="editNodeModalTitle">Edit Context</h4>
          <div className="form-group">
            <label>Context Identifier</label>
            <input type="text" id="editNodeIdInput" />
          </div>
          <div className="form-group">
            <label>Context Type</label>
            <select id="editContextType">
              <option value="layer">Layer</option>
              <option value="cut">Cut</option>
              <option value="fill">Fill</option>
              <option value="structure">Structure</option>
              <option value="interface">Interface</option>
            </select>
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea id="editContextDescription" rows={2}></textarea>
          </div>
          <div className="form-group">
            <label>Dating Evidence</label>
            <label style={{ fontSize: '0.9em', fontWeight: 'normal', marginTop: 5 }}>
              Earliest Date
            </label>
            <div className="date-inputs">
              <input type="number" id="editEarliestDateYear" placeholder="Year" />
              <select id="editEarliestDateEra">
                <option>BCE</option>
                <option selected>CE</option>
              </select>
            </div>
            <label style={{ fontSize: '0.9em', fontWeight: 'normal', marginTop: 5 }}>
              Latest Date
            </label>
            <div className="date-inputs">
              <input type="number" id="editLatestDateYear" placeholder="Year" />
              <select id="editLatestDateEra">
                <option>BCE</option>
                <option selected>CE</option>
              </select>
            </div>
            <select id="editDateType" style={{ marginTop: 10 }}>
              <option value="">— Date Type —</option>
              <option>Absolute</option>
              <option>Relative</option>
              <option>Terminus Ante Quem</option>
              <option>Terminus Post Quem</option>
            </select>
          </div>
          <div className="form-group">
            <label>Group Assignment</label>
            <select id="editGroupAssignment">
              <option value="">— None —</option>
            </select>
          </div>
          <div className="form-group">
            <label>Sub-Group Assignment</label>
            <select id="editSubGroupAssignment">
              <option value="">— None —</option>
            </select>
          </div>
          <div className="form-group">
            <label>Phase Assignment</label>
            <select id="editPhaseAssignment">
              <option value="">— None —</option>
            </select>
          </div>
          <div className="modal-buttons">
            <button id="saveNodeBtn" className="confirm">
              Save Changes
            </button>
            <button
              className="cancel"
              onClick={() =>
                ((document.getElementById('editNodeModal') as any).style.display = 'none')
              }
            >
              Cancel
            </button>
          </div>
          <button id="deleteNodeBtn" className="danger" style={{ width: '100%', marginTop: 10 }}>
            Delete Context
          </button>
        </div>
      </div>

      {/* Group / Subgroup / Phase Modal */}
      <div id="groupModal" className="modal-backdrop">
        <div className="modal-content">
          <h4 id="groupModalTitle">Create Group</h4>
          <div className="form-group">
            <label>Name</label>
            <input type="text" id="groupName" placeholder="e.g., Building A" />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea id="groupDescription" rows={2} placeholder="Description" />
          </div>
          <div className="form-group" id="groupTypeWrapper">
            <label>Group Type</label>
            <select id="groupType">
              <option value="functional">Functional</option>
              <option value="spatial">Spatial</option>
              <option value="material">Material</option>
            </select>
          </div>
          <div className="form-group" id="groupColorRow">
            <label>Colour</label>
            <div className="color-input-row">
              <input type="color" id="groupColor" />
              <button type="button" id="groupRandomizeColor" className="color-randomize">
                Randomize
              </button>
            </div>
          </div>
          <div className="modal-buttons">
            <button id="confirmGroupBtn" className="confirm">
              Create
            </button>
            <button
              className="cancel"
              onClick={() =>
                ((document.getElementById('groupModal') as any).style.display = 'none')
              }
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HarrisMatrix;
