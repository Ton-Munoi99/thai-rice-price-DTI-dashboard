# Thailand Rice Price Dashboard

This project now focuses on one live data source and one product:

- Department of Internal Trade (DIT) rice price API
- Product ID: `R11001`
- Default historical window in the app: `2025-01-01` to `2025-01-07`

API references:

- Dashboard docs: [https://data.moc.go.th/OpenData/GISProductPrice](https://data.moc.go.th/OpenData/GISProductPrice)
- API base used by the app: `https://dataapi.moc.go.th/gis-product-prices`

## What the app shows

- Daily average price within the selected historical window
- 7-day average for that window
- Week-over-week change when enough rows exist
- Daily min-max band
- Daily price trend
- Daily records table
- User-selectable `from_date` / `to_date` with a short safe request window

## Quick start

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

### Open the app

- `http://localhost:5173`

## Notes

- Backend proxies the DIT API through `GET /api/dashboard/rice`
- Frontend reads only from the backend, not directly from DIT
- Daily average is calculated as the midpoint of `price_min` and `price_max`
- The app uses a short historical date window by default because wider or more recent ranges may time out

## Deploy

### Recommended setup

- Deploy the whole app on Render as a single web service

Why this is better for the current project:

- one URL for users
- no need to run frontend and backend separately
- no cross-service API URL wiring
- simpler sharing with teammates

### Files already prepared

- `render.yaml` for Render
- `netlify.toml` is still in the repo, but Render is now the recommended path

### Render deployment model

- Render builds the React frontend from `frontend`
- FastAPI serves the built frontend from `frontend/dist`
- API routes stay under `/api/...`
- users open the single Render app URL

### Render steps

1. Push this project to GitHub
2. In Render, choose `New +`
3. Select `Blueprint`
4. Connect the GitHub repo
5. Render will detect `render.yaml`
6. Create the service and wait for the first deploy
7. Open the Render URL and use the app directly

### GitHub prep

This folder is not a git repository yet.

Use these commands when you are ready to publish:

```bash
git init
git add .
git commit -m "Initial Render-ready rice price dashboard"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

### Render env already included

- `DIT_BASE_URL=https://dataapi.moc.go.th`
- `DIT_RICE_PRODUCT_ID=R11001`
- `DIT_DEFAULT_FROM_DATE=2025-01-01`
- `DIT_DEFAULT_TO_DATE=2025-01-07`
- `DIT_MAX_RANGE_DAYS=7`

### Local dev note

- In local development, the Vite frontend can still point to `http://localhost:8000` through `frontend/.env`
- In Render, the frontend uses the same origin by default
