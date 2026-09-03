import './style.css';
import { initDB, saveDraft, getUnsyncedDrafts, markAsSynced } from './db.ts';
import type { Inspection } from './db.ts';
import { Camera, CameraResultType } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';

// Initialize UI
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header class="app-header">
    <h1>VKU Field Survey</h1>
    <div id="network-status" class="status online">Online</div>
  </header>
  
  <main class="app-content">
    <div class="card form-container">
      <h2>New Inspection</h2>
      <form id="survey-form">
        <div class="form-group">
          <label for="facility">Facility Name</label>
          <input type="text" id="facility" required placeholder="E.g., Library A" />
        </div>
        
        <div class="form-group">
          <label for="condition">Condition</label>
          <select id="condition" required>
            <option value="good">Good</option>
            <option value="fair">Fair</option>
            <option value="poor">Poor</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="notes">Notes</label>
          <textarea id="notes" rows="3" placeholder="Any additional details..."></textarea>
        </div>
        
        <div class="form-actions">
          <button type="button" id="btn-photo" class="btn secondary">📷 Take Photo</button>
          <button type="button" id="btn-location" class="btn secondary">📍 Get Location</button>
        </div>
        
        <div class="form-preview">
          <img id="photo-preview" style="display: none;" />
          <p id="location-preview" style="display: none;"></p>
        </div>

        <button type="submit" id="btn-submit" class="btn primary">Save Inspection</button>
      </form>
    </div>
  </main>
  
  <div id="toast" class="toast"></div>
`;

// Initialize DB
initDB();

// Global State
let currentPhotoUrl: string | undefined;
let currentLatitude: number | undefined;
let currentLongitude: number | undefined;

// UI Helpers
const showToast = (message: string) => {
  const toast = document.getElementById('toast');
  if (toast) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }
};

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(() => console.log('SW registered'))
      .catch(error => console.error('SW error', error));
  });
}

// Background Sync Queue
const processSyncQueue = async () => {
  if (!navigator.onLine) return;
  
  try {
    const drafts = await getUnsyncedDrafts();
    if (drafts.length === 0) return;
    
    showToast(`Syncing ${drafts.length} drafts...`);
    
    for (const draft of drafts) {
      // Real API call to json-server
      const { id, ...dataToSend } = draft; // Don't send local ID to server
      const response = await fetch('http://localhost:3000/inspections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend)
      });
      
      if (response.ok) {
        await markAsSynced(draft.id!);
      } else {
        throw new Error('Failed to sync item');
      }
    }
    
    showToast('All drafts synced successfully!');
  } catch (error) {
    console.error('Sync failed', error);
  }
};

// Network Status Handling
const updateNetworkStatus = () => {
  const statusEl = document.getElementById('network-status');
  if (statusEl) {
    if (navigator.onLine) {
      statusEl.textContent = 'Online';
      statusEl.className = 'status online';
      processSyncQueue();
    } else {
      statusEl.textContent = 'Offline (Drafts)';
      statusEl.className = 'status offline';
    }
  }
};

window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);
updateNetworkStatus();

// Capacitor Integrations
document.getElementById('btn-photo')?.addEventListener('click', async () => {
  try {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.DataUrl
    });
    
    if (image.dataUrl) {
      currentPhotoUrl = image.dataUrl;
      const preview = document.getElementById('photo-preview') as HTMLImageElement;
      preview.src = currentPhotoUrl;
      preview.style.display = 'block';
    }
  } catch (error) {
    console.error('Camera error', error);
    showToast('Failed to access camera');
  }
});

document.getElementById('btn-location')?.addEventListener('click', async () => {
  try {
    const status = document.getElementById('location-preview');
    if (status) {
      status.style.display = 'block';
      status.textContent = 'Fetching location...';
    }
    
    const position = await Geolocation.getCurrentPosition();
    currentLatitude = position.coords.latitude;
    currentLongitude = position.coords.longitude;
    
    if (status) {
      status.textContent = `📍 Lat: ${currentLatitude.toFixed(4)}, Lng: ${currentLongitude.toFixed(4)}`;
    }
  } catch (error) {
    console.error('Geolocation error', error);
    showToast('Failed to access location');
  }
});

// Form Submission
document.getElementById('survey-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const facility = (document.getElementById('facility') as HTMLInputElement).value;
  const condition = (document.getElementById('condition') as HTMLSelectElement).value;
  const notes = (document.getElementById('notes') as HTMLTextAreaElement).value;
  
  const inspection: Inspection = {
    facilityName: facility,
    condition,
    notes,
    photoUrl: currentPhotoUrl,
    latitude: currentLatitude,
    longitude: currentLongitude,
    synced: false,
    timestamp: Date.now()
  };
  
  try {
    await saveDraft(inspection);
    (e.target as HTMLFormElement).reset();
    
    // Reset state
    currentPhotoUrl = undefined;
    currentLatitude = undefined;
    currentLongitude = undefined;
    const preview = document.getElementById('photo-preview') as HTMLImageElement;
    preview.style.display = 'none';
    const locPreview = document.getElementById('location-preview');
    if (locPreview) locPreview.style.display = 'none';
    
    if (navigator.onLine) {
      showToast('Saved temporarily. Syncing...');
      processSyncQueue();
    } else {
      showToast('Saved as draft. Will sync when online.');
    }
  } catch (error) {
    console.error('Save error', error);
    showToast('Error saving inspection');
  }
});


