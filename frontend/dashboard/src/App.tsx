import axios from 'axios'
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FileText,
  LogOut,
  RotateCcw,
  Search,
  Shield,
  UserPlus,
  Users,
} from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

type User = {
  id: string
  email: string
  username: string | null
  display_name: string | null
  firebase_uid: string
  is_emonument_privileged: boolean
  is_dashboard_admin: boolean
  is_maintainer: boolean
  created_at: string
  last_login: string | null
}

type InstanceStatus =
  | 'draft'
  | 'completat'
  | 'finalizat'
  | 'in_verificare'
  | 'in_aprobare'
  | 'validat'
  | 'reintors'

type Instance = {
  id: string
  monument_id: string
  user_id: string | null
  status: InstanceStatus
  version: number
  data: Record<string, unknown>
  rejection_reason: string | null
  updated_at: string
}

type AuthResponse = {
  access_token: string
  user: User
}

type InstanceSortKey = 'updated_at' | 'status' | 'version' | 'id'

type DownloadSection = {
  key: string
  label: string
  fields: string[]
}

type DownloadTreeNode = {
  id: string
  label: string
  fullPath: string | null
  children: DownloadTreeNode[]
}

type BackupItem = {
  backup_id: string
  created_at: string
  trigger: string
  sql_size_bytes: number
  database_names: string[]
  storage_bucket_names: string[]
  storage_object_count: number
  stats: Record<string, number>
}

type BackupListResponse = {
  last_backup_at: string | null
  retention_limit: number
  backups: BackupItem[]
}

type BackupDiffResponse = {
  backup_id: string
  backup_created_at: string
  backup_stats: Record<string, number>
  live_stats: Record<string, number>
  differences: Record<
    string,
    {
      backup: number
      live: number
      delta_live_minus_backup: number
    }
  >
}

type BackupScheduleResponse = {
  enabled: boolean
  interval_minutes: number
  last_backup_at: string | null
  next_backup_at: string | null
  seconds_until_next_backup: number | null
}

const INSTANCE_META_FIELDS = [
  'id',
  'status',
  'version',
  'updated_at',
  'monument_id',
  'user_id',
  'rejection_reason',
] as const

const resolveApiBaseUrl = () => {
  const configuredApiUrl = import.meta.env.VITE_API_URL?.trim()
  if (configuredApiUrl) return configuredApiUrl

  if (import.meta.env.PROD) {
    return 'https://stratumarcheology.com/api'
  }

  return 'http://localhost:8000/api'
}

const api = axios.create({
  baseURL: resolveApiBaseUrl(),
})

const isDev = Boolean(import.meta.env.DEV)

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('dashboard_token'))
  const [me, setMe] = useState<User | null>(null)
  const [tab, setTab] = useState<'users' | 'instances' | 'downloads' | 'backups' | 'form-view'>('users')
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null)
  const [expandedPinMapKey, setExpandedPinMapKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [instanceSearch, setInstanceSearch] = useState('')
  const [instanceStatusFilter, setInstanceStatusFilter] = useState<'all' | InstanceStatus>('all')
  const [includeDrafts, setIncludeDrafts] = useState(false)
  const [compactRows, setCompactRows] = useState(true)
  const [instanceSortKey, setInstanceSortKey] = useState<InstanceSortKey>('updated_at')
  const [instanceSortDirection, setInstanceSortDirection] = useState<'asc' | 'desc'>('desc')
  const [instancePage, setInstancePage] = useState(1)
  const [instancePageSize, setInstancePageSize] = useState(25)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [users, setUsers] = useState<User[]>([])
  const [instances, setInstances] = useState<Instance[]>([])

  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [newUserName, setNewUserName] = useState('')
  const [newUserUsername, setNewUserUsername] = useState('')
  const [newUserPrivileged, setNewUserPrivileged] = useState(true)
  const [newUserAdmin, setNewUserAdmin] = useState(false)
  const [selectedDownloadFields, setSelectedDownloadFields] = useState<string[]>([])
  const [expandedDownloadSections, setExpandedDownloadSections] = useState<Record<string, boolean>>({})
  const [expandedDownloadNodes, setExpandedDownloadNodes] = useState<Record<string, boolean>>({})
  const [backups, setBackups] = useState<BackupItem[]>([])
  const [backupsLastAt, setBackupsLastAt] = useState<string | null>(null)
  const [backupsRetentionLimit, setBackupsRetentionLimit] = useState<number>(5)
  const [backupDiffsById, setBackupDiffsById] = useState<Record<string, BackupDiffResponse>>({})
  const [backupSchedule, setBackupSchedule] = useState<BackupScheduleResponse | null>(null)
  const [backupCountdownTick, setBackupCountdownTick] = useState(0)
  const [backupLoading, setBackupLoading] = useState(false)
  const [backupActionLoadingId, setBackupActionLoadingId] = useState<string | null>(null)
  const [backupRunLoading, setBackupRunLoading] = useState(false)

  const authHeaders = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : undefined),
    [token],
  )

  const selectedInstance = useMemo(
    () => (selectedInstanceId ? instances.find((instance) => instance.id === selectedInstanceId) ?? null : null),
    [instances, selectedInstanceId],
  )

  const isMaintainer = useMemo(
    () => Boolean(me?.is_maintainer),
    [me?.is_maintainer],
  )

  const secondsUntilNextBackup = useMemo(
    () => calculateRemainingSeconds(),
    [backupSchedule?.next_backup_at, backupSchedule?.enabled, backupCountdownTick],
  )

  const statusCounts = useMemo(() => {
    const counts: Record<InstanceStatus, number> = {
      draft: 0,
      completat: 0,
      finalizat: 0,
      in_verificare: 0,
      in_aprobare: 0,
      validat: 0,
      reintors: 0,
    }
    for (const instance of instances) {
      counts[instance.status] += 1
    }
    return counts
  }, [instances])

  const filteredSortedInstances = useMemo(() => {
    const query = instanceSearch.trim().toLowerCase()

    const filtered = instances
      .filter((instance) => (includeDrafts ? true : instance.status !== 'draft'))
      .filter((instance) =>
        instanceStatusFilter === 'all' ? true : instance.status === instanceStatusFilter,
      )
      .filter((instance) => {
        if (!query) return true
        const haystack = [
          instance.id,
          instance.status,
          String(instance.version),
          instance.monument_id,
          instance.user_id ?? '',
          instance.rejection_reason ?? '',
          new Date(instance.updated_at).toLocaleString(),
        ]
          .join(' ')
          .toLowerCase()
        return haystack.includes(query)
      })

    filtered.sort((a, b) => {
      let result = 0

      if (instanceSortKey === 'updated_at') {
        result = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
      } else if (instanceSortKey === 'version') {
        result = a.version - b.version
      } else if (instanceSortKey === 'status') {
        result = a.status.localeCompare(b.status)
      } else {
        result = a.id.localeCompare(b.id)
      }

      return instanceSortDirection === 'asc' ? result : -result
    })

    return filtered
  }, [
    instances,
    includeDrafts,
    instanceStatusFilter,
    instanceSearch,
    instanceSortDirection,
    instanceSortKey,
  ])

  const totalInstancePages = Math.max(1, Math.ceil(filteredSortedInstances.length / instancePageSize))

  const paginatedInstances = useMemo(() => {
    const start = (instancePage - 1) * instancePageSize
    return filteredSortedInstances.slice(start, start + instancePageSize)
  }, [filteredSortedInstances, instancePage, instancePageSize])

  const visibleRangeLabel = useMemo(() => {
    if (filteredSortedInstances.length === 0) return '0-0'
    const start = (instancePage - 1) * instancePageSize + 1
    const end = Math.min(start + instancePageSize - 1, filteredSortedInstances.length)
    return `${start}-${end}`
  }, [filteredSortedInstances.length, instancePage, instancePageSize])

  const statusLabel = (status: InstanceStatus) =>
    ({
      draft: 'Draft',
      completat: 'Completat',
      finalizat: 'Finalizat',
      in_verificare: 'In verificare',
      in_aprobare: 'In aprobare',
      validat: 'Validat',
      reintors: 'Reintors',
    }[status] ?? status)

  const formatFieldLabel = (raw: string) =>
    raw
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase())

  const collectFieldPaths = (value: unknown, prefix: string, out: Set<string>) => {
    if (value == null) {
      out.add(prefix)
      return
    }

    if (Array.isArray(value)) {
      out.add(prefix)
      return
    }

    if (typeof value !== 'object') {
      out.add(prefix)
      return
    }

    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) {
      out.add(prefix)
      return
    }

    for (const [key, nested] of entries) {
      collectFieldPaths(nested, `${prefix}.${key}`, out)
    }
  }

  const downloadSections = useMemo<DownloadSection[]>(() => {
    const bySection = new Map<string, Set<string>>()

    for (const instance of instances) {
      const rootEntries = Object.entries(instance.data ?? {})
      for (const [sectionKey, sectionValue] of rootEntries) {
        if (!bySection.has(sectionKey)) {
          bySection.set(sectionKey, new Set())
        }
        const sectionSet = bySection.get(sectionKey)
        if (!sectionSet) continue

        if (sectionValue == null || typeof sectionValue !== 'object' || Array.isArray(sectionValue)) {
          sectionSet.add(sectionKey)
          continue
        }

        const entries = Object.entries(sectionValue as Record<string, unknown>)
        if (entries.length === 0) {
          sectionSet.add(sectionKey)
          continue
        }

        for (const [fieldKey, fieldValue] of entries) {
          collectFieldPaths(fieldValue, `${sectionKey}.${fieldKey}`, sectionSet)
        }
      }
    }

    const systemSection: DownloadSection = {
      key: '__system__',
      label: 'System Fields',
      fields: [...INSTANCE_META_FIELDS],
    }

    const dynamicSections = [...bySection.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, fields]) => ({
        key,
        label: formatFieldLabel(key),
        fields: [...fields].sort((a, b) => a.localeCompare(b)),
      }))

    return [systemSection, ...dynamicSections]
  }, [instances])

  const allDownloadFields = useMemo(
    () => downloadSections.flatMap((section) => section.fields),
    [downloadSections],
  )

  const buildSectionTree = (section: DownloadSection): DownloadTreeNode[] => {
    type MutableTreeNode = {
      id: string
      label: string
      fullPath: string | null
      children: Map<string, MutableTreeNode>
    }

    const root = new Map<string, MutableTreeNode>()
    const sectionPrefix = `${section.key}.`

    for (const fullFieldPath of section.fields) {
      const relativePath =
        section.key === '__system__'
          ? fullFieldPath
          : fullFieldPath.startsWith(sectionPrefix)
            ? fullFieldPath.slice(sectionPrefix.length)
            : fullFieldPath

      const segments = relativePath.split('.').filter(Boolean)
      if (segments.length === 0) {
        continue
      }

      let level = root
      let nodeIdPath = section.key

      for (let i = 0; i < segments.length; i += 1) {
        const segment = segments[i]
        nodeIdPath = `${nodeIdPath}.${segment}`

        if (!level.has(segment)) {
          level.set(segment, {
            id: `${section.key}:${nodeIdPath}`,
            label: formatFieldLabel(segment),
            fullPath: null,
            children: new Map<string, MutableTreeNode>(),
          })
        }

        const current = level.get(segment)
        if (!current) {
          break
        }

        if (i === segments.length - 1) {
          current.fullPath = fullFieldPath
        }

        level = current.children
      }
    }

    const toImmutable = (nodes: Map<string, MutableTreeNode>): DownloadTreeNode[] =>
      [...nodes.values()]
        .sort((a, b) => a.label.localeCompare(b.label))
        .map((node) => ({
          id: node.id,
          label: node.label,
          fullPath: node.fullPath,
          children: toImmutable(node.children),
        }))

    return toImmutable(root)
  }

  useEffect(() => {
    setSelectedDownloadFields((prev) => {
      if (allDownloadFields.length === 0) {
        return []
      }
      if (prev.length === 0) {
        return allDownloadFields
      }
      const allowed = new Set(allDownloadFields)
      const next = prev.filter((field) => allowed.has(field))
      return next.length === prev.length ? prev : next
    })
  }, [allDownloadFields])

  useEffect(() => {
    setExpandedDownloadSections((prev) => {
      const next = { ...prev }
      for (const section of downloadSections) {
        if (next[section.key] === undefined) {
          next[section.key] = false
        }
      }
      return next
    })
  }, [downloadSections])

  const formatPrimitiveValue = (value: string | number | boolean) => {
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '-'

    const trimmed = value.trim()
    if (!trimmed) return '-'

    const asDate = Date.parse(trimmed)
    if (Number.isNaN(asDate)) return trimmed

    const isoDatePattern = /^\d{4}-\d{2}-\d{2}(T|\s|$)/
    if (!isoDatePattern.test(trimmed)) return trimmed

    return new Date(asDate).toLocaleString()
  }

  const parseCoordinatePair = (value: string) => {
    const match = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/)
    if (!match) return null

    const latitude = Number(match[1])
    const longitude = Number(match[2])

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null

    return { latitude, longitude }
  }

  const buildMapUrl = (latitude: number, longitude: number) =>
    `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`

  const buildMapEmbedUrl = (latitude: number, longitude: number) => {
    const delta = 0.0025
    const left = longitude - delta
    const right = longitude + delta
    const top = latitude + delta
    const bottom = latitude - delta

    return `https://www.openstreetmap.org/export/embed.html?bbox=${left},${bottom},${right},${top}&layer=mapnik&marker=${latitude},${longitude}`
  }

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)

  const summarizeValue = (value: unknown) => {
    if (value == null) return 'No data'
    if (Array.isArray(value)) return `${value.length} entries`
    if (isRecord(value)) return `${Object.keys(value).length} fields`
    return 'Single value'
  }

  function renderProcessedValue(value: unknown, keyPath: string, depth = 0) {
    if (value == null) {
      return <span className="processed-empty">-</span>
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      if (typeof value === 'string' && /(?:^|\.)pin$/.test(keyPath)) {
        const coordinates = parseCoordinatePair(value)
        if (coordinates) {
          const isMapVisible = expandedPinMapKey === keyPath

          return (
            <div className="pin-field-inline">
              <span>{formatPrimitiveValue(value)}</span>
              <button
                type="button"
                className="small ghost pin-map-link"
                onClick={() => setExpandedPinMapKey((prev) => (prev === keyPath ? null : keyPath))}
              >
                {isMapVisible ? 'Hide map' : 'Show map'}
              </button>
              <a
                className="small ghost pin-map-link"
                href={buildMapUrl(coordinates.latitude, coordinates.longitude)}
                target="_blank"
                rel="noreferrer"
              >
                Open external
              </a>
              {isMapVisible ? (
                <div className="pin-map-embed-wrap">
                  <iframe
                    className="pin-map-embed"
                    src={buildMapEmbedUrl(coordinates.latitude, coordinates.longitude)}
                    title={`PIN map ${keyPath}`}
                    loading="lazy"
                  />
                </div>
              ) : null}
            </div>
          )
        }
      }

      return <span>{formatPrimitiveValue(value)}</span>
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="processed-empty">Empty list</span>
      }

      const primitiveOnly = value.every(
        (item) => item == null || ['string', 'number', 'boolean'].includes(typeof item),
      )

      if (primitiveOnly) {
        return (
          <ul className="processed-list-compact">
            {value.map((item, index) => (
              <li key={`${keyPath}-item-${index}`}>{item == null ? '-' : formatPrimitiveValue(item as string | number | boolean)}</li>
            ))}
          </ul>
        )
      }

      return (
        <div className="processed-block-stack">
          {value.map((item, index) => (
            <div key={`${keyPath}-group-${index}`} className="processed-group">
              <div className="processed-group-title">Entry {index + 1}</div>
              {renderProcessedValue(item, `${keyPath}.${index}`, depth + 1)}
            </div>
          ))}
        </div>
      )
    }

    const objectValue = value as Record<string, unknown>
    const entries = Object.entries(objectValue)

    if (entries.length === 0) {
      return <span className="processed-empty">No data</span>
    }

    return (
      <div className={`processed-table ${depth > 0 ? 'nested' : ''}`}>
        {entries.map(([key, nestedValue]) => (
          <div className="processed-row" key={`${keyPath}.${key}`}>
            <div className="processed-key">{formatFieldLabel(key)}</div>
            <div className="processed-value">{renderProcessedValue(nestedValue, `${keyPath}.${key}`, depth + 1)}</div>
          </div>
        ))}
      </div>
    )
  }

  function renderProcessedRoot(value: unknown) {
    if (!isRecord(value)) {
      return renderProcessedValue(value, 'root')
    }

    const sections = Object.entries(value)

    if (sections.length === 0) {
      return <p className="processed-empty padded">No submitted fields.</p>
    }

    return (
      <div className="processed-sections-grid">
        {sections.map(([sectionKey, sectionValue]) => (
          <article className="processed-section-card" key={`section-${sectionKey}`}>
            <header className="processed-section-header">
              <h4>{formatFieldLabel(sectionKey)}</h4>
              <span className="processed-section-meta">{summarizeValue(sectionValue)}</span>
            </header>
            <div className="processed-section-body">{renderProcessedValue(sectionValue, `root.${sectionKey}`, 1)}</div>
          </article>
        ))}
      </div>
    )
  }

  const copyToClipboard = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      setError('Clipboard unavailable in this browser context.')
    }
  }

  const triggerFileDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const exportInstancesCsv = () => {
    const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`

    const headers = [
      'id',
      'status',
      'version',
      'updated_at',
      'monument_id',
      'user_id',
      'rejection_reason',
    ]
    const lines = filteredSortedInstances.map((instance) =>
      [
        instance.id,
        instance.status,
        String(instance.version),
        instance.updated_at,
        instance.monument_id,
        instance.user_id ?? '',
        instance.rejection_reason ?? '',
      ]
        .map((value) => escapeCsv(value))
        .join(','),
    )

    const csv = [headers.join(','), ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    triggerFileDownload(
      blob,
      `emonument_instances_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`,
    )
  }

  const downloadWholeFormsDatabase = async () => {
    if (!authHeaders) return

    setError(null)
    try {
      const res = await api.get<Instance[]>('/emonument/instances', { headers: authHeaders })
      const exportPayload = {
        exported_at: new Date().toISOString(),
        total_forms: res.data.length,
        forms: res.data,
      }
      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
        type: 'application/json;charset=utf-8;',
      })
      triggerFileDownload(
        blob,
        `emonument_forms_database_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`,
      )
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.detail ?? 'Could not download forms database'
        : 'Could not download forms database'
      setError(message)
    }
  }

  const sectionIsFullySelected = (fields: string[]) =>
    fields.length > 0 && fields.every((field) => selectedDownloadFields.includes(field))

  const sectionSelectedCount = (fields: string[]) =>
    fields.reduce((count, field) => (selectedDownloadFields.includes(field) ? count + 1 : count), 0)

  const getNodeLeafPaths = (node: DownloadTreeNode): string[] => {
    const out = new Set<string>()
    const walk = (entry: DownloadTreeNode) => {
      if (entry.fullPath) {
        out.add(entry.fullPath)
      }
      for (const child of entry.children) {
        walk(child)
      }
    }
    walk(node)
    return [...out]
  }

  const toggleSectionSelection = (fields: string[]) => {
    const allSelected = sectionIsFullySelected(fields)
    setSelectedDownloadFields((prev) => {
      if (allSelected) {
        return prev.filter((field) => !fields.includes(field))
      }
      const next = new Set(prev)
      for (const field of fields) {
        next.add(field)
      }
      return [...next]
    })
  }

  const toggleSectionExpanded = (sectionKey: string) => {
    setExpandedDownloadSections((prev) => ({
      ...prev,
      [sectionKey]: !(prev[sectionKey] ?? false),
    }))
  }

  const toggleNodeExpanded = (nodeId: string) => {
    setExpandedDownloadNodes((prev) => ({
      ...prev,
      [nodeId]: !(prev[nodeId] ?? false),
    }))
  }

  const toggleNodeSelection = (node: DownloadTreeNode) => {
    const leafPaths = getNodeLeafPaths(node)
    const allSelected = leafPaths.length > 0 && leafPaths.every((path) => selectedDownloadFields.includes(path))

    setSelectedDownloadFields((prev) => {
      if (allSelected) {
        return prev.filter((field) => !leafPaths.includes(field))
      }

      const next = new Set(prev)
      for (const path of leafPaths) {
        next.add(path)
      }
      return [...next]
    })
  }

  const selectAllDownloadFields = () => {
    setSelectedDownloadFields(allDownloadFields)
  }

  const clearAllDownloadFields = () => {
    setSelectedDownloadFields([])
  }

  const expandAllSections = () => {
    const next: Record<string, boolean> = {}
    for (const section of downloadSections) {
      next[section.key] = true
    }
    setExpandedDownloadSections(next)
  }

  const collapseAllSections = () => {
    const next: Record<string, boolean> = {}
    for (const section of downloadSections) {
      next[section.key] = false
    }
    setExpandedDownloadSections(next)
  }

  const getPathValue = (root: Record<string, unknown>, path: string) => {
    const segments = path.split('.')
    let cursor: unknown = root
    for (const segment of segments) {
      if (cursor == null || typeof cursor !== 'object' || Array.isArray(cursor)) {
        return undefined
      }
      cursor = (cursor as Record<string, unknown>)[segment]
    }
    return cursor
  }

  const setPathValue = (root: Record<string, unknown>, path: string, value: unknown) => {
    const segments = path.split('.')
    let cursor: Record<string, unknown> = root

    for (let i = 0; i < segments.length - 1; i += 1) {
      const segment = segments[i]
      const existing = cursor[segment]
      if (existing == null || typeof existing !== 'object' || Array.isArray(existing)) {
        cursor[segment] = {}
      }
      cursor = cursor[segment] as Record<string, unknown>
    }

    cursor[segments[segments.length - 1]] = value
  }

  const downloadSelectedForms = () => {
    if (selectedDownloadFields.length === 0) {
      setError('Select at least one field before exporting.')
      return
    }

    setError(null)
    const selectedSet = new Set(selectedDownloadFields)
    const selectedMetaFields = INSTANCE_META_FIELDS.filter((field) => selectedSet.has(field))
    const selectedDataFields = selectedDownloadFields.filter((field) => !INSTANCE_META_FIELDS.includes(field as (typeof INSTANCE_META_FIELDS)[number]))

    const forms = instances.map((instance) => {
      const out: Record<string, unknown> = {}

      for (const field of selectedMetaFields) {
        out[field] = instance[field]
      }

      const dataOut: Record<string, unknown> = {}
      for (const path of selectedDataFields) {
        const value = getPathValue(instance.data, path)
        if (value !== undefined) {
          setPathValue(dataOut, path, value)
        }
      }

      out.data = dataOut
      return out
    })

    const payload = {
      exported_at: new Date().toISOString(),
      total_forms: forms.length,
      selected_fields: selectedDownloadFields,
      forms,
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8;',
    })
    triggerFileDownload(
      blob,
      `emonument_forms_selected_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`,
    )
  }

  const renderDownloadNode = (node: DownloadTreeNode, depth = 0) => {
    const hasChildren = node.children.length > 0
    const isExpanded = expandedDownloadNodes[node.id] ?? false
    const leafPaths = getNodeLeafPaths(node)
    const selectedCount = leafPaths.filter((path) => selectedDownloadFields.includes(path)).length
    const allSelected = leafPaths.length > 0 && selectedCount === leafPaths.length

    return (
      <div className="download-tree-node" key={node.id} style={{ marginLeft: `${depth * 14}px` }}>
        <div className="download-tree-row">
          {hasChildren ? (
            <button
              type="button"
              className="download-expand-btn"
              onClick={() => toggleNodeExpanded(node.id)}
              title={isExpanded ? 'Collapse group' : 'Expand group'}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <span className="download-expand-placeholder" />
          )}

          <label className="download-field-option">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => toggleNodeSelection(node)}
            />
            <span>
              {node.label}
              {hasChildren ? ` (${selectedCount}/${leafPaths.length})` : ''}
            </span>
          </label>
        </div>

        {hasChildren && isExpanded ? (
          <div className="download-tree-children">
            {node.children.map((child) => renderDownloadNode(child, depth + 1))}
          </div>
        ) : null}
      </div>
    )
  }

  const toggleSort = (key: InstanceSortKey) => {
    if (instanceSortKey === key) {
      setInstanceSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setInstanceSortKey(key)
    setInstanceSortDirection('desc')
  }

  useEffect(() => {
    setInstancePage(1)
  }, [instanceSearch, instanceStatusFilter, includeDrafts, instancePageSize])

  useEffect(() => {
    if (instancePage > totalInstancePages) {
      setInstancePage(totalInstancePages)
    }
  }, [instancePage, totalInstancePages])

  useEffect(() => {
    setExpandedPinMapKey(null)
  }, [selectedInstanceId])

  const fillLoginDev = () => {
    setEmail(import.meta.env.VITE_DEV_DASHBOARD_EMAIL ?? 'admin@example.com')
    setPassword(import.meta.env.VITE_DEV_DASHBOARD_PASSWORD ?? 'password123')
    setError(null)
  }

  const fillCreateUserDev = () => {
    const stamp = Date.now()
    setNewUserEmail(`emonument.user.${stamp}@example.com`)
    setNewUserPassword('password123')
    setNewUserName(`eMonument User ${new Date().toLocaleTimeString()}`)
    setNewUserUsername(`emon_user_${stamp.toString().slice(-6)}`)
    setNewUserPrivileged(true)
    setNewUserAdmin(false)
    setError(null)
  }

  const formatBytes = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB']
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
    const value = bytes / 1024 ** index
    return `${value.toFixed(index === 0 ? 0 : 2)} ${units[index]}`
  }

  const formatDuration = (totalSeconds: number | null) => {
    if (totalSeconds == null) return 'N/A'
    if (totalSeconds <= 0) return '0s'

    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    const parts: string[] = []
    if (hours > 0) parts.push(`${hours}h`)
    if (minutes > 0 || hours > 0) parts.push(`${minutes}m`)
    parts.push(`${seconds}s`)
    return parts.join(' ')
  }

  function calculateRemainingSeconds() {
    if (!backupSchedule?.enabled || !backupSchedule.next_backup_at) return null
    const nextAtMs = new Date(backupSchedule.next_backup_at).getTime()
    if (!Number.isFinite(nextAtMs)) return null
    return Math.max(0, Math.floor((nextAtMs - Date.now()) / 1000))
  }

  const loadMe = async (jwtToken: string) => {
    const res = await api.get<User>('/auth/me', {
      headers: { Authorization: `Bearer ${jwtToken}` },
    })
    setMe(res.data)
    return res.data
  }

  const loadUsers = async () => {
    if (!authHeaders) return
    const res = await api.get<User[]>('/emonument-dashboard/users', { headers: authHeaders })
    setUsers(res.data)
  }

  const loadInstances = async () => {
    if (!authHeaders) return
    const res = await api.get<Instance[]>('/emonument/instances', { headers: authHeaders })
    setInstances(res.data)
  }

  const loadBackups = async () => {
    if (!authHeaders) return
    setBackupLoading(true)
    try {
      const res = await api.get<BackupListResponse>('/emonument-dashboard/backups', { headers: authHeaders })
      setBackups(res.data.backups)
      setBackupsLastAt(res.data.last_backup_at)
      setBackupsRetentionLimit(res.data.retention_limit)
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.detail ?? 'Could not load backups'
        : 'Could not load backups'
      setError(message)
    } finally {
      setBackupLoading(false)
    }
  }

  const loadBackupSchedule = async () => {
    if (!authHeaders) return
    try {
      const res = await api.get<BackupScheduleResponse>('/emonument-dashboard/backups/schedule', {
        headers: authHeaders,
      })
      setBackupSchedule(res.data)
      if (res.data.last_backup_at) {
        setBackupsLastAt(res.data.last_backup_at)
      }
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.detail ?? 'Could not load backup schedule'
        : 'Could not load backup schedule'
      setError(message)
    }
  }

  const runBackupNow = async () => {
    if (!authHeaders) return
    setBackupRunLoading(true)
    setError(null)
    try {
      await api.post('/emonument-dashboard/backups/run', {}, { headers: authHeaders })
      await Promise.all([loadBackups(), loadBackupSchedule()])
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.detail ?? 'Could not run backup now'
        : 'Could not run backup now'
      setError(message)
    } finally {
      setBackupRunLoading(false)
    }
  }

  const loadBackupDiff = async (backupId: string) => {
    if (!authHeaders) return
    setBackupActionLoadingId(backupId)
    setError(null)
    try {
      const res = await api.get<BackupDiffResponse>(`/emonument-dashboard/backups/${backupId}/diff`, {
        headers: authHeaders,
      })
      setBackupDiffsById((prev) => ({ ...prev, [backupId]: res.data }))
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.detail ?? 'Could not load backup differences'
        : 'Could not load backup differences'
      setError(message)
    } finally {
      setBackupActionLoadingId(null)
    }
  }

  const restoreBackup = async (backupId: string) => {
    if (!authHeaders) return
    const confirmation = window.prompt(`Type RESTORE ${backupId} to confirm database restore:`)
    if (confirmation !== `RESTORE ${backupId}`) return

    setBackupActionLoadingId(backupId)
    setError(null)
    try {
      await api.post(`/emonument-dashboard/backups/${backupId}/restore`, {}, { headers: authHeaders })
      await Promise.all([loadInstances(), loadBackups()])
      alert('Database restored from selected backup.')
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.detail ?? 'Could not restore backup'
        : 'Could not restore backup'
      setError(message)
    } finally {
      setBackupActionLoadingId(null)
    }
  }

  useEffect(() => {
    if (!token) {
      setMe(null)
      return
    }

    loadMe(token)
      .then((currentUser) => {
        const tasks: Promise<void>[] = [loadUsers(), loadInstances()]
        if (currentUser.is_maintainer) {
          tasks.push(loadBackups())
          tasks.push(loadBackupSchedule())
        }
        return Promise.all(tasks)
      })
      .catch(() => {
        localStorage.removeItem('dashboard_token')
        setToken(null)
      })
  }, [token])

  useEffect(() => {
    if (tab !== 'backups' || !isMaintainer) return
    const timer = window.setInterval(() => {
      setBackupCountdownTick((prev) => prev + 1)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [tab, isMaintainer])

  useEffect(() => {
    if (tab !== 'backups' || !isMaintainer) return
    const timer = window.setInterval(() => {
      void loadBackupSchedule()
    }, 30000)
    return () => window.clearInterval(timer)
  }, [tab, isMaintainer, authHeaders])

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await api.post<AuthResponse>('/auth/login', { email, password })
      localStorage.setItem('dashboard_token', res.data.access_token)
      setToken(res.data.access_token)
      setEmail('')
      setPassword('')
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.detail ?? 'Login failed'
        : 'Login failed'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateUser = async (event: FormEvent) => {
    event.preventDefault()
    if (!authHeaders) return
    setError(null)
    setLoading(true)
    try {
      await api.post(
        '/emonument-dashboard/users',
        {
          email: newUserEmail,
          password: newUserPassword,
          display_name: newUserName,
          username: newUserUsername || null,
          is_emonument_privileged: newUserPrivileged,
          is_dashboard_admin: newUserAdmin,
        },
        { headers: authHeaders },
      )
      setNewUserEmail('')
      setNewUserPassword('')
      setNewUserName('')
      setNewUserUsername('')
      setNewUserPrivileged(true)
      setNewUserAdmin(false)
      await loadUsers()
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.detail ?? 'Could not create user'
        : 'Could not create user'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (userId: string) => {
    if (!authHeaders) return
    setError(null)
    try {
      await api.post(`/emonument-dashboard/users/${userId}/password-reset`, {}, { headers: authHeaders })
      alert('Password reset email sent.')
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.detail ?? 'Password reset failed'
        : 'Password reset failed'
      setError(message)
    }
  }

  const updateInstanceStatus = async (instanceId: string, action: 'to-approval' | 'approve') => {
    if (!authHeaders) return
    setError(null)
    try {
      await api.post(`/emonument/instances/${instanceId}/${action}`, {}, { headers: authHeaders })
      await loadInstances()
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.detail ?? 'Instance update failed'
        : 'Instance update failed'
      setError(message)
    }
  }

  const returnInstance = async (instanceId: string) => {
    if (!authHeaders) return
    const reason = window.prompt('Motiv reintoarcere:')
    if (!reason) return
    setError(null)
    try {
      await api.post(
        `/emonument/instances/${instanceId}/return`,
        { reason },
        { headers: authHeaders },
      )
      await loadInstances()
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.detail ?? 'Return failed'
        : 'Return failed'
      setError(message)
    }
  }

  const deleteInstance = async (instanceId: string) => {
    if (!authHeaders) return
    const ok = window.confirm('Delete this form? This action cannot be undone.')
    if (!ok) return

    setError(null)
    try {
      await api.delete(`/emonument/instances/${instanceId}`, { headers: authHeaders })
      if (selectedInstanceId === instanceId) {
        setSelectedInstanceId(null)
        if (tab === 'form-view') {
          setTab('instances')
        }
      }
      await loadInstances()
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.detail ?? 'Delete failed'
        : 'Delete failed'
      setError(message)
    }
  }

  const logout = () => {
    localStorage.removeItem('dashboard_token')
    setToken(null)
    setMe(null)
  }

  if (!token || !me) {
    return (
      <main className="login-shell">
        <section className="login-panel">
          <h1>eMonument Dashboard</h1>
          <p className="subtitle">Control Center for verification, approval and account governance</p>
          <form onSubmit={handleLogin} className="stack">
            <label>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <button type="submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
            {isDev ? (
              <button type="button" className="small ghost" onClick={fillLoginDev}>
                DEV Autofill
              </button>
            ) : null}
          </form>
          {error ? <p className="error-msg">{error}</p> : null}
        </section>
      </main>
    )
  }

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div>
          <h2>eMonument Operations</h2>
          <p>
            Logged as <strong>{me.email}</strong>
          </p>
        </div>
        <button className="ghost" onClick={logout}>
          <LogOut size={16} /> Logout
        </button>
      </header>

      <nav className="tabs">
        <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>
          <Users size={16} /> Accounts
        </button>
        <button className={tab === 'instances' ? 'active' : ''} onClick={() => setTab('instances')}>
          <Shield size={16} /> Validation Flow
        </button>
        <button className={tab === 'downloads' ? 'active' : ''} onClick={() => setTab('downloads')}>
          <Download size={16} /> Downloads
        </button>
        {isMaintainer ? (
          <button className={tab === 'backups' ? 'active' : ''} onClick={() => setTab('backups')}>
            <RotateCcw size={16} /> Backups
          </button>
        ) : null}
        {selectedInstance ? (
          <button className={tab === 'form-view' ? 'active' : ''} onClick={() => setTab('form-view')}>
            <FileText size={16} /> Form View
          </button>
        ) : null}
      </nav>

      {error ? <p className="error-msg">{error}</p> : null}

      {tab === 'users' ? (
        <section className="grid-two">
          <article className="panel">
            <h3>
              <UserPlus size={18} /> Create Account
            </h3>
            <form className="stack" onSubmit={handleCreateUser}>
              <label>
                Email
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  required
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  required
                />
              </label>
              <label>
                Display Name
                <input value={newUserName} onChange={(e) => setNewUserName(e.target.value)} required />
              </label>
              <label>
                Username
                <input value={newUserUsername} onChange={(e) => setNewUserUsername(e.target.value)} />
              </label>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={newUserPrivileged}
                  onChange={(e) => setNewUserPrivileged(e.target.checked)}
                />
                eMonument privileged
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={newUserAdmin}
                  onChange={(e) => setNewUserAdmin(e.target.checked)}
                />
                Dashboard admin
              </label>

              <button type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create'}
              </button>
              {isDev ? (
                <button type="button" className="small ghost" onClick={fillCreateUserDev}>
                  DEV Autofill
                </button>
              ) : null}
            </form>
          </article>

          <article className="panel">
            <h3>Managed Accounts</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Name</th>
                    <th>eMonument</th>
                    <th>Admin</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>{user.email}</td>
                      <td>{user.display_name ?? '-'}</td>
                      <td>{user.is_emonument_privileged ? 'Yes' : 'No'}</td>
                      <td>{user.is_dashboard_admin ? 'Yes' : 'No'}</td>
                      <td>
                        <button className="small" onClick={() => handleResetPassword(user.id)}>
                          Reset
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      ) : tab === 'instances' ? (
        <section className="panel">
          <h3>Forms Table</h3>
          <div className="db-toolbar">
            <label className="db-search">
              <Search size={14} />
              <input
                value={instanceSearch}
                onChange={(event) => setInstanceSearch(event.target.value)}
                placeholder="Search by id, status, user, monument, reason"
              />
            </label>

            <label>
              Status
              <select
                value={instanceStatusFilter}
                onChange={(event) => setInstanceStatusFilter(event.target.value as 'all' | InstanceStatus)}
              >
                <option value="all">All</option>
                <option value="draft">Draft</option>
                <option value="in_verificare">In verificare</option>
                <option value="in_aprobare">In aprobare</option>
                <option value="validat">Validat</option>
                <option value="reintors">Reintors</option>
              </select>
            </label>

            <label>
              Rows
              <select
                value={instancePageSize}
                onChange={(event) => setInstancePageSize(Number(event.target.value))}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>

            <label className="switch-row">
              <input
                type="checkbox"
                checked={includeDrafts}
                onChange={(event) => setIncludeDrafts(event.target.checked)}
              />
              Include drafts
            </label>

            <label className="switch-row">
              <input
                type="checkbox"
                checked={compactRows}
                onChange={(event) => setCompactRows(event.target.checked)}
              />
              Compact rows
            </label>

            <div className="toolbar-spacer" />

            <button className="small ghost" onClick={exportInstancesCsv}>
              <Download size={14} /> Export CSV
            </button>
            <button className="small" onClick={() => void downloadWholeFormsDatabase()}>
              <Download size={14} /> Download Whole Database
            </button>
          </div>

          <div className="db-stats">
            <span className="stat-chip">Total: {instances.length}</span>
            <span className="stat-chip">Draft: {statusCounts.draft}</span>
            <span className="stat-chip">In verificare: {statusCounts.in_verificare}</span>
            <span className="stat-chip">In aprobare: {statusCounts.in_aprobare}</span>
            <span className="stat-chip">Validat: {statusCounts.validat}</span>
            <span className="stat-chip">Reintors: {statusCounts.reintors}</span>
          </div>

          {filteredSortedInstances.length === 0 ? (
            <p>No forms match the current filters.</p>
          ) : (
            <div className="table-wrap tall">
              <table className={`db-table ${compactRows ? 'compact' : ''}`}>
                <thead>
                  <tr>
                    <th>
                      <button className="sort-btn" onClick={() => toggleSort('id')}>
                        ID
                      </button>
                    </th>
                    <th>
                      <button className="sort-btn" onClick={() => toggleSort('status')}>
                        Status
                      </button>
                    </th>
                    <th>
                      <button className="sort-btn" onClick={() => toggleSort('version')}>
                        Version
                      </button>
                    </th>
                    <th>
                      <button className="sort-btn" onClick={() => toggleSort('updated_at')}>
                        Updated
                      </button>
                    </th>
                    <th>Monument</th>
                    <th>User</th>
                    <th>Reason</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedInstances.map((instance) => (
                    <tr
                      key={instance.id}
                      className="clickable-row"
                      onClick={() => {
                        setSelectedInstanceId(instance.id)
                        setTab('form-view')
                      }}
                    >
                      <td className="cell-mono">
                        <span className="truncate">{instance.id}</span>
                        <button
                          className="icon-btn"
                          onClick={(event) => {
                            event.stopPropagation()
                            void copyToClipboard(instance.id)
                          }}
                          title="Copy instance id"
                        >
                          <Copy size={12} />
                        </button>
                      </td>
                      <td>{statusLabel(instance.status)}</td>
                      <td>{instance.version}</td>
                      <td>{new Date(instance.updated_at).toLocaleString()}</td>
                      <td className="cell-mono">
                        <span className="truncate">{instance.monument_id}</span>
                      </td>
                      <td className="cell-mono">
                        <span className="truncate">{instance.user_id ?? '-'}</span>
                      </td>
                      <td>
                        <span className="truncate">{instance.rejection_reason ?? '-'}</span>
                      </td>
                      <td className="actions">
                        {instance.status === 'in_verificare' ? (
                          <button
                            className="small"
                            onClick={(event) => {
                              event.stopPropagation()
                              void updateInstanceStatus(instance.id, 'to-approval')
                            }}
                          >
                            <CheckCircle2 size={14} /> To Approval
                          </button>
                        ) : null}
                        {instance.status === 'in_aprobare' ? (
                          <button
                            className="small"
                            onClick={(event) => {
                              event.stopPropagation()
                              void updateInstanceStatus(instance.id, 'approve')
                            }}
                          >
                            <CheckCircle2 size={14} /> Approve
                          </button>
                        ) : null}
                        {(instance.status === 'in_verificare' || instance.status === 'in_aprobare') ? (
                          <button
                            className="small danger"
                            onClick={(event) => {
                              event.stopPropagation()
                              void returnInstance(instance.id)
                            }}
                          >
                            <RotateCcw size={14} /> Return
                          </button>
                        ) : null}
                        <button
                          className="small danger"
                          onClick={(event) => {
                            event.stopPropagation()
                            void deleteInstance(instance.id)
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="pagination-row">
            <span>
              Showing {visibleRangeLabel} of {filteredSortedInstances.length}
            </span>
            <div className="pagination-actions">
              <button
                className="small ghost"
                disabled={instancePage <= 1}
                onClick={() => setInstancePage((prev) => Math.max(1, prev - 1))}
              >
                Prev
              </button>
              <span>
                Page {instancePage} / {totalInstancePages}
              </span>
              <button
                className="small ghost"
                disabled={instancePage >= totalInstancePages}
                onClick={() => setInstancePage((prev) => Math.min(totalInstancePages, prev + 1))}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      ) : tab === 'downloads' ? (
        <section className="panel">
          <h3>
            <Download size={18} /> Downloads
          </h3>

          <div className="downloads-toolbar">
            <button className="small ghost" onClick={selectAllDownloadFields}>
              Select All Fields
            </button>
            <button className="small ghost" onClick={clearAllDownloadFields}>
              Clear All
            </button>
            <span style={{ borderLeft: '1px solid var(--line)', height: '16px', margin: '0 8px' }} />
            <button className="small ghost" onClick={expandAllSections}>
              Expand All
            </button>
            <button className="small ghost" onClick={collapseAllSections}>
              Collapse All
            </button>
            <span className="panel-subtle" style={{ marginLeft: '8px' }}>
              Selected {selectedDownloadFields.length} / {allDownloadFields.length}
            </span>
            <div className="toolbar-spacer" />
            <button className="small" onClick={downloadSelectedForms}>
              <Download size={14} /> Download Selected
            </button>
          </div>

          <div className="downloads-sections">
            {downloadSections.map((section) => {
              const selectedCount = sectionSelectedCount(section.fields)
              const allSelected = sectionIsFullySelected(section.fields)
              const sectionExpanded = expandedDownloadSections[section.key] ?? false
              const treeNodes = buildSectionTree(section)

              return (
                <article className="download-section-card" key={section.key}>
                  <header className="download-section-header">
                    <div>
                      <h4>{section.label}</h4>
                      <p className="panel-subtle">
                        {selectedCount} / {section.fields.length} selected
                      </p>
                    </div>
                    <div className="download-section-actions">
                      <label className="switch-row">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={() => toggleSectionSelection(section.fields)}
                        />
                        Select All
                      </label>
                      <button
                        type="button"
                        className="small ghost"
                        onClick={() => toggleSectionExpanded(section.key)}
                      >
                        {sectionExpanded ? 'Collapse' : 'Expand'}
                      </button>
                    </div>
                  </header>

                  <div className={`download-section-body ${sectionExpanded ? '' : 'collapsed'}`}>
                    {sectionExpanded ? (
                      treeNodes.length > 0 ? (
                        <div className="download-tree">
                          {treeNodes.map((node) => renderDownloadNode(node))}
                        </div>
                      ) : (
                        <div className="download-tree">
                          {section.fields.map((fieldPath) => {
                            const fieldSelected = selectedDownloadFields.includes(fieldPath)
                            const label =
                              section.key === '__system__'
                                ? fieldPath
                                : fieldPath.replace(`${section.key}.`, '')

                            return (
                              <label className="download-field-option" key={`${section.key}-${fieldPath}`}>
                                <input
                                  type="checkbox"
                                  checked={fieldSelected}
                                  onChange={() => {
                                    setSelectedDownloadFields((prev) =>
                                      prev.includes(fieldPath)
                                        ? prev.filter((value) => value !== fieldPath)
                                        : [...prev, fieldPath],
                                    )
                                  }}
                                />
                                <span>{formatFieldLabel(label)}</span>
                              </label>
                            )
                          })}
                        </div>
                      )
                    ) : (
                      <p className="panel-subtle">Section collapsed. Click Expand to select individual fields.</p>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      ) : tab === 'backups' ? (
        <section className="panel">
          <h3>
            <RotateCcw size={18} /> Database Backups
          </h3>

          <div className="downloads-toolbar">
            <span className="panel-subtle">
              Last backup: {backupsLastAt ? new Date(backupsLastAt).toLocaleString() : 'No backups yet'}
            </span>
            <span className="panel-subtle">
              Next backup:{' '}
              {backupSchedule?.next_backup_at
                ? new Date(backupSchedule.next_backup_at).toLocaleString()
                : 'Not scheduled'}
            </span>
            <span className="panel-subtle">
              Countdown: {formatDuration(secondsUntilNextBackup)}
            </span>
            <span className="panel-subtle">Retention: latest {backupsRetentionLimit} backups</span>
            <div className="toolbar-spacer" />
            <button
              className="small ghost"
              onClick={() => void Promise.all([loadBackups(), loadBackupSchedule()])}
              disabled={backupLoading}
            >
              {backupLoading ? 'Refreshing...' : 'Refresh'}
            </button>
            <button className="small" onClick={() => void runBackupNow()} disabled={backupRunLoading}>
              {backupRunLoading ? 'Running backup...' : 'Run Backup Now'}
            </button>
          </div>

          {!isMaintainer ? (
            <p className="panel-subtle">Only maintainer can access backup controls.</p>
          ) : backups.length === 0 ? (
            <p className="panel-subtle">No backups found yet.</p>
          ) : (
            <div className="table-wrap tall">
              <table>
                <thead>
                  <tr>
                    <th>Backup ID</th>
                    <th>Created</th>
                    <th>Trigger</th>
                    <th>Databases</th>
                    <th>Storage</th>
                    <th>Size</th>
                    <th>Forms</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map((backup) => {
                    const diff = backupDiffsById[backup.backup_id]
                    const isRowBusy = backupActionLoadingId === backup.backup_id
                    return (
                      <Fragment key={backup.backup_id}>
                        <tr>
                          <td className="cell-mono">{backup.backup_id}</td>
                          <td>{new Date(backup.created_at).toLocaleString()}</td>
                          <td>{backup.trigger}</td>
                          <td>{backup.database_names?.join(', ') || 'stratum_db'}</td>
                          <td>
                            {(backup.storage_bucket_names?.length ?? 0) > 0
                              ? `${backup.storage_object_count ?? 0} objects (${backup.storage_bucket_names.join(', ')})`
                              : 'No MinIO objects'}
                          </td>
                          <td>{formatBytes(backup.sql_size_bytes)}</td>
                          <td>{backup.stats.forms ?? 0}</td>
                          <td className="actions">
                            <button
                              className="small ghost"
                              onClick={() => void loadBackupDiff(backup.backup_id)}
                              disabled={isRowBusy}
                            >
                              {isRowBusy ? 'Loading...' : 'Show Diff'}
                            </button>
                            <button
                              className="small danger"
                              onClick={() => void restoreBackup(backup.backup_id)}
                              disabled={isRowBusy}
                            >
                              Restore
                            </button>
                          </td>
                        </tr>
                        {diff ? (
                          <tr>
                            <td colSpan={8}>
                              <div className="backup-diff-block">
                                <strong>Difference vs live database</strong>
                                <div className="backup-diff-grid">
                                  {Object.entries(diff.differences).map(([key, value]) => {
                                    const backupCount = Number(value.backup ?? 0)
                                    const liveCount = Number(value.live ?? 0)
                                    const rawDelta = value.delta_live_minus_backup
                                    const delta = Number.isFinite(Number(rawDelta))
                                      ? Number(rawDelta)
                                      : liveCount - backupCount

                                    return (
                                      <div className="backup-diff-row" key={`${backup.backup_id}-${key}`}>
                                        <span>{formatFieldLabel(key)}</span>
                                        <span>Backup: {backupCount}</span>
                                        <span>Live: {liveCount}</span>
                                        <span>
                                          Delta: {delta > 0 ? '+' : ''}
                                          {delta}
                                        </span>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <section className="panel">
          {selectedInstance ? (
            <>
              <div className="form-view-header-row">
                <h3>
                  <FileText size={18} /> Submitted Form View
                </h3>
                <div className="form-view-actions">
                  {selectedInstance.status === 'in_verificare' ? (
                    <button
                      className="small"
                      onClick={() => void updateInstanceStatus(selectedInstance.id, 'to-approval')}
                    >
                      <CheckCircle2 size={14} /> To Approval
                    </button>
                  ) : null}
                  {selectedInstance.status === 'in_aprobare' ? (
                    <button
                      className="small"
                      onClick={() => void updateInstanceStatus(selectedInstance.id, 'approve')}
                    >
                      <CheckCircle2 size={14} /> Approve
                    </button>
                  ) : null}
                  <button className="small" onClick={() => setTab('instances')}>
                    Back to Validation Inbox
                  </button>
                </div>
              </div>

              <div className="form-view-topbar">
                <div className="form-view-summary-grid">
                  <div className="summary-card wide">
                    <span className="summary-label">Instance</span>
                    <span className="summary-value mono">{selectedInstance.id}</span>
                  </div>
                  <div className="summary-card">
                    <span className="summary-label">Status</span>
                    <span className="summary-value">{statusLabel(selectedInstance.status)}</span>
                  </div>
                  <div className="summary-card">
                    <span className="summary-label">Version</span>
                    <span className="summary-value">{selectedInstance.version}</span>
                  </div>
                  <div className="summary-card wide">
                    <span className="summary-label">Updated</span>
                    <span className="summary-value">{new Date(selectedInstance.updated_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <section className="processed-view">
                <div className="processed-view-header">Processed Form Data</div>
                {renderProcessedRoot(selectedInstance.data ?? {})}
              </section>
            </>
          ) : (
            <>
              <h3>
                <FileText size={18} /> Submitted Form View
              </h3>
              <p>No form selected. Open one from Validation Flow.</p>
            </>
          )}
        </section>
      )}
    </main>
  )
}

export default App
