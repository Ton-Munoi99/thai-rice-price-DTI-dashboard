# Thailand Rice Price Dashboard

แดชบอร์ดนี้ถูกปรับให้เป็น `Static React app + snapshot JSON` เพื่อให้เปิดหน้าเว็บแล้วเห็นข้อมูลทันที เหมาะกับการ deploy ฟรีบน Netlify โดยไม่ต้องรัน backend ค้างไว้

## แนวคิดปัจจุบัน

- หน้าเว็บอ่านข้อมูลจากไฟล์ `frontend/src/data/rice-price.json`
- ไม่มีการยิง DIT API ตอนผู้ใช้เปิดหน้าเว็บ
- ถ้าต้องการอัปเดตข้อมูล ให้รันสคริปต์ `scripts/update_rice_snapshot.py` แล้ว deploy ใหม่

ข้อดีของแนวทางนี้

- เปิดเว็บแล้วข้อมูลขึ้นทันที
- แชร์ลิงก์ให้คนอื่นใช้ได้ง่าย
- deploy ฟรีบน Netlify ได้
- ไม่เสี่ยง timeout ตอนผู้ใช้เปิดหน้าเว็บ

## แหล่งข้อมูล

- DIT Open Data: [https://data.moc.go.th/OpenData/GISProductPrice](https://data.moc.go.th/OpenData/GISProductPrice)
- API endpoint: `https://dataapi.moc.go.th/gis-product-prices`
- Product ID ปัจจุบัน: `R11001`

## โครงสร้างที่เกี่ยวข้อง

- `frontend/src/App.jsx` : หน้า dashboard
- `frontend/src/data/rice-price.json` : snapshot ที่ถูก bundle ไปกับเว็บ
- `scripts/update_rice_snapshot.py` : สคริปต์อัปเดต snapshot
- `netlify.toml` : config สำหรับ Netlify

## รันในเครื่อง

```powershell
cd "C:\Users\sponlapatp\Desktop\Codex Project\frontend"
npm install
npm run dev
```

เปิด [http://localhost:5173](http://localhost:5173)

## วิธีอัปเดต snapshot

ตัวอย่างอัปเดตช่วง 7 วัน:

```powershell
cd "C:\Users\sponlapatp\Desktop\Codex Project"
python .\scripts\update_rice_snapshot.py --from-date 2025-01-01 --to-date 2025-01-07
```

ถ้าต้องการเปลี่ยน output:

```powershell
python .\scripts\update_rice_snapshot.py --from-date 2025-01-01 --to-date 2025-01-07 --output frontend/src/data/rice-price.json
```

หมายเหตุ:

- สคริปต์จะยิง DIT API เป็นช่วงย่อยตาม `--chunk-days` เพื่อช่วยลดโอกาส timeout
- หลังอัปเดต snapshot แล้ว ให้ build/deploy ใหม่เพื่อให้เว็บใช้ข้อมูลชุดล่าสุด

## อัปเดตแบบคลิกครั้งเดียว

ถ้าคุณไม่อยากพิมพ์หลายคำสั่งทุกครั้ง ให้ใช้ไฟล์เหล่านี้

- `scripts/update_and_publish_snapshot.ps1` : อัปเดต snapshot + commit + push
- `scripts/update_snapshot.bat` : ดับเบิลคลิกเพื่อเรียก PowerShell script ด้านบน

การทำงานของสคริปต์แบบ one-click:

1. คำนวณช่วงวันที่ล่าสุดให้อัตโนมัติจากวันนี้ย้อนหลัง `7 วัน`
2. ดึงข้อมูลจาก DIT
3. เขียนทับ `frontend/src/data/rice-price.json`
4. `git add`
5. `git commit`
6. `git push origin main`
7. ให้ Netlify deploy ใหม่จาก GitHub

ถ้าจะรันผ่าน PowerShell เอง:

```powershell
cd "C:\Users\sponlapatp\Desktop\Codex Project"
.\scripts\update_and_publish_snapshot.ps1
```

ถ้าจะกำหนดช่วงวันที่เอง:

```powershell
cd "C:\Users\sponlapatp\Desktop\Codex Project"
.\scripts\update_and_publish_snapshot.ps1 -FromDate 2025-01-01 -ToDate 2025-01-07
```

## อัปเดตอัตโนมัติรายวันผ่าน GitHub

โปรเจกต์นี้มี workflow แล้วที่:

- `.github/workflows/update-rice-snapshot.yml`

workflow นี้จะ:

1. รันทุกวันเวลา `09:15 น.` ตามเวลาไทย
2. ใช้ช่วงข้อมูลย้อนหลัง `7 วัน` โดยให้วันสิ้นสุดเป็น `เมื่อวาน`
3. อัปเดต `frontend/src/data/rice-price.json`
4. commit และ push กลับเข้า repo
5. ให้ Netlify deploy snapshot ชุดใหม่อัตโนมัติจาก GitHub

ข้อดีของวิธีนี้:

- ไม่ต้องเปิดเครื่องบริษัททิ้งไว้
- ไม่ต้องกด `.bat` ทุกวัน
- ถ้าไม่มีข้อมูลเปลี่ยน workflow จะไม่ commit เพิ่ม

ถ้าจะสั่งรันเองจาก GitHub:

1. ไปที่ repo บน GitHub
2. เปิดแท็บ `Actions`
3. เลือก workflow `Update Rice Snapshot`
4. กด `Run workflow`

## Deploy ฟรีบน Netlify

โปรเจกต์นี้ตั้งค่าไว้แล้วใน [netlify.toml](C:/Users/sponlapatp/Desktop/Codex%20Project/netlify.toml)

1. push repo นี้ขึ้น GitHub
2. ไปที่ [Netlify](https://www.netlify.com/)
3. เลือก `Add new site` -> `Import an existing project`
4. เลือก repo `Ton-Munoi99/thai-rice-price-DTI-dashboard`
5. Netlify จะอ่าน `netlify.toml` อัตโนมัติ
6. กด deploy

ค่าที่สำคัญ:

- Base directory: `frontend`
- Build command: `npm install && npm run build`
- Publish directory: `dist`

## สถานะ backend เดิม

โฟลเดอร์ `backend/` และ `render.yaml` ยังอยู่ใน repo เป็นงานเก่าจากช่วงทดลอง deploy แบบมี backend แต่ไม่จำเป็นต่อ deployment ปัจจุบันบน Netlify
