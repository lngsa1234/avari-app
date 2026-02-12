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

// Predefined lists for autocomplete
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
    color: 'from-green-400 to-emerald-500'
  },
  {
    id: 'scaling',
    label: 'Scaling',
    subtitle: 'Mid-Career',
    description: 'Growing expertise, seeking new challenges',
    icon: TrendingUp,
    color: 'from-blue-400 to-indigo-500'
  },
  {
    id: 'leading',
    label: 'Leading',
    subtitle: 'Manager / Director',
    description: 'Managing teams, driving strategy',
    icon: Briefcase,
    color: 'from-purple-400 to-violet-500'
  },
  {
    id: 'legacy',
    label: 'Legacy',
    subtitle: 'Executive / Founder',
    description: 'Shaping industries, mentoring others',
    icon: Crown,
    color: 'from-amber-400 to-orange-500'
  }
];

const VIBE_OPTIONS = [
  {
    id: 'advice',
    label: 'I need advice',
    caption: "I'm looking for a mentor or a guide.",
    icon: Heart,
    color: 'from-rose-400 to-pink-500',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-300'
  },
  {
    id: 'vent',
    label: 'I want to vent',
    caption: 'I need a safe space with peers who get it.',
    icon: MessageCircle,
    color: 'from-amber-400 to-orange-500',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-300'
  },
  {
    id: 'grow',
    label: 'I want to grow',
    caption: "I'm here to sharpen my skills.",
    icon: Rocket,
    color: 'from-emerald-400 to-green-500',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-300'
  }
];

export default function ProfileSetupFlow({ session, supabase, onComplete }) {
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
      case 'vibe':
        return !!profile.vibe_category;
      case 'role':
        return !!profile.career && !!profile.industry;
      case 'stage':
        return !!profile.career_stage;
      case 'hook':
        return true; // Optional
      case 'hosting':
        return true; // Always valid (boolean)
      case 'identity':
        return !!profile.name?.trim();
      case 'photo':
        return true; // Optional
      case 'preview':
        return true;
      default:
        return false;
    }
  };

  const handleNext = async () => {
    if (currentStep === totalSteps - 1) {
      // Final step - save and complete
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

    // Validate file
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

  // Render step content
  const renderStepContent = () => {
    switch (currentStepData.id) {
      case 'vibe':
        return (
          <div className="space-y-4">
            {VIBE_OPTIONS.map((vibe) => {
              const Icon = vibe.icon;
              const isSelected = profile.vibe_category === vibe.id;

              return (
                <button
                  key={vibe.id}
                  onClick={() => setProfile(prev => ({ ...prev, vibe_category: vibe.id }))}
                  className={`w-full p-5 rounded-2xl border-2 transition-all text-left ${
                    isSelected
                      ? `${vibe.bgColor} ${vibe.borderColor} shadow-lg scale-[1.02]`
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${vibe.color} flex items-center justify-center`}>
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800 text-lg">{vibe.label}</p>
                      <p className="text-gray-600 text-sm mt-0.5">{vibe.caption}</p>
                    </div>
                    {isSelected && (
                      <Check className="w-6 h-6 text-green-500" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        );

      case 'role':
        return (
          <div className="space-y-6">
            {/* Role Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Role
              </label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
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
                  className="w-full pl-11 pr-4 py-3.5 border border-gray-300 rounded-xl text-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                />
                {showRoleDropdown && filteredRoles.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {filteredRoles.slice(0, 8).map((role) => (
                      <button
                        key={role}
                        onClick={() => {
                          setProfile(prev => ({ ...prev, career: role }));
                          setShowRoleDropdown(false);
                        }}
                        className="w-full px-4 py-2.5 text-left hover:bg-gray-50 text-gray-700"
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Industry
              </label>

              {/* Popular chips */}
              <div className="flex flex-wrap gap-2 mb-3">
                {INDUSTRIES.filter(i => i.popular).map((ind) => (
                  <button
                    key={ind.id}
                    onClick={() => setProfile(prev => ({ ...prev, industry: ind.label }))}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      profile.industry === ind.label
                        ? 'bg-indigo-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {ind.label}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={profile.industry}
                  onChange={(e) => {
                    setProfile(prev => ({ ...prev, industry: e.target.value }));
                    setIndustrySearch(e.target.value);
                  }}
                  placeholder="Search or select industry"
                  className="w-full pl-11 pr-4 py-3.5 border border-gray-300 rounded-xl text-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                />
              </div>
            </div>
          </div>
        );

      case 'stage':
        return (
          <div className="space-y-3">
            {CAREER_STAGES.map((stage) => {
              const Icon = stage.icon;
              const isSelected = profile.career_stage === stage.id;

              return (
                <button
                  key={stage.id}
                  onClick={() => setProfile(prev => ({ ...prev, career_stage: stage.id }))}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50 shadow-md'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stage.color} flex items-center justify-center`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-800">{stage.label}</p>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          {stage.subtitle}
                        </span>
                      </div>
                      <p className="text-gray-600 text-sm mt-0.5">{stage.description}</p>
                    </div>
                    {isSelected && (
                      <Check className="w-5 h-5 text-indigo-500" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        );

      case 'hook':
        return (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
              <div className="flex items-start gap-3">
                <Lightbulb className="w-5 h-5 text-amber-500 mt-0.5" />
                <div>
                  <p className="text-sm text-amber-800 font-medium">Examples:</p>
                  <p className="text-sm text-amber-700 mt-1">
                    "Negotiating raises" / "SEO strategies" / "Managing burnout" / "Career pivots"
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ask me about:
              </label>
              <textarea
                value={profile.hook}
                onChange={(e) => setProfile(prev => ({ ...prev, hook: e.target.value }))}
                placeholder="What expertise can you share with others?"
                maxLength={150}
                className="w-full p-4 border border-gray-300 rounded-xl text-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 h-32 resize-none"
              />
              <p className="text-right text-sm text-gray-500 mt-1">
                {profile.hook?.length || 0}/150
              </p>
            </div>
          </div>
        );

      case 'hosting':
        return (
          <div className="space-y-4">
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-indigo-500 mt-0.5" />
                <p className="text-sm text-indigo-800">
                  When community members request a meetup topic you're knowledgeable about, we'll notify you. No obligation to host!
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setProfile(prev => ({ ...prev, open_to_hosting: true }))}
                className={`p-6 rounded-2xl border-2 transition-all text-center ${
                  profile.open_to_hosting
                    ? 'border-green-500 bg-green-50 shadow-md'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center mb-3">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <p className="font-semibold text-gray-800 text-lg">Yes</p>
                <p className="text-sm text-gray-600 mt-1">I'm open to it</p>
              </button>

              <button
                onClick={() => setProfile(prev => ({ ...prev, open_to_hosting: false }))}
                className={`p-6 rounded-2xl border-2 transition-all text-center ${
                  !profile.open_to_hosting
                    ? 'border-gray-500 bg-gray-50 shadow-md'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="w-16 h-16 mx-auto rounded-full bg-gray-100 flex items-center justify-center mb-3">
                  <span className="text-2xl text-gray-500">-</span>
                </div>
                <p className="font-semibold text-gray-800 text-lg">Not now</p>
                <p className="text-sm text-gray-600 mt-1">Maybe later</p>
              </button>
            </div>
          </div>
        );

      case 'identity':
        return (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter your full name"
                  className="w-full pl-11 pr-4 py-3.5 border border-gray-300 rounded-xl text-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                This name will appear on your profile and in meetups
              </p>
            </div>

            <div className="border-t border-gray-200 pt-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location <span className="text-gray-400">(optional)</span>
              </label>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={profile.city}
                      onChange={(e) => setProfile(prev => ({ ...prev, city: e.target.value }))}
                      placeholder="City"
                      className="w-full pl-11 pr-4 py-3.5 border border-gray-300 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                    />
                  </div>
                  <input
                    type="text"
                    value={profile.state}
                    onChange={(e) => setProfile(prev => ({ ...prev, state: e.target.value }))}
                    placeholder="State / Province"
                    className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
                <input
                  type="text"
                  value={profile.country}
                  onChange={(e) => setProfile(prev => ({ ...prev, country: e.target.value }))}
                  placeholder="Country"
                  className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Helps us show you local meetups and events
              </p>
            </div>
          </div>
        );

      case 'photo':
        return (
          <div className="text-center">
            {/* Photo preview */}
            <div className="relative w-40 h-40 mx-auto mb-6">
              {profile.profile_picture ? (
                <img
                  src={profile.profile_picture}
                  alt="Profile"
                  className="w-full h-full rounded-full object-cover border-4 border-white shadow-xl"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center text-white text-4xl font-bold border-4 border-white shadow-xl">
                  {getInitials()}
                </div>
              )}
              <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center shadow-lg">
                <Camera className="w-5 h-5 text-white" />
              </div>
            </div>

            {/* Upload buttons */}
            <div className="space-y-3">
              <label className="block w-full">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <div className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-medium py-3 rounded-xl cursor-pointer flex items-center justify-center gap-2 transition-colors">
                  <Upload className="w-5 h-5" />
                  Upload Photo
                </div>
              </label>

              <label className="block w-full">
                <input
                  type="file"
                  accept="image/*"
                  capture="user"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <div className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 rounded-xl cursor-pointer flex items-center justify-center gap-2 transition-colors">
                  <Camera className="w-5 h-5" />
                  Take Photo
                </div>
              </label>
            </div>

            <p className="text-sm text-gray-500 mt-4">
              A real photo increases your connection rate by 2x
            </p>
          </div>
        );

      case 'preview':
        return (
          <div className="flex flex-col items-center">
            {/* Preview Card */}
            <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-gray-200 p-6 mb-6">
              {/* Photo */}
              <div className="flex justify-center mb-4">
                {profile.profile_picture ? (
                  <img
                    src={profile.profile_picture}
                    alt="Profile"
                    className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center text-white text-3xl font-bold border-4 border-white shadow-lg">
                    {getInitials()}
                  </div>
                )}
              </div>

              {/* Name */}
              <h3 className="text-xl font-bold text-gray-800 text-center">
                {profile.name || 'Your Name'}
              </h3>

              {/* Role & Industry */}
              <p className="text-gray-600 text-center mt-1">
                {profile.career || 'Your Role'}
                {profile.industry && ` in ${profile.industry}`}
              </p>

              {/* Location */}
              {(profile.city || profile.state || profile.country) && (
                <p className="text-gray-500 text-sm text-center mt-1">
                  {[profile.city, profile.state, profile.country].filter(Boolean).join(', ')}
                </p>
              )}

              {/* Hook */}
              {profile.hook && (
                <div className="mt-4 bg-gray-50 rounded-lg p-3">
                  <p className="text-sm text-gray-600 italic">
                    Ask me about: "{profile.hook}"
                  </p>
                </div>
              )}

              {/* Lock indicator */}
              <div className="flex items-center justify-center gap-2 mt-4 text-gray-400 text-sm">
                <Lock className="w-4 h-4" />
                Connect to chat
              </div>
            </div>

            <p className="text-gray-600 text-center">
              This is how others will see you in the community
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-indigo-50 via-white to-rose-50 z-50 flex flex-col">
      {/* Progress bar */}
      <div className="h-1.5 bg-gray-200">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-rose-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Header */}
      <div className="px-6 pt-8 pb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-500">
            Step {currentStep + 1} of {totalSteps}
          </span>
          {!currentStepData.required && (
            <button
              onClick={handleSkip}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Skip for now
            </button>
          )}
        </div>
        <h1 className="text-2xl font-bold text-gray-800">
          {currentStepData.title}
        </h1>
        <p className="text-gray-600 mt-1">
          {currentStepData.subtitle}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {renderStepContent()}
      </div>

      {/* Navigation */}
      <div className="px-6 pb-8 pt-4 bg-white border-t border-gray-100">
        <div className="flex gap-3">
          {currentStep > 0 && (
            <button
              onClick={handleBack}
              className="flex-1 flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3.5 rounded-xl font-medium transition"
            >
              <ChevronLeft className="w-5 h-5" />
              Back
            </button>
          )}

          <button
            onClick={handleNext}
            disabled={!isStepValid() || isLoading}
            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-rose-500 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-semibold transition"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : currentStep === totalSteps - 1 ? (
              "Let's Go!"
            ) : (
              <>
                Next
                <ChevronRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
