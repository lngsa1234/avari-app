// components/CreateCircleView.js
// Dedicated page for creating an intimate circle
// Multi-step form with name, description, schedule, and member selection

'use client';

import { useState, useEffect } from 'react';
import {
  getEligibleConnections,
  createConnectionGroup
} from '@/lib/connectionGroupHelpers';

const CATEGORIES = [
  { id: 'career', label: 'Career', emoji: '💼' },
  { id: 'business', label: 'Business', emoji: '🚀' },
  { id: 'wellness', label: 'Wellness', emoji: '🧘‍♀️' },
  { id: 'tech', label: 'Tech', emoji: '👩‍💻' },
  { id: 'creative', label: 'Creative', emoji: '🎨' },
  { id: 'finance', label: 'Finance', emoji: '💰' },
  { id: 'learning', label: 'Learning', emoji: '📚' },
  { id: 'parenting', label: 'Parenting', emoji: '👶' },
  { id: 'support', label: 'Support', emoji: '💝' },
  { id: 'social', label: 'Social', emoji: '🎉' },
];

const CADENCE_OPTIONS = [
  { id: 'weekly', label: 'Every week' },
  { id: 'biweekly', label: 'Every other week' },
  { id: 'monthly', label: 'Once a month' },
  { id: 'flexible', label: 'Flexible / As needed' },
];

const LOCATION_OPTIONS = [
  { id: 'virtual', label: 'Virtual', icon: '💻' },
  { id: 'in-person', label: 'In Person', icon: '📍' },
  { id: 'hybrid', label: 'Hybrid', icon: '🔄' },
];

export default function CreateCircleView({ currentUser, supabase, onNavigate }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [eligibleConnections, setEligibleConnections] = useState([]);
  const [loadingConnections, setLoadingConnections] = useState(true);

  // Form state
  const [circleName, setCircleName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedCadence, setSelectedCadence] = useState('');
  const [meetingDay, setMeetingDay] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [locationType, setLocationType] = useState('virtual');
  const [locationDetails, setLocationDetails] = useState('');
  const [maxMembers, setMaxMembers] = useState(8);
  const [selectedMembers, setSelectedMembers] = useState([]);

  useEffect(() => {
    loadEligibleConnections();
  }, []);

  const loadEligibleConnections = async () => {
    setLoadingConnections(true);
    try {
      const connections = await getEligibleConnections();
      setEligibleConnections(connections);
    } catch (error) {
      console.error('Error loading connections:', error);
    } finally {
      setLoadingConnections(false);
    }
  };

  const handleToggleMember = (connectionId) => {
    if (selectedMembers.includes(connectionId)) {
      setSelectedMembers(selectedMembers.filter(id => id !== connectionId));
    } else {
      if (selectedMembers.length >= maxMembers - 1) {
        alert(`Maximum ${maxMembers} members (including you)`);
        return;
      }
      setSelectedMembers([...selectedMembers, connectionId]);
    }
  };

  const canProceedStep1 = circleName.trim().length >= 3;
  const canProceedStep2 = selectedCategory !== '';
  const canProceedStep3 = selectedCadence !== '' && locationType !== '';
  const canSubmit = selectedMembers.length >= 2;

  const handleSubmit = async () => {
    if (!canSubmit) {
      alert('Please select at least 2 members to invite');
      return;
    }

    setLoading(true);
    try {
      // Create the group with the current schema
      // Note: Extended fields (description, category, cadence, etc.)
      // can be stored once the database schema is updated
      await createConnectionGroup({
        name: circleName.trim(),
        invitedUserIds: selectedMembers
      });

      alert(`Circle "${circleName}" created! Invitations sent to ${selectedMembers.length} members.`);
      onNavigate?.('connectionGroups');
    } catch (error) {
      alert('Error creating circle: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <div style={styles.stepIndicator}>
      {[1, 2, 3, 4].map((s) => (
        <div key={s} style={styles.stepWrapper}>
          <div
            style={{
              ...styles.stepDot,
              ...(step >= s ? styles.stepDotActive : {}),
              ...(step === s ? styles.stepDotCurrent : {})
            }}
          >
            {step > s ? '✓' : s}
          </div>
          {s < 4 && (
            <div
              style={{
                ...styles.stepLine,
                ...(step > s ? styles.stepLineActive : {})
              }}
            />
          )}
        </div>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div style={styles.stepContent}>
      <h2 style={styles.stepTitle}>Name Your Circle</h2>
      <p style={styles.stepSubtitle}>Choose a name that reflects the purpose of your group</p>

      <div style={styles.formGroup}>
        <label style={styles.label}>Circle Name</label>
        <input
          type="text"
          value={circleName}
          onChange={(e) => setCircleName(e.target.value)}
          placeholder="e.g., Career Changers Circle"
          style={styles.input}
          maxLength={50}
        />
        <span style={styles.charCount}>{circleName.length}/50</span>
      </div>

      <div style={styles.formGroup}>
        <label style={styles.label}>Description (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this circle about? What will members gain?"
          style={styles.textarea}
          rows={3}
          maxLength={200}
        />
        <span style={styles.charCount}>{description.length}/200</span>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div style={styles.stepContent}>
      <h2 style={styles.stepTitle}>Choose a Category</h2>
      <p style={styles.stepSubtitle}>Help others discover your circle</p>

      <div style={styles.categoryGrid}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            style={{
              ...styles.categoryCard,
              ...(selectedCategory === cat.id ? styles.categoryCardSelected : {})
            }}
            onClick={() => setSelectedCategory(cat.id)}
          >
            <span style={styles.categoryEmoji}>{cat.emoji}</span>
            <span style={styles.categoryLabel}>{cat.label}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div style={styles.stepContent}>
      <h2 style={styles.stepTitle}>Set Your Schedule</h2>
      <p style={styles.stepSubtitle}>When and where will your circle meet?</p>

      <div style={styles.formGroup}>
        <label style={styles.label}>Meeting Cadence</label>
        <div style={styles.optionGrid}>
          {CADENCE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              style={{
                ...styles.optionButton,
                ...(selectedCadence === opt.id ? styles.optionButtonSelected : {})
              }}
              onClick={() => setSelectedCadence(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.formRow}>
        <div style={styles.formGroupHalf}>
          <label style={styles.label}>Preferred Day</label>
          <select
            value={meetingDay}
            onChange={(e) => setMeetingDay(e.target.value)}
            style={styles.select}
          >
            <option value="">Select day</option>
            <option value="monday">Monday</option>
            <option value="tuesday">Tuesday</option>
            <option value="wednesday">Wednesday</option>
            <option value="thursday">Thursday</option>
            <option value="friday">Friday</option>
            <option value="saturday">Saturday</option>
            <option value="sunday">Sunday</option>
            <option value="flexible">Flexible</option>
          </select>
        </div>

        <div style={styles.formGroupHalf}>
          <label style={styles.label}>Preferred Time</label>
          <select
            value={meetingTime}
            onChange={(e) => setMeetingTime(e.target.value)}
            style={styles.select}
          >
            <option value="">Select time</option>
            <option value="morning">Morning (6-12)</option>
            <option value="afternoon">Afternoon (12-5)</option>
            <option value="evening">Evening (5-9)</option>
            <option value="flexible">Flexible</option>
          </select>
        </div>
      </div>

      <div style={styles.formGroup}>
        <label style={styles.label}>Location Type</label>
        <div style={styles.locationOptions}>
          {LOCATION_OPTIONS.map((loc) => (
            <button
              key={loc.id}
              style={{
                ...styles.locationButton,
                ...(locationType === loc.id ? styles.locationButtonSelected : {})
              }}
              onClick={() => setLocationType(loc.id)}
            >
              <span style={styles.locationIcon}>{loc.icon}</span>
              <span>{loc.label}</span>
            </button>
          ))}
        </div>
      </div>

      {locationType !== 'virtual' && (
        <div style={styles.formGroup}>
          <label style={styles.label}>Location Details</label>
          <input
            type="text"
            value={locationDetails}
            onChange={(e) => setLocationDetails(e.target.value)}
            placeholder="City or specific venue"
            style={styles.input}
          />
        </div>
      )}

      <div style={styles.formGroup}>
        <label style={styles.label}>Maximum Members</label>
        <div style={styles.memberSlider}>
          <input
            type="range"
            min="4"
            max="10"
            value={maxMembers}
            onChange={(e) => setMaxMembers(parseInt(e.target.value))}
            style={styles.slider}
          />
          <span style={styles.memberCount}>{maxMembers} members</span>
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div style={styles.stepContent}>
      <h2 style={styles.stepTitle}>Invite Members</h2>
      <p style={styles.stepSubtitle}>Select 2-{maxMembers - 1} connections to invite (you&apos;ll be the {maxMembers}th member)</p>

      {loadingConnections ? (
        <div style={styles.loadingState}>
          <div style={styles.spinner}></div>
          <p>Loading your connections...</p>
        </div>
      ) : eligibleConnections.length < 2 ? (
        <div style={styles.emptyState}>
          <span style={styles.emptyIcon}>👥</span>
          <p style={styles.emptyText}>You need at least 2 connections</p>
          <p style={styles.emptyHint}>Connect with more people to create a circle</p>
          <button
            style={styles.discoverButton}
            onClick={() => onNavigate?.('discover')}
          >
            Discover People
          </button>
        </div>
      ) : (
        <>
          <div style={styles.selectionInfo}>
            <span style={styles.selectionCount}>
              {selectedMembers.length} of {maxMembers - 1} selected
            </span>
            {selectedMembers.length >= 2 && (
              <span style={styles.readyBadge}>Ready to create!</span>
            )}
          </div>

          <div style={styles.connectionsList}>
            {eligibleConnections.map((connection) => {
              const isSelected = selectedMembers.includes(connection.id);
              return (
                <div
                  key={connection.id}
                  style={{
                    ...styles.connectionCard,
                    ...(isSelected ? styles.connectionCardSelected : {})
                  }}
                  onClick={() => handleToggleMember(connection.id)}
                >
                  <div style={styles.connectionCheckbox}>
                    {isSelected && <span style={styles.checkmark}>✓</span>}
                  </div>
                  <div style={styles.connectionInfo}>
                    <span style={styles.connectionName}>{connection.name}</span>
                    <span style={styles.connectionCareer}>{connection.career || 'Professional'}</span>
                    {connection.city && (
                      <span style={styles.connectionLocation}>📍 {connection.city}{connection.state ? `, ${connection.state}` : ''}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div style={styles.container}>
      <div style={styles.ambientBg}></div>

      {/* Header */}
      <header style={styles.header}>
        <button
          style={styles.backButton}
          onClick={() => {
            if (step > 1) {
              setStep(step - 1);
            } else {
              onNavigate?.('allCircles');
            }
          }}
        >
          ← {step > 1 ? 'Back' : 'Cancel'}
        </button>
        <h1 style={styles.headerTitle}>Create a Circle</h1>
        <div style={styles.headerSpacer}></div>
      </header>

      {/* Step Indicator */}
      {renderStepIndicator()}

      {/* Form Content */}
      <div style={styles.formContainer}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </div>

      {/* Footer Navigation */}
      <div style={styles.footer}>
        {step < 4 ? (
          <button
            style={{
              ...styles.nextButton,
              ...((step === 1 && !canProceedStep1) ||
                 (step === 2 && !canProceedStep2) ||
                 (step === 3 && !canProceedStep3)
                ? styles.buttonDisabled
                : {})
            }}
            onClick={() => setStep(step + 1)}
            disabled={
              (step === 1 && !canProceedStep1) ||
              (step === 2 && !canProceedStep2) ||
              (step === 3 && !canProceedStep3)
            }
          >
            Continue
          </button>
        ) : (
          <button
            style={{
              ...styles.submitButton,
              ...(!canSubmit || loading ? styles.buttonDisabled : {})
            }}
            onClick={handleSubmit}
            disabled={!canSubmit || loading}
          >
            {loading ? 'Creating...' : `Create Circle with ${selectedMembers.length + 1} Members`}
          </button>
        )}
      </div>

      <style>{keyframeStyles}</style>
    </div>
  );
}

const keyframeStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=DM+Sans:wght@400;500;600&display=swap');

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* Responsive styles */
  @media (max-width: 640px) {
    .create-circle-container {
      padding: 16px !important;
    }
  }
`;

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(165deg, #FDF8F3 0%, #F5EDE6 50%, #EDE4DB 100%)',
    fontFamily: '"DM Sans", sans-serif',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
  },
  ambientBg: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: `
      radial-gradient(ellipse at 20% 20%, rgba(139, 111, 92, 0.08) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 80%, rgba(166, 123, 91, 0.06) 0%, transparent 50%)
    `,
    pointerEvents: 'none',
    zIndex: 0,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 24px',
    position: 'relative',
    zIndex: 1,
  },
  backButton: {
    background: 'none',
    border: 'none',
    color: '#6B5344',
    fontSize: '15px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
    padding: '8px 0',
  },
  headerTitle: {
    fontFamily: '"Playfair Display", serif',
    fontSize: '20px',
    fontWeight: '600',
    color: '#3D2B1F',
    margin: 0,
  },
  headerSpacer: {
    width: '60px',
  },
  stepIndicator: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px 24px',
    position: 'relative',
    zIndex: 1,
  },
  stepWrapper: {
    display: 'flex',
    alignItems: 'center',
  },
  stepDot: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: 'rgba(139, 111, 92, 0.15)',
    color: '#8B7355',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'all 0.3s ease',
  },
  stepDotActive: {
    backgroundColor: '#8B6F5C',
    color: 'white',
  },
  stepDotCurrent: {
    boxShadow: '0 0 0 4px rgba(139, 111, 92, 0.2)',
  },
  stepLine: {
    width: '40px',
    height: '2px',
    backgroundColor: 'rgba(139, 111, 92, 0.15)',
    margin: '0 8px',
    transition: 'all 0.3s ease',
  },
  stepLineActive: {
    backgroundColor: '#8B6F5C',
  },
  formContainer: {
    flex: 1,
    padding: '0 24px',
    position: 'relative',
    zIndex: 1,
    maxWidth: '600px',
    margin: '0 auto',
    width: '100%',
    animation: 'fadeIn 0.4s ease-out',
  },
  stepContent: {
    paddingBottom: '100px',
  },
  stepTitle: {
    fontFamily: '"Playfair Display", serif',
    fontSize: '28px',
    fontWeight: '600',
    color: '#3D2B1F',
    marginBottom: '8px',
    margin: '0 0 8px 0',
  },
  stepSubtitle: {
    fontSize: '15px',
    color: '#8B7355',
    marginBottom: '32px',
    margin: '0 0 32px 0',
  },
  formGroup: {
    marginBottom: '24px',
  },
  formRow: {
    display: 'flex',
    gap: '16px',
    marginBottom: '24px',
  },
  formGroupHalf: {
    flex: 1,
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '600',
    color: '#3D2B1F',
    marginBottom: '8px',
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    backgroundColor: 'white',
    border: '1.5px solid rgba(139, 111, 92, 0.2)',
    borderRadius: '12px',
    fontSize: '15px',
    color: '#3D2B1F',
    outline: 'none',
    fontFamily: '"DM Sans", sans-serif',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s ease',
  },
  textarea: {
    width: '100%',
    padding: '14px 16px',
    backgroundColor: 'white',
    border: '1.5px solid rgba(139, 111, 92, 0.2)',
    borderRadius: '12px',
    fontSize: '15px',
    color: '#3D2B1F',
    outline: 'none',
    fontFamily: '"DM Sans", sans-serif',
    boxSizing: 'border-box',
    resize: 'none',
    transition: 'border-color 0.2s ease',
  },
  select: {
    width: '100%',
    padding: '14px 16px',
    backgroundColor: 'white',
    border: '1.5px solid rgba(139, 111, 92, 0.2)',
    borderRadius: '12px',
    fontSize: '15px',
    color: '#3D2B1F',
    outline: 'none',
    fontFamily: '"DM Sans", sans-serif',
    boxSizing: 'border-box',
    cursor: 'pointer',
  },
  charCount: {
    display: 'block',
    textAlign: 'right',
    fontSize: '12px',
    color: '#A89080',
    marginTop: '4px',
  },
  categoryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
    gap: '12px',
  },
  categoryCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '16px 12px',
    backgroundColor: 'white',
    border: '1.5px solid rgba(139, 111, 92, 0.15)',
    borderRadius: '16px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    fontFamily: '"DM Sans", sans-serif',
  },
  categoryCardSelected: {
    backgroundColor: 'rgba(139, 111, 92, 0.1)',
    borderColor: '#8B6F5C',
    boxShadow: '0 0 0 2px rgba(139, 111, 92, 0.15)',
  },
  categoryEmoji: {
    fontSize: '28px',
  },
  categoryLabel: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#3D2B1F',
  },
  optionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '10px',
  },
  optionButton: {
    padding: '14px 16px',
    backgroundColor: 'white',
    border: '1.5px solid rgba(139, 111, 92, 0.15)',
    borderRadius: '12px',
    fontSize: '14px',
    color: '#3D2B1F',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    fontFamily: '"DM Sans", sans-serif',
  },
  optionButtonSelected: {
    backgroundColor: 'rgba(139, 111, 92, 0.1)',
    borderColor: '#8B6F5C',
  },
  locationOptions: {
    display: 'flex',
    gap: '10px',
  },
  locationButton: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    padding: '16px',
    backgroundColor: 'white',
    border: '1.5px solid rgba(139, 111, 92, 0.15)',
    borderRadius: '12px',
    fontSize: '14px',
    color: '#3D2B1F',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    fontFamily: '"DM Sans", sans-serif',
  },
  locationButtonSelected: {
    backgroundColor: 'rgba(139, 111, 92, 0.1)',
    borderColor: '#8B6F5C',
  },
  locationIcon: {
    fontSize: '24px',
  },
  memberSlider: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  slider: {
    flex: 1,
    height: '6px',
    accentColor: '#8B6F5C',
  },
  memberCount: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#5C4033',
    minWidth: '90px',
  },
  selectionInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  selectionCount: {
    fontSize: '14px',
    color: '#6B5344',
    fontWeight: '500',
  },
  readyBadge: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#4CAF50',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    padding: '4px 12px',
    borderRadius: '100px',
  },
  connectionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    maxHeight: '400px',
    overflowY: 'auto',
  },
  connectionCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '16px',
    backgroundColor: 'white',
    border: '1.5px solid rgba(139, 111, 92, 0.15)',
    borderRadius: '14px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  connectionCardSelected: {
    backgroundColor: 'rgba(139, 111, 92, 0.08)',
    borderColor: '#8B6F5C',
  },
  connectionCheckbox: {
    width: '24px',
    height: '24px',
    backgroundColor: 'rgba(139, 111, 92, 0.1)',
    border: '1.5px solid rgba(139, 111, 92, 0.3)',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkmark: {
    color: '#8B6F5C',
    fontWeight: '600',
    fontSize: '14px',
  },
  connectionInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  connectionName: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#3D2B1F',
  },
  connectionCareer: {
    fontSize: '13px',
    color: '#6B5344',
  },
  connectionLocation: {
    fontSize: '12px',
    color: '#A89080',
  },
  loadingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid rgba(139, 111, 92, 0.2)',
    borderTopColor: '#8B6F5C',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '12px',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px',
    opacity: 0.6,
  },
  emptyText: {
    fontSize: '16px',
    fontWeight: '500',
    color: '#5C4033',
    marginBottom: '4px',
  },
  emptyHint: {
    fontSize: '14px',
    color: '#8B7355',
    marginBottom: '20px',
  },
  discoverButton: {
    padding: '12px 24px',
    backgroundColor: '#8B6F5C',
    border: 'none',
    borderRadius: '100px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
  },
  footer: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '16px 24px',
    backgroundColor: 'rgba(253, 248, 243, 0.95)',
    borderTop: '1px solid rgba(139, 111, 92, 0.1)',
    zIndex: 10,
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
  },
  nextButton: {
    width: '100%',
    maxWidth: '600px',
    margin: '0 auto',
    display: 'block',
    padding: '16px 24px',
    backgroundColor: '#8B6F5C',
    border: 'none',
    borderRadius: '14px',
    color: 'white',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
    transition: 'all 0.3s ease',
  },
  submitButton: {
    width: '100%',
    maxWidth: '600px',
    margin: '0 auto',
    display: 'block',
    padding: '16px 24px',
    backgroundColor: '#5C4033',
    border: 'none',
    borderRadius: '14px',
    color: 'white',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
    transition: 'all 0.3s ease',
  },
  buttonDisabled: {
    backgroundColor: 'rgba(139, 111, 92, 0.3)',
    cursor: 'not-allowed',
  },
};
