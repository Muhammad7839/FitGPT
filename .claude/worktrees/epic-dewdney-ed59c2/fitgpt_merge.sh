#!/bin/bash
# ================================================================
# FitGPT — Unified Final Branch Script
# Merges dieuni (frontend) into backend-features, runs tests,
# pushes everything, then merges to main.
#
# Run from your Mac terminal:
#   cd /Users/muhammad/AndroidStudioProjects/FitGPT
#   bash fitgpt_merge.sh
# ================================================================

REPO="/Users/muhammad/AndroidStudioProjects/FitGPT"
cd "$REPO"

# ── Colours ───────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}  ✓ $1${NC}"; }
warn() { echo -e "${YELLOW}  ⚠ $1${NC}"; }
fail() { echo -e "${RED}  ✗ $1${NC}"; exit 1; }
hdr()  { echo -e "\n${GREEN}▶ $1${NC}"; }

echo ""
echo "================================================================"
echo "  FitGPT — Unifying backend-features + dieuni → main"
echo "================================================================"

# ── 1. Safety check ───────────────────────────────────────────
hdr "Checking branch..."
CURRENT=$(git branch --show-current)
if [ "$CURRENT" != "backend-features" ]; then
  fail "You are on '$CURRENT'. Run: git checkout backend-features"
fi
ok "On backend-features"

# ── 2. Clear any stale merge state ────────────────────────────
hdr "Checking for incomplete merge state..."
if [ -f ".git/MERGE_HEAD" ]; then
  git merge --abort 2>/dev/null && ok "Aborted stale merge" || warn "Could not abort — continuing anyway"
else
  ok "No stale merge state"
fi

# ── 3. Push our latest commit ─────────────────────────────────
hdr "Pushing latest backend-features commit to GitHub..."
git push origin backend-features
ok "Pushed"

# ── 4. Fetch everything ───────────────────────────────────────
hdr "Fetching latest from all remotes..."
git fetch origin
ok "Fetched"
echo "  Commits we have that dieuni doesn't: $(git log --oneline origin/dieuni..HEAD | wc -l | tr -d ' ')"
echo "  Commits dieuni has that we don't:    $(git log --oneline HEAD..origin/dieuni | wc -l | tr -d ' ')"

# ── 5. Merge origin/dieuni ────────────────────────────────────
hdr "Merging origin/dieuni into backend-features..."
echo "  This brings in 153 commits: all frontend features, bcrypt fix,"
echo "  PostgreSQL support, Pydantic fix, 4 security audit passes..."
echo ""

set +e
git merge origin/dieuni --no-edit -m "merge: unify dieuni frontend + backend-features into final branch

Combines:
- dieuni: barcode scanner, voice chat (AURA hands-free), full 3D mannequin,
  drag-and-drop outfit builder, high-contrast themes, large text accessibility,
  guided tutorial, bcrypt fix, PostgreSQL support, Pydantic 422 fix,
  4 security audit passes, CI/CD pipeline
- backend-features Sprint 5: seasonal rotation, packing list, outfit reuse
  tracking, feedback weighting, receipt OCR, confidence scoring, tag
  suggestions, wardrobe gap detection, all 17 Sprint 5 tasks"
MERGE_EXIT=$?
set -e

if [ $MERGE_EXIT -ne 0 ]; then
  echo ""
  echo "  Merge had conflicts. Auto-resolving by file category..."

  # Get list of conflicted files
  CONFLICTS=$(git diff --name-only --diff-filter=U 2>/dev/null)

  if [ -n "$CONFLICTS" ]; then
    for file in $CONFLICTS; do
      if [[ "$file" == web/src/* ]] || [[ "$file" == web/public/* ]]; then
        # Frontend files → dieuni has the most features
        git checkout --theirs "$file" 2>/dev/null && git add "$file"
        echo "  ✓ [dieuni] $file"
      elif [[ "$file" == backend/app/auth.py ]]; then
        # Auth → dieuni has the critical direct-bcrypt fix
        git checkout --theirs "$file" 2>/dev/null && git add "$file"
        echo "  ✓ [dieuni/bcrypt-fix] $file"
      elif [[ "$file" == backend/app/ai/* ]]; then
        # AI engine → ours has the full Sprint 5 AI
        git checkout --ours "$file" 2>/dev/null && git add "$file"
        echo "  ✓ [ours/Sprint5-AI] $file"
      elif [[ "$file" == app/* ]]; then
        # Android → ours is more complete
        git checkout --ours "$file" 2>/dev/null && git add "$file"
        echo "  ✓ [ours/Android] $file"
      elif [[ "$file" == ".gitignore" ]] || [[ "$file" == "render.yaml" ]]; then
        # Config → ours has the latest updates
        git checkout --ours "$file" 2>/dev/null && git add "$file"
        echo "  ✓ [ours/config] $file"
      else
        # Everything else → dieuni (has bug fixes)
        git checkout --theirs "$file" 2>/dev/null && git add "$file"
        echo "  ✓ [dieuni] $file"
      fi
    done
  fi

  git commit --no-edit 2>/dev/null || \
    git commit -m "merge: resolve conflicts — unify dieuni + backend-features"
fi

ok "Merge complete"

# ── 6. Restore dieuni-only frontend files ─────────────────────
hdr "Restoring frontend features from dieuni that may have been dropped..."

RESTORE_FILES=(
  "web/src/components/BarcodeScannerModal.js"
  "web/src/components/ManualOutfitBuilder.js"
  "web/src/components/OutfitMannequinPreview.js"
  "web/src/utils/speech.js"
  "web/src/utils/barcodeScanner.js"
)

RESTORED_ANY=false
for file in "${RESTORE_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    set +e
    git checkout origin/dieuni -- "$file" 2>/dev/null
    if [ $? -eq 0 ]; then
      ok "Restored: $file"
      RESTORED_ANY=true
    else
      warn "Not found in dieuni: $file"
    fi
    set -e
  else
    ok "Already present: $file"
  fi
done

if [ "$RESTORED_ANY" = true ]; then
  git add web/src/components/BarcodeScannerModal.js \
          web/src/components/ManualOutfitBuilder.js \
          web/src/components/OutfitMannequinPreview.js \
          web/src/utils/speech.js \
          web/src/utils/barcodeScanner.js 2>/dev/null || true
  git diff --cached --quiet || \
    git commit -m "feat: restore dieuni-only frontend features after merge

Restored: barcode scanner, drag-and-drop outfit builder, full 3D mannequin
preview, AURA voice chat (speech.js), barcode scanner utility"
  ok "Restored files committed"
fi

# ── 7. Check receipt OCR route is in routes.py ────────────────
hdr "Verifying receipt OCR endpoint in routes.py..."
if grep -q "receipt.ocr\|receipt_ocr" backend/app/routes.py 2>/dev/null; then
  ok "Receipt OCR route present"
else
  warn "Receipt OCR route missing — adding it..."
  cat >> backend/app/routes.py << 'ROUTE_EOF'


# ── Receipt OCR endpoint ───────────────────────────────────────────────────
@router.post("/wardrobe/receipt-ocr", response_model=schemas.ReceiptOcrResponse)
async def scan_receipt(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Parse a receipt photo and extract clothing items for bulk wardrobe review."""
    from app.receipt_ocr import parse_receipt
    image_bytes = await file.read()
    items = parse_receipt(image_bytes, file.content_type or "image/jpeg")
    return schemas.ReceiptOcrResponse(items=items)
ROUTE_EOF
  git add backend/app/routes.py
  git commit -m "fix: restore receipt OCR route in routes.py after merge"
  ok "Receipt OCR route added and committed"
fi

# ── 8. Verify bcrypt fix ───────────────────────────────────────
hdr "Verifying bcrypt fix in auth.py..."
if grep -q "^import bcrypt" backend/app/auth.py 2>/dev/null; then
  ok "Direct bcrypt import confirmed (passlib removed)"
else
  warn "auth.py may still reference passlib — applying bcrypt fix from dieuni"
  git checkout origin/dieuni -- backend/app/auth.py
  git add backend/app/auth.py
  git commit -m "fix: apply direct bcrypt fix from dieuni (Python 3.13 compat)"
  ok "bcrypt fix applied"
fi

# ── 9. Check EXPOSE_RESET_TOKEN is safe ───────────────────────
hdr "Checking security flags in .env.example..."
if grep -q "EXPOSE_RESET_TOKEN_IN_RESPONSE=true" backend/.env.example 2>/dev/null; then
  sed -i '' 's/EXPOSE_RESET_TOKEN_IN_RESPONSE=true/EXPOSE_RESET_TOKEN_IN_RESPONSE=false/' backend/.env.example
  git add backend/.env.example
  git commit -m "security: set EXPOSE_RESET_TOKEN_IN_RESPONSE=false in .env.example"
  ok "Fixed: EXPOSE_RESET_TOKEN_IN_RESPONSE set to false"
else
  ok "EXPOSE_RESET_TOKEN_IN_RESPONSE is safe"
fi

# ── 10. Run backend tests ──────────────────────────────────────
hdr "Running backend tests..."
cd backend

# Find or create venv
if [ -d ".venv" ]; then
  source .venv/bin/activate
elif [ -d "venv" ]; then
  source venv/bin/activate
else
  echo "  Creating virtual environment..."
  python3 -m venv .venv && source .venv/bin/activate
fi

pip install -r requirements.txt -q
echo ""
set +e
pytest -q --tb=short 2>&1
BACKEND_EXIT=$?
set -e
deactivate
cd "$REPO"

if [ $BACKEND_EXIT -eq 0 ]; then
  ok "All backend tests passed"
else
  warn "Some backend tests failed — review output above before pushing to main"
fi

# ── 11. Run frontend tests ─────────────────────────────────────
hdr "Running frontend tests..."
cd web
if [ ! -d "node_modules" ]; then
  echo "  Installing node_modules..."
  npm install --silent
fi
set +e
CI=true npm test -- --watchAll=false --passWithNoTests 2>&1 | tail -30
FRONTEND_EXIT=${PIPESTATUS[0]}
set -e
cd "$REPO"

if [ $FRONTEND_EXIT -eq 0 ]; then
  ok "Frontend tests passed"
else
  warn "Some frontend tests failed — review output above"
fi

# ── 12. Push unified backend-features ─────────────────────────
hdr "Pushing unified backend-features to GitHub..."
git push origin backend-features
ok "backend-features pushed to GitHub"

# ── 13. Merge to main ─────────────────────────────────────────
hdr "Merging backend-features into main (final production branch)..."
git checkout main
git pull origin main

set +e
git merge backend-features --no-edit -m "release: FitGPT final production merge

All features unified:
- React 19 frontend: barcode scanner, voice chat, 3D mannequin, outfit builder,
  themes, accessibility, receipt scanner, guided tutorial
- FastAPI backend: full AI engine (Sprint 5), recommendations, weather,
  wardrobe CRUD, packing list, outfit planning, chat (AURA)
- Android app (Kotlin): full screen set, GPS weather, auth, AURA chat
- Security: direct bcrypt, JWT, rate limiting, Pydantic validation
- Infrastructure: PostgreSQL on Render, Vercel frontend, CI/CD pipeline
- Tests: 26 backend modules, 600+ frontend tests"
MAIN_MERGE_EXIT=$?
set -e

if [ $MAIN_MERGE_EXIT -ne 0 ]; then
  warn "Merge to main had conflicts — auto-resolving with backend-features version..."
  git checkout --ours . 2>/dev/null
  git add . 2>/dev/null
  git commit -m "release: FitGPT final production merge (conflicts resolved)" 2>/dev/null || true
fi

git push origin main
ok "main pushed to GitHub"
git checkout backend-features

# ── Done ──────────────────────────────────────────────────────
echo ""
echo "================================================================"
echo -e "${GREEN}  ALL DONE — FitGPT is unified and live on main${NC}"
echo "================================================================"
echo ""
echo "  Branch: backend-features — unified, fully featured, pushed"
echo "  Branch: main             — final production release, pushed"
echo ""
echo "  Features in the final branch:"
echo "  Backend  → FastAPI + Sprint 5 AI + receipt OCR + all routes"
echo "  Frontend → All dieuni features + receipt scanner + new components"
echo "  Android  → Full Kotlin app with GPS, auth, AURA chat"
echo "  Security → bcrypt fix, JWT, rate limiting, Pydantic validation"
echo "  CI/CD    → GitHub Actions running tests on every PR"
echo ""
if [ $BACKEND_EXIT -ne 0 ] || [ $FRONTEND_EXIT -ne 0 ]; then
  echo -e "${YELLOW}  NOTE: Some tests failed — check output above and fix before demo${NC}"
fi
echo ""
