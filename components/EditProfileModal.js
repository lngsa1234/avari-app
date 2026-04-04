'use client';

import React, { useState, useCallback } from 'react';
import { X, Compass } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function EditProfileModal({ currentUser, onClose, onSaved, toast }) {
  const [editedProfile, setEditedProfile] = useState({ ...currentUser });
  const [profileErrors, setProfileErrors] = useState({});
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [saving, setSaving] = useState(false);

  const handlePhotoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      (toast?.error || alert)('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      (toast?.error || alert)('Image must be less than 5MB');
      return;
    }

    setUploadingPhoto(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUser.id}-${Date.now()}.${fileExt}`;
      const filePath = `profile-photos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setEditedProfile(prev => ({ ...prev, profile_picture: publicUrl }));
    } catch (err) {
      (toast?.error || alert)('Failed to upload photo: ' + err.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const detectLocation = useCallback(async () => {
    setDetectingLocation(true);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setEditedProfile(prev => ({ ...prev, timezone }));

      if (navigator.geolocation) {
        const pos = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
        );
        const { latitude, longitude } = pos.coords;
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=en`
        );
        const data = await res.json();
        const addr = data.address || {};
        const city = addr.city || addr.town || addr.village || addr.suburb || '';
        const state = addr.state ? (addr['ISO3166-2-lvl4']?.split('-')[1] || addr.state).slice(0, 2).toUpperCase() : '';
        const country = addr.country || '';
        setEditedProfile(prev => ({
          ...prev,
          city: city || prev.city,
          state: state || prev.state,
          country: country || prev.country,
          timezone,
        }));
      }
    } catch (e) {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setEditedProfile(prev => ({ ...prev, timezone }));
    } finally {
      setDetectingLocation(false);
    }
  }, []);

  const handleSave = async () => {
    const errors = {};
    if (!editedProfile.name?.trim()) errors.name = true;
    if (!editedProfile.career?.trim()) errors.career = true;
    if (!editedProfile.city?.trim()) errors.city = true;
    if (!editedProfile.state?.trim()) errors.state = true;
    setProfileErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: editedProfile.name,
          career: editedProfile.career,
          industry: editedProfile.industry || null,
          vibe_category: editedProfile.vibe_category || null,
          career_stage: editedProfile.career_stage || null,
          hook: editedProfile.hook || null,
          bio: editedProfile.hook || null,
          open_to_hosting: editedProfile.open_to_hosting || false,
          open_to_coffee_chat: editedProfile.open_to_coffee_chat || false,
          coffee_chat_slots: editedProfile.coffee_chat_slots || null,
          age: editedProfile.age ? parseInt(editedProfile.age) : null,
          city: editedProfile.city,
          state: editedProfile.state.toUpperCase(),
          country: editedProfile.country || null,
          timezone: editedProfile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
          profile_picture: editedProfile.profile_picture || null,
        })
        .eq('id', currentUser.id);

      if (error) {
        (toast?.error || alert)('Error updating profile: ' + error.message);
      } else {
        onSaved(editedProfile);
        onClose();
      }
    } catch (err) {
      (toast?.error || alert)('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto border border-[#E6D5C3]" style={{ boxShadow: '0 4px 16px rgba(107, 79, 63, 0.15)' }}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-800">Edit Profile</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Profile Photo */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative">
            {editedProfile.profile_picture ? (
              <img
                src={editedProfile.profile_picture}
                alt="Profile"
                className="w-24 h-24 rounded-full object-cover border-4 border-[#E6D5C3]"
              />
            ) : (
              <div className="w-24 h-24 bg-[#F4EEE6] rounded-full flex items-center justify-center text-3xl text-[#6B4F3F] font-bold border-4 border-[#E6D5C3]">
                {(editedProfile.name || editedProfile.email?.split('@')[0] || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <label className="absolute bottom-0 right-0 bg-[#6B4F3F] hover:bg-[#5A4235] text-white p-2 rounded-full cursor-pointer shadow-lg transition-colors">
              {uploadingPhoto ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
              <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploadingPhoto} className="hidden" />
            </label>
          </div>
          <p className="text-sm text-gray-500 mt-2">Tap to change photo</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={editedProfile.name || ''}
              onChange={(e) => { setEditedProfile(prev => ({ ...prev, name: e.target.value })); setProfileErrors(prev => ({ ...prev, name: false })); }}
              className={`w-full border rounded p-2 focus:outline-none ${profileErrors.name ? 'border-red-400 bg-red-50 focus:border-red-500' : 'border-gray-300 focus:border-[#6B4F3F]'}`}
            />
            {profileErrors.name && <p className="text-xs text-red-500 mt-1">Name is required</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Role <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={editedProfile.career || ''}
              onChange={(e) => { setEditedProfile(prev => ({ ...prev, career: e.target.value })); setProfileErrors(prev => ({ ...prev, career: false })); }}
              className={`w-full border rounded p-2 focus:outline-none ${profileErrors.career ? 'border-red-400 bg-red-50 focus:border-red-500' : 'border-gray-300 focus:border-[#6B4F3F]'}`}
              placeholder="e.g. Product Manager"
            />
            {profileErrors.career && <p className="text-xs text-red-500 mt-1">Role is required</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Industry</label>
            <select
              value={editedProfile.industry || ''}
              onChange={(e) => setEditedProfile(prev => ({ ...prev, industry: e.target.value }))}
              className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:border-[#6B4F3F]"
            >
              <option value="">Select industry</option>
              <option value="Fintech">Fintech</option>
              <option value="AI / Machine Learning">AI / Machine Learning</option>
              <option value="HealthTech">HealthTech</option>
              <option value="SaaS">SaaS</option>
              <option value="E-commerce">E-commerce</option>
              <option value="EdTech">EdTech</option>
              <option value="Media & Entertainment">Media & Entertainment</option>
              <option value="Consulting">Consulting</option>
              <option value="Finance & Banking">Finance & Banking</option>
              <option value="Healthcare">Healthcare</option>
              <option value="Retail">Retail</option>
              <option value="Manufacturing">Manufacturing</option>
              <option value="Non-profit">Non-profit</option>
              <option value="Government">Government</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Career Stage</label>
            <select
              value={editedProfile.career_stage || ''}
              onChange={(e) => setEditedProfile(prev => ({ ...prev, career_stage: e.target.value }))}
              className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:border-[#6B4F3F]"
            >
              <option value="">Select stage</option>
              <option value="emerging">Emerging (Early Career)</option>
              <option value="scaling">Scaling (Mid-Career)</option>
              <option value="leading">Leading (Manager/Director)</option>
              <option value="legacy">Legacy (Executive/Founder)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">What's your vibe?</label>
            <select
              value={editedProfile.vibe_category || ''}
              onChange={(e) => setEditedProfile(prev => ({ ...prev, vibe_category: e.target.value }))}
              className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:border-[#6B4F3F]"
            >
              <option value="">Select vibe</option>
              <option value="advice">I need advice</option>
              <option value="vent">I want to vent</option>
              <option value="grow">I want to grow</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
            <p className="text-xs text-gray-400 mb-2">Describe yourself. What makes you special? Don't think too hard, just have fun with it.</p>
            <input
              type="text"
              value={editedProfile.hook || ''}
              onChange={(e) => setEditedProfile(prev => ({ ...prev, hook: e.target.value }))}
              className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:border-[#6B4F3F]"
              placeholder="e.g. PM by day, plant mom by night. Let's talk career pivots over coffee."
              maxLength={160}
            />
            <p className="text-xs text-gray-400 mt-1">{(editedProfile.hook || '').length}/160</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
            <p className="text-xs text-gray-400 mb-2">Helps us connect you with people at a similar life stage. Only used for matching, never shown publicly.</p>
            <input
              type="number"
              value={editedProfile.age || ''}
              onChange={(e) => setEditedProfile(prev => ({ ...prev, age: e.target.value }))}
              className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:border-[#6B4F3F]"
              placeholder="e.g. 32"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Location <span className="text-red-500">*</span></label>
              <button
                type="button"
                onClick={detectLocation}
                disabled={detectingLocation}
                className="flex items-center text-xs text-[#6B4F3F] hover:text-[#5A4235] font-medium disabled:opacity-50"
              >
                {detectingLocation ? (
                  <><div className="w-3 h-3 border-2 border-[#6B4F3F] border-t-transparent rounded-full animate-spin mr-1" /> Detecting...</>
                ) : (
                  <><Compass className="w-3 h-3 mr-1" /> Auto-detect</>
                )}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <input
                  type="text"
                  value={editedProfile.city || ''}
                  onChange={(e) => { setEditedProfile(prev => ({ ...prev, city: e.target.value })); setProfileErrors(prev => ({ ...prev, city: false })); }}
                  placeholder="City"
                  className={`w-full border rounded p-2 focus:outline-none ${profileErrors.city ? 'border-red-400 bg-red-50 focus:border-red-500' : 'border-gray-300 focus:border-[#6B4F3F]'}`}
                />
                {profileErrors.city && <p className="text-xs text-red-500 mt-1">City is required</p>}
              </div>
              <div>
                <input
                  type="text"
                  value={editedProfile.state || ''}
                  onChange={(e) => { setEditedProfile(prev => ({ ...prev, state: e.target.value.toUpperCase() })); setProfileErrors(prev => ({ ...prev, state: false })); }}
                  maxLength="2"
                  placeholder="State"
                  className={`w-full border rounded p-2 focus:outline-none uppercase ${profileErrors.state ? 'border-red-400 bg-red-50 focus:border-red-500' : 'border-gray-300 focus:border-[#6B4F3F]'}`}
                />
                {profileErrors.state && <p className="text-xs text-red-500 mt-1">State is required</p>}
              </div>
            </div>
            {(editedProfile.country || editedProfile.timezone) && (
              <p className="text-xs text-gray-400 mt-1">
                {[editedProfile.country, editedProfile.timezone].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-[#6B4F3F] hover:bg-[#5A4235] text-white font-medium py-2 rounded transition-colors disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
