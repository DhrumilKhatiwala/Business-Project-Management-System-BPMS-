import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';
import {
  HiOutlineUser, HiOutlineLockClosed, HiOutlineShieldCheck,
  HiOutlinePhone, HiOutlineEnvelope,
  HiOutlineWrenchScrewdriver, HiOutlineBuildingOffice2,
  HiOutlineKey
} from 'react-icons/hi2';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Profile Form state
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Password Form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await authAPI.getMe();
      setProfileData(res.data);
      setFullName(res.data.fullName || '');
      setPhone(res.data.phone || '');
    } catch (err) {
      toast.error('Failed to load profile details.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) {
      return toast.error('Full name is required.');
    }

    setSavingProfile(true);
    try {
      const res = await authAPI.updateProfile({ fullName, phone });
      updateUser(res.data.user);
      setProfileData(prev => ({ ...prev, ...res.data.user }));
      toast.success('Profile updated successfully!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      return toast.error('Please fill in both current and new password.');
    }
    if (newPassword.length < 6) {
      return toast.error('New password must be at least 6 characters.');
    }
    if (newPassword !== confirmPassword) {
      return toast.error('New passwords do not match.');
    }

    setChangingPassword(true);
    try {
      await authAPI.changePassword({ currentPassword, newPassword });
      toast.success('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to change password.');
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return <div className="loading-container"><div className="spinner" /></div>;
  }

  const roleIcon =
    user?.role === 'BUSINESS_OWNER' ? <HiOutlineShieldCheck /> :
    user?.role === 'WORKER' ? <HiOutlineWrenchScrewdriver /> :
    <HiOutlineBuildingOffice2 />;

  const workerSkills = profileData?.worker?.skills
    ? (() => {
        try {
          return typeof profileData.worker.skills === 'string'
            ? JSON.parse(profileData.worker.skills)
            : profileData.worker.skills;
        } catch {
          return [];
        }
      })()
    : [];

  const workerAssignments = profileData?.worker?.assignments || [];

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto' }}>
      <div className="page-header mb-24">
        <div>
          <h1>Account & Profile</h1>
          <p>Manage your account settings, personal details, and security credentials</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24, alignItems: 'start' }}>
        {/* ── Left Column: User Summary Card ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card text-center" style={{ padding: '32px 24px' }}>
            <div
              style={{
                width: 80,
                height: 80,
                margin: '0 auto 16px',
                borderRadius: 'var(--radius-xl)',
                background: 'var(--accent-gradient)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
                fontWeight: 700,
                boxShadow: '0 8px 24px var(--accent-primary-glow)',
              }}
            >
              {profileData?.fullName?.charAt(0)?.toUpperCase()}
            </div>

            <h3 style={{ fontSize: '1.2rem', marginBottom: 4, color: 'var(--text-primary)' }}>
              {profileData?.fullName}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginBottom: 14 }}>
              {profileData?.email}
            </p>

            <div className="flex justify-center mb-16">
              <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: '0.8rem' }}>
                {roleIcon}
                <span>{profileData?.role?.replace('_', ' ')}</span>
              </span>
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 16, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 12, fontSize: '0.85rem' }}>
              <div className="flex justify-between items-center">
                <span style={{ color: 'var(--text-muted)' }}>Status</span>
                <span className="badge badge-success">
                  <span className="pulse-dot active" style={{ width: 6, height: 6, marginRight: 4 }} />
                  {profileData?.status}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color: 'var(--text-muted)' }}>Member Since</span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {new Date(profileData?.createdAt).toLocaleDateString()}
                </span>
              </div>
              {profileData?.phone && (
                <div className="flex justify-between items-center">
                  <span style={{ color: 'var(--text-muted)' }}>Phone</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{profileData.phone}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Role Scope / Quick Context ── */}
          {user.role === 'WORKER' && (
            <div className="card" style={{ padding: 20 }}>
              <div className="card-header mb-12">
                <h3 style={{ fontSize: '0.95rem' }}>Workforce Profile</h3>
              </div>
              <div style={{ fontSize: '0.85rem', marginBottom: 12 }}>
                <span style={{ color: 'var(--text-muted)' }}>Position: </span>
                <strong style={{ color: 'var(--text-primary)' }}>{profileData?.worker?.position || 'Field Staff'}</strong>
              </div>
              {workerSkills.length > 0 && (
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'block', marginBottom: 6 }}>Skills:</span>
                  <div className="flex flex-wrap gap-6">
                    {workerSkills.map((s, idx) => (
                      <span key={idx} className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {workerAssignments.length > 0 && (
                <div style={{ marginTop: 16, borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'block', marginBottom: 8 }}>
                    Active Projects ({workerAssignments.length})
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {workerAssignments.map((a) => (
                      <div key={a.project.id} className="flex justify-between items-center" style={{ fontSize: '0.8rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{a.project.name}</span>
                        <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>{a.project.progress}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {user.role === 'BUSINESS_OWNER' && (
            <div className="card" style={{ padding: 20 }}>
              <div className="flex items-center gap-10 mb-8" style={{ color: 'var(--accent-primary-hover)' }}>
                <HiOutlineShieldCheck style={{ fontSize: '1.25rem' }} />
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Administrative Authority</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                Full system authority to manage accounts, deploy workforce, commission projects, and control inventory supply chain.
              </p>
            </div>
          )}
        </div>

        {/* ── Right Column: Edit Forms ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Personal Information Form */}
          <div className="card" style={{ padding: 28 }}>
            <div className="card-header mb-20">
              <div className="flex items-center gap-10">
                <HiOutlineUser style={{ fontSize: '1.2rem', color: 'var(--accent-primary-hover)' }} />
                <h3>Personal Information</h3>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                Update your display name and contact phone number
              </p>
            </div>

            <form onSubmit={handleUpdateProfile}>
              <div className="form-group mb-16">
                <label className="form-label">Full Name</label>
                <div style={{ position: 'relative' }}>
                  <HiOutlineUser style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="form-input"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                    style={{ paddingLeft: 40 }}
                    required
                  />
                </div>
              </div>

              <div className="form-group mb-16">
                <label className="form-label">Email Address (Managed by Admin)</label>
                <div style={{ position: 'relative' }}>
                  <HiOutlineEnvelope style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="email"
                    className="form-input"
                    value={profileData?.email || ''}
                    disabled
                    style={{ paddingLeft: 40, opacity: 0.6, cursor: 'not-allowed' }}
                  />
                </div>
              </div>

              <div className="form-group mb-24">
                <label className="form-label">Phone Number</label>
                <div style={{ position: 'relative' }}>
                  <HiOutlinePhone style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="tel"
                    className="form-input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +1 (555) 123-4567"
                    style={{ paddingLeft: 40 }}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button type="submit" className="btn btn-primary" disabled={savingProfile}>
                  {savingProfile ? 'Saving...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          </div>

          {/* Change Password Form */}
          <div className="card" style={{ padding: 28 }}>
            <div className="card-header mb-20">
              <div className="flex items-center gap-10">
                <HiOutlineKey style={{ fontSize: '1.2rem', color: '#f59e0b' }} />
                <h3>Account Security & Password</h3>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                Ensure your account is protected with a strong, distinct password
              </p>
            </div>

            <form onSubmit={handleChangePassword}>
              <div className="form-group mb-16">
                <label className="form-label">Current Password</label>
                <div style={{ position: 'relative' }}>
                  <HiOutlineLockClosed style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="password"
                    className="form-input"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    style={{ paddingLeft: 40 }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="mb-24">
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <div style={{ position: 'relative' }}>
                    <HiOutlineLockClosed style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="password"
                      className="form-input"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      style={{ paddingLeft: 40 }}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Confirm New Password</label>
                  <div style={{ position: 'relative' }}>
                    <HiOutlineLockClosed style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="password"
                      className="form-input"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat new password"
                      style={{ paddingLeft: 40 }}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button type="submit" className="btn btn-secondary" disabled={changingPassword}>
                  {changingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
