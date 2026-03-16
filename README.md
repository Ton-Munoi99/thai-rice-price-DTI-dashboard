# Thailand Rice Price Dashboard

แดชบอร์ดนี้ถูกปรับใหม่ให้เน้น `ราคาล่าสุด` ของสินค้าข้าวหลายชนิดเป็นหลัก และให้ผู้ใช้กดดู `ประวัติย้อนหลัง 3 ปี` ได้ทันทีจาก snapshot ที่อยู่ในเว็บโดยตรง

## สิ่งที่เปลี่ยน

- หน้าแรกเน้น latest board อ่านง่าย ไม่ยัดข้อความเยอะ
- มี search + category filter สำหรับค้นหาสินค้าข้าว
- เลือกสินค้าข้าวได้หลายตัว เช่น ข้าวหอมมะลิ ข้าวหอมปทุมธานี ข้าวขาว ข้าวเหนียว และข้าวนึ่ง
- ดูย้อนหลังได้ 30 วัน, 6 เดือน, 1 ปี, และ 3 ปี
- หน้าเว็บไม่ยิง DIT API ตอนเปิดใช้งาน
- snapshot ถูกสร้างล่วงหน้าแล้ว bundle ไปกับ static site

## แหล่งข้อมูล

- DIT Open Data: [https://data.moc.go.th/OpenData/GISProductPrice](https://data.moc.go.th/OpenData/GISProductPrice)
- API prices: `https://dataapi.moc.go.th/gis-product-prices`
- API product catalog: `https://dataapi.moc.go.th/gis-products?keyword=ข้าว&sell_type=wholesale`

จากการเช็ก API จริง DIT มีสินค้ากลุ่มข้าวหลายตัว และใน snapshot ปัจจุบันผมเลือกกลุ่มหลักไว้ 11 รายการ เช่น:

- `R11029` ข้าวหอมมะลิ 100% ชั้น 1
- `R11037` ข้าวหอมปทุมธานี
- `R11035` ข้าวหอมจังหวัด
- `R11001` ข้าวขาว 100% ชั้น 1
- `R11007` ข้าวขาว 5%
- `R11018` ข้าวสารเหนียว กข.6
- `R11026` ข้าวนึ่ง 100%

## ไฟล์หลัก

- `frontend/src/App.jsx` : หน้า dashboard ใหม่
- `frontend/src/components/TrendChart.jsx` : กราฟย้อนหลัง
- `frontend/src/data/rice-dashboard.json` : snapshot หลักสำหรับหลายสินค้าข้าว
- `scripts/update_rice_snapshot.py` : สคริปต์สร้าง snapshot จาก DIT
- `scripts/update_and_publish_snapshot.ps1` : อัปเดต + commit + push
- `.github/workflows/update-rice-snapshot.yml` : อัปเดต snapshot อัตโนมัติทุกวัน

## รันในเครื่อง

```powershell
cd "C:\Users\sponlapatp\Desktop\Codex Project\frontend"
npm install
npm run dev
```

เปิด [http://localhost:5173](http://localhost:5173)

## อัปเดต snapshot เอง

อัปเดตย้อนหลัง 3 ปีถึงเมื่อวาน:

```powershell
cd "C:\Users\sponlapatp\Desktop\Codex Project"
python .\scripts\update_rice_snapshot.py
```

กำหนดช่วงเอง:

```powershell
python .\scripts\update_rice_snapshot.py --from-date 2023-01-01 --to-date 2026-03-15
```

## อัปเดตแบบคลิกครั้งเดียว

ดับเบิลคลิก:

- `scripts/update_snapshot.bat`

หรือรัน:

```powershell
cd "C:\Users\sponlapatp\Desktop\Codex Project"
.\scripts\update_and_publish_snapshot.ps1
```

สิ่งที่ script นี้ทำ:

1. ดึงข้อมูลข้าวหลายชนิดย้อนหลัง 3 ปี
2. อัปเดต `frontend/src/data/rice-dashboard.json`
3. commit
4. push ไป GitHub
5. ให้ Netlify deploy ใหม่

## อัปเดตอัตโนมัติผ่าน GitHub Actions

workflow:

- `.github/workflows/update-rice-snapshot.yml`

การทำงาน:

1. รันทุกวันเวลา `09:15 น.` ตามเวลาไทย
2. ดึงข้อมูลย้อนหลังประมาณ 3 ปีจนถึงเมื่อวาน
3. อัปเดต `frontend/src/data/rice-dashboard.json`
4. commit + push กลับเข้า repo
5. ให้ Netlify deploy อัตโนมัติ

ถ้าจะสั่งเองจาก GitHub:

1. ไปแท็บ `Actions`
2. เลือก `Update Rice Snapshot`
3. กด `Run workflow`

## หมายเหตุ

- ตอนนี้ผมตั้งเป็น `3 ปี` ก่อน เพราะทดสอบแล้วเสถียรกว่าและเหมาะกับหน้า dashboard มากกว่า 5 ปี
- ถ้าคุณอยากขยายไปเป็น “สินค้าข้าวทั้งหมด” ใน DIT ทำได้ต่อ แต่ผมแนะนำให้เริ่มจากกลุ่มหลักก่อนเพื่อคุม UX และขนาด snapshot
- ไฟล์ `frontend/src/data/rice-price.json` เป็นไฟล์เก่าจากเวอร์ชันก่อนหน้าและไม่ใช่ตัวหลักของ dashboard ใหม่แล้ว
