import { useState } from 'react'
import Dashboard from './components/Dashboard.jsx'
import MedicineList from './components/MedicineList.jsx'
import TransactionList from './components/TransactionList.jsx'
import ImportExport from './components/ImportExport.jsx'
import ExpiredMedicines from './components/ExpiredMedicines.jsx'
import MedicationPlanList from './components/MedicationPlanList.jsx'

const navItems = [
  { key: 'dashboard', label: '首页' },
  { key: 'plans', label: '用药计划' },
  { key: 'medicines', label: '药品管理' },
  { key: 'transactions', label: '流水记录' },
  { key: 'expired', label: '过期处理' },
  { key: 'import-export', label: '导入导出' },
]

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard')

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />
      case 'plans':
        return <MedicationPlanList />
      case 'medicines':
        return <MedicineList />
      case 'transactions':
        return <TransactionList />
      case 'expired':
        return <ExpiredMedicines />
      case 'import-export':
        return <ImportExport />
      default:
        return <Dashboard />
    }
  }

  return (
    <div className="app-container">
      <nav className="navbar">
        <div className="navbar-content">
          <h1>💊 家庭药箱管理系统</h1>
          <ul className="nav-links">
            {navItems.map((item) => (
              <li key={item.key}>
                <button
                  className={currentView === item.key ? 'active' : ''}
                  onClick={() => setCurrentView(item.key)}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </nav>
      <main className="main-content">{renderView()}</main>
    </div>
  )
}
