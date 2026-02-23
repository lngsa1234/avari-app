'use client';

import { useState, useEffect } from 'react';
import {
  Heart,
  MessageCircle,
  Rocket,
  Briefcase,
  Building2,
  TrendingUp,
  Sparkles,
  Crown,
  Lightbulb,
  Calendar,
  User,
  MapPin,
  Camera,
  Upload,
  Check,
  ChevronRight,
  ChevronLeft,
  Lock
} from 'lucide-react';

// ============================================================
// DESIGN TOKENS
// ============================================================

const colors = {
  primary: '#8B6F5C',
  primaryDark: '#6B5344',
  primaryLight: '#A89080',
  cream: '#FDF8F3',
  warmWhite: '#FFFAF5',
  text: '#3F1906',
  textLight: '#584233',
  textMuted: 'rgba(107, 86, 71, 0.77)',
  textSoft: '#A89080',
  border: 'rgba(139, 111, 92, 0.15)',
  borderMedium: 'rgba(139, 111, 92, 0.25)',
  selectedBg: 'rgba(139, 111, 92, 0.08)',
  success: '#4CAF50',
  sage: '#8B9E7E',
  gold: '#C9A96E',
  gradient: 'linear-gradient(219.16deg, rgba(247, 242, 236, 0.96) 39.76%, rgba(240, 225, 213, 0.980157) 67.53%, rgba(236, 217, 202, 0.990231) 82.33%)',
};

const fonts = {
  serif: '"Lora", Georgia, serif',
  sans: '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

// ============================================================
// RESPONSIVE HOOK
// ============================================================

const useWindowSize = () => {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth });
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return windowSize;
};

// ============================================================
// DATA
// ============================================================

const COMMON_ROLES = [
  'Product Manager', 'Software Engineer', 'Data Scientist', 'UX Designer',
  'Marketing Manager', 'Sales Executive', 'Operations Manager', 'HR Manager',
  'Financial Analyst', 'Project Manager', 'Business Analyst', 'Content Strategist',
  'Growth Manager', 'Customer Success Manager', 'Engineering Manager', 'CTO',
  'CEO', 'Founder', 'Consultant', 'Freelancer', 'Other'
];

const INDUSTRIES = [
  { id: 'fintech', label: 'Fintech', popular: true },
  { id: 'ai', label: 'AI / Machine Learning', popular: true },
  { id: 'healthtech', label: 'HealthTech', popular: true },
  { id: 'saas', label: 'SaaS', popular: true },
  { id: 'ecommerce', label: 'E-commerce', popular: false },
  { id: 'edtech', label: 'EdTech', popular: false },
  { id: 'media', label: 'Media & Entertainment', popular: false },
  { id: 'consulting', label: 'Consulting', popular: false },
  { id: 'finance', label: 'Finance & Banking', popular: false },
  { id: 'healthcare', label: 'Healthcare', popular: false },
  { id: 'retail', label: 'Retail', popular: false },
  { id: 'manufacturing', label: 'Manufacturing', popular: false },
  { id: 'nonprofit', label: 'Non-profit', popular: false },
  { id: 'government', label: 'Government', popular: false },
  { id: 'other', label: 'Other', popular: false }
];

const CAREER_STAGES = [
  {
    id: 'emerging',
    label: 'Emerging',
    subtitle: 'Early Career',
    description: 'Building foundations, learning the ropes',
    icon: Sparkles,
    gradient: 'linear-gradient(135deg, #8B9E7E, #6B8C5E)',
  },
  {
    id: 'scaling',
    label: 'Scaling',
    subtitle: 'Mid-Career',
    description: 'Growing expertise, seeking new challenges',
    icon: TrendingUp,
    gradient: 'linear-gradient(135deg, #C9A96E, #B08D4F)',
  },
  {
    id: 'leading',
    label: 'Leading',
    subtitle: 'Manager / Director',
    description: 'Managing teams, driving strategy',
    icon: Briefcase,
    gradient: 'linear-gradient(135deg, #A88070, #8B6F5C)',
  },
  {
    id: 'legacy',
    label: 'Legacy',
    subtitle: 'Executive / Founder',
    description: 'Shaping industries, mentoring others',
    icon: Crown,
    gradient: 'linear-gradient(135deg, #D4A06A, #C48B4A)',
  }
];

const VIBE_OPTIONS = [
  {
    id: 'advice',
    label: 'I need advice',
    caption: "I'm looking for a mentor or a guide.",
    icon: Heart,
    gradient: 'linear-gradient(135deg, #D4837A, #C96B6B)',
    selectedBg: 'rgba(212, 131, 122, 0.08)',
    selectedBorder: '#D4837A',
  },
  {
    id: 'vent',
    label: 'I want to vent',
    caption: 'I need a safe space with peers who get it.',
    icon: MessageCircle,
    gradient: 'linear-gradient(135deg, #D4A06A, #C48B4A)',
    selectedBg: 'rgba(212, 160, 106, 0.08)',
    selectedBorder: '#D4A06A',
  },
  {
    id: 'grow',
    label: 'I want to grow',
    caption: "I'm here to sharpen my skills.",
    icon: Rocket,
    gradient: 'linear-gradient(135deg, #8B9E7E, #6B8C5E)',
    selectedBg: 'rgba(139, 158, 126, 0.08)',
    selectedBorder: '#8B9E7E',
  }
];

// ============================================================
// COMPONENT
// ============================================================

export default function ProfileSetupFlow({ session, supabase, onComplete }) {
  const { width: windowWidth } = useWindowSize();
  const isMobile = windowWidth < 640;

  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [roleSearch, setRoleSearch] = useState('');
  const [industrySearch, setIndustrySearch] = useState('');
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);

  // Profile data
  const [profile, setProfile] = useState({
    vibe_category: null,
    career: '',
    industry: '',
    career_stage: null,
    hook: '',
    open_to_hosting: false,
    name: session?.profile?.name || '',
    city: '',
    state: '',
    country: '',
    profile_picture: null
  });

  // Steps configuration
  const steps = [
    { id: 'vibe', title: "What's your vibe today?", subtitle: 'This helps us tune your Discover feed.', required: true },
    { id: 'role', title: 'What do you do?', subtitle: 'Your role and industry help us find your circle.', required: true },
    { id: 'stage', title: 'Where are you in your journey?', subtitle: 'This helps us match you with the right peers.', required: true },
    { id: 'hook', title: 'What can others ask you about?', subtitle: 'Share your expertise with the community.', required: false },
    { id: 'hosting', title: 'Would you host a meetup?', subtitle: "You'll be notified when people need your expertise.", required: true },
    { id: 'identity', title: 'Tell us about yourself', subtitle: 'How should we introduce you?', required: true },
    { id: 'photo', title: 'Add a profile picture', subtitle: 'A photo helps build trust in the community.', required: false },
    { id: 'preview', title: 'Ready to enter the Circle?', subtitle: "Here's how others will see you.", required: true }
  ];

  const currentStepData = steps[currentStep];
  const totalSteps = steps.length;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  // Validation for each step
  const isStepValid = () => {
    switch (currentStepData.id) {
      case 'vibe': return !!profile.vibe_category;
      case 'role': return !!profile.career && !!profile.industry;
      case 'stage': return !!profile.career_stage;
      case 'hook': return true;
      case 'hosting': return true;
      case 'identity': return !!profile.name?.trim();
      case 'photo': return true;
      case 'preview': return true;
      default: return false;
    }
  };

  const handleNext = async () => {
    if (currentStep === totalSteps - 1) {
      await handleSave();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    if (!currentStepData.required) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: profile.name?.trim(),
          career: profile.career,
          industry: profile.industry,
          career_stage: profile.career_stage,
          vibe_category: profile.vibe_category,
          hook: profile.hook?.trim() || null,
          open_to_hosting: profile.open_to_hosting,
          city: profile.city?.trim() || null,
          state: profile.state?.trim() || null,
          country: profile.country?.trim() || null,
          profile_picture: profile.profile_picture,
          onboarding_completed: true,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        })
        .eq('id', session.user.id);

      if (error) throw error;

      onComplete(profile);
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB');
      return;
    }

    setIsLoading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${session.user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setProfile(prev => ({ ...prev, profile_picture: publicUrl }));
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert('Failed to upload photo. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter roles for autocomplete
  const filteredRoles = COMMON_ROLES.filter(role =>
    role.toLowerCase().includes(roleSearch.toLowerCase())
  );

  // Filter industries
  const filteredIndustries = INDUSTRIES.filter(ind =>
    ind.label.toLowerCase().includes(industrySearch.toLowerCase())
  );

  // Get user initials for placeholder avatar
  const getInitials = () => {
    const name = profile.name || '';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase() || '?';
  };

  // ============================================================
  // SHARED STYLES
  // ============================================================

  const inputStyle = {
    width: '100%',
    padding: '14px 16px 14px 44px',
    border: `1px solid ${colors.border}`,
    borderRadius: 12,
    fontSize: isMobile ? 16 : 18,
    fontFamily: fonts.sans,
    color: colors.text,
    background: '#fff',
    outline: 'none',
    transition: 'border-color 0.2s',
  };

  const inputStyleNoIcon = {
    ...inputStyle,
    paddingLeft: 16,
  };

  const inputIconStyle = {
    position: 'absolute',
    left: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    width: 20,
    height: 20,
    color: colors.textSoft,
  };

  const labelStyle = {
    display: 'block',
    fontSize: 14,
    fontWeight: 500,
    fontFamily: fonts.sans,
    color: colors.textLight,
    marginBottom: 8,
  };

  // ============================================================
  // STEP RENDERERS
  // ============================================================

  const renderVibeStep = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {VIBE_OPTIONS.map((vibe) => {
        const Icon = vibe.icon;
        const isSelected = profile.vibe_category === vibe.id;

        return (
          <button
            key={vibe.id}
            onClick={() => setProfile(prev => ({ ...prev, vibe_category: vibe.id }))}
            style={{
              width: '100%',
              padding: isMobile ? 16 : 20,
              borderRadius: 16,
              border: `2px solid ${isSelected ? vibe.selectedBorder : colors.border}`,
              background: isSelected ? vibe.selectedBg : '#fff',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s',
              transform: isSelected ? 'scale(1.02)' : 'scale(1)',
              boxShadow: isSelected ? '0 4px 16px rgba(139, 111, 92, 0.12)' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: isMobile ? 48 : 56,
                height: isMobile ? 48 : 56,
                borderRadius: 12,
                background: vibe.gradient,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Icon style={{ width: isMobile ? 24 : 28, height: isMobile ? 24 : 28, color: '#fff' }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, color: colors.text, fontSize: isMobile ? 16 : 18, fontFamily: fonts.sans, margin: 0 }}>
                  {vibe.label}
                </p>
                <p style={{ color: colors.textLight, fontSize: 14, fontFamily: fonts.sans, marginTop: 2, margin: 0 }}>
                  {vibe.caption}
                </p>
              </div>
              {isSelected && (
                <Check style={{ width: 24, height: 24, color: colors.success, flexShrink: 0 }} />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );

  const renderRoleStep = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Role Input */}
      <div>
        <label style={labelStyle}>Your Role</label>
        <div style={{ position: 'relative' }}>
          <Briefcase style={inputIconStyle} />
          <input
            type="text"
            value={profile.career}
            onChange={(e) => {
              setProfile(prev => ({ ...prev, career: e.target.value }));
              setRoleSearch(e.target.value);
              setShowRoleDropdown(true);
            }}
            onFocus={() => setShowRoleDropdown(true)}
            onBlur={() => setTimeout(() => setShowRoleDropdown(false), 200)}
            placeholder="e.g. Product Manager"
            style={inputStyle}
          />
          {showRoleDropdown && filteredRoles.length > 0 && (
            <div style={{
              position: 'absolute',
              zIndex: 10,
              width: '100%',
              marginTop: 4,
              background: '#fff',
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
              boxShadow: '0 8px 24px rgba(139, 111, 92, 0.12)',
              maxHeight: 192,
              overflowY: 'auto',
            }}>
              {filteredRoles.slice(0, 8).map((role) => (
                <button
                  key={role}
                  onClick={() => {
                    setProfile(prev => ({ ...prev, career: role }));
                    setShowRoleDropdown(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: colors.textLight,
                    fontFamily: fonts.sans,
                    fontSize: 15,
                  }}
                >
                  {role}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Industry Input */}
      <div>
        <label style={labelStyle}>Your Industry</label>

        {/* Popular chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {INDUSTRIES.filter(i => i.popular).map((ind) => {
            const isSelected = profile.industry === ind.label;
            return (
              <button
                key={ind.id}
                onClick={() => setProfile(prev => ({ ...prev, industry: ind.label }))}
                style={{
                  padding: '8px 16px',
                  borderRadius: 20,
                  fontSize: 14,
                  fontWeight: 500,
                  fontFamily: fonts.sans,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: isSelected ? colors.primary : 'rgba(139, 111, 92, 0.08)',
                  color: isSelected ? '#fff' : colors.textLight,
                }}
              >
                {ind.label}
              </button>
            );
          })}
        </div>

        <div style={{ position: 'relative' }}>
          <Building2 style={inputIconStyle} />
          <input
            type="text"
            value={profile.industry}
            onChange={(e) => {
              setProfile(prev => ({ ...prev, industry: e.target.value }));
              setIndustrySearch(e.target.value);
            }}
            placeholder="Search or select industry"
            style={inputStyle}
          />
        </div>
      </div>
    </div>
  );

  const renderStageStep = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {CAREER_STAGES.map((stage) => {
        const Icon = stage.icon;
        const isSelected = profile.career_stage === stage.id;

        return (
          <button
            key={stage.id}
            onClick={() => setProfile(prev => ({ ...prev, career_stage: stage.id }))}
            style={{
              width: '100%',
              padding: 16,
              borderRadius: 12,
              border: `2px solid ${isSelected ? colors.primary : colors.border}`,
              background: isSelected ? colors.selectedBg : '#fff',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s',
              boxShadow: isSelected ? '0 4px 12px rgba(139, 111, 92, 0.1)' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: stage.gradient,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Icon style={{ width: 24, height: 24, color: '#fff' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <p style={{ fontWeight: 600, color: colors.text, fontFamily: fonts.sans, margin: 0, fontSize: 15 }}>
                    {stage.label}
                  </p>
                  <span style={{
                    fontSize: 12,
                    color: colors.textMuted,
                    background: 'rgba(139, 111, 92, 0.06)',
                    padding: '2px 8px',
                    borderRadius: 12,
                    fontFamily: fonts.sans,
                  }}>
                    {stage.subtitle}
                  </span>
                </div>
                <p style={{ color: colors.textLight, fontSize: 14, fontFamily: fonts.sans, marginTop: 2, margin: 0 }}>
                  {stage.description}
                </p>
              </div>
              {isSelected && (
                <Check style={{ width: 20, height: 20, color: colors.primary, flexShrink: 0 }} />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );

  const renderHookStep = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{
        fontSize: 14,
        color: colors.textMuted,
        fontFamily: fonts.sans,
        fontStyle: 'italic',
        margin: 0,
        lineHeight: 1.5,
      }}>
        e.g. "Fundraising for early-stage startups" or "Building high-performing teams"
      </p>

      <div>
        <label style={labelStyle}>Ask me about:</label>
        <textarea
          value={profile.hook}
          onChange={(e) => setProfile(prev => ({ ...prev, hook: e.target.value }))}
          placeholder="What expertise can you share with others?"
          maxLength={150}
          style={{
            width: '100%',
            padding: 16,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            fontSize: isMobile ? 16 : 18,
            fontFamily: fonts.sans,
            color: colors.text,
            background: '#fff',
            outline: 'none',
            height: 128,
            resize: 'none',
            transition: 'border-color 0.2s',
            boxSizing: 'border-box',
          }}
        />
        <p style={{ textAlign: 'right', fontSize: 14, color: colors.textMuted, fontFamily: fonts.sans, marginTop: 4 }}>
          {profile.hook?.length || 0}/150
        </p>
      </div>
    </div>
  );

  const renderHostingStep = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{
        background: colors.selectedBg,
        border: `1px solid ${colors.border}`,
        borderRadius: 12,
        padding: 16,
        marginBottom: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <Calendar style={{ width: 20, height: 20, color: colors.primary, marginTop: 2, flexShrink: 0 }} />
          <p style={{ fontSize: 14, color: colors.textLight, fontFamily: fonts.sans, margin: 0 }}>
            When community members request a meetup topic you're knowledgeable about, we'll notify you. No obligation to host!
          </p>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr',
        gap: 16,
      }}>
        <button
          onClick={() => setProfile(prev => ({ ...prev, open_to_hosting: true }))}
          style={{
            padding: isMobile ? 20 : 24,
            borderRadius: 16,
            border: `2px solid ${profile.open_to_hosting ? colors.success : colors.border}`,
            background: profile.open_to_hosting ? 'rgba(76, 175, 80, 0.06)' : '#fff',
            cursor: 'pointer',
            textAlign: 'center',
            transition: 'all 0.2s',
            boxShadow: profile.open_to_hosting ? '0 4px 12px rgba(76, 175, 80, 0.1)' : 'none',
          }}
        >
          <div style={{
            width: isMobile ? 56 : 64,
            height: isMobile ? 56 : 64,
            margin: '0 auto 12px',
            borderRadius: '50%',
            background: 'rgba(76, 175, 80, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Check style={{ width: 32, height: 32, color: colors.success }} />
          </div>
          <p style={{ fontWeight: 600, color: colors.text, fontSize: isMobile ? 16 : 18, fontFamily: fonts.sans, margin: 0 }}>Yes</p>
          <p style={{ fontSize: 14, color: colors.textLight, fontFamily: fonts.sans, marginTop: 4 }}>I'm open to it</p>
        </button>

        <button
          onClick={() => setProfile(prev => ({ ...prev, open_to_hosting: false }))}
          style={{
            padding: isMobile ? 20 : 24,
            borderRadius: 16,
            border: `2px solid ${!profile.open_to_hosting ? colors.primaryLight : colors.border}`,
            background: !profile.open_to_hosting ? colors.selectedBg : '#fff',
            cursor: 'pointer',
            textAlign: 'center',
            transition: 'all 0.2s',
            boxShadow: !profile.open_to_hosting ? '0 4px 12px rgba(139, 111, 92, 0.1)' : 'none',
          }}
        >
          <div style={{
            width: isMobile ? 56 : 64,
            height: isMobile ? 56 : 64,
            margin: '0 auto 12px',
            borderRadius: '50%',
            background: 'rgba(139, 111, 92, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <span style={{ fontSize: 24, color: colors.textSoft }}>-</span>
          </div>
          <p style={{ fontWeight: 600, color: colors.text, fontSize: isMobile ? 16 : 18, fontFamily: fonts.sans, margin: 0 }}>Not now</p>
          <p style={{ fontSize: 14, color: colors.textLight, fontFamily: fonts.sans, marginTop: 4 }}>Maybe later</p>
        </button>
      </div>
    </div>
  );

  const renderIdentityStep = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <label style={labelStyle}>Full Name *</label>
        <div style={{ position: 'relative' }}>
          <User style={inputIconStyle} />
          <input
            type="text"
            value={profile.name}
            onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Enter your full name"
            style={inputStyle}
          />
        </div>
        <p style={{ fontSize: 12, color: colors.textMuted, fontFamily: fonts.sans, marginTop: 4 }}>
          This name will appear on your profile and in meetups
        </p>
      </div>

      <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 20 }}>
        <label style={labelStyle}>
          Location <span style={{ color: colors.textSoft }}>(optional)</span>
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: 12,
          }}>
            <div style={{ position: 'relative' }}>
              <MapPin style={inputIconStyle} />
              <input
                type="text"
                value={profile.city}
                onChange={(e) => setProfile(prev => ({ ...prev, city: e.target.value }))}
                placeholder="City"
                style={inputStyle}
              />
            </div>
            <input
              type="text"
              value={profile.state}
              onChange={(e) => setProfile(prev => ({ ...prev, state: e.target.value }))}
              placeholder="State / Province"
              style={inputStyleNoIcon}
            />
          </div>
          <input
            type="text"
            value={profile.country}
            onChange={(e) => setProfile(prev => ({ ...prev, country: e.target.value }))}
            placeholder="Country"
            style={inputStyleNoIcon}
          />
        </div>
        <p style={{ fontSize: 12, color: colors.textMuted, fontFamily: fonts.sans, marginTop: 4 }}>
          Helps us show you local meetups and events
        </p>
      </div>
    </div>
  );

  const renderPhotoStep = () => {
    const avatarSize = isMobile ? 120 : 160;
    return (
      <div style={{ textAlign: 'center' }}>
        {/* Photo preview */}
        <div style={{ position: 'relative', width: avatarSize, height: avatarSize, margin: '0 auto 24px' }}>
          {profile.profile_picture ? (
            <img
              src={profile.profile_picture}
              alt="Profile"
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '4px solid #fff',
                boxShadow: '0 8px 24px rgba(139, 111, 92, 0.15)',
              }}
            />
          ) : (
            <div style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #D4837A, #C96B6B)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: isMobile ? 32 : 40,
              fontWeight: 700,
              fontFamily: fonts.sans,
              border: '4px solid #fff',
              boxShadow: '0 8px 24px rgba(139, 111, 92, 0.15)',
            }}>
              {getInitials()}
            </div>
          )}
          <div style={{
            position: 'absolute',
            bottom: -4,
            right: -4,
            width: 40,
            height: 40,
            background: colors.primary,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(139, 111, 92, 0.2)',
          }}>
            <Camera style={{ width: 20, height: 20, color: '#fff' }} />
          </div>
        </div>

        {/* Upload buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'block', width: '100%', cursor: 'pointer' }}>
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              style={{ display: 'none' }}
            />
            <div style={{
              width: '100%',
              background: colors.primary,
              color: '#fff',
              fontWeight: 500,
              fontFamily: fonts.sans,
              fontSize: 15,
              padding: '12px 0',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'opacity 0.2s',
            }}>
              <Upload style={{ width: 20, height: 20 }} />
              Upload Photo
            </div>
          </label>

          <label style={{ display: 'block', width: '100%', cursor: 'pointer' }}>
            <input
              type="file"
              accept="image/*"
              capture="user"
              onChange={handlePhotoUpload}
              style={{ display: 'none' }}
            />
            <div style={{
              width: '100%',
              background: 'rgba(139, 111, 92, 0.08)',
              color: colors.textLight,
              fontWeight: 500,
              fontFamily: fonts.sans,
              fontSize: 15,
              padding: '12px 0',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'background 0.2s',
            }}>
              <Camera style={{ width: 20, height: 20 }} />
              Take Photo
            </div>
          </label>
        </div>

        <p style={{ fontSize: 14, color: colors.textMuted, fontFamily: fonts.sans, marginTop: 16 }}>
          A real photo increases your connection rate by 2x
        </p>
      </div>
    );
  };

  const renderPreviewStep = () => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Preview Card */}
      <div style={{
        width: '100%',
        maxWidth: 360,
        background: '#fff',
        borderRadius: 16,
        boxShadow: '0 8px 32px rgba(139, 111, 92, 0.12)',
        border: `1px solid ${colors.border}`,
        padding: 24,
        marginBottom: 24,
      }}>
        {/* Photo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          {profile.profile_picture ? (
            <img
              src={profile.profile_picture}
              alt="Profile"
              style={{
                width: 96,
                height: 96,
                borderRadius: '50%',
                objectFit: 'cover',
                border: '4px solid #fff',
                boxShadow: '0 4px 16px rgba(139, 111, 92, 0.12)',
              }}
            />
          ) : (
            <div style={{
              width: 96,
              height: 96,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #D4837A, #C96B6B)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 30,
              fontWeight: 700,
              fontFamily: fonts.sans,
              border: '4px solid #fff',
              boxShadow: '0 4px 16px rgba(139, 111, 92, 0.12)',
            }}>
              {getInitials()}
            </div>
          )}
        </div>

        {/* Name */}
        <h3 style={{
          fontSize: 20,
          fontWeight: 700,
          fontFamily: fonts.serif,
          color: colors.text,
          textAlign: 'center',
          margin: 0,
        }}>
          {profile.name || 'Your Name'}
        </h3>

        {/* Role & Industry */}
        <p style={{ color: colors.textLight, textAlign: 'center', fontFamily: fonts.sans, fontSize: 15, marginTop: 4 }}>
          {profile.career || 'Your Role'}
          {profile.industry && ` in ${profile.industry}`}
        </p>

        {/* Location */}
        {(profile.city || profile.state || profile.country) && (
          <p style={{ color: colors.textMuted, fontSize: 14, textAlign: 'center', fontFamily: fonts.sans, marginTop: 4 }}>
            {[profile.city, profile.state, profile.country].filter(Boolean).join(', ')}
          </p>
        )}

        {/* Hook */}
        {profile.hook && (
          <div style={{
            marginTop: 16,
            background: colors.selectedBg,
            borderRadius: 10,
            padding: 12,
          }}>
            <p style={{ fontSize: 14, color: colors.textLight, fontStyle: 'italic', fontFamily: fonts.sans, margin: 0 }}>
              Ask me about: "{profile.hook}"
            </p>
          </div>
        )}

        {/* Lock indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          marginTop: 16,
          color: colors.textSoft,
          fontSize: 14,
          fontFamily: fonts.sans,
        }}>
          <Lock style={{ width: 16, height: 16 }} />
          Connect to chat
        </div>
      </div>

      <p style={{ color: colors.textLight, textAlign: 'center', fontFamily: fonts.sans, fontSize: 15 }}>
        This is how others will see you in the community
      </p>
    </div>
  );

  const renderStepContent = () => {
    switch (currentStepData.id) {
      case 'vibe': return renderVibeStep();
      case 'role': return renderRoleStep();
      case 'stage': return renderStageStep();
      case 'hook': return renderHookStep();
      case 'hosting': return renderHostingStep();
      case 'identity': return renderIdentityStep();
      case 'photo': return renderPhotoStep();
      case 'preview': return renderPreviewStep();
      default: return null;
    }
  };

  // ============================================================
  // MAIN RENDER
  // ============================================================

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: colors.gradient,
      zIndex: 50,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 'env(safe-area-inset-top)',
    }}>
      {/* Centered card container */}
      <div style={{
        width: '100%',
        maxWidth: isMobile ? '100%' : 480,
        height: isMobile ? '100%' : 'auto',
        maxHeight: isMobile ? '100%' : '90vh',
        display: 'flex',
        flexDirection: 'column',
        background: isMobile ? 'transparent' : colors.warmWhite,
        borderRadius: isMobile ? 0 : 24,
        boxShadow: isMobile ? 'none' : '0 16px 48px rgba(139, 111, 92, 0.15)',
        overflow: 'hidden',
      }}>
        {/* Progress bar */}
        <div style={{ height: 6, background: 'rgba(139, 111, 92, 0.1)', flexShrink: 0 }}>
          <div style={{
            height: '100%',
            background: `linear-gradient(to right, ${colors.primary}, ${colors.gold})`,
            transition: 'width 0.5s ease',
            width: `${progress}%`,
            borderRadius: '0 3px 3px 0',
          }} />
        </div>

        {/* Header */}
        <div style={{
          padding: isMobile ? '20px 16px 16px' : '28px 28px 16px',
          flexShrink: 0,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}>
            <span style={{
              fontSize: 14,
              color: colors.textMuted,
              fontFamily: fonts.sans,
            }}>
              Step {currentStep + 1} of {totalSteps}
            </span>
            {!currentStepData.required && (
              <button
                onClick={handleSkip}
                style={{
                  fontSize: 14,
                  color: colors.textMuted,
                  fontFamily: fonts.sans,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 8px',
                }}
              >
                Skip for now
              </button>
            )}
          </div>
          <h1 style={{
            fontSize: isMobile ? 22 : 24,
            fontWeight: 700,
            fontFamily: fonts.serif,
            color: colors.text,
            margin: 0,
          }}>
            {currentStepData.title}
          </h1>
          <p style={{
            color: colors.textLight,
            fontFamily: fonts.sans,
            fontSize: 15,
            marginTop: 4,
          }}>
            {currentStepData.subtitle}
          </p>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: isMobile ? '0 16px 24px' : '0 28px 24px',
          WebkitOverflowScrolling: 'touch',
          minHeight: 0,
        }}>
          {renderStepContent()}
        </div>

        {/* Navigation */}
        <div style={{
          padding: isMobile ? '16px 16px' : '16px 28px 24px',
          paddingBottom: isMobile ? 'max(24px, env(safe-area-inset-bottom))' : 24,
          background: colors.warmWhite,
          borderTop: `1px solid ${colors.border}`,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', gap: 12 }}>
            {currentStep > 0 && (
              <button
                onClick={handleBack}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  background: 'rgba(139, 111, 92, 0.08)',
                  color: colors.textLight,
                  padding: '14px 0',
                  borderRadius: 12,
                  fontWeight: 500,
                  fontFamily: fonts.sans,
                  fontSize: 15,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
              >
                <ChevronLeft style={{ width: 20, height: 20 }} />
                Back
              </button>
            )}

            <button
              onClick={handleNext}
              disabled={!isStepValid() || isLoading}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                background: (!isStepValid() || isLoading) ? colors.primaryLight : colors.primary,
                color: '#fff',
                padding: '14px 0',
                borderRadius: 12,
                fontWeight: 600,
                fontFamily: fonts.sans,
                fontSize: 15,
                border: 'none',
                cursor: (!isStepValid() || isLoading) ? 'not-allowed' : 'pointer',
                opacity: (!isStepValid() || isLoading) ? 0.5 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              {isLoading ? (
                <div style={{
                  width: 20,
                  height: 20,
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }} />
              ) : currentStep === totalSteps - 1 ? (
                "Let's Go!"
              ) : (
                <>
                  Next
                  <ChevronRight style={{ width: 20, height: 20 }} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Spinner animation */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
