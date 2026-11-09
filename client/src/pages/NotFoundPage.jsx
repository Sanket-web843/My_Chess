import { useNavigate } from 'react-router-dom';
import './PlaceholderPage.css';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <main className="placeholder-page">
      <div className="placeholder-card">
        <span className="placeholder-icon">♟</span>
        <h1 className="placeholder-title">404</h1>
        <p className="placeholder-desc">
          This square doesn&apos;t exist on the board.
        </p>

        <button
          id="btn-404-home"
          className="btn btn--primary"
          style={{ marginTop: 'var(--sp-4)', width: '100%' }}
          onClick={() => navigate('/')}
        >
          ← Back to Home
        </button>
      </div>
    </main>
  );
}
