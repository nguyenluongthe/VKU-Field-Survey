# VKU Field Survey

Một ứng dụng Tiến bộ (Progressive Web App - PWA) được thiết kế chuyên biệt cho mục đích khảo sát cơ sở vật chất nội bộ. Ứng dụng hoạt động theo cơ chế **Offline-First**, cho phép thu thập dữ liệu ngay cả khi mất mạng internet.

## 🚀 Tính năng nổi bật
- **Hoạt động 100% Offline**: Sử dụng Service Worker (chiến lược Cache-First) giúp ứng dụng vẫn khởi chạy bình thường dù không có kết nối Wi-Fi/4G.
- **Lưu trữ cục bộ (Sổ nháp)**: Dữ liệu khảo sát được cất an toàn vào cơ sở dữ liệu IndexedDB của trình duyệt khi mất mạng.
- **Đồng bộ ngầm (Background Sync)**: Ứng dụng tự động phát hiện khi thiết bị có mạng trở lại và đẩy toàn bộ dữ liệu từ sổ nháp lên Server mà không cần người dùng thao tác.
- **Phần cứng thiết bị**: Tích hợp các plugin của Capacitor để sử dụng Camera (chụp ảnh hiện trường) và GPS (lấy tọa độ thiết bị).
- **Giao diện hiện đại**: Thiết kế Glassmorphism UI cao cấp, mượt mà và thân thiện với thiết bị di động.

## 🛠️ Công nghệ sử dụng
- **Frontend**: HTML5, CSS3, Vanilla TypeScript, Vite
- **Web APIs**: Service Worker, IndexedDB (thông qua thư viện `idb`)
- **Native Wrapper**: Capacitor (iOS / Android)
- **Backend (Mock)**: `json-server`

## 📦 Hướng dẫn cài đặt và chạy thử

### 1. Yêu cầu hệ thống
- Node.js (phiên bản 18 trở lên)
- NPM (hoặc Yarn)

### 2. Cài đặt
Clone mã nguồn về máy:
```bash
git clone https://github.com/nguyenluongthe/VKU-Field-Survey.git
cd VKU-Field-Survey
npm install
```

### 3. Chạy ứng dụng
Dự án được chia làm 2 phần. Bạn cần chạy cả 2 Terminal:

**Terminal 1: Chạy Frontend (Giao diện web)**
```bash
npm run dev
```
👉 Mở trình duyệt tại địa chỉ: `http://localhost:5173`

**Terminal 2: Chạy Backend (Máy chủ lưu trữ)**
```bash
npm run server
```
👉 API sẽ chạy tại cổng 3000, mọi dữ liệu được lưu vào file `db.json`.

## 🧪 Hướng dẫn test tính năng Offline
1. Mở trang web `http://localhost:5173`.
2. Bật công cụ lập trình viên (F12) > Chuyển sang tab **Network** > Tick chọn chế độ **Offline**.
3. Điền thông tin vào form (Tên thiết bị, chụp ảnh, v.v.) và nhấn **Save Inspection**. Bạn sẽ nhận được thông báo lưu nháp (Draft).
4. Bỏ tick chế độ **Offline** để khôi phục mạng. Hệ thống sẽ tự động đồng bộ.
5. Mở file `db.json` trong thư mục dự án để kiểm chứng dữ liệu đã được đẩy lên!

## 📱 Quy trình chuyển đổi sang Native Android & Đóng gói Signed APK

### Bước 1: Build & Đồng bộ mã nguồn với Capacitor
Chạy chuỗi lệnh chuẩn bị:
```bash
npm run build && npx cap sync && npx cap open android
```

### Bước 2: Tạo file Signed APK trong Android Studio
1. Trong cửa sổ **Android Studio**, đợi Gradle hoàn tất đồng bộ dự án.
2. Trên thanh menu chính, chọn **Build** > **Generate Signed Bundle / APK...**.
3. Chọn tùy chọn **APK** và nhấn **Next**.
4. Thiết lập **Key store path**:
   - Nếu đã có Keystore: Nhấn **Choose existing...** và trỏ đến file `.jks` / `.keystore`.
   - Nếu chưa có: Nhấn **Create new...**, chọn nơi lưu (ví dụ `my-release-key.jks`), nhập mật khẩu, Alias (`fieldsurvey`), và điền thông tin tối thiểu (Tên, Tổ chức).
5. Nhập mật khẩu Key store và Key password, nhấn **Next**.
6. Chọn Build Variants là **release** (hoặc debug nếu dùng để test nội bộ), tích chọn chữ ký V1 (Jar Signature) và V2 (Full APK Signature) nếu có.
7. Nhấn **Finish**. File APK đã ký sẽ được xuất ra thư mục `android/app/release/app-release.apk`.

---

## 🧪 Hướng dẫn kiểm thử trên thiết bị Android thật (Step 6)

### 1. Chuẩn bị môi trường
- Đảm bảo điện thoại Android và máy tính cùng kết nối vào **chung một mạng Wi-Fi**.
- Tìm địa chỉ IP nội bộ của máy tính:
  - Trên Windows: Mở Command Prompt gõ `ipconfig` (tìm dòng `IPv4 Address`, ví dụ: `192.168.1.50`).
- Khởi động mock server trên máy tính:
  ```bash
  npm run server
  ```
- Cài đặt file APK lên điện thoại hoặc chạy trực tiếp qua cáp USB Debugging từ Android Studio.

### 2. Kịch bản kiểm thử (Test Matrix)
1. **Cấu hình địa chỉ Server**:
   - Mở app trên điện thoại, tại ô **Server**, nhập: `http://<IP_MÁY_TÍNH>:3000` (ví dụ `http://192.168.1.50:3000`) và bấm **Save IP**.
2. **Kiểm thử Camera phần cứng**:
   - Nhấn **📷 Take Photo (Camera)**. App sẽ yêu cầu cấp quyền máy ảnh và khởi chạy trực tiếp ứng dụng Camera native của điện thoại. Chụp và xác nhận để hiển thị ảnh preview.
3. **Kiểm thử GPS Định vị**:
   - Nhấn **📍 Get Location (GPS)**. App yêu cầu cấp quyền vị trí, đọc tọa độ vệ tinh GPS chính xác và hiển thị `Lat: ... Lng: ...`.
4. **Kiểm thử Lưu nháp Ngoại tuyến (Offline Capture)**:
   - Tắt Wi-Fi và 4G trên điện thoại.
   - Nhập tên địa điểm, ghi chú và nhấn **Save Inspection**.
   - Thông báo hiện: *"Đã lưu vào bộ nhớ tạm (Draft). Sẽ đồng bộ khi có mạng."* Dữ liệu được lưu trữ an toàn trong IndexedDB.
5. **Kiểm thử Đồng bộ tự động & Thông báo đẩy (Sync-on-reconnect & Notification)**:
   - Bật lại Wi-Fi/4G trên điện thoại.
   - Ứng dụng ngay lập tức phát hiện mạng trực tuyến (`Online`), tự động kích hoạt `processSyncQueue()`.
   - Thiết bị nhận được **Native Notification** kèm âm thanh / rung: *"Đồng bộ thành công! Đã đồng bộ X bản ghi lên hệ thống."*
   - Kiểm tra file `db.json` trên máy tính để thấy bản ghi vừa được đồng bộ hoàn chỉnh!

## Giấy phép
Thuộc quyền sở hữu nội bộ.

