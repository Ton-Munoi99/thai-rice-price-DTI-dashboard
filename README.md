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
