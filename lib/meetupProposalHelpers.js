// lib/meetupProposalHelpers.js
// Helper functions for user-proposed meetups
// Allows users to propose meetups for admin approval

/**
 * Submit a meetup proposal
 * @param {Object} supabase - Supabase client
 * @param {Object} params
 * @param {string} params.title - Meetup title/topic
 * @param {string} params.date - Proposed date (YYYY-MM-DD)
 * @param {string} params.time - Proposed time (HH:MM)
 * @param {string} params.description - Optional description
 * @returns {Promise<Object>}
 */
export async function submitMeetupProposal(supabase, { title, date, time, description }) {
  try {
    console.log('📝 Submitting meetup proposal:', title);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('meetup_proposals')
      .insert({
        user_id: user.id,
        title: title.trim(),
        date: date,
        time: time,
        description: description?.trim() || null,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Meetup proposal submitted:', data.id);
    return data;
  } catch (error) {
    console.error('❌ Error submitting proposal:', error);
    throw error;
  }
}

/**
 * Get user's own proposals
 * @param {Object} supabase - Supabase client
 * @returns {Promise<Array>}
 */
export async function getMyProposals(supabase) {
  try {
    console.log('📋 Loading my proposals...');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('meetup_proposals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    console.log(`✅ Loaded ${data.length} proposals`);
    return data || [];
  } catch (error) {
    console.error('❌ Error loading proposals:', error);
    return [];
  }
}

/**
 * Get all proposals (admin only)
 * @param {Object} supabase - Supabase client
 * @returns {Promise<Array>}
 */
export async function getAllProposals(supabase) {
  try {
    console.log('📋 Loading all proposals (admin)...');

    const { data: proposals, error} = await supabase
      .from('meetup_proposals')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching proposals:', error);
      throw error;
    }

    // Manually fetch proposer profiles
    for (const proposal of proposals) {
      const { data: proposer } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('id', proposal.user_id)
        .single();

      proposal.proposer = proposer;
    }

    console.log(`✅ Loaded ${proposals.length} proposals`);
    return proposals || [];
  } catch (error) {
    console.error('❌ Error loading all proposals:', error);
    return [];
  }
}

/**
 * Get pending proposals (admin only)
 * @param {Object} supabase - Supabase client
 * @returns {Promise<Array>}
 */
export async function getPendingProposals(supabase) {
  try {
    console.log('📋 Loading pending proposals (admin)...');

    const { data: proposals, error } = await supabase
      .from('meetup_proposals')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true }); // Oldest first

    if (error) {
      console.error('❌ Error fetching pending proposals:', error);
      throw error;
    }

    // Manually fetch proposer profiles
    for (const proposal of proposals) {
      const { data: proposer } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('id', proposal.user_id)
        .single();

      proposal.proposer = proposer;
    }

    console.log(`✅ Found ${proposals.length} pending proposals`);
    return proposals || [];
  } catch (error) {
    console.error('❌ Error loading pending proposals:', error);
    return [];
  }
}

/**
 * Approve a proposal and create meetup (admin only)
 * @param {Object} supabase - Supabase client
 * @param {string} proposalId - The proposal ID
 * @param {string} location - Optional location for the meetup
 * @returns {Promise<Object>}
 */
export async function approveProposal(supabase, proposalId, location = null) {
  try {
    console.log('✅ Approving proposal:', proposalId);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get proposal details
    const { data: proposal, error: fetchError } = await supabase
      .from('meetup_proposals')
      .select('*')
      .eq('id', proposalId)
      .single();

    if (fetchError) throw fetchError;

    console.log('📄 Proposal details:', proposal.title);

    // Create meetup from proposal
    // Note: meetups table only has date, time, location, created_by, proposal_id
    // The title and description are stored in the proposal and linked via proposal_id
    const { data: meetup, error: meetupError } = await supabase
      .from('meetups')
      .insert({
        date: proposal.date,
        time: proposal.time,
        location: location,
        created_by: user.id,
        proposal_id: proposalId
      })
      .select()
      .single();

    if (meetupError) {
      console.error('❌ Error creating meetup:', meetupError);
      throw meetupError;
    }

    console.log('✅ Meetup created:', meetup.id);

    // Update proposal status
    const { error: updateError } = await supabase
      .from('meetup_proposals')
      .update({
        status: 'approved',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        approved_meetup_id: meetup.id
      })
      .eq('id', proposalId);

    if (updateError) throw updateError;

    console.log('✅ Proposal approved successfully');

    return meetup;
  } catch (error) {
    console.error('❌ Error approving proposal:', error);
    throw error;
  }
}

/**
 * Reject a proposal (admin only)
 * @param {Object} supabase - Supabase client
 * @param {string} proposalId - The proposal ID
 * @param {string} reason - Optional rejection reason
 * @returns {Promise<void>}
 */
export async function rejectProposal(supabase, proposalId, reason = null) {
  try {
    console.log('❌ Rejecting proposal:', proposalId);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('meetup_proposals')
      .update({
        status: 'rejected',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: reason
      })
      .eq('id', proposalId);

    if (error) throw error;

    console.log('✅ Proposal rejected');
  } catch (error) {
    console.error('❌ Error rejecting proposal:', error);
    throw error;
  }
}

/**
 * Update own proposal (user can only edit pending)
 * @param {Object} supabase - Supabase client
 * @param {string} proposalId - The proposal ID
 * @param {Object} updates - Fields to update (title, date, time, description)
 * @returns {Promise<void>}
 */
export async function updateMyProposal(supabase, proposalId, updates) {
  try {
    console.log('✏️ Updating proposal:', proposalId);

    const { error } = await supabase
      .from('meetup_proposals')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', proposalId)
      .eq('status', 'pending');

    if (error) throw error;

    console.log('✅ Proposal updated');
  } catch (error) {
    console.error('❌ Error updating proposal:', error);
    throw error;
  }
}

/**
 * Delete own proposal (only pending can be deleted)
 * @param {Object} supabase - Supabase client
 * @param {string} proposalId - The proposal ID
 * @returns {Promise<void>}
 */
export async function deleteMyProposal(supabase, proposalId) {
  try {
    console.log('🗑️ Deleting proposal:', proposalId);

    const { error } = await supabase
      .from('meetup_proposals')
      .delete()
      .eq('id', proposalId);

    if (error) throw error;

    console.log('✅ Proposal deleted');
  } catch (error) {
    console.error('❌ Error deleting proposal:', error);
    throw error;
  }
}

/**
 * Get proposal by ID
 * @param {Object} supabase - Supabase client
 * @param {string} proposalId - The proposal ID
 * @returns {Promise<Object|null>}
 */
export async function getProposalById(supabase, proposalId) {
  try {
    const { data, error } = await supabase
      .from('meetup_proposals')
      .select(`
        *,
        proposer:profiles!meetup_proposals_user_id_fkey(id, name, email),
        reviewer:profiles!meetup_proposals_reviewed_by_fkey(id, name)
      `)
      .eq('id', proposalId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error getting proposal:', error);
    return null;
  }
}
