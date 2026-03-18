import axios from 'axios'
import { CheckCircle2, Landmark, LogOut, RotateCcw, Shield, UserPlus, Users } from 'lucide-react'
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
  | 'DRAFT'
  | 'COMPLETAT'
  | 'FINALIZAT'
  | 'IN_VERIFICARE'
  | 'IN_APROBARE'
  | 'VALIDAT'
  | 'REINTORS'

type Instance = {
  id: string
  monument_id: string
  user_id: string | null
  status: InstanceStatus
  version: number
  rejection_reason: string | null
  updated_at: string
}

type Monument = {
  id: string
  lmi_code: string
  name: string
  county: string | null
  locality: string | null
  address: string | null
  latitude: string | null
  longitude: string | null
  status: string | null
}

type AuthResponse = {
  access_token: string
  user: User
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api',
})

const isDev = Boolean(import.meta.env.DEV)

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('dashboard_token'))
  const [me, setMe] = useState<User | null>(null)
  const [tab, setTab] = useState<'users' | 'instances' | 'monuments'>('users')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [users, setUsers] = useState<User[]>([])
  const [instances, setInstances] = useState<Instance[]>([])
  const [monuments, setMonuments] = useState<Monument[]>([])

  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [newUserName, setNewUserName] = useState('')
  const [newUserUsername, setNewUserUsername] = useState('')
  const [newUserPrivileged, setNewUserPrivileged] = useState(true)
  const [newUserAdmin, setNewUserAdmin] = useState(false)

  const [newMonumentLmiCode, setNewMonumentLmiCode] = useState('')
  const [newMonumentName, setNewMonumentName] = useState('')
  const [newMonumentCounty, setNewMonumentCounty] = useState('')
  const [newMonumentLocality, setNewMonumentLocality] = useState('')
  const [newMonumentAddress, setNewMonumentAddress] = useState('')
  const [newMonumentLatitude, setNewMonumentLatitude] = useState('')
  const [newMonumentLongitude, setNewMonumentLongitude] = useState('')
  const [newMonumentStatus, setNewMonumentStatus] = useState('')

  const authHeaders = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : undefined),
    [token],
  )

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

  const fillCreateMonumentDev = () => {
    const stamp = Date.now().toString().slice(-6)
    setNewMonumentLmiCode(`DEV-${stamp}`)
    setNewMonumentName(`Monument test ${stamp}`)
    setNewMonumentCounty('Bucuresti')
    setNewMonumentLocality('Bucuresti')
    setNewMonumentAddress(`Strada Test ${stamp}`)
    setNewMonumentLatitude('44.4268')
    setNewMonumentLongitude('26.1025')
    setNewMonumentStatus('activ')
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

  const loadMonuments = async () => {
    if (!authHeaders) return
    const res = await api.get<Monument[]>('/emonument-dashboard/monuments', { headers: authHeaders })
    setMonuments(res.data)
  }

  useEffect(() => {
    if (!token) {
      setMe(null)
      return
    }

    loadMe(token)
      .then(() => Promise.all([loadUsers(), loadInstances(), loadMonuments()]))
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

  const handleCreateMonument = async (event: FormEvent) => {
    event.preventDefault()
    if (!authHeaders) return
    setError(null)
    setLoading(true)
    try {
      const res = await api.post<Monument>(
        '/emonument-dashboard/monuments',
        {
          lmi_code: newMonumentLmiCode,
          name: newMonumentName,
          county: newMonumentCounty || null,
          locality: newMonumentLocality || null,
          address: newMonumentAddress || null,
          latitude: newMonumentLatitude || null,
          longitude: newMonumentLongitude || null,
          status: newMonumentStatus || null,
        },
        { headers: authHeaders },
      )
      setNewMonumentLmiCode('')
      setNewMonumentName('')
      setNewMonumentCounty('')
      setNewMonumentLocality('')
      setNewMonumentAddress('')
      setNewMonumentLatitude('')
      setNewMonumentLongitude('')
      setNewMonumentStatus('')
      alert(`Monument created. Monument ID: ${res.data.id}`)
      await loadMonuments()
    } catch (err: unknown) {
      let message = 'Could not create monument'
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail
        message = typeof detail === 'string' ? detail : message
      }
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
        <button className={tab === 'monuments' ? 'active' : ''} onClick={() => setTab('monuments')}>
          <Landmark size={16} /> Monuments
        </button>
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
          <h3>Inbox Validare</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Status</th>
                  <th>Version</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {instances.map((instance) => (
                  <tr key={instance.id}>
                    <td>{instance.id.slice(0, 8)}</td>
                    <td>{instance.status}</td>
                    <td>{instance.version}</td>
                    <td>{new Date(instance.updated_at).toLocaleString()}</td>
                    <td className="actions">
                      {instance.status === 'IN_VERIFICARE' ? (
                        <button className="small" onClick={() => updateInstanceStatus(instance.id, 'to-approval')}>
                          <CheckCircle2 size={14} /> To Approval
                        </button>
                      ) : null}
                      {instance.status === 'IN_APROBARE' ? (
                        <button className="small" onClick={() => updateInstanceStatus(instance.id, 'approve')}>
                          <CheckCircle2 size={14} /> Approve
                        </button>
                      ) : null}
                      {(instance.status === 'IN_VERIFICARE' || instance.status === 'IN_APROBARE') ? (
                        <button className="small danger" onClick={() => returnInstance(instance.id)}>
                          <RotateCcw size={14} /> Return
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="grid-two">
          <article className="panel">
            <h3>
              <Landmark size={18} /> Add Monument
            </h3>
            <form className="stack" onSubmit={handleCreateMonument}>
              <label>
                LMI Code
                <input
                  value={newMonumentLmiCode}
                  onChange={(e) => setNewMonumentLmiCode(e.target.value)}
                  required
                />
              </label>
              <label>
                Name
                <input
                  value={newMonumentName}
                  onChange={(e) => setNewMonumentName(e.target.value)}
                  required
                />
              </label>
              <label>
                County
                <input value={newMonumentCounty} onChange={(e) => setNewMonumentCounty(e.target.value)} />
              </label>
              <label>
                Locality
                <input value={newMonumentLocality} onChange={(e) => setNewMonumentLocality(e.target.value)} />
              </label>
              <label>
                Address
                <input value={newMonumentAddress} onChange={(e) => setNewMonumentAddress(e.target.value)} />
              </label>
              <label>
                Latitude
                <input value={newMonumentLatitude} onChange={(e) => setNewMonumentLatitude(e.target.value)} />
              </label>
              <label>
                Longitude
                <input value={newMonumentLongitude} onChange={(e) => setNewMonumentLongitude(e.target.value)} />
              </label>
              <label>
                Status
                <input value={newMonumentStatus} onChange={(e) => setNewMonumentStatus(e.target.value)} />
              </label>
              <button type="submit" disabled={loading}>
                {loading ? 'Saving...' : 'Add Monument'}
              </button>
              {isDev ? (
                <button type="button" className="small ghost" onClick={fillCreateMonumentDev}>
                  DEV Autofill
                </button>
              ) : null}
            </form>
          </article>

          <article className="panel">
            <h3>Existing Monuments</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Monument ID</th>
                    <th>LMI</th>
                    <th>Name</th>
                    <th>County</th>
                    <th>Locality</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {monuments.map((monument) => (
                    <tr key={monument.id}>
                      <td>{monument.id}</td>
                      <td>{monument.lmi_code}</td>
                      <td>{monument.name}</td>
                      <td>{monument.county ?? '-'}</td>
                      <td>{monument.locality ?? '-'}</td>
                      <td>{monument.status ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      )}
    </main>
  )
}

export default App
