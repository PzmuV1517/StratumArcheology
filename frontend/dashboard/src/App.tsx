import axios from 'axios'
import {
  CheckCircle2,
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
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

type User = {
  id: string
  email: string
  username: string | null
  display_name: string | null
  firebase_uid: string
  is_emonument_privileged: boolean
  is_dashboard_admin: boolean
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

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api',
})

const isDev = Boolean(import.meta.env.DEV)

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('dashboard_token'))
  const [me, setMe] = useState<User | null>(null)
  const [tab, setTab] = useState<'users' | 'instances' | 'form-view'>('users')
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

  const authHeaders = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : undefined),
    [token],
  )

  const selectedInstance = useMemo(
    () => (selectedInstanceId ? instances.find((instance) => instance.id === selectedInstanceId) ?? null : null),
    [instances, selectedInstanceId],
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
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `emonument_instances_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
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

  const loadMe = async (jwtToken: string) => {
    const res = await api.get<User>('/auth/me', {
      headers: { Authorization: `Bearer ${jwtToken}` },
    })
    setMe(res.data)
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

  useEffect(() => {
    if (!token) {
      setMe(null)
      return
    }

    loadMe(token)
      .then(() => Promise.all([loadUsers(), loadInstances()]))
      .catch(() => {
        localStorage.removeItem('dashboard_token')
        setToken(null)
      })
  }, [token])

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
