import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import BrandLogo from '../components/BrandLogo';
import toast from 'react-hot-toast';
import {
  HiOutlineSparkles,
  HiOutlineArrowRight,
  HiOutlineShieldCheck,
  HiOutlineWrenchScrewdriver,
  HiOutlineBuildingOffice2
} from 'react-icons/hi2';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleDemoFill = (demoEmail, demoPass) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    toast.success('Demo credentials applied.');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter email and password.');
      return;
    }
    setLoading(true);
    try {
      const user = await login(email, password);
      toast.success(`Welcome back, ${user.fullName}!`);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="logo">
          <div style={{ marginBottom: 14 }}>
            <BrandLogo size={52} />
          </div>
          <h1>BPMS</h1>
          <p>Business & Project Management System</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Work Email</label>
            <input
              type="email"
              className="form-input"
              placeholder="e.g. admin@bpms.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" className="btn btn-primary w-full" disabled={loading} style={{ justifyContent: 'center', marginTop: 8 }}>
            {loading ? 'Signing in...' : (
              <>
                <span>Sign In to Dashboard</span>
                <HiOutlineArrowRight />
              </>
            )}
          </button>
        </form>

        <div className="demo-chips-box">
          <div className="demo-chips-label">
            <HiOutlineSparkles style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Instant Demo Profiles
          </div>
          <div className="demo-chips-grid">
            <button
              type="button"
              className="demo-chip-btn"
              onClick={() => handleDemoFill('admin@bpms.com', 'admin123')}
            >
              <HiOutlineShieldCheck style={{ fontSize: '1.25rem', color: '#818cf8' }} />
              <span className="demo-chip-title">Admin</span>
              <span className="demo-chip-role">Owner</span>
            </button>
            <button
              type="button"
              className="demo-chip-btn"
              onClick={() => handleDemoFill('worker@bpms.com', 'worker123')}
            >
              <HiOutlineWrenchScrewdriver style={{ fontSize: '1.25rem', color: '#60a5fa' }} />
              <span className="demo-chip-title">Worker</span>
              <span className="demo-chip-role">Field Staff</span>
            </button>
            <button
              type="button"
              className="demo-chip-btn"
              onClick={() => handleDemoFill('client@bpms.com', 'client123')}
            >
              <HiOutlineBuildingOffice2 style={{ fontSize: '1.25rem', color: '#34d399' }} />
              <span className="demo-chip-title">Client</span>
              <span className="demo-chip-role">Stakeholder</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
