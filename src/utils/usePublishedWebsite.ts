import { useEffect, useState } from 'react';
import type { ConferenceSettings, WebsiteContentSnapshot } from '../types/admin';
import { conferenceDataService } from '../services/mockDataService';

export interface PublishedSiteState {
  published: WebsiteContentSnapshot;
  settings: ConferenceSettings;
}

export function usePublishedWebsite(): PublishedSiteState {
  const [state, setState] = useState<PublishedSiteState>(() => {
    const snap = conferenceDataService.getSnapshot();
    return { published: snap.websitePublished, settings: snap.settings };
  });

  useEffect(() => {
    const sync = () => {
      const snap = conferenceDataService.getSnapshot();
      setState({ published: snap.websitePublished, settings: snap.settings });
    };
    window.addEventListener('focus', sync);
    window.addEventListener('storage', sync);
    window.addEventListener('willowmun:navigate', sync);
    return () => {
      window.removeEventListener('focus', sync);
      window.removeEventListener('storage', sync);
      window.removeEventListener('willowmun:navigate', sync);
    };
  }, []);

  return state;
}
