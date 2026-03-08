import { useState } from 'react';
import Mirror from './components/Mirror';
import Closet from './components/Closet';
import './App.css'; // Creating a tiny CSS file for layout next

function App() {
  const [activeView, setActiveView] = useState('mirror');

  return (
    <div className="app-layout">
      <nav className="top-nav">
        <button 
          className={`nav-tab ${activeView === 'mirror' ? 'active' : ''}`}
          onClick={() => setActiveView('mirror')}
        >
          ✨ Magic Mirror
        </button>
        <button 
          className={`nav-tab ${activeView === 'closet' ? 'active' : ''}`}
          onClick={() => setActiveView('closet')}
        >
          👗 Digital Closet
        </button>
      </nav>

      <main className="main-content-area">
        {activeView === 'mirror' ? <Mirror /> : <Closet />}
      </main>
    </div>
  );
}

export default App;
