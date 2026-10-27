import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import BrandLogo from '../components/BrandLogo';
import toast from 'react-hot-toast';
import {
  HiOutlineBuildingOffice2,
  HiOutlineUserGroup,
  HiOutlineArrowRight,
  HiOutlineWrenchScrewdriver,
  HiOutlineInformationCircle,
} from 'react-icons/hi2';

export default function SignupPage() {
  const [roleTab, setRoleTab] = useState('BUSINESS_OWNER'); // 'BUSINESS_OWNER' | 'CLIENT'
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);

  // Form states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');

  const { registerOwner, registerClient } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (roleTab === 'CLIENT') {
      setLoadingCompanies(true);
      authAPI.getCompanies()
        .then((res) => {
          setCompanies(res.data || []);
          if (res.data?.length > 0) {
            setSelectedCompanyId(res.data[0].id);
          }
        })
        .catch(() => {
          toast.error('Unable to load available companies.');
        })
        .finally(() => setLoadingCompanies(false));
    }
  }, [roleTab]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!fullName.trim() || !email.trim() || !password) {
      toast.error('Please complete all required fields.');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      if (roleTab === 'BUSINESS_OWNER') {
        if (!companyName.trim()) {
          toast.error('Company / Business name is required.');
          setLoading(false);
          return;
        }

        await registerOwner({
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          password,
          companyName: companyName.trim(),
        });

        toast.success(`Welcome to BPMS, ${fullName}! Your company is ready.`);
        navigate('/dashboard');
      } else {
        await registerClient({
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          password,
          companyId: selectedCompanyId || null,
        });

        toast.success(`Welcome to BPMS, ${fullName}! Your client account is active.`);
        navigate('/dashboard');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: 480 }}>
        <div className="logo">
          <div style={{ marginBottom: 14 }}>
            <BrandLogo size={52} />
          </div>
          <h1>Create Account</h1>
          <p>Choose your account type to get started with BPMS</p>
        </div>

        {/* Role Selector Tabs */}
        <div
          style={{
            display: 'flex',
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-md)',
            padding: 4,
            marginBottom: 20,
            gap: 4,
          }}
        >
          <button
            type="button"
            className={`btn btn-sm ${roleTab === 'BUSINESS_OWNER' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={() => setRoleTab('BUSINESS_OWNER')}
          >
            <HiOutlineBuildingOffice2 />
            <span>Business Owner</span>
          </button>
          <button
            type="button"
            className={`btn btn-sm ${roleTab === 'CLIENT' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={() => setRoleTab('CLIENT')}
          >
            <HiOutlineUserGroup />
            <span>Client</span>
          </button>
        </div>

        {/* Worker Notice Banner */}
        <div
          style={{
            background: 'rgba(96, 165, 250, 0.08)',
            border: '1px solid rgba(96, 165, 250, 0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
            marginBottom: 20,
            fontSize: '0.82rem',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
          }}
        >
          <HiOutlineWrenchScrewdriver style={{ fontSize: '1.2rem', color: '#60a5fa', flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong style={{ color: '#93c5fd', display: 'block', marginBottom: 2 }}>
              Are you a Field Worker?
            </strong>
            Worker accounts cannot register publicly. Your Business Owner must create your account directly to permanently associate you with their workforce.
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoFocus
            />
          </div>

          {roleTab === 'BUSINESS_OWNER' && (
            <div className="form-group">
              <label className="form-label">Company / Business Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Apex Construction & Engineering"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
              />
            </div>
          )}

          {roleTab === 'CLIENT' && (
            <div className="form-group">
              <label className="form-label">Contracting Company / Business</label>
              {loadingCompanies ? (
                <div style={{ padding: '8px 12px', fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
                  Loading companies...
                </div>
              ) : companies.length > 0 ? (
                <select
                  className="form-select"
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.owner ? `(Managed by ${c.owner.fullName})` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  No registered companies found. You can still register and link later.
                </p>
              )}
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Work Email *</label>
              <input
                type="email"
                className="form-input"
                placeholder="name@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input
                type="tel"
                className="form-input"
                placeholder="+1 (555) 000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Password *</label>
              <input
                type="password"
                className="form-input"
                placeholder="Min 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password *</label>
              <input
                type="password"
                className="form-input"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading}
            style={{ justifyContent: 'center', marginTop: 12 }}
          >
            {loading ? (
              'Creating your account...'
            ) : (
              <>
                <span>
                  {roleTab === 'BUSINESS_OWNER'
                    ? 'Register Business & Workspace'
                    : 'Create Client Account'}
                </span>
                <HiOutlineArrowRight />
              </>
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
            Sign in here
          </Link>
        </div>
      </div>
    </div>
  );
}
