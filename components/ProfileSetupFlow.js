'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  Lock,
  Loader,
  Navigation,
  Shield,
  Users,
  HeartHandshake
} from 'lucide-react';

// ============================================================
// ERROR BOUNDARY — captures render errors for debugging
// ============================================================

class ProfileSetupErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ProfileSetup] Error boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          position: 'fixed', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', background: '#FDF8F3', zIndex: 50, padding: 24,
        }}>
          <div style={{ textAlign: 'center', maxWidth: 400 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#3F1906', marginBottom: 8 }}>
              Something went wrong
            </h2>
            <p style={{ fontSize: 14, color: '#584233', marginBottom: 16 }}>
              We ran into an issue setting up your profile. Please try again.
            </p>
            <p style={{ fontSize: 12, color: '#A89080', marginBottom: 24, wordBreak: 'break-word' }}>
              {this.state.error?.message || 'Unknown error'}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '12px 32px', background: '#8B6F5C', color: '#fff',
                border: 'none', borderRadius: 12, fontSize: 16, cursor: 'pointer',
              }}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
  // Leadership & Executive
  'CEO', 'CTO', 'CFO', 'COO', 'CMO', 'CPO', 'CIO', 'CISO',
  'VP of Engineering', 'VP of Product', 'VP of Marketing', 'VP of Sales', 'VP of Operations',
  'Director of Engineering', 'Director of Product', 'Director of Marketing', 'Director of Sales',
  'Director of Operations', 'Director of Design', 'Director of Data Science',
  'Head of Engineering', 'Head of Product', 'Head of Marketing', 'Head of Sales',
  'Head of Design', 'Head of Growth', 'Head of People', 'Head of Data',
  'Co-Founder', 'Founder', 'Managing Director', 'General Manager', 'Partner',

  // Product
  'Product Manager', 'Senior Product Manager', 'Lead Product Manager', 'Associate Product Manager',
  'Product Owner', 'Product Analyst', 'Product Marketing Manager', 'Product Designer',
  'Technical Product Manager', 'Group Product Manager',

  // Engineering & Technical
  'Software Engineer', 'Senior Software Engineer', 'Staff Software Engineer', 'Principal Engineer',
  'Frontend Engineer', 'Backend Engineer', 'Full Stack Engineer', 'Mobile Engineer',
  'iOS Developer', 'Android Developer', 'Web Developer', 'DevOps Engineer', 'SRE',
  'Platform Engineer', 'Infrastructure Engineer', 'Cloud Engineer', 'Security Engineer',
  'QA Engineer', 'QA Tester', 'Software Tester', 'Test Engineer', 'Automation Engineer', 'Engineering Manager',
  'Senior Engineering Manager', 'Technical Lead', 'Tech Lead', 'Architect',
  'Solutions Architect', 'Software Architect', 'Systems Engineer',
  'Machine Learning Engineer', 'AI Engineer', 'Blockchain Developer',
  'Embedded Systems Engineer', 'Firmware Engineer',

  // Data & Analytics
  'Data Scientist', 'Senior Data Scientist', 'Data Analyst', 'Data Engineer',
  'Business Intelligence Analyst', 'Analytics Engineer', 'ML Engineer',
  'Research Scientist', 'Applied Scientist', 'Quantitative Analyst',
  'Data Architect', 'Head of Analytics',

  // Design & UX
  'UX Designer', 'Senior UX Designer', 'UI Designer', 'UX Researcher',
  'Product Designer', 'Senior Product Designer', 'Visual Designer', 'Interaction Designer',
  'Design Lead', 'Design Manager', 'Creative Director', 'Brand Designer',
  'Graphic Designer', 'Motion Designer', 'Design Systems Lead',

  // Marketing
  'Marketing Manager', 'Senior Marketing Manager', 'Growth Manager', 'Growth Marketing Manager',
  'Digital Marketing Manager', 'Content Marketing Manager', 'Brand Manager',
  'Performance Marketing Manager', 'SEO Specialist', 'Social Media Manager',
  'Community Manager', 'Content Strategist', 'Content Creator', 'Copywriter',
  'Marketing Analyst', 'Demand Generation Manager', 'Marketing Director',
  'Communications Manager', 'PR Manager', 'Event Manager',

  // Sales & Business Development
  'Sales Executive', 'Account Executive', 'Senior Account Executive',
  'Sales Manager', 'Sales Director', 'Business Development Manager',
  'Business Development Representative', 'Sales Development Representative',
  'Account Manager', 'Key Account Manager', 'Enterprise Sales',
  'Solutions Consultant', 'Sales Engineer', 'Revenue Operations Manager',
  'Partnerships Manager', 'Channel Manager',

  // Customer Success & Support
  'Customer Success Manager', 'Senior Customer Success Manager',
  'Customer Support Manager', 'Technical Support Engineer',
  'Customer Experience Manager', 'Implementation Manager',
  'Onboarding Specialist', 'Support Engineer',

  // Operations & Strategy
  'Operations Manager', 'Senior Operations Manager', 'Business Operations Manager',
  'Strategy Manager', 'Strategy Consultant', 'Chief of Staff',
  'Program Manager', 'Project Manager', 'Senior Project Manager',
  'Scrum Master', 'Agile Coach', 'Delivery Manager',
  'Supply Chain Manager', 'Logistics Manager', 'Procurement Manager',

  // Finance & Legal
  'Financial Analyst', 'Senior Financial Analyst', 'Finance Manager',
  'Controller', 'Accountant', 'Investment Analyst', 'Investment Banker',
  'Venture Capitalist', 'Private Equity Associate', 'Fund Manager',
  'Tax Advisor', 'Auditor', 'Risk Analyst', 'Compliance Manager',
  'Legal Counsel', 'General Counsel', 'Lawyer', 'Paralegal',

  // HR & People
  'HR Manager', 'Senior HR Manager', 'People Operations Manager',
  'Recruiter', 'Senior Recruiter', 'Talent Acquisition Manager',
  'HR Business Partner', 'Compensation & Benefits Manager',
  'Learning & Development Manager', 'People Partner',

  // Consulting & Professional Services
  'Consultant', 'Senior Consultant', 'Management Consultant',
  'Strategy Consultant', 'Technology Consultant', 'Principal Consultant',
  'Business Analyst', 'Senior Business Analyst', 'Systems Analyst',
  'Freelancer', 'Independent Consultant', 'Advisor',

  // Research & Academia
  'Researcher', 'Research Engineer', 'Research Analyst',
  'Professor', 'Lecturer', 'Postdoctoral Researcher', 'PhD Student',
  'Academic', 'Research Director',

  // Healthcare & Biotech
  'Physician', 'Doctor', 'Nurse', 'Pharmacist',
  'Clinical Research Associate', 'Biotech Researcher',
  'Healthcare Administrator', 'Medical Director',

  // Creative & Media
  'Writer', 'Editor', 'Journalist', 'Producer', 'Videographer', 'Photographer',
  'Art Director', 'Creative Strategist', 'Film Director',

  // Other
  'Student', 'Intern', 'Career Changer', 'Entrepreneur', 'Investor', 'Angel Investor',
  'Board Member', 'Advisor', 'Mentor', 'Coach', 'Trainer',
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

// Role keywords → suggested industries (ordered by relevance)
const ROLE_INDUSTRY_MAP = [
  { keywords: ['software', 'engineer', 'developer', 'frontend', 'backend', 'full stack', 'mobile', 'ios', 'android', 'web dev', 'devops', 'sre', 'platform', 'infrastructure', 'cloud', 'qa', 'tester', 'test', 'automation', 'architect', 'tech lead', 'technical lead'], industries: ['SaaS', 'AI / Machine Learning', 'Fintech', 'E-commerce', 'HealthTech'] },
  { keywords: ['data scientist', 'data analyst', 'data engineer', 'ml engineer', 'machine learning', 'ai engineer', 'applied scientist', 'research scientist', 'analytics', 'quantitative'], industries: ['AI / Machine Learning', 'SaaS', 'Fintech', 'HealthTech', 'Finance & Banking'] },
  { keywords: ['product manager', 'product owner', 'product analyst', 'technical product', 'group product'], industries: ['SaaS', 'AI / Machine Learning', 'Fintech', 'E-commerce', 'HealthTech'] },
  { keywords: ['product designer', 'ux', 'ui', 'design', 'visual', 'interaction', 'creative director', 'brand designer', 'graphic', 'motion', 'art director'], industries: ['SaaS', 'Media & Entertainment', 'E-commerce', 'AI / Machine Learning', 'EdTech'] },
  { keywords: ['marketing', 'growth', 'seo', 'social media', 'content', 'brand manager', 'demand gen', 'copywriter', 'communications', 'pr manager'], industries: ['SaaS', 'E-commerce', 'Media & Entertainment', 'EdTech', 'Retail'] },
  { keywords: ['sales', 'account executive', 'business development', 'sdr', 'bdr', 'enterprise sales', 'solutions consultant', 'sales engineer', 'revenue', 'partnerships', 'channel'], industries: ['SaaS', 'Fintech', 'E-commerce', 'Consulting', 'Retail'] },
  { keywords: ['customer success', 'customer support', 'customer experience', 'implementation', 'onboarding specialist', 'support engineer'], industries: ['SaaS', 'E-commerce', 'HealthTech', 'EdTech', 'Fintech'] },
  { keywords: ['financial', 'finance', 'accountant', 'controller', 'investment', 'banker', 'venture', 'private equity', 'fund manager', 'tax', 'auditor', 'risk analyst'], industries: ['Finance & Banking', 'Fintech', 'Consulting', 'SaaS', 'Government'] },
  { keywords: ['hr', 'people', 'recruiter', 'talent', 'compensation', 'learning & development'], industries: ['SaaS', 'Consulting', 'Finance & Banking', 'HealthTech', 'Retail'] },
  { keywords: ['consultant', 'management consultant', 'strategy', 'business analyst', 'systems analyst', 'advisor'], industries: ['Consulting', 'SaaS', 'Finance & Banking', 'Fintech', 'Government'] },
  { keywords: ['operations', 'program manager', 'project manager', 'scrum', 'agile', 'delivery', 'supply chain', 'logistics', 'procurement', 'chief of staff'], industries: ['SaaS', 'Consulting', 'Manufacturing', 'Retail', 'E-commerce'] },
  { keywords: ['physician', 'doctor', 'nurse', 'pharmacist', 'clinical', 'biotech', 'healthcare admin', 'medical'], industries: ['Healthcare', 'HealthTech', 'Non-profit', 'Government', 'Manufacturing'] },
  { keywords: ['writer', 'editor', 'journalist', 'producer', 'videographer', 'photographer', 'film', 'creative strategist'], industries: ['Media & Entertainment', 'E-commerce', 'EdTech', 'SaaS', 'Non-profit'] },
  { keywords: ['professor', 'lecturer', 'postdoc', 'phd', 'academic', 'research director', 'researcher'], industries: ['EdTech', 'AI / Machine Learning', 'Healthcare', 'Non-profit', 'Government'] },
  { keywords: ['founder', 'co-founder', 'entrepreneur', 'ceo', 'cto', 'cfo', 'coo', 'cmo', 'cpo'], industries: ['SaaS', 'AI / Machine Learning', 'Fintech', 'E-commerce', 'HealthTech'] },
  { keywords: ['investor', 'angel', 'board member', 'mentor', 'coach'], industries: ['Finance & Banking', 'Fintech', 'SaaS', 'Consulting', 'AI / Machine Learning'] },
  { keywords: ['security', 'ciso', 'compliance'], industries: ['SaaS', 'Finance & Banking', 'Fintech', 'Government', 'Healthcare'] },
  { keywords: ['blockchain', 'crypto', 'web3'], industries: ['Fintech', 'SaaS', 'AI / Machine Learning', 'Finance & Banking', 'E-commerce'] },
  { keywords: ['legal', 'counsel', 'lawyer', 'paralegal'], industries: ['Finance & Banking', 'Consulting', 'Government', 'SaaS', 'Non-profit'] },
  { keywords: ['embedded', 'firmware', 'hardware'], industries: ['Manufacturing', 'HealthTech', 'SaaS', 'AI / Machine Learning', 'E-commerce'] },
];

function getSuggestedIndustries(role) {
  if (!role || role.length < 2) return [];
  const lower = role.toLowerCase();
  // Find best matching entry
  let bestMatch = null;
  let bestScore = 0;
  for (const entry of ROLE_INDUSTRY_MAP) {
    for (const kw of entry.keywords) {
      if (lower.includes(kw) || kw.includes(lower)) {
        const score = Math.min(kw.length, lower.length);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = entry;
        }
      }
    }
  }
  return bestMatch ? bestMatch.industries : [];
}

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

function ProfileSetupFlowInner({ session, supabase, onComplete }) {
  const { width: windowWidth } = useWindowSize();
  const isMobile = windowWidth < 640;

  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [roleSearch, setRoleSearch] = useState('');
  const [industrySearch, setIndustrySearch] = useState('');
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [industryManuallySet, setIndustryManuallySet] = useState(false);
  const [showAllIndustries, setShowAllIndustries] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationDetected, setLocationDetected] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Profile data
  const [profile, setProfile] = useState({
    vibe_category: null,
    career: '',
    industry: '',
    career_stage: null,
    hook: '',
    open_to_hosting: false,
  open_to_coffee_chat: false,
    name: '',
    city: '',
    state: '',
    country: '',
    profile_picture: null
  });

  const [communityAgreed, setCommunityAgreed] = useState(false);

  // Steps configuration
  const steps = [
    { id: 'community', title: 'Welcome to CircleW', subtitle: 'A safe space for women to connect and grow.', required: true },
    { id: 'vibe', title: "What's your vibe today?", subtitle: 'This helps us tune your Discover feed.', required: true },
    { id: 'role', title: 'What do you do?', subtitle: 'Your role and industry help us find your circle.', required: true },
    { id: 'stage', title: 'Where are you in your journey?', subtitle: 'This helps us match you with the right peers.', required: true },
    { id: 'bio', title: 'Describe yourself', subtitle: "What makes you special? Don't think too hard, just have fun with it.", required: false },
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
      case 'community': return communityAgreed;
      case 'vibe': return !!profile.vibe_category;
      case 'role': return !!profile.career && !!profile.industry;
      case 'stage': return !!profile.career_stage;
      case 'bio': return true;
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
          bio: profile.hook?.trim() || null,
          open_to_hosting: profile.open_to_hosting,
        open_to_coffee_chat: profile.open_to_coffee_chat,
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

  const detectLocation = async () => {
    if (!navigator.geolocation) return;
    setDetectingLocation(true);
    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
      );
      const { latitude, longitude } = pos.coords;
      const res = await fetch(
        `/api/detect-location?lat=${latitude}&lon=${longitude}`
      );
      const data = await res.json();
      if (data?.address) {
        const city = data.address.city || data.address.town || data.address.village || '';
        const state = data.address.state || '';
        const country = data.address.country || '';
        setProfile(prev => ({ ...prev, city, state, country }));
        setLocationDetected(true);
      }
    } catch (err) {
      console.error('Location detection failed:', err);
    } finally {
      setDetectingLocation(false);
    }
  };

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 640 } });
      streamRef.current = stream;
      setShowCamera(true);
      // Attach stream after render
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 100);
    } catch (err) {
      console.error('Camera access failed:', err);
      alert('Could not access camera. Please check permissions or use Upload Photo instead.');
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    // Center-crop to square
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      closeCamera();
      // Upload the captured photo
      const fileName = `${session.user.id}_${Date.now()}.jpg`;
      const filePath = `avatars/${fileName}`;
      try {
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, blob, { contentType: 'image/jpeg' });
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);
        setProfile(prev => ({ ...prev, profile_picture: publicUrl }));
      } catch (error) {
        console.error('Error uploading captured photo:', error);
      }
    }, 'image/jpeg', 0.9);
  };

  const closeCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
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

  // Suggested industries based on role
  const suggestedIndustries = getSuggestedIndustries(profile.career);

  // Auto-select #1 suggested industry when role changes (unless user manually picked one)
  const prevRoleRef = useRef(profile.career);
  useEffect(() => {
    if (profile.career !== prevRoleRef.current) {
      prevRoleRef.current = profile.career;
      if (!industryManuallySet && suggestedIndustries.length > 0) {
        setProfile(prev => ({ ...prev, industry: suggestedIndustries[0] }));
      }
    }
  }, [profile.career, suggestedIndustries, industryManuallySet]);

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
    fontSize: isMobile ? 14 : 15,
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

  const renderCommunityStep = () => {
    const values = [
      { icon: Shield, title: 'Safe & Supportive', desc: 'CircleW is built for women and non-binary professionals to connect without barriers.' },
      { icon: Users, title: 'Inclusive & Respectful', desc: 'Treat everyone with kindness. Respect this space and its members.' },
      { icon: HeartHandshake, title: 'Authentic Connections', desc: 'We are here to uplift each other — no spam, no sales pitches, just real conversations.' },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {values.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              style={{
                display: 'flex',
                gap: 14,
                padding: 16,
                borderRadius: 14,
                background: '#fff',
                border: `1px solid ${colors.border}`,
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: colors.selectedBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon style={{ width: 20, height: 20, color: colors.primary }} />
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 600, color: colors.text, fontFamily: fonts.sans, margin: '0 0 4px' }}>{title}</p>
                <p style={{ fontSize: 13, color: colors.textLight, fontFamily: fonts.sans, margin: 0, lineHeight: 1.5 }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setCommunityAgreed(prev => !prev)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 16px',
            borderRadius: 12,
            border: `2px solid ${communityAgreed ? colors.primary : colors.borderMedium}`,
            background: communityAgreed ? 'rgba(139, 111, 92, 0.06)' : '#fff',
            cursor: 'pointer',
            transition: 'all 0.2s',
            width: '100%',
            textAlign: 'left',
          }}
        >
          <div style={{
            width: 22, height: 22, borderRadius: 6,
            border: `2px solid ${communityAgreed ? colors.primary : colors.borderMedium}`,
            background: communityAgreed ? colors.primary : '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, transition: 'all 0.2s',
          }}>
            {communityAgreed && <Check style={{ width: 14, height: 14, color: '#fff' }} />}
          </div>
          <p style={{ fontSize: 14, color: colors.textLight, fontFamily: fonts.sans, margin: 0, lineHeight: 1.5 }}>
            I understand and will respect CircleW as a community built for women and non-binary professionals.
          </p>
        </button>
      </div>
    );
  };

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
            onFocus={() => { if (roleSearch.length > 0) setShowRoleDropdown(true); }}
            onBlur={() => setTimeout(() => setShowRoleDropdown(false), 200)}
            placeholder="e.g. Product Manager, QA Tester, Data Scientist..."
            id="role-input"
            style={inputStyle}
          />
          {showRoleDropdown && roleSearch.length > 0 && filteredRoles.length > 0 && (
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
        <style>{`#role-input::placeholder { color: #B8A089; opacity: 1; font-size: 14px; }`}</style>
      </div>

      {/* Industry Input */}
      <div>
        <label style={labelStyle}>Your Industry</label>

        {/* Industry chips — suggested first, then expandable rest */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {(suggestedIndustries.length > 0
            ? [
                ...suggestedIndustries.map(label => ({ label, key: label })),
                ...(showAllIndustries
                  ? INDUSTRIES.filter(i => !suggestedIndustries.includes(i.label)).map(i => ({ label: i.label, key: i.id }))
                  : []),
              ]
            : INDUSTRIES.map(i => ({ label: i.label, key: i.id }))
          ).map(({ label, key }) => {
            const isSelected = profile.industry === label;
            return (
              <button
                key={key}
                onClick={() => {
                  if (isSelected) {
                    setProfile(prev => ({ ...prev, industry: '' }));
                    setIndustryManuallySet(false);
                  } else {
                    setProfile(prev => ({ ...prev, industry: label }));
                    setIndustryManuallySet(true);
                  }
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: fonts.sans,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: isSelected ? colors.primary : 'rgba(139, 111, 92, 0.08)',
                  color: isSelected ? '#fff' : colors.textLight,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {label}
                {isSelected && <span style={{ fontSize: 15, lineHeight: 1, marginLeft: 2 }}>×</span>}
              </button>
            );
          })}

          {/* Show more / Show less toggle */}
          {suggestedIndustries.length > 0 && (
            <button
              onClick={() => setShowAllIndustries(prev => !prev)}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 500,
                fontFamily: fonts.sans,
                border: `1px dashed ${colors.borderMedium}`,
                cursor: 'pointer',
                background: 'none',
                color: colors.textSoft,
                transition: 'all 0.2s',
              }}
            >
              {showAllIndustries ? 'Show less' : 'Show more industries'}
            </button>
          )}
        </div>

        <div style={{ position: 'relative' }}>
          <Building2 style={inputIconStyle} />
          <input
            type="text"
            value={profile.industry}
            onChange={(e) => {
              setProfile(prev => ({ ...prev, industry: e.target.value }));
              setIndustrySearch(e.target.value);
              setIndustryManuallySet(true);
            }}
            placeholder="Or type your industry"
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

  const renderBioStep = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{
        fontSize: 14,
        color: colors.textMuted,
        fontFamily: fonts.sans,
        fontStyle: 'italic',
        margin: 0,
        lineHeight: 1.5,
      }}>
        e.g. "PM by day, plant mom by night. Let's talk career pivots over coffee."
      </p>

      <div>
        <label style={labelStyle}>Bio</label>
        <textarea
          value={profile.hook}
          onChange={(e) => {
            if (e.target.value.length <= 160) {
              setProfile(prev => ({ ...prev, hook: e.target.value }));
            }
          }}
          placeholder="Tell people what you're about..."
          maxLength={160}
          style={{
            width: '100%',
            padding: 16,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            fontSize: isMobile ? 14 : 15,
            fontFamily: fonts.sans,
            color: colors.text,
            background: '#fff',
            outline: 'none',
            height: 100,
            resize: 'none',
            transition: 'border-color 0.2s',
            boxSizing: 'border-box',
          }}
        />
        <p style={{ textAlign: 'right', fontSize: 12, color: colors.textMuted, fontFamily: fonts.sans, marginTop: 4 }}>
          {profile.hook?.length || 0}/160
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

      {/* Open to Coffee Chat */}
      <div style={{ marginTop: 24 }}>
        <p style={{ fontWeight: 600, color: colors.text, fontSize: isMobile ? 16 : 18, fontFamily: fonts.sans, textAlign: 'center', marginBottom: 12 }}>
          Open to 1:1 coffee chats?
        </p>
        <button
          onClick={() => setProfile(prev => ({ ...prev, open_to_coffee_chat: !prev.open_to_coffee_chat }))}
          style={{
            width: '100%',
            padding: 16,
            borderRadius: 12,
            border: `2px solid ${profile.open_to_coffee_chat ? colors.success : colors.border}`,
            background: profile.open_to_coffee_chat ? 'rgba(76, 175, 80, 0.06)' : '#fff',
            cursor: 'pointer',
            textAlign: 'center',
            transition: 'all 0.2s',
          }}
        >
          <p style={{ fontWeight: 600, color: colors.text, fontSize: 15, fontFamily: fonts.sans, margin: 0 }}>
            {profile.open_to_coffee_chat ? 'Yes, I\'m open to coffee chats' : 'Not right now'}
          </p>
          <p style={{ fontSize: 13, color: colors.textLight, fontFamily: fonts.sans, marginTop: 4 }}>
            {profile.open_to_coffee_chat ? 'Others will see a badge on your profile' : 'Tap to toggle'}
          </p>
        </button>
      </div>
    </div>
  );

  const renderIdentityStep = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <label style={labelStyle}>Display Name *</label>
        <div style={{ position: 'relative' }}>
          <User style={inputIconStyle} />
          <input
            type="text"
            value={profile.name}
            onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))}
            placeholder="How should others call you?"
            style={inputStyle}
          />
        </div>
        <p style={{ fontSize: 12, color: colors.textMuted, fontFamily: fonts.sans, marginTop: 4 }}>
          This name will appear on your profile and in meetups
        </p>
      </div>

      <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <label style={{ ...labelStyle, marginBottom: 0 }}>
            Location <span style={{ color: colors.textSoft }}>(optional)</span>
          </label>
          <button
            type="button"
            onClick={detectLocation}
            disabled={detectingLocation}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 500,
              fontFamily: fonts.sans,
              border: `1px solid ${colors.borderMedium}`,
              cursor: detectingLocation ? 'default' : 'pointer',
              background: locationDetected ? 'rgba(76, 175, 80, 0.08)' : 'none',
              color: locationDetected ? colors.success : colors.textSoft,
              transition: 'all 0.2s',
              opacity: detectingLocation ? 0.6 : 1,
            }}
          >
            {detectingLocation ? (
              <Loader style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
            ) : (
              <Navigation style={{ width: 14, height: 14 }} />
            )}
            {detectingLocation ? 'Detecting...' : locationDetected ? 'Detected' : 'Auto-detect'}
          </button>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
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
                onChange={(e) => { setProfile(prev => ({ ...prev, city: e.target.value })); setLocationDetected(false); }}
                placeholder="City"
                style={inputStyle}
              />
            </div>
            <input
              type="text"
              value={profile.state}
              onChange={(e) => { setProfile(prev => ({ ...prev, state: e.target.value })); setLocationDetected(false); }}
              placeholder="State / Province"
              style={inputStyleNoIcon}
            />
          </div>
          <input
            type="text"
            value={profile.country}
            onChange={(e) => { setProfile(prev => ({ ...prev, country: e.target.value })); setLocationDetected(false); }}
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

          <button
            type="button"
            onClick={openCamera}
            style={{
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
              border: 'none',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            <Camera style={{ width: 20, height: 20 }} />
            Take Photo
          </button>
        </div>

        {/* Camera viewfinder */}
        {showCamera && (
          <div style={{
            marginTop: 16,
            borderRadius: 16,
            overflow: 'hidden',
            border: `2px solid ${colors.border}`,
            position: 'relative',
          }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                aspectRatio: '1',
                objectFit: 'cover',
                transform: 'scaleX(-1)',
                display: 'block',
              }}
            />
            <div style={{
              display: 'flex',
              gap: 12,
              justifyContent: 'center',
              padding: 12,
              background: 'rgba(0,0,0,0.5)',
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
            }}>
              <button
                type="button"
                onClick={capturePhoto}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: '#fff',
                  border: '4px solid rgba(255,255,255,0.6)',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                }}
              />
              <button
                type="button"
                onClick={closeCamera}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  color: '#fff',
                  fontSize: 14,
                  fontFamily: fonts.sans,
                  padding: '6px 14px',
                  borderRadius: 20,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

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

        {/* Bio */}
        {profile.hook && (
          <div style={{
            marginTop: 16,
            background: colors.selectedBg,
            borderRadius: 10,
            padding: 12,
          }}>
            <p style={{ fontSize: 14, color: colors.textLight, fontFamily: fonts.sans, margin: 0 }}>
              {profile.hook}
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
      case 'community': return renderCommunityStep();
      case 'vibe': return renderVibeStep();
      case 'role': return renderRoleStep();
      case 'stage': return renderStageStep();
      case 'bio': return renderBioStep();
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

export default function ProfileSetupFlow(props) {
  return (
    <ProfileSetupErrorBoundary>
      <ProfileSetupFlowInner {...props} />
    </ProfileSetupErrorBoundary>
  );
}
