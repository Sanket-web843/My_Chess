import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  hasActiveOfflineMatch,
  hasActiveOnlineMatch,
  abandonOfflineMatch,
  abandonOnlineMatch,
} from '../utils/conflictCheck.js';
import ConflictWarningModal from '../components/ConflictWarningModal.jsx';
import '../components/components.css';
import './HomePage.css';

export default function HomePage() {
  const navigate = useNavigate();
  const [modalConfig, setModalConfig] = useState(null);

  const handleOfflineClick = () => {
    const online = hasActiveOnlineMatch();
    if (online.active) {
      setModalConfig({
        title: 'Active Online Match in Progress',
        message: `You are currently connected to an active online game in Room ${online.roomId}. Simultaneous matches are restricted to prevent desynchronization. You must finish or abandon your online match before starting Pass & Play.`,
        resumeText: 'Resume Online Game',
        abandonText: 'Forfeit Online Match & Switch',
        onResume: () => {
          setModalConfig(null);
          navigate('/online');
        },
        onAbandon: () => {
          abandonOnlineMatch();
          setModalConfig(null);
          navigate('/offline');
        },
      });
      return;
    }
    navigate('/offline');
  };

  const handleOnlineClick = () => {
    const offline = hasActiveOfflineMatch();
    if (offline.active) {
      setModalConfig({
        title: 'Active Pass & Play Match in Progress',
        message: `You have an ongoing Pass & Play match (${offline.movesCount} moves played). Simultaneous matches are restricted to prevent desynchronization. You must finish or abandon your offline match before playing Online.`,
        resumeText: 'Resume Pass & Play',
        abandonText: 'Abandon Offline Match & Switch',
        onResume: () => {
          setModalConfig(null);
          navigate('/offline');
        },
        onAbandon: () => {
          abandonOfflineMatch();
          setModalConfig(null);
          navigate('/online');
        },
      });
      return;
    }
    navigate('/online');
  };

  return (
    <main className="home-page">
      <ConflictWarningModal
        isOpen={!!modalConfig}
        title={modalConfig?.title}
        message={modalConfig?.message}
        resumeText={modalConfig?.resumeText}
        abandonText={modalConfig?.abandonText}
        onResume={modalConfig?.onResume}
        onAbandon={modalConfig?.onAbandon}
        onCancel={() => setModalConfig(null)}
      />

      <div className="home-card">
        <div className="home-logo" aria-hidden="true">♟</div>
        <h1 className="home-title">Classic Chess</h1>
        <p className="home-subtitle">Two players. One board. No limits.</p>

        <div className="home-actions">
          <button
            id="btn-play-offline"
            className="btn btn--primary"
            onClick={handleOfflineClick}
          >
            <span className="btn-icon">🖥</span>
            Pass & Play
          </button>

          <button
            id="btn-play-online"
            className="btn btn--secondary"
            onClick={handleOnlineClick}
          >
            <span className="btn-icon">🌐</span>
            Online Game
          </button>
        </div>

        <p className="home-footer">Choose your mode to begin</p>
      </div>
    </main>
  );
}
