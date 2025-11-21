import React, { useState } from 'react'

// Behind nginx reverse proxy, use same-origin requests
const apiBase = ''

export default function App() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState(null)
  const [message, setMessage] = useState('')
  const [campaigns, setCampaigns] = useState([])
  const [showCampaigns, setShowCampaigns] = useState(false)

  async function register() {
    const res = await fetch(`${apiBase}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const data = await res.json()
    setMessage(JSON.stringify(data))
  }

  async function login() {
    const res = await fetch(`${apiBase}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const data = await res.json()
    if (data.token) {
      setToken(data.token)
      setMessage('Logged in successfully!')
      // Fetch campaigns after successful login
      await fetchCampaigns()
    } else {
      setMessage(JSON.stringify(data))
    }
  }

  async function profile() {
    const res = await fetch(`${apiBase}/api/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const data = await res.json()
    setMessage(JSON.stringify(data))
  }

  async function fetchCampaigns() {
    try {
      const res = await fetch(`${apiBase}/api/campaigns`)
      const data = await res.json()
      if (data.campaigns) {
        setCampaigns(data.campaigns)
        setShowCampaigns(true)
        setMessage(`Loaded ${data.campaigns.length} campaigns`)
      }
    } catch (err) {
      setMessage('Failed to fetch campaigns: ' + err.message)
    }
  }

  return (
    <div style={{ padding: 20, fontFamily: 'Arial, sans-serif' }}>
      <h2>Login App</h2>
      <div style={{ maxWidth: 800 }}>
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="email OR Username!!" />
        <br />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="password" />
        <br />
        <button onClick={register}>Register</button>
        <button onClick={login}>Login</button>
        <button onClick={profile} disabled={!token}>Profile</button>
        <button onClick={fetchCampaigns} disabled={!token}>Refresh Campaigns</button>
        <div style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>{message}</div>
      </div>

      {showCampaigns && campaigns.length > 0 && (
        <div style={{ marginTop: 30 }}>
          <h3>Active Campaigns</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
            {campaigns.map(campaign => (
              <div key={campaign.id} style={{ 
                border: '1px solid #ddd', 
                borderRadius: 8, 
                padding: 16,
                backgroundColor: '#f9f9f9'
              }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>{campaign.name}</h4>
                <div style={{ marginTop: 10 }}>
                  <span style={{ fontSize: 18, fontWeight: 'bold', color: '#2c5282' }}>
                    ${parseFloat(campaign.total_amount_raised).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span style={{ marginLeft: 10, fontSize: 14, color: '#666' }}>
                    raised
                  </span>
                </div>
                <div style={{ marginTop: 10, fontSize: 12, color: '#999' }}>
                  <div>Created: {new Date(campaign.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</div>
                  <div style={{ marginTop: 4 }}>Updated: {new Date(campaign.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
