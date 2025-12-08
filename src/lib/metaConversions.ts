import { supabase } from "@/integrations/supabase/client";

interface MetaEventParams {
  event_name: string;
  user_id?: string;
  email?: string;
  phone?: string;
  event_source_url?: string;
  event_id?: string;
  custom_data?: {
    currency?: string;
    value?: number;
    content_name?: string;
    content_category?: string;
    content_ids?: string[];
    content_type?: string;
    num_items?: number;
  };
}

// Get Facebook browser ID from cookie
function getFbp(): string | undefined {
  const match = document.cookie.match(/_fbp=([^;]+)/);
  return match ? match[1] : undefined;
}

// Get Facebook click ID from URL or cookie
function getFbc(): string | undefined {
  // Check URL first
  const urlParams = new URLSearchParams(window.location.search);
  const fbclid = urlParams.get('fbclid');
  if (fbclid) {
    return `fb.1.${Date.now()}.${fbclid}`;
  }
  // Check cookie
  const match = document.cookie.match(/_fbc=([^;]+)/);
  return match ? match[1] : undefined;
}

export async function trackMetaEvent(params: MetaEventParams): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke('meta-conversion-api', {
      body: {
        ...params,
        event_source_url: params.event_source_url || window.location.href,
        fbc: getFbc(),
        fbp: getFbp(),
      },
    });

    if (error) {
      console.error('Meta Conversion API error:', error);
    } else {
      console.log('Meta event tracked:', params.event_name);
    }
  } catch (err) {
    console.error('Failed to track Meta event:', err);
  }
}

// Pre-defined event helpers
export const MetaEvents = {
  // Track successful registration/signup
  completeRegistration: (userId: string, email?: string) => {
    trackMetaEvent({
      event_name: 'CompleteRegistration',
      user_id: userId,
      email,
      event_id: `reg_${userId}_${Date.now()}`,
    });
    // Also fire client-side pixel
    if (typeof window !== 'undefined' && (window as any).fbq) {
      (window as any).fbq('track', 'CompleteRegistration');
    }
  },

  // Track event booking/purchase
  purchase: (
    userId: string,
    eventId: string,
    amount: number,
    eventTitle: string,
    email?: string,
    phone?: string
  ) => {
    trackMetaEvent({
      event_name: 'Purchase',
      user_id: userId,
      email,
      phone,
      event_id: `purchase_${eventId}_${userId}_${Date.now()}`,
      custom_data: {
        currency: 'INR',
        value: amount,
        content_name: eventTitle,
        content_type: 'event',
        content_ids: [eventId],
        num_items: 1,
      },
    });
    // Also fire client-side pixel
    if (typeof window !== 'undefined' && (window as any).fbq) {
      (window as any).fbq('track', 'Purchase', {
        currency: 'INR',
        value: amount,
        content_name: eventTitle,
        content_type: 'event',
        content_ids: [eventId],
      });
    }
  },

  // Track event registration (free events)
  eventRegistration: (
    userId: string,
    eventId: string,
    eventTitle: string,
    role: 'performer' | 'audience',
    email?: string
  ) => {
    trackMetaEvent({
      event_name: 'Lead',
      user_id: userId,
      email,
      event_id: `event_reg_${eventId}_${userId}_${Date.now()}`,
      custom_data: {
        content_name: eventTitle,
        content_type: 'event',
        content_ids: [eventId],
        content_category: role,
      },
    });
    // Also fire client-side pixel
    if (typeof window !== 'undefined' && (window as any).fbq) {
      (window as any).fbq('track', 'Lead', {
        content_name: eventTitle,
        content_type: 'event',
        content_ids: [eventId],
      });
    }
  },

  // Track community join
  communityJoin: (userId: string, communityId: string, communityName: string) => {
    trackMetaEvent({
      event_name: 'Subscribe',
      user_id: userId,
      event_id: `community_join_${communityId}_${userId}_${Date.now()}`,
      custom_data: {
        content_name: communityName,
        content_type: 'community',
        content_ids: [communityId],
      },
    });
    // Also fire client-side pixel
    if (typeof window !== 'undefined' && (window as any).fbq) {
      (window as any).fbq('track', 'Subscribe', {
        content_name: communityName,
      });
    }
  },

  // Track page view (for SPA navigation)
  pageView: (url?: string) => {
    trackMetaEvent({
      event_name: 'PageView',
      event_source_url: url || window.location.href,
      event_id: `pageview_${Date.now()}`,
    });
  },

  // Track view content (event detail page)
  viewContent: (eventId: string, eventTitle: string, category?: string) => {
    trackMetaEvent({
      event_name: 'ViewContent',
      event_id: `view_${eventId}_${Date.now()}`,
      custom_data: {
        content_name: eventTitle,
        content_type: 'event',
        content_ids: [eventId],
        content_category: category,
      },
    });
    // Also fire client-side pixel
    if (typeof window !== 'undefined' && (window as any).fbq) {
      (window as any).fbq('track', 'ViewContent', {
        content_name: eventTitle,
        content_type: 'event',
        content_ids: [eventId],
      });
    }
  },
};
