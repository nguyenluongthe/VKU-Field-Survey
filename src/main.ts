import './style.css';
import { initDB, saveDraft, getUnsyncedDrafts, markAsSynced } from './db.ts';
import type { Inspection } from './db.ts';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

// Helper: Determine Server URL (allows changing LAN IP for real devices)
const getServerUrl = (): string => {
  const saved = localStorage.getItem('vku_server_url');
  if (saved) return saved;
  // Android emulator host loopback is 10.0.2.2; browsers use localhost
  return Capacitor.isNativePlatform() ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
};

const setServerUrl = (url: string) => {
  const cleaned = url.trim().replace(/\/+$/, '');
  localStorage.setItem('vku_server_url', cleaned);
};

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
          <button type="button" id="btn-photo" class="btn secondary">📷 Take Photo (Camera)</button>
          <button type="button" id="btn-location" class="btn secondary">📍 Get Location (GPS)</button>
        </div>
        
        <div class="form-preview">
          <img id="photo-preview" style="display: none;" alt="Preview" />
          <p id="location-preview" style="display: none;"></p>
        </div>

        <button type="submit" id="btn-submit" class="btn primary">Save Inspection</button>
      </form>

      <div class="server-config">
        <label for="server-url">Server:</label>
        <input type="text" id="server-url" value="${getServerUrl()}" placeholder="http://192.168.x.x:3000" />
        <button type="button" id="btn-save-server" class="btn-save">Save IP</button>
      </div>
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

// Server URL change listener
document.getElementById('btn-save-server')?.addEventListener('click', () => {
  const input = document.getElementById('server-url') as HTMLInputElement;
  if (input && input.value) {
    setServerUrl(input.value);
    showToast(`Server updated: ${getServerUrl()}`);
  }
});

// Initialize Push & Local Notifications
const initNotifications = async () => {
  try {
    if (Capacitor.isNativePlatform()) {
      // 1. Request Local Notification permissions
      const permStatus = await LocalNotifications.checkPermissions();
      if (permStatus.display !== 'granted') {
        await LocalNotifications.requestPermissions();
      }

      // Create Android Notification Channel
      await LocalNotifications.createChannel({
        id: 'sync_channel',
        name: 'Sync Notifications',
        description: 'Alerts when field inspection drafts are synced',
        importance: 5,
        visibility: 1,
        vibration: true
      });

      // 2. Request Push Notification permissions & register
      try {
        const pushPerm = await PushNotifications.checkPermissions();
        if (pushPerm.receive !== 'granted') {
          await PushNotifications.requestPermissions();
        }
        await PushNotifications.register();
      } catch (pushErr) {
        console.warn('Push registration note (Firebase config optional for local alerts):', pushErr);
      }
    } else if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      await Notification.requestPermission();
    }
  } catch (err) {
    console.warn('Notification initialization error:', err);
  }
};

initNotifications();

// Trigger Notification upon successful sync
const sendSyncSuccessAlert = async (count: number) => {
  const title = 'Đồng bộ thành công! ✅';
  const body = `Đã đồng bộ ${count} biên bản kiểm tra lên hệ thống.`;

  showToast(`Đã đồng bộ ${count} biên bản lên máy chủ!`);

  try {
    if (Capacitor.isNativePlatform()) {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.floor(Math.random() * 100000),
            title,
            body,
            channelId: 'sync_channel',
            schedule: { at: new Date(Date.now() + 100) }
          }
        ]
      });
    } else if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  } catch (err) {
    console.warn('Could not schedule native notification:', err);
  }
};

// Service Worker handling: Only in browser PWA mode, never in native app
if ('serviceWorker' in navigator) {
  if (Capacitor.isNativePlatform()) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const reg of registrations) {
        reg.unregister();
      }
    });
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(() => console.log('SW registered'))
        .catch(error => console.error('SW error', error));
    });
  }
}

// Background Sync Queue
const processSyncQueue = async () => {
  if (!navigator.onLine) return;
  
  try {
    const drafts = await getUnsyncedDrafts();
    if (drafts.length === 0) return;
    
    showToast(`Đang đồng bộ ${drafts.length} bản ghi...`);
    const serverBaseUrl = getServerUrl();
    let syncedCount = 0;
    
    for (const draft of drafts) {
      const { id, ...dataToSend } = draft;
      const response = await fetch(`${serverBaseUrl}/inspections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend)
      });
      
      if (response.ok) {
        await markAsSynced(draft.id!);
        syncedCount++;
      } else {
        throw new Error(`Server returned status ${response.status}`);
      }
    }
    
    if (syncedCount > 0) {
      await sendSyncSuccessAlert(syncedCount);
    }
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

// Step 2: Replace <input type="file" capture> -> @capacitor/camera Plugin
document.getElementById('btn-photo')?.addEventListener('click', async () => {
  try {
    // Check and request permission if native
    if (Capacitor.isNativePlatform()) {
      const perm = await Camera.checkPermissions();
      if (perm.camera !== 'granted') {
        await Camera.requestPermissions({ permissions: ['camera'] });
      }
    }

    const image = await Camera.getPhoto({
      quality: 85,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera // Directly opens native camera hardware
    });
    
    if (image.dataUrl) {
      currentPhotoUrl = image.dataUrl;
      const preview = document.getElementById('photo-preview') as HTMLImageElement;
      preview.src = currentPhotoUrl;
      preview.style.display = 'block';
    }
  } catch (error: any) {
    // Gracefully handle user cancellation
    if (error?.message?.includes('cancelled') || error?.message?.includes('User cancelled')) {
      return;
    }
    console.error('Camera error', error);
    showToast('Không thể mở camera: ' + (error?.message || ''));
  }
});

// Step 3: Replace browser Geolocation -> @capacitor/geolocation Plugin
document.getElementById('btn-location')?.addEventListener('click', async () => {
  const status = document.getElementById('location-preview');
  try {
    if (status) {
      status.style.display = 'block';
      status.textContent = 'Đang lấy tọa độ GPS từ vệ tinh...';
    }
    
    // Check and request permission
    if (Capacitor.isNativePlatform()) {
      const perm = await Geolocation.checkPermissions();
      if (perm.location !== 'granted') {
        await Geolocation.requestPermissions();
      }
    }
    
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 3000
    });
    
    currentLatitude = position.coords.latitude;
    currentLongitude = position.coords.longitude;
    
    if (status) {
      status.textContent = `📍 Lat: ${currentLatitude.toFixed(5)}, Lng: ${currentLongitude.toFixed(5)}`;
    }
    showToast('Đã lấy tọa độ GPS thành công');
  } catch (error: any) {
    console.error('Geolocation error', error);
    if (status) {
      status.textContent = '❌ Không thể lấy tọa độ vị trí';
    }
    showToast('Lỗi định vị: ' + (error?.message || ''));
  }
});

// Form Submission (Offline-first IndexedDB Drafts)
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
    
    // Reset state & previews
    currentPhotoUrl = undefined;
    currentLatitude = undefined;
    currentLongitude = undefined;
    const preview = document.getElementById('photo-preview') as HTMLImageElement;
    preview.style.display = 'none';
    const locPreview = document.getElementById('location-preview');
    if (locPreview) locPreview.style.display = 'none';
    
    if (navigator.onLine) {
      showToast('Đã lưu bản ghi. Đang đồng bộ...');
      processSyncQueue();
    } else {
      showToast('Đã lưu vào bộ nhớ tạm (Draft). Sẽ đồng bộ khi có mạng.');
    }
  } catch (error) {
    console.error('Save error', error);
    showToast('Lỗi khi lưu biên bản kiểm tra');
  }
});
