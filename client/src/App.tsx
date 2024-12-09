import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { Card, CardHeader, CardTitle } from './components/ui/card'
import { Dashboard } from './pages/Dashboard'
import { LendingPoolPage } from './pages/LendingPool'

function App() {
  const [count, setCount] = useState(0)

  return (
    <Dashboard />
  )
}

export default App
